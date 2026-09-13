(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const STORAGE_PREFIX = 'legendary_sequence_shock_';
  const STORAGE = {
    name: `${STORAGE_PREFIX}player_name`,
    sound: `${STORAGE_PREFIX}sound_enabled`,
    music: `${STORAGE_PREFIX}music_enabled`,
    records: `${STORAGE_PREFIX}records`
  };
  const MODES = {
    classic: { label: 'Classic', lives: 1, baseSpeed: 690, speedStep: 24, minimumSpeed: 300 },
    lives: { label: 'Lives', lives: 3, baseSpeed: 680, speedStep: 23, minimumSpeed: 290 },
    speed: { label: 'Speed Shock', lives: 1, baseSpeed: 535, speedStep: 35, minimumSpeed: 130 }
  };
  const TILE_FREQUENCIES = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99];

  function storageGet(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadRecords() {
    const empty = { bestByMode: { classic: 0, lives: 0, speed: 0 }, longest: 0, runs: 0 };
    try {
      const parsed = JSON.parse(storageGet(STORAGE.records, ''));
      if (!parsed || typeof parsed !== 'object') return empty;
      return {
        bestByMode: {
          classic: Math.max(0, Number(parsed.bestByMode?.classic) || 0),
          lives: Math.max(0, Number(parsed.bestByMode?.lives) || 0),
          speed: Math.max(0, Number(parsed.bestByMode?.speed) || 0)
        },
        longest: Math.max(0, Number(parsed.longest) || 0),
        runs: Math.max(0, Number(parsed.runs) || 0)
      };
    } catch (error) {
      return empty;
    }
  }

  const state = {
    screen: 'menu',
    mode: 'classic',
    playerName: storageGet(STORAGE.name, ''),
    soundEnabled: storageGet(STORAGE.sound, 'on') !== 'off',
    musicEnabled: storageGet(STORAGE.music, 'on') !== 'off',
    records: loadRecords(),
    sequence: [],
    playerIndex: 0,
    completedRounds: 0,
    lives: 1,
    mistakes: 0,
    correctInputs: 0,
    totalInputs: 0,
    turn: 'system',
    paused: false,
    runSetRecord: false,
    timers: new Map(),
    nextTimerId: 1,
    audioContext: null,
    musicNodes: null,
    activeTones: new Set()
  };

  const menuScreen = $('#menu-screen');
  const gameScreen = $('#game-screen');
  const howToModal = $('#how-to-modal');
  const pauseModal = $('#pause-modal');
  const gameoverModal = $('#gameover-modal');
  const tiles = $$('.shock-tile');
  const pageRegions = [$('.topbar'), $('.app-shell')];
  let howToReturnFocus = null;

  function persistRecords() {
    storageSet(STORAGE.records, JSON.stringify(state.records));
  }

  function selectedMode() {
    return document.querySelector('input[name="mode"]:checked')?.value || 'classic';
  }

  function updateAudioControls() {
    $('#sound-toggle').setAttribute('aria-pressed', String(state.soundEnabled));
    $('#music-toggle').setAttribute('aria-pressed', String(state.musicEnabled));
    $('#sound-label').textContent = state.soundEnabled ? 'On' : 'Off';
    $('#music-label').textContent = state.musicEnabled ? 'On' : 'Off';
  }

  function renderMenuRecords() {
    const mode = selectedMode();
    $('#menu-best').textContent = state.records.bestByMode[mode];
    $('#menu-longest').textContent = state.records.longest;
    $('#menu-runs').textContent = state.records.runs;
  }

  function accuracy() {
    return state.totalInputs ? Math.round((state.correctInputs / state.totalInputs) * 100) : 100;
  }

  function renderHud() {
    $('#round-stat').textContent = state.sequence.length || 1;
    $('#best-stat').textContent = state.records.bestByMode[state.mode];
    $('#longest-stat').textContent = state.records.longest;
    $('#accuracy-stat').textContent = `${accuracy()}%`;
    $('#mistakes-stat').textContent = state.mistakes;
    $('#lives-stat').textContent = '●'.repeat(state.lives) + '○'.repeat(Math.max(0, 3 - state.lives));
    $('#progress-text').textContent = `${state.playerIndex} / ${state.sequence.length || 1}`;
    $('#progress-fill').style.width = `${state.sequence.length ? (state.playerIndex / state.sequence.length) * 100 : 0}%`;
  }

  function setStatus(turn, title, detail) {
    state.turn = turn;
    const indicator = $('#turn-indicator');
    indicator.textContent = turn === 'player' ? 'Your turn' : 'System';
    indicator.className = `turn-indicator ${turn}`;
    $('#status-title').textContent = title;
    $('#status-detail').textContent = detail;
    const enabled = turn === 'player' && !state.paused && state.screen === 'game';
    tiles.forEach((tile) => { tile.disabled = !enabled; });
  }

  function updatePauseButton() {
    const button = $('#pause-button');
    const paused = state.screen === 'game' && state.paused;
    button.innerHTML = paused
      ? '<span aria-hidden="true">&gt;</span> Resume'
      : '<span aria-hidden="true">II</span> Pause';
    button.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  }

  function isolateModal(modal = null) {
    pageRegions.forEach((region) => {
      region.inert = Boolean(modal);
      if (modal) region.setAttribute('aria-hidden', 'true');
      else region.removeAttribute('aria-hidden');
    });
  }

  function visibleModal() {
    return [howToModal, pauseModal, gameoverModal].find((modal) => !modal.hidden) || null;
  }

  function trapModalFocus(event, modal) {
    if (event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) {
      event.preventDefault();
      modal.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  function schedule(callback, delay) {
    const id = state.nextTimerId++;
    const timer = { callback, remaining: delay, due: performance.now() + delay, nativeId: null };
    timer.nativeId = window.setTimeout(() => {
      state.timers.delete(id);
      callback();
    }, delay);
    state.timers.set(id, timer);
    return id;
  }

  function cancelTimer(id) {
    const timer = state.timers.get(id);
    if (!timer) return;
    window.clearTimeout(timer.nativeId);
    state.timers.delete(id);
  }

  function clearTimers() {
    state.timers.forEach((timer) => window.clearTimeout(timer.nativeId));
    state.timers.clear();
    tiles.forEach((tile) => {
      delete tile.dataset.flashTimer;
      tile.classList.remove('is-system', 'is-player', 'is-correct', 'is-wrong');
    });
    gameScreen.classList.remove('is-round-reveal');
  }

  function pauseTimers() {
    const now = performance.now();
    state.timers.forEach((timer) => {
      window.clearTimeout(timer.nativeId);
      timer.remaining = Math.max(0, timer.due - now);
      timer.nativeId = null;
    });
  }

  function resumeTimers() {
    state.timers.forEach((timer, id) => {
      timer.due = performance.now() + timer.remaining;
      timer.nativeId = window.setTimeout(() => {
        state.timers.delete(id);
        timer.callback();
      }, timer.remaining);
    });
  }

  function audioContext() {
    if (state.audioContext) return state.audioContext;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    try {
      state.audioContext = new AudioContext();
      return state.audioContext;
    } catch (error) {
      return null;
    }
  }

  function resumeAudio() {
    const context = state.audioContext;
    if (context?.state === 'suspended') context.resume().catch(() => {});
  }

  function playTone(frequency, duration = .16, volume = .055, type = 'sine') {
    if (!state.soundEnabled || state.paused || state.screen !== 'game') return;
    const context = audioContext();
    if (!context) return;
    resumeAudio();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    state.activeTones.add(oscillator);
    oscillator.addEventListener('ended', () => state.activeTones.delete(oscillator), { once: true });
    oscillator.start(now);
    oscillator.stop(now + duration + .02);
  }

  function stopTones() {
    state.activeTones.forEach((oscillator) => {
      try { oscillator.stop(); } catch (error) { /* Already stopped. */ }
    });
    state.activeTones.clear();
  }

  function startMusic() {
    if (!state.musicEnabled || state.screen !== 'game' || state.paused || state.musicNodes) return;
    const context = audioContext();
    if (!context) return;
    resumeAudio();
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    const oscillators = [55, 82.41, 110].map((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index === 2 ? 7 : -4;
      gain.gain.value = index === 0 ? .48 : .25;
      oscillator.connect(gain);
      gain.connect(filter);
      oscillator.start();
      return oscillator;
    });
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 1.4;
    lfo.frequency.value = .075;
    lfoGain.gain.value = 190;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    filter.connect(master);
    master.connect(context.destination);
    master.gain.setValueAtTime(.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(.028, context.currentTime + 1.2);
    lfo.start();
    state.musicNodes = { master, filter, lfo, lfoGain, oscillators };
  }

  function stopMusic() {
    if (!state.musicNodes) return;
    const { master, filter, lfo, lfoGain, oscillators } = state.musicNodes;
    state.musicNodes = null;
    oscillators.forEach((oscillator) => {
      try { oscillator.stop(); } catch (error) { /* Already stopped. */ }
      oscillator.disconnect();
    });
    try { lfo.stop(); } catch (error) { /* Already stopped. */ }
    lfo.disconnect();
    lfoGain.disconnect();
    filter.disconnect();
    master.disconnect();
  }

  function playbackSpeed() {
    const config = MODES[state.mode];
    return Math.max(config.minimumSpeed, config.baseSpeed - ((state.sequence.length - 1) * config.speedStep));
  }

  function flashTile(index, source, duration) {
    const tile = tiles[index];
    const oldTimer = Number(tile.dataset.flashTimer);
    if (oldTimer) cancelTimer(oldTimer);
    tile.classList.remove('is-system', 'is-player', 'is-correct', 'is-wrong');
    void tile.offsetWidth;
    tile.classList.add(`is-${source}`);
    const timerId = schedule(() => {
      tile.classList.remove(`is-${source}`);
      delete tile.dataset.flashTimer;
    }, duration);
    tile.dataset.flashTimer = String(timerId);
  }

  function playSequence() {
    if (state.screen !== 'game') return;
    state.playerIndex = 0;
    renderHud();
    const speed = playbackSpeed();
    const lightDuration = Math.max(105, Math.round(speed * .62));
    const speedDetail = state.mode === 'speed' ? `Shock interval: ${speed} ms. Input is locked.` : 'Input is locked during playback.';
    setStatus('system', 'Observe the signal', speedDetail);

    let position = 0;
    const showNext = () => {
      if (position >= state.sequence.length) {
        if (state.sequence.length > state.records.longest) {
          state.records.longest = state.sequence.length;
          state.runSetRecord = true;
          persistRecords();
          renderHud();
          recordBurst();
        }
        schedule(() => {
          setStatus('player', 'Return the sequence', 'Repeat every pulse in the exact order.');
        }, Math.max(130, speed * .35));
        return;
      }
      const tileIndex = state.sequence[position];
      flashTile(tileIndex, 'system', lightDuration);
      playTone(TILE_FREQUENCIES[tileIndex], Math.min(.22, lightDuration / 1000), .045, 'sine');
      position += 1;
      schedule(showNext, speed);
    };
    schedule(showNext, 520);
  }

  function addRound() {
    state.sequence.push(Math.floor(Math.random() * 9));
    renderHud();
    playSequence();
  }

  function recordBurst() {
    const layer = $('#record-effects');
    layer.replaceChildren();
    if (state.screen !== 'gameover' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#9d6cff', '#55e8ff', '#ff5fb9', '#77ffbf'];
    for (let index = 0; index < 24; index += 1) {
      const spark = document.createElement('i');
      const angle = (Math.PI * 2 * index) / 24 + (Math.random() * .25);
      const distance = 110 + Math.random() * 220;
      spark.className = 'record-spark';
      spark.style.setProperty('--x', `${Math.cos(angle) * distance}px`);
      spark.style.setProperty('--y', `${Math.sin(angle) * distance}px`);
      spark.style.setProperty('--angle', `${Math.round(Math.random() * 180)}deg`);
      spark.style.setProperty('--spark', colors[index % colors.length]);
      layer.appendChild(spark);
    }
    schedule(() => layer.replaceChildren(), 1100);
  }

  function completeRound() {
    state.completedRounds = state.sequence.length;
    const previousBest = state.records.bestByMode[state.mode];
    if (state.completedRounds > previousBest) {
      state.records.bestByMode[state.mode] = state.completedRounds;
      state.runSetRecord = true;
      persistRecords();
      recordBurst();
      playTone(987.77, .22, .06, 'triangle');
    } else {
      playTone(783.99, .17, .05, 'triangle');
    }
    renderHud();
    gameScreen.classList.remove('is-round-reveal');
    void gameScreen.offsetWidth;
    gameScreen.classList.add('is-round-reveal');
    setStatus('system', 'Sequence synchronized', 'A new pulse is joining the chain.');
    schedule(() => gameScreen.classList.remove('is-round-reveal'), 760);
    schedule(addRound, 850);
  }

  function handleMistake(tileIndex) {
    state.mistakes += 1;
    state.lives -= 1;
    tiles[tileIndex].classList.add('is-wrong');
    playTone(108, .32, .075, 'sawtooth');
    renderHud();
    setStatus('system', 'Sequence mismatch', state.lives > 0 ? `${state.lives} ${state.lives === 1 ? 'life' : 'lives'} remaining. Replaying signal.` : 'The neural link has dropped.');

    if (state.lives <= 0) {
      schedule(() => endGame('The grid caught the mismatch. Recalibrate and go again.'), 720);
      return;
    }
    schedule(() => {
      tiles[tileIndex].classList.remove('is-wrong');
      playSequence();
    }, 900);
  }

  function handleTileInput(tileIndex) {
    if (state.screen !== 'game' || state.paused || state.turn !== 'player') return;
    state.totalInputs += 1;
    playTone(TILE_FREQUENCIES[tileIndex], .15, .06, 'triangle');

    if (tileIndex !== state.sequence[state.playerIndex]) {
      handleMistake(tileIndex);
      return;
    }

    flashTile(tileIndex, 'correct', 210);
    state.correctInputs += 1;
    state.playerIndex += 1;
    renderHud();
    if (state.playerIndex === state.sequence.length) completeRound();
  }

  function resetRun() {
    clearTimers();
    $('#record-effects').replaceChildren();
    state.sequence = [];
    state.playerIndex = 0;
    state.completedRounds = 0;
    state.lives = MODES[state.mode].lives;
    state.mistakes = 0;
    state.correctInputs = 0;
    state.totalInputs = 0;
    state.turn = 'system';
    state.paused = false;
    state.runSetRecord = false;
  }

  function startGame() {
    if (!howToModal.hidden) closeHowTo(false);
    const name = $('#player-name').value.trim();
    if (!name) {
      $('#name-error').textContent = 'Enter a player name to initialize the sequence.';
      $('#player-name').focus();
      return;
    }
    $('#name-error').textContent = '';
    state.playerName = name.slice(0, 20);
    state.mode = selectedMode();
    storageSet(STORAGE.name, state.playerName);
    resetRun();
    state.screen = 'game';
    state.records.runs += 1;
    persistRecords();
    menuScreen.hidden = true;
    gameScreen.hidden = false;
    gameoverModal.hidden = true;
    pauseModal.hidden = true;
    isolateModal();
    $('#hud-name').textContent = state.playerName;
    $('#mode-badge').textContent = MODES[state.mode].label;
    $('#lives-hud').hidden = state.mode !== 'lives';
    updatePauseButton();
    audioContext();
    resumeAudio();
    startMusic();
    renderHud();
    setStatus('system', 'Link established', 'The first signal is calibrating.');
    gameScreen.focus({ preventScroll: true });
    schedule(addRound, 650);
  }

  function endGame(message) {
    if (state.screen !== 'game') return;
    clearTimers();
    stopMusic();
    state.screen = 'gameover';
    state.paused = false;
    updatePauseButton();
    $('#record-effects').replaceChildren();
    $('#gameover-copy').textContent = message;
    $('#record-banner').hidden = !state.runSetRecord;
    $('#result-round').textContent = state.completedRounds;
    $('#result-accuracy').textContent = `${accuracy()}%`;
    $('#result-mistakes').textContent = state.mistakes;
    $('#result-longest').textContent = state.records.longest;
    gameoverModal.hidden = false;
    isolateModal(gameoverModal);
    if (state.runSetRecord) recordBurst();
    $('#replay-button').focus();
  }

  function goToMenu() {
    clearTimers();
    stopMusic();
    stopTones();
    state.paused = false;
    state.screen = 'menu';
    gameScreen.hidden = true;
    gameoverModal.hidden = true;
    pauseModal.hidden = true;
    menuScreen.hidden = false;
    isolateModal();
    renderMenuRecords();
    $('#play-button').focus();
  }

  function pauseGame(reason = 'Your place is safe. Resume when your focus is back.', focusModal = true) {
    if (state.screen !== 'game' || state.paused) return;
    state.paused = true;
    pauseTimers();
    stopTones();
    if (state.audioContext?.state === 'running') state.audioContext.suspend().catch(() => {});
    tiles.forEach((tile) => { tile.disabled = true; });
    $('#pause-reason').textContent = reason;
    updatePauseButton();
    pauseModal.hidden = false;
    isolateModal(pauseModal);
    if (focusModal) $('#resume-button').focus();
  }

  function resumeGame() {
    if (state.screen !== 'game' || !state.paused) return;
    state.paused = false;
    pauseModal.hidden = true;
    isolateModal();
    updatePauseButton();
    resumeAudio();
    startMusic();
    resumeTimers();
    const enabled = state.turn === 'player';
    tiles.forEach((tile) => { tile.disabled = !enabled; });
    $('#pause-button').focus();
  }

  function togglePause() {
    if (state.paused) resumeGame();
    else pauseGame();
  }

  function openHowTo() {
    howToReturnFocus = document.activeElement;
    howToModal.hidden = false;
    isolateModal(howToModal);
    howToModal.querySelector('[data-close-how-to]').focus();
  }

  function closeHowTo(restoreFocus = true) {
    howToModal.hidden = true;
    isolateModal();
    if (restoreFocus && howToReturnFocus?.isConnected) howToReturnFocus.focus();
    howToReturnFocus = null;
  }

  $$('.mode-card input').forEach((input) => {
    input.addEventListener('change', () => {
      $$('.mode-card').forEach((card) => card.classList.toggle('selected', card.dataset.modeCard === input.value));
      renderMenuRecords();
    });
  });

  tiles.forEach((tile) => tile.addEventListener('click', () => handleTileInput(Number(tile.dataset.tile))));
  $('#play-button').addEventListener('click', startGame);
  $('#replay-button').addEventListener('click', startGame);
  $('#menu-button').addEventListener('click', goToMenu);
  $('#pause-menu-button').addEventListener('click', goToMenu);
  $('#pause-button').addEventListener('click', togglePause);
  $('#resume-button').addEventListener('click', resumeGame);
  $('#how-to-button').addEventListener('click', openHowTo);
  $$('[data-close-how-to]').forEach((button) => button.addEventListener('click', () => closeHowTo()));
  howToModal.addEventListener('click', (event) => { if (event.target === howToModal) closeHowTo(); });

  $('#sound-toggle').addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    storageSet(STORAGE.sound, state.soundEnabled ? 'on' : 'off');
    if (!state.soundEnabled) stopTones();
    updateAudioControls();
  });

  $('#music-toggle').addEventListener('click', () => {
    state.musicEnabled = !state.musicEnabled;
    storageSet(STORAGE.music, state.musicEnabled ? 'on' : 'off');
    if (state.musicEnabled && state.screen === 'game' && !state.paused) startMusic();
    else stopMusic();
    updateAudioControls();
  });

  $('#player-name').addEventListener('input', () => { $('#name-error').textContent = ''; });
  $('#player-name').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') startGame();
  });

  document.addEventListener('keydown', (event) => {
    if (event.repeat && (event.key.toLowerCase() === 'p' || event.key === 'Escape')) {
      event.preventDefault();
      return;
    }
    const modal = visibleModal();
    if (modal) trapModalFocus(event, modal);
    if (!howToModal.hidden && event.key === 'Escape') {
      event.preventDefault();
      closeHowTo();
      return;
    }
    if (state.screen === 'game' && (event.key.toLowerCase() === 'p' || event.key === 'Escape')) {
      event.preventDefault();
      togglePause();
      return;
    }
    if (state.screen === 'game' && !state.paused && /^[1-9]$/.test(event.key) && !event.repeat) {
      event.preventDefault();
      handleTileInput(Number(event.key) - 1);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'game' && !state.paused) {
      pauseGame('The tab lost focus, so the sequence was paused automatically.', false);
    }
  });

  window.addEventListener('blur', () => {
    if (state.screen === 'game' && !state.paused) {
      pauseGame('The window lost focus, so the sequence was paused automatically.', false);
    }
  });

  window.addEventListener('pagehide', () => {
    if (state.screen === 'game' && !state.paused) {
      pauseGame('The page was suspended, so the sequence was paused safely.', false);
    }
    stopTones();
  });

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    if (state.screen === 'game') {
      if (!state.paused) pauseGame('The page was restored, so the sequence was paused safely.', false);
      pauseModal.hidden = false;
      updatePauseButton();
      isolateModal(pauseModal);
      $('#resume-button').focus();
    } else if (state.screen === 'gameover') {
      gameoverModal.hidden = false;
      isolateModal(gameoverModal);
      $('#replay-button').focus();
    } else if (!howToModal.hidden) {
      isolateModal(howToModal);
      howToModal.querySelector('[data-close-how-to]').focus();
    } else {
      isolateModal();
    }
  });

  $('#player-name').value = state.playerName;
  updateAudioControls();
  renderMenuRecords();
})();
