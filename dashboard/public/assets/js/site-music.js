(function () {
  "use strict";

  const MUSIC_CONFIG = {
    defaultTrack: "/assets/audio/legendary-labs-bg.mp3",
    pages: [
      { match: "/sites/reflex-rush", track: "/assets/audio/reflex-rush-bg.mp3", title: "Reflex Rush", dashboard: false },
      { match: "/sites/color-clash", track: "/assets/audio/color-clash-bg.mp3", title: "Color Clash", dashboard: false },
      { match: "/sites/ascii", track: "/assets/audio/ascii-bg.mp3", title: "ASCII Generator", dashboard: false },
      { match: "/sites/password", track: "/assets/audio/password-bg.mp3", title: "Password Generator", dashboard: false },
      { match: "/sites/websites", track: "/assets/audio/websites-bg.mp3", title: "100 Useful Websites", dashboard: false },
      { match: "/login", track: "/assets/audio/dashboard-bg.mp3", title: "Legendary Bot Dashboard", dashboard: true },
      { match: "/customer", track: "/assets/audio/dashboard-bg.mp3", title: "Legendary Bot Dashboard", dashboard: true },
      { match: "/app", track: "/assets/audio/dashboard-bg.mp3", title: "Legendary Bot Dashboard", dashboard: true },
      { match: "/dashboard", track: "/assets/audio/dashboard-bg.mp3", title: "Legendary Bot Dashboard", dashboard: true },
      { match: "/discord", track: "/assets/audio/dashboard-bg.mp3", title: "Legendary Bot Dashboard", dashboard: true }
    ]
  };

  const path = window.location.pathname.toLowerCase();
  const page = MUSIC_CONFIG.pages.find((item) => path.startsWith(item.match)) || {
    track: MUSIC_CONFIG.defaultTrack,
    title: "Legendary Labs",
    dashboard: false
  };

  const DB_NAME = "legendaryDashboardMusicDB";
  const DB_VERSION = 1;
  const STORE_NAME = "music";
  const CUSTOM_MUSIC_KEY = "customDashboardMusic";
  const STORAGE = {
    musicState: "legendaryLabsGlobalMusic",
    volume: "legendaryDashboardMusicVolume",
    autoplay: "legendaryDashboardAutoPlay",
    uiEffects: "legendaryDashboardUiEffects",
    cardAnimations: "legendaryDashboardCardAnimations",
    customMusicName: "legendaryDashboardCustomMusicName"
  };

  const allowedAudioTypes = new Set([
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/m4a",
    "audio/mp4",
    "audio/aac",
    "audio/ogg",
    "audio/opus"
  ]);

  const allowedExtensions = new Set(["mp3", "m4a", "wav", "opus"]);
  const isDashboardPage = Boolean(page.dashboard);

  // IMPORTANT: This file is for dashboard/login/customer/bot pages only.
  // Mini-sites use their own built-in sound buttons, so do not inject the floating music dock there.
  if (!isDashboardPage) {
    return;
  }

  let musicOn = false;
  let currentObjectUrl = null;
  let selectedPreviewFile = null;
  let selectedPreviewUrl = null;
  let previewAudio = null;
  let customTrackLoaded = false;

  const audio = document.createElement("audio");
  audio.id = "siteMusicAudio";
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = getSavedVolume();
  document.body.appendChild(audio);

  function getSavedVolume() {
    const saved = Number(localStorage.getItem(STORAGE.volume));
    if (Number.isFinite(saved)) return Math.max(0, Math.min(1, saved));
    return 0.38;
  }

  function getAutoplayEnabled() {
    const saved = localStorage.getItem(STORAGE.autoplay);
    return saved !== "off";
  }

  function getUiEffectsEnabled() {
    const saved = localStorage.getItem(STORAGE.uiEffects);
    return saved !== "off";
  }

  function getCardAnimationsEnabled() {
    const saved = localStorage.getItem(STORAGE.cardAnimations);
    return saved !== "off";
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB is not supported in this browser."));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open music database."));
    });
  }

  async function saveCustomMusicToDB(file) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.put({
        id: CUSTOM_MUSIC_KEY,
        name: file.name,
        type: file.type || "audio/mpeg",
        size: file.size,
        updatedAt: Date.now(),
        blob: file
      });
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error || new Error("Could not save custom music."));
    });
  }

  async function getCustomMusicFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(CUSTOM_MUSIC_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not read custom music."));
    });
  }

  async function deleteCustomMusicFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.delete(CUSTOM_MUSIC_KEY);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error || new Error("Could not reset custom music."));
    });
  }

  function releaseObjectUrl() {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
  }

  function setDefaultTrack() {
    releaseObjectUrl();
    customTrackLoaded = false;
    audio.src = page.track;
  }

  async function loadDashboardTrack() {
    if (!isDashboardPage) {
      setDefaultTrack();
      return;
    }

    try {
      const custom = await getCustomMusicFromDB();
      if (custom && custom.blob) {
        releaseObjectUrl();
        currentObjectUrl = URL.createObjectURL(custom.blob);
        audio.src = currentObjectUrl;
        customTrackLoaded = true;
        localStorage.setItem(STORAGE.customMusicName, custom.name || "Custom dashboard music");
      } else {
        setDefaultTrack();
      }
    } catch (error) {
      setDefaultTrack();
    }
  }

  function validateAudioFile(file) {
    if (!file) return "Please choose an audio file first.";

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const typeOk = allowedAudioTypes.has(file.type);
    const extOk = allowedExtensions.has(ext);

    if (!typeOk && !extOk) {
      return "Invalid format. Please use MP3, M4A, WAV, or OPUS only.";
    }

    const maxSizeMB = 18;
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `This file is too large. Please choose a file under ${maxSizeMB}MB.`;
    }

    return "";
  }

  const style = document.createElement("style");
  style.textContent = `
    .ll-music-entry{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 18% 18%,rgba(139,92,246,.32),transparent 34rem),radial-gradient(circle at 80% 20%,rgba(34,211,238,.17),transparent 30rem),linear-gradient(135deg,rgba(3,5,19,.97),rgba(9,13,36,.98));backdrop-filter:blur(18px);transition:opacity .35s ease,visibility .35s ease}.ll-music-entry.ll-hide{opacity:0;visibility:hidden;pointer-events:none}.ll-music-card{width:min(540px,100%);padding:28px;border-radius:30px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(145deg,rgba(255,255,255,.11),rgba(255,255,255,.045));box-shadow:0 35px 120px rgba(0,0,0,.55);text-align:center;color:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.ll-music-badge{display:inline-flex;margin-bottom:14px;padding:8px 13px;border-radius:999px;border:1px solid rgba(34,211,238,.30);background:rgba(34,211,238,.10);color:#cffafe;font-weight:1000;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase}.ll-music-card h2{margin:0;font-size:clamp(2rem,7vw,3.4rem);line-height:.95;letter-spacing:-.06em}.ll-music-card h2 span{background:linear-gradient(135deg,#a78bfa,#22d3ee);-webkit-background-clip:text;background-clip:text;color:transparent}.ll-music-card p{margin:15px auto 22px;max-width:420px;color:#cbd5ff;line-height:1.6;font-weight:650}.ll-music-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}.ll-music-btn{border:0;border-radius:17px;padding:13px 17px;font-weight:1000;cursor:pointer;color:#f8fafc;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 45px rgba(0,0,0,.25);transition:.2s}.ll-music-btn:hover{transform:translateY(-3px) scale(1.03);border-color:rgba(34,211,238,.35)}.ll-music-btn.primary{color:#06111d;background:linear-gradient(135deg,#8b5cf6,#22d3ee);border:0}.ll-music-dock{position:fixed;left:18px;bottom:18px;z-index:99998;display:flex;gap:9px;align-items:center}.ll-music-float,.ll-settings-float{border:1px solid rgba(34,211,238,.30);border-radius:999px;background:rgba(7,12,31,.82);color:#e0f2fe;font-weight:1000;padding:10px 13px;cursor:pointer;box-shadow:0 18px 50px rgba(0,0,0,.32);backdrop-filter:blur(12px);transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease}.ll-music-float:hover,.ll-settings-float:hover{transform:translateY(-2px) scale(1.04);border-color:rgba(34,211,238,.65);box-shadow:0 22px 60px rgba(0,0,0,.42),0 0 24px rgba(34,211,238,.18)}.ll-settings-float{width:43px;height:43px;display:grid;place-items:center;padding:0;font-size:1.1rem}.ll-settings-float span{display:block;transition:transform .45s ease}.ll-settings-float:hover span{transform:rotate(180deg) scale(1.1)}.ll-settings-overlay{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:20px;background:rgba(2,6,23,.62);backdrop-filter:blur(14px);opacity:0;pointer-events:none;transition:.22s}.ll-settings-overlay.show{opacity:1;pointer-events:auto}.ll-settings-modal{width:min(620px,100%);max-height:min(86vh,760px);overflow:auto;border-radius:28px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(145deg,rgba(9,13,36,.96),rgba(13,18,47,.92));box-shadow:0 35px 120px rgba(0,0,0,.58);color:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;transform:translateY(14px) scale(.96);transition:.22s}.ll-settings-overlay.show .ll-settings-modal{transform:translateY(0) scale(1)}.ll-settings-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:21px 22px;border-bottom:1px solid rgba(255,255,255,.10)}.ll-settings-head h2{margin:0;font-size:1.35rem;letter-spacing:-.03em}.ll-settings-close{border:0;border-radius:999px;width:38px;height:38px;cursor:pointer;color:#fff;background:rgba(255,255,255,.08);font-weight:1000}.ll-settings-body{padding:22px;display:grid;gap:18px}.ll-settings-section{border:1px solid rgba(255,255,255,.11);border-radius:22px;padding:16px;background:rgba(255,255,255,.055)}.ll-settings-section h3{margin:0 0 8px;font-size:1rem}.ll-settings-muted{margin:0;color:#cbd5ff;line-height:1.45;font-size:.9rem}.ll-drop-zone{margin-top:13px;border:2px dashed rgba(34,211,238,.38);border-radius:22px;padding:22px;text-align:center;background:rgba(34,211,238,.055);transition:.2s}.ll-drop-zone.drag{transform:scale(1.015);border-color:#22d3ee;background:rgba(34,211,238,.13);box-shadow:0 0 32px rgba(34,211,238,.16)}.ll-file-input{display:none}.ll-file-name{margin-top:10px;color:#e0f2fe;font-weight:900;word-break:break-word}.ll-settings-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:13px}.ll-panel-btn{border:0;border-radius:14px;padding:11px 13px;font-weight:1000;cursor:pointer;color:#06111d;background:linear-gradient(135deg,#8b5cf6,#22d3ee);transition:.18s}.ll-panel-btn:hover{transform:translateY(-2px) scale(1.02)}.ll-panel-btn.secondary{color:#e0f2fe;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}.ll-panel-btn.danger{color:#fff;background:rgba(239,68,68,.16);border:1px solid rgba(239,68,68,.35)}.ll-slider-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin-top:12px}.ll-slider-row input{width:100%;accent-color:#22d3ee}.ll-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:12px;border-radius:16px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09);font-weight:900}.ll-toggle-row input{width:20px;height:20px;accent-color:#22d3ee}.ll-settings-message{min-height:22px;font-weight:1000;margin-top:12px}.ll-settings-message.success{color:#86efac}.ll-settings-message.error{color:#fca5a5;animation:llShake .32s ease}.ll-effects-off *,.ll-card-animations-off .project-card{animation:none!important;transition:none!important}.ll-settings-small{font-size:.8rem;color:rgba(255,255,255,.55);margin-top:8px;line-height:1.35}@keyframes llShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
    /* FIXED dashboard music settings layout */
    .ll-settings-section{overflow:hidden}
    .ll-drop-zone{
      display:flex!important;
      flex-direction:column!important;
      align-items:center!important;
      justify-content:center!important;
      width:100%!important;
      min-height:150px!important;
      padding:26px 18px!important;
      margin:16px 0 0!important;
      text-align:center!important;
      cursor:pointer!important;
      position:relative!important;
      border-radius:20px!important;
      overflow:hidden!important;
    }
    .ll-drop-zone::before{
      content:"";
      position:absolute;
      inset:0;
      border-radius:18px;
      pointer-events:none;
      background:radial-gradient(circle at 50% 0%,rgba(34,211,238,.12),transparent 55%);
    }
    .ll-drop-zone strong,.ll-drop-zone span,.ll-file-name{
      position:relative;
      z-index:1;
      display:block;
      max-width:100%;
    }
    .ll-drop-zone strong{
      font-size:1.05rem;
      line-height:1.35;
    }
    .ll-drop-zone span{
      margin-top:6px;
      color:#cbd5ff;
      line-height:1.35;
    }
    .ll-file-name{
      width:100%;
      margin-top:14px!important;
      padding:10px 12px;
      border-radius:14px;
      background:rgba(2,6,23,.35);
      border:1px solid rgba(255,255,255,.10);
      color:#e0f2fe!important;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    .ll-settings-row{
      align-items:center!important;
    }
    .ll-panel-btn{
      min-height:46px;
    }
    @media(max-width:560px){
      .ll-drop-zone{min-height:135px!important;padding:22px 14px!important}
    }
@media(max-width:560px){.ll-music-actions,.ll-settings-row{flex-direction:column}.ll-music-btn,.ll-panel-btn{width:100%}.ll-music-dock{left:12px;bottom:12px}.ll-music-float{max-width:calc(100vw - 80px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ll-settings-body{padding:16px}.ll-settings-head{padding:17px}}
  `;
  document.head.appendChild(style);

  function applyDashboardPreferenceClasses() {
    if (!isDashboardPage) return;
    document.documentElement.classList.toggle("ll-effects-off", !getUiEffectsEnabled());
    document.documentElement.classList.toggle("ll-card-animations-off", !getCardAnimationsEnabled());
  }

  const dock = document.createElement("div");
  dock.className = "ll-music-dock";

  const floatBtn = document.createElement("button");
  floatBtn.className = "ll-music-float";
  floatBtn.type = "button";
  floatBtn.textContent = "🎵 Music Off";
  dock.appendChild(floatBtn);

  let settingsBtn = null;
  if (isDashboardPage) {
    settingsBtn = document.createElement("button");
    settingsBtn.className = "ll-settings-float";
    settingsBtn.type = "button";
    settingsBtn.title = "Dashboard music settings";
    settingsBtn.innerHTML = "<span>⚙️</span>";
    dock.appendChild(settingsBtn);
  }

  document.body.appendChild(dock);

  function updateButton() {
    const customName = localStorage.getItem(STORAGE.customMusicName);
    if (musicOn) {
      floatBtn.textContent = customTrackLoaded && customName ? "🎵 Custom On" : "🎵 Music On";
    } else {
      floatBtn.textContent = "🎵 Music Off";
    }
  }

  async function enableMusic() {
    try {
      audio.volume = getSavedVolume();
      await audio.play();
      musicOn = true;
      localStorage.setItem(STORAGE.musicState, "on");
    } catch (error) {
      musicOn = false;
      localStorage.setItem(STORAGE.musicState, "off");
    }
    updateButton();
  }

  function disableMusic() {
    audio.pause();
    musicOn = false;
    localStorage.setItem(STORAGE.musicState, "off");
    updateButton();
  }

  function closeEntry(entry) {
    entry.classList.add("ll-hide");
    setTimeout(() => entry.remove(), 400);
  }

  function showEntry() {
    const entry = document.createElement("div");
    entry.className = "ll-music-entry";
    entry.innerHTML = `
      <div class="ll-music-card">
        <div class="ll-music-badge">⚡ ${page.title}</div>
        <h2>Enter with <span>vibe.</span></h2>
        <p>Choose music or silent mode before opening this page. You can change it anytime using the music button.</p>
        <div class="ll-music-actions">
          <button class="ll-music-btn primary" id="llEnterMusic" type="button">🎵 Enter with Music</button>
          <button class="ll-music-btn" id="llEnterSilent" type="button">🔇 Enter without Music</button>
        </div>
      </div>
    `;
    document.body.appendChild(entry);
    entry.querySelector("#llEnterMusic").addEventListener("click", async () => {
      await enableMusic();
      closeEntry(entry);
    });
    entry.querySelector("#llEnterSilent").addEventListener("click", () => {
      disableMusic();
      closeEntry(entry);
    });
  }

  function createSettingsModal() {
    const overlay = document.createElement("div");
    overlay.className = "ll-settings-overlay";
    overlay.innerHTML = `
      <div class="ll-settings-modal" role="dialog" aria-modal="true" aria-label="Dashboard music settings">
        <div class="ll-settings-head">
          <h2>⚙️ Dashboard Settings</h2>
          <button class="ll-settings-close" type="button" aria-label="Close settings">×</button>
        </div>
        <div class="ll-settings-body">
          <section class="ll-settings-section">
            <h3>🎵 Custom Dashboard Music</h3>
            <p class="ll-settings-muted">Drop an MP3, M4A, WAV, or OPUS file here. It saves only on this device using IndexedDB.</p>
            <label class="ll-drop-zone" id="llDropZone">
              <input class="ll-file-input" id="llFileInput" type="file" accept=".mp3,.m4a,.wav,.opus,audio/mpeg,audio/mp4,audio/wav,audio/ogg" />
              <strong>Drop your music here 🎵</strong><br />
              <span>or click to choose a file</span>
              <div class="ll-file-name" id="llFileName">No file selected</div>
            </label>
            <div class="ll-settings-row">
              <button class="ll-panel-btn secondary" id="llPreviewBtn" type="button">▶ Preview</button>
              <button class="ll-panel-btn" id="llSaveBtn" type="button">💾 Save Custom Music</button>
              <button class="ll-panel-btn danger" id="llResetMusicBtn" type="button">🗑 Reset Music</button>
            </div>
            <div class="ll-settings-message" id="llSettingsMessage"></div>
            <div class="ll-settings-small" id="llCurrentSong">Current: ${customTrackLoaded ? localStorage.getItem(STORAGE.customMusicName) || "Custom dashboard music" : "Default dashboard music"}</div>
          </section>

          <section class="ll-settings-section">
            <h3>🔊 Music Volume</h3>
            <p class="ll-settings-muted">Adjust dashboard music volume for this device.</p>
            <div class="ll-slider-row">
              <input id="llVolumeSlider" type="range" min="0" max="100" value="${Math.round(getSavedVolume() * 100)}" />
              <strong id="llVolumeText">${Math.round(getSavedVolume() * 100)}%</strong>
            </div>
          </section>

          <section class="ll-settings-section">
            <h3>✨ Extra Settings</h3>
            <label class="ll-toggle-row">
              <span>🎶 Auto Play Music</span>
              <input id="llAutoplayToggle" type="checkbox" ${getAutoplayEnabled() ? "checked" : ""} />
            </label>
            <label class="ll-toggle-row">
              <span>✨ UI Effects</span>
              <input id="llEffectsToggle" type="checkbox" ${getUiEffectsEnabled() ? "checked" : ""} />
            </label>
            <label class="ll-toggle-row">
              <span>🌟 Card Animations</span>
              <input id="llCardsToggle" type="checkbox" ${getCardAnimationsEnabled() ? "checked" : ""} />
            </label>
            <div class="ll-settings-row">
              <button class="ll-panel-btn danger" id="llResetAllBtn" type="button">🔄 Reset Dashboard Settings</button>
            </div>
          </section>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  let settingsOverlay = null;

  function showMessage(message, type) {
    const messageBox = document.getElementById("llSettingsMessage");
    if (!messageBox) return;
    messageBox.textContent = message;
    messageBox.className = `ll-settings-message ${type || ""}`;
  }

  function stopPreview() {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }
    const previewBtn = document.getElementById("llPreviewBtn");
    if (previewBtn) previewBtn.textContent = "▶ Preview";
  }

  function clearPreviewUrl() {
    stopPreview();
    if (selectedPreviewUrl) {
      URL.revokeObjectURL(selectedPreviewUrl);
      selectedPreviewUrl = null;
    }
  }

  function selectPreviewFile(file) {
    const error = validateAudioFile(file);
    if (error) {
      selectedPreviewFile = null;
      clearPreviewUrl();
      const fileName = document.getElementById("llFileName");
      if (fileName) fileName.textContent = "No valid file selected";
      showMessage(`❌ ${error}`, "error");
      return;
    }

    selectedPreviewFile = file;
    clearPreviewUrl();
    selectedPreviewUrl = URL.createObjectURL(file);
    previewAudio = new Audio(selectedPreviewUrl);
    previewAudio.volume = getSavedVolume();
    const fileName = document.getElementById("llFileName");
    if (fileName) fileName.textContent = file.name;
    showMessage("✅ Correct format. Preview it or save it as your dashboard music.", "success");
  }

  function wireSettingsModal(overlay) {
    const closeBtn = overlay.querySelector(".ll-settings-close");
    const dropZone = overlay.querySelector("#llDropZone");
    const fileInput = overlay.querySelector("#llFileInput");
    const previewBtn = overlay.querySelector("#llPreviewBtn");
    const saveBtn = overlay.querySelector("#llSaveBtn");
    const resetMusicBtn = overlay.querySelector("#llResetMusicBtn");
    const volumeSlider = overlay.querySelector("#llVolumeSlider");
    const volumeText = overlay.querySelector("#llVolumeText");
    const autoplayToggle = overlay.querySelector("#llAutoplayToggle");
    const effectsToggle = overlay.querySelector("#llEffectsToggle");
    const cardsToggle = overlay.querySelector("#llCardsToggle");
    const resetAllBtn = overlay.querySelector("#llResetAllBtn");

    closeBtn.addEventListener("click", () => {
      stopPreview();
      overlay.classList.remove("show");
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        stopPreview();
        overlay.classList.remove("show");
      }
    });

    ["dragenter", "dragover"].forEach((type) => {
      dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        dropZone.classList.add("drag");
      });
    });

    ["dragleave", "drop"].forEach((type) => {
      dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        dropZone.classList.remove("drag");
      });
    });

    dropZone.addEventListener("drop", (event) => {
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      selectPreviewFile(file);
    });

    fileInput.addEventListener("change", () => {
      selectPreviewFile(fileInput.files && fileInput.files[0]);
    });

    previewBtn.addEventListener("click", async () => {
      if (!selectedPreviewFile || !selectedPreviewUrl) {
        showMessage("❌ Choose a valid music file before previewing.", "error");
        return;
      }

      try {
        if (!previewAudio.paused) {
          stopPreview();
          return;
        }
        previewAudio.volume = getSavedVolume();
        await previewAudio.play();
        previewBtn.textContent = "⏸ Stop Preview";
        showMessage("🎧 Preview playing. Save it if you like it.", "success");
      } catch (error) {
        showMessage("❌ Preview failed. Try another audio file.", "error");
      }
    });

    saveBtn.addEventListener("click", async () => {
      if (!selectedPreviewFile) {
        showMessage("❌ Choose a valid music file first.", "error");
        return;
      }

      try {
        stopPreview();
        await saveCustomMusicToDB(selectedPreviewFile);
        localStorage.setItem(STORAGE.customMusicName, selectedPreviewFile.name);
        await loadDashboardTrack();
        showMessage("✅ Music imported successfully! Your dashboard music has been saved.", "success");
        const currentSong = document.getElementById("llCurrentSong");
        if (currentSong) currentSong.textContent = `Current: ${selectedPreviewFile.name}`;
        if (musicOn) await enableMusic();
        updateButton();
      } catch (error) {
        showMessage("❌ Could not save this music. Try a smaller file or another format.", "error");
      }
    });

    resetMusicBtn.addEventListener("click", async () => {
      try {
        stopPreview();
        selectedPreviewFile = null;
        clearPreviewUrl();
        await deleteCustomMusicFromDB();
        localStorage.removeItem(STORAGE.customMusicName);
        setDefaultTrack();
        const fileName = document.getElementById("llFileName");
        const currentSong = document.getElementById("llCurrentSong");
        if (fileName) fileName.textContent = "No file selected";
        if (currentSong) currentSong.textContent = "Current: Default dashboard music";
        if (musicOn) await enableMusic();
        showMessage("✅ Custom music reset. Default dashboard music is back.", "success");
        updateButton();
      } catch (error) {
        showMessage("❌ Could not reset music. Please try again.", "error");
      }
    });

    volumeSlider.addEventListener("input", () => {
      const volume = Math.max(0, Math.min(100, Number(volumeSlider.value || 0)));
      const normalized = volume / 100;
      localStorage.setItem(STORAGE.volume, String(normalized));
      audio.volume = normalized;
      if (previewAudio) previewAudio.volume = normalized;
      volumeText.textContent = `${volume}%`;
    });

    autoplayToggle.addEventListener("change", () => {
      localStorage.setItem(STORAGE.autoplay, autoplayToggle.checked ? "on" : "off");
      showMessage(autoplayToggle.checked ? "✅ Auto play enabled." : "✅ Auto play disabled.", "success");
    });

    effectsToggle.addEventListener("change", () => {
      localStorage.setItem(STORAGE.uiEffects, effectsToggle.checked ? "on" : "off");
      applyDashboardPreferenceClasses();
      showMessage(effectsToggle.checked ? "✅ UI effects enabled." : "✅ UI effects disabled.", "success");
    });

    cardsToggle.addEventListener("change", () => {
      localStorage.setItem(STORAGE.cardAnimations, cardsToggle.checked ? "on" : "off");
      applyDashboardPreferenceClasses();
      showMessage(cardsToggle.checked ? "✅ Card animations enabled." : "✅ Card animations disabled.", "success");
    });

    resetAllBtn.addEventListener("click", async () => {
      try {
        stopPreview();
        await deleteCustomMusicFromDB();
      } catch (error) {}
      localStorage.removeItem(STORAGE.customMusicName);
      localStorage.removeItem(STORAGE.volume);
      localStorage.removeItem(STORAGE.autoplay);
      localStorage.removeItem(STORAGE.uiEffects);
      localStorage.removeItem(STORAGE.cardAnimations);
      localStorage.removeItem(STORAGE.musicState);
      setDefaultTrack();
      audio.volume = getSavedVolume();
      disableMusic();
      applyDashboardPreferenceClasses();
      const currentSong = document.getElementById("llCurrentSong");
      const fileName = document.getElementById("llFileName");
      if (currentSong) currentSong.textContent = "Current: Default dashboard music";
      if (fileName) fileName.textContent = "No file selected";
      volumeSlider.value = Math.round(getSavedVolume() * 100);
      volumeText.textContent = `${Math.round(getSavedVolume() * 100)}%`;
      autoplayToggle.checked = getAutoplayEnabled();
      effectsToggle.checked = getUiEffectsEnabled();
      cardsToggle.checked = getCardAnimationsEnabled();
      showMessage("✅ Dashboard settings reset.", "success");
    });
  }

  function openSettings() {
    if (!settingsOverlay) {
      settingsOverlay = createSettingsModal();
      wireSettingsModal(settingsOverlay);
    }
    settingsOverlay.classList.add("show");
  }

  floatBtn.addEventListener("click", () => {
    if (musicOn) disableMusic();
    else enableMusic();
  });

  if (settingsBtn) {
    settingsBtn.addEventListener("click", openSettings);
  }

  async function bootMusic() {
    applyDashboardPreferenceClasses();
    await loadDashboardTrack();
    updateButton();

    const saved = localStorage.getItem(STORAGE.musicState);
    const autoplay = getAutoplayEnabled();

    if (saved === "on" && autoplay) {
      enableMusic();
    } else if (saved === "off") {
      disableMusic();
    } else {
      showEntry();
    }
  }

  bootMusic();
})();
