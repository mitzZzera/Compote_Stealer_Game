import { Game, BASEMENTS, readScores, saveScore } from './engine.js';
import { render } from './renderer.js';

const $ = id => document.getElementById(id);
const game = new Game(), ctx = $('game').getContext('2d'), keys = {};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let storage;
try { storage = localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); } }; }
let scores = readScores(storage), soundOn = false, audio, lastState, toastTimer, resumedAfterDialog = false, saved = false;
try { soundOn = storage.getItem('compote-sound') === 'on'; } catch { /* Sound defaults off. */ }

function sound(kind) {
  if (!soundOn) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if(audio.state === 'suspended') audio.resume().catch(()=>{});
    const notes = kind === 'caught' ? [160,110] : kind === 'complete' ? [330,440,550,660] : kind === 'start' ? [220,330,440] : [660,880];
    notes.forEach((freq,i) => { const oscillator = audio.createOscillator(), gain = audio.createGain(), start = audio.currentTime + i*.085;
      oscillator.type='triangle';oscillator.frequency.value=freq;gain.gain.setValueAtTime(.035,start);gain.gain.exponentialRampToValueAtTime(.001,start+.12);
      oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(start+.13);
    });
  } catch { /* Audio support is optional. */ }
}
function updateSound() { $('sound-label').textContent = soundOn ? 'Sound on' : 'Sound off'; $('sound-button').setAttribute('aria-pressed',String(soundOn));$('sound-button').setAttribute('aria-label',soundOn?'Turn sound off':'Turn sound on'); }
$('sound-button').addEventListener('click',()=>{soundOn=!soundOn;updateSound();try{storage.setItem('compote-sound',soundOn?'on':'off');}catch{}sound('collect');});updateSound();
function updateBest() { $('best-score').replaceChildren(document.createTextNode((scores[0]?.score||0).toLocaleString()),Object.assign(document.createElement('span'),{textContent:'PTS'})); }
updateBest();
function toast(message) { $('game-toast').textContent=message;$('game-toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('game-toast').classList.remove('show'),2200); }
function clearKeys() { for(const key of Object.keys(keys)) keys[key]=false; }
function start() {clearKeys();saved=false;game.newRun();syncState();$('game').focus({preventScroll:true});}
$('start-button').addEventListener('click',start);
$('pause-button').addEventListener('click',()=>{if(game.state==='playing')game.pause();else if(game.state==='paused')game.resume();clearKeys();syncState();});
function syncState() {
  if(lastState===game.state)return;
  lastState=game.state;
  const isMenu=game.state==='menu', isOverlay=['menu','paused','over','transition'].includes(game.state);
  $('overlay').hidden=!isOverlay;$('start-panel').hidden=!isMenu;$('dynamic-panel').hidden=isMenu;
  $('pause-button').disabled=!['playing','paused'].includes(game.state);
  $('pause-button').textContent=game.state==='paused'?'▶':'Ⅱ';$('pause-button').setAttribute('aria-label',game.state==='paused'?'Resume game':'Pause game');
  const panel=$('dynamic-panel');
  if(game.state==='paused') {
    panel.innerHTML='<span class="mini-tag">TAKING A BREATHER</span><h2>She can wait.<br>For a minute.</h2><p>Your compotes are safe while you’re away.</p><button class="primary-button" id="resume-button">Back to the basement →</button><button class="secondary-button" id="end-button">End run & save score</button>';
    $('resume-button').onclick=()=>{game.resume();clearKeys();syncState();$('game').focus({preventScroll:true});};
    $('end-button').onclick=()=>{game.endRun();syncState();};
    $('resume-button').focus({preventScroll:true});
  } else if(game.state==='transition') {
    panel.innerHTML=`<span class="mini-tag">BASEMENT ${String(game.level).padStart(2,'0')} COMPLETE</span><h2>One floor deeper.<br>One angrier Babushka.</h2><p>Survival bonus: <strong>+${game.level*100} points</strong><br>Next basement starts in a moment…</p>`;
  } else if(game.state==='over') {
    clearKeys();panel.innerHTML=`<span class="mini-tag">${game.lives===0?'CAUGHT RED-HANDED':'THE HEIST IS OVER'}</span><h2>Sweet while it lasted.</h2><div class="result-score">${game.score.toLocaleString()} <small>PTS</small></div><p>${game.jarsCollected} jars stolen · Basement ${String(game.level).padStart(2,'0')}</p><form class="score-form" id="score-form"><label class="sr-only" for="player-name">Leaderboard name</label><input id="player-name" aria-label="Leaderboard name" maxlength="18" placeholder="Your rascal name" autocomplete="nickname"><button class="primary-button" type="submit">Save score</button></form><div id="save-feedback" class="saved-message" role="status"></div><button class="secondary-button" id="retry-button">Another little heist? Play again →</button>`;
    $('score-form').onsubmit=e=>{e.preventDefault();if(saved)return;try{scores=saveScore(storage,{name:$('player-name').value,score:game.score,level:game.level});saved=true;updateBest();$('score-form').hidden=true;$('save-feedback').textContent='Saved to this browser’s high scores. Nice haul!';}catch{$('save-feedback').textContent='Browser storage is unavailable. Your score is still shown above.';}};
    $('retry-button').onclick=start;$('player-name').focus({preventScroll:true});
  } else if(game.state==='playing') { $('game').focus({preventScroll:true}); }
}
function updateHud() {
  $('score').textContent=String(game.score).padStart(5,'0');const seconds=Math.ceil(game.time);$('timer').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  $('timer').parentElement.classList.toggle('urgent',seconds<=10);$('lives').textContent=Array.from({length:3},(_,i)=>i<game.lives?'♥':'♡').join(' ');$('lives').setAttribute('aria-label',`${game.lives} lives`);
  $('level-label').textContent=`BASEMENT ${String(game.level).padStart(2,'0')}`;$('status-label').textContent=BASEMENTS[(game.level-1)%BASEMENTS.length].toUpperCase();$('energy').style.width=`${game.energy*100}%`;
}
const mappings={w:'up',arrowup:'up',a:'left',arrowleft:'left',s:'down',arrowdown:'down',d:'right',arrowright:'right',' ':'sprint'};
window.addEventListener('keydown',e=>{
  if($('info-dialog').open || /INPUT|TEXTAREA/.test(e.target.tagName))return;
  const key=e.key.toLowerCase();
  if((key==='p'||key==='escape')&&!e.repeat){if(game.state==='playing')game.pause();else if(game.state==='paused')game.resume();clearKeys();syncState();}
  if(mappings[key]&&game.state==='playing'){e.preventDefault();keys[mappings[key]]=true;}
});
window.addEventListener('keyup',e=>{const key=mappings[e.key.toLowerCase()];if(key)keys[key]=false;});
function autoPause(){clearKeys();game.pause();syncState();}
window.addEventListener('blur',autoPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});
for(const button of document.querySelectorAll('[data-direction],#touch-sprint')) {
  const key=button.dataset.direction||'sprint';
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys[key]=true;});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys[key]=false);
  button.addEventListener('contextmenu',e=>e.preventDefault());
}
function openDialog(type) {
  resumedAfterDialog=['playing','transition'].includes(game.state);game.pause();clearKeys();syncState();
  if(type==='how')$('dialog-content').innerHTML='<span class="section-kicker">A QUICK BRIEFING</span><h2 class="dialog-title" id="dialog-title">The art of compote theft.</h2><ol class="instructions"><li><strong>Keep moving.</strong> Use WASD or the arrow keys. On a phone, use the buttons under the game.</li><li><strong>Grab jars.</strong> Walk over compotes to collect them. Cherry: 10, apricot: 25, plum: 50, golden pear: 100 points.</li><li><strong>Dodge Babushka.</strong> Hold Space (or Sprint) for a burst of speed. Let go to recharge.</li><li><strong>Survive the timer.</strong> Each completed basement awards 100 × level bonus points and takes you deeper. Collect every jar for a 250-point refill bonus.</li><li><strong>Three lives, one haul.</strong> Getting caught costs a life. After losing all three, save your score and try again.</li></ol><p class="dialog-footnote">Press P or Escape to pause. Switching tabs pauses automatically. Scores are stored only in this browser; no account is needed.</p>';
  else {
    $('dialog-content').innerHTML='<span class="section-kicker">THE COMPOTE HALL OF FAME</span><h2 class="dialog-title" id="dialog-title">Sticky fingers. Big scores.</h2><div id="score-list"></div><p class="dialog-footnote">Top 10 saved runs on this browser and device. Clearing site data clears these scores.</p>';
    const list=$('score-list');
    if(!scores.length)list.innerHTML='<p class="empty-scores">No heists on the record. Yet.<br>Play a round and save your first haul.</p>';
    else {
      const table=document.createElement('table');table.className='score-table';table.innerHTML='<thead><tr><th>#</th><th>RASCAL</th><th>BASEMENT</th><th>POINTS</th></tr></thead>';const body=document.createElement('tbody');
      scores.forEach((s,i)=>{const row=document.createElement('tr');for(const value of [i+1,s.name.slice(0,18),s.level,s.score.toLocaleString()]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);});table.append(body);list.append(table);
    }
  }
  $('info-dialog').showModal();
}
$('how-button').onclick=()=>openDialog('how');$('scores-button').onclick=()=>openDialog('scores');$('record-button').onclick=()=>openDialog('scores');$('dialog-close').onclick=()=>$('info-dialog').close();
$('info-dialog').addEventListener('click',e=>{if(e.target===$('info-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('info-dialog').addEventListener('close',()=>{if(resumedAfterDialog)game.resume();resumedAfterDialog=false;syncState();});
let previous=performance.now();
function frame(now){const dt=Math.max(0,(now-previous)/1000);previous=now;game.update(dt,keys);
  for(const event of game.events.splice(0)){
    if(['collect','caught','complete','start'].includes(event.type))sound(event.type);
    if(event.type==='caught')toast(game.lives?'Caught! A life lost. Your haul is safe.':'Babushka caught you. Save your haul!');
    if(event.type==='cleared')toast('Clean sweep! +250 points. Fresh jars are out.');
    if(event.type==='level')toast(`Basement ${game.level}. Keep those feet moving!`);
  }
  syncState();updateHud();render(ctx,game,now/1000,reducedMotion);requestAnimationFrame(frame);
}
syncState();updateHud();requestAnimationFrame(frame);
