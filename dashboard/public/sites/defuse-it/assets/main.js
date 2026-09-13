"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const STORAGE = {
  name: "legendary_defuse_name",
  bestScore: "legendary_defuse_best_score",
  bestStage: "legendary_defuse_best_stage",
  music: "legendary_defuse_music"
};

function safeRead(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (_) {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch (_) {
    // Storage can be unavailable in private or embedded browsing contexts.
  }
}

function savedNumber(key) {
  const parsed = Number.parseInt(safeRead(key, "0"), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

const els = {
  screens: $$(".screen"),
  menu: $("#menu-screen"),
  howto: $("#howto-screen"),
  game: $("#game-screen"),
  failure: $("#failure-screen"),
  success: $("#success-screen"),
  name: $("#operator-name"),
  nameHint: $("#name-hint"),
  menuBestScore: $("#menu-best-score"),
  menuBestStage: $("#menu-best-stage"),
  audioToggle: $("#audio-toggle"),
  audioIcon: $("#audio-icon"),
  audioLabel: $("#audio-label"),
  hudName: $("#hud-name"),
  stage: $("#stage-display"),
  modules: $("#module-display"),
  score: $("#score-display"),
  stability: $("#stability-fill"),
  kicker: $("#module-kicker"),
  title: $("#module-title"),
  rule: $("#module-rule"),
  board: $("#module-board"),
  feedback: $("#module-feedback"),
  timer: $("#timer-display"),
  timerRing: $("#timer-ring"),
  stageNote: $("#stage-note"),
  gameFrame: $(".game-frame"),
  pauseOverlay: $("#pause-overlay"),
  failureScore: $("#failure-score"),
  failureStage: $("#failure-stage"),
  failureModules: $("#failure-modules"),
  successScore: $("#success-score"),
  successName: $("#success-name"),
  recordNote: $("#record-note"),
  successCanvas: $("#success-canvas"),
  topbar: $(".topbar")
};

const state = {
  screen: "menu",
  playerName: safeRead(STORAGE.name, ""),
  bestScore: savedNumber(STORAGE.bestScore),
  bestStage: savedNumber(STORAGE.bestStage),
  audioEnabled: safeRead(STORAGE.music, "on") !== "off",
  running: false,
  paused: false,
  locked: false,
  transitioning: false,
  completed: 0,
  score: 0,
  stage: 1,
  module: null,
  moduleTypes: [],
  timeLimit: 0,
  timeLeft: 0,
  deadline: 0,
  pausedAt: 0,
  timerId: null,
  delays: new Set(),
  animationId: null,
  moduleToken: 0,
  focusBeforePause: null
};

const TOTAL_MODULES = 8;
const STAGE_NAMES = ["CALIBRATION", "RESONANCE", "PHASE SHIFT", "NOVA LOCK"];
const COLORS = [
  { name: "CYAN", hex: "#54e6ff" },
  { name: "VIOLET", hex: "#9d78ff" },
  { name: "AMBER", hex: "#ffd25e" },
  { name: "MINT", hex: "#28ffc6" },
  { name: "ROSE", hex: "#ff668a" }
];
const GLYPHS = ["<>", "//", "[]", "{}", "::", "=+", "#", "*", "@", "?", "~", "^", "%", "&"];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function showScreen(name) {
  state.screen = name;
  els.screens.forEach((screen) => {
    const active = screen.id === `${name}-screen`;
    screen.classList.toggle("active", active);
    screen.setAttribute("aria-hidden", String(!active));
  });
  window.scrollTo({ top: 0, behavior: "auto" });
  const focusTarget = $(`#${name}-screen [tabindex="-1"]`);
  if (focusTarget) focusTarget.focus({ preventScroll: true });
}

function setDelay(callback, delay) {
  const id = window.setTimeout(() => {
    state.delays.delete(id);
    callback();
  }, delay);
  state.delays.add(id);
  return id;
}

function clearDelays() {
  state.delays.forEach((id) => window.clearTimeout(id));
  state.delays.clear();
}

function stopTimer() {
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function clearRunActivity() {
  state.moduleToken += 1;
  stopTimer();
  clearDelays();
  if (state.animationId !== null) {
    window.cancelAnimationFrame(state.animationId);
    state.animationId = null;
  }
  audio.stopMusic();
  audio.stopTones();
}

const audio = {
  context: null,
  master: null,
  musicGain: null,
  musicTimer: null,
  activeTones: new Set(),
  step: 0,

  ensure() {
    if (!state.audioEnabled) return null;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") this.context.resume().catch(() => {});
    return this.context;
  },

  tone(frequency, duration = .1, volume = .045, type = "sine", slide = null, destination = null) {
    const context = this.ensure();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, slide), now + duration);
    gain.gain.setValueAtTime(Math.max(volume, .0001), now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(destination || this.master);
    this.activeTones.add(oscillator);
    oscillator.addEventListener("ended", () => {
      this.activeTones.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    }, { once: true });
    oscillator.start(now);
    oscillator.stop(now + duration + .02);
  },

  stopTones() {
    this.activeTones.forEach((oscillator) => {
      try { oscillator.stop(); } catch (_) { /* The oscillator may have just ended. */ }
    });
    this.activeTones.clear();
  },

  sfx(kind) {
    if (!state.audioEnabled) return;
    if (kind === "select") this.tone(430, .05, .025, "square", 510);
    if (kind === "correct") {
      this.tone(520, .1, .05, "triangle", 700);
      setDelay(() => this.tone(790, .16, .05, "sine", 1050), 70);
    }
    if (kind === "error") this.tone(170, .2, .055, "sawtooth", 76);
    if (kind === "stage") {
      [360, 520, 760].forEach((note, index) => setDelay(() => this.tone(note, .2, .045, "triangle", note * 1.15), index * 100));
    }
    if (kind === "success") {
      [392, 523, 659, 784].forEach((note, index) => setDelay(() => this.tone(note, .55, .05, "sine", note * 1.12), index * 135));
    }
  },

  startMusic() {
    if (!state.running || state.paused || !state.audioEnabled || this.musicTimer !== null) return;
    const context = this.ensure();
    if (!context) return;
    this.musicGain = context.createGain();
    this.musicGain.gain.value = .38;
    this.musicGain.connect(this.master);
    const bass = [73.42, 73.42, 87.31, 65.41, 73.42, 98, 87.31, 65.41];
    const pulse = () => {
      if (!state.running || state.paused || !state.audioEnabled || !this.musicGain) return;
      const root = bass[this.step % bass.length];
      this.tone(root, .32, .028, "sawtooth", root * .82, this.musicGain);
      if (this.step % 2 === 0) this.tone(root * 4, .08, .012, "square", root * 5, this.musicGain);
      if (this.step % 4 === 3) this.tone(root * 2.997, .42, .014, "sine", root * 3.2, this.musicGain);
      this.step += 1;
    };
    pulse();
    this.musicTimer = window.setInterval(pulse, 390);
  },

  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.musicGain) {
      try { this.musicGain.disconnect(); } catch (_) { /* Node may already be disconnected. */ }
      this.musicGain = null;
    }
  },

  shutdown() {
    this.stopMusic();
    this.stopTones();
    if (this.context) {
      this.context.close().catch(() => {});
      this.context = null;
      this.master = null;
    }
  }
};

function updateAudioButton() {
  els.audioToggle.setAttribute("aria-pressed", String(state.audioEnabled));
  els.audioToggle.setAttribute("aria-label", state.audioEnabled ? "Turn music and sound effects off" : "Turn music and sound effects on");
  els.audioIcon.textContent = state.audioEnabled ? "AUDIO" : "MUTED";
  els.audioLabel.textContent = state.audioEnabled ? "Music + SFX: On" : "Music + SFX: Off";
}

function toggleAudio() {
  state.audioEnabled = !state.audioEnabled;
  safeWrite(STORAGE.music, state.audioEnabled ? "on" : "off");
  updateAudioButton();
  if (state.audioEnabled) {
    audio.ensure();
    audio.sfx("select");
    audio.startMusic();
  } else {
    audio.stopMusic();
    audio.stopTones();
  }
}

function validateName() {
  const cleaned = els.name.value.trim().replace(/\s+/g, " ").slice(0, 18);
  if (!cleaned) {
    if (state.screen !== "menu") showScreen("menu");
    els.name.classList.add("invalid");
    els.nameHint.classList.add("error");
    els.nameHint.textContent = "Enter a callsign to initialize.";
    els.name.focus();
    setDelay(() => els.name.classList.remove("invalid"), 400);
    return false;
  }
  state.playerName = cleaned;
  els.name.value = cleaned;
  els.nameHint.classList.remove("error");
  els.nameHint.textContent = "Saved locally on this device.";
  safeWrite(STORAGE.name, cleaned);
  return true;
}

function makeRunOrder() {
  const all = ["color", "symbol", "number", "switch", "energy", "memory"];
  return [...shuffle(all), ...shuffle(all).slice(0, 2)];
}

function updateHud() {
  els.hudName.textContent = state.playerName.toUpperCase();
  els.stage.textContent = `${state.stage} / 4`;
  els.modules.textContent = `${state.completed} / ${TOTAL_MODULES}`;
  els.score.textContent = state.score.toLocaleString();
  els.stability.style.width = `${(state.completed / TOTAL_MODULES) * 100}%`;
  els.stability.parentElement.setAttribute("aria-valuenow", String(state.completed));
  els.stability.parentElement.setAttribute("aria-valuetext", `${state.completed} of ${TOTAL_MODULES} modules stabilized`);
  els.stageNote.textContent = `STAGE ${state.stage} // ${STAGE_NAMES[state.stage - 1]}`;
  els.gameFrame.dataset.stage = state.stage;
}

function startRun() {
  if (!validateName()) return;
  clearRunActivity();
  state.running = true;
  state.paused = false;
  state.locked = false;
  state.transitioning = false;
  state.completed = 0;
  state.score = 0;
  state.stage = 1;
  state.moduleTypes = makeRunOrder();
  els.pauseOverlay.classList.remove("open");
  els.pauseOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  els.game.inert = false;
  els.topbar.inert = false;
  showScreen("game");
  updateHud();
  audio.ensure();
  audio.startMusic();
  loadModule();
}

function moduleTime() {
  return [28, 25, 22, 20][state.stage - 1];
}

function loadModule() {
  if (!state.running) return;
  if (state.completed >= TOTAL_MODULES) {
    finishSuccess();
    return;
  }
  stopTimer();
  clearDelays();
  state.moduleToken += 1;
  state.locked = false;
  state.transitioning = false;
  state.stage = Math.min(4, Math.floor(state.completed / 2) + 1);
  state.timeLimit = moduleTime();
  state.timeLeft = state.timeLimit;
  els.feedback.textContent = "";
  els.feedback.className = "feedback";
  els.gameFrame.classList.remove("correct-flash", "error-flash");
  els.board.className = "module-board module-in";
  updateHud();
  const type = state.moduleTypes[state.completed];
  els.board.classList.add(`board--${type}`);
  const builders = { color: buildColorModule, symbol: buildSymbolModule, number: buildNumberModule, switch: buildSwitchModule, energy: buildEnergyModule, memory: buildMemoryModule };
  state.module = builders[type]();
  updateTimerDisplay();
  if (state.module.delayedStart) {
    state.locked = true;
    state.module.delayedStart(state.moduleToken);
  } else {
    startTimer();
  }
}

function startTimer() {
  stopTimer();
  if (!state.running || state.paused) return;
  state.deadline = performance.now() + state.timeLeft * 1000;
  state.timerId = window.setInterval(tickTimer, 100);
  tickTimer();
}

function tickTimer() {
  if (!state.running || state.paused) return;
  state.timeLeft = Math.max(0, (state.deadline - performance.now()) / 1000);
  updateTimerDisplay();
  if (state.timeLeft <= 0) failRun("TIME WINDOW LOST");
}

function updateTimerDisplay() {
  const shown = Math.max(0, Math.ceil(state.timeLeft));
  els.timer.textContent = shown.toString().padStart(2, "0");
  els.timerRing.setAttribute("aria-label", `${shown} seconds remaining`);
  els.timerRing.style.setProperty("--progress", `${Math.max(0, state.timeLeft / state.timeLimit)}turn`);
  els.timerRing.classList.toggle("urgent", state.timeLeft <= 6);
  els.gameFrame.classList.toggle("timer-urgent", state.timeLeft <= 6 && state.running);
}

function chooseAnswer(value) {
  if (!state.running || state.paused || state.locked || !state.module) return;
  if (state.module.onChoose) {
    state.module.onChoose(value);
    return;
  }
  if (String(value) === String(state.module.answer)) completeModule();
  else failRun("SIGNAL MISMATCH");
}

function completeModule() {
  if (state.locked || !state.running) return;
  state.locked = true;
  state.transitioning = true;
  stopTimer();
  const speedRatio = Math.max(0, state.timeLeft / state.timeLimit);
  const stageBonus = state.stage * 180;
  state.score += Math.round(650 + stageBonus + speedRatio * 700);
  state.completed += 1;
  els.feedback.textContent = "MODULE STABILIZED // SIGNAL ACCEPTED";
  els.gameFrame.classList.remove("error-flash");
  els.gameFrame.classList.add("correct-flash");
  setDelay(() => els.gameFrame.classList.remove("correct-flash"), 500);
  updateHud();
  audio.sfx(state.completed % 2 === 0 && state.completed < TOTAL_MODULES ? "stage" : "correct");
  setDelay(loadModule, state.completed % 2 === 0 ? 1250 : 850);
}

function failRun(reason) {
  if (!state.running) return;
  state.running = false;
  state.locked = true;
  state.transitioning = false;
  stopTimer();
  clearDelays();
  audio.stopMusic();
  audio.stopTones();
  audio.sfx("error");
  els.feedback.textContent = reason;
  els.feedback.className = "feedback bad";
  els.gameFrame.classList.add("error-flash");
  els.gameFrame.classList.remove("timer-urgent");
  saveRecords();
  setDelay(() => {
    els.gameFrame.classList.remove("error-flash");
    els.failureScore.textContent = state.score.toLocaleString();
    els.failureStage.textContent = state.stage;
    els.failureModules.textContent = state.completed;
    showScreen("failure");
  }, 650);
}

function saveRecords() {
  let isRecord = false;
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    safeWrite(STORAGE.bestScore, state.bestScore);
    isRecord = true;
  }
  if (state.stage > state.bestStage) {
    state.bestStage = state.stage;
    safeWrite(STORAGE.bestStage, state.bestStage);
  }
  renderRecords();
  return isRecord;
}

function finishSuccess() {
  state.running = false;
  state.locked = true;
  state.transitioning = false;
  stopTimer();
  clearDelays();
  audio.stopMusic();
  audio.stopTones();
  els.gameFrame.classList.remove("timer-urgent");
  const record = saveRecords();
  els.successScore.textContent = state.score.toLocaleString();
  els.successName.textContent = state.playerName;
  els.recordNote.textContent = record ? "NEW LOCAL BEST" : "CORE FULLY STABLE";
  showScreen("success");
  audio.sfx("success");
  launchSuccessEffect();
}

function goMenu() {
  clearRunActivity();
  state.running = false;
  state.paused = false;
  state.locked = true;
  state.transitioning = false;
  els.pauseOverlay.classList.remove("open");
  els.pauseOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  els.game.inert = false;
  els.topbar.inert = false;
  showScreen("menu");
  renderRecords();
}

function pauseGame({ moveFocus = true } = {}) {
  if (!state.running || state.paused) return;
  if (state.timerId !== null) {
    state.timeLeft = Math.max(0, (state.deadline - performance.now()) / 1000);
    updateTimerDisplay();
    if (state.timeLeft <= 0) {
      failRun("TIME WINDOW LOST");
      return;
    }
  }
  state.paused = true;
  state.pausedAt = performance.now();
  state.focusBeforePause = document.activeElement;
  stopTimer();
  clearDelays();
  state.moduleToken += 1;
  audio.stopMusic();
  audio.stopTones();
  els.pauseOverlay.classList.add("open");
  els.pauseOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  els.game.inert = true;
  els.topbar.inert = true;
  if (moveFocus) $("#resume-btn").focus();
}

function resumeGame() {
  if (!state.running || !state.paused) return;
  state.paused = false;
  els.pauseOverlay.classList.remove("open");
  els.pauseOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  els.game.inert = false;
  els.topbar.inert = false;
  audio.startMusic();
  // Rebuild delayed visual sequences so none can continue invisibly while paused.
  if (state.transitioning) {
    loadModule();
  } else if (state.module && state.module.delayedStart && !state.module.ready) {
    state.module.delayedStart(state.moduleToken);
  } else {
    startTimer();
  }
  const focusTarget = state.focusBeforePause && state.focusBeforePause.isConnected ? state.focusBeforePause : $("#pause-btn");
  state.focusBeforePause = null;
  focusTarget.focus({ preventScroll: true });
}

function answerButtons(options, className = "answer-btn") {
  return `<div class="answer-row">${options.map((option, index) => `<button type="button" class="${className}" data-answer="${option.value}" data-key="${index + 1}"${option.color ? ` style="--answer-color:${option.color}"` : ""}>${option.label}</button>`).join("")}</div>`;
}

function bindAnswerButtons() {
  $$('[data-answer]').forEach((button) => button.addEventListener("click", () => chooseAnswer(button.dataset.answer)));
}

function buildColorModule() {
  const difficulty = state.stage;
  const patternType = difficulty >= 3 && Math.random() > .45 ? "aab" : "ab";
  const selected = shuffle(COLORS).slice(0, patternType === "ab" ? 2 : 3);
  const base = patternType === "ab" ? [selected[0], selected[1]] : [selected[0], selected[0], selected[1], selected[2]];
  const length = patternType === "ab" ? 5 + difficulty : 6 + difficulty;
  const sequence = Array.from({ length }, (_, index) => base[index % base.length]);
  const answer = base[length % base.length];
  const options = shuffle(COLORS).slice(0, Math.min(3 + Math.floor(difficulty / 2), COLORS.length));
  if (!options.includes(answer)) options[0] = answer;
  els.kicker.textContent = "CHROMA LOGIC";
  els.title.textContent = "Color Sequence";
  els.rule.textContent = patternType === "ab" ? "The colors alternate A-B. Select the color that comes next." : "The pattern repeats A-A-B-C. Select the color that comes next.";
  els.board.innerHTML = `<div><div class="sequence-display">${sequence.map((color) => `<span class="sequence-chip" style="--chip-color:${color.hex}">${color.name.slice(0, 1)}</span>`).join("")}<span class="sequence-chip missing">?</span></div>${answerButtons(shuffle(options).map((color) => ({ value: color.name, label: color.name, color: color.hex })), "answer-btn color-answer")}</div>`;
  bindAnswerButtons();
  return { answer: answer.name };
}

function buildSymbolModule() {
  const target = GLYPHS[randomInt(0, GLYPHS.length - 1)];
  const count = state.stage >= 3 ? 9 : 6;
  const options = shuffle(GLYPHS.filter((glyph) => glyph !== target)).slice(0, count - 1);
  options.splice(randomInt(0, options.length), 0, target);
  els.kicker.textContent = "GLYPH RESONANCE";
  els.title.textContent = "Symbol Match";
  els.rule.textContent = "Select the glyph that exactly matches the large resonance glyph.";
  els.board.innerHTML = `<div class="glyph-wrap"><div class="glyph-target" aria-label="Target glyph ${target}">${target}</div><div class="glyph-grid">${options.map((glyph, index) => `<button type="button" class="glyph-btn" data-answer="${glyph}" data-key="${index + 1}" aria-label="Glyph ${glyph}">${glyph}</button>`).join("")}</div></div>`;
  bindAnswerButtons();
  return { answer: target };
}

function buildNumberModule() {
  const useGrowing = state.stage >= 3 && Math.random() > .5;
  let sequence;
  let answer;
  let rule;
  if (useGrowing) {
    const start = randomInt(1, 5);
    sequence = [start];
    for (let i = 1; i < 5; i += 1) sequence.push(sequence[i - 1] + i);
    answer = sequence[4] + 5;
    rule = "Add 1, then 2, then 3, then 4. Select the next number after adding 5.";
  } else {
    const step = randomInt(2, 4 + state.stage);
    const start = randomInt(1, 8);
    sequence = Array.from({ length: 5 }, (_, index) => start + index * step);
    answer = start + 5 * step;
    rule = `Each number increases by ${step}. Select the next number.`;
  }
  const distractors = new Set([answer]);
  while (distractors.size < 4) distractors.add(Math.max(0, answer + randomInt(-5, 6)));
  els.kicker.textContent = "NUMERIC WAVE";
  els.title.textContent = "Number Pattern";
  els.rule.textContent = rule;
  els.board.innerHTML = `<div><div class="number-display">${sequence.map((number) => `<span class="number-chip">${number}</span>`).join("")}<span class="number-chip missing">?</span></div>${answerButtons(shuffle([...distractors]).map((number) => ({ value: number, label: number })))}</div>`;
  bindAnswerButtons();
  return { answer };
}

function buildSwitchModule() {
  const size = state.stage >= 3 ? 4 : 3;
  const cells = size * size;
  const target = Array.from({ length: cells }, () => Math.random() > .52);
  if (!target.some(Boolean)) target[randomInt(0, cells - 1)] = true;
  const current = Array.from({ length: cells }, () => false);
  els.kicker.textContent = "QUANTUM SWITCHBOARD";
  els.title.textContent = "Pattern Alignment";
  els.rule.textContent = "Toggle the left grid until it exactly matches the glowing target pattern, then submit. Keyboard: Tab moves between switches; Space toggles the focused switch.";
  els.board.innerHTML = `<div class="switch-layout"><div class="switch-group"><h3>YOUR GRID</h3><div class="switch-grid" style="--grid-size:${size}">${current.map((_, index) => `<button type="button" class="switch-cell" data-switch="${index}" aria-label="Toggle row ${Math.floor(index / size) + 1}, column ${(index % size) + 1}" aria-pressed="false"></button>`).join("")}</div><p class="switch-key-hint"><kbd>Tab</kbd> focus <kbd>Space</kbd> toggle</p></div><div class="switch-group"><h3>TARGET SIGNAL</h3><div class="target-grid" style="--grid-size:${size}" aria-label="Target pattern">${target.map((active) => `<span class="target-cell${active ? " active" : ""}" aria-hidden="true"></span>`).join("")}</div></div><button type="button" class="primary-btn submit-btn" id="switch-submit">Submit Pattern</button></div>`;
  $$('[data-switch]').forEach((button) => button.addEventListener("click", () => {
    if (state.locked || state.paused) return;
    const index = Number(button.dataset.switch);
    current[index] = !current[index];
    button.classList.toggle("active", current[index]);
    button.setAttribute("aria-pressed", String(current[index]));
    audio.sfx("select");
  }));
  $("#switch-submit").addEventListener("click", () => chooseAnswer("submit"));
  return {
    answer: "submit",
    onChoose() {
      if (current.every((active, index) => active === target[index])) completeModule();
      else failRun("PATTERN NOT ALIGNED");
    }
  };
}

function buildEnergyModule() {
  const length = 4 + state.stage;
  const path = shuffle(Array.from({ length: 9 }, (_, index) => index)).slice(0, length);
  let progress = 0;
  els.kicker.textContent = "LUMEN CONDUIT";
  els.title.textContent = "Energy Path";
  els.rule.textContent = `Route fictional glow through the numbered nodes in order, 1 through ${length}.`;
  els.board.innerHTML = `<div class="energy-wrap"><div class="energy-grid">${Array.from({ length: 9 }, (_, index) => {
    const order = path.indexOf(index);
    return `<button type="button" class="energy-node${order < 0 ? " locked" : ""}" data-energy="${index}"${order < 0 ? " disabled" : ` data-key="${order + 1}"`} aria-label="${order < 0 ? "Inactive node" : `Path node ${order + 1}, key ${order + 1}`}">${order < 0 ? "--" : order + 1}</button>`;
  }).join("")}</div></div>`;
  $$('[data-energy]').forEach((button) => button.addEventListener("click", () => chooseAnswer(button.dataset.energy)));
  const markNext = () => {
    $$('[data-energy]').forEach((button) => button.classList.toggle("next", Number(button.dataset.energy) === path[progress]));
  };
  markNext();
  return {
    answer: path.join(","),
    onChoose(value) {
      if (Number(value) !== path[progress]) {
        failRun("ENERGY PATH BROKEN");
        return;
      }
      const button = $(`[data-energy="${value}"]`);
      button.classList.add("active");
      button.classList.remove("next");
      progress += 1;
      audio.sfx("select");
      if (progress === path.length) completeModule();
      else markNext();
    }
  };
}

function buildMemoryModule() {
  const padColors = ["#54e6ff", "#9d78ff", "#ffd25e", "#28ffc6"];
  const length = 3 + state.stage;
  const sequence = Array.from({ length }, () => randomInt(0, 3));
  let input = [];
  els.kicker.textContent = "ECHO BUFFER";
  els.title.textContent = "Memory Code";
  els.rule.textContent = `Watch the ${length}-pulse code, then repeat it in the same order.`;
  els.board.innerHTML = `<div class="memory-wrap"><div class="memory-status" id="memory-status">OBSERVE SIGNAL</div><div class="memory-grid">${padColors.map((color, index) => `<button type="button" class="memory-pad" data-memory="${index}" data-key="${index + 1}" style="--pad-color:${color}" disabled><span>${index + 1}</span></button>`).join("")}</div></div>`;
  $$('[data-memory]').forEach((button) => button.addEventListener("click", () => chooseAnswer(button.dataset.memory)));
  let playbackIndex = 0;
  let pulseIlluminated = false;
  const module = {
    answer: sequence.join(","),
    ready: false,
    delayedStart(token) {
      if (pulseIlluminated) playbackIndex -= 1;
      pulseIlluminated = false;
      module.ready = false;
      state.locked = true;
      $("#memory-status").textContent = "OBSERVE SIGNAL";
      $$('[data-memory]').forEach((button) => { button.disabled = true; button.classList.remove("flash", "active"); });
      const playNext = () => {
        if (token !== state.moduleToken || state.paused) return;
        if (playbackIndex >= sequence.length) {
          module.ready = true;
          state.locked = false;
          $("#memory-status").textContent = "REPEAT SIGNAL";
          $$('[data-memory]').forEach((button) => { button.disabled = false; });
          startTimer();
          return;
        }
        const button = $(`[data-memory="${sequence[playbackIndex]}"]`);
        playbackIndex += 1;
        pulseIlluminated = true;
        button.classList.add("flash");
        audio.sfx("select");
        setDelay(() => {
          if (token !== state.moduleToken || state.paused) return;
          button.classList.remove("flash");
          pulseIlluminated = false;
          setDelay(playNext, 350);
        }, 310);
      };
      setDelay(playNext, 650);
    },
    onChoose(value) {
      const pad = Number(value);
      if (pad !== sequence[input.length]) {
        failRun("ECHO CODE MISMATCH");
        return;
      }
      input.push(pad);
      const button = $(`[data-memory="${pad}"]`);
      button.classList.add("active");
      setDelay(() => button.classList.remove("active"), 160);
      audio.sfx("select");
      $("#memory-status").textContent = `ECHO ${input.length} / ${sequence.length}`;
      if (input.length === sequence.length) completeModule();
    }
  };
  return module;
}

function launchSuccessEffect() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = els.successCanvas;
  const context = canvas.getContext("2d");
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const particles = Array.from({ length: 72 }, (_, index) => ({
    angle: (Math.PI * 2 * index) / 72 + Math.random() * .08,
    radius: 15 + Math.random() * 20,
    speed: 1.7 + Math.random() * 3.1,
    size: 1.5 + Math.random() * 3,
    color: ["#54e6ff", "#28ffc6", "#9d78ff", "#ffd25e"][index % 4]
  }));
  let frame = 0;
  const draw = () => {
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    particles.forEach((particle) => {
      particle.radius += particle.speed;
      const alpha = Math.max(0, 1 - frame / 130);
      context.globalAlpha = alpha;
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(centerX + Math.cos(particle.angle) * particle.radius, centerY + Math.sin(particle.angle) * particle.radius, particle.size, 0, Math.PI * 2);
      context.fill();
    });
    context.globalAlpha = 1;
    frame += 1;
    if (frame < 130 && state.screen === "success") state.animationId = window.requestAnimationFrame(draw);
    else {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      state.animationId = null;
    }
  };
  draw();
}

function handleKeyboard(event) {
  if ((event.key === "p" || event.key === "P" || event.key === "Escape") && state.screen === "game") {
    event.preventDefault();
    if (state.paused) resumeGame(); else pauseGame();
    return;
  }
  if (!state.running || state.paused || state.locked) return;
  if (/^[1-9]$/.test(event.key)) {
    const button = $(`[data-key="${event.key}"]`);
    if (button && !button.disabled) button.click();
  }
  if (event.key === "Enter") {
    const submit = $("#switch-submit");
    if (submit) submit.click();
  }
}

function renderRecords() {
  els.menuBestScore.textContent = state.bestScore.toLocaleString();
  els.menuBestStage.textContent = state.bestStage;
}

function makeSparks() {
  const field = $("#spark-field");
  const fragment = document.createDocumentFragment();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const sparkCount = window.matchMedia("(max-width: 760px)").matches ? 8 : 16;
  for (let i = 0; i < sparkCount; i += 1) {
    const spark = document.createElement("i");
    spark.className = "spark";
    spark.style.left = `${Math.random() * 100}%`;
    spark.style.setProperty("--speed", `${10 + Math.random() * 18}s`);
    spark.style.setProperty("--delay", `${-Math.random() * 20}s`);
    fragment.appendChild(spark);
  }
  field.appendChild(fragment);
}

$("#play-btn").addEventListener("click", startRun);
$("#brief-play-btn").addEventListener("click", startRun);
$("#howto-btn").addEventListener("click", () => showScreen("howto"));
$("#brief-back-btn").addEventListener("click", () => showScreen("menu"));
$("#pause-btn").addEventListener("click", pauseGame);
$("#resume-btn").addEventListener("click", resumeGame);
$("#pause-menu-btn").addEventListener("click", goMenu);
$("#failure-replay").addEventListener("click", startRun);
$("#failure-menu").addEventListener("click", goMenu);
$("#success-replay").addEventListener("click", startRun);
$("#success-menu").addEventListener("click", goMenu);
els.audioToggle.addEventListener("click", toggleAudio);
els.name.addEventListener("keydown", (event) => { if (event.key === "Enter") startRun(); });
document.addEventListener("keydown", handleKeyboard);
els.pauseOverlay.addEventListener("keydown", (event) => {
  if (event.key !== "Tab" || !state.paused) return;
  const controls = $$("#pause-overlay button:not([disabled])");
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
document.addEventListener("visibilitychange", () => { if (document.hidden && state.running && !state.paused) pauseGame(); });
window.addEventListener("pagehide", (event) => {
  if (event.persisted) {
    if (state.running && !state.paused) pauseGame({ moveFocus: false });
    return;
  }
  clearRunActivity();
  audio.shutdown();
});
window.addEventListener("pageshow", (event) => {
  if (!event.persisted || !state.running) return;
  if (!state.paused) pauseGame({ moveFocus: false });
  $("#resume-btn").focus({ preventScroll: true });
});

els.name.value = state.playerName;
renderRecords();
updateAudioButton();
makeSparks();
