// ─────────────────────────────────────────────────────────────
//  Sound, generated live with Web Audio (no audio files), aiming for
//  the feel of a Rocket League match:
//   · a buzzy, revving engine that climbs with speed (with "gear" steps)
//   · the boost roar, supersonic whoosh
//   · jump pop, flip whoosh, landing thud, car bumps, demolition boom
//   · the ball "thwack" (hard hits ring), softer wall bounces
//   · a constant crowd murmur that swells when the ball is near a goal
//   · goal: crowd roar + horn · match: countdown beeps and the whistle
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
    comp.threshold.value = -16; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.noise = this.makeNoise(4);
    this.boostSetup();
    this.engineSetup();
    this.crowdSetup();
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

  // a one-shot: filtered noise burst with an envelope
  burst({ type = 'bandpass', freq = 1000, q = 1, peak = 0.3, attack = 0.005, decay = 0.2, sweepTo } = {}) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this.noiseSource();
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    n.connect(f).connect(g).connect(this.master);
    n.start(t); n.stop(t + attack + decay + 0.05);
  }

  // a one-shot tone with a pitch sweep
  tone({ type = 'sine', from = 300, to = 150, peak = 0.2, attack = 0.005, decay = 0.2 } = {}) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + attack + decay);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + attack + decay + 0.05);
  }

  // ── boost: a rough rocket roar (low rumble + airy hiss) ──
  boostSetup() {
    const ctx = this.ctx;
    this.boostGain = ctx.createGain();
    this.boostGain.gain.value = 0;
    this.boostGain.connect(this.master);
    const low = this.noiseSource();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.9;
    const lg = ctx.createGain(); lg.gain.value = 1.2;
    low.connect(lp).connect(lg).connect(this.boostGain);
    const hiss = this.noiseSource();
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2600; hp.Q.value = 0.6;
    const hg = ctx.createGain(); hg.gain.value = 0.45;
    hiss.connect(hp).connect(hg).connect(this.boostGain);
    // flicker, like a flame
    const flick = ctx.createOscillator(), fg = ctx.createGain();
    flick.frequency.value = 23; fg.gain.value = 0.25;
    flick.connect(fg).connect(lg.gain);
    low.start(); hiss.start(); flick.start();
  }

  setBoost(on) {
    if (!this.ctx) return;
    this.boostGain.gain.setTargetAtTime(on ? 0.11 : 0, this.ctx.currentTime, on ? 0.03 : 0.1);
  }

  // ── engine: two detuned saws through a soft clipper, pitch climbs with speed in "gears" ──
  engineSetup() {
    const ctx = this.ctx;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 2.4); }
    shaper.curve = curve;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 700; this.engFilter.Q.value = 2.2;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    const tremGain = ctx.createGain(); tremGain.gain.value = 0.75; // tremolo rides on this, volume on engGain
    shaper.connect(this.engFilter).connect(tremGain).connect(this.engGain).connect(this.master);
    this.engOsc = [['sawtooth', 1, 0.5], ['sawtooth', 1.012, 0.45], ['square', 0.5, 0.35]].map(([type, mult, level]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = 60 * mult;
      const g = ctx.createGain(); g.gain.value = level;
      o.connect(g).connect(shaper); o.start();
      return { o, mult };
    });
    // the "putt" of the cylinders: a fast tremolo on the level
    const trem = ctx.createOscillator(), tg = ctx.createGain();
    trem.frequency.value = 34; tg.gain.value = 0.25;
    trem.connect(tg).connect(tremGain.gain); trem.start();
    this.trem = trem;
  }

  // speed in units/s, throttle -1..1, onGround bool
  engine(speed, throttle, boosting, onGround) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = Math.min(1, Math.abs(speed) / 40);
    // gears: within each band the revs climb, then drop a little at the shift
    const gear = Math.min(3, Math.floor(s * 4));
    const inGear = s * 4 - gear;
    let rev = 0.18 + gear * 0.12 + inGear * 0.32;
    if (!onGround) rev = Math.max(rev, 0.55);
    if (throttle && Math.abs(speed) < 2) rev = 0.42; // revving on the spot
    const f = 48 + rev * 150 + (boosting ? 18 : 0);
    for (const { o, mult } of this.engOsc) o.frequency.setTargetAtTime(f * mult, t, 0.06);
    this.trem.frequency.setTargetAtTime(20 + rev * 60, t, 0.1);
    this.engFilter.frequency.setTargetAtTime(500 + rev * 1700 + (throttle ? 300 : 0), t, 0.08);
    const vol = (throttle || Math.abs(speed) > 0.5 ? 0.022 : 0.012) + s * 0.03;
    this.engGain.gain.setTargetAtTime(vol, t, 0.1);
  }

  engineOff() {
    if (this.ctx) this.engGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  // ── crowd: a constant murmur; level 0..~1.5 (swells near the goals) ──
  crowdSetup() {
    const ctx = this.ctx;
    this.crowdGain = ctx.createGain(); this.crowdGain.gain.value = 0;
    this.crowdGain.connect(this.master);
    for (const [freq, q, lvl, rate] of [[420, 0.7, 1, 0.31], [900, 0.9, 0.7, 0.53], [1900, 1.2, 0.25, 0.83]]) {
      const n = this.noiseSource();
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = lvl;
      const l = ctx.createOscillator(), lg = ctx.createGain(); // slow waves of chatter
      l.frequency.value = rate; lg.gain.value = lvl * 0.35;
      l.connect(lg).connect(g.gain); l.start();
      n.connect(f).connect(g).connect(this.crowdGain); n.start();
    }
  }

  crowd(level) {
    if (!this.ctx) return;
    this.crowdGain.gain.setTargetAtTime(0.03 * level, this.ctx.currentTime, 0.6);
  }

  // ── one-shots ──
  // ball hit by a car: a punchy "thwack"; hard hits also ring
  hit(strength, vol = 1) {
    const v = Math.min(1, strength / 35) * vol;
    this.tone({ type: 'triangle', from: 230, to: 70, peak: 0.55 * v + 0.05, decay: 0.16 });
    this.burst({ type: 'bandpass', freq: 1800, q: 0.8, peak: 0.35 * v + 0.03, decay: 0.07 });
    if (strength > 18) this.tone({ type: 'sine', from: 880, to: 760, peak: 0.08 * v, attack: 0.002, decay: 0.45 });
  }
  wallHit(strength, vol = 1) {
    const v = Math.min(1, strength / 30) * vol;
    this.tone({ type: 'sine', from: 140, to: 55, peak: 0.35 * v + 0.02, decay: 0.2 });
    this.burst({ type: 'lowpass', freq: 900, q: 0.7, peak: 0.18 * v, decay: 0.12 });
  }
  bump(strength) {
    const v = Math.min(1, strength / 30);
    this.tone({ type: 'sawtooth', from: 120, to: 45, peak: 0.25 * v + 0.05, decay: 0.22 });
    this.burst({ type: 'bandpass', freq: 2500, q: 1.5, peak: 0.2 * v, decay: 0.1 });
  }
  jump(vol = 1, second = false) {
    this.burst({ type: 'bandpass', freq: second ? 900 : 600, q: 1.2, peak: 0.22 * vol, decay: 0.16, sweepTo: second ? 2600 : 1800 });
    this.tone({ type: 'sine', from: second ? 260 : 180, to: second ? 520 : 360, peak: 0.08 * vol, decay: 0.12 });
  }
  flip(vol = 1) {
    this.burst({ type: 'bandpass', freq: 500, q: 0.8, peak: 0.3 * vol, attack: 0.04, decay: 0.38, sweepTo: 2200 });
  }
  land(vol = 1, speed = 8) {
    const v = Math.min(1, speed / 25) * vol;
    this.tone({ type: 'sine', from: 95, to: 45, peak: 0.3 * v + 0.03, decay: 0.15 });
    this.burst({ type: 'lowpass', freq: 600, peak: 0.12 * v, decay: 0.08 });
  }
  supersonic() {
    this.burst({ type: 'highpass', freq: 1800, q: 0.5, peak: 0.12, attack: 0.08, decay: 0.6, sweepTo: 5000 });
  }
  demo() {
    this.tone({ type: 'sawtooth', from: 110, to: 30, peak: 0.5, decay: 0.7 });
    this.burst({ type: 'lowpass', freq: 1400, q: 0.6, peak: 0.6, attack: 0.005, decay: 0.9, sweepTo: 200 });
    this.burst({ type: 'bandpass', freq: 3000, q: 1, peak: 0.25, decay: 0.25 });
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
