import './style.css';
import { INITIAL_SONGS } from './songs.js';
import { AudioEngine } from './audioEngine.js';
import { AudioVisualizer } from './visualizer.js';
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
    this.isShuffle = false;
    this.repeatMode = 'all'; // 'all', 'one', 'off'
    this.activeFilter = 'all';
    this.searchQuery = '';

    // Favorites from LocalStorage
    this.favorites = new Set(JSON.parse(localStorage.getItem('mp_favorites') || '[]'));

    // Terminal simulated system stats & uptime
    this.uptimeSeconds = 862;
    this.termAsciiBlocks = [' ', ' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    this.termVisualizerInterval = null;

    this.initDOM();
    this.initVisualizer();
    this.setupAudioEngineCallbacks();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.setupDragAndDrop();
    this.setupTerminalShell();

    // Set initial mode
    this.applyMode(this.mode);

    // Load initial track
    this.loadTrack(0, false);
    this.renderTrackList();
    this.renderTerminalProcessTable();
    this.startTerminalStatsLoop();
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
      bassSlider: document.getElementById('bassSlider'),
      midSlider: document.getElementById('midSlider'),
      trebleSlider: document.getElementById('trebleSlider'),
      bassVal: document.getElementById('bassVal'),
      midVal: document.getElementById('midVal'),
      trebleVal: document.getElementById('trebleVal'),
      shortcutsModal: document.getElementById('shortcutsModal'),
      btnCloseShortcuts: document.getElementById('btnCloseShortcuts'),
      toastContainer: document.getElementById('toastContainer'),

      // Terminal Elements
      btnTermSwitchStudio: document.getElementById('btnTermSwitchStudio'),
      btnTermExit: document.getElementById('btnTermExit'),
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
      termOutput: document.getElementById('termOutput'),
      termCommandForm: document.getElementById('termCommandForm'),
      termInput: document.getElementById('termInput')
    };
  }

  initVisualizer() {
    if (this.dom.visualizerCanvas) {
      this.visualizer = new AudioVisualizer(this.dom.visualizerCanvas, this.audioEngine);
      this.visualizer.start();
    }
  }

  applyMode(mode) {
    this.mode = mode;
    localStorage.setItem('mp_mode', mode);

    if (mode === 'office') {
      this.dom.body.classList.remove('mode-studio');
      this.dom.body.classList.add('mode-office');
      document.title = "bash: node ./server.js (pid 4928)";
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
    this.showToast(newMode === 'office' ? "🖥️ Stealth Office CLI Mode Active" : "✨ Studio Mode Active");
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

    // Volume Slider & Mute Toggle
    this.dom.volumeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.audioEngine.setVolume(val);
      this.updateVolumeIcon(val);
      this.updateTerminalVolText();
    });

    this.dom.btnVolume.addEventListener('click', () => {
      const muted = this.audioEngine.toggleMute();
      this.dom.btnVolume.innerHTML = muted 
        ? '<i class="ri-volume-mute-fill"></i>' 
        : '<i class="ri-volume-up-fill"></i>';
      this.dom.volumeSlider.value = muted ? 0 : this.audioEngine.volume;
      this.updateTerminalVolText();
    });

    // Playback Speed
    this.dom.speedSelect.addEventListener('change', (e) => {
      const rate = parseFloat(e.target.value);
      this.audioEngine.setPlaybackRate(rate);
      this.showToast(`Speed set to ${rate}x`);
    });

    // Like Button
    this.dom.btnPlaybarLike.addEventListener('click', () => {
      this.toggleFavorite(this.currentTrack.id);
    });

    // Filter Chips
    this.dom.filterTabs.querySelectorAll('.filter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.filterTabs.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.filter;
        this.applyFilters();
      });
    });

    // Search
    this.dom.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.dom.searchClearBtn.style.display = this.searchQuery ? 'block' : 'none';
      this.applyFilters();
    });

    this.dom.searchClearBtn.addEventListener('click', () => {
      this.dom.searchInput.value = '';
      this.searchQuery = '';
      this.dom.searchClearBtn.style.display = 'none';
      this.applyFilters();
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

    // Fullscreen visualizer
    this.dom.btnToggleFullscreenVis.addEventListener('click', () => this.toggleFullscreen());

    // Equalizer Modal Controls
    this.dom.btnOpenEq.addEventListener('click', () => this.toggleModal(this.dom.eqModal, true));
    this.dom.btnCloseEq.addEventListener('click', () => this.toggleModal(this.dom.eqModal, false));

    // Shortcuts Modal
    this.dom.btnOpenShortcuts.addEventListener('click', () => this.toggleModal(this.dom.shortcutsModal, true));
    this.dom.btnCloseShortcuts.addEventListener('click', () => this.toggleModal(this.dom.shortcutsModal, false));

    // EQ Sliders
    const updateEQ = () => {
      const b = parseFloat(this.dom.bassSlider.value);
      const m = parseFloat(this.dom.midSlider.value);
      const t = parseFloat(this.dom.trebleSlider.value);
      this.dom.bassVal.textContent = `${b > 0 ? '+' : ''}${b}dB`;
      this.dom.midVal.textContent = `${m > 0 ? '+' : ''}${m}dB`;
      this.dom.trebleVal.textContent = `${t > 0 ? '+' : ''}${t}dB`;
      this.audioEngine.setEQ(b, m, t);
    };

    this.dom.bassSlider.addEventListener('input', updateEQ);
    this.dom.midSlider.addEventListener('input', updateEQ);
    this.dom.trebleSlider.addEventListener('input', updateEQ);

    // EQ Presets
    this.dom.eqPresets.querySelectorAll('.eq-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.dom.eqPresets.querySelectorAll('.eq-preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const preset = chip.dataset.preset;
        const gains = this.audioEngine.applyPreset(preset);
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
        if (e.target === modal) this.toggleModal(modal, false);
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
  }

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

      this.logTerminal(`user@workstation:~$ ${rawCmd}`, 'term-highlight');
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
        this.logTerminal(`Available CLI Commands:
  • play / start / resume  : Start playback
  • pause / stop           : Pause playback
  • next / skip            : Play next thread / track
  • prev / back            : Play previous thread / track
  • vol <0-100>            : Set volume percentage (e.g. vol 75)
  • mute / unmute          : Toggle audio mute
  • shuffle                : Toggle queue shuffle
  • repeat                 : Cycle repeat modes (all / one / off)
  • ls / list              : List all processes & tracks
  • exec <pid> / run <pid> : Execute specific track by PID (e.g. exec 403)
  • status / info          : Display current process details
  • lyrics                 : Print track lyrics to console
  • studio / normal        : Switch to rich Studio Mode
  • boss / office          : Switch to Stealth CLI Mode
  • clear / cls            : Clear terminal console`);
        break;

      case 'play':
      case 'start':
      case 'resume':
        this.audioEngine.play();
        this.logTerminal(`[DAEMON] Playback started: ${this.currentTrack.title}`);
        break;

      case 'pause':
      case 'stop':
        this.audioEngine.pause();
        this.logTerminal(`[DAEMON] Playback paused.`);
        break;

      case 'next':
      case 'skip':
        this.nextTrack();
        this.logTerminal(`[DAEMON] Skipped to next track: ${this.currentTrack.title}`);
        break;

      case 'prev':
      case 'back':
        this.prevTrack();
        this.logTerminal(`[DAEMON] Switched to previous track: ${this.currentTrack.title}`);
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

      case 'mute':
      case 'unmute':
        const muted = this.audioEngine.toggleMute();
        this.updateTerminalVolText(muted);
        this.logTerminal(`[DAEMON] Mute state: ${muted ? 'MUTED' : 'UNMUTED'}`);
        break;

      case 'shuffle':
        this.toggleShuffle();
        this.logTerminal(`[DAEMON] Shuffle: ${this.isShuffle ? 'ENABLED' : 'DISABLED'}`);
        break;

      case 'repeat':
        this.cycleRepeat();
        this.logTerminal(`[DAEMON] Repeat mode: ${this.repeatMode.toUpperCase()}`);
        break;

      case 'ls':
      case 'list':
        const trackListStr = this.songs.map((s, idx) => `  [${400 + idx + 1}] ${s.title.padEnd(30)} ${s.artist.padEnd(25)} [${s.genre || 'Audio'}]`).join('\n');
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

      case 'boss':
      case 'office':
        this.applyMode('office');
        break;

      case 'clear':
      case 'cls':
        this.dom.termOutput.innerHTML = '';
        break;

      case 'sudo':
        if (arg.includes('rm') || arg.includes('rf')) {
          this.logTerminal(`[SECURITY] Permission Denied: AuraTune audio daemon is protected. Listen responsibly! 😄`, 'term-accent');
        } else {
          this.logTerminal(`[AUTH] sudo privileges granted to geniu.`);
        }
        break;

      default:
        this.logTerminal(`command not found: ${cmd}. Type 'help' for manual.`, 'term-prompt-prefix');
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
          <td style="color: #8b949e; font-family: monospace;">${pid}</td>
          <td><b>${track.title}</b> <span style="color: #8b949e;">- ${track.artist}</span></td>
          <td><span style="color: #d2a8ff;">${track.genre || 'Custom'}</span></td>
          <td>
            <span style="color: ${isRunning ? '#3fb950' : isCurrent ? '#f0883e' : '#8b949e'}">
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
      row.addEventListener('click', (e) => {
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
    this.dom.termTrackStatus.style.color = isRunning ? '#3fb950' : '#f0883e';
    this.dom.termDaemonStatus.textContent = isRunning ? 'RUNNING' : 'IDLE';

    this.dom.termPlayText.textContent = isRunning ? '[ ⏸ PAUSE PROCESS ]' : '[ ⏵ RESUME PROCESS ]';
    this.updateTerminalVolText();
    this.renderTerminalProcessTable();
  }

  updateTerminalProgress(current, duration) {
    if (!this.dom.termAsciiBar || !duration) return;

    const percent = Math.floor((current / duration) * 100);
    const totalBars = 32;
    const filledBars = Math.floor((percent / 100) * totalBars);
    const emptyBars = totalBars - filledBars;

    const barStr = `[${'='.repeat(Math.max(0, filledBars - 1))}${filledBars > 0 ? '>' : ''}${'-'.repeat(Math.max(0, emptyBars))}]`;
    this.dom.termAsciiBar.textContent = barStr;
    this.dom.termAsciiPercent.textContent = `${percent}%`;
    this.dom.termAsciiTime.textContent = `(${this.formatTime(current)} / ${this.formatTime(duration)})`;
  }

  updateTerminalVolText(mutedOverride) {
    const isMuted = mutedOverride !== undefined ? mutedOverride : this.audioEngine.isMuted;
    const volPercent = Math.round(this.audioEngine.volume * 100);

    if (this.dom.btnTermMute) {
      this.dom.btnTermMute.textContent = isMuted ? '[ 🔇 MUTED ]' : `[ 🔊 VOL: ${volPercent}% ]`;
    }
  }

  startTerminalStatsLoop() {
    setInterval(() => {
      this.uptimeSeconds++;
      const hrs = String(Math.floor(this.uptimeSeconds / 3600)).padStart(2, '0');
      const mins = String(Math.floor((this.uptimeSeconds % 3600) / 60)).padStart(2, '0');
      const secs = String(this.uptimeSeconds % 60).padStart(2, '0');
      if (this.dom.termUptime) this.dom.termUptime.textContent = `${hrs}:${mins}:${secs}`;

      // Realistic random fluctuating CPU & MEM
      const isPlaying = !this.audioEngine.isPaused();
      const cpu = (isPlaying ? (Math.random() * 4 + 2.5) : (Math.random() * 1 + 0.8)).toFixed(1);
      const mem = Math.floor(140 + Math.random() * 15);
      if (this.dom.termCpu) this.dom.termCpu.textContent = `${cpu}%`;
      if (this.dom.termMem) this.dom.termMem.textContent = `${mem}MB`;

      // ASCII Real-Time Spectrum in Terminal
      if (this.dom.termAsciiSpectrum && this.mode === 'office') {
        const freq = new Uint8Array(16);
        this.audioEngine.getFrequencyData(freq);
        let asciiSpectrum = '[';
        for (let i = 0; i < 16; i++) {
          const val = isPlaying ? freq[i] : 0;
          const blockIdx = Math.min(8, Math.floor((val / 255) * 8));
          asciiSpectrum += ` ${this.termAsciiBlocks[blockIdx]}`;
        }
        asciiSpectrum += ' ]';
        this.dom.termAsciiSpectrum.textContent = asciiSpectrum;
      }
    }, 120);
  }

  // ==========================================
  // Track Loading & Controls
  // ==========================================
  loadTrack(index, autoplay = false) {
    if (index < 0 || index >= this.filteredSongs.length) return;

    this.currentTrackIndex = index;
    this.currentTrack = this.filteredSongs[index];

    // Load in Audio Engine
    this.audioEngine.loadTrack(this.currentTrack, autoplay);

    // Update Theme Colors
    const accent = this.currentTrack.accentColor || '#a855f7';
    document.documentElement.style.setProperty('--accent-color', accent);
    document.documentElement.style.setProperty('--accent-glow', `${accent}55`);

    if (this.visualizer) {
      this.visualizer.setAccentColor(accent);
    }

    // Update Studio UI Metadata
    this.dom.centerCover.src = this.currentTrack.cover;
    this.dom.centerTitle.textContent = this.currentTrack.title;
    this.dom.centerArtist.textContent = this.currentTrack.artist;
    this.dom.centerGenre.textContent = this.currentTrack.genre || 'Music';
    this.dom.centerYear.textContent = this.currentTrack.year || '2024';

    this.dom.playbarCover.src = this.currentTrack.cover;
    this.dom.playbarTitle.textContent = this.currentTrack.title;
    this.dom.playbarArtist.textContent = this.currentTrack.artist;

    // Update Like State
    this.updateLikeButton(this.currentTrack.id);

    // Reset Progress
    this.dom.scrubberFill.style.width = '0%';
    this.dom.scrubberThumb.style.left = '0%';
    this.dom.timeCurrent.textContent = '0:00';

    // Render Lyrics
    this.renderLyrics(this.currentTrack.lyrics);

    // Highlight active item in list & terminal
    this.highlightActiveTrack();
    this.updateTerminalDisplay();
  }

  nextTrack() {
    if (this.filteredSongs.length === 0) return;

    let nextIndex;
    if (this.isShuffle) {
      nextIndex = Math.floor(Math.random() * this.filteredSongs.length);
    } else {
      nextIndex = (this.currentTrackIndex + 1) % this.filteredSongs.length;
    }
    this.loadTrack(nextIndex, true);
  }

  prevTrack() {
    if (this.filteredSongs.length === 0) return;

    if (this.audioEngine.audio.currentTime > 3) {
      this.audioEngine.seek(0);
      return;
    }

    let prevIndex = (this.currentTrackIndex - 1 + this.filteredSongs.length) % this.filteredSongs.length;
    this.loadTrack(prevIndex, true);
  }

  updatePlayState(isPlaying) {
    if (isPlaying) {
      this.dom.btnPlay.innerHTML = '<i class="ri-pause-fill"></i>';
      this.dom.centerShowcase.classList.add('playing');
    } else {
      this.dom.btnPlay.innerHTML = '<i class="ri-play-fill"></i>';
      this.dom.centerShowcase.classList.remove('playing');
    }
    this.highlightActiveTrack();
    this.updateTerminalDisplay();
  }

  updateProgress(current, duration) {
    if (!duration) return;
    const percent = (current / duration) * 100;
    this.dom.scrubberFill.style.width = `${percent}%`;
    this.dom.scrubberThumb.style.left = `${percent}%`;
    this.dom.timeCurrent.textContent = this.formatTime(current);
  }

  renderLyrics(lyrics) {
    if (!lyrics || lyrics.length === 0) {
      this.dom.lyricsBox.innerHTML = '<div class="lyrics-line active">♪ Enjoy the music ♪</div>';
      return;
    }
    this.dom.lyricsBox.innerHTML = lyrics.map((line, i) => `
      <div class="lyrics-line" data-time="${line.time}" data-index="${i}">${line.text}</div>
    `).join('');
  }

  updateLyrics(currentTime) {
    const lines = this.dom.lyricsBox.querySelectorAll('.lyrics-line');
    if (!lines.length) return;

    let activeLine = null;
    lines.forEach(line => {
      const time = parseFloat(line.dataset.time);
      if (currentTime >= time) {
        activeLine = line;
      }
    });

    if (activeLine && !activeLine.classList.contains('active')) {
      lines.forEach(l => l.classList.remove('active'));
      activeLine.classList.add('active');
      activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  toggleFavorite(songId) {
    if (this.favorites.has(songId)) {
      this.favorites.delete(songId);
      this.showToast("Removed from Liked Songs");
    } else {
      this.favorites.add(songId);
      this.triggerConfetti();
      this.showToast("Added to Liked Songs ❤️");
    }
    localStorage.setItem('mp_favorites', JSON.stringify(Array.from(this.favorites)));
    this.updateLikeButton(songId);
    this.renderTrackList();
  }

  updateLikeButton(songId) {
    const isLiked = this.favorites.has(songId);
    this.dom.btnPlaybarLike.innerHTML = isLiked 
      ? '<i class="ri-heart-fill"></i>' 
      : '<i class="ri-heart-line"></i>';
    this.dom.btnPlaybarLike.classList.toggle('liked', isLiked);
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    this.dom.btnShuffle.classList.toggle('active', this.isShuffle);
    this.dom.btnTermShuffle.textContent = `[ 🔀 SHUFFLE: ${this.isShuffle ? 'ON' : 'OFF'} ]`;
    this.showToast(this.isShuffle ? "Shuffle On 🔀" : "Shuffle Off");
  }

  cycleRepeat() {
    if (this.repeatMode === 'all') {
      this.repeatMode = 'one';
      this.dom.btnRepeat.innerHTML = '<i class="ri-repeat-one-line"></i>';
      this.dom.btnRepeat.classList.add('active');
      this.dom.btnTermRepeat.textContent = '[ 🔂 REPEAT: ONE ]';
      this.showToast("Repeat Track 🔂");
    } else if (this.repeatMode === 'one') {
      this.repeatMode = 'off';
      this.dom.btnRepeat.innerHTML = '<i class="ri-repeat-2-line"></i>';
      this.dom.btnRepeat.classList.remove('active');
      this.dom.btnTermRepeat.textContent = '[ 🔁 REPEAT: OFF ]';
      this.showToast("Repeat Off");
    } else {
      this.repeatMode = 'all';
      this.dom.btnRepeat.innerHTML = '<i class="ri-repeat-2-line"></i>';
      this.dom.btnRepeat.classList.add('active');
      this.dom.btnTermRepeat.textContent = '[ 🔁 REPEAT: ALL ]';
      this.showToast("Repeat All 🔁");
    }
  }

  applyFilters() {
    let list = [...this.songs];

    if (this.activeFilter === 'favorites') {
      list = list.filter(s => this.favorites.has(s.id));
    } else if (this.activeFilter !== 'all') {
      list = list.filter(s => s.genre && s.genre.toLowerCase().includes(this.activeFilter.toLowerCase()));
    }

    if (this.searchQuery) {
      list = list.filter(s => 
        s.title.toLowerCase().includes(this.searchQuery) ||
        s.artist.toLowerCase().includes(this.searchQuery) ||
        (s.album && s.album.toLowerCase().includes(this.searchQuery))
      );
    }

    this.filteredSongs = list;
    this.renderTrackList();
  }

  renderTrackList() {
    this.dom.trackCountBadge.textContent = `${this.filteredSongs.length} track${this.filteredSongs.length === 1 ? '' : 's'}`;

    if (this.filteredSongs.length === 0) {
      this.dom.trackList.innerHTML = `
        <div style="text-align: center; padding: 40px 10px; color: var(--text-muted); font-size: 13px;">
          <i class="ri-music-2-line" style="font-size: 32px; display: block; margin-bottom: 8px;"></i>
          No tracks found in this category
        </div>
      `;
      return;
    }

    this.dom.trackList.innerHTML = this.filteredSongs.map((track, idx) => {
      const isCurrent = this.currentTrack && track.id === this.currentTrack.id;
      const isLiked = this.favorites.has(track.id);
      const isPlaying = isCurrent && !this.audioEngine.isPaused();

      return `
        <div class="track-item ${isCurrent ? 'active' : ''} ${isPlaying ? 'playing' : ''}" data-index="${idx}">
          <span class="track-number">${idx + 1}</span>
          <div class="track-cover-wrap">
            <img class="track-cover-img" src="${track.cover}" alt="${track.title}">
            <div class="track-playing-indicator">
              <span class="wave-bar"></span>
              <span class="wave-bar"></span>
              <span class="wave-bar"></span>
            </div>
          </div>
          <div class="track-meta">
            <div class="track-title">${track.title}</div>
            <div class="track-artist">${track.artist}</div>
          </div>
          <div class="track-actions">
            <button class="btn-like-track ${isLiked ? 'liked' : ''}" data-id="${track.id}" title="Like">
              <i class="${isLiked ? 'ri-heart-fill' : 'ri-heart-line'}"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.dom.trackList.querySelectorAll('.track-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-like-track')) return;
        const index = parseInt(item.dataset.index);
        this.loadTrack(index, true);
      });
    });

    this.dom.trackList.querySelectorAll('.btn-like-track').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        this.toggleFavorite(id);
      });
    });
  }

  highlightActiveTrack() {
    this.dom.trackList.querySelectorAll('.track-item').forEach(item => {
      const index = parseInt(item.dataset.index);
      const track = this.filteredSongs[index];
      const isCurrent = track && this.currentTrack && track.id === this.currentTrack.id;
      const isPlaying = isCurrent && !this.audioEngine.isPaused();

      item.classList.toggle('active', isCurrent);
      item.classList.toggle('playing', isPlaying);
    });
  }

  updateVolumeIcon(vol) {
    if (vol === 0) {
      this.dom.btnVolume.innerHTML = '<i class="ri-volume-mute-fill"></i>';
    } else if (vol < 0.5) {
      this.dom.btnVolume.innerHTML = '<i class="ri-volume-down-fill"></i>';
    } else {
      this.dom.btnVolume.innerHTML = '<i class="ri-volume-up-fill"></i>';
    }
  }

  toggleModal(modal, open) {
    modal.classList.toggle('open', open);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      this.showToast("Fullscreen Mode");
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  triggerConfetti() {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.85 }
    });
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="ri-information-fill" style="color: var(--accent-color)"></i> <span>${message}</span>`;
    this.dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new MusicPlayerApp();
});
