export const WIDTH = 480, HEIGHT = 300, TILE = 20, COLS = 24, ROWS = 15;
export const COMPOTES = [
  { name: 'Cherry', points: 10, color: '#b75c4c', light: '#e49a70' },
  { name: 'Apricot', points: 25, color: '#d99743', light: '#f0c879' },
  { name: 'Plum', points: 50, color: '#8d7297', light: '#bc9fb7' },
  { name: 'Golden pear', points: 100, color: '#c8b45c', light: '#f3df88' },
];
export const BASEMENTS = ['The pantry', 'The pickle room', 'The old cellar', 'The secret stash', 'Babushka’s vault'];

export function makeMap(level) {
  const map = Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 ? 1 : 0));
  const variant = (level - 1) % 5;
  for (const y of [3, 6, 9, 12]) {
    for (const start of [4, 10, 17]) {
      const offset = variant === 1 && y % 2 ? -1 : variant === 3 && y === 6 ? 1 : 0;
      const length = variant === 2 ? 3 : variant === 4 && y === 9 ? 5 : 4;
      for (let x = start + offset; x < start + offset + length; x++) map[y][x] = 2;
    }
  }
  return map;
}

export function findPath(map, start, target) {
  const sx = Math.floor(start.x / TILE), sy = Math.floor(start.y / TILE);
  const tx = Math.floor(target.x / TILE), ty = Math.floor(target.y / TILE);
  const queue = [[sx, sy]], visited = new Set([`${sx},${sy}`]), parents = new Map();
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    if (x === tx && y === ty) {
      const path = [];
      let key = `${x},${y}`;
      while (parents.has(key)) {
        const [px, py] = key.split(',').map(Number);
        path.unshift({ x: px * TILE + TILE / 2, y: py * TILE + TILE / 2 });
        key = parents.get(key);
      }
      return path;
    }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
      if (map[ny]?.[nx] === 0 && !visited.has(key)) {
        visited.add(key); parents.set(key, `${x},${y}`); queue.push([nx, ny]);
      }
    }
  }
  return [];
}

export class Game {
  constructor(random = Math.random) { this.random = random; this.events = []; this.newRun(); this.state = 'menu'; this.events = []; }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  newRun() {
    this.score = 0; this.lives = 3; this.level = 1; this.jarsCollected = 0; this.energy = 1; this.particles = [];
    this.events = []; this.loadLevel(); this.state = 'playing'; this.emit('start');
  }
  loadLevel() {
    this.map = makeMap(this.level); this.duration = Math.max(30, 45 - Math.floor((this.level - 1) / 2) * 2);
    this.time = this.duration; this.player = { x: 50, y: 250, facing: 1, moving: false };
    this.granny = { x: 430, y: 50, facing: -1, moving: false }; this.invincible = 1.4; this.path = []; this.pathTime = 0;
    this.energy = 1; this.refillJars();
  }
  refillJars() {
    const cells = [];
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
      if (this.map[y][x] === 0 && Math.hypot(x * TILE + 10 - this.player.x, y * TILE + 10 - this.player.y) > 35) cells.push({ x: x * TILE + 10, y: y * TILE + 10 });
    }
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    this.jars = cells.slice(0, 22).map((cell, i) => ({ ...cell, type: i === 0 ? 3 : i < 4 ? 2 : i < 10 ? 1 : 0, phase: this.random() * Math.PI * 2 }));
  }
  canMove(x, y, radius = 5) {
    return [[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]].every(([dx, dy]) => this.map[Math.floor((y + dy) / TILE)]?.[Math.floor((x + dx) / TILE)] === 0);
  }
  move(actor, dx, dy) {
    if (this.canMove(actor.x + dx, actor.y)) actor.x += dx;
    if (this.canMove(actor.x, actor.y + dy)) actor.y += dy;
    actor.moving = Math.abs(dx) + Math.abs(dy) > .01;
    if (dx) actor.facing = Math.sign(dx);
  }
  pause() { if (['playing', 'transition'].includes(this.state)) { this.resumeState = this.state; this.state = 'paused'; this.emit('pause'); } }
  resume() { if (this.state === 'paused') this.state = this.resumeState || 'playing'; }
  endRun() { if (['playing', 'paused', 'transition'].includes(this.state)) { this.state = 'over'; this.emit('over'); } }
  update(dt, keys = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Small simulation steps keep collisions and the clock consistent on slower screens.
    const elapsed = Math.min(dt, .5), steps = Math.ceil(elapsed / .02);
    for (let i = 0; i < steps; i++) this.tick(elapsed / steps, keys);
  }
  tick(dt, keys) {
    if (this.state === 'transition') {
      this.transitionTime -= dt;
      if (this.transitionTime <= 0) { this.level++; this.loadLevel(); this.state = 'playing'; this.emit('level'); }
      return;
    }
    if (this.state !== 'playing') return;
    this.time = Math.max(0, this.time - dt); this.invincible = Math.max(0, this.invincible - dt);
    let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    const moving = dx !== 0 || dy !== 0, sprinting = keys.sprint && this.energy > .025 && moving;
    const speed = sprinting ? 105 : 64, length = Math.hypot(dx, dy) || 1;
    this.energy = Math.max(0, Math.min(1, this.energy + (sprinting ? -.42 : .22) * dt));
    this.move(this.player, dx / length * speed * dt, dy / length * speed * dt);
    this.pathTime -= dt;
    if (this.pathTime <= 0) { this.path = findPath(this.map, this.granny, this.player); this.pathTime = .24; }
    const target = this.path[0] || this.player;
    const gx = target.x - this.granny.x, gy = target.y - this.granny.y, distance = Math.hypot(gx, gy);
    const grannySpeed = Math.min(60, 37 + (this.level - 1) * 2.2);
    const step = Math.min(grannySpeed * dt, distance);
    if (distance > .1) this.move(this.granny, gx / distance * step, gy / distance * step);
    if (distance < 2 && this.path.length) this.path.shift();
    for (let i = this.jars.length - 1; i >= 0; i--) {
      const jar = this.jars[i];
      if (Math.hypot(jar.x - this.player.x, jar.y - this.player.y) < 10) {
        const fruit = COMPOTES[jar.type]; this.score += fruit.points; this.jarsCollected++;
        this.particles.push({ x: jar.x, y: jar.y - 9, text: `+${fruit.points}`, color: fruit.light, life: 1 });
        this.jars.splice(i, 1); this.emit('collect', { points: fruit.points, name: fruit.name });
      }
    }
    if (!this.jars.length) { this.score += 250; this.refillJars(); this.emit('cleared'); }
    if (!this.invincible && Math.hypot(this.granny.x - this.player.x, this.granny.y - this.player.y) < 12) {
      this.lives--; this.emit('caught');
      if (this.lives === 0) { this.endRun(); return; }
      this.player.x = 50; this.player.y = 250; this.granny.x = 430; this.granny.y = 50;
      this.invincible = 3; this.path = []; this.pathTime = 0; this.energy = 1;
    }
    this.particles = this.particles.filter(p => { p.life -= dt; p.y -= dt * 13; return p.life > 0; });
    if (this.time <= 0) {
      const bonus = this.level * 100; this.score += bonus; this.state = 'transition'; this.transitionTime = 2.8; this.emit('complete', { bonus });
    }
  }
}

export function readScores(storage) {
  try {
    const scores = JSON.parse(storage.getItem('compote-scores-v1') || '[]');
    if (!Array.isArray(scores)) return [];
    return scores.filter(s => s && typeof s.name === 'string' && Number.isSafeInteger(s.score) && s.score >= 0 && Number.isSafeInteger(s.level) && s.level > 0)
      .sort((a,b) => b.score - a.score).slice(0,10);
  } catch { return []; }
}

export function saveScore(storage, entry) {
  const scores = readScores(storage);
  scores.push({ name: String(entry.name).trim().slice(0,18) || 'Little rascal', score: entry.score, level: entry.level, date: new Date().toISOString() });
  scores.sort((a,b) => b.score - a.score);
  storage.setItem('compote-scores-v1', JSON.stringify(scores.slice(0,10)));
  return scores.slice(0,10);
}
