import test from 'node:test';
import assert from 'node:assert/strict';
import { MovementControls, swipeDirection, tiltVector, tiltDirections } from '../src/controls.js';
import { Game } from '../src/engine.js';

class Events {
  listeners = new Map();
  addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(callback); }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, event = {}) { for (const callback of this.listeners.get(type) || []) callback(event); }
  setPointerCapture() {}
}
function setup(options = {}) {
  let now = 0;
  const timers = new Map(), values = new Map(Object.entries(options.saved || {}));
  const env = Object.assign(new Events(), {
    isSecureContext: true, DeviceOrientationEvent: class {}, navigator: { maxTouchPoints: 0 },
    matchMedia: () => ({ matches: false }), screen: { orientation: Object.assign(new Events(), { angle: 0 }) },
    performance: { now: () => now },
    setTimeout: callback => { const id = {}; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id),
    ...options.environment,
  });
  const surface = new Events(), changes = [];
  const controls = new MovementControls({ surface, environment: env, storage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }, canPlay: options.canPlay, onChange: change => changes.push(change) });
  const pointer = (type, x, y, id = 1) => surface.emit(type, { clientX: x, clientY: y, pointerId: id, button: 0, preventDefault() {} });
  return { controls, env, surface, changes, values, pointer, advance: ms => now += ms, timeout: () => { for (const callback of [...timers.values()]) callback(); } };
}

test('swipes resolve all four cardinal directions and ignore small taps', () => {
  assert.equal(swipeDirection(80, 5), 'right'); assert.equal(swipeDirection(-80, 5), 'left');
  assert.equal(swipeDirection(5, -80), 'up'); assert.equal(swipeDirection(5, 80), 'down');
  assert.equal(swipeDirection(10, 10), null);
});
test('swiping moves continuously after release, turns, and a tap stops', async () => {
  const { controls, pointer } = setup(); await controls.select('swipe');
  pointer('pointerdown', 100, 100); pointer('pointerup', 150, 100);
  assert.equal(controls.read().right, true);
  const game = new Game(() => .5); game.newRun(); const x = game.player.x; game.update(.1, controls.read()); assert.ok(game.player.x > x);
  pointer('pointerdown', 100, 100); pointer('pointermove', 100, 50); pointer('pointerup', 100, 50);
  assert.equal(controls.read().up, true); assert.equal(controls.read().right, false);
  pointer('pointerdown', 100, 100); pointer('pointerup', 101, 100);
  assert.equal(controls.read().up, false);
});
test('gesture cancellation, reset, and mode switches stop previous movement', async () => {
  const { controls, pointer, surface } = setup(); await controls.select('swipe');
  pointer('pointerdown', 0, 0); pointer('pointermove', 50, 0); surface.emit('pointercancel'); assert.equal(controls.read().right, false);
  pointer('pointerdown', 0, 0); pointer('pointermove', 50, 0); controls.reset(); assert.equal(controls.read().right, false);
  pointer('pointerdown', 0, 0); pointer('pointerup', 50, 0); await controls.select('keyboard'); assert.equal(controls.read().right, false);
});
test('swipes are ignored outside play and extra pointers cannot hijack a gesture', async () => {
  const paused = setup({ canPlay: () => false }); await paused.controls.select('swipe');
  paused.pointer('pointerdown', 0, 0); paused.pointer('pointerup', 50, 0); assert.equal(paused.controls.read().right, false);
  const { controls, pointer } = setup(); await controls.select('swipe');
  pointer('pointerdown', 0, 0); pointer('pointermove', 50, 0, 2); assert.equal(controls.read().right, false);
});
test('keyboard movement is selected explicitly while sprint and manual buttons remain usable', async () => {
  const { controls } = setup(); controls.keyboard.right = true; assert.equal(controls.read().right, true);
  await controls.select('swipe'); controls.keyboard.right = true; controls.keyboard.sprint = true;
  assert.equal(controls.read().right, false); assert.equal(controls.read().sprint, true);
  controls.buttons.left = true; controls.buttons.sprint = true; assert.equal(controls.read().left, true);
});
test('mobile defaults to swipes, preferences persist, and stored tilt never requests permission on load', async () => {
  assert.equal(setup({ environment: { navigator: { maxTouchPoints: 1 } } }).controls.mode, 'swipe');
  assert.equal(setup({ saved: { 'compote-controls-v1': 'swipe' } }).controls.mode, 'swipe');
  let requests = 0;
  const { controls } = setup({ saved: { 'compote-controls-v1': 'tilt' }, environment: { DeviceOrientationEvent: { requestPermission: () => { requests++; } } } });
  assert.equal(requests, 0); assert.notEqual(controls.mode, 'tilt');
});
test('tilt converts portrait and both landscape rotations to screen directions', () => {
  const neutral = { beta: 25, gamma: 2 };
  assert.equal(tiltDirections(tiltVector(25, 20, neutral)).right, true);
  assert.equal(tiltDirections(tiltVector(5, 2, neutral)).up, true);
  assert.equal(tiltDirections(tiltVector(45, 2, neutral, 90)).right, true);
  assert.equal(tiltDirections(tiltVector(45, 2, neutral, 270)).left, true);
  assert.equal(tiltDirections(tiltVector(45, 2, neutral, 180)).up, true);
});
test('neutral zone and hysteresis prevent jitter', () => {
  assert.deepEqual(tiltDirections({ x: 2, y: -2 }), { left: false, right: false, up: false, down: false });
  assert.equal(tiltDirections({ x: 4, y: 0 }, { right: true }).right, true);
  assert.equal(tiltDirections({ x: 2, y: 0 }, { right: true }).right, false);
});
test('tilt requests permission in the selection gesture, calibrates, and stops when readings go stale', async () => {
  let requests = 0;
  const { controls, env, advance } = setup({ environment: { DeviceOrientationEvent: { requestPermission: () => { requests++; return Promise.resolve('granted'); } } } });
  const selecting = controls.select('tilt'); assert.equal(requests, 1); await selecting;
  assert.equal(controls.pending, true); env.emit('deviceorientation', { beta: 30, gamma: 0 });
  assert.equal(controls.pending, false); assert.equal(controls.read().down, false);
  env.emit('deviceorientation', { beta: 30, gamma: 15 }); assert.equal(controls.read().right, true);
  controls.recenter(); assert.equal(controls.read().right, false);
  env.emit('deviceorientation', { beta: 10, gamma: 15 }); assert.equal(controls.read().up, true);
  advance(701); assert.equal(controls.read().up, false);
});
test('permission denial, blocked APIs, missing support, and insecure hosting all preserve a usable fallback', async () => {
  for (const environment of [
    { isSecureContext: false }, { DeviceOrientationEvent: undefined },
    { DeviceOrientationEvent: { requestPermission: async () => 'denied' } },
    { DeviceOrientationEvent: { requestPermission: async () => { throw new Error('blocked'); } } },
  ]) {
    const { controls } = setup({ environment }); await controls.select('swipe');
    assert.equal(await controls.select('tilt'), false); assert.equal(controls.mode, 'swipe'); assert.equal(controls.pending, false);
  }
});
test('null sensor readings time out to the previous mode and detach listeners', async () => {
  const { controls, env, timeout } = setup(); await controls.select('tilt');
  env.emit('deviceorientation', { beta: null, gamma: null }); assert.equal(controls.pending, true);
  timeout(); assert.equal(controls.mode, 'keyboard'); assert.equal(env.listeners.get('deviceorientation').size, 0);
});
test('a permission response arriving after a mode change cannot reactivate tilt', async () => {
  let grant;
  const { controls, env } = setup({ environment: { DeviceOrientationEvent: { requestPermission: () => new Promise(resolve => grant = resolve) } } });
  const selecting = controls.select('tilt'); await controls.select('swipe'); grant('granted'); await selecting;
  assert.equal(controls.mode, 'swipe'); assert.equal(controls.sensorAttached, false);
  assert.equal(env.listeners.get('deviceorientation')?.size || 0, 0);
});
test('screen rotation recalibrates instead of causing an unexpected movement', async () => {
  const { controls, env } = setup(); await controls.select('tilt');
  env.emit('deviceorientation', { beta: 20, gamma: 0 }); env.emit('deviceorientation', { beta: 20, gamma: 15 });
  assert.equal(controls.read().right, true); env.screen.orientation.angle = 90; env.screen.orientation.emit('change');
  assert.equal(controls.read().right, false); env.emit('deviceorientation', { beta: 25, gamma: 0 });
  assert.equal(controls.read().right, false); env.emit('deviceorientation', { beta: 40, gamma: 0 }); assert.equal(controls.read().right, true);
  await controls.select('keyboard'); assert.equal(env.listeners.get('deviceorientation').size, 0);
});
