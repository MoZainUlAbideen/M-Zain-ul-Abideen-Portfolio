// ─────────────────────────────────────────────────────────────
//  The red bot: a simple Rocket League-style opponent.
//  It attacks the blue goal (x = -60) and defends the orange one (x = +60).
//  Idea: get on the far side of the ball from the goal it is attacking,
//  then drive through the ball towards that goal. If it ends up on the
//  wrong side, it swings round (never straight through the ball, which
//  would knock it into its own net). Returns the same input shape a
//  player sends, so it drives with exactly the same physics.
// ─────────────────────────────────────────────────────────────
import { FIELD } from './arena.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const IDLE = { throttle: 0, steer: 0, boost: false, jump: false };

export class Bot {
  // attack: -1 = scores in the blue goal (x = -60), +1 = the orange one. key: which car in Physics it drives
  constructor({ think = 0.14, boostChance = 0.65, attack = -1, key = 'bot', kickoffDelay = 0 } = {}) {
    this.think = think;             // seconds between decisions (reaction time)
    this.boostChance = boostChance; // how often it uses boost when it could
    this.attack = attack;
    this.key = key;
    this.kickoffDelay = kickoffDelay; // gives the player a head start at every kickoff
    this.reset();
  }

  reset() {
    this.t = 0;
    this.nextThink = 0;
    this.target = { x: 0, z: 0 };
    this.shooting = false;
    this.slow = 0;      // time since the last stuck check
    this.anchor = null; // where it was at that check
    this.unstick = 0;   // > 0 while backing out
    this.unstickSteer = 1;
    this.mayBoost = true;
    this.jumpHeld = false;
    // a little human-like variety at each kickoff, so the same opening never wins every time
    this.delay = this.kickoffDelay + Math.random() * 0.1;
  }

  // called every physics step (dt = 1/120)
  input(phys, dt = 1 / 120) {
    const c = phys[this.key], b = phys.ball;
    this.t += dt;
    if (this.t < this.delay) return IDLE;
    const { halfX, halfZ } = FIELD;
    // work in a mirrored frame where we always attack towards -x
    const m = -this.attack;
    const cx = c.pos.x * m, ballX = b.pos.x * m, ballVX = b.vel.x * m;
    const goalX = -halfX, ownX = halfX;

    // stuck against a wall or podium? back out for a moment
    if (this.unstick > 0) {
      this.unstick -= dt;
      return { throttle: -1, steer: this.unstickSteer, boost: false, jump: false };
    }
    // stuck = hardly moved in the last second while trying to drive (wedged on a net, wall or podium)
    this.slow += dt;
    if (!this.anchor) this.anchor = { x: c.pos.x, z: c.pos.z };
    if (this.slow > 0.9) {
      const moved = Math.hypot(c.pos.x - this.anchor.x, c.pos.z - this.anchor.z);
      this.anchor = { x: c.pos.x, z: c.pos.z };
      this.slow = 0;
      if (moved < 2.5 && c.onGround) { this.unstick = 0.8; this.unstickSteer = Math.random() < 0.5 ? -1 : 1; return { throttle: -1, steer: this.unstickSteer, boost: false, jump: false }; }
    }

    if (this.t >= this.nextThink) {
      this.nextThink = this.t + this.think;
      // where the ball will be by the time we get there (rough)
      const dist0 = Math.hypot(ballX - cx, b.pos.z - c.pos.z);
      const lead = clamp(dist0 / 28, 0, 0.9);
      const bx = clamp(ballX + ballVX * lead, -halfX + 2, halfX - 2);
      const bz = clamp(b.pos.z + b.vel.z * lead, -halfZ + 2, halfZ - 2);
      // direction from the ball to the middle of the goal we attack
      let gx = goalX - bx, gz = -bz * 0.8;
      const gl = Math.hypot(gx, gz) || 1; gx /= gl; gz /= gl;

      const behind = cx > bx + 1.5; // between the ball and our own goal: good side
      if (behind) {
        const d = Math.hypot(bx - cx, bz - c.pos.z);
        // far: line up a few metres behind the ball; close: drive straight through it
        const back = d > 12 ? 5 : d > 6 ? 2.5 : -2;
        this.target = { x: bx - gx * back, z: bz - gz * back };
        this.shooting = d < 12;
      } else {
        // wrong side: loop round the ball on the side we are already on, back towards our goal
        // (measured from the ball as it is now, so the car never clips it on the way past)
        const side = c.pos.z >= b.pos.z ? 1 : -1;
        const tz = b.pos.z + side * 11;
        // no room on that side (ball near a wall): go round the other way
        const z = Math.abs(tz) > halfZ - 4 ? b.pos.z - side * 11 : tz;
        this.target = { x: Math.min(Math.max(bx, ballX) + 11, ownX - 5), z: clamp(z, -halfZ + 4, halfZ - 4) };
        this.shooting = false;
      }
      this.mayBoost = Math.random() < this.boostChance;
    }

    const dx = this.target.x * m - c.pos.x, dz = this.target.z - c.pos.z;
    const dist = Math.hypot(dx, dz);
    const diff = wrap(Math.atan2(dx, dz) - c.yaw);
    const steer = clamp(diff * 2.6, -1, 1);
    // ease off for a very tight turn so it doesn't orbit the target forever
    const throttle = Math.abs(diff) > 1.9 && dist < 9 ? 0 : 1;
    const aligned = Math.abs(diff) < 0.28;
    // kickoff: always race for the ball at full boost, like a real player would
    const kickoff = this.t < this.delay + 1.6;
    const boost = (kickoff || this.mayBoost) && aligned && c.onGround && (dist > 16 || this.shooting || kickoff) && c.boost > 8;

    // jump at a ball that is bouncing at roof height, right in front
    const bd = Math.hypot(b.pos.x - c.pos.x, b.pos.z - c.pos.z);
    let jump = false;
    if (c.onGround && bd < 5.5 && b.pos.y > 3.6 && b.pos.y < 8 && aligned && !this.jumpHeld) jump = true;
    this.jumpHeld = jump;

    return { throttle, steer, boost, jump };
  }
}
