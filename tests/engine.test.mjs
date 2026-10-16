import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, makeMap, findPath, readScores, saveScore, TILE, COMPOTES } from '../src/engine.js';

function advance(game, seconds, keys={}) { for(let elapsed=0;elapsed<seconds;elapsed+=.02)game.update(.02,keys); }
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};};

test('every basement layout has connected corridors and reachable pickups',()=>{
  for(let level=1;level<=15;level++){
    const game=new Game();game.level=level;game.loadLevel();
    assert.equal(game.map.length,15);assert.ok(game.canMove(game.player.x,game.player.y));assert.ok(game.canMove(game.granny.x,game.granny.y));
    for(let y=1;y<14;y++)for(let x=1;x<23;x++)if(game.map[y][x]===0){
      const target={x:x*TILE+10,y:y*TILE+10};
      if(target.x!==game.player.x||target.y!==game.player.y)assert.ok(findPath(game.map,game.player,target).length,`Unreachable cell ${x},${y} at level ${level}`);
    }
    assert.equal(game.jars.length,22);assert.equal(game.jars.filter(j=>j.type===3).length,1);
    for(const jar of game.jars)assert.ok(game.canMove(jar.x,jar.y));
  }
});
test('all compote types award their points exactly once',()=>{
  for(let type=0;type<COMPOTES.length;type++){
    const game=new Game();game.state='playing';game.jars=[{x:50,y:250,type},{x:450,y:250,type:0}];
    game.update(.02);assert.equal(game.score,COMPOTES[type].points);assert.equal(game.jarsCollected,1);
    game.update(.02);assert.equal(game.score,COMPOTES[type].points);
  }
});
test('emptying the pantry gives a bonus and refills reachable jars',()=>{
  const game=new Game();game.state='playing';game.jars=[{x:50,y:250,type:0}];game.update(.02);
  assert.equal(game.score,260);assert.equal(game.jars.length,22);assert.ok(game.events.some(e=>e.type==='cleared'));
});
test('collision prevents walking through shelves and boundary walls',()=>{
  const game=new Game();game.state='playing';game.granny={x:430,y:50};
  game.player={x:75,y:70};advance(game,1,{right:true});assert.ok(game.player.x<=75.1);
  game.player={x:26,y:30};advance(game,.7,{left:true});assert.ok(game.player.x>=25);
});
test('Babushka navigates around shelves to catch a stationary player',()=>{
  for(let level=1;level<=5;level++){
    const game=new Game();game.level=level;game.loadLevel();game.state='playing';
    advance(game,22);assert.ok(game.lives<3,`Babushka got stuck on level ${level}`);
  }
});
test('three catches end the run while preserving the current score',()=>{
  const game=new Game();game.state='playing';game.score=625;
  for(let i=0;i<3;i++){game.invincible=0;game.granny.x=game.player.x;game.granny.y=game.player.y;game.update(.02);}
  assert.equal(game.lives,0);assert.equal(game.state,'over');assert.equal(game.score,625);
  const time=game.time;advance(game,1);assert.equal(game.time,time);
});
test('timer completes a level, awards bonus, and automatically opens next basement',()=>{
  const game=new Game();game.state='playing';game.time=.01;game.update(.02);
  assert.equal(game.state,'transition');assert.equal(game.score,100);const lives=game.lives;
  advance(game,3);assert.equal(game.level,2);assert.equal(game.state,'playing');assert.equal(game.lives,lives);assert.ok(game.time>44);
});
test('pause freezes the clock and all actors, then resumes',()=>{
  const game=new Game();game.state='playing';game.pause();const time=game.time;const player={...game.player};const granny={...game.granny};
  advance(game,3,{right:true});assert.equal(game.time,time);assert.deepEqual(game.player,player);assert.deepEqual(game.granny,granny);
  game.resume();advance(game,.2,{right:true});assert.ok(game.time<time);assert.ok(game.player.x>player.x);
});
test('sprint is faster, consumes energy, and recovers on release',()=>{
  const game=new Game();game.state='playing';const initial=game.player.x;advance(game,.2,{right:true,sprint:true});
  assert.ok(game.player.x-initial>19);assert.ok(game.energy<1);const energy=game.energy;
  advance(game,.2);assert.ok(game.energy>energy);
});
test('new runs reset score, lives, level and counters',()=>{
  const game=new Game();game.level=9;game.score=1234;game.lives=0;game.jarsCollected=30;game.newRun();
  assert.equal(game.state,'playing');assert.equal(game.level,1);assert.equal(game.score,0);assert.equal(game.lives,3);assert.equal(game.jarsCollected,0);
});
test('slower frames preserve simulation time, movement and stamina',()=>{
  const fast=new Game(()=>.5),slow=new Game(()=>.5);fast.state='playing';slow.state='playing';
  for(let i=0;i<10;i++)fast.update(.02,{right:true,sprint:true});
  slow.update(.2,{right:true,sprint:true});
  assert.ok(Math.abs(fast.time-slow.time)<.0001);assert.ok(Math.abs(fast.player.x-slow.player.x)<.0001);assert.ok(Math.abs(fast.energy-slow.energy)<.0001);
});
test('pausing between levels freezes and resumes the transition',()=>{
  const game=new Game();game.state='playing';game.time=.01;game.update(.02);game.pause();
  advance(game,5);assert.equal(game.level,1);assert.equal(game.state,'paused');
  game.resume();assert.equal(game.state,'transition');advance(game,3);assert.equal(game.level,2);
});
test('high scores persist, sort, limit to ten, and normalize blank names',()=>{
  const storage=memory();for(let score=0;score<15;score++)saveScore(storage,{name:'  Rascal  ',score,level:1});
  let scores=readScores(storage);assert.equal(scores.length,10);assert.equal(scores[0].score,14);assert.equal(scores[0].name,'Rascal');
  saveScore(storage,{name:' ',score:2000,level:3});scores=readScores(storage);assert.equal(scores[0].name,'Little rascal');assert.equal(scores[0].level,3);
});
test('corrupt and unavailable browser storage never breaks score reading',()=>{
  for(const value of ['bad json','{}','null','[null,{}, {"name":"bad","score":-1,"level":1}]']){
    assert.deepEqual(readScores({getItem:()=>value}),[]);
  }
  assert.deepEqual(readScores({getItem:()=>{throw new Error('blocked');}}),[]);
});
