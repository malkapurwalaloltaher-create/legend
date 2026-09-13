(() => {
  "use strict";
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const ui = {
    score: document.getElementById("score"), combo: document.getElementById("combo"), mode: document.getElementById("mode-label"),
    best: document.getElementById("best-score"), runs: document.getElementById("run-count"), menu: document.getElementById("menu-screen"),
    result: document.getElementById("result-screen"), resultScore: document.getElementById("result-score"), resultKicker: document.getElementById("result-kicker"), resultDetail: document.getElementById("result-detail")
  };
  const KEY = "lxtNeonSnakeStats";
  let stats = readStats();
  let snake, direction, pendingDirection, food, score, combo, mode = "classic", timer, running = false, paused = false, lastMove = 0, interval = 105, touchStart = null;

  function readStats() { try { return JSON.parse(localStorage.getItem(KEY)) || { best: 0, runs: 0 }; } catch { return { best: 0, runs: 0 }; } }
  function saveStats() { try { localStorage.setItem(KEY, JSON.stringify(stats)); } catch {} }
  function updateStats() { ui.best.textContent = String(stats.best).padStart(4, "0"); ui.runs.textContent = String(stats.runs).padStart(2, "0"); }
  function randomCell() {
    let cell;
    do { cell = { x: Math.floor(Math.random() * 24), y: Math.floor(Math.random() * 24) }; } while (snake.some((part) => part.x === cell.x && part.y === cell.y));
    return cell;
  }
  function setDirection(next) {
    const opposite = next.x === -direction.x && next.y === -direction.y;
    if (!opposite) pendingDirection = next;
  }
  function start() {
    const speeds = { easy: 135, normal: 100, hard: 72 };
    mode = document.querySelector(".choice.active").dataset.mode;
    interval = speeds[document.getElementById("difficulty").value];
    snake = [{ x: 12, y: 12 }, { x: 11, y: 12 }, { x: 10, y: 12 }];
    direction = pendingDirection = { x: 1, y: 0 }; food = randomCell(); score = 0; combo = 1; timer = mode === "blitz" ? 60 : null;
    running = true; paused = false; lastMove = performance.now(); ui.menu.classList.add("hidden"); ui.result.classList.add("hidden"); ui.mode.textContent = mode.toUpperCase(); document.getElementById("pause-btn").textContent = "PAUSE"; updateHud(); requestAnimationFrame(loop);
  }
  function move() {
    direction = pendingDirection;
    let head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    if (mode === "zen") { head.x = (head.x + 24) % 24; head.y = (head.y + 24) % 24; }
    const wall = head.x < 0 || head.x >= 24 || head.y < 0 || head.y >= 24;
    const self = snake.some((part) => part.x === head.x && part.y === head.y);
    if (wall || self) return end("SIGNAL LOST");
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) { combo = Math.min(9, combo + 1); score += 10 * combo; food = randomCell(); beep(620 + combo * 35); if (mode !== "zen") interval = Math.max(48, interval - 2); }
    else { snake.pop(); combo = Math.max(1, combo - .04); }
    updateHud();
  }
  function loop(now) {
    if (!running) return;
    if (!paused && now - lastMove >= interval) { move(); lastMove = now; if (timer !== null) { timer -= interval / 1000; if (timer <= 0) return end("TIME COMPLETE"); } }
    draw(); requestAnimationFrame(loop);
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); const cell = canvas.width / 24;
    ctx.fillStyle = "#ff4fc8"; ctx.shadowColor = "#ff4fc8"; ctx.shadowBlur = 24; ctx.beginPath(); ctx.arc((food.x + .5) * cell, (food.y + .5) * cell, cell * .27, 0, Math.PI * 2); ctx.fill();
    snake.forEach((part, index) => { const fade = 1 - index / Math.max(20, snake.length * 1.2); ctx.fillStyle = index ? `rgba(92,242,255,${Math.max(.25, fade)})` : "#efffff"; ctx.shadowColor = "#5cf2ff"; ctx.shadowBlur = index ? 10 : 22; ctx.fillRect(part.x * cell + 4, part.y * cell + 4, cell - 8, cell - 8); });
    ctx.shadowBlur = 0;
    if (paused) { ctx.fillStyle = "rgba(4,3,13,.72)"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle = "#fff"; ctx.font = "900 44px system-ui"; ctx.textAlign = "center"; ctx.fillText("PAUSED", canvas.width/2, canvas.height/2); }
  }
  function updateHud() { ui.score.textContent = String(Math.round(score)).padStart(4, "0"); ui.combo.textContent = `x${Math.max(1, Math.floor(combo))}`; if (timer !== null) ui.mode.textContent = `${mode.toUpperCase()} ${Math.max(0, Math.ceil(timer))}s`; }
  function end(label) { running = false; stats.runs++; stats.best = Math.max(stats.best, Math.round(score)); saveStats(); updateStats(); ui.resultKicker.textContent = label; ui.resultScore.textContent = String(Math.round(score)).padStart(4, "0"); ui.resultDetail.textContent = score >= stats.best && score > 0 ? "New personal signal record." : "Run archived locally."; ui.result.classList.remove("hidden"); beep(170); }
  function beep(frequency) { try { const audio = new AudioContext(); const oscillator = audio.createOscillator(); const gain = audio.createGain(); oscillator.frequency.value = frequency; oscillator.type = "square"; gain.gain.setValueAtTime(.035, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .08); oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + .08); } catch {} }
  document.querySelectorAll(".choice").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll(".choice").forEach((item) => item.classList.remove("active")); button.classList.add("active"); }));
  document.getElementById("start-btn").addEventListener("click", start); document.getElementById("restart-btn").addEventListener("click", start); document.getElementById("menu-btn").addEventListener("click", () => { ui.result.classList.add("hidden"); ui.menu.classList.remove("hidden"); });
  document.getElementById("pause-btn").addEventListener("click", () => { if (!running) return; paused = !paused; document.getElementById("pause-btn").textContent = paused ? "RESUME" : "PAUSE"; if (!paused) lastMove = performance.now(); });
  const dirs = { ArrowUp:{x:0,y:-1},w:{x:0,y:-1},ArrowDown:{x:0,y:1},s:{x:0,y:1},ArrowLeft:{x:-1,y:0},a:{x:-1,y:0},ArrowRight:{x:1,y:0},d:{x:1,y:0} };
  addEventListener("keydown", (event) => { if (dirs[event.key]) { event.preventDefault(); setDirection(dirs[event.key]); } if ((event.key === "p" || event.key === "Escape") && running) document.getElementById("pause-btn").click(); });
  document.querySelectorAll("[data-dir]").forEach((button) => button.addEventListener("pointerdown", () => setDirection({ up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0} }[button.dataset.dir])));
  canvas.addEventListener("pointerdown", (event) => { touchStart = { x:event.clientX,y:event.clientY }; }); canvas.addEventListener("pointerup", (event) => { if (!touchStart) return; const dx=event.clientX-touchStart.x,dy=event.clientY-touchStart.y; if (Math.max(Math.abs(dx),Math.abs(dy))>18) setDirection(Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)}); touchStart=null; });
  updateStats(); draw();
})();
