import './style.css';
import { INITIAL_SONGS, SYSTEM_PLAYLISTS } from './songs.js';
import { AudioEngine } from './audioEngine.js';
import { AudioVisualizer, renderEqModalSpectrum } from './visualizer.js';
import confetti from 'canvas-confetti';

class MusicPlayerApp {
  constructor() {
    this.audioEngine = new AudioEngine();
    this.visualizer = null;

    // Library & Queue State
    this.songs = [...INITIAL_SONGS];
    this.filteredSongs = [...this.songs];
    this.queue = JSON.parse(localStorage.getItem('mp_queue') || '[]');
    if (this.queue.length === 0) {
      this.queue = [...this.songs];
    }
    this.queueIndex = 0;

    // Saved Settings
    this.mode = localStorage.getItem('mp_mode') || 'studio'; // 'studio' | 'office' | 'terminal'
    this.theme = localStorage.getItem('mp_theme') || 'neutral';
    this.isShuffle = localStorage.getItem('mp_shuffle') === 'true';
    this.repeatMode = localStorage.getItem('mp_repeat') || 'all'; // 'all' | 'one' | 'off'
    this.savedVolume = parseFloat(localStorage.getItem('mp_volume') || '0.8');
    this.audioEngine.setVolume(this.savedVolume);

    // Favorites & Playlists
    this.favorites = new Set(JSON.parse(localStorage.getItem('mp_favorites') || '[]'));
    this.activePlaylist = 'all';
    this.activeFilter = 'all';
    this.searchQuery = '';

    // Terminal / Office State
    this.isCrtActive = localStorage.getItem('mp_crt') !== 'false';
    this.isMatrixRainActive = localStorage.getItem('mp_matrix') === 'true';
    this.isLogsStreaming = true;
    this.matrixAnimationId = null;
    this.eqVisualizerLoopId = null;
    this.eqGains = [0, 0, 0];

    // Current Track
    const savedTrackId = parseInt(localStorage.getItem('mp_last_track_id') || '1', 10);
    const initialTrack = this.songs.find(s => s.id === savedTrackId) || this.songs[0];
    this.currentTrack = initialTrack;
    this.currentTrackIndex = this.songs.findIndex(s => s.id === this.currentTrack.id);

    // Initialize UI & Components
    this.initDOM();
    this.initVisualizer();
    this.initMatrixRain();
    this.setupAudioEngineCallbacks();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.setupDragAndDrop();
    this.setupTerminalShell();
    this.setupLiveLogStream();

    // Apply Themes & Modes
    this.applyTheme(this.theme);
    this.applyMode(this.mode);
    this.toggleCrt(this.isCrtActive);
    this.toggleMatrixRain(this.isMatrixRainActive);
    this.updateShuffleUI();
    this.updateRepeatUI();

    // Load initial track without autoplay
    this.loadTrack(this.currentTrack, false);
    this.renderTrackList();
    this.renderQueueDrawer();
    this.renderTerminalProcessTable();
    this.startRealtimeTelemetryLoop();
  }

  initDOM() {
    this.dom = {
      body: document.body,
      toastContainer: document.getElementById('toastContainer'),
      studioApp: document.getElementById('studioApp'),
      officeApp: document.getElementById('officeApp'),
      terminalApp: document.getElementById('terminalApp'),
      ambientBg: document.getElementById('ambientBg'),

      // Header Controls
      searchInput: document.getElementById('searchInput'),
      searchClearBtn: document.getElementById('searchClearBtn'),
      btnToggleOffice: document.getElementById('btnToggleOffice'),
      btnToggleTerminal: document.getElementById('btnToggleTerminal'),
      btnOpenQueue: document.getElementById('btnOpenQueue'),
      headerQueueCount: document.getElementById('headerQueueCount'),
      btnThemeMenu: document.getElementById('btnThemeMenu'),
      themeDropdown: document.getElementById('themeDropdown'),
      currentThemeLabel: document.getElementById('currentThemeLabel'),
      btnOpenEq: document.getElementById('btnOpenEq'),
      btnOpenShortcuts: document.getElementById('btnOpenShortcuts'),

      // Studio Library
      playlistsBar: document.getElementById('playlistsBar'),
      filterTabs: document.getElementById('filterTabs'),
      trackList: document.getElementById('trackList'),
      trackCountBadge: document.getElementById('trackCountBadge'),

      // Center Stage
      centerShowcase: document.getElementById('centerShowcase'),
      centerCover: document.getElementById('centerCover'),
      centerTitle: document.getElementById('centerTitle'),
      centerArtist: document.getElementById('centerArtist'),
      centerGenre: document.getElementById('centerGenre'),
      centerAlbum: document.getElementById('centerAlbum'),
      centerYear: document.getElementById('centerYear'),
      centerStatusText: document.getElementById('centerStatusText'),
      btnCenterQueueAdd: document.getElementById('btnCenterQueueAdd'),
      btnCenterLike: document.getElementById('btnCenterLike'),
      lyricsBox: document.getElementById('lyricsBox'),

      // Playbar Left
      playbarCover: document.getElementById('playbarCover'),
      playbarTitle: document.getElementById('playbarTitle'),
      playbarArtist: document.getElementById('playbarArtist'),
      btnPlaybarLike: document.getElementById('btnPlaybarLike'),

      // Playbar Center
      btnShuffle: document.getElementById('btnShuffle'),
      btnPrev: document.getElementById('btnPrev'),
      btnPlay: document.getElementById('btnPlay'),
      btnNext: document.getElementById('btnNext'),
      btnRepeat: document.getElementById('btnRepeat'),
      timeCurrent: document.getElementById('timeCurrent'),
      timeTotal: document.getElementById('timeTotal'),
      scrubberContainer: document.getElementById('scrubberContainer'),
      scrubberFill: document.getElementById('scrubberFill'),
      scrubberThumb: document.getElementById('scrubberThumb'),

      // Playbar Right
      speedSelect: document.getElementById('speedSelect'),
      btnVolume: document.getElementById('btnVolume'),
      volumeSlider: document.getElementById('volumeSlider'),

      // Office Mode Elements
      officeCover: document.getElementById('officeCover'),
      officeTitle: document.getElementById('officeTitle'),
      officeArtist: document.getElementById('officeArtist'),
      officeTimeCurrent: document.getElementById('officeTimeCurrent'),
      officeTimeTotal: document.getElementById('officeTimeTotal'),
      officeProgressClick: document.getElementById('officeProgressClick'),
      officeProgressFill: document.getElementById('officeProgressFill'),
      btnOfficePrev: document.getElementById('btnOfficePrev'),
      btnOfficePlay: document.getElementById('btnOfficePlay'),
      officePlayLabel: document.getElementById('officePlayLabel'),
      btnOfficeNext: document.getElementById('btnOfficeNext'),
      btnOfficeMute: document.getElementById('btnOfficeMute'),
      btnOfficeTheme: document.getElementById('btnOfficeTheme'),
      btnOfficeToStudio: document.getElementById('btnOfficeToStudio'),

      // Terminal Elements
      asciiSongTitle: document.getElementById('asciiSongTitle'),
      asciiSongArtist: document.getElementById('asciiSongArtist'),
      asciiCurrentTime: document.getElementById('asciiCurrentTime'),
      asciiTotalDuration: document.getElementById('asciiTotalDuration'),
      asciiProgressBar: document.getElementById('asciiProgressBar'),
      asciiPlayBtn: document.getElementById('asciiPlayBtn'),
      asciiPrevBtn: document.getElementById('asciiPrevBtn'),
      asciiNextBtn: document.getElementById('asciiNextBtn'),
      asciiVolumeBar: document.getElementById('asciiVolumeBar'),
      asciiVolumePercent: document.getElementById('asciiVolumePercent'),
      asciiQueueSummary: document.getElementById('asciiQueueSummary'),
      termCurrentTrackName: document.getElementById('termCurrentTrackName'),
      termAsciiSpectrum: document.getElementById('termAsciiSpectrum'),
      termHexDump: document.getElementById('termHexDump'),
      termTrackStatus: document.getElementById('termTrackStatus'),
      termProcessTableBody: document.getElementById('termProcessTableBody'),
      termProcessSearch: document.getElementById('termProcessSearch'),
      termQueueCount: document.getElementById('termQueueCount'),
      termLiveLogStream: document.getElementById('termLiveLogStream'),
      termOutput: document.getElementById('termOutput'),
      termInput: document.getElementById('termInput'),
      termCommandForm: document.getElementById('termCommandForm'),
      btnTermPlay: document.getElementById('btnTermPlay'),
      btnTermPrev: document.getElementById('btnTermPrev'),
      btnTermNext: document.getElementById('btnTermNext'),
      btnTermShuffle: document.getElementById('btnTermShuffle'),
      btnTermRepeat: document.getElementById('btnTermRepeat'),
      btnTermVolDown: document.getElementById('btnTermVolDown'),
      btnTermVolUp: document.getElementById('btnTermVolUp'),
      btnTermMute: document.getElementById('btnTermMute'),
      btnToggleMatrix: document.getElementById('btnToggleMatrix'),
      lblMatrixState: document.getElementById('lblMatrixState'),
      btnToggleCrt: document.getElementById('btnToggleCrt'),
      lblCrtState: document.getElementById('lblCrtState'),
      btnTermSwitchStudio: document.getElementById('btnTermSwitchStudio'),
      btnTermExit: document.getElementById('btnTermExit'),
      btnToggleLogStream: document.getElementById('btnToggleLogStream'),
      btnClearLogs: document.getElementById('btnClearLogs'),

      // Queue Drawer
      queueDrawerBackdrop: document.getElementById('queueDrawerBackdrop'),
      queueDrawer: document.getElementById('queueDrawer'),
      queueItemsContainer: document.getElementById('queueItemsContainer'),
      queueTotalTracks: document.getElementById('queueTotalTracks'),
      btnQueueShuffle: document.getElementById('btnQueueShuffle'),
      btnQueueClear: document.getElementById('btnQueueClear'),
      btnCloseQueueDrawer: document.getElementById('btnCloseQueueDrawer'),

      // Shortcuts Modal
      shortcutsModal: document.getElementById('shortcutsModal'),
      btnCloseShortcuts: document.getElementById('btnCloseShortcuts'),

      // EQ Modal
      eqModal: document.getElementById('eqModal'),
      btnCloseEq: document.getElementById('btnCloseEq'),
      eqVisualizerCanvas: document.getElementById('eqVisualizerCanvas'),
      eqBass: document.getElementById('eqBass'),
      eqMid: document.getElementById('eqMid'),
      eqTreble: document.getElementById('eqTreble'),
      eqBassVal: document.getElementById('eqBassVal'),
      eqMidVal: document.getElementById('eqMidVal'),
      eqTrebleVal: document.getElementById('eqTrebleVal'),

      // Visualizer Canvas & File Drop
      visualizerCanvas: document.getElementById('visualizerCanvas'),
      visModeSelector: document.getElementById('visModeSelector'),
      btnToggleFullscreenVis: document.getElementById('btnToggleFullscreenVis'),
      fileDropzone: document.getElementById('fileDropzone'),
      fileInput: document.getElementById('fileInput')
    };

    if (this.dom.volumeSlider) {
      this.dom.volumeSlider.value = this.savedVolume;
    }
  }

  showToast(message, icon = 'ri-check-line') {
    if (!this.dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast-pill';
    toast.innerHTML = `<i class="${icon}"></i> <span>${message}</span>`;
    this.dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 250);
    }, 2400);
  }

  setupAudioEngineCallbacks() {
    this.audioEngine.setCallbacks({
      onPlay: () => {
        this.updatePlayStateUI(true);
      },
      onPause: () => {
        this.updatePlayStateUI(false);
      },
      onTimeUpdate: (currentTime, duration) => {
        this.updateProgressUI(currentTime, duration);
        this.syncLyrics(currentTime);
      },
      onLoadedMetadata: (duration) => {
        if (this.dom.timeTotal) this.dom.timeTotal.textContent = this.formatTime(duration);
        if (this.dom.officeTimeTotal) this.dom.officeTimeTotal.textContent = this.formatTime(duration);
        if (this.dom.asciiTotalDuration) this.dom.asciiTotalDuration.textContent = this.formatTime(duration);
      },
      onEnded: () => {
        this.handleTrackEnded();
      },
      onError: (err) => {
        this.showToast(`Unable to play track: ${this.currentTrack?.title || 'Audio file'}`, 'ri-error-warning-line');
        // Auto skip after short timeout so player doesn't lock up
        setTimeout(() => this.playNext(true), 1200);
      }
    });
  }

  loadTrack(track, autoPlay = true) {
    if (!track) return;
    this.currentTrack = track;
    this.currentTrackIndex = this.songs.findIndex(s => s.id === track.id);
    localStorage.setItem('mp_last_track_id', track.id);

    // Update Studio Center Details
    if (this.dom.centerTitle) this.dom.centerTitle.textContent = track.title;
    if (this.dom.centerArtist) this.dom.centerArtist.textContent = track.artist;
    if (this.dom.centerGenre) this.dom.centerGenre.textContent = track.genre;
    if (this.dom.centerAlbum) this.dom.centerAlbum.textContent = track.album;
    if (this.dom.centerYear) this.dom.centerYear.textContent = track.year;
    if (this.dom.centerCover) this.dom.centerCover.src = track.cover || 'music.avif';

    // Update Playbar Details
    if (this.dom.playbarTitle) this.dom.playbarTitle.textContent = track.title;
    if (this.dom.playbarArtist) this.dom.playbarArtist.textContent = track.artist;
    if (this.dom.playbarCover) this.dom.playbarCover.src = track.cover || 'music.avif';

    // Update Office Mode Details
    if (this.dom.officeTitle) this.dom.officeTitle.textContent = track.title;
    if (this.dom.officeArtist) this.dom.officeArtist.textContent = track.artist;
    if (this.dom.officeCover) this.dom.officeCover.src = track.cover || 'music.avif';

    // Update Terminal ASCII Details
    if (this.dom.asciiSongTitle) this.dom.asciiSongTitle.textContent = track.title;
    if (this.dom.asciiSongArtist) this.dom.asciiSongArtist.textContent = `${track.artist} — ${track.album}`;
    if (this.dom.termCurrentTrackName) this.dom.termCurrentTrackName.textContent = track.src.replace('./', '');

    // Update Favorites State in UI
    const isFav = this.favorites.has(track.id);
    if (this.dom.btnPlaybarLike) {
      this.dom.btnPlaybarLike.classList.toggle('liked', isFav);
      this.dom.btnPlaybarLike.innerHTML = isFav ? '<i class="ri-heart-fill"></i>' : '<i class="ri-heart-line"></i>';
    }
    if (this.dom.btnCenterLike) {
      this.dom.btnCenterLike.innerHTML = isFav ? '<i class="ri-heart-fill" style="color:#ec4899;"></i> Favorited' : '<i class="ri-heart-line"></i> Favorite';
    }

    // Set Dynamic Visualizer Color
    if (this.visualizer && track.accentColor) {
      this.visualizer.setAccentColor(track.accentColor);
    }

    // Render Lyrics
    this.renderLyrics(track);

    // Audio Engine Load
    this.audioEngine.loadTrack(track, autoPlay);

    // Re-render lists for active state
    this.renderTrackList();
    this.renderTerminalProcessTable();
    this.renderQueueDrawer();
  }

  playNext(auto = false) {
    if (this.repeatMode === 'one' && auto) {
      this.audioEngine.seek(0);
      this.audioEngine.play();
      return;
    }

    if (this.queue.length === 0) {
      this.queue = [...this.songs];
    }

    let nextIndex = this.queueIndex + 1;
    if (nextIndex >= this.queue.length) {
      if (this.repeatMode === 'off' && auto) {
        this.audioEngine.stop();
        this.updatePlayStateUI(false);
        this.showToast('Playback completed.', 'ri-stop-circle-line');
        return;
      }
      nextIndex = 0;
    }

    this.queueIndex = nextIndex;
    const nextTrack = this.queue[this.queueIndex];
    this.loadTrack(nextTrack, true);
  }

  playPrev() {
    if (this.audioEngine.getCurrentTime() > 3) {
      this.audioEngine.seek(0);
      return;
    }

    if (this.queue.length === 0) {
      this.queue = [...this.songs];
    }

    let prevIndex = this.queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = this.queue.length - 1;
    }

    this.queueIndex = prevIndex;
    const prevTrack = this.queue[this.queueIndex];
    this.loadTrack(prevTrack, true);
  }

  handleTrackEnded() {
    this.playNext(true);
  }

  togglePlay() {
    this.audioEngine.togglePlay();
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    localStorage.setItem('mp_shuffle', this.isShuffle);

    if (this.isShuffle) {
      // Stable Fisher-Yates shuffle keeping current track at index 0
      const current = this.queue[this.queueIndex] || this.currentTrack;
      const rest = this.queue.filter(t => t.id !== current.id);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      this.queue = [current, ...rest];
      this.queueIndex = 0;
      this.showToast('Shuffle Mode: ON', 'ri-shuffle-line');
    } else {
      this.queue = [...this.songs];
      this.queueIndex = this.queue.findIndex(t => t.id === this.currentTrack.id);
      this.showToast('Shuffle Mode: OFF', 'ri-shuffle-line');
    }

    this.updateShuffleUI();
    this.renderQueueDrawer();
  }

  updateShuffleUI() {
    if (this.dom.btnShuffle) this.dom.btnShuffle.classList.toggle('active', this.isShuffle);
    if (this.dom.btnTermShuffle) this.dom.btnTermShuffle.textContent = `[ 🔀 SHUFFLE: ${this.isShuffle ? 'ON' : 'OFF'} ]`;
  }

  cycleRepeat() {
    if (this.repeatMode === 'all') {
      this.repeatMode = 'one';
      this.showToast('Repeat Mode: ONE', 'ri-repeat-one-line');
    } else if (this.repeatMode === 'one') {
      this.repeatMode = 'off';
      this.showToast('Repeat Mode: OFF', 'ri-repeat-2-line');
    } else {
      this.repeatMode = 'all';
      this.showToast('Repeat Mode: ALL', 'ri-repeat-2-line');
    }
    localStorage.setItem('mp_repeat', this.repeatMode);
    this.updateRepeatUI();
  }

  updateRepeatUI() {
    if (this.dom.btnRepeat) {
      if (this.repeatMode === 'all') {
        this.dom.btnRepeat.classList.add('active');
        this.dom.btnRepeat.innerHTML = '<i class="ri-repeat-2-line"></i>';
      } else if (this.repeatMode === 'one') {
        this.dom.btnRepeat.classList.add('active');
        this.dom.btnRepeat.innerHTML = '<i class="ri-repeat-one-line"></i>';
      } else {
        this.dom.btnRepeat.classList.remove('active');
        this.dom.btnRepeat.innerHTML = '<i class="ri-repeat-2-line"></i>';
      }
    }
    if (this.dom.btnTermRepeat) {
      this.dom.btnTermRepeat.textContent = `[ 🔁 REPEAT: ${this.repeatMode.toUpperCase()} ]`;
    }
  }

  toggleFavorite(track = this.currentTrack) {
    if (!track) return;
    if (this.favorites.has(track.id)) {
      this.favorites.delete(track.id);
      this.showToast(`Removed from Favorites: ${track.title}`, 'ri-heart-dislike-line');
    } else {
      this.favorites.add(track.id);
      this.showToast(`Added to Favorites: ${track.title}`, 'ri-heart-fill');
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.85 } });
    }
    localStorage.setItem('mp_favorites', JSON.stringify([...this.favorites]));

    // Update like buttons
    const isFav = this.favorites.has(this.currentTrack.id);
    if (this.dom.btnPlaybarLike) {
      this.dom.btnPlaybarLike.classList.toggle('liked', isFav);
      this.dom.btnPlaybarLike.innerHTML = isFav ? '<i class="ri-heart-fill"></i>' : '<i class="ri-heart-line"></i>';
    }
    if (this.dom.btnCenterLike) {
      this.dom.btnCenterLike.innerHTML = isFav ? '<i class="ri-heart-fill" style="color:#ec4899;"></i> Favorited' : '<i class="ri-heart-line"></i> Favorite';
    }

    this.renderTrackList();
  }

  addToQueue(track, notify = true) {
    if (!track) return;
    this.queue.push(track);
    localStorage.setItem('mp_queue', JSON.stringify(this.queue));
    this.renderQueueDrawer();
    if (notify) this.showToast(`✓ Added to queue: ${track.title}`, 'ri-play-list-add-line');
  }

  removeFromQueue(index) {
    if (index >= 0 && index < this.queue.length) {
      const removed = this.queue.splice(index, 1)[0];
      if (this.queueIndex >= index && this.queueIndex > 0) {
        this.queueIndex--;
      }
      localStorage.setItem('mp_queue', JSON.stringify(this.queue));
      this.renderQueueDrawer();
      this.showToast(`Removed from queue: ${removed.title}`, 'ri-delete-bin-line');
    }
  }

  clearQueue() {
    this.queue = [this.currentTrack];
    this.queueIndex = 0;
    localStorage.setItem('mp_queue', JSON.stringify(this.queue));
    this.renderQueueDrawer();
    this.showToast('Queue cleared.', 'ri-delete-bin-line');
  }

  playQueueIndex(index) {
    if (index >= 0 && index < this.queue.length) {
      this.queueIndex = index;
      this.loadTrack(this.queue[this.queueIndex], true);
    }
  }

  updatePlayStateUI(isPlaying) {
    if (this.dom.btnPlay) {
      this.dom.btnPlay.innerHTML = isPlaying ? '<i class="ri-pause-fill"></i>' : '<i class="ri-play-fill"></i>';
    }
    if (this.dom.btnOfficePlay) {
      this.dom.btnOfficePlay.innerHTML = isPlaying ? '<i class="ri-pause-line"></i> <span id="officePlayLabel">Pause</span>' : '<i class="ri-play-line"></i> <span id="officePlayLabel">Play</span>';
    }
    if (this.dom.asciiPlayBtn) {
      this.dom.asciiPlayBtn.textContent = isPlaying ? '❚❚ PAUSE' : '▶ PLAY';
    }
    if (this.dom.btnTermPlay) {
      this.dom.btnTermPlay.textContent = isPlaying ? '[ ⏸ PAUSE ]' : '[ ▶ PLAY ]';
    }
    if (this.dom.centerShowcase) {
      this.dom.centerShowcase.classList.toggle('playing', isPlaying);
    }
    if (this.dom.termTrackStatus) {
      this.dom.termTrackStatus.textContent = isPlaying ? '[STREAMING]' : '[PAUSED]';
      this.dom.termTrackStatus.style.color = isPlaying ? '#22c55e' : '#f59e0b';
    }
  }

  updateProgressUI(currentTime, duration) {
    const safeDuration = duration || 1;
    const percent = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

    // Studio Scrubber
    if (this.dom.timeCurrent) this.dom.timeCurrent.textContent = this.formatTime(currentTime);
    if (this.dom.scrubberFill) this.dom.scrubberFill.style.width = `${percent}%`;
    if (this.dom.scrubberThumb) this.dom.scrubberThumb.style.left = `${percent}%`;

    // Office Scrubber
    if (this.dom.officeTimeCurrent) this.dom.officeTimeCurrent.textContent = this.formatTime(currentTime);
    if (this.dom.officeProgressFill) this.dom.officeProgressFill.style.width = `${percent}%`;

    // ASCII Scrubber (30-character bar)
    if (this.dom.asciiCurrentTime) this.dom.asciiCurrentTime.textContent = this.formatTime(currentTime);
    if (this.dom.asciiProgressBar) {
      const totalChars = 28;
      const filledChars = Math.round((percent / 100) * totalChars);
      const bar = '━'.repeat(Math.max(0, filledChars - 1)) + '●' + '━'.repeat(Math.max(0, totalChars - filledChars));
      this.dom.asciiProgressBar.textContent = bar;
    }
  }

  renderLyrics(track) {
    if (!this.dom.lyricsBox) return;
    if (!track.lyrics || track.lyrics.length === 0) {
      this.dom.lyricsBox.innerHTML = '<div class="lyrics-line active">♪ Instrumental / Synced lyrics unavailable ♪</div>';
      return;
    }

    this.dom.lyricsBox.innerHTML = track.lyrics
      .map((l, i) => `<div class="lyrics-line" data-time="${l.time}" id="lyric-${i}">${l.text}</div>`)
      .join('');
  }

  syncLyrics(currentTime) {
    if (!this.dom.lyricsBox || !this.currentTrack?.lyrics) return;
    const lyrics = this.currentTrack.lyrics;
    let activeIdx = -1;

    for (let i = 0; i < lyrics.length; i++) {
      if (currentTime >= lyrics[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (activeIdx !== -1) {
      const allLines = this.dom.lyricsBox.querySelectorAll('.lyrics-line');
      allLines.forEach((el, idx) => {
        if (idx === activeIdx) {
          if (!el.classList.contains('active')) {
            el.classList.add('active');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          el.classList.remove('active');
        }
      });
    }
  }

  renderTrackList() {
    if (!this.dom.trackList) return;

    let list = this.songs;

    // Filter by Playlist
    if (this.activePlaylist === 'favorites') {
      list = list.filter(s => this.favorites.has(s.id));
    } else if (this.activePlaylist !== 'all') {
      const playlist = SYSTEM_PLAYLISTS.find(p => p.id === this.activePlaylist);
      if (playlist) {
        list = list.filter(s => playlist.trackIds.includes(s.id));
      }
    }

    // Filter by Genre
    if (this.activeFilter !== 'all') {
      list = list.filter(s => s.genre.toLowerCase().includes(this.activeFilter.toLowerCase()));
    }

    // Filter by Search Query
    if (this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album.toLowerCase().includes(q) ||
        s.genre.toLowerCase().includes(q)
      );
    }

    this.filteredSongs = list;
    if (this.dom.trackCountBadge) {
      this.dom.trackCountBadge.textContent = `${list.length} tracks`;
    }

    if (list.length === 0) {
      this.dom.trackList.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">No tracks found matching your filter.</div>';
      return;
    }

    this.dom.trackList.innerHTML = list.map((song, idx) => {
      const isActive = this.currentTrack && this.currentTrack.id === song.id;
      const isFav = this.favorites.has(song.id);
      return `
        <div class="track-item ${isActive ? 'active' : ''}" data-id="${song.id}">
          <div class="track-item-index">${idx + 1}</div>
          <img class="track-item-cover" src="${song.cover || 'music.avif'}" alt="${song.title}" loading="lazy">
          <div class="track-item-details">
            <div class="track-item-title">${song.title}</div>
            <div class="track-item-artist">${song.artist}</div>
          </div>
          <div class="track-item-actions">
            <button class="track-action-btn btn-add-q" data-id="${song.id}" title="Add to Queue">
              <i class="ri-play-list-add-line"></i>
            </button>
            <button class="track-action-btn ${isFav ? 'liked' : ''} btn-fav" data-id="${song.id}" title="Favorite">
              <i class="${isFav ? 'ri-heart-fill' : 'ri-heart-line'}"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach row events
    this.dom.trackList.querySelectorAll('.track-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.track-action-btn')) return;
        const songId = parseInt(el.dataset.id, 10);
        const selected = this.songs.find(s => s.id === songId);
        if (selected) {
          this.loadTrack(selected, true);
        }
      });
    });

    this.dom.trackList.querySelectorAll('.btn-add-q').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const songId = parseInt(btn.dataset.id, 10);
        const song = this.songs.find(s => s.id === songId);
        if (song) this.addToQueue(song, true);
      });
    });

    this.dom.trackList.querySelectorAll('.btn-fav').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const songId = parseInt(btn.dataset.id, 10);
        const song = this.songs.find(s => s.id === songId);
        if (song) this.toggleFavorite(song);
      });
    });
  }

  renderQueueDrawer() {
    if (this.dom.headerQueueCount) {
      this.dom.headerQueueCount.textContent = this.queue.length;
    }
    if (this.dom.queueTotalTracks) {
      this.dom.queueTotalTracks.textContent = `${this.queue.length} tracks`;
    }
    if (this.dom.asciiQueueSummary) {
      this.dom.asciiQueueSummary.textContent = `${this.queue.length} tracks in queue (Current: #${this.queueIndex + 1})`;
    }

    if (!this.dom.queueItemsContainer) return;

    if (this.queue.length === 0) {
      this.dom.queueItemsContainer.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">Queue is empty.</div>';
      return;
    }

    this.dom.queueItemsContainer.innerHTML = this.queue.map((song, idx) => {
      const isCurrent = idx === this.queueIndex;
      return `
        <div class="queue-item ${isCurrent ? 'active' : ''}">
          <span style="font-family:'JetBrains Mono'; font-size:11px; color:var(--text-muted); width:20px;">${idx + 1}</span>
          <div class="queue-item-info">
            <div class="queue-item-title">${song.title} ${isCurrent ? '🔊' : ''}</div>
            <div class="queue-item-artist">${song.artist}</div>
          </div>
          <div class="queue-item-actions">
            <button class="queue-btn-tiny btn-q-play" data-idx="${idx}" title="Play now"><i class="ri-play-line"></i></button>
            <button class="queue-btn-tiny btn-q-del" data-idx="${idx}" title="Remove"><i class="ri-close-line"></i></button>
          </div>
        </div>
      `;
    }).join('');

    this.dom.queueItemsContainer.querySelectorAll('.btn-q-play').forEach(b => {
      b.addEventListener('click', () => {
        const idx = parseInt(b.dataset.idx, 10);
        this.playQueueIndex(idx);
      });
    });

    this.dom.queueItemsContainer.querySelectorAll('.btn-q-del').forEach(b => {
      b.addEventListener('click', () => {
        const idx = parseInt(b.dataset.idx, 10);
        this.removeFromQueue(idx);
      });
    });
  }

  renderTerminalProcessTable() {
    if (!this.dom.termProcessTableBody) return;
    const list = this.songs;

    this.dom.termProcessTableBody.innerHTML = list.map((song) => {
      const isCurrent = this.currentTrack && this.currentTrack.id === song.id;
      return `
        <tr class="${isCurrent ? 'active-row' : ''}" data-id="${song.id}">
          <td>${song.id + 400}</td>
          <td><b>${song.title}</b></td>
          <td>${song.artist}</td>
          <td>${song.genre}</td>
          <td><button class="term-mini-btn btn-term-row-play" data-id="${song.id}">▶ PLAY</button></td>
        </tr>
      `;
    }).join('');

    this.dom.termProcessTableBody.querySelectorAll('.btn-term-row-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id, 10);
        const song = this.songs.find(s => s.id === id);
        if (song) this.loadTrack(song, true);
      });
    });
  }

  applyTheme(theme) {
    this.theme = theme;
    localStorage.setItem('mp_theme', theme);
    document.body.className = `mode-${this.mode} theme-${theme}`;
    if (this.dom.currentThemeLabel) {
      this.dom.currentThemeLabel.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
    }
  }

  applyMode(mode) {
    this.mode = mode;
    localStorage.setItem('mp_mode', mode);
    document.body.className = `mode-${mode} theme-${this.theme}`;

    if (this.dom.studioApp) this.dom.studioApp.style.display = mode === 'studio' ? 'flex' : 'none';
    if (this.dom.officeApp) this.dom.officeApp.style.display = mode === 'office' ? 'flex' : 'none';
    if (this.dom.terminalApp) this.dom.terminalApp.style.display = mode === 'terminal' ? 'flex' : 'none';
  }

  toggleOfficeMode() {
    if (this.mode === 'office') {
      this.applyMode('studio');
      this.showToast('Switched to Studio Mode', 'ri-fullscreen-line');
    } else {
      this.applyMode('office');
      this.showToast('Switched to Minimal Office Mode', 'ri-briefcase-4-line');
    }
  }

  toggleTerminalMode() {
    if (this.mode === 'terminal') {
      this.applyMode('studio');
      this.showToast('Switched to Studio Mode', 'ri-sparkling-fill');
    } else {
      this.applyMode('terminal');
      this.showToast('Switched to Hacker Terminal CLI', 'ri-terminal-box-line');
    }
  }

  setupEventListeners() {
    // Studio Navigation & Mode Buttons
    if (this.dom.btnToggleOffice) this.dom.btnToggleOffice.addEventListener('click', () => this.toggleOfficeMode());
    if (this.dom.btnToggleTerminal) this.dom.btnToggleTerminal.addEventListener('click', () => this.toggleTerminalMode());
    if (this.dom.btnOfficeToStudio) this.dom.btnOfficeToStudio.addEventListener('click', () => this.applyMode('studio'));
    if (this.dom.btnTermSwitchStudio) this.dom.btnTermSwitchStudio.addEventListener('click', () => this.applyMode('studio'));
    if (this.dom.btnTermExit) this.dom.btnTermExit.addEventListener('click', () => this.applyMode('studio'));

    // Office Mode Playback Controls
    if (this.dom.btnOfficePlay) this.dom.btnOfficePlay.addEventListener('click', () => this.togglePlay());
    if (this.dom.btnOfficePrev) this.dom.btnOfficePrev.addEventListener('click', () => this.playPrev());
    if (this.dom.btnOfficeNext) this.dom.btnOfficeNext.addEventListener('click', () => this.playNext(false));
    if (this.dom.btnOfficeMute) this.dom.btnOfficeMute.addEventListener('click', () => {
      const isMuted = this.audioEngine.toggleMute();
      this.showToast(isMuted ? 'Muted' : 'Unmuted', isMuted ? 'ri-volume-mute-line' : 'ri-volume-up-line');
    });

    // Theme Menu Dropdown
    if (this.dom.btnThemeMenu) {
      this.dom.btnThemeMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dom.themeDropdown.classList.toggle('show');
      });
    }

    document.addEventListener('click', () => {
      if (this.dom.themeDropdown) this.dom.themeDropdown.classList.remove('show');
    });

    if (this.dom.themeDropdown) {
      this.dom.themeDropdown.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', () => {
          this.applyTheme(b.dataset.theme);
        });
      });
    }

    // Playbar Controls
    if (this.dom.btnPlay) this.dom.btnPlay.addEventListener('click', () => this.togglePlay());
    if (this.dom.btnPrev) this.dom.btnPrev.addEventListener('click', () => this.playPrev());
    if (this.dom.btnNext) this.dom.btnNext.addEventListener('click', () => this.playNext(false));
    if (this.dom.btnShuffle) this.dom.btnShuffle.addEventListener('click', () => this.toggleShuffle());
    if (this.dom.btnRepeat) this.dom.btnRepeat.addEventListener('click', () => this.cycleRepeat());
    if (this.dom.btnPlaybarLike) this.dom.btnPlaybarLike.addEventListener('click', () => this.toggleFavorite());
    if (this.dom.btnCenterLike) this.dom.btnCenterLike.addEventListener('click', () => this.toggleFavorite());
    if (this.dom.btnCenterQueueAdd) this.dom.btnCenterQueueAdd.addEventListener('click', () => this.addToQueue(this.currentTrack, true));

    // Scrubber click/drag
    if (this.dom.scrubberContainer) {
      this.dom.scrubberContainer.addEventListener('click', (e) => {
        const rect = this.dom.scrubberContainer.getBoundingClientRect();
        const percent = ((e.clientX - rect.left) / rect.width) * 100;
        this.audioEngine.seekPercentage(percent);
      });
    }

    if (this.dom.officeProgressClick) {
      this.dom.officeProgressClick.addEventListener('click', (e) => {
        const rect = this.dom.officeProgressClick.getBoundingClientRect();
        const percent = ((e.clientX - rect.left) / rect.width) * 100;
        this.audioEngine.seekPercentage(percent);
      });
    }

    // Volume Slider & Mute
    if (this.dom.volumeSlider) {
      this.dom.volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.audioEngine.setVolume(val);
        localStorage.setItem('mp_volume', val);
        this.updateVolumeIcon(val);
      });
    }

    if (this.dom.btnVolume) {
      this.dom.btnVolume.addEventListener('click', () => {
        const isMuted = this.audioEngine.toggleMute();
        this.updateVolumeIcon(this.audioEngine.volume, isMuted);
      });
    }

    // Speed Selector
    if (this.dom.speedSelect) {
      this.dom.speedSelect.addEventListener('change', (e) => {
        this.audioEngine.setPlaybackRate(parseFloat(e.target.value));
        this.showToast(`Speed: ${e.target.value}x`, 'ri-speed-line');
      });
    }

    // Search Input
    if (this.dom.searchInput) {
      this.dom.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        if (this.dom.searchClearBtn) {
          this.dom.searchClearBtn.classList.toggle('visible', this.searchQuery.length > 0);
        }
        this.renderTrackList();
      });
    }

    if (this.dom.searchClearBtn) {
      this.dom.searchClearBtn.addEventListener('click', () => {
        this.dom.searchInput.value = '';
        this.searchQuery = '';
        this.dom.searchClearBtn.classList.remove('visible');
        this.renderTrackList();
      });
    }

    // Playlist Quick Bar
    if (this.dom.playlistsBar) {
      this.dom.playlistsBar.querySelectorAll('.playlist-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          this.dom.playlistsBar.querySelectorAll('.playlist-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.activePlaylist = chip.dataset.playlist;
          this.renderTrackList();
        });
      });
    }

    // Genre Filter Tabs
    if (this.dom.filterTabs) {
      this.dom.filterTabs.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          this.dom.filterTabs.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.activeFilter = chip.dataset.filter;
          this.renderTrackList();
        });
      });
    }

    // Queue Drawer Toggle
    if (this.dom.btnOpenQueue) {
      this.dom.btnOpenQueue.addEventListener('click', () => {
        this.dom.queueDrawerBackdrop.classList.add('active');
        this.renderQueueDrawer();
      });
    }
    if (this.dom.btnCloseQueueDrawer) {
      this.dom.btnCloseQueueDrawer.addEventListener('click', () => {
        this.dom.queueDrawerBackdrop.classList.remove('active');
      });
    }
    if (this.dom.queueDrawerBackdrop) {
      this.dom.queueDrawerBackdrop.addEventListener('click', (e) => {
        if (e.target === this.dom.queueDrawerBackdrop) {
          this.dom.queueDrawerBackdrop.classList.remove('active');
        }
      });
    }
    if (this.dom.btnQueueShuffle) this.dom.btnQueueShuffle.addEventListener('click', () => this.toggleShuffle());
    if (this.dom.btnQueueClear) this.dom.btnQueueClear.addEventListener('click', () => this.clearQueue());

    // Shortcuts Modal
    if (this.dom.btnOpenShortcuts) {
      this.dom.btnOpenShortcuts.addEventListener('click', () => {
        this.dom.shortcutsModal.classList.add('active');
      });
    }
    if (this.dom.btnCloseShortcuts) {
      this.dom.btnCloseShortcuts.addEventListener('click', () => {
        this.dom.shortcutsModal.classList.remove('active');
      });
    }

    // Equalizer Modal
    if (this.dom.btnOpenEq) {
      this.dom.btnOpenEq.addEventListener('click', () => {
        this.dom.eqModal.classList.add('active');
        this.startEqVisualizerLoop();
      });
    }
    if (this.dom.btnCloseEq) {
      this.dom.btnCloseEq.addEventListener('click', () => {
        this.dom.eqModal.classList.remove('active');
        if (this.eqVisualizerLoopId) cancelAnimationFrame(this.eqVisualizerLoopId);
      });
    }

    // Equalizer sliders
    const updateEq = () => {
      const b = parseFloat(this.dom.eqBass.value);
      const m = parseFloat(this.dom.eqMid.value);
      const t = parseFloat(this.dom.eqTreble.value);
      this.dom.eqBassVal.textContent = `${b > 0 ? '+' : ''}${b} dB`;
      this.dom.eqMidVal.textContent = `${m > 0 ? '+' : ''}${m} dB`;
      this.dom.eqTrebleVal.textContent = `${t > 0 ? '+' : ''}${t} dB`;
      this.audioEngine.setEqualizer(b, m, t);
      this.eqGains = [b, m, t];
    };

    if (this.dom.eqBass) this.dom.eqBass.addEventListener('input', updateEq);
    if (this.dom.eqMid) this.dom.eqMid.addEventListener('input', updateEq);
    if (this.dom.eqTreble) this.dom.eqTreble.addEventListener('input', updateEq);

    // Visualizer Mode Buttons
    if (this.dom.visModeSelector) {
      this.dom.visModeSelector.querySelectorAll('.vis-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.dom.visModeSelector.querySelectorAll('.vis-mode-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (this.visualizer) this.visualizer.setMode(btn.dataset.mode);
        });
      });
    }
  }

  updateVolumeIcon(val, isMuted = this.audioEngine.isMuted) {
    if (!this.dom.btnVolume) return;
    if (isMuted || val === 0) {
      this.dom.btnVolume.innerHTML = '<i class="ri-volume-mute-fill"></i>';
    } else if (val < 0.5) {
      this.dom.btnVolume.innerHTML = '<i class="ri-volume-down-fill"></i>';
    } else {
      this.dom.btnVolume.innerHTML = '<i class="ri-volume-up-fill"></i>';
    }
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't trigger hotkeys if user is actively typing into an input field
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInput = activeTag === 'input' || activeTag === 'textarea';

      if (e.key === 'Escape') {
        if (isInput) {
          document.activeElement.blur();
          return;
        }
        if (this.dom.shortcutsModal?.classList.contains('active')) {
          this.dom.shortcutsModal.classList.remove('active');
          return;
        }
        if (this.dom.eqModal?.classList.contains('active')) {
          this.dom.eqModal.classList.remove('active');
          return;
        }
        if (this.dom.queueDrawerBackdrop?.classList.contains('active')) {
          this.dom.queueDrawerBackdrop.classList.remove('active');
          return;
        }
        if (this.mode !== 'studio') {
          this.applyMode('studio');
          return;
        }
      }

      if (isInput) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.togglePlay();
          break;
        case 'KeyN':
          e.preventDefault();
          this.playNext(false);
          break;
        case 'KeyB':
          e.preventDefault();
          this.playPrev();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.audioEngine.seekRelative(-5);
          this.showToast('Seek: -5s', 'ri-replay-5-line');
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.audioEngine.seekRelative(5);
          this.showToast('Seek: +5s', 'ri-forward-5-line');
          break;
        case 'ArrowUp':
          e.preventDefault();
          {
            const v = this.audioEngine.setVolumeRelative(0.05);
            if (this.dom.volumeSlider) this.dom.volumeSlider.value = v;
            this.updateVolumeIcon(v);
            this.showToast(`Volume: ${Math.round(v * 100)}%`, 'ri-volume-up-line');
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          {
            const v = this.audioEngine.setVolumeRelative(-0.05);
            if (this.dom.volumeSlider) this.dom.volumeSlider.value = v;
            this.updateVolumeIcon(v);
            this.showToast(`Volume: ${Math.round(v * 100)}%`, 'ri-volume-down-line');
          }
          break;
        case 'KeyM':
          e.preventDefault();
          {
            const muted = this.audioEngine.toggleMute();
            this.updateVolumeIcon(this.audioEngine.volume, muted);
            this.showToast(muted ? 'Muted' : 'Unmuted', muted ? 'ri-volume-mute-line' : 'ri-volume-up-line');
          }
          break;
        case 'KeyS':
          e.preventDefault();
          this.toggleShuffle();
          break;
        case 'KeyR':
          e.preventDefault();
          this.cycleRepeat();
          break;
        case 'KeyQ':
          e.preventDefault();
          this.dom.queueDrawerBackdrop.classList.toggle('active');
          this.renderQueueDrawer();
          break;
        case 'KeyO':
          e.preventDefault();
          this.toggleOfficeMode();
          break;
        case 'Backquote':
          e.preventDefault();
          this.toggleTerminalMode();
          break;
        case 'KeyF':
          e.preventDefault();
          this.toggleFavorite();
          break;
        case 'Slash':
          e.preventDefault();
          if (this.dom.searchInput) {
            this.dom.searchInput.focus();
            this.dom.searchInput.select();
          }
          break;
        case 'Slash':
        case 'KeyH':
          if (e.key === '?') {
            e.preventDefault();
            this.dom.shortcutsModal.classList.toggle('active');
          }
          break;
      }
    });
  }

  setupDragAndDrop() {
    if (!this.dom.fileDropzone || !this.dom.fileInput) return;

    this.dom.fileDropzone.addEventListener('click', () => {
      this.dom.fileInput.click();
    });

    this.dom.fileDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dom.fileDropzone.classList.add('dragover');
    });

    this.dom.fileDropzone.addEventListener('dragleave', () => {
      this.dom.fileDropzone.classList.remove('dragover');
    });

    this.dom.fileDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dom.fileDropzone.classList.remove('dragover');
      if (e.dataTransfer.files?.length) {
        this.handleLocalFiles(e.dataTransfer.files);
      }
    });

    this.dom.fileInput.addEventListener('change', (e) => {
      if (e.target.files?.length) {
        this.handleLocalFiles(e.target.files);
      }
    });
  }

  handleLocalFiles(files) {
    const audioFiles = Array.from(files).filter(f => f.type.startsWith('audio/') || f.name.endsWith('.mp3') || f.name.endsWith('.m4a'));
    if (!audioFiles.length) return;

    audioFiles.forEach(file => {
      const url = URL.createObjectURL(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      const newSong = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        title: cleanName,
        artist: "Local Track",
        album: "Local Storage",
        genre: "Custom",
        year: new Date().getFullYear().toString(),
        src: url,
        cover: "music.avif",
        accentColor: "#a855f7",
        lyrics: [{ time: 0, text: `♪ ${cleanName} ♪` }]
      };
      this.songs.unshift(newSong);
      this.addToQueue(newSong, false);
    });

    this.renderTrackList();
    this.renderTerminalProcessTable();
    this.showToast(`Imported ${audioFiles.length} track(s) to Library & Queue!`, 'ri-folder-music-line');
    this.loadTrack(this.songs[0], true);
  }

  setupTerminalShell() {
    if (!this.dom.termCommandForm || !this.dom.termInput) return;

    this.dom.termCommandForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = this.dom.termInput.value.trim();
      if (!raw) return;
      this.dom.termInput.value = '';

      this.logTerminalLine(`root@auratune:~$ ${raw}`, 'term-prompt-prefix');
      this.executeTerminalCommand(raw.toLowerCase());
    });
  }

  executeTerminalCommand(cmd) {
    const parts = cmd.split(' ');
    const action = parts[0];

    switch (action) {
      case 'help':
        this.logTerminalLine('Available commands: play, pause, next, prev, queue, shuffle, repeat, vol [0-100], mute, search [query], theme [matrix|neutral|cyan|amber|red|mono], office, studio, clear');
        break;
      case 'play':
        this.audioEngine.play();
        this.logTerminalLine('✓ Audio playback started.');
        break;
      case 'pause':
        this.audioEngine.pause();
        this.logTerminalLine('✓ Audio playback paused.');
        break;
      case 'next':
        this.playNext(false);
        this.logTerminalLine(`✓ Playing next: ${this.currentTrack.title}`);
        break;
      case 'prev':
        this.playPrev();
        this.logTerminalLine(`✓ Playing previous: ${this.currentTrack.title}`);
        break;
      case 'vol':
        if (parts[1]) {
          const v = Math.max(0, Math.min(100, parseInt(parts[1], 10))) / 100;
          this.audioEngine.setVolume(v);
          this.logTerminalLine(`✓ Volume set to ${Math.round(v * 100)}%`);
        }
        break;
      case 'mute':
        const muted = this.audioEngine.toggleMute();
        this.logTerminalLine(`✓ Audio ${muted ? 'Muted' : 'Unmuted'}`);
        break;
      case 'shuffle':
        this.toggleShuffle();
        this.logTerminalLine(`✓ Shuffle mode: ${this.isShuffle ? 'ON' : 'OFF'}`);
        break;
      case 'repeat':
        this.cycleRepeat();
        this.logTerminalLine(`✓ Repeat mode: ${this.repeatMode.toUpperCase()}`);
        break;
      case 'theme':
        if (parts[1]) {
          this.applyTheme(parts[1]);
          this.logTerminalLine(`✓ Theme set to ${parts[1]}`);
        }
        break;
      case 'office':
        this.applyMode('office');
        break;
      case 'studio':
        this.applyMode('studio');
        break;
      case 'clear':
        if (this.dom.termOutput) this.dom.termOutput.innerHTML = '';
        break;
      default:
        this.logTerminalLine(`Command not found: ${action}. Type 'help' for manual.`, 'term-accent');
        break;
    }
  }

  logTerminalLine(msg, customClass = '') {
    if (!this.dom.termOutput) return;
    const div = document.createElement('div');
    div.className = `term-line ${customClass}`;
    div.textContent = msg;
    this.dom.termOutput.appendChild(div);
    this.dom.termOutput.scrollTop = this.dom.termOutput.scrollHeight;
  }

  setupLiveLogStream() {
    if (!this.dom.termLiveLogStream) return;
    const logEvents = [
      '[DSP-CORE] FFT frame sync: 48000Hz (0 dropped samples)',
      '[RING-BUFFER] Audio chunks committed to memory pool',
      '[KERNEL-ALSA] Real-time audio buffer write success',
      '[ANALYSER] Spectrum analyser frame compute: 60.0 FPS',
      '[TELEMETRY] Audio pipeline load: 3.4% CPU, 164MB RSS'
    ];

    setInterval(() => {
      if (!this.isLogsStreaming || this.mode !== 'terminal') return;
      const log = logEvents[Math.floor(Math.random() * logEvents.length)];
      const line = document.createElement('div');
      line.textContent = `${new Date().toLocaleTimeString()} ${log}`;
      this.dom.termLiveLogStream.appendChild(line);
      if (this.dom.termLiveLogStream.children.length > 20) {
        this.dom.termLiveLogStream.removeChild(this.dom.termLiveLogStream.children[0]);
      }
      this.dom.termLiveLogStream.scrollTop = this.dom.termLiveLogStream.scrollHeight;
    }, 2500);
  }

  startRealtimeTelemetryLoop() {
    const chars = [' ', ' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    const buffer = new Uint8Array(32);

    const updateTelemetry = () => {
      if (this.mode === 'terminal') {
        this.audioEngine.getFrequencyData(buffer);
        let specStr = '[ ';
        for (let i = 0; i < 24; i++) {
          const val = buffer[i] || 0;
          const charIdx = Math.min(chars.length - 1, Math.floor((val / 255) * chars.length));
          specStr += chars[charIdx];
        }
        specStr += ' ]';
        if (this.dom.termAsciiSpectrum) this.dom.termAsciiSpectrum.textContent = specStr;

        // Dynamic Hex Dump
        if (this.dom.termHexDump) {
          const h1 = (buffer[0] || 0x7f).toString(16).padStart(2, '0').toUpperCase();
          const h2 = (buffer[4] || 0x45).toString(16).padStart(2, '0').toUpperCase();
          const h3 = (buffer[8] || 0x4c).toString(16).padStart(2, '0').toUpperCase();
          const h4 = (buffer[12] || 0x02).toString(16).padStart(2, '0').toUpperCase();
          this.dom.termHexDump.textContent = `0x${h1} 0x${h2} 0x${h3} 0x${h4} 0x01 0x01 0x8A 0x3F`;
        }
      }
      requestAnimationFrame(updateTelemetry);
    };
    requestAnimationFrame(updateTelemetry);
  }

  initVisualizer() {
    if (this.dom.visualizerCanvas) {
      this.visualizer = new AudioVisualizer(this.dom.visualizerCanvas, this.audioEngine);
      this.visualizer.start();
    }
  }

  startEqVisualizerLoop() {
    if (!this.dom.eqVisualizerCanvas) return;
    const canvas = this.dom.eqVisualizerCanvas;
    const ctx = canvas.getContext('2d');
    const buffer = new Uint8Array(32);

    const render = () => {
      this.audioEngine.getFrequencyData(buffer);
      renderEqModalSpectrum(canvas, ctx, buffer, this.eqGains, this.currentTrack?.accentColor || '#a855f7');
      if (this.dom.eqModal.classList.contains('active')) {
        this.eqVisualizerLoopId = requestAnimationFrame(render);
      }
    };
    render();
  }

  initMatrixRain() {
    const canvas = document.getElementById('matrixCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    const chars = '0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ';
    const fontSize = 14;
    let columns = Math.floor(width / fontSize);
    let drops = Array(columns).fill(1);

    const draw = () => {
      if (!this.isMatrixRainActive) return;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#22c55e';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      this.matrixAnimationId = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      columns = Math.floor(width / fontSize);
      drops = Array(columns).fill(1);
    });

    if (this.isMatrixRainActive) draw();
  }

  toggleMatrixRain(force) {
    this.isMatrixRainActive = force !== undefined ? force : !this.isMatrixRainActive;
    localStorage.setItem('mp_matrix', this.isMatrixRainActive);
    const canvas = document.getElementById('matrixCanvas');
    if (canvas) canvas.style.display = this.isMatrixRainActive ? 'block' : 'none';
    if (this.dom.lblMatrixState) this.dom.lblMatrixState.textContent = this.isMatrixRainActive ? 'ON' : 'OFF';
  }

  toggleCrt(force) {
    this.isCrtActive = force !== undefined ? force : !this.isCrtActive;
    localStorage.setItem('mp_crt', this.isCrtActive);
    const crt = document.getElementById('crtOverlay');
    if (crt) crt.style.display = this.isCrtActive ? 'block' : 'none';
    if (this.dom.lblCrtState) this.dom.lblCrtState.textContent = this.isCrtActive ? 'ON' : 'OFF';
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds === 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}

// Initialize Application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MusicPlayerApp();
});
