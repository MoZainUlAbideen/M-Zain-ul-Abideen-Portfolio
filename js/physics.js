// ─────────────────────────────────────────────────────────────
//  Arcade physics, Rocket League style. Fixed 120 Hz steps.
//
//  The arena is a "rounded box": flat floor, curved ramps up to the
//  walls, walls up to a curved edge and a closed ceiling. Everything
//  touches it through arenaContact() (arena.js), so the ball bounces
//  off curves and cars can drive up the walls and onto the ceiling.
//
//  A car keeps a full 3D frame (fwd, up). On a surface it drives in
//  the surface's plane and sticks to it; on the ceiling it only stays
//  put while you hold throttle. In the air: W/S pitch, A/D yaw, boost
//  pushes along the nose, a second jump is a double jump or, with a
//  direction held, a flip. Hit someone at supersonic speed: demolition.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { FIELD, arenaContact, goalChannel } from './arena.js';
import { CAR_DIMS } from './car.js';
import { PODIUM_R, PODIUM_H } from './podiums.js';

// Numbers follow Rocket League's own (scaled to this arena): throttle fades out near top speed,
// gravity pulls fully along walls, the "sticky" force is only half of gravity, so the ceiling
// can't hold you unless your speed through the curve keeps you pressed on.
export const CFG = {
  // accel = pull from a standstill; it fades to 10% at top speed
  accel: 77, maxSpeed: 23, reverseAccel: 20, reverseMax: 11, brake: 55, coast: 7,
  boostAccel: 40, boostMax: 40, boostDrain: 33, boostRegen: 9,
  turn: 2.5, grip: 9,
  gravity: 32,
  jump: 10, jumpHold: 46, jumpHoldTime: 0.2, // tap = small hop, hold = full jump
  doubleJump: 10.5, flipSpeed: 11, flipTime: 0.55, jumpWindow: 1.25,
  // air control: torque, damping when you let go, top spin rate (rad/s)
  pitchTorque: 11, yawTorque: 8, airDamp: 4, airMaxRate: 4.2,
  wallGravity: 1,      // full gravity along walls: climbing costs speed
  stick: 0.5,          // sticky force while driving (x gravity), like RL's
  stickIdle: 0.3,      // ... coasting
  supersonic: 36,
  ballGravity: 22, ballBounce: 0.62, ballWallBounce: 0.7, ballRoll: 0.35, ballAirDrag: 0.04, ballMax: 60,
  hitRestitution: 0.55, hitKick: 0.4,
  demoTime: 3,
};

export const SPAWN = {
  car: new THREE.Vector3(-30, 0, 0), yaw: Math.PI / 2, ball: new THREE.Vector3(0, FIELD.ballR, 0), // resting on the centre spot
  // the red bot kicks off from the other half, facing the player (and parks there outside a match)
  bot: new THREE.Vector3(30, 0, 0), botYaw: -Math.PI / 2,
};

const H = 1 / 120;
const CORE = 1.0; // the car's centre sits this far above its wheels; it is what touches the arena
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), n = new THREE.Vector3(), core = new THREE.Vector3();
const left = new THREE.Vector3(), q = new THREE.Quaternion(), m4 = new THREE.Matrix4();

const IDLE = { throttle: 0, steer: 0, boost: false, jump: false };
const curveInfo = { curved: false, axis: null };

function carQuat(c, out) {
  left.crossVectors(c.up, c.fwd).normalize();
  m4.makeBasis(left, c.up, c.fwd);
  return out.setFromRotationMatrix(m4);
}

export class Physics {
  constructor(pods, { onGoal, onHit, onEvent } = {}) {
    this.pods = pods.map((p) => ({ x: p.x, z: p.z }));
    this.onGoal = onGoal || (() => {});
    this.onHit = onHit || (() => {});
    this.onEvent = onEvent || (() => {}); // ('jump'|'flip'|'land'|'demo'|'supersonic', car, extra)
    const newCar = (pos, yaw, team) => ({
      team, spawn: pos.clone(), spawnYaw: yaw,
      pos: pos.clone(), vel: new THREE.Vector3(), fwd: new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), up: WORLD_UP.clone(),
      quat: new THREE.Quaternion(), yaw,
      steer: 0, onGround: true, boost: 100, boosting: false, jumpHeld: false, roll: 0, speed: 0,
      airTime: 0, jumped: false, jumpTimer: 0, canDouble: false, flip: null,
      supersonic: false, demoT: 0, hitCooldown: 0, surface: 'floor',
      spinP: 0, spinY: 0, pitchArmed: true, jumpHoldT: 0, jumpDir: WORLD_UP.clone(), curved: false, curveAxis: null,
    });
    this.car = newCar(SPAWN.car, SPAWN.yaw, 'blue');
    this.bot = newCar(SPAWN.bot, SPAWN.botYaw, 'orange');
    this.cars = [this.car, this.bot];
    this.botOn = true;     // the bot is always on the pitch: parked until a match starts
    this.autoReset = true; // free play: the ball respawns 3 s after a goal (a match handles its own kickoffs)
    this.regen = CFG.boostRegen; // boost recharges by itself over time
    this.kickoffBoost = 100;
    this.ball = { pos: SPAWN.ball.clone(), vel: new THREE.Vector3(), quat: new THREE.Quaternion() };
    this.acc = 0;
    const pose = () => ({ carPos: new THREE.Vector3(), carQuat: new THREE.Quaternion(), carYaw: 0, botPos: new THREE.Vector3(), botQuat: new THREE.Quaternion(), botYaw: 0, ballPos: new THREE.Vector3(), ballQuat: new THREE.Quaternion() });
    this.prev = pose();
    this.render = pose();
    for (const c of this.cars) carQuat(c, c.quat);
    this.snapshot(); this.interpolate();
    this.goalLock = false;
    this.resetTimer = 0;
  }

  resetBall() {
    this.ball.pos.copy(SPAWN.ball);
    this.ball.vel.set(0, 0, 0);
    this.goalLock = false;
    this.prev.ballPos.copy(this.ball.pos);
  }

  placeCar(c) {
    c.pos.copy(c.spawn); c.vel.set(0, 0, 0);
    c.fwd.set(Math.sin(c.spawnYaw), 0, Math.cos(c.spawnYaw)); c.up.copy(WORLD_UP); c.yaw = c.spawnYaw;
    c.onGround = true; c.flip = null; c.jumped = false; c.canDouble = false; c.airTime = 0; c.demoT = 0;
    c.boost = this.kickoffBoost; c.surface = 'floor';
    carQuat(c, c.quat);
    const key = c === this.car ? 'car' : 'bot';
    this.prev[`${key}Pos`].copy(c.pos); this.prev[`${key}Quat`].copy(c.quat); this.prev[`${key}Yaw`] = c.yaw;
  }
  resetCar() { this.placeCar(this.car); }
  resetBot() { this.placeCar(this.bot); }

  // kickoff: everything back to its spot
  resetAll() { this.resetCar(); this.resetBot(); this.resetBall(); this.resetTimer = 0; }

  // Positions to DRAW this frame: blended between the last two physics steps.
  snapshot() {
    const p = this.prev;
    p.carPos.copy(this.car.pos); p.carQuat.copy(this.car.quat); p.carYaw = this.car.yaw;
    p.botPos.copy(this.bot.pos); p.botQuat.copy(this.bot.quat); p.botYaw = this.bot.yaw;
    p.ballPos.copy(this.ball.pos); p.ballQuat.copy(this.ball.quat);
  }

  interpolate() {
    const a = this.acc / H, p = this.prev, r = this.render;
    const yaw = (from, to) => { const d = to - from; return from + Math.atan2(Math.sin(d), Math.cos(d)) * a; };
    r.carPos.lerpVectors(p.carPos, this.car.pos, a);
    r.carQuat.slerpQuaternions(p.carQuat, this.car.quat, a);
    r.carYaw = yaw(p.carYaw, this.car.yaw);
    r.botPos.lerpVectors(p.botPos, this.bot.pos, a);
    r.botQuat.slerpQuaternions(p.botQuat, this.bot.quat, a);
    r.botYaw = yaw(p.botYaw, this.bot.yaw);
    r.ballPos.lerpVectors(p.ballPos, this.ball.pos, a);
    r.ballQuat.slerpQuaternions(p.ballQuat, this.ball.quat, a);
  }

  // botInput: a function called every physics step (so the bot reacts at 120 Hz), or null when parked
  step(dt, input, botInput = null) {
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= H) {
      this.snapshot();
      this.stepCar(this.car, input);
      if (this.botOn) this.stepCar(this.bot, botInput ? botInput(this) : IDLE);
      this.stepBall();
      this.collideCarBall(this.car);
      if (this.botOn) { this.collideCarBall(this.bot); this.collideCars(); }
      this.acc -= H;
    }
    this.interpolate();
    if (this.autoReset && this.resetTimer > 0) {
      this.resetTimer -= dt;
      if (this.resetTimer <= 0) this.resetBall();
    }
  }

  // ── cars ──
  stepCar(c, inp) {
    if (c.demoT > 0) { // blown up: wait, then respawn at the kickoff spot
      c.demoT -= H;
      if (c.demoT <= 0) { const b = c.boost; this.placeCar(c); c.boost = Math.max(b, 33); }
      return;
    }
    c.steer += (inp.steer - c.steer) * Math.min(1, H * 10);
    const pressJump = inp.jump && !c.jumpHeld;
    c.jumpHeld = inp.jump;

    c.boosting = inp.boost && c.boost > 0;
    if (c.boosting) c.boost = Math.max(0, c.boost - CFG.boostDrain * H);
    else c.boost = Math.min(100, c.boost + this.regen * H);

    if (c.onGround) this.groundStep(c, inp, pressJump);
    else this.airStep(c, inp, pressJump);

    c.pos.addScaledVector(c.vel, H);
    this.carSurface(c);
    this.carPodiums(c);

    c.fwd.sub(tmp.copy(c.up).multiplyScalar(c.fwd.dot(c.up))).normalize();
    carQuat(c, c.quat);
    c.yaw = Math.atan2(c.fwd.x, c.fwd.z);
    c.speed = c.vel.dot(c.fwd);
    c.roll += (c.speed * H) / CAR_DIMS.wheelR;
    const sonic = c.vel.length() > CFG.supersonic;
    if (sonic && !c.supersonic) this.onEvent('supersonic', c);
    c.supersonic = sonic;
  }

  groundStep(c, inp, pressJump) {
    const up = c.up;
    // split velocity: along the surface normal / forward / sideways
    const vN = c.vel.dot(up);
    let vF = c.vel.dot(c.fwd);
    tmp.copy(c.vel).addScaledVector(up, -vN).addScaledVector(c.fwd, -vF); // lateral

    // steering: needs a bit of speed, a little lazier when very fast
    const sf = Math.min(1, Math.abs(vF) / 7) * (1 - 0.3 * Math.min(1, Math.max(0, (Math.abs(vF) - 22) / 18)));
    const turn = c.steer * CFG.turn * sf * (vF >= 0 ? 1 : -1) * H;
    if (turn) c.fwd.applyQuaternion(q.setFromAxisAngle(up, turn));

    if (c.boosting) vF += CFG.boostAccel * H;
    else if (inp.throttle > 0) {
      // throttle pulls hard from a standstill and fades to almost nothing at top speed (RL's curve)
      if (vF < -0.5) vF += CFG.brake * inp.throttle * H;
      else if (vF < CFG.maxSpeed) vF += CFG.accel * (1 - 0.9 * Math.max(0, vF) / CFG.maxSpeed) * inp.throttle * H;
    }
    else if (inp.throttle < 0) vF -= (vF > 0.5 ? CFG.brake : CFG.reverseAccel) * -inp.throttle * H;
    else vF -= Math.sign(vF) * Math.min(Math.abs(vF), CFG.coast * H);
    if (!c.boosting && vF > CFG.maxSpeed) vF = Math.max(CFG.maxSpeed, vF - 14 * H);
    vF = Math.min(vF, CFG.boostMax);
    vF = Math.max(vF, -CFG.reverseMax);

    const k = Math.exp(-CFG.grip * H);
    c.vel.copy(c.fwd).multiplyScalar(vF).addScaledVector(tmp, k);

    // gravity along the surface (slows you going up a wall, rolls you down it)
    const gN = -CFG.gravity * up.y; // gravity component along the normal (negative = into the surface)
    tmp2.set(0, -CFG.gravity, 0).addScaledVector(up, -gN);
    c.vel.addScaledVector(tmp2, (c.surface === 'floor' ? 1 : CFG.wallGravity) * H);

    // still stuck to it? What holds you on: the sticky force, plus (on a curve) your speed pressing
    // you into it. What pulls you off: gravity. So you can carry speed through the top curve, but
    // the flat ceiling can't hold you and you drop, just like in Rocket League.
    if (c.surface !== 'floor') {
      const stick = CFG.gravity * (inp.throttle || c.boosting ? CFG.stick : CFG.stickIdle);
      let press = 0;
      if (c.curved) {
        tmp2.copy(c.vel).addScaledVector(up, -c.vel.dot(up));
        if (c.curveAxis) tmp2.setComponent('xyz'.indexOf(c.curveAxis), 0); // only speed across the curve counts
        press = tmp2.lengthSq() / FIELD.R;
      }
      if (gN > stick + press) { this.leaveGround(c); c.vel.addScaledVector(up, 1.5); return; } // drop off (along up = away from the surface)
    }
    // too slow on a wall with nothing pressing you into it: you peel off (RL: stop on a wall and you fall)
    if (c.surface === 'wall' && !inp.throttle && !c.boosting && c.vel.length() < 6 && up.y < 0.7) { this.leaveGround(c); c.vel.addScaledVector(up, 1.5); return; }

    if (pressJump) {
      c.vel.addScaledVector(up, CFG.jump);
      this.leaveGround(c);
      c.jumped = true; c.canDouble = true; c.jumpTimer = 0;
      c.jumpDir = up.clone(); c.jumpHoldT = CFG.jumpHoldTime;
      this.onEvent('jump', c);
    }
  }

  leaveGround(c) {
    c.onGround = false; c.airTime = 0; c.surface = 'air'; c.jumpHoldT = 0;
    c.spinP = 0; c.spinY = 0;
    // W/S held while driving keeps meaning "throttle": it only starts pitching the car once
    // you let go of it in the air and press again (stops the nose-dive on every jump)
    c.pitchArmed = false;
  }

  airStep(c, inp, pressJump) {
    c.airTime += H;
    c.jumpTimer += H;
    left.crossVectors(c.up, c.fwd).normalize();
    if (c.flip) {
      // flipping: spin about the flip axis, damp vertical speed a touch (RL flip cancel feel)
      c.flip.t += H;
      const w = (Math.PI * 2) / CFG.flipTime;
      q.setFromAxisAngle(c.flip.axis, w * H);
      c.fwd.applyQuaternion(q); c.up.applyQuaternion(q);
      if (c.flip.t >= CFG.flipTime) c.flip = null;
    } else {
      // air control: W/S pitch (nose down / up), A/D yaw. Spin builds up and dies down smoothly.
      if (!inp.throttle) c.pitchArmed = true;
      const pIn = c.pitchArmed ? inp.throttle : 0, yIn = inp.steer;
      c.spinP += (CFG.pitchTorque * pIn - CFG.airDamp * c.spinP * (1 - Math.abs(pIn))) * H;
      c.spinY += (CFG.yawTorque * yIn - CFG.airDamp * c.spinY * (1 - Math.abs(yIn))) * H;
      c.spinP = Math.max(-CFG.airMaxRate, Math.min(CFG.airMaxRate, c.spinP));
      c.spinY = Math.max(-CFG.airMaxRate, Math.min(CFG.airMaxRate, c.spinY));
      if (c.spinP) { q.setFromAxisAngle(left, c.spinP * H); c.fwd.applyQuaternion(q); c.up.applyQuaternion(q); }
      if (c.spinY) c.fwd.applyQuaternion(q.setFromAxisAngle(c.up, c.spinY * H));
      c.up.sub(tmp.copy(c.fwd).multiplyScalar(c.up.dot(c.fwd))).normalize();
    }
    // holding jump just after take-off pushes you higher (a full jump vs a tap)
    if (c.jumpHoldT > 0) {
      if (inp.jump) c.vel.addScaledVector(c.jumpDir, CFG.jumpHold * H);
      c.jumpHoldT = inp.jump ? c.jumpHoldT - H : 0;
    }
    // second jump: double jump, or a flip if a direction is held
    if (pressJump && c.canDouble && c.jumpTimer < CFG.jumpWindow) {
      c.canDouble = false; c.jumpHoldT = 0;
      const fx = inp.throttle, sx = inp.steer;
      if (Math.abs(fx) > 0.3 || Math.abs(sx) > 0.3) {
        // flip: a burst of speed that way (flat), and a spin
        tmp.set(c.fwd.x, 0, c.fwd.z).normalize();
        tmp2.set(left.x, 0, left.z).normalize();
        const dir = tmp.multiplyScalar(fx).addScaledVector(tmp2, sx).normalize();
        c.vel.addScaledVector(dir, CFG.flipSpeed);
        c.vel.y *= 0.35;
        // spin axis: forward flip = nose over (around left), side flip = roll (around -fwd)
        const axis = new THREE.Vector3().addScaledVector(left, fx).addScaledVector(c.fwd, -sx).normalize();
        c.flip = { t: 0, axis, fwd0: c.fwd.clone() };
        this.onEvent('flip', c);
      } else {
        c.vel.addScaledVector(c.up, CFG.doubleJump);
        this.onEvent('jump', c, true);
      }
    }
    if (c.boosting) c.vel.addScaledVector(c.fwd, CFG.boostAccel * H);
    c.vel.y -= CFG.gravity * H;
    if (c.vel.length() > CFG.boostMax) c.vel.setLength(CFG.boostMax);
  }

  // keep the car inside the arena; land on (or stay on) whatever it touches
  carSurface(c) {
    core.copy(c.pos).addScaledVector(c.up, CORE);
    const pen = arenaContact(core, CORE, n, curveInfo);
    if (pen > 0) {
      c.curved = curveInfo.curved; c.curveAxis = curveInfo.axis;
      core.addScaledVector(n, pen);
      const intoSurface = c.vel.dot(n);
      if (!c.onGround) {
        // landing (any surface, any angle): the car is turned to sit on it, like RL's forgiving landings
        if (intoSurface < 0 || pen > 0.02) {
          if (intoSurface < -6) this.onEvent('land', c, -intoSurface);
          c.vel.addScaledVector(n, -intoSurface);
          c.up.copy(n);
          if (c.flip) c.fwd.copy(c.flip.fwd0); // landed mid-flip: finish it facing the way you flipped
          if (Math.abs(c.fwd.dot(n)) > 0.95) c.fwd.copy(c.vel).addScaledVector(n, -c.vel.dot(n)); // nose straight into it: use the slide direction
          if (c.fwd.lengthSq() < 1e-6) c.fwd.set(1, 0, 0).addScaledVector(n, -n.x);
          c.fwd.addScaledVector(n, -c.fwd.dot(n)).normalize();
          c.onGround = true; c.flip = null; c.jumped = false; c.canDouble = false; c.spinP = c.spinY = 0;
        }
      } else {
        // already driving: follow the surface as it curves
        c.up.lerp(n, 0.5).normalize();
        if (intoSurface < 0) c.vel.addScaledVector(n, -intoSurface);
      }
      c.surface = n.y > 0.9 ? 'floor' : n.y < -0.7 ? 'ceiling' : 'wall';
    } else if (c.onGround) {
      // nothing under the wheels any more (drove off a podium edge, or the surface dropped away)
      const probe = arenaContact(tmp.copy(c.pos).addScaledVector(c.up, CORE - 0.35), CORE, n);
      if (probe <= 0) this.leaveGround(c);
    }
    c.pos.copy(core).addScaledVector(c.up, -CORE);
    // through the goal mouth and inside the net
    goalChannel(c.pos, 1.9, c.vel, 0.2, true);
  }

  carPodiums(c) {
    const p = c.pos, v = c.vel;
    const R = PODIUM_R + 1.5;
    for (const pod of this.pods) {
      const dx = p.x - pod.x, dz = p.z - pod.z;
      const d = Math.hypot(dx, dz);
      if (d < R && p.y < PODIUM_H) {
        const nx = dx / (d || 1), nz = dz / (d || 1);
        p.x = pod.x + nx * R; p.z = pod.z + nz * R;
        const vn = v.x * nx + v.z * nz;
        if (vn < 0) { v.x -= nx * vn * 1.2; v.z -= nz * vn * 1.2; }
      }
    }
  }

  // ── ball ──
  stepBall() {
    const b = this.ball, p = b.pos, v = b.vel;
    const r = FIELD.ballR;
    v.y -= CFG.ballGravity * H;
    v.multiplyScalar(1 - CFG.ballAirDrag * H);
    if (v.length() > CFG.ballMax) v.setLength(CFG.ballMax);
    p.addScaledVector(v, H);

    // floor, ramps, walls and ceiling in one go
    const pen = arenaContact(p, r, n);
    if (pen > 0) {
      p.addScaledVector(n, pen);
      const vn = v.dot(n);
      if (vn < 0) {
        const e = n.y > 0.9 ? CFG.ballBounce : CFG.ballWallBounce;
        // tiny bounces on the floor die out so the ball can roll
        v.addScaledVector(n, -(vn < -3 ? 1 + e : 1) * vn);
        if (-vn > 3) this.onHit('wall', -vn);
      }
      if (n.y > 0.9) { const k = Math.exp(-CFG.ballRoll * H); v.x *= k; v.z *= k; }
    }
    goalChannel(p, r, v, 0.3, false, () => this.onHit('wall', 4));
    this.ballPosts();
    this.ballPodiums();

    // rolling spin
    tmp.set(v.z, 0, -v.x);
    const w = tmp.length() / r;
    if (w > 1e-4) {
      tmp.normalize();
      b.quat.premultiply(q.setFromAxisAngle(tmp, w * H));
    }

    // goal?
    if (!this.goalLock && Math.abs(p.x) > FIELD.halfX + r) {
      this.goalLock = true;
      this.resetTimer = 3;
      this.onGoal(p.x > 0 ? 'orange' : 'blue', p.clone());
    }
  }

  ballPosts() {
    const { halfX, goalHalfW, goalH, postR, ballR: r } = FIELD;
    const p = this.ball.pos, v = this.ball.vel;
    for (const s of [-1, 1]) {
      if (Math.abs(p.x - s * halfX) > r + postR + 0.5) continue;
      const segs = [
        [s * halfX, 0, -goalHalfW, s * halfX, goalH, -goalHalfW],
        [s * halfX, 0, goalHalfW, s * halfX, goalH, goalHalfW],
        [s * halfX, goalH, -goalHalfW, s * halfX, goalH, goalHalfW],
      ];
      for (const [ax, ay, az, bx, by, bz] of segs) {
        tmp.set(bx - ax, by - ay, bz - az);
        tmp2.set(p.x - ax, p.y - ay, p.z - az);
        const t = Math.max(0, Math.min(1, tmp2.dot(tmp) / tmp.lengthSq()));
        n.set(p.x - (ax + tmp.x * t), p.y - (ay + tmp.y * t), p.z - (az + tmp.z * t));
        const d = n.length();
        if (d < r + postR && d > 1e-5) {
          n.divideScalar(d);
          p.addScaledVector(n, r + postR - d);
          const vn = v.dot(n);
          if (vn < 0) { v.addScaledVector(n, -(1 + 0.75) * vn); this.onHit('post', -vn); }
        }
      }
    }
  }

  ballPodiums() {
    const p = this.ball.pos, v = this.ball.vel, r = FIELD.ballR;
    for (const pod of this.pods) {
      const dx = p.x - pod.x, dz = p.z - pod.z;
      const d = Math.hypot(dx, dz);
      const R = PODIUM_R + r;
      if (d < R && p.y < PODIUM_H + r * 0.6) {
        if (p.y - r > PODIUM_H - 0.4 && d < PODIUM_R) {
          p.y = PODIUM_H + r; if (v.y < 0) v.y *= -CFG.ballBounce;
        } else {
          const nx = dx / (d || 1), nz = dz / (d || 1);
          p.x = pod.x + nx * R; p.z = pod.z + nz * R;
          const vn = v.x * nx + v.z * nz;
          if (vn < 0) { v.x -= nx * vn * 1.7; v.z -= nz * vn * 1.7; }
        }
      }
    }
  }

  // ball against a car's box (in the car's own frame, so it works on walls too)
  collideCarBall(c) {
    c.hitCooldown -= H;
    if (c.demoT > 0) return;
    const b = this.ball, r = FIELD.ballR;
    const { half, centerY } = CAR_DIMS;
    left.crossVectors(c.up, c.fwd).normalize();
    tmp.copy(b.pos).sub(c.pos).addScaledVector(c.up, -centerY);
    const lx = tmp.dot(left), ly = tmp.dot(c.up), lz = tmp.dot(c.fwd);
    const qx = Math.max(-half.x, Math.min(half.x, lx));
    const qy = Math.max(-half.y, Math.min(half.y, ly));
    const qz = Math.max(-half.z, Math.min(half.z, lz));
    let dx = lx - qx, dy = ly - qy, dz = lz - qz;
    let d = Math.hypot(dx, dy, dz);
    if (d >= r) return;
    if (d < 1e-5) { dx = 0; dy = 1; dz = 0; d = 0; } else { dx /= d; dy /= d; dz /= d; }
    n.set(0, 0, 0).addScaledVector(left, dx).addScaledVector(c.up, dy).addScaledVector(c.fwd, dz).normalize();
    b.pos.addScaledVector(n, r - d);
    tmp.copy(b.vel).sub(c.vel);
    const vn = tmp.dot(n);
    if (vn < 0) {
      b.vel.addScaledVector(n, -(1 + CFG.hitRestitution) * vn);
      const push = Math.max(0, c.vel.dot(n));
      b.vel.addScaledVector(n, push * CFG.hitKick);
      b.vel.y += push * 0.18;
      c.vel.addScaledVector(n, vn * 0.06);
      if (c.hitCooldown <= 0) { this.onHit(c === this.car ? 'car' : 'bot', -vn); c.hitCooldown = 0.15; }
      c.lastTouch = performance.now();
    }
  }

  // the two cars bump (two spheres around their centres); supersonic into someone = demolition
  collideCars() {
    const a = this.car, b = this.bot;
    if (a.demoT > 0 || b.demoT > 0) return;
    tmp.copy(b.pos).addScaledVector(b.up, CORE).sub(tmp2.copy(a.pos).addScaledVector(a.up, CORE));
    const d = tmp.length(), R = 3.4;
    if (d >= R) return;
    n.copy(tmp).divideScalar(d || 1);
    // who is driving into whom, fast enough to demo?
    const aIn = a.vel.dot(n), bIn = -b.vel.dot(n);
    if (a.supersonic && aIn > 18 && aIn > bIn) return this.demo(b, a);
    if (b.supersonic && bIn > 18 && bIn > aIn) return this.demo(a, b);
    const push = (R - d) / 2;
    a.pos.addScaledVector(n, -push);
    b.pos.addScaledVector(n, push);
    const vn = (b.vel.dot(n) - a.vel.dot(n));
    if (vn < 0) {
      const j = -(1 + 0.4) * vn / 2;
      a.vel.addScaledVector(n, -j);
      b.vel.addScaledVector(n, j);
      if (j > 3) this.onHit('bump', j * 2);
    }
  }

  demo(victim, by) {
    victim.demoT = CFG.demoTime;
    victim.vel.set(0, 0, 0);
    this.onEvent('demo', victim, by);
  }
}
