const RON_RUNE_MAP = {
    a: 'ᚨ', b: 'ᛒ', c: 'ᚲ', d: 'ᛞ', e: 'ᛖ',
    f: 'ᚠ', g: 'ᚷ', h: 'ᚺ', i: 'ᛁ', j: 'ᛃ',
    k: 'ᚲ', l: 'ᛚ', m: 'ᛗ', n: 'ᚾ', o: 'ᛟ',
    p: 'ᛈ', q: 'ᚲ', r: 'ᚱ', s: 'ᛋ', t: 'ᛏ',
    u: 'ᚢ', v: 'ᚠ', w: 'ᚹ', x: 'ᛋ', y: 'ᛃ',
    z: 'ᛉ', ' ': ' '
};

const REVERSE_RUNE_MAP = {
    'ᚨ': 'a', 'ᛒ': 'b', 'ᚲ': 'c', 'ᛞ': 'd', 'ᛖ': 'e',
    'ᚠ': 'f', 'ᚷ': 'g', 'ᚺ': 'h', 'ᛁ': 'i', 'ᛃ': 'j',
    'ᛚ': 'l', 'ᛗ': 'm', 'ᚾ': 'n', 'ᛟ': 'o', 'ᛈ': 'p',
    'ᚱ': 'r', 'ᛋ': 's', 'ᛏ': 't', 'ᚢ': 'u', 'ᚹ': 'w',
    'ᛉ': 'z', ' ': ' '
};

const inputArea = document.getElementById('english-input');
const outputDiv = document.getElementById('ron-output');
const copyBtnEng = document.getElementById('copy-btn-eng');
const charCountEng = document.getElementById('eng-char-count');
const translateEngBtn = document.getElementById('translate-eng-btn');

const ronInputArea = document.getElementById('ron-input');
const englishOutputDiv = document.getElementById('english-output');
const copyBtnRon = document.getElementById('copy-btn-ron');
const charCountRon = document.getElementById('ron-char-count');
const translateRonBtn = document.getElementById('translate-ron-btn');

const loadingScreen = document.getElementById('loading-screen');
const engToRonBtn = document.getElementById('eng-to-ron-btn');
const ronToEngBtn = document.getElementById('ron-to-eng-btn');
const engToRonArea = document.getElementById('eng-to-ron-area');
const ronToEngArea = document.getElementById('ron-to-eng-area');

let currentMode = 'eng-to-ron';
let translationHistory = JSON.parse(localStorage.getItem('ronHistory') || '[]');
let audioContext = null;
let typingTimer;
let ronTypingTimer;
let musicEnabled = false;
const backgroundMusic = document.getElementById('background-music');
const AUTO_TRANSLATE_DELAY = 20;
const RUNE_REVEAL_DELAY = 20;

function translateToRon(text) {
    return text
        .toLowerCase()
        .split('')
        .map((char) => RON_RUNE_MAP[char] || char)
        .join('');
}

function translateToEnglish(text) {
    return text
        .split('')
        .map((char) => REVERSE_RUNE_MAP[char] || char)
        .join('');
}

function initAudio() {
    if (!audioContext && (window.AudioContext || window.webkitAudioContext)) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
    }
}

function makeTone({ frequency, duration, volume, type = 'sine', slideTo = null }) {
    // The Music toggle controls ALL sound: background music + typing + rune effects.
    if (!musicEnabled) return;

    initAudio();
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);

    if (slideTo !== null) {
        oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(slideTo, 1),
            now + duration
        );
    }

    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
}

/* Plays immediately when the user types a new character. */
function playTypingSound(event) {
    if (event?.inputType?.startsWith('delete') || event?.isComposing) return;

    makeTone({
        frequency: 280 + Math.random() * 55,
        duration: 0.028,
        volume: 0.025,
        type: 'triangle',
        slideTo: 215
    });
}

/* Magical click while each translated rune/letter appears. */
function playStoneClick() {
    makeTone({
        frequency: 600 + Math.random() * 200,
        duration: 0.075,
        volume: 0.07,
        type: 'sine',
        slideTo: 460
    });
}

/* Small finish sound after the whole translation is displayed. */
function playTranslationCompleteSound() {
    makeTone({ frequency: 520, duration: 0.14, volume: 0.06, type: 'sine', slideTo: 730 });

    setTimeout(() => {
        makeTone({ frequency: 780, duration: 0.20, volume: 0.05, type: 'sine', slideTo: 970 });
    }, 85);
}

/* Continuous original ambient soundtrack loaded from assets/audio/ron-ambient.mp3. */
function startBackgroundMusic() {
    if (!backgroundMusic || musicEnabled) return;

    backgroundMusic.volume = 0.30;
    backgroundMusic.currentTime = 0;

    backgroundMusic.play()
        .then(() => {
            musicEnabled = true;
            localStorage.setItem('ronMusicEnabled', 'true');
            updateMusicButton();
        })
        .catch(() => {
            musicEnabled = false;
            updateMusicButton();
        });
}

function stopBackgroundMusic() {
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }

    musicEnabled = false;
    localStorage.setItem('ronMusicEnabled', 'false');
    updateMusicButton();
}

function updateMusicButton() {
    const button = document.getElementById('music-toggle');
    if (!button) return;

    button.hidden = false;
    button.textContent = musicEnabled ? '♫ Music: ON' : '♫ Music: OFF';
    button.setAttribute('aria-pressed', String(musicEnabled));
}

function openTranslatorAfterNotice(useMusic) {
    const warning = document.getElementById('music-warning');
    const loading = document.getElementById('loading-screen');

    if (useMusic) startBackgroundMusic();
    else stopBackgroundMusic();

    if (warning) {
        warning.classList.add('is-hidden');
        window.setTimeout(() => {
            warning.style.display = 'none';
        }, 460);
    }

    if (loading) {
        loading.style.display = 'flex';
        loading.style.opacity = '1';
        window.setTimeout(() => {
            loading.style.opacity = '0';
            window.setTimeout(() => {
                loading.style.display = 'none';
            }, 420);
        }, 650);
    }
}

function startMusicNotice() {
    const countdown = document.getElementById('warning-countdown');
    const actions = document.getElementById('music-warning-actions');
    const musicButton = document.getElementById('enter-with-music');
    const silentButton = document.getElementById('enter-silently');

    let seconds = 4;
    countdown.textContent = `Preparing options in ${seconds}…`;

    const countdownTimer = window.setInterval(() => {
        seconds -= 1;
        if (seconds > 0) {
            countdown.textContent = `Preparing options in ${seconds}…`;
            return;
        }

        window.clearInterval(countdownTimer);
        countdown.textContent = 'Choose how you want to enter.';
        actions.hidden = false;
    }, 1000);

    musicButton.addEventListener('click', () => openTranslatorAfterNotice(true), { once: true });
    silentButton.addEventListener('click', () => openTranslatorAfterNotice(false), { once: true });
}

function typewriterEffect(element, text) {
    if (element._ronTypingTimer) clearTimeout(element._ronTypingTimer);

    element.textContent = '';
    let i = 0;

    function addChar() {
        if (i >= text.length) {
            playTranslationCompleteSound();
            return;
        }

        const character = text.charAt(i);
        element.textContent += character;

        if (character.trim()) playStoneClick();

        i += 1;
        element._ronTypingTimer = setTimeout(addChar, RUNE_REVEAL_DELAY);
    }

    addChar();
}

function saveToHistory(input, output, mode) {
    if (!input.trim() || !output.trim()) return;

    const newest = translationHistory[0];
    if (newest && newest.input === input.substring(0, 80) && newest.output === output.substring(0, 80)) {
        return;
    }

    const historyEntry = {
        id: Date.now(),
        input: input.substring(0, 80),
        output: output.substring(0, 80),
        mode,
        date: new Date().toLocaleTimeString()
    };

    translationHistory = translationHistory.filter((item) => {
        if (!item || item.mode !== mode) return true;
        const sameInputChain = String(historyEntry.input).startsWith(String(item.input || '')) || String(item.input || '').startsWith(String(historyEntry.input));
        const sameOutputChain = String(historyEntry.output).startsWith(String(item.output || '')) || String(item.output || '').startsWith(String(historyEntry.output));
        return !(sameInputChain && sameOutputChain);
    });

    translationHistory.unshift(historyEntry);

    if (translationHistory.length > 10) {
        translationHistory.pop();
    }

    localStorage.setItem('ronHistory', JSON.stringify(translationHistory));
    renderHistory();
}


function compactTranslationHistory() {
    const grouped = new Map();

    translationHistory.forEach((item) => {
        if (!item || !item.input || !item.output) return;
        const key = `${item.mode || ''}|${item.date || ''}`;
        const existing = grouped.get(key);
        if (!existing || String(item.input).length + String(item.output).length > String(existing.input).length + String(existing.output).length) {
            grouped.set(key, item);
        }
    });

    translationHistory = Array.from(grouped.values())
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
        .slice(0, 10);

    localStorage.setItem('ronHistory', JSON.stringify(translationHistory));
}

function renderHistory() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    if (translationHistory.length === 0) {
        historyList.innerHTML = '<div class="empty-history">No translations yet</div>';
        return;
    }

    historyList.innerHTML = translationHistory.map((item) => `
        <div class="history-item" data-id="${item.id}">
            <div class="history-text">${escapeHtml(item.input)}</div>
            <div class="history-text" style="color: #00e5ff; font-size: 0.8em;">→ ${escapeHtml(item.output)}</div>
            <div class="history-date">${item.mode === 'eng-to-ron' ? '📖→ᚱ' : 'ᚱ→📖'} | ${item.date}</div>
        </div>
    `).join('');

    document.querySelectorAll('.history-item').forEach((el) => {
        el.addEventListener('click', () => {
            const id = Number(el.dataset.id);
            const item = translationHistory.find((h) => h.id === id);
            if (!item) return;

            if (item.mode === 'eng-to-ron') {
                engToRonBtn.click();
                inputArea.value = item.input;
                charCountEng.textContent = `${item.input.length} characters`;
                triggerTranslation();
            } else {
                ronToEngBtn.click();
                ronInputArea.value = item.input;
                charCountRon.textContent = `${item.input.length} characters`;
                triggerReverseTranslation();
            }

            closeHistory();
        });
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function clearHistory() {
    document.querySelectorAll('.history-item').forEach((item) => item.classList.add('fade-out'));

    setTimeout(() => {
        translationHistory = [];
        localStorage.setItem('ronHistory', '[]');
        renderHistory();
    }, 300);
}

function triggerTranslation() {
    const text = inputArea.value;

    if (text.trim() === '') {
        outputDiv.textContent = '...';
        return;
    }

    const translated = translateToRon(text);
    typewriterEffect(outputDiv, translated);
    saveToHistory(text, translated, 'eng-to-ron');
}

function triggerReverseTranslation() {
    const text = ronInputArea.value;

    if (text.trim() === '') {
        englishOutputDiv.textContent = '...';
        return;
    }

    const translated = translateToEnglish(text);
    typewriterEffect(englishOutputDiv, translated);
    saveToHistory(text, translated, 'ron-to-eng');
}

async function translateFile(file, mode) {
    if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
        alert('Please choose a .txt file');
        return;
    }

    const text = await file.text();

    if (mode === 'eng-to-ron') {
        inputArea.value = text;
        charCountEng.textContent = `${text.length} characters`;
        triggerTranslation();
    } else {
        ronInputArea.value = text;
        charCountRon.textContent = `${text.length} characters`;
        triggerReverseTranslation();
    }
}

function downloadTranslation() {
    let content;
    let filename;

    if (currentMode === 'eng-to-ron') {
        content = outputDiv.textContent;
        filename = 'ron_translation.txt';
    } else {
        content = englishOutputDiv.textContent;
        filename = 'english_translation.txt';
    }

    if (!content || content === '...') return;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function setupDragAndDrop(zoneId, inputId, mode) {
    const zone = document.getElementById(zoneId);
    const fileInput = document.getElementById(inputId);
    if (!zone || !fileInput) return;

    const btn = zone.querySelector('.file-btn');

    if (btn) {
        btn.addEventListener('click', () => fileInput.click());
    }

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) await translateFile(file, mode);
    });

    zone.addEventListener('dragover', (event) => {
        event.preventDefault();
        zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

    zone.addEventListener('drop', async (event) => {
        event.preventDefault();
        zone.classList.remove('drag-over');

        const file = event.dataTransfer.files[0];
        if (file) await translateFile(file, mode);
    });
}

function createParticles() {
    const particlesContainer = document.getElementById('particles');

    const runes = [
        'ᚱ', 'ᛟ', 'ᚾ',
        'ᚨ', 'ᛒ', 'ᚲ',
        'ᛞ', 'ᛖ', 'ᚠ',
        'ᚷ', 'ᚺ', 'ᛁ',
        'ᛗ', 'ᛋ', 'ᛏ'
    ];

    if (!particlesContainer) return;

    // More particles, spread across the screen, moving upward continuously.
    for (let i = 0; i < 68; i++) {
        const particle = document.createElement('div');
        const startRotation = Math.floor(Math.random() * 360);
        const extraRotation = 360 + Math.floor(Math.random() * 900);

        particle.classList.add('particle');
        particle.textContent = runes[Math.floor(Math.random() * runes.length)];

        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${18 + Math.random() * 120}%`;

        particle.style.setProperty('--start-rotate', `${startRotation}deg`);
        particle.style.setProperty('--end-rotate', `${startRotation + extraRotation}deg`);
        particle.style.setProperty('--drift-x', `${-14 + Math.random() * 28}vw`);
        particle.style.setProperty('--particle-scale', `${0.85 + Math.random() * 1.35}`);

        // Short negative delays make many runes visible immediately.
        particle.style.animationDelay = `${-Math.random() * 11}s`;
        particle.style.animationDuration = `${12 + Math.random() * 8}s`;

        particlesContainer.appendChild(particle);
    }
}

function showCopiedState(button) {
    const copyText = button.querySelector('.copy-text');
    const copyIcon = button.querySelector('.copy-icon');

    copyIcon.textContent = '✓';
    copyText.textContent = 'Copied!';
    button.classList.add('copied');

    setTimeout(() => {
        copyIcon.textContent = '📋';
        copyText.textContent = 'Copy';
        button.classList.remove('copied');
    }, 2000);
}

async function copyText(text, button) {
    if (!text || text === '...') return;

    try {
        await navigator.clipboard.writeText(text);
        showCopiedState(button);
    } catch (error) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showCopiedState(button);
    }
}

function openHistory() {
    const historySidebar = document.getElementById('history-sidebar');
    const historyToggle = document.getElementById('history-toggle');

    if (!historySidebar || !historyToggle) return;

    historySidebar.classList.add('open');
    document.body.classList.add('history-open');
    historyToggle.setAttribute('aria-expanded', 'true');
}

function closeHistory() {
    const historySidebar = document.getElementById('history-sidebar');
    const historyToggle = document.getElementById('history-toggle');

    if (!historySidebar || !historyToggle) return;

    historySidebar.classList.remove('open');
    document.body.classList.remove('history-open');
    historyToggle.setAttribute('aria-expanded', 'false');
}

function setupEvents() {
    const historyToggle = document.getElementById('history-toggle');
    const historySidebar = document.getElementById('history-sidebar');
    const clearHistoryBtn = document.getElementById('clear-history');
    const downloadBtnEng = document.getElementById('download-btn-eng');
    const downloadBtnRon = document.getElementById('download-btn-ron');

    const closeHistoryBtn = document.getElementById('close-history');

    if (historyToggle && historySidebar) {
        historyToggle.addEventListener('click', openHistory);
        closeHistoryBtn?.addEventListener('click', closeHistory);

        document.addEventListener('click', (event) => {
            if (
                historySidebar.classList.contains('open') &&
                !historySidebar.contains(event.target) &&
                event.target !== historyToggle
            ) {
                closeHistory();
            }
        });
    }

    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearHistory);
    if (downloadBtnEng) downloadBtnEng.addEventListener('click', downloadTranslation);
    if (downloadBtnRon) downloadBtnRon.addEventListener('click', downloadTranslation);

    setupDragAndDrop('drop-zone-eng', 'file-input-eng', 'eng-to-ron');
    setupDragAndDrop('drop-zone-ron', 'file-input-ron', 'ron-to-eng');

    engToRonBtn.addEventListener('click', () => {
        currentMode = 'eng-to-ron';
        engToRonBtn.classList.add('active');
        ronToEngBtn.classList.remove('active');
        engToRonArea.classList.remove('hidden');
        ronToEngArea.classList.add('hidden');
    });

    ronToEngBtn.addEventListener('click', () => {
        currentMode = 'ron-to-eng';
        ronToEngBtn.classList.remove('active');
        engToRonBtn.classList.remove('active');
        ronToEngBtn.classList.add('active');
        ronToEngArea.classList.remove('hidden');
        engToRonArea.classList.add('hidden');
    });

    inputArea.addEventListener('input', (event) => {
        const text = inputArea.value;
        charCountEng.textContent = `${text.length} characters`;
        playTypingSound(event);
        outputDiv.textContent = text.trim() ? 'Press Translate to convert…' : '...';
    });

    ronInputArea.addEventListener('input', (event) => {
        const text = ronInputArea.value;
        charCountRon.textContent = `${text.length} characters`;
        playTypingSound(event);
        englishOutputDiv.textContent = text.trim() ? 'Press Decode to convert…' : '...';
    });

    translateEngBtn?.addEventListener('click', triggerTranslation);
    translateRonBtn?.addEventListener('click', triggerReverseTranslation);

    copyBtnEng.addEventListener('click', () => copyText(outputDiv.textContent, copyBtnEng));
    copyBtnRon.addEventListener('click', () => copyText(englishOutputDiv.textContent, copyBtnRon));

    document.addEventListener('pointerdown', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js').catch((error) => {
            console.warn('Service worker registration failed:', error);
        });
    }
}

window.addEventListener('load', () => {
    loadingScreen.style.display = 'none';
    createParticles();
    setupEvents();
    compactTranslationHistory();
    renderHistory();
    registerServiceWorker();
    startMusicNotice();

    document.getElementById('music-toggle').addEventListener('click', () => {
        if (musicEnabled) stopBackgroundMusic();
        else startBackgroundMusic();
    });
});
