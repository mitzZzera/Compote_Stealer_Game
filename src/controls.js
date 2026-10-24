const MODES = ['keyboard', 'swipe', 'tilt'];
const DIRECTIONS = ['up', 'down', 'left', 'right'];
const MODE_HINTS = {
  keyboard: 'Hold WASD or the arrow keys to move. Hold Space to sprint.',
  swipe: 'Swipe on the basement to keep moving. Swipe again to turn; tap to stop.',
  tilt: 'Tilt gently to move; return to center to stop. Recenter in a comfortable position.',
};

export function swipeDirection(dx, dy, threshold = 24) {
  if (Math.hypot(dx, dy) < threshold) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

export function tiltVector(beta, gamma, neutral, angle = 0) {
  const radians = angle * Math.PI / 180;
  const pitch = ((beta - neutral.beta + 540) % 360) - 180;
  const roll = gamma - neutral.gamma;
  return { x: roll * Math.cos(radians) + pitch * Math.sin(radians), y: pitch * Math.cos(radians) - roll * Math.sin(radians) };
}

export function tiltDirections({ x, y }, previous = {}) {
  // Hysteresis keeps a small hand tremor from rapidly toggling movement.
  return {
    left: x < -(previous.left ? 3 : 6), right: x > (previous.right ? 3 : 6),
    up: y < -(previous.up ? 3 : 6), down: y > (previous.down ? 3 : 6),
  };
}

export class MovementControls {
  constructor({ surface, environment = window, storage, canPlay = () => true, onChange = () => {} }) {
    this.surface = surface; this.env = environment; this.storage = storage; this.canPlay = canPlay; this.onChange = onChange;
    this.keyboard = {}; this.buttons = {}; this.requestId = 0; this.pending = false; this.sensorAttached = false;
    this.mode = environment.matchMedia?.('(pointer: coarse)').matches || environment.navigator?.maxTouchPoints > 0 ? 'swipe' : 'keyboard';
    let remembered;
    try { remembered = storage?.getItem('compote-controls-v1'); } catch { /* Preferences are optional. */ }
    if (['keyboard', 'swipe'].includes(remembered)) this.mode = remembered;
    this.hint = remembered === 'tilt' ? 'Choose Tilt to enable motion again, or play with keyboard or swipes.' : MODE_HINTS[this.mode];
    this.reset();
    this.onOrientation = event => this.receiveOrientation(event);
    this.onRotation = () => { this.neutral = null; this.latest = null; this.tiltInput = {}; };
    environment.addEventListener('orientationchange', this.onRotation);
    environment.screen?.orientation?.addEventListener('change', this.onRotation);
    surface.addEventListener('pointerdown', event => this.pointerDown(event));
    surface.addEventListener('pointermove', event => this.pointerMove(event));
    surface.addEventListener('pointerup', event => this.pointerUp(event));
    surface.addEventListener('pointercancel', () => this.cancelGesture());
    surface.addEventListener('lostpointercapture', () => { if (this.pointer) this.cancelGesture(); });
  }

  snapshot() { return { mode: this.mode, pending: this.pending, hint: this.hint }; }
  notify(hint = MODE_HINTS[this.mode]) { this.hint = hint; this.onChange(this.snapshot()); }
  remember() { try { this.storage?.setItem('compote-controls-v1', this.mode); } catch { /* Storage can be blocked. */ } }
  reset() {
    this.keyboard = {}; this.buttons = {}; this.swipeInput = {}; this.tiltInput = {};
    this.pointer = null; this.neutral = null; this.latest = null;
  }
  stop() { this.swipeInput = {}; }
  cancelGesture() { this.pointer = null; this.stop(); }
  detachSensor() {
    this.env.clearTimeout(this.sensorTimeout); this.pending = false;
    if (this.sensorAttached) this.env.removeEventListener('deviceorientation', this.onOrientation);
    this.sensorAttached = false;
  }

  async select(mode) {
    if (!MODES.includes(mode)) return false;
    const previous = this.mode === 'tilt' ? 'swipe' : this.mode;
    const request = ++this.requestId;
    this.detachSensor(); this.reset();
    if (mode !== 'tilt') {
      this.mode = mode; this.remember(); this.notify(); return true;
    }
    const fail = message => {
      if (request !== this.requestId) return false;
      this.detachSensor(); this.mode = previous; this.reset(); this.remember(); this.notify(message); return false;
    };
    if (!this.env.isSecureContext) return fail('Tilt needs an HTTPS connection. Keyboard and swipes still work.');
    const Orientation = this.env.DeviceOrientationEvent;
    if (!Orientation) return fail('Tilt is unavailable on this device. Choose keyboard or swipes.');
    this.pending = true; this.notify('Enabling tilt… hold your phone in a comfortable playing position.');
    try {
      // This call must happen in the player's click handler, before any unrelated await.
      if (typeof Orientation.requestPermission === 'function') {
        const permission = await Orientation.requestPermission();
        if (request !== this.requestId) return false;
        if (permission !== 'granted') return fail('Motion permission was not granted. Choose keyboard or swipes, or try Tilt again.');
      }
      if (request !== this.requestId) return false;
      this.mode = 'tilt'; this.sensorAttached = true;
      this.env.addEventListener('deviceorientation', this.onOrientation);
      this.sensorTimeout = this.env.setTimeout(() => fail('No motion sensor readings arrived. Choose keyboard or swipes, or try Tilt again.'), 4000);
      this.notify('Waiting for your phone’s motion sensor… hold it in your playing position.');
      return true;
    } catch { return fail('Motion access was blocked. Keyboard and swipes are still available.'); }
  }

  receiveOrientation({ beta, gamma }) {
    if (this.mode !== 'tilt' || !Number.isFinite(beta) || !Number.isFinite(gamma)) return;
    this.latest = { beta, gamma, time: this.env.performance.now() };
    if (!this.neutral) {
      this.neutral = { beta, gamma }; this.tiltInput = {};
      this.env.clearTimeout(this.sensorTimeout); this.pending = false; this.remember(); this.notify();
    }
    const angle = this.env.screen?.orientation?.angle ?? this.env.orientation ?? 0;
    this.tiltInput = tiltDirections(tiltVector(beta, gamma, this.neutral, angle), this.tiltInput);
  }
  recenter() {
    this.tiltInput = {};
    this.neutral = this.latest && this.env.performance.now() - this.latest.time < 700 ? { beta: this.latest.beta, gamma: this.latest.gamma } : null;
    this.notify(this.neutral ? 'Centered! Tilt gently to move; return to this position to stop.' : 'Hold your phone steady. The next motion reading will set your center.');
  }
  read() {
    let direction = this.mode === 'keyboard' ? this.keyboard : this.mode === 'swipe' ? this.swipeInput : this.tiltInput;
    if (this.mode === 'tilt' && (!this.latest || this.env.performance.now() - this.latest.time > 700)) direction = {};
    if (DIRECTIONS.some(key => this.buttons[key])) direction = this.buttons;
    return Object.fromEntries([...DIRECTIONS.map(key => [key, Boolean(direction[key])]), ['sprint', Boolean(this.keyboard.sprint || this.buttons.sprint)]]);
  }

  pointerDown(event) {
    if (this.mode !== 'swipe' || !this.canPlay() || event.button > 0 || this.pointer) return;
    event.preventDefault(); this.surface.setPointerCapture(event.pointerId);
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  }
  pointerMove(event) {
    const pointer = this.pointer;
    if (!pointer || event.pointerId !== pointer.id) return;
    const direction = swipeDirection(event.clientX - pointer.x, event.clientY - pointer.y);
    if (!direction) return;
    this.swipeInput = { [direction]: true };
    pointer.moved = true; pointer.x = event.clientX; pointer.y = event.clientY;
  }
  pointerUp(event) {
    if (!this.pointer || event.pointerId !== this.pointer.id) return;
    this.pointerMove(event);
    if (!this.pointer.moved) this.stop();
    this.pointer = null;
  }
}
