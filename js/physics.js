// ─────────────────────────────────────────────────────────────
//  Arcade physics: Rocket League-lite car + bouncy ball.
//  Fixed 120 Hz steps so it behaves the same on every screen.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { FIELD } from './arena.js';
import { CAR_DIMS } from './car.js';
import { PODIUM_R, PODIUM_H } from './podiums.js';

export const CFG = {
  accel: 26, maxSpeed: 23, reverseAccel: 20, reverseMax: 11, brake: 55, coast: 7,
  boostAccel: 40, boostMax: 40, boostDrain: 33, boostRegen: 9,
  turn: 2.5, airTurn: 2.2, grip: 9,
  gravity: 32, jump: 13,
  ballGravity: 22, ballBounce: 0.66, ballWallBounce: 0.72, ballRoll: 0.35, ballAirDrag: 0.04, ballMax: 60,
  hitRestitution: 0.55, hitKick: 0.4,
};

export const SPAWN = {
  car: new THREE.Vector3(-24, 0, 0), yaw: Math.PI / 2, ball: new THREE.Vector3(0, 6, 0),
  // the red bot kicks off from the other half, facing the player
  bot: new THREE.Vector3(24, 0, 0), botYaw: -Math.PI / 2,
};

const H = 1 / 120;
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), n = new THREE.Vector3();

export class Physics {
  constructor(pods, { onGoal, onHit } = {}) {
    this.pods = pods.map((p) => ({ x: p.x, z: p.z }));
    this.onGoal = onGoal || (() => {});
    this.onHit = onHit || (() => {});
    const newCar = (pos, yaw) => ({
      pos: pos.clone(), vel: new THREE.Vector3(), yaw,
      steer: 0, onGround: true, boost: 100, boosting: false, jumpHeld: false, roll: 0, speed: 0,
      hitCooldown: 0,
    });
    this.car = newCar(SPAWN.car, SPAWN.yaw);
    this.bot = newCar(SPAWN.bot, SPAWN.botYaw);
    this.cars = [this.car, this.bot];
    this.botOn = false;   // the bot only takes the pitch during a match
    this.autoReset = true; // free play: the ball respawns 3 s after a goal (a match handles its own kickoffs)
    this.ball = { pos: SPAWN.ball.clone(), vel: new THREE.Vector3(), quat: new THREE.Quaternion() };
    this.acc = 0;
    const pose = () => ({ carPos: new THREE.Vector3(), carYaw: 0, botPos: new THREE.Vector3(), botYaw: 0, ballPos: new THREE.Vector3(), ballQuat: new THREE.Quaternion() });
    this.prev = pose();
    this.render = pose();
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

  resetCar() {
    const c = this.car;
    c.pos.copy(SPAWN.car); c.vel.set(0, 0, 0); c.yaw = SPAWN.yaw; c.boost = 100;
    this.prev.carPos.copy(c.pos); this.prev.carYaw = c.yaw;
  }

  resetBot() {
    const c = this.bot;
    c.pos.copy(SPAWN.bot); c.vel.set(0, 0, 0); c.yaw = SPAWN.botYaw; c.boost = 100;
    this.prev.botPos.copy(c.pos); this.prev.botYaw = c.yaw;
  }

  // kickoff: everything back to its spot
  resetAll() { this.resetCar(); this.resetBot(); this.resetBall(); this.resetTimer = 0; }

  // Positions to DRAW this frame: blended between the last two physics steps.
  // Without this, a 60/144 Hz screen sees 0, 1 or 2+ steps per frame and the
  // car jitters slightly even when the frame rate is fine.
  snapshot() {
    this.prev.carPos.copy(this.car.pos); this.prev.carYaw = this.car.yaw;
    this.prev.botPos.copy(this.bot.pos); this.prev.botYaw = this.bot.yaw;
    this.prev.ballPos.copy(this.ball.pos); this.prev.ballQuat.copy(this.ball.quat);
  }

  interpolate() {
    const a = this.acc / H, p = this.prev, r = this.render;
    const yaw = (from, to) => { const d = to - from; return from + Math.atan2(Math.sin(d), Math.cos(d)) * a; };
    r.carPos.lerpVectors(p.carPos, this.car.pos, a);
    r.carYaw = yaw(p.carYaw, this.car.yaw);
    r.botPos.lerpVectors(p.botPos, this.bot.pos, a);
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

  stepCar(c, inp) {
    c.steer += (inp.steer - c.steer) * Math.min(1, H * 10);
    let fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    let vF = c.vel.x * fx + c.vel.z * fz;
    const latX = c.vel.x - fx * vF, latZ = c.vel.z - fz * vF;

    c.boosting = inp.boost && c.boost > 0;
    if (c.boosting) c.boost = Math.max(0, c.boost - CFG.boostDrain * H);
    else c.boost = Math.min(100, c.boost + CFG.boostRegen * H);

    if (c.onGround) {
      // steering: needs a bit of speed, gets slightly lazier when very fast
      const sf = Math.min(1, Math.abs(vF) / 7) * (1 - 0.3 * Math.min(1, Math.max(0, (Math.abs(vF) - 22) / 18)));
      c.yaw += c.steer * CFG.turn * sf * (vF >= 0 ? 1 : -1) * H;

      if (c.boosting) vF += CFG.boostAccel * H;
      else if (inp.throttle > 0) vF += (vF < -0.5 ? CFG.brake : CFG.accel) * H;
      else if (inp.throttle < 0) vF -= (vF > 0.5 ? CFG.brake : CFG.reverseAccel) * H;
      else vF -= Math.sign(vF) * Math.min(Math.abs(vF), CFG.coast * H);

      if (!c.boosting && vF > CFG.maxSpeed) vF = Math.max(CFG.maxSpeed, vF - 14 * H);
      vF = Math.min(vF, CFG.boostMax);
      vF = Math.max(vF, -CFG.reverseMax);

      fx = Math.sin(c.yaw); fz = Math.cos(c.yaw);
      const k = Math.exp(-CFG.grip * H);
      c.vel.x = fx * vF + latX * k;
      c.vel.z = fz * vF + latZ * k;

      if (inp.jump && !c.jumpHeld) { c.vel.y = CFG.jump; c.onGround = false; }
    } else {
      c.yaw += inp.steer * CFG.airTurn * H;
      if (c.boosting) {
        fx = Math.sin(c.yaw); fz = Math.cos(c.yaw);
        c.vel.x += fx * CFG.boostAccel * 0.8 * H;
        c.vel.z += fz * CFG.boostAccel * 0.8 * H;
        c.vel.y += CFG.gravity * 0.25 * H; // a little lift, feels floaty like RL
      }
      const hs = Math.hypot(c.vel.x, c.vel.z);
      if (hs > CFG.boostMax) { c.vel.x *= CFG.boostMax / hs; c.vel.z *= CFG.boostMax / hs; }
      c.vel.y -= CFG.gravity * H;
    }
    c.jumpHeld = inp.jump;

    c.pos.addScaledVector(c.vel, H);
    if (c.pos.y <= 0) { c.pos.y = 0; if (c.vel.y < 0) c.vel.y = 0; c.onGround = true; }

    this.carWalls(c);
    this.carPodiums(c);

    c.speed = c.vel.x * Math.sin(c.yaw) + c.vel.z * Math.cos(c.yaw);
    c.roll += (c.speed * H) / CAR_DIMS.wheelR;
  }

  carWalls(c) {
    const p = c.pos, v = c.vel;
    const { halfX, halfZ, goalHalfW, goalH, goalDepth } = FIELD;
    const cr = 1.9;
    if (Math.abs(p.z) > halfZ - cr) {
      const s = Math.sign(p.z);
      p.z = s * (halfZ - cr);
      if (v.z * s > 0) v.z *= -0.2;
    }
    const ax = Math.abs(p.x), sx = Math.sign(p.x);
    if (ax > halfX - cr) {
      const inGoal = ax > halfX;
      const fitsMouth = Math.abs(p.z) < goalHalfW - cr && p.y < goalH - 2;
      if (inGoal) {
        const zl = goalHalfW - cr;
        if (Math.abs(p.z) > zl) { const s = Math.sign(p.z); p.z = s * zl; if (v.z * s > 0) v.z *= -0.2; }
        if (ax > halfX + goalDepth - cr) { p.x = sx * (halfX + goalDepth - cr); if (v.x * sx > 0) v.x *= -0.2; }
      } else if (!fitsMouth) {
        p.x = sx * (halfX - cr);
        if (v.x * sx > 0) v.x *= -0.2;
      }
    }
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

  stepBall() {
    const b = this.ball, p = b.pos, v = b.vel;
    const r = FIELD.ballR;
    v.y -= CFG.ballGravity * H;
    v.multiplyScalar(1 - CFG.ballAirDrag * H);
    if (v.length() > CFG.ballMax) v.setLength(CFG.ballMax);
    p.addScaledVector(v, H);

    // floor
    if (p.y < r) {
      p.y = r;
      if (v.y < 0) v.y = v.y < -3 ? -v.y * CFG.ballBounce : 0;
    }
    if (p.y <= r + 0.01) {
      const k = Math.exp(-CFG.ballRoll * H);
      v.x *= k; v.z *= k;
    }
    // ceiling
    if (p.y > 34 - r) { p.y = 34 - r; if (v.y > 0) v.y *= -CFG.ballWallBounce; }

    this.ballWalls();
    this.ballPosts();
    this.ballPodiums();

    // rolling spin
    tmp.set(v.z, 0, -v.x);
    const w = tmp.length() / r;
    if (w > 1e-4) {
      tmp.normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(tmp, w * H);
      b.quat.premultiply(q);
    }

    // goal?
    if (!this.goalLock && Math.abs(p.x) > FIELD.halfX + r) {
      this.goalLock = true;
      this.resetTimer = 3;
      this.onGoal(p.x > 0 ? 'orange' : 'blue', p.clone());
    }
  }

  ballWalls() {
    const b = this.ball, p = b.pos, v = b.vel;
    const { halfX, halfZ, goalHalfW, goalH, goalDepth, ballR: r } = FIELD;
    const e = CFG.ballWallBounce;
    if (Math.abs(p.z) > halfZ - r) {
      const s = Math.sign(p.z);
      p.z = s * (halfZ - r);
      if (v.z * s > 0) { v.z *= -e; this.onHit('wall', Math.abs(v.z)); }
    }
    const ax = Math.abs(p.x), sx = Math.sign(p.x);
    if (ax > halfX - r) {
      const inGoal = ax > halfX;
      const inMouth = Math.abs(p.z) < goalHalfW && p.y < goalH;
      if (inGoal) {
        const en = 0.3; // nets swallow energy
        if (Math.abs(p.z) > goalHalfW - r) { const s = Math.sign(p.z); p.z = s * (goalHalfW - r); if (v.z * s > 0) v.z *= -en; }
        if (p.y > goalH - r) { p.y = goalH - r; if (v.y > 0) v.y *= -en; }
        if (ax > halfX + goalDepth - r) { p.x = sx * (halfX + goalDepth - r); if (v.x * sx > 0) v.x *= -en; }
      } else if (!inMouth) {
        p.x = sx * (halfX - r);
        if (v.x * sx > 0) { v.x *= -e; this.onHit('wall', Math.abs(v.x)); }
      }
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
          // landed on top
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

  collideCarBall(c) {
    c.hitCooldown -= H;
    const b = this.ball, r = FIELD.ballR;
    const { half, centerY } = CAR_DIMS;
    const cos = Math.cos(c.yaw), sin = Math.sin(c.yaw);
    // ball centre in car-local space
    const wx = b.pos.x - c.pos.x, wy = b.pos.y - (c.pos.y + centerY), wz = b.pos.z - c.pos.z;
    const lx = wx * cos - wz * sin, lz = wx * sin + wz * cos, ly = wy;
    const qx = Math.max(-half.x, Math.min(half.x, lx));
    const qy = Math.max(-half.y, Math.min(half.y, ly));
    const qz = Math.max(-half.z, Math.min(half.z, lz));
    let dx = lx - qx, dy = ly - qy, dz = lz - qz;
    let d = Math.hypot(dx, dy, dz);
    if (d >= r) return;
    if (d < 1e-5) { dx = 0; dy = 1; dz = 0; d = 0; } else { dx /= d; dy /= d; dz /= d; }
    // back to world
    n.set(dx * cos + dz * sin, dy, -dx * sin + dz * cos).normalize();
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

  // the two cars bump off each other (treated as two upright cylinders)
  collideCars() {
    const a = this.car, b = this.bot;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
    const d = Math.hypot(dx, dz), R = 3.6;
    if (d >= R || Math.abs(a.pos.y - b.pos.y) > 1.6) return;
    const nx = d > 1e-5 ? dx / d : 1, nz = d > 1e-5 ? dz / d : 0;
    const push = (R - d) / 2;
    a.pos.x -= nx * push; a.pos.z -= nz * push;
    b.pos.x += nx * push; b.pos.z += nz * push;
    const vn = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
    if (vn < 0) {
      const j = -(1 + 0.4) * vn / 2;
      a.vel.x -= nx * j; a.vel.z -= nz * j;
      b.vel.x += nx * j; b.vel.z += nz * j;
      if (j > 3) this.onHit('bump', j * 2);
    }
  }
}

const IDLE = { throttle: 0, steer: 0, boost: false, jump: false };
