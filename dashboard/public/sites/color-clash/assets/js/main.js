const COLORS = [
  {name:'RED',hex:'#ff3f61'},{name:'CRIMSON',hex:'#dc143c'},{name:'SCARLET',hex:'#ff2400'},{name:'CORAL',hex:'#ff7f6e'},
  {name:'ORANGE',hex:'#ff8a00'},{name:'AMBER',hex:'#ffb000'},{name:'GOLD',hex:'#ffd23f'},{name:'YELLOW',hex:'#ffe94a'},
  {name:'LIME',hex:'#c8ff3e'},{name:'GREEN',hex:'#47ea78'},{name:'EMERALD',hex:'#16c784'},{name:'MINT',hex:'#6df5c4'},
  {name:'TEAL',hex:'#20d9c2'},{name:'TURQUOISE',hex:'#20e0d0'},{name:'CYAN',hex:'#28d9ff'},{name:'SKY BLUE',hex:'#62b8ff'},
  {name:'BLUE',hex:'#4b7dff'},{name:'COBALT',hex:'#4361ee'},{name:'INDIGO',hex:'#6257e8'},{name:'VIOLET',hex:'#8b5cf6'},
  {name:'PURPLE',hex:'#a855f7'},{name:'MAGENTA',hex:'#e84dcc'},{name:'PINK',hex:'#ff5ca8'},{name:'ROSE',hex:'#ff6f91'},
  {name:'PEACH',hex:'#ffab91'},{name:'BROWN',hex:'#c08261'},{name:'TAN',hex:'#d2a679'},{name:'SILVER',hex:'#d5d9e7'},
  {name:'WHITE',hex:'#ffffff'},{name:'LAVENDER',hex:'#c7b6ff'},{name:'PERIWINKLE',hex:'#9aa8ff'},{name:'AQUA',hex:'#6cffe6'},
  {name:'CHARTREUSE',hex:'#b4ff28'},{name:'FUCHSIA',hex:'#ff4fe3'},{name:'PLUM',hex:'#c678dd'},{name:'BRONZE',hex:'#d69a4c'}
];
const ROUND_COUNT=10;
const ROUND_TIME_START=3.2;
const refs={
 playerName:document.querySelector('#player-name'),round:document.querySelector('#round-display'),score:document.querySelector('#score-display'),streak:document.querySelector('#streak-display'),
 progress:document.querySelector('#round-progress'),timerNum:document.querySelector('#timer-number'),timerFill:document.querySelector('#timer-fill'),stage:document.querySelector('#game-stage'),kicker:document.querySelector('#stage-kicker'),word:document.querySelector('#color-word'),instruction:document.querySelector('#stage-instruction'),answers:document.querySelector('#answers'),start:document.querySelector('#start-btn'),certBtn:document.querySelector('#certificate-btn'),
 bestScore:document.querySelector('#best-score'),bestStreak:document.querySelector('#best-streak'),lastRank:document.querySelector('#last-rank'),
 nameModal:document.querySelector('#name-modal'),nameInput:document.querySelector('#name-input'),nameSubmit:document.querySelector('#name-submit'),
 resultModal:document.querySelector('#result-modal'),resultTitle:document.querySelector('#result-title'),resultScore:document.querySelector('#result-score'),resultAccuracy:document.querySelector('#result-accuracy'),resultStreak:document.querySelector('#result-streak'),resultRank:document.querySelector('#result-rank'),resultStars:document.querySelector('#result-stars'),playAgain:document.querySelector('#play-again'),openCert:document.querySelector('#open-certificate'),
 certModal:document.querySelector('#certificate-modal'),certClose:document.querySelector('#certificate-close'),certCurrent:document.querySelector('#cert-current'),certBest:document.querySelector('#cert-best'),canvas:document.querySelector('#certificate-canvas'),
 sound:document.querySelector('#sound-toggle'),historyToggle:document.querySelector('#history-toggle'),historyPanel:document.querySelector('#history-panel'),historyClose:document.querySelector('#history-close'),historyScrim:document.querySelector('#history-scrim'),historyList:document.querySelector('#history-list'),historyBest:document.querySelector('#history-best'),historyStreak:document.querySelector('#history-streak'),clearHistory:document.querySelector('#clear-history'),toast:document.querySelector('#toast'),confetti:document.querySelector('#confetti')
};
const audio={start:document.querySelector('#sfx-start'),correct:document.querySelector('#sfx-correct'),wrong:document.querySelector('#sfx-wrong'),tick:document.querySelector('#sfx-tick'),timeout:document.querySelector('#sfx-timeout'),record:document.querySelector('#sfx-record')};
let state={player:localStorage.getItem('cc_player')||'',sound:localStorage.getItem('cc_sound')!=='off',round:0,score:0,streak:0,bestStreakRun:0,correct:0,current:null,active:false,timerId:null,startedAt:0,lastResult:null};
let history=JSON.parse(localStorage.getItem('cc_history')||'[]');
function save(){localStorage.setItem('cc_history',JSON.stringify(history));}
function settings(){localStorage.setItem('cc_player',state.player);localStorage.setItem('cc_sound',state.sound?'on':'off');}
function sound(name){if(!state.sound)return;const a=audio[name];if(!a)return;try{a.currentTime=0;a.play().catch(()=>{});}catch{}}
function rand(list){return list[Math.floor(Math.random()*list.length)];}
function shuffle(arr){return [...arr].sort(()=>Math.random()-.5);}
function rankFor(accuracy){if(accuracy>=90)return {name:'COLOR MASTER',stars:'★★★★★'};if(accuracy>=75)return{name:'CHROMA ELITE',stars:'★★★★☆'};if(accuracy>=60)return{name:'COLOR SHARP',stars:'★★★☆☆'};if(accuracy>=40)return{name:'FOCUS BUILDER',stars:'★★☆☆☆'};if(accuracy>=20)return{name:'TRAINING MODE',stars:'★☆☆☆☆'};return{name:'KEEP PRACTICING',stars:'☆☆☆☆☆'};}
function best(){return history.reduce((a,b)=>!a||b.score>a.score?b:a,null);}
function bestStreak(){return Math.max(0,...history.map(x=>x.bestStreak));}
function updateStats(){const b=best();refs.bestScore.textContent=b?b.score:0;refs.bestStreak.textContent=bestStreak();refs.lastRank.textContent=history[0]?.rank||'—';refs.historyBest.textContent=b?b.score:0;refs.historyStreak.textContent=bestStreak();}
function toast(t){refs.toast.textContent=t;refs.toast.classList.add('show');setTimeout(()=>refs.toast.classList.remove('show'),2200);}
function setStage(kicker,word,inst,cls=''){refs.kicker.textContent=kicker;refs.word.textContent=word;refs.instruction.textContent=inst;refs.stage.className='game-stage '+cls;}
function resetUI(){refs.round.textContent=`${state.round} / ${ROUND_COUNT}`;refs.score.textContent=state.score;refs.streak.textContent=state.streak;refs.progress.style.width=`${(state.round/ROUND_COUNT)*100}%`;}
function begin(){clearInterval(state.timerId);state={...state,round:0,score:0,streak:0,bestStreakRun:0,correct:0,current:null,active:false,timerId:null,startedAt:0,lastResult:null};refs.start.disabled=true;refs.certBtn.disabled=true;refs.answers.innerHTML='';resetUI();sound('start');nextRound();}
function nextRound(){if(state.round>=ROUND_COUNT){finish();return;}state.round++;state.active=true;const actual=rand(COLORS);let displayed=rand(COLORS);if(Math.random()<.72){while(displayed.name===actual.name)displayed=rand(COLORS);}const options=shuffle([actual,...shuffle(COLORS.filter(c=>c.name!==actual.name)).slice(0,3)]);state.current={actual,displayed,options};refs.word.textContent=displayed.name;refs.word.style.color=actual.hex;setStage(`ROUND ${state.round} OF ${ROUND_COUNT}`,displayed.name,'Tap the actual text color.','stage-active');refs.word.style.color=actual.hex;refs.answers.innerHTML='';options.forEach(c=>{const b=document.createElement('button');b.className='answer-btn';b.type='button';b.textContent=c.name;b.style.boxShadow=`inset 0 0 0 1px ${c.hex}55`;b.addEventListener('click',()=>answer(c));refs.answers.appendChild(b);});resetUI();startTimer();}
function startTimer(){let remaining=Math.max(1.6,ROUND_TIME_START-(state.round-1)*.13);const total=remaining;refs.timerNum.textContent=remaining.toFixed(1);refs.timerFill.style.width='100%';state.startedAt=performance.now();let tickGate=4;clearInterval(state.timerId);state.timerId=setInterval(()=>{remaining-=.05;refs.timerNum.textContent=Math.max(0,remaining).toFixed(1);refs.timerFill.style.width=`${Math.max(0,remaining/total)*100}%`;if(remaining<1&&tickGate>Math.ceil(remaining*10)){tickGate=Math.ceil(remaining*10);sound('tick');}if(remaining<=0){clearInterval(state.timerId);timeout();}},50);}
function disableAnswers(){[...refs.answers.children].forEach(b=>b.disabled=true);}
function answer(color){if(!state.active)return;const elapsed=performance.now()-state.startedAt;clearInterval(state.timerId);state.active=false;disableAnswers();const correct=color.name===state.current.actual.name;if(correct){state.correct++;state.streak++;state.bestStreakRun=Math.max(state.bestStreakRun,state.streak);const speedBonus=Math.max(0,Math.round((3000-elapsed)/12));state.score+=60+speedBonus;refs.stage.classList.add('stage-correct');sound('correct');setStage('CORRECT',state.current.actual.name,`+${60+speedBonus} points • Keep the streak alive!`,'stage-correct');}else{state.streak=0;state.score=Math.max(0,state.score-45);refs.stage.classList.add('stage-wrong');sound('wrong');setStage('WRONG',state.current.actual.name,`The correct color was ${state.current.actual.name}.`,'stage-wrong');}resetUI();setTimeout(nextRound,800);}
function timeout(){if(!state.active)return;state.active=false;state.streak=0;disableAnswers();sound('timeout');setStage('TIME OUT',state.current.displayed.name,`The answer was ${state.current.actual.name}.`,'stage-wrong');resetUI();setTimeout(nextRound,850);}
function finish(){clearInterval(state.timerId);state.active=false;const accuracy=Math.round((state.correct/ROUND_COUNT)*100);const rank=rankFor(accuracy);const item={id:Date.now(),player:state.player,score:state.score,accuracy,bestStreak:state.bestStreakRun,rank:rank.name,stars:rank.stars,date:new Date().toLocaleString()};const previousBest=best()?.score||0;history.unshift(item);history=history.slice(0,30);save();state.lastResult=item;updateStats();refs.resultScore.textContent=item.score;refs.resultAccuracy.textContent=`${item.accuracy}%`;refs.resultStreak.textContent=item.bestStreak;refs.resultRank.textContent=item.rank;refs.resultStars.textContent=item.stars;const newRecord=item.score>previousBest&&item.score>0;refs.resultTitle.textContent=newRecord?'NEW HIGH SCORE!':'Color Clash Result';if(newRecord){sound('record');confetti();}refs.resultModal.classList.add('active');refs.certBtn.disabled=false;refs.start.disabled=false;refs.start.textContent='Play Again ↻';setStage('RUN COMPLETE','COLOR CLASH','Review your result or play another run.','');renderHistory();}
function historyOpen(){refs.historyPanel.classList.add('open');refs.historyScrim.classList.add('show');refs.historyPanel.setAttribute('aria-hidden','false');}
function historyClose(){refs.historyPanel.classList.remove('open');refs.historyScrim.classList.remove('show');refs.historyPanel.setAttribute('aria-hidden','true');}
function renderHistory(){refs.historyList.innerHTML=history.length?history.map(h=>`<div class="history-item"><strong><span>${h.score} pts</span><span>${h.rank}</span></strong><small>${h.accuracy}% accuracy • ${h.bestStreak} streak<br>${h.date}</small></div>`).join(''):'<div class="history-item"><small>No completed runs yet.</small></div>';updateStats();}
function confetti(){const colors=['#b8ff47','#26d7ff','#fb4ddb','#ffe167','#8b5cf6'];for(let i=0;i<95;i++){const e=document.createElement('i');e.style.left=`${Math.random()*100}%`;e.style.background=rand(colors);e.style.setProperty('--x',`${-18+Math.random()*36}vw`);e.style.animationDelay=`${Math.random()*.35}s`;refs.confetti.appendChild(e);setTimeout(()=>e.remove(),2100);}}
function certificate(result){
  if(!result){toast('Finish a run first.');return;}
  const c=refs.canvas,ctx=c.getContext('2d'),w=c.width,h=c.height;
  const bg=ctx.createLinearGradient(0,0,w,h);
  bg.addColorStop(0,'#130b2d');bg.addColorStop(.44,'#0e2341');bg.addColorStop(1,'#34103c');
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  // Soft colorful glow panels.
  const glowA=ctx.createRadialGradient(250,180,10,250,180,540);
  glowA.addColorStop(0,'rgba(38,215,255,.26)');glowA.addColorStop(1,'rgba(38,215,255,0)');
  ctx.fillStyle=glowA;ctx.fillRect(0,0,w,h);
  const glowB=ctx.createRadialGradient(1320,760,5,1320,760,560);
  glowB.addColorStop(0,'rgba(255,79,227,.22)');glowB.addColorStop(1,'rgba(255,79,227,0)');
  ctx.fillStyle=glowB;ctx.fillRect(0,0,w,h);
  // Premium double border.
  ctx.strokeStyle='#ffe484';ctx.lineWidth=15;ctx.strokeRect(42,42,w-84,h-84);
  ctx.strokeStyle='rgba(255,255,255,.58)';ctx.lineWidth=2;ctx.strokeRect(70,70,w-140,h-140);
  ctx.strokeStyle='rgba(255,228,132,.4)';ctx.lineWidth=2;ctx.strokeRect(92,92,w-184,h-184);
  // Decorative stars.
  ctx.fillStyle='#ffe484';ctx.font='42px Arial';ctx.textAlign='center';
  ctx.fillText('✦     ✦     ✦',w/2,165);
  ctx.font='800 31px Arial';ctx.fillStyle='#c8d7ff';
  ctx.fillText('CERTIFICATE OF COLOR FOCUS',w/2,230);
  ctx.font='900 105px Arial';ctx.fillStyle='#ffffff';
  ctx.fillText('COLOR CLASH',w/2,337);
  ctx.font='34px Arial';ctx.fillStyle='#cfd9f3';
  ctx.fillText('This certificate proudly recognizes',w/2,415);
  ctx.font='italic 900 82px Georgia';ctx.fillStyle='#baff5e';
  ctx.fillText(result.player||'Player',w/2,520);
  ctx.font='32px Arial';ctx.fillStyle='#cfd9f3';
  ctx.fillText('for completing a high-focus Color Clash challenge with',w/2,585);
  ctx.font='900 105px Arial';ctx.fillStyle='#ffffff';
  ctx.fillText(`${result.score} POINTS`,w/2,704);
  // Rank plate.
  const plateX=460,plateY=748,plateW=680,plateH=108;
  ctx.fillStyle='rgba(6,11,28,.75)';ctx.fillRect(plateX,plateY,plateW,plateH);
  ctx.strokeStyle='#ffe484';ctx.lineWidth=3;ctx.strokeRect(plateX,plateY,plateW,plateH);
  ctx.font='800 28px Arial';ctx.fillStyle='#ffe484';ctx.fillText(result.rank,w/2,792);
  ctx.font='38px Arial';ctx.fillStyle='#ffe484';ctx.fillText(result.stars,w/2,838);
  ctx.font='28px Arial';ctx.fillStyle='#d7e0fb';
  ctx.fillText(`Accuracy: ${result.accuracy}%    •    Best Streak: ${result.bestStreak}`,w/2,905);
  ctx.font='22px Arial';ctx.fillStyle='#9fb0d9';
  ctx.fillText(`Awarded ${new Date().toLocaleDateString()}  •  Color Clash by Xavier`,w/2,945);
  ctx.font='20px Arial';ctx.fillStyle='#b8ff47';
  ctx.fillText('github.com/mrxavier53  •  mrxavier53.github.io/Color-Clash/',w/2,973);
  const a=document.createElement('a');
  a.download=`color-clash-certificate-${(result.player||'player').replace(/[^a-z0-9_-]/gi,'-')}-${result.score}.png`;
  a.href=c.toDataURL('image/png');a.click();toast('Certificate downloaded.');
}
function particles(){const layer=document.querySelector('#particle-layer');for(let i=0;i<90;i++){const e=document.createElement('i');e.className='spark';e.style.left=`${Math.random()*100}%`;e.style.top=`${Math.random()*120}%`;e.style.background=rand(COLORS).hex;e.style.boxShadow=`0 0 12px ${e.style.background}`;e.style.setProperty('--drift',`${-80+Math.random()*160}px`);e.style.animationDuration=`${8+Math.random()*12}s`;e.style.animationDelay=`-${Math.random()*18}s`;layer.appendChild(e);}}
function init(){refs.playerName.textContent=state.player||'Player';refs.sound.setAttribute('aria-pressed',String(state.sound));refs.sound.innerHTML=state.sound?'🔊 <span>Sound</span>':'🔇 <span>Muted</span>';if(state.player){refs.nameModal.classList.remove('active');}else{setTimeout(()=>refs.nameInput.focus(),250);}updateStats();renderHistory();particles();}
refs.nameSubmit.addEventListener('click',()=>{state.player=(refs.nameInput.value.trim()||'Player').slice(0,18);settings();refs.playerName.textContent=state.player;refs.nameModal.classList.remove('active');});refs.nameInput.addEventListener('keydown',e=>{if(e.key==='Enter')refs.nameSubmit.click();});refs.start.addEventListener('click',begin);refs.playAgain.addEventListener('click',()=>{refs.resultModal.classList.remove('active');begin();});refs.sound.addEventListener('click',()=>{state.sound=!state.sound;settings();refs.sound.setAttribute('aria-pressed',String(state.sound));refs.sound.innerHTML=state.sound?'🔊 <span>Sound</span>':'🔇 <span>Muted</span>';toast(state.sound?'Sound on':'Sound off');});refs.historyToggle.addEventListener('click',historyOpen);refs.historyClose.addEventListener('click',historyClose);refs.historyScrim.addEventListener('click',historyClose);refs.clearHistory.addEventListener('click',()=>{if(confirm('Clear all saved Color Clash history on this device?')){history=[];save();renderHistory();toast('History cleared.');}});refs.certBtn.addEventListener('click',()=>refs.certModal.classList.add('active'));refs.openCert.addEventListener('click',()=>{refs.resultModal.classList.remove('active');refs.certModal.classList.add('active');});refs.certClose.addEventListener('click',()=>refs.certModal.classList.remove('active'));refs.certCurrent.addEventListener('click',()=>{refs.certModal.classList.remove('active');certificate(state.lastResult);});refs.certBest.addEventListener('click',()=>{refs.certModal.classList.remove('active');certificate(best());});if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{}));}init();