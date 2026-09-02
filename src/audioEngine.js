export class AudioEngine {
  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = "anonymous";
    this.audio.preload = "metadata";

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
      console.warn("Web Audio API not fully available or blocked by CORS, falling back to direct HTML5 Audio:", e);
    }
  }

  ensureContextRunning() {
    this.initWebAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
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
      console.error("Audio error:", e);
      if (this.callbacks.onError) this.callbacks.onError(e);
    });
  }

  loadTrack(track, autoplay = false) {
    this.currentTrack = track;
    this.audio.src = track.src;
    this.audio.playbackRate = this.playbackRate;
    this.audio.load();

    this.updateMediaSession(track);

    if (autoplay) {
      this.play();
    }
  }

  async play() {
    this.ensureContextRunning();
    try {
      await this.audio.play();
      return true;
    } catch (err) {
      console.warn("Playback prevented or interrupted:", err);
      return false;
    }
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

  seek(seconds) {
    if (Number.isFinite(seconds) && seconds >= 0) {
      this.audio.currentTime = Math.min(seconds, this.audio.duration || seconds);
    }
  }

  seekByPercent(percent) {
    if (this.audio.duration) {
      this.audio.currentTime = (percent / 100) * this.audio.duration;
    }
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (!this.isMuted) {
      this.audio.volume = this.volume;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.audio.volume = this.isMuted ? 0 : this.volume;
    return this.isMuted;
  }

  setPlaybackRate(rate) {
    this.playbackRate = rate;
    this.audio.playbackRate = rate;
  }

  setPan(panValue) {
    if (this.panner) {
      this.panner.pan.setValueAtTime(panValue, this.audioCtx ? this.audioCtx.currentTime : 0);
    }
  }

  setEQ(bass = 0, mid = 0, treble = 0) {
    const time = this.audioCtx ? this.audioCtx.currentTime : 0;
    if (this.bassFilter) this.bassFilter.gain.setValueAtTime(bass, time);
    if (this.midFilter) this.midFilter.gain.setValueAtTime(mid, time);
    if (this.trebleFilter) this.trebleFilter.gain.setValueAtTime(treble, time);
  }

  applyPreset(presetName) {
    const presets = {
      flat: [0, 0, 0],
      bass: [9, -2, 2],
      vocal: [-3, 7, 3],
      edm: [8, 1, 6],
      rock: [6, -3, 7],
      chill: [4, 3, 5]
    };
    const gains = presets[presetName.toLowerCase()] || presets.flat;
    this.setEQ(...gains);
    return gains;
  }

  getFrequencyData(array) {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(array);
    } else {
      // Simulate frequency pulses if analyser not initialized yet
      for (let i = 0; i < array.length; i++) {
        array[i] = this.audio.paused ? 0 : Math.floor(Math.sin(Date.now() * 0.005 + i * 0.2) * 60 + 80);
      }
    }
  }

  getTimeDomainData(array) {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(array);
    } else {
      for (let i = 0; i < array.length; i++) {
        array[i] = 128;
      }
    }
  }

  getAnalyserFrequencyBinCount() {
    return this.analyser ? this.analyser.frequencyBinCount : 256;
  }

  updateMediaSession(track) {
    if ('mediaSession' in navigator && track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'Music Player',
        artwork: [
          { src: track.cover, sizes: '512x512', type: 'image/jpeg' }
        ]
      });
    }
  }
}
