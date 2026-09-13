(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const STORAGE = {
    muted: "legendary_neon_typing_muted",
    mode: "legendary_neon_typing_mode",
    records: "legendary_neon_typing_records"
  };

  const MODE_CONFIG = {
    "30": { name: "30 SECOND SPRINT", duration: 30 },
    "60": { name: "60 SECOND CIRCUIT", duration: 60 },
    survival: { name: "SURVIVAL PROTOCOL", duration: 0 }
  };

  const WORDS = {
    easy: [
      "arc", "beam", "bolt", "byte", "calm", "dash", "data", "drift", "echo", "fast",
      "fire", "flash", "flow", "focus", "glow", "grid", "hyper", "jump", "laser", "light",
      "link", "lunar", "nova", "pixel", "pulse", "quick", "rush", "shift", "spark", "speed",
      "storm", "surge", "sync", "trace", "turbo", "vivid", "wave", "zero"
    ],
    medium: [
      "atomic", "circuit", "comet", "cosmic", "digital", "dynamic", "energy", "engine", "flux",
      "glitch", "gravity", "horizon", "ignite", "kinetic", "matrix", "momentum", "neon", "orbit",
      "photon", "plasma", "prism", "quantum", "rapid", "reactor", "rhythm", "signal", "sprint",
      "stellar", "system", "vector", "velocity", "voltage", "warp", "zenith"
    ],
    hard: [
      "accelerate", "afterimage", "algorithm", "breakpoint", "chromatic", "convergence", "cybernetic",
      "frequency", "hypersonic", "interstellar", "luminescent", "metropolis", "overclocked", "parallax",
      "phosphorescent", "projection", "quicksilver", "resonance", "synchronize", "telemetry", "trajectory",
      "transmission", "ultraviolet", "virtuality", "waveform"
    ]
  };

  const els = {
    screens: $$(".screen"),
    menu: $("#menu-screen"),
    how: $("#how-screen"),
    game: $("#game-screen"),
    over: $("#over-screen"),
    modeCards: $$(".mode-card"),
    bestScore: $("#menu-best-score"),
    bestWpm: $("#menu-best-wpm"),
    audioToggle: $("#audio-toggle"),
    audioLabel: $("#audio-label"),
    gameTitle: $("#game-mode-title"),
    score: $("#score-value"),
    combo: $("#combo-value"),
    accuracy: $("#accuracy-value"),
    wpm: $("#wpm-value"),
    timerLabel: $("#timer-label"),
    timer: $("#timer-value"),
    progress: $("#time-progress"),
    difficulty: $("#difficulty-label"),
    lives: $("#lives-display"),
    word: $("#word-display"),
    input: $("#typing-input"),
    inputStatus: $("#input-status"),
    gamePanel: $("#game-panel"),
    comboItem: $("#combo-value").closest(".hud-item"),
    resultCard: $(".result-card"),
    resultKicker: $("#result-kicker"),
    resultTitle: $("#result-title"),
    resultMessage: $("#result-message"),
    resultScore: $("#result-score"),
    resultWords: $("#result-words"),
    resultWpm: $("#result-wpm"),
    resultAccuracy: $("#result-accuracy"),
    resultCombo: $("#result-combo"),
    resultBestScore: $("#result-best-score"),
    resultBestWpm: $("#result-best-wpm"),
    recordBadge: $("#record-badge"),
    canvas: $("#fx-canvas"),
    ambient: $("#ambient")
  };

  const state = {
    screen: "menu",
    mode: validMode(readStorage(STORAGE.mode)) || "30",
    muted: readStorage(STORAGE.muted) === "1",
    records: readRecords(),
    running: false,
    pausedAt: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    completedWords: 0,
    resolvedWords: 0,
    completedChars: 0,
    attempts: 0,
    correctInputs: 0,
    errorsThisWord: 0,
    currentWord: "",
    recentWords: [],
    previousInput: "",
    beforeInputCounted: false,
    lives: 3,
    startAt: 0,
    endAt: 0,
    wordStartedAt: 0,
    wordDeadline: 0,
    rafId: 0,
    lastFrameAt: 0,
    lastHudAt: 0,
    particles: [],
    audio: null,
    audioUnavailable: false,
    musicTimer: 0,
    musicStep: 0,
    audioNodes: new Set()
  };

  let reducedMotion = motionQuery.matches;

  const ctx = els.canvas.getContext("2d");

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function validMode(mode) {
    return Object.prototype.hasOwnProperty.call(MODE_CONFIG, mode) ? mode : null;
  }

  function readRecords() {
    const empty = {
      "30": { score: 0, wpm: 0 },
      "60": { score: 0, wpm: 0 },
      survival: { score: 0, wpm: 0 }
    };

    try {
      const parsed = JSON.parse(readStorage(STORAGE.records) || "{}");
      Object.keys(empty).forEach((mode) => {
        const item = parsed && parsed[mode];
        if (item && Number.isFinite(item.score) && Number.isFinite(item.wpm)) {
          empty[mode] = {
            score: Math.max(0, Math.floor(item.score)),
            wpm: Math.max(0, Math.floor(item.wpm))
          };
        }
      });
    } catch (_) {
      // Corrupt or unavailable storage should never stop the game.
    }
    return empty;
  }

  function persistRecords() {
    writeStorage(STORAGE.records, JSON.stringify(state.records));
  }

  function showScreen(name) {
    state.screen = name;
    els.screens.forEach((screen) => screen.classList.toggle("active", screen.id === `${name}-screen`));
  }

  function selectMode(mode) {
    if (!validMode(mode)) return;
    state.mode = mode;
    writeStorage(STORAGE.mode, mode);
    els.modeCards.forEach((card) => {
      const selected = card.dataset.mode === mode;
      card.classList.toggle("selected", selected);
      card.setAttribute("aria-checked", String(selected));
    });
    renderMenuRecords();
  }

  function renderMenuRecords() {
    const record = state.records[state.mode];
    els.bestScore.textContent = record.score.toLocaleString();
    els.bestWpm.textContent = record.wpm.toLocaleString();
  }

  function renderAudioToggle() {
    const on = !state.muted;
    els.audioToggle.classList.toggle("muted", !on);
    els.audioToggle.setAttribute("aria-pressed", String(on));
    els.audioLabel.textContent = `Music / Sound: ${on ? "On" : "Off"}`;
    els.audioToggle.setAttribute("aria-label", `Turn music and sound ${on ? "off" : "on"}`);
  }

  function openMenu() {
    stopRuntime(true);
    state.running = false;
    state.pausedAt = 0;
    els.input.blur();
    showScreen("menu");
    renderMenuRecords();
  }

  function chooseTier(now) {
    if (state.mode === "survival") {
      if (state.resolvedWords >= 16) return "hard";
      if (state.resolvedWords >= 6) return "medium";
      return "easy";
    }

    const duration = MODE_CONFIG[state.mode].duration * 1000;
    const progress = Math.min(1, Math.max(0, (now - state.startAt) / duration));
    if (progress > 0.68 || state.completedWords >= 25) return "hard";
    if (progress > 0.25 || state.completedWords >= 8) return "medium";
    return "easy";
  }

  function pickWord(tier) {
    const pool = WORDS[tier];
    let options = pool.filter((word) => !state.recentWords.includes(word));
    if (!options.length) options = pool;
    const word = options[Math.floor(Math.random() * options.length)];
    state.recentWords.push(word);
    state.recentWords = state.recentWords.slice(-7);
    return word;
  }

  function survivalWindow() {
    return Math.max(2600, 6100 - state.resolvedWords * 115);
  }

  function setNextWord(now) {
    const tier = chooseTier(now);
    state.currentWord = pickWord(tier);
    state.errorsThisWord = 0;
    state.previousInput = "";
    state.beforeInputCounted = false;
    state.wordStartedAt = now;
    state.wordDeadline = now + survivalWindow();
    els.input.value = "";
    els.difficulty.textContent = `${tier.toUpperCase()} TIER`;
    els.inputStatus.textContent = "READY";
    els.inputStatus.classList.remove("error");
    els.gamePanel.classList.remove("signal-error", "signal-synced");
    renderWord();
  }

  function beginGame() {
    stopRuntime(true);
    const now = performance.now();
    state.running = true;
    state.pausedAt = 0;
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.completedWords = 0;
    state.resolvedWords = 0;
    state.completedChars = 0;
    state.attempts = 0;
    state.correctInputs = 0;
    state.lives = 3;
    state.recentWords = [];
    state.particles = [];
    state.startAt = now;
    state.endAt = now + MODE_CONFIG[state.mode].duration * 1000;
    state.lastFrameAt = now;
    state.lastHudAt = 0;

    els.gameTitle.textContent = MODE_CONFIG[state.mode].name;
    els.timerLabel.textContent = state.mode === "survival" ? "WORD TIMER" : "TIME LEFT";
    els.lives.hidden = state.mode !== "survival";
    els.lives.textContent = "|||";
    showScreen("game");
    resizeCanvas();
    setNextWord(now);
    renderHud(now);
    ensureAudio();
    playSound("start");
    startMusic();
    els.input.focus({ preventScroll: true });
    state.rafId = requestAnimationFrame(gameLoop);
  }

  function elapsedMinutes(now) {
    return Math.max((now - state.startAt) / 60000, 1 / 600);
  }

  function currentWpm(now) {
    return Math.max(0, Math.round((state.completedChars / 5) / elapsedMinutes(now)));
  }

  function accuracy() {
    return state.attempts ? Math.round((state.correctInputs / state.attempts) * 100) : 100;
  }

  function multiplier() {
    return 1 + Math.min(state.combo, 10) * 0.1;
  }

  function renderHud(now) {
    const isSurvival = state.mode === "survival";
    const remaining = Math.max(0, (isSurvival ? state.wordDeadline - now : state.endAt - now) / 1000);
    const total = isSurvival ? survivalWindow() / 1000 : MODE_CONFIG[state.mode].duration;
    const progress = total ? Math.max(0, Math.min(1, remaining / total)) : 0;

    els.score.textContent = state.score.toLocaleString();
    els.combo.textContent = `x${multiplier().toFixed(1)}`;
    els.accuracy.textContent = `${accuracy()}%`;
    els.wpm.textContent = currentWpm(now).toString();
    els.timer.textContent = remaining.toFixed(1);
    els.progress.style.transform = `scaleX(${progress})`;
    els.timer.closest(".hud-item").classList.toggle("urgent", remaining <= (isSurvival ? 1.8 : 7));
    const comboTier = state.combo >= 8 ? "overdrive" : state.combo >= 4 ? "charged" : state.combo >= 1 ? "building" : "idle";
    els.comboItem.dataset.comboTier = comboTier;
    if (isSurvival) els.lives.textContent = "|".repeat(state.lives) || "0";
  }

  function pulseHud(element) {
    if (reducedMotion) return;
    const item = element.closest(".hud-item");
    item.classList.remove("data-pulse");
    void item.offsetWidth;
    item.classList.add("data-pulse");
  }

  function renderWord() {
    const typed = els.input.value.toLowerCase();
    const length = Math.max(state.currentWord.length, typed.length);
    let markup = "";

    for (let index = 0; index < length; index += 1) {
      const expected = state.currentWord[index] || "_";
      let className = "";
      if (index < typed.length) className = typed[index] === expected ? "correct" : "incorrect";
      else if (index === typed.length) className = "current";
      markup += `<span class="${className}">${expected}</span>`;
    }
    els.word.innerHTML = markup;
  }

  function countInsertedCharacters(text, startIndex) {
    let hasError = false;
    Array.from(text.toLowerCase()).forEach((character, offset) => {
      if (!/[a-z]/.test(character)) return;
      state.attempts += 1;
      if (character === state.currentWord[startIndex + offset]) {
        state.correctInputs += 1;
      } else {
        state.errorsThisWord += 1;
        state.combo = 0;
        hasError = true;
      }
    });

    if (hasError) {
      els.inputStatus.textContent = "MISS";
      els.inputStatus.classList.add("error");
      els.gamePanel.classList.add("signal-error");
      els.gamePanel.classList.remove("signal-synced");
      els.gamePanel.classList.remove("shake");
      void els.gamePanel.offsetWidth;
      els.gamePanel.classList.add("shake");
      playSound("wrong");
    } else if (text) {
      els.inputStatus.textContent = "SYNCED";
      els.inputStatus.classList.remove("error");
      els.gamePanel.classList.add("signal-synced");
      els.gamePanel.classList.remove("signal-error");
      playSound("key");
    }
  }

  function onBeforeInput(event) {
    if (!state.running || state.pausedAt) {
      event.preventDefault();
      return;
    }

    if (enforceDeadline(performance.now())) {
      event.preventDefault();
      return;
    }

    if (event.inputType === "insertFromPaste" || event.inputType === "insertFromDrop") {
      event.preventDefault();
      return;
    }

    if (event.inputType.startsWith("insert")) {
      const text = event.data || "";
      if (/[^a-zA-Z]/.test(text)) {
        event.preventDefault();
        return;
      }
      const start = els.input.selectionStart === null ? els.input.value.length : els.input.selectionStart;
      countInsertedCharacters(text, start);
      state.beforeInputCounted = true;
    }
  }

  function onTypingInput() {
    if (!state.running || state.pausedAt) return;
    if (enforceDeadline(performance.now())) {
      els.input.value = "";
      return;
    }
    const clean = els.input.value.toLowerCase().replace(/[^a-z]/g, "");
    if (els.input.value !== clean) els.input.value = clean;

    if (!state.beforeInputCounted && clean.length > state.previousInput.length) {
      let shared = 0;
      while (shared < clean.length && clean[shared] === state.previousInput[shared]) shared += 1;
      countInsertedCharacters(clean.slice(shared), shared);
    }

    state.beforeInputCounted = false;
    state.previousInput = clean;
    renderWord();

    if (clean === state.currentWord) completeWord(performance.now());
  }

  function completeWord(now) {
    if (enforceDeadline(now)) return;
    const wordTime = Math.max(300, now - state.wordStartedAt);
    const cleanWord = state.errorsThisWord === 0;
    if (cleanWord) state.combo += 1;
    else state.combo = 0;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    const paceBonus = Math.max(0, Math.round(850 - wordTime / 5));
    const base = state.currentWord.length * 24 + paceBonus;
    state.score += Math.round(base * multiplier());
    state.completedWords += 1;
    state.resolvedWords += 1;
    state.completedChars += state.currentWord.length;
    pulseHud(els.score);
    if (cleanWord) pulseHud(els.combo);
    spawnBurst(els.word.getBoundingClientRect(), cleanWord ? "#38f8ff" : "#ff3c9e");
    playSound(cleanWord && state.combo > 2 ? "combo" : "word");
    setNextWord(now);
    renderHud(now);
  }

  function missSurvivalWord(now) {
    const typedLetters = els.input.value.toLowerCase().replace(/[^a-z]/g, "").length;
    state.attempts += Math.max(1, state.currentWord.length - typedLetters);
    state.resolvedWords += 1;
    state.lives -= 1;
    state.combo = 0;
    els.gamePanel.classList.remove("shake");
    void els.gamePanel.offsetWidth;
    els.gamePanel.classList.add("shake");
    playSound("life");
    if (state.lives <= 0) {
      finishGame("SIGNAL LOST");
      return;
    }
    setNextWord(now);
    renderHud(now);
  }

  function enforceDeadline(now) {
    if (!state.running || state.pausedAt) return true;
    if (state.mode === "survival" && now >= state.wordDeadline) {
      missSurvivalWord(now);
      return true;
    }
    if (state.mode !== "survival" && now >= state.endAt) {
      finishGame("TIME EXPIRED");
      return true;
    }
    return false;
  }

  function gameLoop(now) {
    if (!state.running || state.pausedAt) return;
    state.rafId = 0;

    if (enforceDeadline(now) && !state.running) return;

    if (!state.running) return;
    if (now - state.lastHudAt >= 45) {
      renderHud(now);
      state.lastHudAt = now;
    }
    drawParticles(now - state.lastFrameAt);
    state.lastFrameAt = now;
    state.rafId = requestAnimationFrame(gameLoop);
  }

  function finishGame(reason) {
    if (!state.running) return;
    const now = performance.now();
    const finalWpm = currentWpm(now);
    const finalAccuracy = accuracy();
    const oldRecord = state.records[state.mode];
    const isScoreRecord = state.score > oldRecord.score;
    const isWpmRecord = finalWpm > oldRecord.wpm;

    state.running = false;
    stopRuntime(false);
    state.records[state.mode] = {
      score: Math.max(oldRecord.score, state.score),
      wpm: Math.max(oldRecord.wpm, finalWpm)
    };
    persistRecords();

    const newRecord = state.records[state.mode];
    els.resultKicker.textContent = reason;
    els.resultTitle.textContent = isScoreRecord ? "New high signal." : "Run complete.";
    els.resultMessage.textContent = resultMessage(finalWpm, finalAccuracy);
    els.resultScore.textContent = state.score.toLocaleString();
    els.resultWords.textContent = state.completedWords.toString();
    els.resultWpm.textContent = finalWpm.toString();
    els.resultAccuracy.textContent = `${finalAccuracy}%`;
    els.resultCombo.textContent = state.maxCombo.toString();
    els.resultBestScore.textContent = newRecord.score.toLocaleString();
    els.resultBestWpm.textContent = newRecord.wpm.toString();
    els.recordBadge.hidden = !isScoreRecord && !isWpmRecord;
    els.recordBadge.textContent = isScoreRecord ? "NEW SCORE RECORD" : "NEW WPM RECORD";
    els.resultCard.classList.toggle("new-record", isScoreRecord || isWpmRecord);
    showScreen("over");
    els.resultTitle.focus({ preventScroll: true });
    playSound(isScoreRecord || isWpmRecord ? "record" : "end");
  }

  function resultMessage(wpm, runAccuracy) {
    if (wpm >= 80 && runAccuracy >= 95) return "Elite speed. Clean signal. The grid could barely keep up.";
    if (wpm >= 55 && runAccuracy >= 90) return "Fast and controlled. Your rhythm is locking in.";
    if (runAccuracy < 80) return "Raw speed detected. Tighten the misses and your score will surge.";
    return "Solid run. Build cleaner combos to break the next record.";
  }

  function ensureAudio() {
    if (state.muted || state.audioUnavailable) return null;
    let AudioContext;
    try {
      AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        state.audioUnavailable = true;
        return null;
      }
      if (!state.audio) state.audio = new AudioContext();
    } catch (_) {
      state.audioUnavailable = true;
      return null;
    }
    if (state.audio.state === "suspended") state.audio.resume().catch(() => {});
    return state.audio;
  }

  function tone(frequency, duration, volume, type = "sine", delay = 0, endFrequency = null) {
    const audio = ensureAudio();
    if (!audio || state.muted) return;
    const start = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    state.audioNodes.add(oscillator);
    oscillator.addEventListener("ended", () => state.audioNodes.delete(oscillator), { once: true });
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function playSound(kind) {
    if (state.muted || !state.audio) return;
    if (kind === "start") {
      tone(180, 0.14, 0.055, "sawtooth", 0, 360);
      tone(520, 0.17, 0.04, "square", 0.12, 740);
    } else if (kind === "key") {
      tone(760, 0.025, 0.012, "square");
    } else if (kind === "wrong") {
      tone(150, 0.1, 0.045, "sawtooth", 0, 85);
    } else if (kind === "word") {
      tone(520, 0.07, 0.035, "triangle", 0, 710);
    } else if (kind === "combo") {
      tone(620, 0.08, 0.04, "triangle");
      tone(930, 0.11, 0.035, "sine", 0.06);
    } else if (kind === "life") {
      tone(210, 0.24, 0.06, "sawtooth", 0, 65);
    } else if (kind === "end") {
      tone(430, 0.12, 0.045, "triangle");
      tone(320, 0.22, 0.04, "triangle", 0.1);
    } else if (kind === "record") {
      tone(520, 0.12, 0.05, "triangle");
      tone(780, 0.14, 0.05, "triangle", 0.1);
      tone(1040, 0.24, 0.045, "sine", 0.2);
    }
  }

  function musicPulse() {
    if (!state.running || state.muted || document.hidden) return;
    const bass = [82.41, 82.41, 98, 73.42];
    const lead = [329.63, 392, 440, 392, 523.25, 440, 392, 329.63];
    const step = state.musicStep;
    tone(bass[Math.floor(step / 4) % bass.length], 0.18, 0.018, "sawtooth");
    if (step % 2 === 0) tone(lead[step % lead.length], 0.11, 0.012, "square", 0.03);
    if (step % 4 === 2) tone(1100, 0.025, 0.007, "square", 0.01, 700);
    state.musicStep = (step + 1) % 16;
  }

  function startMusic() {
    stopMusic();
    if (state.muted || !state.running || document.hidden) return;
    ensureAudio();
    musicPulse();
    state.musicTimer = window.setInterval(musicPulse, 220);
  }

  function stopMusic() {
    if (state.musicTimer) {
      window.clearInterval(state.musicTimer);
      state.musicTimer = 0;
    }
  }

  function stopAudio(suspend) {
    stopMusic();
    state.audioNodes.forEach((node) => {
      try {
        node.stop();
      } catch (_) {
        // Nodes that already ended can safely be ignored.
      }
    });
    state.audioNodes.clear();
    if (suspend && state.audio && state.audio.state === "running") state.audio.suspend().catch(() => {});
  }

  function stopRuntime(suspendAudio) {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = 0;
    stopAudio(suspendAudio);
    state.particles = [];
    clearCanvas();
  }

  function resizeCanvas() {
    if (reducedMotion) {
      els.canvas.width = 1;
      els.canvas.height = 1;
      return;
    }
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    els.canvas.width = Math.round(window.innerWidth * ratio);
    els.canvas.height = Math.round(window.innerHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function clearCanvas() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  function spawnBurst(rect, color) {
    if (reducedMotion) return;
    const room = Math.max(0, 70 - state.particles.length);
    const amount = Math.min(14, room);
    for (let index = 0; index < amount; index += 1) {
      state.particles.push({
        x: rect.left + rect.width * (0.2 + Math.random() * 0.6),
        y: rect.top + rect.height * (0.3 + Math.random() * 0.4),
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.7) * 4,
        life: 1,
        size: 1.5 + Math.random() * 2.5,
        color
      });
    }
  }

  function drawParticles(delta) {
    if (reducedMotion) return;
    clearCanvas();
    const step = Math.min(delta, 34) / 16.67;
    state.particles = state.particles.filter((particle) => {
      particle.x += particle.vx * step;
      particle.y += particle.vy * step;
      particle.vy += 0.07 * step;
      particle.life -= 0.025 * step;
      if (particle.life <= 0) return false;
      ctx.globalAlpha = particle.life;
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      return true;
    });
    ctx.globalAlpha = 1;
  }

  function toggleAudio() {
    state.muted = !state.muted;
    writeStorage(STORAGE.muted, state.muted ? "1" : "0");
    renderAudioToggle();
    if (state.muted) {
      stopAudio(true);
    } else if (state.running && !state.pausedAt) {
      ensureAudio();
      startMusic();
      playSound("word");
    }
  }

  function pauseRun() {
    if (state.running && !state.pausedAt) state.pausedAt = performance.now();
    stopRuntime(true);
  }

  function resumeRun() {
    if (!state.running || !state.pausedAt || document.hidden) return;
    const now = performance.now();
    const pauseLength = now - state.pausedAt;
    state.startAt += pauseLength;
    state.endAt += pauseLength;
    state.wordStartedAt += pauseLength;
    state.wordDeadline += pauseLength;
    state.pausedAt = 0;
    state.lastFrameAt = now;
    ensureAudio();
    startMusic();
    state.rafId = requestAnimationFrame(gameLoop);
  }

  function onVisibilityChange() {
    if (document.hidden) pauseRun();
    else resumeRun();
  }

  function updateVisualViewport() {
    const viewport = window.visualViewport;
    document.documentElement.style.setProperty("--visual-height", `${viewport ? viewport.height : window.innerHeight}px`);
    resizeCanvas();
    if (state.screen === "game" && document.activeElement === els.input) {
      window.requestAnimationFrame(() => els.input.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" }));
    }
  }

  function focusTypingInput(event) {
    if (!state.running || state.pausedAt || event.target.closest("button, a, input")) return;
    els.input.focus({ preventScroll: true });
    els.input.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
  }

  function createAmbientParticles() {
    if (reducedMotion) return;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 24; index += 1) {
      const particle = document.createElement("i");
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.setProperty("--speed", `${10 + Math.random() * 16}s`);
      particle.style.setProperty("--delay", `${-Math.random() * 20}s`);
      particle.style.setProperty("--sway", `${-70 + Math.random() * 140}px`);
      fragment.appendChild(particle);
    }
    els.ambient.appendChild(fragment);
  }

  function onMotionPreferenceChange(event) {
    reducedMotion = event.matches;
    state.particles = [];
    clearCanvas();
    if (!reducedMotion) {
      resizeCanvas();
      if (!els.ambient.childElementCount) createAmbientParticles();
    }
  }

  els.modeCards.forEach((card) => card.addEventListener("click", () => selectMode(card.dataset.mode)));
  $("#play-button").addEventListener("click", beginGame);
  $("#how-play").addEventListener("click", beginGame);
  $("#how-button").addEventListener("click", () => showScreen("how"));
  $("#how-close").addEventListener("click", openMenu);
  $("#exit-button").addEventListener("click", openMenu);
  $("#menu-button").addEventListener("click", openMenu);
  $("#brand-home").addEventListener("click", openMenu);
  $("#replay-button").addEventListener("click", beginGame);
  els.audioToggle.addEventListener("click", toggleAudio);
  els.input.addEventListener("beforeinput", onBeforeInput);
  els.input.addEventListener("input", onTypingInput);
  els.input.addEventListener("paste", (event) => event.preventDefault());
  els.input.addEventListener("drop", (event) => event.preventDefault());
  els.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") els.input.blur();
  });
  els.gamePanel.addEventListener("click", focusTypingInput);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("resize", updateVisualViewport);
  window.visualViewport?.addEventListener("resize", updateVisualViewport);
  window.visualViewport?.addEventListener("scroll", updateVisualViewport);
  motionQuery.addEventListener?.("change", onMotionPreferenceChange);
  window.addEventListener("pagehide", pauseRun);
  window.addEventListener("pageshow", resumeRun);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && (state.screen === "game" || state.screen === "how")) openMenu();
  });

  selectMode(state.mode);
  renderAudioToggle();
  createAmbientParticles();
  updateVisualViewport();
})();
