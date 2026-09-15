export class AudioEngine {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = "auto";

    this.audioCtx = null;
    this.source = null;
    this.analyser = null;
    this.bassFilter = null;
    this.midFilter = null;
    this.trebleFilter = null;
    this.panner = null;
    this.gainNode = null;
    this.isInitialized = false;

    this.currentTrack = null;
    this.volume = 0.8;
    this.playbackRate = 1.0;
    this.isMuted = false;
    this.audio.volume = this.volume;

    this.callbacks = {
      onTimeUpdate: null,
      onEnded: null,
      onPlay: null,
      onPause: null,
      onLoadedMetadata: null,
      onError: null
    };

    this.setupAudioListeners();
  }

  initWebAudio() {
    if (this.isInitialized) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioCtx = new AudioContextClass();

      this.source = this.audioCtx.createMediaElementSource(this.audio);

      // 3-Band Equalizer Filters
      this.bassFilter = this.audioCtx.createBiquadFilter();
      this.bassFilter.type = "lowshelf";
      this.bassFilter.frequency.value = 200;
      this.bassFilter.gain.value = 0;

      this.midFilter = this.audioCtx.createBiquadFilter();
      this.midFilter.type = "peaking";
      this.midFilter.frequency.value = 1500;
      this.midFilter.Q.value = 1.0;
      this.midFilter.gain.value = 0;

      this.trebleFilter = this.audioCtx.createBiquadFilter();
      this.trebleFilter.type = "highshelf";
      this.trebleFilter.frequency.value = 4500;
      this.trebleFilter.gain.value = 0;

      // Stereo Panner
      if (this.audioCtx.createStereoPanner) {
        this.panner = this.audioCtx.createStereoPanner();
        this.panner.pan.value = 0;
      }

      // Analyser Node for Visualizers
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.82;

      // Master Gain Node
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 1.0;

      // Connect graph: source -> bass -> mid -> treble -> panner -> analyser -> gain -> destination
      let lastNode = this.source;
      lastNode.connect(this.bassFilter);
      lastNode = this.bassFilter;

      lastNode.connect(this.midFilter);
      lastNode = this.midFilter;

      lastNode.connect(this.trebleFilter);
      lastNode = this.trebleFilter;

      if (this.panner) {
        lastNode.connect(this.panner);
        lastNode = this.panner;
      }

      lastNode.connect(this.analyser);
      this.analyser.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);

      this.isInitialized = true;
    } catch (e) {
      console.warn("Web Audio API initialized in fallback mode:", e);
    }
  }

  ensureContextRunning() {
    this.initWebAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  setupAudioListeners() {
    this.audio.addEventListener("timeupdate", () => {
      if (this.callbacks.onTimeUpdate) {
        this.callbacks.onTimeUpdate(this.audio.currentTime, this.audio.duration || 0);
      }
    });

    this.audio.addEventListener("ended", () => {
      if (this.callbacks.onEnded) this.callbacks.onEnded();
    });

    this.audio.addEventListener("play", () => {
      this.ensureContextRunning();
      if (this.callbacks.onPlay) this.callbacks.onPlay();
    });

    this.audio.addEventListener("pause", () => {
      if (this.callbacks.onPause) this.callbacks.onPause();
    });

    this.audio.addEventListener("loadedmetadata", () => {
      if (this.callbacks.onLoadedMetadata) {
        this.callbacks.onLoadedMetadata(this.audio.duration);
      }
    });

    this.audio.addEventListener("error", (e) => {
      console.warn("Audio element encountered playback error for source:", this.audio.src, e);
      if (this.callbacks.onError) {
        this.callbacks.onError(e);
      }
    });
  }

  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  loadTrack(track, autoPlay = true) {
    this.currentTrack = track;
    if (!track || !track.src) return Promise.resolve(false);

    this.audio.src = track.src;
    this.audio.load();

    if (autoPlay) {
      return this.play();
    }
    return Promise.resolve(true);
  }

  play() {
    this.ensureContextRunning();
    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      return playPromise
        .then(() => true)
        .catch((err) => {
          // Handled abort or autoplay policy block
          if (err.name !== 'AbortError') {
            console.warn("Playback prevented or error:", err);
          }
          return false;
        });
    }
    return Promise.resolve(true);
  }

  pause() {
    this.audio.pause();
  }

  togglePlay() {
    if (this.audio.paused) {
      return this.play();
    } else {
      this.pause();
      return Promise.resolve(false);
    }
  }

  seek(timeInSeconds) {
    if (Number.isFinite(timeInSeconds)) {
      const duration = this.audio.duration || 0;
      const target = Math.max(0, Math.min(timeInSeconds, duration || timeInSeconds));
      this.audio.currentTime = target;
    }
  }

  seekRelative(deltaSeconds) {
    const duration = this.audio.duration || 0;
    const newTime = Math.max(0, Math.min(this.audio.currentTime + deltaSeconds, duration));
    this.audio.currentTime = newTime;
  }

  seekPercentage(percent) {
    if (this.audio.duration) {
      const clamped = Math.max(0, Math.min(100, percent));
      this.audio.currentTime = (clamped / 100) * this.audio.duration;
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (!this.isMuted) {
      this.audio.volume = this.volume;
    }
  }

  setVolumeRelative(delta) {
    const newVol = Math.max(0, Math.min(1, this.volume + delta));
    this.setVolume(newVol);
    return this.volume;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.audio.muted = this.isMuted;
    return this.isMuted;
  }

  setMuted(muted) {
    this.isMuted = !!muted;
    this.audio.muted = this.isMuted;
  }

  setPlaybackRate(rate) {
    this.playbackRate = rate;
    this.audio.playbackRate = rate;
  }

  setEqualizer(bassGain, midGain, trebleGain) {
    if (this.bassFilter) this.bassFilter.gain.value = bassGain;
    if (this.midFilter) this.midFilter.gain.value = midGain;
    if (this.trebleFilter) this.trebleFilter.gain.value = trebleGain;
  }

  setPan(panVal) {
    if (this.panner) {
      this.panner.pan.value = Math.max(-1, Math.min(1, panVal));
    }
  }

  getFrequencyData(array) {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(array);
    } else {
      // Simulate synthetic values if Web Audio is suspended or disabled
      for (let i = 0; i < array.length; i++) {
        array[i] = !this.audio.paused ? Math.floor(Math.random() * 128) : 0;
      }
    }
  }

  getTimeDomainData(array) {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(array);
    }
  }

  isPlaying() {
    return !this.audio.paused && !this.audio.ended && this.audio.readyState > 2;
  }

  getCurrentTime() {
    return this.audio.currentTime || 0;
  }

  getDuration() {
    return this.audio.duration || 0;
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
  }
}
