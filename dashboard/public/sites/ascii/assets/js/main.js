const textInput = document.getElementById('textInput');
const charCount = document.getElementById('charCount');
const generateBtn = document.getElementById('generateBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const outputSection = document.getElementById('outputSection');
const asciiOutput = document.getElementById('asciiOutput');
const saveBtn = document.getElementById('saveBtn');
const copyBtn = document.getElementById('copyBtn');
const fontSelect = document.getElementById('fontSelect');
const soundToggle = document.getElementById('soundToggle');
const stylePreview = document.getElementById('stylePreview');

let currentArt = '';
let soundEnabled = true;
let audioContext = null;

const styles = [
  ['standard', 'Standard ASCII'],
  ['gothic', 'Gothic text: 𝖜𝖊𝖑𝖈𝖔𝖒𝖊𝖘'],
  ['dotpixel', 'Dot pixel letters'],
  ['block', 'Block letters'],
  ['fullwidth', 'Ｆｕｌｌｗｉｄｔｈ'],
  ['bubble', 'Ⓑⓤⓑⓑⓛⓔ'],
  ['square', '🅂🅀🅄🄰🅁🄴'],
  ['smallcaps', 'Small caps'],
  ['spaced', 'S P A C E D'],
  ['random', 'Random style']
];

styles.forEach(([value, label]) => {
  const opt = document.createElement('option'); opt.value = value; opt.textContent = label; fontSelect.appendChild(opt);
});
fontSelect.value = 'gothic';

function initAudio(){ if(!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)(); if(audioContext.state==='suspended') audioContext.resume(); }
function beep(freq=700, dur=.06, type='sine', vol=.06){ if(!soundEnabled) return; try{ initAudio(); const o=audioContext.createOscillator(); const g=audioContext.createGain(); o.type=type; o.frequency.value=freq; g.gain.value=vol; o.connect(g); g.connect(audioContext.destination); g.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+dur); o.start(); o.stop(audioContext.currentTime+dur);}catch(e){} }
function success(){ beep(520,.08); setTimeout(()=>beep(760,.08),80); setTimeout(()=>beep(980,.12),160); }
function errorSound(){ beep(190,.15,'sawtooth'); setTimeout(()=>beep(140,.18,'sawtooth'),130); }

soundToggle.addEventListener('click',()=>{ soundEnabled=!soundEnabled; soundToggle.textContent=soundEnabled?'🔊 Sound: ON':'🔇 Sound: OFF'; beep(650,.05); });
document.body.addEventListener('click',()=>{ if(soundEnabled){ initAudio(); } },{once:true});

const gothicMap = {'a':'𝖆','b':'𝖇','c':'𝖈','d':'𝖉','e':'𝖊','f':'𝖋','g':'𝖌','h':'𝖍','i':'𝖎','j':'𝖏','k':'𝖐','l':'𝖑','m':'𝖒','n':'𝖓','o':'𝖔','p':'𝖕','q':'𝖖','r':'𝖗','s':'𝖘','t':'𝖙','u':'𝖚','v':'𝖛','w':'𝖜','x':'𝖝','y':'𝖞','z':'𝖟','A':'𝕬','B':'𝕭','C':'𝕮','D':'𝕯','E':'𝕰','F':'𝕱','G':'𝕲','H':'𝕳','I':'𝕴','J':'𝕵','K':'𝕶','L':'𝕷','M':'𝕸','N':'𝕹','O':'𝕺','P':'𝕻','Q':'𝕼','R':'𝕽','S':'𝕾','T':'𝕿','U':'𝖀','V':'𝖁','W':'𝖂','X':'𝖃','Y':'𝖄','Z':'𝖅'};
const bubbleMap = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').reduce((m,c,i)=>{m[c]=String.fromCodePoint(0x24B6+i); return m;},{});
const squareMap = {'A':'🄰','B':'🄱','C':'🄲','D':'🄳','E':'🄴','F':'🄵','G':'🄶','H':'🄷','I':'🄸','J':'🄹','K':'🄺','L':'🄻','M':'🄼','N':'🄽','O':'🄾','P':'🄿','Q':'🅀','R':'🅁','S':'🅂','T':'🅃','U':'🅄','V':'🅅','W':'🅆','X':'🅇','Y':'🅈','Z':'🅉'};
const smallCaps = {'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ꜰ','g':'ɢ','h':'ʜ','i':'ɪ','j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ','s':'ꜱ','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ'};
const pixel = {
A:[' ██ ','█  █','████','█  █','█  █'],B:['███ ','█  █','███ ','█  █','███ '],C:[' ███','█   ','█   ','█   ',' ███'],D:['███ ','█  █','█  █','█  █','███ '],E:['████','█   ','███ ','█   ','████'],F:['████','█   ','███ ','█   ','█   '],G:[' ███','█   ','█ ██','█  █',' ███'],H:['█  █','█  █','████','█  █','█  █'],I:['███',' █ ',' █ ',' █ ','███'],J:['  ██','   █','   █','█  █',' ██ '],K:['█  █','█ █ ','██  ','█ █ ','█  █'],L:['█   ','█   ','█   ','█   ','████'],M:['█  █','████','████','█  █','█  █'],N:['█  █','██ █','█ ██','█  █','█  █'],O:[' ██ ','█  █','█  █','█  █',' ██ '],P:['███ ','█  █','███ ','█   ','█   '],Q:[' ██ ','█  █','█  █','█ ██',' ███'],R:['███ ','█  █','███ ','█ █ ','█  █'],S:[' ███','█   ',' ██ ','   █','███ '],T:['████',' ██ ',' ██ ',' ██ ',' ██ '],U:['█  █','█  █','█  █','█  █',' ██ '],V:['█  █','█  █','█  █',' ██ ',' ██ '],W:['█  █','█  █','████','████','█  █'],X:['█  █',' ██ ',' ██ ',' ██ ','█  █'],Y:['█  █',' ██ ',' ██ ',' ██ ',' ██ '],Z:['████','  █ ',' ██ ','█   ','████'], ' ':['    ','    ','    ','    ','    ']};
function mapText(text, map, upper=false){ return [...text].map(ch=>map[upper?ch.toUpperCase():ch] || map[ch] || ch).join(''); }
function fullwidth(text){ return [...text].map(ch=>{const c=ch.charCodeAt(0); if(c>=33&&c<=126) return String.fromCharCode(c+0xFEE0); return ch===' ' ? '　' : ch;}).join(''); }
function block(text){ return [...text.toUpperCase()].map(ch=> ch===' ' ? '    ' : `█${ch}█`).join('  '); }
function dotPixel(text){ const lines=['','','','','']; [...text.toUpperCase()].forEach(ch=>{ const p=pixel[ch]||pixel[' ']; p.forEach((line,i)=>lines[i]+=line.replace(/█/g,'●').replace(/ /g,'·')+'  '); }); return lines.join('\n'); }
function generate(text, style){ if(style==='random') style = styles[Math.floor(Math.random()*(styles.length-1))][0]; switch(style){ case 'gothic': return mapText(text,gothicMap); case 'dotpixel': return dotPixel(text); case 'block': return block(text); case 'fullwidth': return fullwidth(text); case 'bubble': return mapText(text,bubbleMap,true); case 'square': return mapText(text,squareMap,true); case 'smallcaps': return mapText(text.toLowerCase(),smallCaps); case 'spaced': return [...text].join(' '); default: return text; } }

textInput.addEventListener('input',()=>{ charCount.textContent=textInput.value.length; charCount.style.color=textInput.value.length>=500?'#ff4444':'var(--lime-green)'; if(soundEnabled) beep(900+Math.random()*120,.025,'square',.025); });
fontSelect.addEventListener('change',()=>{ stylePreview.textContent = fontSelect.selectedOptions[0].textContent; beep(600,.05); });

async function typewriter(text){ asciiOutput.textContent=''; for(const ch of text){ asciiOutput.textContent += ch; if(ch !== '\n') beep(820+Math.random()*220,.018,'sine',.018); await new Promise(r=>setTimeout(r,6)); } }
function showLoading(){ loadingOverlay.classList.remove('hidden'); }
function hideLoading(){ loadingOverlay.classList.add('hidden'); }
async function generateArt(){ const text=textInput.value.trim(); if(!text){ errorSound(); alert('Please enter some text first!'); return;} showLoading(); beep(440,.08); setTimeout(()=>beep(880,.12),80); setTimeout(async()=>{ currentArt=generate(text,fontSelect.value); hideLoading(); outputSection.classList.remove('hidden'); await typewriter(currentArt); success(); },650); }
function saveArt(){ if(!currentArt){ errorSound(); return;} const blob=new Blob([currentArt],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ascii_art.txt'; a.click(); URL.revokeObjectURL(a.href); success(); }

let copyComboCount = 0;
let copyComboTimer = null;
const copyComboNames = [
  'COPIED',
  'DOUBLE COPIED',
  'TRIPLE COPIED',
  'MEGA COPY',
  'ULTRA COPY',
  'HYPER COPY',
  'RED COPY',
  'DANGER COPY',
  'INSANE COPY',
  'LEGENDARY COPIED'
];

function updateCopyComboButton() {
  const label = copyComboNames[Math.min(copyComboCount - 1, copyComboNames.length - 1)];
  copyBtn.innerHTML = `<span>✅</span> ${label}`;
  copyBtn.classList.toggle('copy-danger', copyComboCount >= 7);
  copyBtn.classList.toggle('copy-legendary', copyComboCount >= 10);
  asciiOutput.classList.remove('discord-vibrate', 'legendary-vibrate');
  void asciiOutput.offsetWidth;
  asciiOutput.classList.add(copyComboCount >= 10 ? 'legendary-vibrate' : 'discord-vibrate');
  copyBtn.classList.remove('discord-vibrate', 'legendary-vibrate');
  void copyBtn.offsetWidth;
  copyBtn.classList.add(copyComboCount >= 10 ? 'legendary-vibrate' : 'discord-vibrate');
}

async function copyArt(){
  if(!currentArt){ errorSound(); return; }
  await navigator.clipboard.writeText(currentArt);
  success();
  clearTimeout(copyComboTimer);
  copyComboCount = Math.min(copyComboCount + 1, 10);
  updateCopyComboButton();
  copyComboTimer = setTimeout(() => {
    copyComboCount = 0;
    copyBtn.classList.remove('copy-danger','copy-legendary','discord-vibrate','legendary-vibrate');
    asciiOutput.classList.remove('discord-vibrate','legendary-vibrate');
    copyBtn.innerHTML='<span>📋</span> COPY';
  }, 2000);
}

generateBtn.addEventListener('click', generateArt); saveBtn.addEventListener('click', saveArt); copyBtn.addEventListener('click', copyArt);
textInput.addEventListener('keydown',(e)=>{ if(e.ctrlKey && e.key==='Enter') generateArt(); });
stylePreview.textContent = fontSelect.selectedOptions[0].textContent;
