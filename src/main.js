import './style.css';
import { INITIAL_SONGS } from './songs.js';
import { AudioEngine } from './audioEngine.js';
import { AudioVisualizer, renderEqModalSpectrum } from './visualizer.js';
import confetti from 'canvas-confetti';

class MusicPlayerApp {
  constructor() {
    this.audioEngine = new AudioEngine();
    this.visualizer = null;

    this.songs = [...INITIAL_SONGS];
    this.filteredSongs = [...this.songs];
    this.currentTrackIndex = 0;
    this.currentTrack = this.songs[0];

    this.mode = localStorage.getItem('mp_mode') || 'studio'; // 'studio' | 'office'
    this.termTheme = localStorage.getItem('mp_term_theme') || 'neutral'; // 'neutral' | 'matrix' | 'cyan' | 'amber' | 'red'
    this.isCrtActive = localStorage.getItem('mp_crt') !== 'false';
    this.isMatrixRainActive = localStorage.getItem('mp_matrix') === 'true';

    this.isShuffle = false;
    this.repeatMode = 'all'; // 'all', 'one', 'off'
    this.activeFilter = 'all';
    this.searchQuery = '';

    // Favorites from LocalStorage
    this.favorites = new Set(JSON.parse(localStorage.getItem('mp_favorites') || '[]'));

    // Terminal simulated system stats & telemetry
    this.uptimeSeconds = 862;
    this.termAsciiBlocks = [' ', ' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    this.isLogsStreaming = true;
    this.logsSpeed = 'normal'; // 'fast', 'normal', 'slow'
    this.logsInterval = null;
    this.matrixAnimationId = null;

    // EQ live spectrum loop
    this.eqVisualizerLoopId = null;
    this.eqGains = [0, 0, 0]; // [bass, mid, treble]

    // Frequency buffer for live ASCII & Hex inspectors
    this.freqDataArray = new Uint8Array(64);

    this.initDOM();
    this.initVisualizer();
    this.initMatrixRain();
    this.setupAudioEngineCallbacks();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.setupDragAndDrop();
    this.setupTerminalShell();
    this.setupLiveLogStream();

    // Set initial mode & themes
    this.applyTheme(this.termTheme);
    this.toggleCrt(this.isCrtActive);
    this.toggleMatrixRain(this.isMatrixRainActive);
    this.applyMode(this.mode);

    // Load initial track
    this.loadTrack(0, false);
    this.renderTrackList();
    this.renderTerminalProcessTable();
    this.startRealtimeTelemetryLoop();
  }

  initDOM() {
    this.dom = {
      body: document.body,
      studioApp: document.getElementById('studioApp'),
      terminalApp: document.getElementById('terminalApp'),
      ambientBg: document.getElementById('ambientBg'),
      btnToggleMode: document.getElementById('btnToggleMode'),

      // Studio Containers
      trackList: document.getElementById('trackList'),
      trackCountBadge: document.getElementById('trackCountBadge'),
      filterTabs: document.getElementById('filterTabs'),
      
      // Center Stage
      centerShowcase: document.getElementById('centerShowcase'),
      centerCover: document.getElementById('centerCover'),
      centerTitle: document.getElementById('centerTitle'),
      centerArtist: document.getElementById('centerArtist'),
      centerGenre: document.getElementById('centerGenre'),
      centerYear: document.getElementById('centerYear'),
      lyricsBox: document.getElementById('lyricsBox'),

      // Playbar Left
      playbarCover: document.getElementById('playbarCover'),
      playbarTitle: document.getElementById('playbarTitle'),
      playbarArtist: document.getElementById('playbarArtist'),
      btnPlaybarLike: document.getElementById('btnPlaybarLike'),

      // Playbar Controls
      btnShuffle: document.getElementById('btnShuffle'),
      btnPrev: document.getElementById('btnPrev'),
      btnPlay: document.getElementById('btnPlay'),
      btnNext: document.getElementById('btnNext'),
      btnRepeat: document.getElementById('btnRepeat'),

      // Scrubber
      timeCurrent: document.getElementById('timeCurrent'),
      timeTotal: document.getElementById('timeTotal'),
      scrubberContainer: document.getElementById('scrubberContainer'),
      scrubberFill: document.getElementById('scrubberFill'),
      scrubberThumb: document.getElementById('scrubberThumb'),

      // Playbar Right
      btnVolume: document.getElementById('btnVolume'),
      volumeSlider: document.getElementById('volumeSlider'),
      speedSelect: document.getElementById('speedSelect'),
      btnOpenEq: document.getElementById('btnOpenEq'),
      btnOpenShortcuts: document.getElementById('btnOpenShortcuts'),

      // Visualizer
      visualizerCanvas: document.getElementById('visualizerCanvas'),
      visModeSelector: document.getElementById('visModeSelector'),
      btnToggleFullscreenVis: document.getElementById('btnToggleFullscreenVis'),

      // Search & Dropzone
      searchInput: document.getElementById('searchInput'),
      searchClearBtn: document.getElementById('searchClearBtn'),
      fileDropzone: document.getElementById('fileDropzone'),
      fileInput: document.getElementById('fileInput'),

      // Modals
      eqModal: document.getElementById('eqModal'),
      btnCloseEq: document.getElementById('btnCloseEq'),
      eqPresets: document.getElementById('eqPresets'),
      eqVisualizerCanvas: document.getElementById('eqVisualizerCanvas'),
      bassSlider: document.getElementById('bassSlider'),
      midSlider: document.getElementById('midSlider'),
      trebleSlider: document.getElementById('trebleSlider'),
      bassVal: document.getElementById('bassVal'),
      midVal: document.getElementById('midVal'),
      trebleVal: document.getElementById('trebleVal'),
      bassVuMeter: document.getElementById('bassVuMeter'),
      midVuMeter: document.getElementById('midVuMeter'),
      trebleVuMeter: document.getElementById('trebleVuMeter'),
      shortcutsModal: document.getElementById('shortcutsModal'),
      btnCloseShortcuts: document.getElementById('btnCloseShortcuts'),
      toastContainer: document.getElementById('toastContainer'),

      // Terminal Hacker Elements
      matrixCanvas: document.getElementById('matrixCanvas'),
      crtOverlay: document.getElementById('crtOverlay'),
      btnTermSwitchStudio: document.getElementById('btnTermSwitchStudio'),
      btnTermExit: document.getElementById('btnTermExit'),
      btnTermMin: document.getElementById('btnTermMin'),
      btnTermMax: document.getElementById('btnTermMax'),
      btnToggleMatrix: document.getElementById('btnToggleMatrix'),
      lblMatrixState: document.getElementById('lblMatrixState'),
      btnToggleCrt: document.getElementById('btnToggleCrt'),
      lblCrtState: document.getElementById('lblCrtState'),
      termHeaderPrompt: document.getElementById('termHeaderPrompt'),
      termUptime: document.getElementById('termUptime'),
      termCpu: document.getElementById('termCpu'),
      termMem: document.getElementById('termMem'),
      termDaemonStatus: document.getElementById('termDaemonStatus'),
      termTrackStatus: document.getElementById('termTrackStatus'),
      termCurrentTrackName: document.getElementById('termCurrentTrackName'),
      termProgressClickArea: document.getElementById('termProgressClickArea'),
      termAsciiBar: document.getElementById('termAsciiBar'),
      termAsciiPercent: document.getElementById('termAsciiPercent'),
      termAsciiTime: document.getElementById('termAsciiTime'),
      termAsciiSpectrum: document.getElementById('termAsciiSpectrum'),
      termHexDump: document.getElementById('termHexDump'),
      btnTermPlay: document.getElementById('btnTermPlay'),
      termPlayText: document.getElementById('termPlayText'),
      btnTermPrev: document.getElementById('btnTermPrev'),
      btnTermNext: document.getElementById('btnTermNext'),
      btnTermShuffle: document.getElementById('btnTermShuffle'),
      btnTermRepeat: document.getElementById('btnTermRepeat'),
      btnTermVolDown: document.getElementById('btnTermVolDown'),
      btnTermVolUp: document.getElementById('btnTermVolUp'),
      btnTermMute: document.getElementById('btnTermMute'),
      termProcessTableBody: document.getElementById('termProcessTableBody'),
      termQueueCount: document.getElementById('termQueueCount'),
      
      // Live Streaming Logs Elements
      termLiveLogStream: document.getElementById('termLiveLogStream'),
      btnToggleLogStream: document.getElementById('btnToggleLogStream'),
      btnClearLogs: document.getElementById('btnClearLogs'),
      btnLogSpeed: document.getElementById('btnLogSpeed'),

      // Terminal Shell
      termOutput: document.getElementById('termOutput'),
      termCommandForm: document.getElementById('termCommandForm'),
      termPromptStr: document.getElementById('termPromptStr'),
      termInput: document.getElementById('termInput')
    };
  }

  initVisualizer() {
    if (this.dom.visualizerCanvas) {
      this.visualizer = new AudioVisualizer(this.dom.visualizerCanvas, this.audioEngine);
      this.visualizer.start();
    }
  }

  // ==========================================
  // Matrix Digital Rain Engine
  // ==========================================
  initMatrixRain() {
    const canvas = this.dom.matrixCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const chars = '0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ';
    const fontSize = 14;
    let columns = 0;
    let drops = [];

    const resizeMatrix = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / fontSize);
      drops = [];
      for (let i = 0; i < columns; i++) {
        drops[i] = Math.floor(Math.random() * -50);
      }
    };

    resizeMatrix();
    window.addEventListener('resize', resizeMatrix);

    const drawMatrix = () => {
      if (!this.isMatrixRainActive || this.mode !== 'office') {
        this.matrixAnimationId = requestAnimationFrame(drawMatrix);
        return;
      }

      ctx.fillStyle = 'rgba(3, 5, 8, 0.07)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;

      const rainColor = this.termTheme === 'cyan' ? '#06b6d4' :
                        this.termTheme === 'amber' ? '#f59e0b' :
                        this.termTheme === 'red' ? '#ef4444' :
                        this.termTheme === 'neutral' ? '#38bdf8' : '#22c55e';

      for (let i = 0; i < drops.length; i++) {
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        ctx.fillStyle = Math.random() > 0.95 ? '#ffffff' : rainColor;
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      this.matrixAnimationId = requestAnimationFrame(drawMatrix);
    };

    this.matrixAnimationId = requestAnimationFrame(drawMatrix);
  }

  toggleMatrixRain(forceState) {
    this.isMatrixRainActive = forceState !== undefined ? forceState : !this.isMatrixRainActive;
    localStorage.setItem('mp_matrix', this.isMatrixRainActive);

    if (this.dom.matrixCanvas) {
      if (this.isMatrixRainActive) {
        this.dom.matrixCanvas.classList.add('active');
        if (this.dom.lblMatrixState) this.dom.lblMatrixState.textContent = 'ON';
      } else {
        this.dom.matrixCanvas.classList.remove('active');
        if (this.dom.lblMatrixState) this.dom.lblMatrixState.textContent = 'OFF';
      }
    }
  }

  toggleCrt(forceState) {
    this.isCrtActive = forceState !== undefined ? forceState : !this.isCrtActive;
    localStorage.setItem('mp_crt', this.isCrtActive);

    if (this.dom.crtOverlay) {
      if (this.isCrtActive) {
        this.dom.crtOverlay.classList.add('crt-active');
        if (this.dom.lblCrtState) this.dom.lblCrtState.textContent = 'ON';
      } else {
        this.dom.crtOverlay.classList.remove('crt-active');
        if (this.dom.lblCrtState) this.dom.lblCrtState.textContent = 'OFF';
      }
    }
  }

  applyTheme(theme) {
    this.termTheme = theme;
    localStorage.setItem('mp_term_theme', theme);

    // Remove old theme classes
    ['theme-neutral', 'theme-matrix', 'theme-cyan', 'theme-amber', 'theme-red'].forEach(t => {
      this.dom.body.classList.remove(t);
    });

    this.dom.body.classList.add(`theme-${theme}`);

    // Update active theme chip
    document.querySelectorAll('.term-theme-chip').forEach(chip => {
      if (chip.dataset.termtheme === theme) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    if (this.dom.termPromptStr) {
      const user = theme === 'matrix' ? 'neo@zion-mainframe' :
                   theme === 'cyan' ? 'cyber@nightcity-net' :
                   theme === 'amber' ? 'operator@dec-vax780' :
                   theme === 'red' ? 'alert@redwire-root' : 'root@mainframe';
      this.dom.termPromptStr.textContent = `${user}:~$`;
    }
  }

  applyMode(mode) {
    this.mode = mode;
    localStorage.setItem('mp_mode', mode);

    if (mode === 'office') {
      this.dom.body.classList.remove('mode-studio');
      this.dom.body.classList.add('mode-office');
      document.title = "bash: kernel-dsp-daemon (pid 4928)";
      this.updateTerminalDisplay();
      if (this.dom.termInput) this.dom.termInput.focus();
    } else {
      this.dom.body.classList.remove('mode-office');
      this.dom.body.classList.add('mode-studio');
      document.title = "AuraTune — Modern Web Music Player";
      if (this.visualizer) this.visualizer.resize();
    }
  }

  toggleMode() {
    const newMode = this.mode === 'studio' ? 'office' : 'studio';
    this.applyMode(newMode);
    this.showToast(newMode === 'office' ? "🖥️ Stealth Hacker CLI Mode Active" : "✨ Studio Mode Active");
  }

  setupAudioEngineCallbacks() {
    this.audioEngine.callbacks.onPlay = () => {
      this.updatePlayState(true);
      if (this.visualizer) this.visualizer.start();
    };

    this.audioEngine.callbacks.onPause = () => {
      this.updatePlayState(false);
    };

    this.audioEngine.callbacks.onTimeUpdate = (currentTime, duration) => {
      this.updateProgress(currentTime, duration);
      this.updateLyrics(currentTime);
      this.updateTerminalProgress(currentTime, duration);
    };

    this.audioEngine.callbacks.onLoadedMetadata = (duration) => {
      this.dom.timeTotal.textContent = this.formatTime(duration);
    };

    this.audioEngine.callbacks.onEnded = () => {
      if (this.repeatMode === 'one') {
        this.audioEngine.seek(0);
        this.audioEngine.play();
      } else {
        this.nextTrack();
      }
    };

    this.audioEngine.callbacks.onError = () => {
      this.showToast("⚠️ Could not load audio file. Trying next track...", "error");
      setTimeout(() => this.nextTrack(), 1500);
    };
  }

  setupEventListeners() {
    // Mode Switchers
    this.dom.btnToggleMode.addEventListener('click', () => this.toggleMode());
    this.dom.btnTermSwitchStudio.addEventListener('click', () => this.applyMode('studio'));
    this.dom.btnTermExit.addEventListener('click', () => this.applyMode('studio'));
    this.dom.btnTermMin.addEventListener('click', () => this.showToast("📁 CLI Process Minimized"));
    this.dom.btnTermMax.addEventListener('click', () => this.toggleFullscreen());

    // Theme Chips
    document.querySelectorAll('.term-theme-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.applyTheme(chip.dataset.termtheme);
        this.showToast(`CLI Theme: ${chip.dataset.termtheme.toUpperCase()}`);
      });
    });

    // CRT & Matrix Rain Toggles
    if (this.dom.btnToggleCrt) {
      this.dom.btnToggleCrt.addEventListener('click', () => this.toggleCrt());
    }
    if (this.dom.btnToggleMatrix) {
      this.dom.btnToggleMatrix.addEventListener('click', () => this.toggleMatrixRain());
    }

    // Studio Play/Pause, Prev, Next
    this.dom.btnPlay.addEventListener('click', () => this.audioEngine.togglePlay());
    this.dom.btnPrev.addEventListener('click', () => this.prevTrack());
    this.dom.btnNext.addEventListener('click', () => this.nextTrack());

    // Studio Shuffle & Repeat
    this.dom.btnShuffle.addEventListener('click', () => this.toggleShuffle());
    this.dom.btnRepeat.addEventListener('click', () => this.cycleRepeat());

    // Studio Scrubber
    let isScrubbing = false;
    const handleScrub = (e) => {
      const rect = this.dom.scrubberContainer.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.dom.scrubberFill.style.width = `${pos * 100}%`;
      this.dom.scrubberThumb.style.left = `${pos * 100}%`;
      this.audioEngine.seekByPercent(pos * 100);
    };

    this.dom.scrubberContainer.addEventListener('mousedown', (e) => {
      isScrubbing = true;
      handleScrub(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (isScrubbing) handleScrub(e);
    });

    window.addEventListener('mouseup', () => {
      isScrubbing = false;
    });

    // Volume Slider & Mute
    this.dom.volumeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.audioEngine.setVolume(val);
      this.updateVolumeIcon(val);
      this.updateTerminalVolText();
    });

    this.dom.btnVolume.addEventListener('click', () => {
      const isMuted = this.audioEngine.toggleMute();
      this.updateVolumeIcon(isMuted ? 0 : this.audioEngine.volume);
      this.updateTerminalVolText(isMuted);
      this.showToast(isMuted ? "🔇 Audio Muted" : "🔊 Audio Unmuted");
    });

    // Playback Speed
    this.dom.speedSelect.addEventListener('change', (e) => {
      const rate = parseFloat(e.target.value);
      this.audioEngine.setPlaybackRate(rate);
      this.showToast(`⚡ Speed: ${rate}x`);
    });

    // Favorite button
    this.dom.btnPlaybarLike.addEventListener('click', () => {
      this.toggleFavorite(this.currentTrack.id);
    });

    // Visualizer Mode Selector
    this.dom.visModeSelector.querySelectorAll('.vis-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.visModeSelector.querySelectorAll('.vis-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        if (this.visualizer) this.visualizer.setMode(mode);
        this.showToast(`Visualizer: ${btn.textContent}`);
      });
    });

    // Visualizer Fullscreen
    this.dom.btnToggleFullscreenVis.addEventListener('click', () => this.toggleFullscreen());

    // Search Box
    this.dom.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.applyFilters();
      this.dom.searchClearBtn.style.display = this.searchQuery ? 'block' : 'none';
    });

    this.dom.searchClearBtn.addEventListener('click', () => {
      this.dom.searchInput.value = '';
      this.searchQuery = '';
      this.applyFilters();
      this.dom.searchClearBtn.style.display = 'none';
      this.dom.searchInput.focus();
    });

    // Filter Chips
    this.dom.filterTabs.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.dom.filterTabs.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeFilter = chip.dataset.filter;
        this.applyFilters();
      });
    });

    // Equalizer Modal Trigger & Controls
    this.dom.btnOpenEq.addEventListener('click', () => {
      this.toggleModal(this.dom.eqModal, true);
      this.startEqSpectrumLoop();
    });
    this.dom.btnCloseEq.addEventListener('click', () => {
      this.toggleModal(this.dom.eqModal, false);
      this.stopEqSpectrumLoop();
    });

    // Shortcuts Modal Trigger
    this.dom.btnOpenShortcuts.addEventListener('click', () => this.toggleModal(this.dom.shortcutsModal, true));
    this.dom.btnCloseShortcuts.addEventListener('click', () => this.toggleModal(this.dom.shortcutsModal, false));

    // Equalizer Sliders
    const updateEQ = () => {
      const bass = parseFloat(this.dom.bassSlider.value);
      const mid = parseFloat(this.dom.midSlider.value);
      const treble = parseFloat(this.dom.trebleSlider.value);
      this.eqGains = [bass, mid, treble];
      this.audioEngine.setEQ(bass, mid, treble);
      this.dom.bassVal.textContent = `${bass > 0 ? '+' : ''}${bass.toFixed(1)}dB`;
      this.dom.midVal.textContent = `${mid > 0 ? '+' : ''}${mid.toFixed(1)}dB`;
      this.dom.trebleVal.textContent = `${treble > 0 ? '+' : ''}${treble.toFixed(1)}dB`;
    };

    [this.dom.bassSlider, this.dom.midSlider, this.dom.trebleSlider].forEach(slider => {
      slider.addEventListener('input', () => {
        this.dom.eqPresets.querySelectorAll('.eq-preset-chip').forEach(c => c.classList.remove('active'));
        updateEQ();
      });
    });

    // Equalizer Presets
    this.dom.eqPresets.querySelectorAll('.eq-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.dom.eqPresets.querySelectorAll('.eq-preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const preset = chip.dataset.preset;
        const presetsMap = {
          flat: [0, 0, 0],
          bass: [9, -2, 2],
          vocal: [-3, 7, 3],
          edm: [8, 1, 6],
          rock: [6, -3, 7],
          cyberpunk: [7, 3, 8],
          chill: [4, 3, 5],
          acoustic: [3, 5, 6]
        };
        const gains = presetsMap[preset.toLowerCase()] || [0, 0, 0];
        this.audioEngine.setEQ(...gains);
        this.dom.bassSlider.value = gains[0];
        this.dom.midSlider.value = gains[1];
        this.dom.trebleSlider.value = gains[2];
        updateEQ();
        this.showToast(`EQ Preset: ${chip.textContent}`);
      });
    });

    // Modal background close
    [this.dom.eqModal, this.dom.shortcutsModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.toggleModal(modal, false);
          if (modal === this.dom.eqModal) this.stopEqSpectrumLoop();
        }
      });
    });

    // Terminal Discrete Playback Buttons
    this.dom.btnTermPlay.addEventListener('click', () => this.audioEngine.togglePlay());
    this.dom.btnTermPrev.addEventListener('click', () => this.prevTrack());
    this.dom.btnTermNext.addEventListener('click', () => this.nextTrack());
    this.dom.btnTermShuffle.addEventListener('click', () => this.toggleShuffle());
    this.dom.btnTermRepeat.addEventListener('click', () => this.cycleRepeat());

    this.dom.btnTermVolDown.addEventListener('click', () => {
      this.audioEngine.setVolume(this.audioEngine.volume - 0.1);
      this.dom.volumeSlider.value = this.audioEngine.volume;
      this.updateTerminalVolText();
    });

    this.dom.btnTermVolUp.addEventListener('click', () => {
      this.audioEngine.setVolume(this.audioEngine.volume + 0.1);
      this.dom.volumeSlider.value = this.audioEngine.volume;
      this.updateTerminalVolText();
    });

    this.dom.btnTermMute.addEventListener('click', () => {
      const isMuted = this.audioEngine.toggleMute();
      this.updateTerminalVolText(isMuted);
    });

    // Terminal ASCII Progress Clickable Seek
    this.dom.termProgressClickArea.addEventListener('click', (e) => {
      const rect = this.dom.termProgressClickArea.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.audioEngine.seekByPercent(pos * 100);
    });

    // Live Streaming Logs Controls
    if (this.dom.btnToggleLogStream) {
      this.dom.btnToggleLogStream.addEventListener('click', () => {
        this.isLogsStreaming = !this.isLogsStreaming;
        this.dom.btnToggleLogStream.textContent = this.isLogsStreaming ? '⏸ Pause' : '▶ Resume';
      });
    }

    if (this.dom.btnClearLogs) {
      this.dom.btnClearLogs.addEventListener('click', () => {
        this.dom.termLiveLogStream.innerHTML = '';
      });
    }

    if (this.dom.btnLogSpeed) {
      this.dom.btnLogSpeed.addEventListener('click', () => {
        const speeds = ['normal', 'fast', 'slow'];
        const nextIdx = (speeds.indexOf(this.logsSpeed) + 1) % speeds.length;
        this.logsSpeed = speeds[nextIdx];
        this.dom.btnLogSpeed.textContent = `⚡ ${this.logsSpeed.charAt(0).toUpperCase() + this.logsSpeed.slice(1)}`;
        this.setupLiveLogStream();
      });
    }
  }

  // ==========================================
  // Equalizer Live Spectrum Loop inside Modal
  // ==========================================
  startEqSpectrumLoop() {
    if (this.eqVisualizerLoopId) return;
    const canvas = this.dom.eqVisualizerCanvas;
    if (!canvas) return;

    const dataArr = new Uint8Array(64);

    const render = () => {
      if (!this.dom.eqModal.classList.contains('open')) {
        this.eqVisualizerLoopId = null;
        return;
      }

      this.audioEngine.getFrequencyData(dataArr);
      renderEqModalSpectrum(canvas, dataArr, this.eqGains[0], this.eqGains[1], this.eqGains[2]);

      // Update VU meter heights
      let bassSum = 0;
      for (let i = 0; i < 8; i++) bassSum += dataArr[i];
      const bassLvl = Math.min(100, Math.max(5, (bassSum / 8 / 255) * 100));

      let midSum = 0;
      for (let i = 8; i < 28; i++) midSum += dataArr[i];
      const midLvl = Math.min(100, Math.max(5, (midSum / 20 / 255) * 100));

      let trebleSum = 0;
      for (let i = 28; i < 60; i++) trebleSum += dataArr[i];
      const trebleLvl = Math.min(100, Math.max(5, (trebleSum / 32 / 255) * 100));

      if (this.dom.bassVuMeter) {
        const bar = this.dom.bassVuMeter.querySelector('.eq-vu-bar');
        if (bar) bar.style.height = `${bassLvl}%`;
      }
      if (this.dom.midVuMeter) {
        const bar = this.dom.midVuMeter.querySelector('.eq-vu-bar');
        if (bar) bar.style.height = `${midLvl}%`;
      }
      if (this.dom.trebleVuMeter) {
        const bar = this.dom.trebleVuMeter.querySelector('.eq-vu-bar');
        if (bar) bar.style.height = `${trebleLvl}%`;
      }

      this.eqVisualizerLoopId = requestAnimationFrame(render);
    };

    this.eqVisualizerLoopId = requestAnimationFrame(render);
  }

  stopEqSpectrumLoop() {
    if (this.eqVisualizerLoopId) {
      cancelAnimationFrame(this.eqVisualizerLoopId);
      this.eqVisualizerLoopId = null;
    }
  }

  // ==========================================
  // Live Streaming Simulated Kernel / Daemon Logs
  // ==========================================
  setupLiveLogStream() {
    if (this.logsInterval) clearInterval(this.logsInterval);

    const logTemplates = [
      { tag: 'KERNEL', class: 'tag-kernel', msg: () => `[SYS_INT_0x${Math.floor(Math.random() * 255).toString(16).toUpperCase()}] Page cache sync: ${Math.floor(Math.random() * 200 + 300)}MB committed [PAGE_CLEAN]` },
      { tag: 'AUDIO_CORE', class: 'tag-audio', msg: () => `FFT Spectral frame #${Math.floor(Math.random() * 90000 + 10000)} decoded 48.0kHz 32-bit PCM (lat: 1.2ms)` },
      { tag: 'NET_PROXY', class: 'tag-net', msg: () => `WebSocket chunk stream 192.168.1.${Math.floor(Math.random() * 250)} -> port 49${Math.floor(Math.random() * 800 + 100)} [ESTABLISHED]` },
      { tag: 'CRYPTO', class: 'tag-crypto', msg: () => `Ephemeral session token rotation curve25519-sha512 verified (0 errors)` },
      { tag: 'GCC_BUILD', class: 'tag-gcc', msg: () => `gcc -O3 -march=native -shared -o libdsp_simd_${Math.floor(Math.random() * 900)}.so [PID ${Math.floor(Math.random() * 8000 + 1000)}]` },
      { tag: 'SECURITY', class: 'tag-security', msg: () => `Kernel DAC policy check passed: UID 0 (root) execution permit valid` },
      { tag: 'IO_WORKER', class: 'tag-net', msg: () => `Streaming block #${Math.floor(Math.random() * 400 + 10)} from public/ audio storage [${Math.floor(Math.random() * 120 + 200)} KB/s]` },
      { tag: 'DSP_EQ', class: 'tag-audio', msg: () => `Biquad filter matrix recalculated: Bass ${this.eqGains[0]}dB | Mids ${this.eqGains[1]}dB | Treble ${this.eqGains[2]}dB` }
    ];

    const delay = this.logsSpeed === 'fast' ? 180 : this.logsSpeed === 'slow' ? 1200 : 450;

    this.logsInterval = setInterval(() => {
      if (!this.isLogsStreaming || this.mode !== 'office' || !this.dom.termLiveLogStream) return;

      const template = logTemplates[Math.floor(Math.random() * logTemplates.length)];
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

      const entry = document.createElement('div');
      entry.className = 'term-log-entry';
      entry.innerHTML = `
        <span class="term-log-time">[${timeStr}]</span>
        <span class="term-log-tag ${template.class}">[${template.tag}]</span>
        <span class="term-log-msg">${template.msg()}</span>
      `;

      this.dom.termLiveLogStream.appendChild(entry);

      // Keep max 60 lines
      if (this.dom.termLiveLogStream.children.length > 60) {
        this.dom.termLiveLogStream.removeChild(this.dom.termLiveLogStream.firstChild);
      }

      this.dom.termLiveLogStream.scrollTop = this.dom.termLiveLogStream.scrollHeight;
    }, delay);
  }

  // ==========================================
  // Drag & Drop / File Upload
  // ==========================================
  setupDragAndDrop() {
    const dropzone = this.dom.fileDropzone;
    const input = this.dom.fileInput;
    if (!dropzone || !input) return;

    dropzone.addEventListener('click', () => input.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
      if (files.length > 0) {
        this.importLocalFiles(files);
      }
    });

    input.addEventListener('change', (e) => {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('audio/'));
      if (files.length > 0) {
        this.importLocalFiles(files);
      }
    });
  }

  importLocalFiles(files) {
    const newTracks = files.map((file, idx) => {
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      return {
        id: Date.now() + idx,
        title: cleanName,
        artist: "Local Audio Track",
        album: "My Uploads",
        genre: "Custom",
        year: new Date().getFullYear().toString(),
        src: URL.createObjectURL(file),
        cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80",
        accentColor: "#ec4899",
        lyrics: [{ time: 0, text: `♪ ${cleanName} ♪` }]
      };
    });

    this.songs.unshift(...newTracks);
    this.applyFilters();
    this.renderTerminalProcessTable();
    this.loadTrack(0, true);
    this.showToast(`Imported ${newTracks.length} local track(s)!`);
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Allow Boss Key (Esc or Backtick) anytime!
      if (e.code === 'Escape' || e.code === 'Backquote') {
        e.preventDefault();
        this.toggleMode();
        return;
      }

      // Ignore standard keys when typing in input fields
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.audioEngine.togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.audioEngine.seek(this.audioEngine.audio.currentTime - 5);
          this.showToast("⏮ -5s");
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.audioEngine.seek(this.audioEngine.audio.currentTime + 5);
          this.showToast("⏭ +5s");
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.audioEngine.setVolume(this.audioEngine.volume + 0.1);
          this.dom.volumeSlider.value = this.audioEngine.volume;
          this.updateVolumeIcon(this.audioEngine.volume);
          this.updateTerminalVolText();
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.audioEngine.setVolume(this.audioEngine.volume - 0.1);
          this.dom.volumeSlider.value = this.audioEngine.volume;
          this.updateVolumeIcon(this.audioEngine.volume);
          this.updateTerminalVolText();
          break;
        case 'KeyM':
          this.dom.btnVolume.click();
          break;
        case 'KeyL':
          this.toggleFavorite(this.currentTrack.id);
          break;
        case 'KeyS':
          this.toggleShuffle();
          break;
        case 'KeyR':
          this.cycleRepeat();
          break;
        case 'KeyF':
          this.toggleFullscreen();
          break;
        case 'KeyE':
          this.toggleModal(this.dom.eqModal, !this.dom.eqModal.classList.contains('open'));
          if (this.dom.eqModal.classList.contains('open')) this.startEqSpectrumLoop();
          else this.stopEqSpectrumLoop();
          break;
      }
    });
  }

  // ==========================================
  // Terminal Shell CLI & Stats Controller
  // ==========================================
  setupTerminalShell() {
    if (!this.dom.termCommandForm) return;

    this.dom.termCommandForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawCmd = this.dom.termInput.value.trim();
      if (!rawCmd) return;

      this.logTerminal(`${this.dom.termPromptStr ? this.dom.termPromptStr.textContent : 'user:~$'} ${rawCmd}`, 'term-highlight');
      this.dom.termInput.value = '';
      this.handleTerminalCommand(rawCmd);
    });
  }

  handleTerminalCommand(cmdStr) {
    const parts = cmdStr.split(' ');
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    switch (cmd) {
      case 'help':
      case '?':
        this.logTerminal(`Available AuraTune Hacker CLI Commands:
  • play [id|query]        : Start playback or play matching track
  • pause / stop           : Pause audio streaming daemon
  • next / skip            : Skip to next thread in queue
  • prev / back            : Switched to previous thread
  • vol <0-100>            : Set master audio gain percentage (e.g. vol 85)
  • mute / unmute          : Toggle mute state
  • speed <0.5-2.0>        : Set DSP playback clock rate (e.g. speed 1.25)
  • eq <bass> <mid> <treble>: Set 3-band EQ gains in dB (e.g. eq 8 2 -1)
  • preset <name>          : Apply EQ preset (flat/bass/vocal/edm/rock/cyberpunk/chill)
  • ls / ps / queue        : List all active processes & audio threads
  • exec <pid> / run <pid> : Execute specific track by PID (e.g. exec 401)
  • status / info          : Display live process telemetry and DSP stats
  • matrix [on|off]        : Toggle Matrix digital rain background cascade
  • crt [on|off]           : Toggle CRT scanlines and monitor curvature
  • theme <name>           : Switch theme (neutral | matrix | cyan | amber | red)
  • scan / recon           : Run simulated cyber network diagnostic scan
  • hack / compile         : Run high-speed payload compilation simulation
  • top / htop             : Display CPU load & memory thread breakdown
  • logs <fast|slow|pause> : Control live kernel streaming telemetry
  • lyrics                 : Stream track lyrics to console
  • studio / exit          : Switch back to Studio Graphic Mode
  • clear / cls            : Clear terminal console`);
        break;

      case 'play':
      case 'start':
      case 'resume':
        if (arg) {
          const foundIdx = this.songs.findIndex(s => s.title.toLowerCase().includes(arg.toLowerCase()) || s.artist.toLowerCase().includes(arg.toLowerCase()));
          if (foundIdx !== -1) {
            this.loadTrack(foundIdx, true);
            this.logTerminal(`[DAEMON] Playing match: ${this.songs[foundIdx].title}`);
          } else {
            this.logTerminal(`[ERROR] No track found matching "${arg}". Run 'ls' to see list.`);
          }
        } else {
          this.audioEngine.play();
          this.logTerminal(`[DAEMON] Playback started: ${this.currentTrack.title}`);
        }
        break;

      case 'pause':
      case 'stop':
        this.audioEngine.pause();
        this.logTerminal(`[DAEMON] Playback paused.`);
        break;

      case 'next':
      case 'skip':
        this.nextTrack();
        this.logTerminal(`[DAEMON] Skipped to: ${this.currentTrack.title}`);
        break;

      case 'prev':
      case 'back':
        this.prevTrack();
        this.logTerminal(`[DAEMON] Previous track: ${this.currentTrack.title}`);
        break;

      case 'vol':
      case 'volume':
        const volVal = parseInt(arg);
        if (!isNaN(volVal) && volVal >= 0 && volVal <= 100) {
          const norm = volVal / 100;
          this.audioEngine.setVolume(norm);
          this.dom.volumeSlider.value = norm;
          this.updateTerminalVolText();
          this.logTerminal(`[DAEMON] Volume level set to ${volVal}%`);
        } else {
          this.logTerminal(`Usage: vol <0-100> (e.g. vol 80)`);
        }
        break;

      case 'speed':
      case 'rate':
        const spd = parseFloat(arg);
        if (!isNaN(spd) && spd >= 0.25 && spd <= 3.0) {
          this.audioEngine.setPlaybackRate(spd);
          this.dom.speedSelect.value = spd.toString();
          this.logTerminal(`[DAEMON] Playback speed set to ${spd}x`);
        } else {
          this.logTerminal(`Usage: speed <0.5 - 2.0> (e.g. speed 1.25)`);
        }
        break;

      case 'eq':
        const eqParts = arg.split(' ').map(Number);
        if (eqParts.length === 3 && !eqParts.some(isNaN)) {
          this.audioEngine.setEQ(...eqParts);
          this.eqGains = eqParts;
          this.dom.bassSlider.value = eqParts[0];
          this.dom.midSlider.value = eqParts[1];
          this.dom.trebleSlider.value = eqParts[2];
          this.logTerminal(`[DSP] EQ Set: Bass ${eqParts[0]}dB | Mids ${eqParts[1]}dB | Treble ${eqParts[2]}dB`);
        } else {
          this.logTerminal(`Usage: eq <bass> <mid> <treble> (e.g. eq 6 2 -1)`);
        }
        break;

      case 'preset':
        if (arg) {
          const presetsMap = {
            flat: [0, 0, 0],
            bass: [9, -2, 2],
            vocal: [-3, 7, 3],
            edm: [8, 1, 6],
            rock: [6, -3, 7],
            cyberpunk: [7, 3, 8],
            chill: [4, 3, 5],
            acoustic: [3, 5, 6]
          };
          const p = presetsMap[arg.toLowerCase()];
          if (p) {
            this.audioEngine.setEQ(...p);
            this.eqGains = p;
            this.dom.bassSlider.value = p[0];
            this.dom.midSlider.value = p[1];
            this.dom.trebleSlider.value = p[2];
            this.logTerminal(`[DSP] Applied Preset: ${arg.toUpperCase()} [${p.join('dB, ')}dB]`);
          } else {
            this.logTerminal(`Valid presets: flat, bass, vocal, edm, rock, cyberpunk, chill, acoustic`);
          }
        }
        break;

      case 'mute':
      case 'unmute':
        const muted = this.audioEngine.toggleMute();
        this.updateTerminalVolText(muted);
        this.logTerminal(`[DAEMON] Mute state: ${muted ? 'MUTED' : 'UNMUTED'}`);
        break;

      case 'matrix':
        if (arg === 'on') this.toggleMatrixRain(true);
        else if (arg === 'off') this.toggleMatrixRain(false);
        else this.toggleMatrixRain();
        this.logTerminal(`[SYS] Matrix Digital Rain: ${this.isMatrixRainActive ? 'ACTIVE' : 'DISABLED'}`);
        break;

      case 'crt':
        if (arg === 'on') this.toggleCrt(true);
        else if (arg === 'off') this.toggleCrt(false);
        else this.toggleCrt();
        this.logTerminal(`[SYS] CRT Scanlines & Screen Curvature: ${this.isCrtActive ? 'ACTIVE' : 'DISABLED'}`);
        break;

      case 'theme':
        const themeTarget = arg.toLowerCase().trim();
        if (['neutral', 'matrix', 'cyan', 'amber', 'red'].includes(themeTarget)) {
          this.applyTheme(themeTarget);
          this.logTerminal(`[SYS] Terminal Theme switched to ${themeTarget.toUpperCase()}`);
        } else {
          this.logTerminal(`Usage: theme <neutral | matrix | cyan | amber | red>`);
        }
        break;

      case 'scan':
      case 'recon':
        this.logTerminal(`[RECON] Initializing full-spectrum vulnerability & network scan...`, 'term-accent');
        let step = 0;
        const scanSteps = [
          `[PROBE] Scanning 192.168.1.0/24 subnet... 28 active nodes located`,
          `[CRYPTO] Probing TLS cipher suites... Found AES_256_GCM with PFS [SECURE]`,
          `[AUDIO_DSP] Sampling rate test: 48,000 Hz, latency: 1.18ms, 0 buffer underflows`,
          `[STATUS] Vulnerability score: 0.0 (CLEAN). All audio daemon threads protected.`
        ];
        const scanTimer = setInterval(() => {
          if (step < scanSteps.length) {
            this.logTerminal(scanSteps[step], 'term-success');
            step++;
          } else {
            clearInterval(scanTimer);
          }
        }, 350);
        break;

      case 'hack':
      case 'compile':
        this.logTerminal(`[COMPILER] Invoking LLVM Clang with AVX-512 SIMD optimizations...`, 'term-highlight');
        const compileSteps = [
          `  -> gcc -c -fPIC dsp_fft.c -o dsp_fft.o (0 warnings)`,
          `  -> gcc -c -fPIC audio_filter.c -o audio_filter.o (0 warnings)`,
          `  -> ld -shared -soname libauratune.so.4 -o libauratune.so *.o`,
          `[SUCCESS] Dynamic kernel library linked: 148 KB payload generated in 42ms.`
        ];
        let cStep = 0;
        const compTimer = setInterval(() => {
          if (cStep < compileSteps.length) {
            this.logTerminal(compileSteps[cStep], 'term-accent');
            cStep++;
          } else {
            clearInterval(compTimer);
          }
        }, 250);
        break;

      case 'top':
      case 'htop':
        this.logTerminal(`HTOP SYSTEM LOAD:
  CPU0: [██████████░░░░░░░░░░] 38.2%   TASKS: 14 total, 1 running, 13 sleeping
  CPU1: [████████████░░░░░░░░] 44.1%   MEM  : 164MB / 16384MB (1.0%)
  SWAP: [░░░░░░░░░░░░░░░░░░░░]  0.0%   LOAD : 0.42, 0.38, 0.31
  AUDIO BUFFER: 512 samples | PCM RATE: 48,000Hz | 0 dropouts`);
        break;

      case 'logs':
        if (arg === 'pause' || arg === 'stop') {
          this.isLogsStreaming = false;
          this.logTerminal(`[DAEMON] Live kernel log streaming PAUSED.`);
        } else if (arg === 'fast' || arg === 'slow' || arg === 'normal') {
          this.logsSpeed = arg;
          this.setupLiveLogStream();
          this.logTerminal(`[DAEMON] Log stream speed set to ${arg.toUpperCase()}.`);
        } else if (arg === 'clear') {
          this.dom.termLiveLogStream.innerHTML = '';
          this.logTerminal(`[DAEMON] Log stream cleared.`);
        } else {
          this.isLogsStreaming = true;
          this.logTerminal(`[DAEMON] Live kernel log streaming ACTIVE.`);
        }
        break;

      case 'ls':
      case 'list':
      case 'ps':
        const trackListStr = this.songs.map((s, idx) => `  [${400 + idx + 1}] ${s.title.padEnd(28)} ${s.artist.padEnd(24)} [${s.genre || 'Audio'}]`).join('\n');
        this.logTerminal(`PROCESS LIST (PID / TITLE / ARTIST / GENRE):\n${trackListStr}`);
        break;

      case 'exec':
      case 'run':
        const targetPid = parseInt(arg);
        if (!isNaN(targetPid)) {
          const targetIndex = targetPid - 401;
          if (targetIndex >= 0 && targetIndex < this.songs.length) {
            this.loadTrack(targetIndex, true);
            this.logTerminal(`[DAEMON] Executing PID ${targetPid}: ${this.songs[targetIndex].title}`);
          } else {
            this.logTerminal(`[ERROR] PID ${targetPid} not found. Run 'ls' to view valid PIDs.`);
          }
        } else {
          this.logTerminal(`Usage: exec <pid> (e.g. exec 401)`);
        }
        break;

      case 'status':
      case 'info':
        this.logTerminal(`CURRENT PROCESS DETAILS:
  Title   : ${this.currentTrack.title}
  Artist  : ${this.currentTrack.artist}
  Album   : ${this.currentTrack.album || 'Standard Audio'}
  Genre   : ${this.currentTrack.genre || 'Music'}
  State   : ${this.audioEngine.isPaused() ? 'PAUSED' : 'STREAMING / PLAYING'}
  Volume  : ${Math.round(this.audioEngine.volume * 100)}%
  Position: ${this.formatTime(this.audioEngine.audio.currentTime)} / ${this.formatTime(this.audioEngine.audio.duration)}`);
        break;

      case 'lyrics':
        if (this.currentTrack.lyrics && this.currentTrack.lyrics.length > 0) {
          const lyr = this.currentTrack.lyrics.map(l => `  [${this.formatTime(l.time)}] ${l.text}`).join('\n');
          this.logTerminal(`LYRICS FOR "${this.currentTrack.title}":\n${lyr}`);
        } else {
          this.logTerminal(`No lyrics available for current track.`);
        }
        break;

      case 'studio':
      case 'normal':
        this.applyMode('studio');
        break;

      case 'clear':
      case 'cls':
        this.dom.termOutput.innerHTML = '';
        break;

      case 'sudo':
        this.logTerminal(`[AUTH] sudo permissions granted to root operator.`);
        break;

      default:
        this.logTerminal(`command not found: ${cmd}. Type 'help' for manual.`, 'term-muted');
        break;
    }
  }

  logTerminal(text, className = '') {
    const line = document.createElement('div');
    line.className = `term-line ${className}`;
    line.textContent = text;
    this.dom.termOutput.appendChild(line);
    this.dom.termOutput.scrollTop = this.dom.termOutput.scrollHeight;
  }

  renderTerminalProcessTable() {
    if (!this.dom.termProcessTableBody) return;
    this.dom.termQueueCount.textContent = `${this.songs.length} threads`;

    this.dom.termProcessTableBody.innerHTML = this.songs.map((track, idx) => {
      const pid = 400 + idx + 1;
      const isCurrent = this.currentTrack && track.id === this.currentTrack.id;
      const isRunning = isCurrent && !this.audioEngine.isPaused();

      return `
        <tr class="term-table-row ${isCurrent ? 'active' : ''}" data-index="${idx}">
          <td style="color: var(--term-muted); font-family: monospace;">${pid}</td>
          <td><b>${track.title}</b> <span style="color: var(--term-muted);">- ${track.artist}</span></td>
          <td><span style="color: var(--term-highlight);">${track.genre || 'Custom'}</span></td>
          <td>
            <span style="color: ${isRunning ? 'var(--term-success)' : isCurrent ? 'var(--term-highlight)' : 'var(--term-muted)'}">
              ${isRunning ? '[RUNNING]' : isCurrent ? '[PAUSED]' : '[IDLE]'}
            </span>
          </td>
          <td>
            <button class="term-exec-btn" data-index="${idx}">
              ${isCurrent && isRunning ? '[STOP]' : '[EXEC]'}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach click listeners to rows & buttons
    this.dom.termProcessTableBody.querySelectorAll('.term-table-row').forEach(row => {
      row.addEventListener('click', () => {
        const index = parseInt(row.dataset.index);
        if (this.currentTrackIndex === index) {
          this.audioEngine.togglePlay();
        } else {
          this.loadTrack(index, true);
        }
      });
    });
  }

  updateTerminalDisplay() {
    if (!this.dom.termCurrentTrackName) return;
    const pid = 400 + this.currentTrackIndex + 1;
    this.dom.termCurrentTrackName.textContent = `[PID:${pid}] ${this.currentTrack.title} — ${this.currentTrack.artist}`;

    const isRunning = !this.audioEngine.isPaused();
    this.dom.termTrackStatus.textContent = isRunning ? '[ACTIVE]' : '[PAUSED]';
    this.dom.termTrackStatus.style.color = isRunning ? 'var(--term-success)' : 'var(--term-highlight)';
    this.dom.termDaemonStatus.textContent = isRunning ? 'RUNNING' : 'IDLE';
    this.dom.termPlayText.textContent = isRunning ? '[ ⏸ PAUSE ]' : '[ ▶ PLAY ]';

    this.renderTerminalProcessTable();
  }

  updateTerminalVolText(forceMute) {
    if (!this.dom.btnTermMute) return;
    const isMuted = forceMute !== undefined ? forceMute : this.audioEngine.isMuted;
    this.dom.btnTermMute.textContent = isMuted ? `[ 🔇 MUTED ]` : `[ 🔊 VOL: ${Math.round(this.audioEngine.volume * 100)}% ]`;
  }

  updateTerminalProgress(currentTime, duration) {
    if (!this.dom.termAsciiBar || !this.dom.termAsciiPercent || !this.dom.termAsciiTime) return;

    const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const totalBars = 26;
    const filledBars = Math.round((percent / 100) * totalBars);
    const emptyBars = totalBars - filledBars;

    const barStr = `[${'='.repeat(Math.max(0, filledBars - 1))}${filledBars > 0 ? '>' : ''}${'-'.repeat(Math.max(0, emptyBars))}]`;
    this.dom.termAsciiBar.textContent = barStr;
    this.dom.termAsciiPercent.textContent = `${Math.round(percent)}%`;
    this.dom.termAsciiTime.textContent = `(${this.formatTime(currentTime)} / ${this.formatTime(duration)})`;
  }

  // Real-time 60FPS ASCII Spectrum and Hex Memory Inspector loop
  startRealtimeTelemetryLoop() {
    const updateTelemetry = () => {
      if (this.mode === 'office') {
        this.audioEngine.getFrequencyData(this.freqDataArray);

        // Build dynamic 24-character ASCII Spectrum
        if (this.dom.termAsciiSpectrum) {
          const isPaused = this.audioEngine.isPaused();
          let specStr = '[ ';
          for (let i = 0; i < 22; i++) {
            const rawVal = isPaused ? 0 : this.freqDataArray[i * 2] || 0;
            const blockIdx = Math.min(this.termAsciiBlocks.length - 1, Math.floor((rawVal / 255) * this.termAsciiBlocks.length));
            specStr += this.termAsciiBlocks[blockIdx];
          }
          specStr += ' ]';
          this.dom.termAsciiSpectrum.textContent = specStr;
        }

        // Build live dynamic Hex Dump
        if (this.dom.termHexDump) {
          let hexStr = '';
          const isPaused = this.audioEngine.isPaused();
          for (let i = 0; i < 10; i++) {
            const byte = isPaused ? (i * 16) : (this.freqDataArray[i * 3] || 0);
            hexStr += `0x${byte.toString(16).padStart(2, '0').toUpperCase()} `;
          }
          this.dom.termHexDump.textContent = hexStr.trim();
        }
      }

      requestAnimationFrame(updateTelemetry);
    };

    requestAnimationFrame(updateTelemetry);

    // 1-second system uptime and CPU jitter loop
    setInterval(() => {
      this.uptimeSeconds++;
      if (this.dom.termUptime) {
        const hrs = String(Math.floor(this.uptimeSeconds / 3600)).padStart(2, '0');
        const mins = String(Math.floor((this.uptimeSeconds % 3600) / 60)).padStart(2, '0');
        const secs = String(this.uptimeSeconds % 60).padStart(2, '0');
        this.dom.termUptime.textContent = `${hrs}:${mins}:${secs}`;
      }

      if (this.dom.termCpu) {
        const isRunning = !this.audioEngine.isPaused();
        const baseCpu = isRunning ? 3.8 : 0.8;
        const jitter = (Math.random() * 2.2).toFixed(1);
        this.dom.termCpu.textContent = `${(baseCpu + parseFloat(jitter)).toFixed(1)}%`;
      }
    }, 1000);
  }

  // ==========================================
  // Track Management & Rendering
  // ==========================================
  loadTrack(index, autoplay = true) {
    if (index < 0 || index >= this.songs.length) return;

    this.currentTrackIndex = index;
    this.currentTrack = this.songs[index];

    this.audioEngine.loadTrack(this.currentTrack, autoplay);

    if (this.visualizer) {
      this.visualizer.setAccentColor(this.currentTrack.accentColor);
    }

    this.updateAccentColors(this.currentTrack.accentColor);
    this.renderCenterStage();
    this.renderPlaybar();
    this.renderTrackList();
    this.updateTerminalDisplay();
  }

  nextTrack() {
    if (this.isShuffle) {
      let randIdx;
      do {
        randIdx = Math.floor(Math.random() * this.songs.length);
      } while (randIdx === this.currentTrackIndex && this.songs.length > 1);
      this.loadTrack(randIdx, true);
    } else {
      let nextIndex = this.currentTrackIndex + 1;
      if (nextIndex >= this.songs.length) nextIndex = 0;
      this.loadTrack(nextIndex, true);
    }
  }

  prevTrack() {
    if (this.audioEngine.audio.currentTime > 3) {
      this.audioEngine.seek(0);
      return;
    }
    let prevIndex = this.currentTrackIndex - 1;
    if (prevIndex < 0) prevIndex = this.songs.length - 1;
    this.loadTrack(prevIndex, true);
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    this.dom.btnShuffle.classList.toggle('active', this.isShuffle);
    this.dom.btnTermShuffle.textContent = `[ 🔀 SHUFFLE: ${this.isShuffle ? 'ON' : 'OFF'} ]`;
    this.showToast(`Shuffle: ${this.isShuffle ? 'ON' : 'OFF'}`);
  }

  cycleRepeat() {
    const modes = ['all', 'one', 'off'];
    const icons = {
      all: 'ri-repeat-2-line',
      one: 'ri-repeat-one-line',
      off: 'ri-repeat-2-line'
    };

    const nextIdx = (modes.indexOf(this.repeatMode) + 1) % modes.length;
    this.repeatMode = modes[nextIdx];

    this.dom.btnRepeat.innerHTML = `<i class="${icons[this.repeatMode]}"></i>`;
    this.dom.btnRepeat.classList.toggle('active', this.repeatMode !== 'off');
    this.dom.btnTermRepeat.textContent = `[ 🔁 REPEAT: ${this.repeatMode.toUpperCase()} ]`;
    this.showToast(`Repeat: ${this.repeatMode.toUpperCase()}`);
  }

  toggleFavorite(trackId) {
    if (this.favorites.has(trackId)) {
      this.favorites.delete(trackId);
      this.showToast("Removed from Favorites");
    } else {
      this.favorites.add(trackId);
      this.showToast("❤️ Added to Favorites!");
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.85 } });
    }
    localStorage.setItem('mp_favorites', JSON.stringify(Array.from(this.favorites)));
    this.updateFavoriteUI();
    if (this.activeFilter === 'favorites') this.applyFilters();
  }

  updateFavoriteUI() {
    const isFav = this.favorites.has(this.currentTrack.id);
    this.dom.btnPlaybarLike.innerHTML = `<i class="${isFav ? 'ri-heart-fill' : 'ri-heart-line'}" style="color: ${isFav ? '#ec4899' : 'inherit'}"></i>`;
  }

  applyFilters() {
    this.filteredSongs = this.songs.filter(song => {
      const matchSearch = !this.searchQuery || 
        song.title.toLowerCase().includes(this.searchQuery) ||
        song.artist.toLowerCase().includes(this.searchQuery) ||
        (song.album && song.album.toLowerCase().includes(this.searchQuery));

      if (!matchSearch) return false;

      if (this.activeFilter === 'all') return true;
      if (this.activeFilter === 'favorites') return this.favorites.has(song.id);
      
      return song.genre && song.genre.toLowerCase().includes(this.activeFilter.toLowerCase());
    });

    this.renderTrackList();
  }

  renderTrackList() {
    this.dom.trackCountBadge.textContent = `${this.filteredSongs.length} tracks`;

    this.dom.trackList.innerHTML = this.filteredSongs.map((track) => {
      const isCurrent = this.currentTrack && track.id === this.currentTrack.id;
      const isFav = this.favorites.has(track.id);
      const isPlaying = isCurrent && !this.audioEngine.isPaused();

      return `
        <div class="track-card ${isCurrent ? 'active' : ''}" data-id="${track.id}">
          <div class="track-card-cover">
            <img src="${track.cover}" alt="${track.title}">
            <div class="track-card-play-overlay">
              <i class="${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'}"></i>
            </div>
          </div>
          <div class="track-card-info">
            <div class="track-card-title">${track.title}</div>
            <div class="track-card-artist">${track.artist}</div>
          </div>
          <button class="track-card-like" data-id="${track.id}" title="Favorite">
            <i class="${isFav ? 'ri-heart-fill' : 'ri-heart-line'}" style="color: ${isFav ? '#ec4899' : 'inherit'}"></i>
          </button>
        </div>
      `;
    }).join('');

    // Attach listeners
    this.dom.trackList.querySelectorAll('.track-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.track-card-like')) return;
        const id = parseInt(card.dataset.id);
        const originalIndex = this.songs.findIndex(s => s.id === id);
        if (originalIndex !== -1) {
          if (this.currentTrackIndex === originalIndex) {
            this.audioEngine.togglePlay();
          } else {
            this.loadTrack(originalIndex, true);
          }
        }
      });
    });

    this.dom.trackList.querySelectorAll('.track-card-like').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        this.toggleFavorite(id);
      });
    });
  }

  renderCenterStage() {
    const t = this.currentTrack;
    this.dom.centerCover.src = t.cover;
    this.dom.centerTitle.textContent = t.title;
    this.dom.centerArtist.textContent = t.artist;
    this.dom.centerGenre.textContent = t.genre || 'Audio';
    this.dom.centerYear.textContent = t.year || '2024';

    // Render Lyrics
    if (t.lyrics && t.lyrics.length > 0) {
      this.dom.lyricsBox.innerHTML = t.lyrics.map((l, idx) => `
        <div class="lyrics-line ${idx === 0 ? 'active' : ''}" data-time="${l.time}">
          ${l.text}
        </div>
      `).join('');
    } else {
      this.dom.lyricsBox.innerHTML = `<div class="lyrics-line active">♪ Instrumental / No Synced Lyrics ♪</div>`;
    }
  }

  renderPlaybar() {
    const t = this.currentTrack;
    this.dom.playbarCover.src = t.cover;
    this.dom.playbarTitle.textContent = t.title;
    this.dom.playbarArtist.textContent = t.artist;
    this.updateFavoriteUI();
  }

  updatePlayState(isPlaying) {
    this.dom.btnPlay.innerHTML = `<i class="${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'}"></i>`;
    this.dom.centerShowcase.classList.toggle('playing', isPlaying);

    if (this.dom.btnTermPlay) {
      this.dom.termPlayText.textContent = isPlaying ? '[ ⏸ PAUSE ]' : '[ ▶ PLAY ]';
    }

    this.renderTrackList();
    this.updateTerminalDisplay();
  }

  updateProgress(currentTime, duration) {
    this.dom.timeCurrent.textContent = this.formatTime(currentTime);

    if (duration > 0) {
      const pct = (currentTime / duration) * 100;
      this.dom.scrubberFill.style.width = `${pct}%`;
      this.dom.scrubberThumb.style.left = `${pct}%`;
    }
  }

  updateLyrics(currentTime) {
    const lines = this.dom.lyricsBox.querySelectorAll('.lyrics-line');
    if (!lines.length) return;

    let activeLine = null;
    lines.forEach(line => {
      const lineTime = parseFloat(line.dataset.time || 0);
      if (currentTime >= lineTime) {
        activeLine = line;
      }
    });

    if (activeLine && !activeLine.classList.contains('active')) {
      lines.forEach(l => l.classList.remove('active'));
      activeLine.classList.add('active');
      activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  updateVolumeIcon(vol) {
    let iconClass = 'ri-volume-mute-fill';
    if (vol > 0.5) iconClass = 'ri-volume-up-fill';
    else if (vol > 0) iconClass = 'ri-volume-down-fill';
    this.dom.btnVolume.innerHTML = `<i class="${iconClass}"></i>`;
  }

  updateAccentColors(color) {
    document.documentElement.style.setProperty('--accent-color', color);
    const secondary = this.visualizer ? this.visualizer.generateSecondaryColor(color) : '#ec4899';
    document.documentElement.style.setProperty('--accent-secondary', secondary);
    document.documentElement.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${color}, ${secondary})`);
    document.documentElement.style.setProperty('--accent-glow', `${color}66`);
  }

  toggleModal(modal, open) {
    if (!modal) return;
    if (open) {
      modal.classList.add('open');
    } else {
      modal.classList.remove('open');
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.warn(err));
    } else {
      document.exitFullscreen();
    }
  }

  showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="${type === 'error' ? 'ri-error-warning-fill' : 'ri-notification-3-fill'}" style="color: var(--accent-color);"></i> <span>${msg}</span>`;
    this.dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(80px)';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  window.musicApp = new MusicPlayerApp();
});
