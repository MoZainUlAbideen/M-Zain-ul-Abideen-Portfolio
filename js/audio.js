// ─────────────────────────────────────────────────────────────
//  Sound, generated live with Web Audio (no audio files needed):
//   · car engine (pitch follows speed) and the boost whoosh
//   · goal: crowd roar + goal horn
//   · car/ball hits
//   · match: countdown beeps and the referee's whistle
// ─────────────────────────────────────────────────────────────

export class ArenaAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try { this.muted = localStorage.getItem('arena-muted') === '1'; } catch {}
  }

  // must be called from a click/keypress (browsers block audio before that)
  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    this.noise = this.makeNoise(4);
    this.boostSetup();
    this.engineSetup();
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('arena-muted', this.muted ? '1' : '0'); } catch {}
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  // pinkish noise buffer, looped by whoever uses it
  makeNoise(seconds) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048;
      d[i] = (b0 + b1 + b2 + w * 0.02) * 1.6;
    }
    return buf;
  }

  noiseSource() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.loopStart = Math.random() * 2;
    return s;
  }

  lfo(target, rate, depth) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = rate;
    g.gain.value = depth;
    o.connect(g).connect(target);
    o.start();
  }

  boostSetup() {
    const ctx = this.ctx;
    const src = this.noiseSource();
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass'; hp.frequency.value = 1400; hp.Q.value = 0.5;
    this.boostGain = ctx.createGain();
    this.boostGain.gain.value = 0;
    src.connect(hp).connect(this.boostGain).connect(this.master);
    src.start();
  }

  // Engine: a light electric-motor whine (like a Mini 4WD motor), not a big-car growl.
  // Two soft triangle tones an octave apart; pitch rises with speed, volume stays gentle.
  engineSetup() {
    const ctx = this.ctx;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 900;
    this.engFilter.Q.value = 0.8;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engFilter.connect(this.engGain).connect(this.master);
    // motor tone + a soft low growl underneath (a touch of Rocket League weight)
    this.engOsc = [['triangle', 1, 1], ['sine', 2, 0.25], ['sawtooth', 0.5, 0.35]].map(([type, mult, level]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = 100 * mult;
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g).connect(this.engFilter);
      o.start();
      return { o, mult };
    });
    // a faint shimmer so it sounds like a spinning motor, not a flat tone
    const shimmer = ctx.createOscillator();
    const sg = ctx.createGain();
    shimmer.frequency.value = 19;
    sg.gain.value = 4;
    shimmer.connect(sg);
    for (const { o } of this.engOsc) sg.connect(o.frequency);
    shimmer.start();
  }

  // speed in units/s, throttle -1..1, onGround bool
  engine(speed, throttle, boosting, onGround) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = Math.min(1, Math.abs(speed) / 40);
    const rev = onGround ? s : Math.max(s, 0.5);
    const f = 100 + rev * 210 + (boosting ? 30 : 0);
    for (const { o, mult } of this.engOsc) o.frequency.setTargetAtTime(f * mult, t, 0.12);
    this.engFilter.frequency.setTargetAtTime(800 + rev * 1100, t, 0.15);
    const vol = (Math.abs(speed) > 0.5 || throttle ? 0.007 : 0) + rev * 0.014 + (boosting ? 0.005 : 0);
    this.engGain.gain.setTargetAtTime(vol, t, 0.15);
  }

  engineOff() {
    if (this.ctx) this.engGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  setBoost(on) {
    if (!this.ctx) return;
    this.boostGain.gain.setTargetAtTime(on ? 0.08 : 0, this.ctx.currentTime, on ? 0.04 : 0.12);
  }

  hit(strength) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const v = Math.min(1, strength / 35);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    g.gain.setValueAtTime(0.9 * v + 0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.3);
    // metallic click on top
    const n = this.noiseSource();
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.35 * v, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    n.connect(f).connect(ng).connect(this.master);
    n.start(t); n.stop(t + 0.08);
  }

  goal() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;

    // crowd roar
    for (const [freq, q, peak] of [[900, 0.5, 0.65], [300, 0.7, 0.58], [2200, 0.9, 0.22]]) {
      const n = this.noiseSource();
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.35);
      g.gain.setValueAtTime(peak, t + 1.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
      n.connect(f).connect(g).connect(this.master);
      n.start(t); n.stop(t + 5.1);
    }

    // goal horn: a bright chord that swells and fades
    const horn = ctx.createGain();
    const hl = ctx.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 1800;
    horn.gain.setValueAtTime(0.0001, t);
    horn.gain.exponentialRampToValueAtTime(0.12, t + 0.08);
    horn.gain.setValueAtTime(0.12, t + 1.1);
    horn.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    hl.connect(horn).connect(this.master);
    for (const f of [196, 246.9, 293.7, 392]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f;
      o.connect(hl); o.start(t); o.stop(t + 2);
    }
  }

  // countdown beep: short, higher on "GO"
  beep(go = false) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = go ? 880 : 520;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (go ? 0.45 : 0.18));
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.5);
  }

  // referee's whistle (warbling high tone); `long` for full time
  whistle(long = false) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const blasts = long ? [[0, 0.32], [0.42, 0.32], [0.84, 0.9]] : [[0, 0.5]];
    for (const [at, len] of blasts) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 2900;
      const trill = ctx.createOscillator(), td = ctx.createGain();
      trill.frequency.value = 38; td.gain.value = 140;
      trill.connect(td).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(0.1, t + at + 0.02);
      g.gain.setValueAtTime(0.1, t + at + len - 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
      o.connect(g).connect(this.master);
      o.start(t + at); o.stop(t + at + len + 0.05);
      trill.start(t + at); trill.stop(t + at + len + 0.05);
    }
  }
}
