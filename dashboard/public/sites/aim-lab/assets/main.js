'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const STORAGE_PREFIX = 'legendary_aim_lab_';
const MIN_VALID_REACTION_MS = 100;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const STORAGE = {
  profile: `${STORAGE_PREFIX}profile`,
  records: `${STORAGE_PREFIX}records`,
  settings: `${STORAGE_PREFIX}settings`
};

const MODES = {
  rush: { name: 'RUSH', index: '01', duration: 30, targetSize: 64, hitScore: 100, missPenalty: 25 },
  precision: { name: 'PRECISION', index: '02', duration: 30, targetSize: 39, hitScore: 150, missPenalty: 180 },
  tiny: { name: 'TINY', index: '03', duration: 30, targetSize: 62, hitScore: 125, missPenalty: 60 },
  reaction: { name: 'REACTION', index: '04', rounds: 10, targetSize: 68, hitScore: 200, missPenalty: 150 }
};

function readStored(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    // The game remains fully playable when storage is blocked or full.
  }
}

const savedProfile = readStored(STORAGE.profile, {});
const savedRecords = readStored(STORAGE.records, {});
const savedSettings = readStored(STORAGE.settings, {});

const state = {
  screen: 'menu',
  selectedMode: 'rush',
  phase: 'idle',
  running: false,
  paused: false,
  autoPaused: false,
  name: typeof savedProfile.name === 'string' ? savedProfile.name.slice(0, 18) : '',
  totalRuns: Number.isFinite(savedProfile.totalRuns) ? Math.max(0, savedProfile.totalRuns) : 0,
  records: Object.fromEntries(Object.keys(MODES).map((key) => [key, Number.isFinite(savedRecords[key]) ? Math.max(0, savedRecords[key]) : 0])),
  soundEnabled: savedSettings.sound !== false,
  musicEnabled: savedSettings.music !== false,
  score: 0,
  hits: 0,
  misses: 0,
  streak: 0,
  bestStreak: 0,
  reactions: [],
  targetShownAt: 0,
  targetVisible: false,
  reactionWaiting: false,
  reactionCompleted: 0,
  startedAt: 0,
  pauseStartedAt: 0,
  totalPausedMs: 0,
  remainingMs: 30000,
  reactionRemainingMs: 0,
  reactionDueAt: 0,
  targetTimer: 0,
  frameId: 0,
  messageTimer: 0,
  flashTimer: 0,
  lastFrameSecond: -1,
  audio: null,
  musicTimer: 0,
  musicStep: 0,
  musicNodes: new Set(),
  sfxNodes: new Set()
};

const elements = {
  menu: $('#menu-screen'),
  game: $('#game-screen'),
  name: $('#player-name'),
  nameStatus: $('#name-status'),
  modeGrid: $('#mode-grid'),
  play: $('#play-button'),
  playLabel: $('#play-mode-label'),
  brand: $('#brand-button'),
  sound: $('#sound-toggle'),
  music: $('#music-toggle'),
  careerBest: $('#career-best'),
  careerRuns: $('#career-rounds'),
  arena: $('#arena'),
  target: $('#target'),
  reactionWait: $('#reaction-wait'),
  effects: $('#effects-layer'),
  centerMessage: $('#center-message'),
  timer: $('#timer-value'),
  timerBar: $('#timer-bar'),
  progressLabel: $('#progress-label'),
  roundProgress: $('#round-progress'),
  statScore: $('#stat-score'),
  statHits: $('#stat-hits'),
  statMisses: $('#stat-misses'),
  statAccuracy: $('#stat-accuracy'),
  statStreak: $('#stat-streak'),
  lastReaction: $('#last-reaction'),
  liveAverage: $('#live-average'),
  gameModeIndex: $('#game-mode-index'),
  gameModeName: $('#game-mode-name'),
  howTo: $('#how-to-modal'),
  pauseModal: $('#pause-modal'),
  gameover: $('#gameover-modal')
};

function persistProfile() {
  writeStored(STORAGE.profile, { name: state.name, totalRuns: state.totalRuns });
}

function persistSettings() {
  writeStored(STORAGE.settings, { sound: state.soundEnabled, music: state.musicEnabled });
}

function persistRecords() {
  writeStored(STORAGE.records, state.records);
}

function cleanName(value) {
  return value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);
}

function syncName() {
  state.name = cleanName(elements.name.value);
  elements.name.value = state.name;
  elements.nameStatus.textContent = state.name ? 'SAVED' : 'READY';
  persistProfile();
}

function accuracy() {
  const attempts = state.hits + state.misses;
  return attempts ? Math.round((state.hits / attempts) * 100) : 0;
}

function averageReaction() {
  if (!state.reactions.length) return 0;
  return Math.round(state.reactions.reduce((sum, value) => sum + value, 0) / state.reactions.length);
}

function fastestReaction() {
  return state.reactions.length ? Math.min(...state.reactions) : 0;
}

function updateMenu() {
  const topScore = Math.max(0, ...Object.values(state.records));
  elements.careerBest.textContent = topScore.toLocaleString();
  elements.careerRuns.textContent = state.totalRuns.toLocaleString();
  elements.playLabel.textContent = MODES[state.selectedMode].name;
  $$('[data-record]').forEach((node) => {
    node.textContent = `BEST ${state.records[node.dataset.record].toLocaleString()}`;
  });
  $$('.mode-card').forEach((card) => {
    const selected = card.dataset.mode === state.selectedMode;
    card.classList.toggle('selected', selected);
    card.setAttribute('aria-pressed', String(selected));
  });
  document.body.dataset.mode = state.selectedMode;
}

function updateAudioButtons() {
  elements.sound.setAttribute('aria-pressed', String(state.soundEnabled));
  elements.music.setAttribute('aria-pressed', String(state.musicEnabled));
  $('b', elements.sound).textContent = state.soundEnabled ? 'ON' : 'OFF';
  $('b', elements.music).textContent = state.musicEnabled ? 'ON' : 'OFF';
}

function setScreen(screen) {
  state.screen = screen;
  document.body.dataset.screen = screen;
  elements.menu.classList.toggle('active', screen === 'menu');
  elements.game.classList.toggle('active', screen === 'game');
}

function openModal(modal) {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function initAudio() {
  if (!state.soundEnabled && !state.musicEnabled) return null;
  if (!state.audio) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    state.audio = new AudioContext();
  }
  if (state.audio.state === 'suspended') state.audio.resume().catch(() => {});
  return state.audio;
}

function makeTone(frequency, duration, options = {}) {
  const audio = initAudio();
  if (!audio) return null;
  const now = audio.currentTime + (options.delay || 0);
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = options.type || 'sine';
  oscillator.frequency.setValueAtTime(frequency, now);
  if (options.slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.slide), now + duration);
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(options.volume || .035, now + .012);
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  state.sfxNodes.add(oscillator);
  oscillator.onended = () => {
    state.sfxNodes.delete(oscillator);
    try { oscillator.disconnect(); } catch (_) { /* Disconnection is best effort. */ }
    try { gain.disconnect(); } catch (_) { /* Disconnection is best effort. */ }
  };
  oscillator.start(now);
  oscillator.stop(now + duration + .02);
  return oscillator;
}

function stopSfx() {
  state.sfxNodes.forEach((node) => {
    try { node.stop(); } catch (_) { /* Node may already be stopped. */ }
    try { node.disconnect(); } catch (_) { /* Disconnection is best effort. */ }
  });
  state.sfxNodes.clear();
}

function playSfx(type) {
  if (!state.soundEnabled) return;
  if (type === 'hit') {
    makeTone(720, .055, { volume: .045, type: 'square', slide: 980 });
    makeTone(1180, .04, { delay: .025, volume: .025, type: 'sine' });
  } else if (type === 'miss') {
    makeTone(175, .12, { volume: .055, type: 'sawtooth', slide: 90 });
  } else if (type === 'start') {
    makeTone(330, .08, { volume: .04, type: 'square', slide: 460 });
    makeTone(620, .1, { delay: .09, volume: .045, type: 'square', slide: 820 });
  } else if (type === 'signal') {
    makeTone(880, .08, { volume: .055, type: 'triangle', slide: 1320 });
  } else if (type === 'record') {
    [620, 820, 1040, 1320].forEach((note, index) => makeTone(note, .16, { delay: index * .085, volume: .045, type: 'triangle' }));
  } else if (type === 'finish') {
    makeTone(480, .12, { volume: .035, type: 'triangle' });
    makeTone(720, .18, { delay: .1, volume: .04, type: 'triangle' });
  }
}

function stopMusic() {
  clearInterval(state.musicTimer);
  state.musicTimer = 0;
  state.musicNodes.forEach((node) => {
    try { node.stop(); } catch (_) { /* Node may already be stopped. */ }
    try { node.disconnect(); } catch (_) { /* Disconnection is best effort. */ }
  });
  state.musicNodes.clear();
}

function scheduleMusicBeat() {
  if (!state.running || state.paused || !state.musicEnabled || document.hidden) return;
  const audio = initAudio();
  if (!audio) return;
  const step = state.musicStep++ % 16;
  const bassNotes = [55, 55, 65.41, 49, 55, 73.42, 65.41, 49];
  const now = audio.currentTime;

  const createVoice = (frequency, duration, volume, type, filterFrequency) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const filter = audio.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFrequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    state.musicNodes.add(oscillator);
    oscillator.onended = () => state.musicNodes.delete(oscillator);
    oscillator.start(now);
    oscillator.stop(now + duration);
  };

  createVoice(bassNotes[Math.floor(step / 2)], .2, step % 2 ? .018 : .032, 'sawtooth', 240);
  if (step % 4 === 0) createVoice(55, .1, .045, 'sine', 130);
  if (step % 2 === 1) createVoice(2200, .035, .009, 'square', 3600);
  if (step === 6 || step === 14) createVoice(110, .08, .018, 'triangle', 700);
}

function startMusic() {
  stopMusic();
  if (!state.running || state.paused || !state.musicEnabled || document.hidden) return;
  state.musicStep = 0;
  scheduleMusicBeat();
  state.musicTimer = window.setInterval(scheduleMusicBeat, 150);
}

function clearGameTimers() {
  clearTimeout(state.targetTimer);
  state.targetTimer = 0;
  clearTimeout(state.messageTimer);
  state.messageTimer = 0;
  clearTimeout(state.flashTimer);
  state.flashTimer = 0;
  elements.arena.classList.remove('flash-hit', 'flash-miss');
  cancelAnimationFrame(state.frameId);
  state.frameId = 0;
}

function clearEffects() {
  elements.effects.replaceChildren();
  elements.centerMessage.textContent = '';
  elements.centerMessage.className = 'center-message';
}

function cleanupGame() {
  state.running = false;
  state.paused = false;
  state.autoPaused = false;
  state.targetVisible = false;
  state.reactionWaiting = false;
  clearGameTimers();
  stopMusic();
  stopSfx();
  elements.target.hidden = true;
  elements.reactionWait.hidden = true;
  clearEffects();
}

function targetBounds(size) {
  const rect = elements.arena.getBoundingClientRect();
  const radius = size / 2;
  const safe = Math.max(10, Math.min(22, rect.width * .03));
  const minX = radius + safe;
  const maxX = Math.max(minX, rect.width - radius - safe);
  const minY = radius + safe;
  const maxY = Math.max(minY, rect.height - radius - safe);
  return { minX, maxX, minY, maxY };
}

function randomTargetPosition(size) {
  const { minX, maxX, minY, maxY } = targetBounds(size);
  return {
    x: minX + Math.random() * (maxX - minX),
    y: minY + Math.random() * (maxY - minY)
  };
}

function repositionActiveTarget() {
  if (!state.running || !state.targetVisible) return;
  const size = currentTargetSize();
  const bounds = targetBounds(size);
  const currentX = Number.parseFloat(elements.target.style.left);
  const currentY = Number.parseFloat(elements.target.style.top);
  const fallback = randomTargetPosition(size);
  const x = Number.isFinite(currentX) ? Math.min(bounds.maxX, Math.max(bounds.minX, currentX)) : fallback.x;
  const y = Number.isFinite(currentY) ? Math.min(bounds.maxY, Math.max(bounds.minY, currentY)) : fallback.y;
  elements.target.style.left = `${x}px`;
  elements.target.style.top = `${y}px`;
}

function currentTargetSize() {
  const mode = MODES[state.selectedMode];
  if (state.selectedMode !== 'tiny') return mode.targetSize;
  return Math.max(22, mode.targetSize - Math.floor(state.hits / 3) * 4);
}

function showTarget() {
  if (!state.running || state.paused) return;
  const size = currentTargetSize();
  const position = randomTargetPosition(size);
  elements.target.style.setProperty('--size', `${size}px`);
  elements.target.style.left = `${position.x}px`;
  elements.target.style.top = `${position.y}px`;
  elements.target.classList.toggle('reaction-target', state.selectedMode === 'reaction');
  elements.target.hidden = false;
  elements.reactionWait.hidden = true;
  state.targetVisible = true;
  state.reactionWaiting = false;
  state.targetShownAt = performance.now();
  elements.target.focus({ preventScroll: true });
  if (state.selectedMode === 'reaction') playSfx('signal');
}

function queueReactionTarget(delayOverride) {
  if (!state.running || state.paused) return;
  clearTimeout(state.targetTimer);
  elements.target.hidden = true;
  elements.reactionWait.hidden = false;
  state.targetVisible = false;
  state.reactionWaiting = true;
  const delay = Number.isFinite(delayOverride) ? delayOverride : 850 + Math.random() * 2200;
  state.reactionDueAt = performance.now() + delay;
  state.targetTimer = window.setTimeout(showTarget, delay);
}

function updateStats() {
  elements.statScore.textContent = Math.max(0, Math.round(state.score)).toLocaleString();
  elements.statHits.textContent = state.hits;
  elements.statMisses.textContent = state.misses;
  elements.statAccuracy.textContent = `${accuracy()}%`;
  elements.statStreak.textContent = state.streak;
  const last = state.reactions.at(-1);
  elements.lastReaction.textContent = last ? `${last}ms` : '--';
  const average = averageReaction();
  elements.liveAverage.textContent = average ? `${average}ms` : '--';
}

function showCenterMessage(text, bad = false) {
  clearTimeout(state.messageTimer);
  elements.centerMessage.textContent = text;
  elements.centerMessage.className = `center-message pop${bad ? ' bad' : ''}`;
  state.messageTimer = window.setTimeout(() => {
    elements.centerMessage.textContent = '';
    elements.centerMessage.className = 'center-message';
  }, 560);
}

function pulseArena(className) {
  clearTimeout(state.flashTimer);
  elements.arena.classList.remove('flash-hit', 'flash-miss');
  void elements.arena.offsetWidth;
  elements.arena.classList.add(className);
  state.flashTimer = window.setTimeout(() => {
    elements.arena.classList.remove(className);
    state.flashTimer = 0;
  }, 220);
}

function spawnHitEffect(x, y, scoreGain, reaction) {
  const existing = $$('.hit-particle, .combo-float', elements.effects);
  existing.slice(0, Math.max(0, existing.length - 34)).forEach((node) => node.remove());
  const particleCount = reducedMotion.matches ? 3 : 12;
  for (let index = 0; index < particleCount; index += 1) {
    const angle = (Math.PI * 2 * index) / particleCount + Math.random() * .22;
    const distance = 22 + Math.random() * 35;
    const particle = document.createElement('i');
    particle.className = 'hit-particle';
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    elements.effects.appendChild(particle);
    particle.addEventListener('animationend', () => particle.remove(), { once: true });
  }
  const combo = document.createElement('b');
  combo.className = 'combo-float';
  combo.style.left = `${Math.min(elements.arena.clientWidth - 116, x + 16)}px`;
  combo.style.top = `${Math.max(24, y - 10)}px`;
  combo.innerHTML = `<strong>+${scoreGain}</strong><span>${reaction}MS${state.streak >= 3 ? ` // ${state.streak}X` : ''}</span>`;
  elements.effects.appendChild(combo);
  combo.addEventListener('animationend', () => combo.remove(), { once: true });
  if (state.streak >= 3) {
    elements.statStreak.closest('div').classList.remove('stat-kick');
    void elements.statStreak.offsetWidth;
    elements.statStreak.closest('div').classList.add('stat-kick');
  }
}

function timedRunExpired(now = performance.now()) {
  if (!state.running || state.selectedMode === 'reaction') return false;
  const mode = MODES[state.selectedMode];
  if (now - state.startedAt - state.totalPausedMs < mode.duration * 1000) return false;
  state.remainingMs = 0;
  finishGame();
  return true;
}

function registerMiss(reason = 'MISS') {
  if (!state.running || state.paused) return;
  if (timedRunExpired()) return;
  const mode = MODES[state.selectedMode];
  state.misses += 1;
  state.streak = 0;
  state.score = Math.max(0, state.score - mode.missPenalty);
  playSfx('miss');
  pulseArena('flash-miss');
  showCenterMessage(reason, true);
  updateStats();
}

function registerTargetHit(event) {
  if (!state.running || state.paused || !state.targetVisible) return;
  const now = performance.now();
  if (timedRunExpired(now)) return;
  event.preventDefault();
  event.stopPropagation();
  const reaction = Math.max(1, Math.round(now - state.targetShownAt));
  if (state.selectedMode === 'reaction' && reaction < MIN_VALID_REACTION_MS) {
    state.targetVisible = false;
    elements.target.hidden = true;
    registerMiss('TOO EARLY');
    queueReactionTarget(1200 + Math.random() * 1800);
    return;
  }
  const mode = MODES[state.selectedMode];
  const rect = elements.arena.getBoundingClientRect();
  const targetRect = elements.target.getBoundingClientRect();
  const x = Number.isFinite(event.clientX) ? event.clientX - rect.left : targetRect.left + targetRect.width / 2 - rect.left;
  const y = Number.isFinite(event.clientY) ? event.clientY - rect.top : targetRect.top + targetRect.height / 2 - rect.top;
  state.hits += 1;
  state.streak += 1;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  state.reactions.push(reaction);
  const scoreGain = mode.hitScore + Math.max(0, Math.round((650 - reaction) / 8)) + Math.min(100, state.streak * 4);
  state.score += scoreGain;
  state.targetVisible = false;
  elements.target.hidden = true;
  playSfx('hit');
  pulseArena('flash-hit');
  spawnHitEffect(x, y, scoreGain, reaction);

  if (state.selectedMode === 'reaction') {
    state.reactionCompleted += 1;
    updateStats();
    if (state.reactionCompleted >= mode.rounds) {
      finishGame();
    } else {
      queueReactionTarget();
    }
  } else {
    showTarget();
    updateStats();
  }
}

function handleTargetPointer(event) {
  if (!event.isTrusted || event.button !== 0 || event.isPrimary === false) return;
  registerTargetHit(event);
}

function handleTargetKeydown(event) {
  if (!event.isTrusted || event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
  registerTargetHit(event);
}

function handleArenaPress(event) {
  if (!state.running || state.paused || !event.isTrusted || event.button !== 0 || event.isPrimary === false) return;
  if (timedRunExpired()) return;
  event.preventDefault();
  if (event.target === elements.target || elements.target.contains(event.target)) return;

  if (state.selectedMode === 'reaction' && state.reactionWaiting) {
    registerMiss('FALSE START');
    queueReactionTarget(1200 + Math.random() * 1800);
    return;
  }
  registerMiss();
}

function renderClock(now) {
  if (!state.running || state.paused) return;
  const mode = MODES[state.selectedMode];
  if (state.selectedMode === 'reaction') {
    const complete = state.reactionCompleted;
    elements.timer.textContent = `${complete}/${mode.rounds}`;
    elements.timerBar.style.transform = `scaleX(${Math.max(0, 1 - complete / mode.rounds)})`;
    elements.progressLabel.textContent = `${complete} / ${mode.rounds} SIGNALS`;
  } else {
    const elapsed = now - state.startedAt - state.totalPausedMs;
    state.remainingMs = Math.max(0, mode.duration * 1000 - elapsed);
    elements.timer.textContent = (state.remainingMs / 1000).toFixed(1);
    elements.timerBar.style.transform = `scaleX(${state.remainingMs / (mode.duration * 1000)})`;
    elements.progressLabel.textContent = `${Math.min(mode.duration, Math.floor(elapsed / 1000))} / ${mode.duration} SEC`;
    if (state.remainingMs <= 0) {
      finishGame();
      return;
    }
  }
  state.frameId = requestAnimationFrame(renderClock);
}

function startGame() {
  syncName();
  closeModal(elements.howTo);
  closeModal(elements.pauseModal);
  closeModal(elements.gameover);
  cleanupGame();

  const mode = MODES[state.selectedMode];
  state.phase = 'playing';
  state.running = true;
  state.score = 0;
  state.hits = 0;
  state.misses = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.reactions = [];
  state.reactionCompleted = 0;
  state.totalPausedMs = 0;
  state.startedAt = performance.now();
  state.remainingMs = (mode.duration || 0) * 1000;
  state.lastFrameSecond = -1;
  elements.gameModeIndex.textContent = mode.index;
  elements.gameModeName.textContent = mode.name;
  elements.roundProgress.firstElementChild.textContent = state.selectedMode === 'reaction' ? 'PROGRESS' : 'ELAPSED';
  elements.timer.textContent = state.selectedMode === 'reaction' ? `0/${mode.rounds}` : mode.duration.toFixed(1);
  elements.timerBar.style.transform = 'scaleX(1)';
  elements.progressLabel.textContent = state.selectedMode === 'reaction' ? `0 / ${mode.rounds} SIGNALS` : `0 / ${mode.duration} SEC`;
  clearEffects();
  updateStats();
  setScreen('game');
  initAudio();
  playSfx('start');
  startMusic();
  if (state.selectedMode === 'reaction') queueReactionTarget(1100 + Math.random() * 1300);
  else showTarget();
  state.frameId = requestAnimationFrame(renderClock);
}

function gradeForRun() {
  if (!state.hits && !state.misses) return 'D';
  const rate = accuracy();
  const average = averageReaction();
  if (rate >= 94 && average && average < 360) return 'S';
  if (rate >= 88 && (!average || average < 500)) return 'A';
  if (rate >= 75) return 'B';
  if (rate >= 58) return 'C';
  return 'D';
}

function finishGame() {
  if (!state.running) return;
  const finalScore = Math.max(0, Math.round(state.score));
  const oldRecord = state.records[state.selectedMode] || 0;
  const isRecord = finalScore > oldRecord;
  state.running = false;
  state.phase = 'finished';
  clearGameTimers();
  stopMusic();
  stopSfx();
  elements.target.hidden = true;
  elements.reactionWait.hidden = true;
  state.targetVisible = false;
  state.totalRuns += 1;
  if (isRecord) {
    state.records[state.selectedMode] = finalScore;
    persistRecords();
  }
  persistProfile();
  updateMenu();

  $('#result-kicker').textContent = state.name ? `${state.name} // TRAINING COMPLETE` : 'TRAINING COMPLETE';
  $('#result-grade').textContent = gradeForRun();
  $('#final-score').textContent = finalScore.toLocaleString();
  $('#final-mode').textContent = `${MODES[state.selectedMode].name} DRILL`;
  $('#final-hits').textContent = state.hits;
  $('#final-misses').textContent = state.misses;
  $('#final-accuracy').textContent = `${accuracy()}%`;
  $('#final-average').textContent = averageReaction() ? `${averageReaction()} ms` : '--';
  $('#final-fastest').textContent = fastestReaction() ? `${fastestReaction()} ms` : '--';
  $('#final-streak').textContent = state.bestStreak;
  $('#record-banner').hidden = !isRecord;
  $('#record-score').textContent = finalScore.toLocaleString();
  $('#result-card').classList.toggle('is-record', isRecord);
  openModal(elements.gameover);
  playSfx(isRecord ? 'record' : 'finish');
}

function pauseGame(auto = false) {
  if (!state.running || state.paused) return;
  state.paused = true;
  state.autoPaused = auto;
  state.pauseStartedAt = performance.now();
  cancelAnimationFrame(state.frameId);
  state.frameId = 0;
  stopMusic();
  stopSfx();
  if (state.selectedMode === 'reaction' && state.reactionWaiting) {
    state.reactionRemainingMs = Math.max(200, state.reactionDueAt - performance.now());
    clearTimeout(state.targetTimer);
    state.targetTimer = 0;
  }
  openModal(elements.pauseModal);
}

function resumeGame() {
  if (!state.running || !state.paused) return;
  const pausedFor = performance.now() - state.pauseStartedAt;
  state.totalPausedMs += pausedFor;
  if (state.targetVisible) state.targetShownAt += pausedFor;
  state.paused = false;
  state.autoPaused = false;
  closeModal(elements.pauseModal);
  if (state.selectedMode === 'reaction' && state.reactionWaiting) queueReactionTarget(state.reactionRemainingMs || 500);
  else if (state.targetVisible) elements.target.focus({ preventScroll: true });
  startMusic();
  state.frameId = requestAnimationFrame(renderClock);
}

function returnToMenu() {
  cleanupGame();
  closeModal(elements.pauseModal);
  closeModal(elements.gameover);
  closeModal(elements.howTo);
  setScreen('menu');
  updateMenu();
}

elements.modeGrid.addEventListener('click', (event) => {
  const card = event.target.closest('[data-mode]');
  if (!card || !MODES[card.dataset.mode]) return;
  state.selectedMode = card.dataset.mode;
  updateMenu();
});

elements.name.addEventListener('change', syncName);
elements.name.addEventListener('blur', syncName);
elements.name.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    syncName();
    elements.name.blur();
  }
});

elements.play.addEventListener('click', startGame);
$('#how-to-button').addEventListener('click', () => openModal(elements.howTo));
$('#how-to-close').addEventListener('click', () => closeModal(elements.howTo));
$('#how-to-play').addEventListener('click', startGame);
$('#pause-button').addEventListener('click', () => pauseGame(false));
$('#resume-button').addEventListener('click', resumeGame);
$('#restart-button').addEventListener('click', startGame);
$('#pause-menu-button').addEventListener('click', returnToMenu);
$('#replay-button').addEventListener('click', startGame);
$('#result-menu-button').addEventListener('click', returnToMenu);
elements.brand.addEventListener('click', returnToMenu);
elements.target.addEventListener('pointerdown', handleTargetPointer);
elements.target.addEventListener('keydown', handleTargetKeydown);
elements.arena.addEventListener('pointerdown', handleArenaPress);
elements.arena.addEventListener('contextmenu', (event) => event.preventDefault());

elements.howTo.addEventListener('pointerdown', (event) => {
  if (event.target === elements.howTo) closeModal(elements.howTo);
});

elements.sound.addEventListener('click', () => {
  state.soundEnabled = !state.soundEnabled;
  if (!state.soundEnabled) stopSfx();
  persistSettings();
  updateAudioButtons();
  if (state.soundEnabled) playSfx('signal');
});

elements.music.addEventListener('click', () => {
  state.musicEnabled = !state.musicEnabled;
  persistSettings();
  updateAudioButtons();
  if (state.musicEnabled) startMusic();
  else stopMusic();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (elements.howTo.classList.contains('open')) closeModal(elements.howTo);
    else if (state.running && state.paused) resumeGame();
    else if (state.running) pauseGame(false);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state.running && !state.paused) pauseGame(true);
    else stopMusic();
  } else if (state.running && state.paused && state.autoPaused) {
    // Keep the visible pause panel; resuming remains an intentional player action.
    initAudio();
  }
});

window.addEventListener('pagehide', () => {
  if (state.running && !state.paused) pauseGame(true);
  clearGameTimers();
  stopMusic();
  stopSfx();
});

window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  clearGameTimers();
  stopMusic();
  stopSfx();
  if (!state.running) return;
  if (!state.paused) {
    state.paused = true;
    state.autoPaused = true;
    state.pauseStartedAt = performance.now();
    if (state.selectedMode === 'reaction' && state.reactionWaiting) {
      state.reactionRemainingMs = Math.max(200, state.reactionDueAt - performance.now());
    }
  }
  openModal(elements.pauseModal);
});

window.addEventListener('resize', repositionActiveTarget);
window.addEventListener('orientationchange', () => requestAnimationFrame(repositionActiveTarget));

elements.name.value = state.name;
updateAudioButtons();
updateMenu();
