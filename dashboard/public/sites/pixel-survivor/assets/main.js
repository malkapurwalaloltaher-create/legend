(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('arena');
  const ctx = canvas.getContext('2d', { alpha: false });
  const gameEl = $('game');
  const screens = {
    menu: $('menu-screen'),
    how: $('how-screen'),
    paused: $('pause-screen'),
    upgrading: $('upgrade-screen'),
    gameover: $('gameover-screen')
  };
  const hud = $('hud');
  const dom = {
    healthText: $('health-text'), healthFill: $('health-fill'), level: $('level-value'),
    xpText: $('xp-text'), xpFill: $('xp-fill'), time: $('time-value'), score: $('score-value'),
    kills: $('kills-value'), bestScore: $('best-score'), bestTime: $('best-time'),
    bestLevel: $('best-level'), choices: $('upgrade-choices'), upgradeLevel: $('upgrade-level'),
    finalScore: $('final-score'), finalTime: $('final-time'), finalLevel: $('final-level'),
    finalKills: $('final-kills'), recordFlash: $('record-flash'), gameoverCard: $('gameover-card'),
    soundIcon: $('sound-icon'), soundLabel: $('sound-label'), soundButton: $('sound-btn'),
    announcement: $('announcement'), joystick: $('joystick'), stickKnob: $('stick-knob')
  };

  const STORAGE = {
    bestTime: 'legendary_pixel_survivor_best_time',
    bestScore: 'legendary_pixel_survivor_best_score',
    highestLevel: 'legendary_pixel_survivor_highest_level',
    music: 'legendary_pixel_survivor_music'
  };
  const FIXED_STEP = 1 / 60;
  const MAX_ENEMIES = 180;
  const MAX_PROJECTILES = 150;
  const MAX_DROPS = 140;
  const MAX_PARTICLES = 260;
  const MAX_POPUPS = 36;
  const MAX_ATTACK_RATE = 12;
  const DROP_LIFETIME = 24;
  const ENTITY_MARGIN = 80;
  const TAU = Math.PI * 2;

  const safeGet = (key, fallback) => {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  };
  const safeSet = (key, value) => {
    try { window.localStorage.setItem(key, String(value)); } catch (_) { /* Storage can be unavailable. */ }
  };
  const savedNumber = (key) => {
    const value = Number(safeGet(key, 0));
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  const records = {
    bestTime: savedNumber(STORAGE.bestTime),
    bestScore: savedNumber(STORAGE.bestScore),
    highestLevel: savedNumber(STORAGE.highestLevel),
    music: safeGet(STORAGE.music, 'on') !== 'off'
  };

  const run = {
    state: 'menu', elapsed: 0, score: 0, kills: 0, level: 1, xp: 0, xpNeeded: 10,
    spawnClock: 0, pendingLevels: 0, uiClock: 0, shake: 0, pickupFlash: 0,
    player: null, enemies: [], projectiles: [], drops: [], particles: [], popups: []
  };
  const input = {
    keys: new Set(), stickX: 0, stickY: 0, pointerId: null
  };
  let width = 0;
  let height = 0;
  let dpr = 1;
  let stars = [];
  let rafId = null;
  let lastFrame = 0;
  let accumulator = 0;
  let entityId = 0;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const random = (min, max) => min + Math.random() * (max - min);
  const distanceSq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const formatTime = (seconds) => {
    const total = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };
  const formatScore = (score) => Math.max(0, Math.floor(score)).toLocaleString('en-US');
  const xpForLevel = (level) => 10 + Math.round(((level - 1) ** 1.22) * 5);
  const compact = (items, keep) => {
    let write = 0;
    for (let read = 0; read < items.length; read += 1) {
      const item = items[read];
      if (keep(item)) items[write++] = item;
    }
    items.length = write;
  };

  const SOUNDS = {
    shot: [520, .045, .045, 'square', 340],
    hit: [150, .05, .065, 'square', 85],
    pickup: [680, .07, .065, 'sine', 980],
    hurt: [110, .15, .11, 'sawtooth', 58],
    shield: [360, .13, .08, 'triangle', 760],
    level: [520, .24, .09, 'square', 1040],
    select: [440, .12, .07, 'triangle', 880],
    over: [180, .45, .1, 'sawtooth', 48],
    record: [660, .3, .09, 'square', 1320]
  };

  const audio = {
    context: null,
    master: null,
    musicGain: null,
    voices: new Map(),
    musicActive: false,
    nextBeat: 0,
    beat: 0,
    melody: [220, 277.18, 329.63, 415.3, 329.63, 277.18, 246.94, 329.63, 220, 277.18, 369.99, 440, 369.99, 329.63, 277.18, 246.94],
    ensure() {
      if (!records.music) return null;
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return null;
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.musicGain = this.context.createGain();
        this.master.gain.value = 0.22;
        this.musicGain.gain.value = 0.26;
        this.musicGain.connect(this.master);
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return this.context;
    },
    voice(key, frequency, duration, volume, type = 'square', slide = 0, destination = null) {
      const ac = this.ensure();
      if (!ac || !records.music) return;
      this.stopVoice(key);
      const oscillator = ac.createOscillator();
      const gain = ac.createGain();
      const now = ac.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(30, frequency), now);
      if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, slide), now + duration);
      gain.gain.setValueAtTime(Math.max(.0001, volume), now);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(destination || this.master);
      const entry = { oscillator, gain };
      this.voices.set(key, entry);
      oscillator.onended = () => { if (this.voices.get(key) === entry) this.voices.delete(key); };
      oscillator.start(now);
      oscillator.stop(now + duration + .015);
    },
    stopVoice(key) {
      const entry = this.voices.get(key);
      if (!entry) return;
      try { entry.oscillator.stop(); } catch (_) { /* The voice may already have ended. */ }
      this.voices.delete(key);
    },
    sfx(kind) {
      if (!records.music) return;
      const sound = SOUNDS[kind];
      if (sound) this.voice(`sfx-${kind}`, ...sound);
    },
    startMusic() {
      if (!records.music || !this.ensure()) return;
      this.musicActive = true;
      this.nextBeat = this.context.currentTime;
      this.beat = 0;
    },
    stopMusic() {
      this.musicActive = false;
      this.stopVoice('music-lead');
      this.stopVoice('music-bass');
    },
    updateMusic() {
      if (!this.musicActive || !records.music || run.state !== 'playing' || !this.context) return;
      const now = this.context.currentTime;
      if (now + .02 < this.nextBeat) return;
      const note = this.melody[this.beat % this.melody.length];
      this.voice('music-lead', note, .13, .028, 'square', 0, this.musicGain);
      if (this.beat % 4 === 0) this.voice('music-bass', note / 4, .26, .05, 'triangle', 0, this.musicGain);
      this.beat += 1;
      this.nextBeat = now + .145;
    },
    stopAll() {
      this.musicActive = false;
      [...this.voices.keys()].forEach((key) => this.stopVoice(key));
    },
    suspend() {
      if (this.context && this.context.state === 'running') this.context.suspend().catch(() => {});
    }
  };

  const UPGRADES = [
    { id: 'speed', name: 'PHASE BOOTS', icon: '»', color: '#5cf7ff', description: '+12% movement speed', apply: (p) => { p.speed *= 1.12; } },
    { id: 'health', name: 'CORE PLATING', icon: '♥', color: '#ff5570', description: '+25 maximum health and repair 25', apply: (p) => { p.maxHealth += 25; p.health = Math.min(p.maxHealth, p.health + 25); } },
    { id: 'recovery', name: 'NANO REPAIR', icon: '+', color: '#c5ff56', description: '+0.45 health recovery per second', apply: (p) => { p.recovery += .45; } },
    { id: 'attackSpeed', name: 'OVERCLOCK', icon: '↯', color: '#ffb45d', description: '+14% attack speed', maxRank: 14, apply: (p) => { p.attackRate = Math.min(MAX_ATTACK_RATE, p.attackRate * 1.14); } },
    { id: 'damage', name: 'HEAVY ROUNDS', icon: '◆', color: '#ff4f9a', description: '+22% projectile damage', apply: (p) => { p.damage *= 1.22; } },
    { id: 'range', name: 'LONG SIGHT', icon: '⌖', color: '#8ca4ff', description: '+14% targeting range', apply: (p) => { p.range *= 1.14; } },
    { id: 'projectileSpeed', name: 'RAIL CHARGE', icon: '→', color: '#5cf7ff', description: '+20% projectile velocity', apply: (p) => { p.projectileSpeed *= 1.2; } },
    { id: 'multishot', name: 'SPLIT FIRE', icon: 'Ψ', color: '#a56eff', description: '+1 projectile per volley', maxRank: 6, apply: (p) => { p.multishot = Math.min(7, p.multishot + 1); } },
    { id: 'xpRange', name: 'MAGNET CORE', icon: '◉', color: '#65f0be', description: '+35% energy collection range', apply: (p) => { p.xpRange *= 1.35; } },
    { id: 'shield', name: 'NULL SHIELD', icon: '◇', color: '#6685ff', description: '+8% chance to block contact damage', maxRank: 6, apply: (p) => { p.shieldChance = Math.min(.48, p.shieldChance + .08); } },
    { id: 'critical', name: 'CRITICAL CODE', icon: '!', color: '#ffdf5d', description: '+8% critical hit chance', maxRank: 8, apply: (p) => { p.critChance = Math.min(.65, p.critChance + .08); } }
  ];

  function resize() {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.imageSmoothingEnabled = false;
    const starCount = Math.min(150, Math.round((width * height) / 11000));
    stars = Array.from({ length: starCount }, (_, index) => ({
      x: (Math.sin(index * 927.31) * .5 + .5) * width,
      y: (Math.sin(index * 417.73 + 2) * .5 + .5) * height,
      size: index % 7 === 0 ? 2 : 1,
      phase: index * .73
    }));
    if (run.player) {
      const marginX = Math.min(run.player.radius + 6, width / 2);
      const marginY = Math.min(run.player.radius + 6, height / 2);
      run.player.x = clamp(run.player.x, marginX, width - marginX);
      run.player.y = clamp(run.player.y, marginY, height - marginY);
    }
    for (const enemy of run.enemies) {
      enemy.x = clamp(enemy.x, -ENTITY_MARGIN, width + ENTITY_MARGIN);
      enemy.y = clamp(enemy.y, -ENTITY_MARGIN, height + ENTITY_MARGIN);
    }
    for (const drop of run.drops) {
      drop.x = clamp(drop.x, drop.radius, Math.max(drop.radius, width - drop.radius));
      drop.y = clamp(drop.y, drop.radius, Math.max(drop.radius, height - drop.radius));
    }
    compact(run.projectiles, (item) => item.x >= -20 && item.x <= width + 20 && item.y >= -20 && item.y <= height + 20);
    compact(run.particles, (item) => item.x >= -ENTITY_MARGIN && item.x <= width + ENTITY_MARGIN && item.y >= -ENTITY_MARGIN && item.y <= height + ENTITY_MARGIN);
    compact(run.popups, (item) => item.x >= -ENTITY_MARGIN && item.x <= width + ENTITY_MARGIN && item.y >= -ENTITY_MARGIN && item.y <= height + ENTITY_MARGIN);
    requestFrame();
  }

  function focusActiveScreen() {
    if (document.hidden) return;
    const screen = screens[run.state];
    screen?.querySelector('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')?.focus({ preventScroll: true });
  }

  function setState(next) {
    run.state = next;
    gameEl.dataset.state = next;
    gameEl.classList.remove('is-low-health', 'is-hit');
    Object.entries(screens).forEach(([name, element]) => { element.hidden = name !== next; });
    hud.hidden = !['playing', 'paused', 'upgrading'].includes(next);
    if (next !== 'playing') resetJoystick();
    accumulator = 0;
    queueMicrotask(focusActiveScreen);
    requestFrame();
  }

  function createPlayer() {
    return {
      x: width / 2, y: height / 2, radius: 13, angle: -Math.PI / 2,
      health: 100, maxHealth: 100, speed: 205, recovery: 0,
      damage: 20, attackRate: 2.15, attackClock: 0, range: 330,
      projectileSpeed: 540, multishot: 1, xpRange: 115,
      shieldChance: 0, critChance: .05, invulnerable: 0,
      upgrades: Object.create(null)
    };
  }

  function resetRun() {
    run.elapsed = 0;
    run.score = 0;
    run.kills = 0;
    run.level = 1;
    run.xp = 0;
    run.xpNeeded = xpForLevel(1);
    run.spawnClock = .35;
    run.pendingLevels = 0;
    run.uiClock = 0;
    run.shake = 0;
    run.pickupFlash = 0;
    run.enemies.length = 0;
    run.projectiles.length = 0;
    run.drops.length = 0;
    run.particles.length = 0;
    run.popups.length = 0;
    run.player = createPlayer();
    updateHud(true);
  }

  function beginRun() {
    audio.stopAll();
    resetRun();
    setState('playing');
    audio.ensure();
    audio.startMusic();
    dom.announcement.textContent = 'Run started';
  }

  function showMenu() {
    setState('menu');
    audio.stopAll();
    audio.suspend();
    input.keys.clear();
    renderRecords();
  }

  function pauseGame(automatic = false) {
    if (run.state !== 'playing') return;
    setState('paused');
    audio.stopAll();
    audio.suspend();
    screens.paused.querySelector('.kicker').textContent = automatic ? 'SIGNAL INTERRUPTED' : 'SYSTEM HOLD';
    screens.paused.querySelector('p:not(.kicker)').textContent = automatic ? 'The tab lost focus. Your run was paused safely.' : 'The arena is frozen. Your run is safe.';
  }

  function resumeGame() {
    if (run.state !== 'paused') return;
    setState('playing');
    lastFrame = performance.now();
    audio.startMusic();
    requestFrame();
  }

  function togglePause() {
    if (run.state === 'playing') pauseGame();
    else if (run.state === 'paused') resumeGame();
  }

  function renderRecords() {
    dom.bestScore.textContent = String(Math.floor(records.bestScore)).padStart(6, '0');
    dom.bestTime.textContent = formatTime(records.bestTime);
    dom.bestLevel.textContent = String(Math.floor(records.highestLevel)).padStart(2, '0');
  }

  function updateHud(force = false) {
    if (!run.player) return;
    if (!force && run.uiClock < .08) return;
    run.uiClock = 0;
    const player = run.player;
    dom.healthText.textContent = `${Math.ceil(player.health)} / ${Math.floor(player.maxHealth)}`;
    dom.healthFill.style.width = `${clamp(player.health / player.maxHealth * 100, 0, 100)}%`;
    gameEl.classList.toggle('is-low-health', run.state === 'playing' && player.health / player.maxHealth <= .3);
    dom.level.textContent = run.level;
    dom.xpText.textContent = `${Math.floor(run.xp)} / ${run.xpNeeded} XP`;
    dom.xpFill.style.width = `${clamp(run.xp / run.xpNeeded * 100, 0, 100)}%`;
    dom.time.textContent = formatTime(run.elapsed);
    dom.score.textContent = formatScore(run.score);
    dom.kills.textContent = run.kills;
  }

  function spawnEnemy() {
    if (run.enemies.length >= MAX_ENEMIES) return;
    const time = run.elapsed;
    const pool = ['basic', 'basic', 'basic'];
    if (time >= 10) pool.push('fast', 'fast');
    if (time >= 24) pool.push('tank');
    if (time >= 37) pool.push('zigzag', 'zigzag');
    if (time >= 50) pool.push('orbit');
    if (time >= 90) pool.push('tank', 'orbit', 'fast');
    const type = pool[Math.floor(Math.random() * pool.length)];
    const edge = Math.floor(Math.random() * 4);
    const pad = 34;
    let x;
    let y;
    if (edge === 0) { x = random(0, width); y = -pad; }
    else if (edge === 1) { x = width + pad; y = random(0, height); }
    else if (edge === 2) { x = random(0, width); y = height + pad; }
    else { x = -pad; y = random(0, height); }
    const templates = {
      basic: { radius: 14, health: 30, speed: 62, damage: 13, xp: 2, value: 90, color: '#ff5570' },
      fast: { radius: 10, health: 16, speed: 112, damage: 9, xp: 2, value: 120, color: '#ffb45d' },
      tank: { radius: 23, health: 105, speed: 37, damage: 23, xp: 7, value: 260, color: '#a56eff' },
      zigzag: { radius: 13, health: 42, speed: 72, damage: 15, xp: 4, value: 180, color: '#c5ff56' },
      orbit: { radius: 15, health: 58, speed: 83, damage: 17, xp: 5, value: 220, color: '#5cf7ff' }
    };
    const template = templates[type];
    const healthScale = 1 + time * .011 + Math.max(0, run.level - 1) * .035;
    const speedScale = 1 + Math.min(.55, time * .0026);
    const health = template.health * healthScale;
    run.enemies.push({
      id: ++entityId, type, x, y, radius: template.radius, health, maxHealth: health,
      speed: template.speed * speedScale, damage: template.damage * (1 + time * .003),
      xp: template.xp, value: template.value, color: template.color,
      phase: Math.random() * TAU, orbitDirection: Math.random() < .5 ? -1 : 1,
      attackClock: random(0, .35), flash: 0, spawn: .8, angle: 0, dead: false
    });
  }

  function addParticle(x, y, color, count = 5, speed = 90) {
    if (reducedMotion) count = Math.min(count, 2);
    const room = MAX_PARTICLES - run.particles.length;
    for (let i = 0; i < Math.min(count, room); i += 1) {
      const angle = Math.random() * TAU;
      const velocity = random(speed * .3, speed);
      run.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life: random(.22, .55), maxLife: .55, size: random(2, 5), color });
    }
  }

  function addPopup(x, y, text, color) {
    if (run.popups.length >= MAX_POPUPS) run.popups.shift();
    run.popups.push({ x, y, text, color, life: .7 });
  }

  function nearestTarget() {
    const player = run.player;
    const rangeSq = player.range ** 2;
    let nearest = null;
    let nearestSq = rangeSq;
    for (const enemy of run.enemies) {
      const dSq = distanceSq(player, enemy);
      if (!enemy.dead && dSq < nearestSq) { nearest = enemy; nearestSq = dSq; }
    }
    return nearest;
  }

  function fireVolley(target) {
    const player = run.player;
    if (!target || run.projectiles.length >= MAX_PROJECTILES) return;
    const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
    player.angle = baseAngle;
    const count = Math.min(player.multishot, MAX_PROJECTILES - run.projectiles.length);
    const spread = count > 1 ? Math.min(.48, .095 * (count - 1)) : 0;
    for (let i = 0; i < count; i += 1) {
      const offset = count === 1 ? 0 : -spread / 2 + spread * i / (count - 1);
      const angle = baseAngle + offset;
      const critical = Math.random() < player.critChance;
      run.projectiles.push({
        x: player.x + Math.cos(angle) * 17, y: player.y + Math.sin(angle) * 17,
        vx: Math.cos(angle) * player.projectileSpeed, vy: Math.sin(angle) * player.projectileSpeed,
        radius: 4, damage: player.damage * (critical ? 2 : 1), critical,
        life: player.range / player.projectileSpeed + .14, dead: false
      });
    }
    addParticle(player.x + Math.cos(baseAngle) * 18, player.y + Math.sin(baseAngle) * 18, '#5cf7ff', 2, 55);
    audio.sfx('shot');
  }

  function updatePlayer(dt) {
    const player = run.player;
    let x = (input.keys.has('ArrowRight') || input.keys.has('KeyD') ? 1 : 0) - (input.keys.has('ArrowLeft') || input.keys.has('KeyA') ? 1 : 0) + input.stickX;
    let y = (input.keys.has('ArrowDown') || input.keys.has('KeyS') ? 1 : 0) - (input.keys.has('ArrowUp') || input.keys.has('KeyW') ? 1 : 0) + input.stickY;
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) { x /= magnitude; y /= magnitude; }
    const marginX = Math.min(player.radius + 6, width / 2);
    const marginY = Math.min(player.radius + 6, height / 2);
    player.x = clamp(player.x + x * player.speed * dt, marginX, width - marginX);
    player.y = clamp(player.y + y * player.speed * dt, marginY, height - marginY);
    if (magnitude > .05) player.angle = Math.atan2(y, x);
    player.health = Math.min(player.maxHealth, player.health + player.recovery * dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
  }

  function updateAttack(dt) {
    const player = run.player;
    player.attackClock -= dt;
    if (player.attackClock <= 0) {
      const target = nearestTarget();
      if (target) {
        fireVolley(target);
        player.attackClock = 1 / player.attackRate;
      } else {
        player.attackClock = Math.max(player.attackClock, -.12);
      }
    }
  }

  function updateEnemies(dt) {
    const player = run.player;
    for (const enemy of run.enemies) {
      if (enemy.dead) continue;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / distance;
      const ny = dy / distance;
      let moveX = nx;
      let moveY = ny;
      if (enemy.type === 'zigzag') {
        const wave = Math.sin(run.elapsed * 5.2 + enemy.phase) * .82;
        moveX = nx - ny * wave;
        moveY = ny + nx * wave;
        const length = Math.hypot(moveX, moveY);
        moveX /= length; moveY /= length;
      } else if (enemy.type === 'orbit') {
        const radial = distance > 155 ? .78 : distance < 78 ? -.28 : .2;
        moveX = nx * radial + -ny * enemy.orbitDirection;
        moveY = ny * radial + nx * enemy.orbitDirection;
        const length = Math.hypot(moveX, moveY);
        moveX /= length; moveY /= length;
      }
      enemy.x += moveX * enemy.speed * dt;
      enemy.y += moveY * enemy.speed * dt;
      enemy.angle = Math.atan2(moveY, moveX);
      enemy.attackClock -= dt;
      enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.spawn = Math.max(0, enemy.spawn - dt);
      if (distance < player.radius + enemy.radius && enemy.attackClock <= 0 && player.invulnerable <= 0) {
        enemy.attackClock = .62;
        if (Math.random() < player.shieldChance) {
          player.invulnerable = .18;
          addPopup(player.x, player.y - 25, 'BLOCK', '#5cf7ff');
          addParticle(player.x, player.y, '#5cf7ff', 12, 130);
          audio.sfx('shield');
        } else {
          player.health -= enemy.damage;
          player.invulnerable = .42;
          run.shake = reducedMotion ? 0 : Math.min(10, run.shake + 5);
          gameEl.classList.remove('is-hit');
          if (!reducedMotion) {
            void gameEl.offsetWidth;
            gameEl.classList.add('is-hit');
          }
          addPopup(player.x, player.y - 25, `-${Math.ceil(enemy.damage)}`, '#ff5570');
          addParticle(player.x, player.y, '#ff5570', 14, 160);
          audio.sfx('hurt');
          if (player.health <= 0) return false;
        }
      }
    }
    return true;
  }

  function killEnemy(enemy, critical) {
    if (enemy.dead) return;
    enemy.dead = true;
    run.kills += 1;
    run.score += enemy.value;
    addParticle(enemy.x, enemy.y, enemy.color, enemy.type === 'tank' ? 18 : 10, 165);
    const pieces = enemy.xp >= 7 ? 3 : 1;
    if (run.drops.length >= MAX_DROPS) {
      const oldest = run.drops[0];
      oldest.dead = false;
      oldest.value += enemy.xp;
      oldest.life = DROP_LIFETIME;
    } else {
      for (let i = 0; i < pieces && run.drops.length < MAX_DROPS; i += 1) {
        const radius = enemy.type === 'tank' ? 6 : 5;
        run.drops.push({
          x: clamp(enemy.x + random(-8, 8), radius, Math.max(radius, width - radius)),
          y: clamp(enemy.y + random(-8, 8), radius, Math.max(radius, height - radius)),
          value: enemy.xp / pieces, radius, phase: Math.random() * TAU, life: DROP_LIFETIME, dead: false
        });
      }
    }
    if (critical) addPopup(enemy.x, enemy.y - 18, 'CRIT', '#ffdf5d');
  }

  function updateProjectiles(dt) {
    for (const projectile of run.projectiles) {
      if (projectile.dead) continue;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;
      if (projectile.life <= 0 || projectile.x < -20 || projectile.x > width + 20 || projectile.y < -20 || projectile.y > height + 20) {
        projectile.dead = true;
        continue;
      }
      for (const enemy of run.enemies) {
        if (enemy.dead) continue;
        const hitRadius = projectile.radius + enemy.radius;
        if (distanceSq(projectile, enemy) <= hitRadius * hitRadius) {
          projectile.dead = true;
          enemy.health -= projectile.damage;
          enemy.flash = .07;
          addParticle(projectile.x, projectile.y, projectile.critical ? '#ffdf5d' : '#ffffff', 4, 90);
          audio.sfx('hit');
          if (enemy.health <= 0) killEnemy(enemy, projectile.critical);
          break;
        }
      }
    }
  }

  function collectXp(value) {
    run.xp += value;
    run.score += Math.ceil(value * 5);
    run.pickupFlash = .18;
    audio.sfx('pickup');
    while (run.xp >= run.xpNeeded) {
      run.xp -= run.xpNeeded;
      run.level += 1;
      run.xpNeeded = xpForLevel(run.level);
      run.pendingLevels += 1;
    }
    if (run.pendingLevels > 0 && run.state === 'playing') openUpgrade();
  }

  function updateDrops(dt) {
    const player = run.player;
    for (const drop of run.drops) {
      if (drop.dead) continue;
      drop.phase += dt * 5;
      drop.life -= dt;
      if (drop.life <= 0 || drop.x < -ENTITY_MARGIN || drop.x > width + ENTITY_MARGIN || drop.y < -ENTITY_MARGIN || drop.y > height + ENTITY_MARGIN) {
        drop.dead = true;
        continue;
      }
      const dx = player.x - drop.x;
      const dy = player.y - drop.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      if (distance < player.xpRange) {
        const pull = 135 + (1 - distance / player.xpRange) * 390;
        drop.x += dx / distance * pull * dt;
        drop.y += dy / distance * pull * dt;
      }
      if (distance < player.radius + drop.radius + 4) {
        drop.dead = true;
        addParticle(drop.x, drop.y, '#65f0be', 5, 65);
        collectXp(drop.value);
      }
    }
  }

  function updateEffects(dt) {
    for (const particle of run.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= .96;
      particle.vy *= .96;
      particle.life -= dt;
    }
    for (const popup of run.popups) {
      popup.y -= 30 * dt;
      popup.life -= dt;
    }
    run.shake = Math.max(0, run.shake - dt * 24);
    run.pickupFlash = Math.max(0, run.pickupFlash - dt);
  }

  function cleanup() {
    compact(run.enemies, (item) => !item.dead);
    compact(run.projectiles, (item) => !item.dead);
    compact(run.drops, (item) => !item.dead);
    compact(run.particles, (item) => item.life > 0);
    compact(run.popups, (item) => item.life > 0);
  }

  function update(dt) {
    if (run.state !== 'playing') return;
    run.elapsed += dt;
    run.uiClock += dt;
    run.score += dt * (11 + run.elapsed * .022);
    updatePlayer(dt);
    run.spawnClock -= dt;
    const spawnInterval = Math.max(.19, .82 - run.elapsed * .0048);
    if (run.spawnClock <= 0) {
      spawnEnemy();
      if (run.elapsed > 75 && Math.random() < Math.min(.42, (run.elapsed - 75) / 230)) spawnEnemy();
      run.spawnClock += spawnInterval * random(.78, 1.18);
    }
    if (!updateEnemies(dt)) {
      endRun();
      return;
    }
    updateAttack(dt);
    updateProjectiles(dt);
    updateDrops(dt);
    updateEffects(dt);
    cleanup();
    updateHud();
  }

  function randomUpgradeChoices() {
    const available = UPGRADES.filter((upgrade) => !upgrade.maxRank || (run.player.upgrades[upgrade.id] || 0) < upgrade.maxRank);
    const choices = [];
    while (choices.length < 3 && available.length) {
      const index = Math.floor(Math.random() * available.length);
      choices.push(available.splice(index, 1)[0]);
    }
    return choices;
  }

  function openUpgrade() {
    if (run.state !== 'playing' || run.pendingLevels <= 0) return;
    setState('upgrading');
    audio.stopMusic();
    audio.sfx('level');
    dom.upgradeLevel.textContent = run.level - run.pendingLevels + 1;
    const choices = randomUpgradeChoices();
    dom.choices.replaceChildren(...choices.map((upgrade, index) => {
      const rank = (run.player.upgrades[upgrade.id] || 0) + 1;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'upgrade-card';
      button.style.setProperty('--accent', upgrade.color);
      button.dataset.rarity = rank >= 5 ? 'ELITE MODULE' : rank >= 3 ? 'ADVANCED MODULE' : 'STANDARD MODULE';
      button.innerHTML = `<span class="upgrade-number">0${index + 1}</span><span class="upgrade-rank">MK ${String(rank).padStart(2, '0')}</span><span class="upgrade-icon">${upgrade.icon}</span><h3>${upgrade.name}</h3><p>${upgrade.description}</p>`;
      button.addEventListener('click', () => chooseUpgrade(upgrade), { once: true });
      button.dataset.index = String(index);
      return button;
    }));
    focusActiveScreen();
    dom.announcement.textContent = 'Level up. Choose one of three upgrades.';
  }

  function chooseUpgrade(upgrade) {
    if (run.state !== 'upgrading') return;
    upgrade.apply(run.player);
    run.player.upgrades[upgrade.id] = (run.player.upgrades[upgrade.id] || 0) + 1;
    run.pendingLevels -= 1;
    audio.sfx('select');
    updateHud(true);
    if (run.pendingLevels > 0) {
      setState('playing');
      openUpgrade();
    } else {
      setState('playing');
      lastFrame = performance.now();
      audio.startMusic();
    }
  }

  function endRun() {
    if (run.state === 'gameover') return;
    const finalScore = Math.floor(run.score);
    const newScore = finalScore > records.bestScore;
    const newTime = run.elapsed > records.bestTime;
    const newLevel = run.level > records.highestLevel;
    records.bestScore = Math.max(records.bestScore, finalScore);
    records.bestTime = Math.max(records.bestTime, run.elapsed);
    records.highestLevel = Math.max(records.highestLevel, run.level);
    safeSet(STORAGE.bestScore, records.bestScore);
    safeSet(STORAGE.bestTime, records.bestTime);
    safeSet(STORAGE.highestLevel, records.highestLevel);
    setState('gameover');
    audio.stopMusic();
    audio.sfx(newScore || newTime || newLevel ? 'record' : 'over');
    dom.finalScore.textContent = formatScore(finalScore);
    dom.finalTime.textContent = formatTime(run.elapsed);
    dom.finalLevel.textContent = run.level;
    dom.finalKills.textContent = run.kills;
    const isRecord = newScore || newTime || newLevel;
    dom.recordFlash.hidden = !isRecord;
    dom.recordFlash.textContent = newScore ? 'NEW HIGH SCORE' : newTime ? 'NEW BEST TIME' : 'NEW HIGHEST LEVEL';
    dom.gameoverCard.classList.toggle('is-record', isRecord);
    $('run-status').textContent = isRecord ? 'ARCHIVE UPDATED' : 'SIGNAL LOST';
    if (isRecord) {
      for (let i = 0; i < 70; i += 1) addParticle(width / 2, height / 2, i % 2 ? '#c5ff56' : '#5cf7ff', 1, 330);
    }
    dom.announcement.textContent = `Run over. Score ${finalScore}.`;
  }

  function drawBackground(now) {
    const gradient = ctx.createRadialGradient(width * .5, height * .45, 20, width * .5, height * .45, Math.max(width, height) * .8);
    gradient.addColorStop(0, '#141a40');
    gradient.addColorStop(.48, '#090d25');
    gradient.addColorStop(1, '#03040c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(72,58,170,.055)';
    ctx.fillRect(0, height * .18, width, height * .13);
    ctx.fillStyle = 'rgba(255,79,159,.025)';
    ctx.fillRect(0, height * .72, width, height * .08);

    const grid = 48;
    const previewDrift = reducedMotion ? 0 : now * .004;
    const drift = run.state === 'playing' ? (run.elapsed * 6) % grid : previewDrift % grid;
    ctx.fillStyle = 'rgba(98,122,224,.085)';
    for (let x = -grid + drift; x < width + grid; x += grid) ctx.fillRect(Math.floor(x), 0, 1, height);
    for (let y = -grid + drift; y < height + grid; y += grid) ctx.fillRect(0, Math.floor(y), width, 1);
    ctx.fillStyle = 'rgba(92,247,255,.055)';
    const majorGrid = grid * 4;
    for (let x = -majorGrid + drift; x < width + majorGrid; x += majorGrid) ctx.fillRect(Math.floor(x), 0, 2, height);
    for (let y = -majorGrid + drift; y < height + majorGrid; y += majorGrid) ctx.fillRect(0, Math.floor(y), width, 2);

    for (const star of stars) {
      const pulse = reducedMotion ? .32 : .28 + Math.sin(now * .0018 + star.phase) * .18;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = star.size > 1 ? '#5cf7ff' : '#9da9dc';
      ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(92,247,255,.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(7.5, 7.5, width - 15, height - 15);
    ctx.strokeStyle = 'rgba(102,133,255,.13)';
    ctx.strokeRect(12.5, 12.5, width - 25, height - 25);

    const rail = Math.min(92, width * .12, height * .12);
    ctx.fillStyle = 'rgba(97,246,255,.62)';
    ctx.fillRect(7, 7, rail, 3); ctx.fillRect(7, 7, 3, rail);
    ctx.fillRect(width - rail - 7, 7, rail, 3); ctx.fillRect(width - 10, 7, 3, rail);
    ctx.fillStyle = 'rgba(255,79,159,.55)';
    ctx.fillRect(7, height - 10, rail, 3); ctx.fillRect(7, height - rail - 7, 3, rail);
    ctx.fillRect(width - rail - 7, height - 10, rail, 3); ctx.fillRect(width - 10, height - rail - 7, 3, rail);

    if (width > 620) {
      ctx.globalAlpha = .34;
      ctx.fillStyle = '#8c9bd1';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('SECTOR 09 // ARENA LIVE', 22, height - 22);
      ctx.textAlign = 'right';
      ctx.fillText(`X${String(Math.floor(width)).padStart(4, '0')} Y${String(Math.floor(height)).padStart(4, '0')}`, width - 22, height - 22);
      ctx.globalAlpha = 1;
    }
  }

  function glow(color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  function drawPreviewActor(x, y, color, kind, angle, scale = 1) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    glow(color, 15);
    ctx.fillStyle = color;
    if (kind === 'ship') {
      ctx.beginPath();
      ctx.moveTo(0, -16); ctx.lineTo(12, 12); ctx.lineTo(0, 7); ctx.lineTo(-12, 12); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-3, -7, 6, 7);
      ctx.fillStyle = '#ff4f9f';
      ctx.fillRect(-5, 11, 3, 6); ctx.fillRect(2, 11, 3, 6);
    } else if (kind === 'orbit') {
      ctx.lineWidth = 4;
      ctx.strokeStyle = color;
      ctx.strokeRect(-10, -10, 20, 20);
      ctx.fillRect(-3, -15, 6, 7); ctx.fillRect(-3, 8, 6, 7);
    } else if (kind === 'fast') {
      ctx.beginPath();
      ctx.moveTo(0, -13); ctx.lineTo(10, 10); ctx.lineTo(0, 6); ctx.lineTo(-10, 10); ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = '#351329';
      ctx.fillRect(-6, -4, 4, 5); ctx.fillRect(2, -4, 4, 5);
    }
    ctx.restore();
  }

  function drawMenuPreview(now) {
    const time = reducedMotion ? 0 : now * .001;
    const centerX = width * .5;
    const centerY = height * .52;
    ctx.save();
    ctx.globalAlpha = .48;
    drawPreviewActor(centerX + Math.sin(time * .7) * width * .27, centerY + Math.cos(time * .9) * height * .25, '#61f6ff', 'ship', time * .35, 1.05);
    drawPreviewActor(width * .08 + Math.sin(time * .8) * 20, height * .7 + Math.cos(time) * 18, '#ff526f', 'basic', time * .24, .9);
    drawPreviewActor(width * .91 + Math.cos(time * .65) * 18, height * .32 + Math.sin(time * .8) * 24, '#ffb45d', 'fast', -time * .42, .9);
    drawPreviewActor(width * .79 + Math.sin(time * .5) * 35, height * .86, '#aa73ff', 'basic', time * .16, 1.25);
    drawPreviewActor(width * .18, height * .17 + Math.cos(time * .55) * 20, '#61f6ff', 'orbit', time * .3, .85);
    ctx.strokeStyle = 'rgba(97,246,255,.46)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      const travel = (time * 190 + i * 170) % Math.max(220, width * .6);
      ctx.beginPath();
      ctx.moveTo(width * .18 + travel, height * .17 + i * 8);
      ctx.lineTo(width * .18 + travel + 22, height * .17 + i * 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDrop(drop) {
    const bob = reducedMotion ? 0 : Math.sin(drop.phase) * 2;
    ctx.save();
    ctx.translate(Math.round(drop.x), Math.round(drop.y + bob));
    ctx.rotate(Math.PI / 4);
    glow('#65f0be', 12);
    ctx.strokeStyle = `rgba(101,240,190,${.25 + Math.sin(drop.phase) * .08})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(-drop.radius - 5, -drop.radius - 5, (drop.radius + 5) * 2, (drop.radius + 5) * 2);
    ctx.fillStyle = '#173d38';
    ctx.fillRect(-drop.radius - 1, -drop.radius - 1, (drop.radius + 1) * 2, (drop.radius + 1) * 2);
    ctx.fillStyle = '#65f0be';
    ctx.fillRect(-drop.radius, -drop.radius, drop.radius * 2, drop.radius * 2);
    ctx.fillStyle = '#d9fff1';
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  }

  function drawProjectile(projectile) {
    ctx.save();
    ctx.translate(Math.round(projectile.x), Math.round(projectile.y));
    ctx.rotate(Math.atan2(projectile.vy, projectile.vx));
    glow(projectile.critical ? '#ffdf5d' : '#5cf7ff', projectile.critical ? 15 : 10);
    ctx.fillStyle = projectile.critical ? 'rgba(255,223,93,.25)' : 'rgba(92,247,255,.2)';
    ctx.fillRect(-17, -1, 12, 2);
    ctx.fillStyle = projectile.critical ? '#ffdf5d' : '#d5fdff';
    ctx.fillRect(-7, -2, 14, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, -1, 6, 2);
    ctx.restore();
  }

  function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(Math.round(enemy.x), Math.round(enemy.y));
    if (enemy.spawn > 0) {
      const progress = enemy.spawn / .8;
      ctx.globalAlpha = 1 - progress * .55;
      ctx.strokeStyle = enemy.color;
      ctx.lineWidth = 1;
      const scanSize = enemy.radius + 8 + progress * 12;
      ctx.strokeRect(-scanSize, -scanSize, scanSize * 2, scanSize * 2);
      ctx.fillStyle = enemy.color;
      ctx.fillRect(-scanSize - 4, -1, 5, 2); ctx.fillRect(scanSize - 1, -1, 5, 2);
      ctx.fillRect(-1, -scanSize - 4, 2, 5); ctx.fillRect(-1, scanSize - 1, 2, 5);
      ctx.globalAlpha = 1;
    }
    ctx.rotate(enemy.angle + Math.PI / 2);
    const r = enemy.radius;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,.38)';
    ctx.fillRect(-r + 4, -r + 6, r * 2, r * 2);
    glow(enemy.color, enemy.flash > 0 ? 20 : 12);
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : enemy.color;
    if (enemy.type === 'basic') {
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.fillStyle = '#711a38'; ctx.fillRect(-r, -r, r * 2, 3); ctx.fillRect(-r, r - 3, r * 2, 3);
      ctx.fillStyle = '#2b0b1c'; ctx.fillRect(-6, -4, 4, 6); ctx.fillRect(2, -4, 4, 6);
      ctx.fillStyle = '#ffd4df'; ctx.fillRect(-5, -3, 2, 2); ctx.fillRect(3, -3, 2, 2);
    } else if (enemy.type === 'fast') {
      ctx.beginPath(); ctx.moveTo(0, -r - 4); ctx.lineTo(r, r); ctx.lineTo(0, r - 3); ctx.lineTo(-r, r); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5c3213'; ctx.fillRect(-2, -5, 4, 11);
      ctx.fillStyle = '#fff0c9'; ctx.fillRect(-1, -7, 2, 5);
    } else if (enemy.type === 'tank') {
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.fillStyle = '#271746'; ctx.fillRect(-r + 6, -r + 6, r * 2 - 12, r * 2 - 12);
      ctx.strokeStyle = enemy.color; ctx.lineWidth = 2; ctx.strokeRect(-r + 10, -r + 10, r * 2 - 20, r * 2 - 20);
      ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : enemy.color; ctx.fillRect(-6, -6, 12, 12);
      ctx.fillStyle = '#e8d7ff'; ctx.fillRect(-2, -8, 4, 5);
    } else if (enemy.type === 'zigzag') {
      ctx.beginPath(); ctx.moveTo(0, -r - 4); ctx.lineTo(r + 3, 0); ctx.lineTo(0, r + 4); ctx.lineTo(-r - 3, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#283512'; ctx.fillRect(-3, -9, 6, 18);
      ctx.fillStyle = '#f1ffc9'; ctx.fillRect(-1, -7, 2, 5);
    } else {
      ctx.lineWidth = 5; ctx.strokeStyle = enemy.color; ctx.beginPath(); ctx.arc(0, 0, r - 2, 0, TAU); ctx.stroke();
      ctx.fillStyle = enemy.color; ctx.fillRect(-4, -r - 5, 8, 9); ctx.fillRect(-4, r - 4, 8, 9);
      ctx.fillRect(-r - 5, -3, 8, 6); ctx.fillRect(r - 3, -3, 8, 6);
      ctx.fillStyle = '#d9fdff'; ctx.fillRect(-3, -3, 6, 6);
    }
    ctx.restore();
    if (enemy.type === 'tank' || enemy.health < enemy.maxHealth * .55) {
      const w = enemy.radius * 2;
      ctx.fillStyle = 'rgba(3,4,12,.88)'; ctx.fillRect(enemy.x - w / 2 - 1, enemy.y - enemy.radius - 12, w + 2, 5);
      ctx.fillStyle = enemy.color; ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 11, w * clamp(enemy.health / enemy.maxHealth, 0, 1), 3);
    }
  }

  function drawPlayer(now) {
    const player = run.player;
    if (!player) return;
    ctx.save();
    if (player.invulnerable > 0 && Math.floor(now / 55) % 2 === 0) ctx.globalAlpha = .35;
    ctx.translate(Math.round(player.x), Math.round(player.y));
    ctx.rotate(player.angle + Math.PI / 2);
    const enginePulse = reducedMotion ? 4 : 3 + Math.floor((now / 80) % 3) * 2;
    glow('#ff4f9a', 11);
    ctx.fillStyle = 'rgba(255,79,154,.42)';
    ctx.fillRect(-5, 16, 3, enginePulse + 4); ctx.fillRect(2, 16, 3, enginePulse + 4);
    ctx.fillStyle = '#fff0f7';
    ctx.fillRect(-4, 16, 1, enginePulse); ctx.fillRect(3, 16, 1, enginePulse);
    glow('#5cf7ff', 20);
    ctx.fillStyle = '#5cf7ff';
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(13, 12); ctx.lineTo(5, 9); ctx.lineTo(0, 16); ctx.lineTo(-5, 9); ctx.lineTo(-13, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#204a88'; ctx.fillRect(-10, 7, 6, 4); ctx.fillRect(4, 7, 6, 4);
    ctx.fillStyle = '#18275c'; ctx.fillRect(-5, -4, 10, 12);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-3, -10, 6, 7);
    ctx.fillStyle = '#b8fbff'; ctx.fillRect(-1, -14, 2, 4);
    ctx.fillStyle = '#ff4f9a'; ctx.fillRect(-6, 12, 4, 5); ctx.fillRect(2, 12, 4, 5);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(97,246,255,.18)';
    ctx.lineWidth = 1;
    const bracket = player.radius + 12;
    ctx.beginPath();
    ctx.moveTo(player.x - bracket, player.y - bracket + 6); ctx.lineTo(player.x - bracket, player.y - bracket); ctx.lineTo(player.x - bracket + 6, player.y - bracket);
    ctx.moveTo(player.x + bracket - 6, player.y + bracket); ctx.lineTo(player.x + bracket, player.y + bracket); ctx.lineTo(player.x + bracket, player.y + bracket - 6);
    ctx.stroke();
    if (player.shieldChance > 0) {
      ctx.strokeStyle = `rgba(92,247,255,${.14 + player.shieldChance * .8})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 9, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(92,247,255,.5)';
      ctx.fillRect(player.x - 2, player.y - player.radius - 12, 4, 4);
      ctx.fillRect(player.x - 2, player.y + player.radius + 8, 4, 4);
    }
    if (run.pickupFlash > 0) {
      ctx.globalAlpha = clamp(run.pickupFlash / .18, 0, 1);
      ctx.strokeStyle = '#65f0be';
      ctx.lineWidth = 2;
      ctx.strokeRect(player.x - player.radius - 10, player.y - player.radius - 10, (player.radius + 10) * 2, (player.radius + 10) * 2);
      ctx.globalAlpha = 1;
    }
  }

  function drawEffects() {
    for (const particle of run.particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      const size = Math.max(1, Math.round(particle.size));
      ctx.fillRect(Math.round(particle.x), Math.round(particle.y), size, size);
      if (size >= 4) {
        ctx.globalAlpha *= .35;
        ctx.fillRect(Math.round(particle.x - size), Math.round(particle.y + size / 2), size, 1);
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'miter';
    for (const popup of run.popups) {
      ctx.globalAlpha = clamp(popup.life / .35, 0, 1);
      ctx.strokeStyle = 'rgba(3,4,12,.9)';
      ctx.strokeText(popup.text, Math.round(popup.x), Math.round(popup.y));
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, Math.round(popup.x), Math.round(popup.y));
    }
    ctx.globalAlpha = 1;
  }

  function render(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(now);
    if (run.state === 'menu') {
      drawMenuPreview(now);
      return;
    }
    if (!run.player || run.state === 'how') return;
    ctx.save();
    if (!reducedMotion && run.shake > 0) ctx.translate(random(-run.shake, run.shake), random(-run.shake, run.shake));
    for (const drop of run.drops) drawDrop(drop);
    for (const projectile of run.projectiles) drawProjectile(projectile);
    for (const enemy of run.enemies) drawEnemy(enemy);
    drawPlayer(now);
    drawEffects();
    ctx.restore();
  }

  function loop(now) {
    rafId = null;
    if (!lastFrame) lastFrame = now;
    const delta = Math.min(.1, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (run.state === 'playing') {
      accumulator = Math.min(.2, accumulator + delta);
      while (accumulator >= FIXED_STEP) {
        update(FIXED_STEP);
        accumulator -= FIXED_STEP;
      }
    } else {
      accumulator = 0;
    }
    audio.updateMusic();
    render(now);
    if ((run.state === 'playing' || (run.state === 'menu' && !reducedMotion)) && !document.hidden) requestFrame();
  }

  function requestFrame() {
    if (rafId === null && !document.hidden) rafId = window.requestAnimationFrame(loop);
  }

  function resetJoystick() {
    input.stickX = 0;
    input.stickY = 0;
    input.pointerId = null;
    dom.stickKnob.style.transform = 'translate(0px, 0px)';
    dom.joystick.classList.remove('is-active');
  }

  function updateJoystick(event) {
    if (event.pointerId !== input.pointerId) return;
    const rect = dom.joystick.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const max = rect.width * .32;
    const length = Math.hypot(dx, dy);
    const scale = length > max ? max / length : 1;
    const x = dx * scale;
    const y = dy * scale;
    input.stickX = x / max;
    input.stickY = y / max;
    dom.stickKnob.style.transform = `translate(${x}px, ${y}px)`;
  }

  function releaseJoystick(event) {
    if (event.pointerId !== input.pointerId) return;
    try { dom.joystick.releasePointerCapture(event.pointerId); } catch (_) { /* Capture may already be released. */ }
    resetJoystick();
  }

  function toggleSound() {
    records.music = !records.music;
    safeSet(STORAGE.music, records.music ? 'on' : 'off');
    dom.soundButton.setAttribute('aria-pressed', String(records.music));
    dom.soundIcon.textContent = records.music ? '♪' : '×';
    dom.soundLabel.textContent = records.music ? 'Sound on' : 'Sound off';
    if (records.music) {
      audio.ensure();
      audio.sfx('select');
      if (run.state === 'playing') audio.startMusic();
    } else {
      audio.stopAll();
      audio.suspend();
    }
  }

  $('play-btn').addEventListener('click', beginRun);
  $('restart-btn').addEventListener('click', beginRun);
  $('how-btn').addEventListener('click', () => setState('how'));
  $('how-close').addEventListener('click', showMenu);
  $('pause-btn').addEventListener('click', () => pauseGame());
  $('resume-btn').addEventListener('click', resumeGame);
  $('pause-menu-btn').addEventListener('click', showMenu);
  $('gameover-menu-btn').addEventListener('click', showMenu);
  dom.soundButton.addEventListener('click', toggleSound);

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code) && run.state === 'playing') event.preventDefault();
    if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) {
      if (run.state === 'playing' || run.state === 'paused') {
        event.preventDefault();
        togglePause();
      }
      return;
    }
    if (run.state === 'upgrading' && ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].includes(event.code)) {
      const index = Number(event.code.slice(-1)) - 1;
      dom.choices.querySelector(`[data-index="${index}"]`)?.click();
      return;
    }
    input.keys.add(event.code);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const screen = screens[run.state];
    if (!screen || screen.hidden || run.state === 'menu') return;
    const focusable = [...screen.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !screen.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !screen.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });
  window.addEventListener('keyup', (event) => input.keys.delete(event.code));
  window.addEventListener('blur', () => {
    input.keys.clear();
    resetJoystick();
    if (!document.hidden) pauseGame(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseGame(true);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      rafId = null;
      audio.stopAll();
      audio.suspend();
    } else {
      requestFrame();
      focusActiveScreen();
    }
    lastFrame = performance.now();
  });
  window.addEventListener('resize', resize, { passive: true });

  window.addEventListener('pagehide', () => {
    input.keys.clear();
    resetJoystick();
    pauseGame(true);
    if (rafId !== null) window.cancelAnimationFrame(rafId);
    rafId = null;
    audio.stopAll();
    audio.suspend();
  });
  window.addEventListener('pageshow', () => {
    lastFrame = performance.now();
    requestFrame();
    focusActiveScreen();
  });

  const detectTouch = (event) => {
    if (event.pointerType === 'touch') document.documentElement.classList.add('touch-detected');
  };
  if (navigator.maxTouchPoints > 0) document.documentElement.classList.add('touch-detected');
  window.addEventListener('pointerdown', detectTouch, { passive: true });

  dom.joystick.addEventListener('pointerdown', (event) => {
    if (run.state !== 'playing' || input.pointerId !== null) return;
    input.pointerId = event.pointerId;
    dom.joystick.classList.add('is-active');
    dom.joystick.setPointerCapture(event.pointerId);
    updateJoystick(event);
  });
  dom.joystick.addEventListener('pointermove', updateJoystick);
  dom.joystick.addEventListener('pointerup', releaseJoystick);
  dom.joystick.addEventListener('pointercancel', releaseJoystick);
  dom.joystick.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId === input.pointerId) resetJoystick();
  });

  window.addEventListener('beforeunload', () => {
    if (rafId !== null) window.cancelAnimationFrame(rafId);
    rafId = null;
    audio.stopAll();
    if (audio.context && audio.context.state !== 'closed') audio.context.close().catch(() => {});
  });

  const handleMotionPreference = (event) => {
    reducedMotion = event.matches;
    if (reducedMotion) {
      run.particles.length = 0;
      run.shake = 0;
      gameEl.classList.remove('is-hit');
    }
    requestFrame();
  };
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', handleMotionPreference);
  else motionQuery.addListener(handleMotionPreference);

  resize();
  renderRecords();
  dom.soundButton.setAttribute('aria-pressed', String(records.music));
  dom.soundIcon.textContent = records.music ? '♪' : '×';
  dom.soundLabel.textContent = records.music ? 'Sound on' : 'Sound off';
  setState('menu');
  requestFrame();
})();
