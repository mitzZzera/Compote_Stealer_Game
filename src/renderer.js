import { WIDTH, HEIGHT, TILE, COMPOTES, COLS, ROWS } from './engine.js';

function rect(ctx,x,y,w,h,color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x),Math.round(y),w,h); }
function jar(ctx, x, y, type, scale = 1) {
  const f = COMPOTES[type]; ctx.save(); ctx.translate(Math.round(x),Math.round(y)); ctx.scale(scale,scale);
  rect(ctx,-4,-5,8,11,'#332a20'); rect(ctx,-3,-4,6,9,f.color); rect(ctx,-3,-6,6,2,'#cfb779');
  rect(ctx,-2,-2,1,6,f.light); rect(ctx,-2,0,4,3,'#e4d6b0'); rect(ctx,0,1,1,1,f.color); ctx.restore();
}
function character(ctx,actor,granny,t,invincible) {
  if (!granny && invincible > 0 && Math.floor(t * 10) % 3 === 0) return;
  const x = Math.round(actor.x), y = Math.round(actor.y), bob = actor.moving ? Math.round(Math.sin(t * 18)) : 0;
  ctx.fillStyle='#171b1766';ctx.beginPath();ctx.ellipse(x,y+6,8,3,0,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.translate(x,y+bob);
  if (granny) {
    rect(ctx,-6,-13,12,11,'#a79c7e');rect(ctx,-4,-15,8,3,'#c4b593');rect(ctx,-4,-10,8,7,'#e0b890');
    rect(ctx,-6,-4,12,9,'#756978');rect(ctx,-4,0,8,5,'#c3bda0');rect(ctx,-7,-2,3,5,'#d4aa82');rect(ctx,5,-2,3,5,'#d4aa82');
    rect(ctx,-4,5,3,2,'#3c3434');rect(ctx,2,5,3,2,'#3c3434');
    rect(ctx,9,-8,1,15,'#bba16a');rect(ctx,7,-9,5,3,'#bba16a');rect(ctx,8,-11,1,3,'#ccb27b');rect(ctx,10,-11,1,3,'#ccb27b');
    rect(ctx,-3,-8,2,2,'#434637');rect(ctx,1,-8,2,2,'#434637');rect(ctx,-1,-8,2,1,'#434637');rect(ctx,-1,-4,3,1,'#8d6551');
  } else {
    rect(ctx,-5,-13,10,5,'#bb623f');rect(ctx,-6,-10,13,2,'#dd8953');rect(ctx,-4,-8,8,6,'#e3b681');
    rect(ctx,actor.facing>0?1:-3,-7,2,2,'#34382e');rect(ctx,-4,-2,9,7,'#c0794b');rect(ctx,-5,0,3,4,'#e3b681');
    rect(ctx,3,0,3,4,'#e3b681');rect(ctx,-4,4,4,3,'#58727a');rect(ctx,1,4,4,3,'#58727a');
    const step = actor.moving ? Math.round(Math.sin(t*18)*1.4) : 0;
    rect(ctx,-5,7+step,5,2,'#35382b');rect(ctx,1,7-step,5,2,'#35382b');rect(ctx,-7,0,3,6,'#9a824d');
  }
  ctx.restore();
}
export function render(ctx, game, t, reduced = false) {
  ctx.save();ctx.scale(2,2);ctx.imageSmoothingEnabled=false;
  rect(ctx,0,0,WIDTH,HEIGHT,'#3a3a2a');
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) {
    if(game.map[y][x]===1) {
      rect(ctx,x*TILE,y*TILE,TILE,TILE,'#42452f');rect(ctx,x*TILE,y*TILE+1,19,8,'#54523a');rect(ctx,x*TILE+1,y*TILE+11,18,7,'#4e5036');
      rect(ctx,x*TILE,y*TILE+9,20,2,'#303727');
    } else {
      const n=(x*31+y*17)%7;
      rect(ctx,x*TILE,y*TILE,TILE,TILE,['#686044','#6a6246','#645e43','#6c6447','#665e43','#6b6144','#625b40'][n]);
      rect(ctx,x*TILE,y*TILE,20,1,'#514d35');rect(ctx,x*TILE,y*TILE,1,20,'#514d353b');
      if(n<3) {rect(ctx,x*TILE+7,y*TILE+10,5,1,'#534f35');rect(ctx,x*TILE+12,y*TILE+11,2,1,'#534f35');}
      if(n===4)rect(ctx,x*TILE+3,y*TILE+4,1,1,'#9a8b5a');
    }
  }
  // Pipes, cobwebs, warm cellar lights and the stairs home.
  rect(ctx,19,16,440,3,'#252e25');rect(ctx,20,15,438,2,'#8a8161');
  for(const x of [69,230,389]) {
    rect(ctx,x,17,1,10,'#252b23');rect(ctx,x-5,26,11,3,'#272e23');rect(ctx,x-3,29,7,3,'#e2be6f');
    const glow=ctx.createRadialGradient(x,32,1,x,39,52);glow.addColorStop(0,'#ebbf5c23');glow.addColorStop(1,'#eac56d00');ctx.fillStyle=glow;ctx.fillRect(x-52,21,104,76);
  }
  for(let i=0;i<4;i++) {rect(ctx,22,270-i*5,34,4,'#8c8160');rect(ctx,22,274-i*5,34,1,'#363c2b');}
  rect(ctx,25,251,28,2,'#c1aa79');rect(ctx,24,244,2,14,'#9a8d62');rect(ctx,51,244,2,14,'#9a8d62');
  ctx.fillStyle='#b2ad8755';ctx.font='4px monospace';ctx.fillText('UP',34,248);
  ctx.strokeStyle='#aca87c40';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(20,20);ctx.lineTo(43,20);ctx.lineTo(20,42);ctx.lineTo(20,20);ctx.lineTo(34,34);ctx.moveTo(20,29);ctx.lineTo(30,29);ctx.lineTo(30,20);ctx.stroke();
  // Shelves have a high back and a front lip, giving a tiny diorama depth.
  for(let y=1;y<ROWS-1;y++) for(let x=1;x<COLS-1;x++) if(game.map[y][x]===2) {
    const px=x*TILE,py=y*TILE;
    rect(ctx,px+1,py+7,20,18,'#252c2266');rect(ctx,px,py-4,20,24,'#423b2a');rect(ctx,px,py-4,20,3,'#9a7d4d');
    rect(ctx,px+1,py,18,13,'#59482e');rect(ctx,px,py+13,20,4,'#a48650');rect(ctx,px+1,py+17,18,3,'#725934');
    rect(ctx,px,py-3,2,23,'#80673e');rect(ctx,px+18,py-3,2,23,'#80673e');
    jar(ctx,px+6,py+7,(x+y)%4,.7);jar(ctx,px+14,py+7,(x+y+1)%3,.7);
    rect(ctx,px+5,py+14,4,1,'#ccb37b');
  }
  for(const pickup of game.jars) {
    const float=reduced?0:Math.sin(t*2.3+pickup.phase)*1.2;
    ctx.fillStyle=pickup.type===3?'#e1c56b20':'#b4a46814';ctx.beginPath();ctx.ellipse(pickup.x,pickup.y+4,7,3,0,0,Math.PI*2);ctx.fill();
    jar(ctx,pickup.x,pickup.y-1+float,pickup.type,.8);
    if(pickup.type===3){const sparkle=reduced||Math.sin(t*3)>0; if(sparkle){rect(ctx,pickup.x+6,pickup.y-8,1,3,'#f6dc8d');rect(ctx,pickup.x+5,pickup.y-7,3,1,'#f6dc8d');}}
  }
  const actors=[{actor:game.player,granny:false},{actor:game.granny,granny:true}].sort((a,b)=>a.actor.y-b.actor.y);
  for(const a of actors) character(ctx,a.actor,a.granny,reduced?0:t,game.state==='menu'?0:game.invincible);
  const vignette=ctx.createRadialGradient(240,145,80,240,150,290);vignette.addColorStop(0,'#17251c00');vignette.addColorStop(1,'#17251c8c');ctx.fillStyle=vignette;ctx.fillRect(0,0,WIDTH,HEIGHT);
  for(const particle of game.particles){ctx.globalAlpha=Math.min(1,particle.life*2);ctx.font='bold 7px monospace';ctx.textAlign='center';ctx.fillStyle='#252c24';ctx.fillText(particle.text,particle.x+1,particle.y+1);ctx.fillStyle=particle.color;ctx.fillText(particle.text,particle.x,particle.y);}
  ctx.restore();
}
