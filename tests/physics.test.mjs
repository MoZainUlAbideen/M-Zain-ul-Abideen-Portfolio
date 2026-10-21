// Physics tests for the arena: wall/ceiling driving, flips, the ball on the curved shell,
// goals, boost, demolitions and kickoffs.
// Run from the project folder (needs three.js locally once:  npm install):
//     npm test        or        node tests/physics.test.mjs
import assert from 'node:assert/strict';
const js = new URL('../js/', import.meta.url).href;
const { Physics, CFG } = await import(js + 'physics.js');
const { FIELD, arenaContact } = await import(js + 'arena.js');
const { Bot } = await import(js + 'bot.js');
const { PODIUMS } = await import(js + 'content.js');
const THREE = await import('three');

let n = 0; const t = (name, fn) => { fn(); n++; console.log('  ok -', name); };
const IDLE = { throttle: 0, steer: 0, boost: false, jump: false };
const run = (ph, secs, inp, bot = null) => { for (let s = 0; s < secs; s += 1 / 60) ph.step(1 / 60, typeof inp === 'function' ? inp(s) : inp, bot); };
const fresh = (pods = []) => { const ph = new Physics(pods); ph.botOn = false; return ph; };
// point inside the arena? (a little slack for the contact solver)
const inside = (p, r) => arenaContact(p, r - 0.05, new THREE.Vector3()) === 0 || Math.abs(p.x) > FIELD.halfX - 1;

console.log('Driving on the shell');
t('boosting at a side wall drives up it and across the ceiling', () => {
  const ph = fresh(); const c = ph.car;
  c.pos.set(0, 0, 0); c.fwd.set(0, 0, 1);
  const seen = new Set();
  for (let s = 0; s < 4; s += 1 / 60) { ph.step(1 / 60, { throttle: 1, steer: 0, boost: s < 2.2, jump: false }); seen.add(c.surface); }
  assert.ok(seen.has('wall') && seen.has('ceiling'), [...seen].join(','));
});
t('a car on the ceiling with no throttle drops off and lands upright on the floor', () => {
  const ph = fresh(); const c = ph.car;
  c.pos.set(0, FIELD.height, 0); c.up.set(0, -1, 0); c.fwd.set(1, 0, 0); c.vel.set(8, 0, 0); c.onGround = true; c.surface = 'ceiling';
  run(ph, 0.3, IDLE);
  assert.equal(c.onGround, false, 'should have left the ceiling');
  run(ph, 2.5, IDLE);
  assert.equal(c.surface, 'floor'); assert.ok(c.up.y > 0.99, `up.y ${c.up.y}`); assert.ok(c.pos.y < 0.05);
});
t('holding throttle keeps you on the ceiling', () => {
  const ph = fresh(); const c = ph.car;
  c.pos.set(-20, FIELD.height, 0); c.up.set(0, -1, 0); c.fwd.set(1, 0, 0); c.vel.set(15, 0, 0); c.onGround = true; c.surface = 'ceiling';
  run(ph, 1, { throttle: 1, steer: 0, boost: false, jump: false });
  assert.equal(c.surface, 'ceiling');
});
t('a car parked on a wall slides down it', () => {
  const ph = fresh(); const c = ph.car;
  c.pos.set(0, 18, FIELD.halfZ); c.up.set(0, 0, -1); c.fwd.set(1, 0, 0); c.vel.set(0, 0, 0); c.onGround = true; c.surface = 'wall';
  run(ph, 4, IDLE);
  assert.ok(c.pos.y < 1, `still at y=${c.pos.y.toFixed(1)}`);
});
t('throttle alone tops out at maxSpeed; boost goes faster', () => {
  const ph = fresh(); const c = ph.car;
  run(ph, 2.5, { throttle: 1, steer: 0, boost: false, jump: false });
  assert.ok(Math.abs(c.speed - CFG.maxSpeed) < 0.5, `speed ${c.speed}`);
  c.boost = 100; run(ph, 0.5, { throttle: 1, steer: 0, boost: true, jump: false });
  assert.ok(c.speed > CFG.maxSpeed + 5);
});

console.log('Jumps and flips');
t('double jump goes higher than a single jump', () => {
  const peak = (second) => {
    const ph = fresh(); let top = 0;
    run(ph, 1.2, (s) => { top = Math.max(top, ph.car.pos.y); return { ...IDLE, jump: s < 0.05 || (second && s > 0.25 && s < 0.3) }; });
    return top;
  };
  assert.ok(peak(true) > peak(false) + 1, `${peak(true)} vs ${peak(false)}`);
});
t('front flip (jump, then jump + W) gives speed and lands facing forward', () => {
  const ph = fresh(); const c = ph.car;
  let flipped = false; ph.onEvent = (e) => { if (e === 'flip') flipped = true; };
  run(ph, 1.4, (s) => ({ throttle: s > 0.2 ? 1 : 0, steer: 0, boost: false, jump: s < 0.05 || (s > 0.25 && s < 0.3) }));
  assert.ok(flipped); assert.equal(c.onGround, true);
  assert.ok(c.fwd.x > 0.95, `fwd.x ${c.fwd.x}`); // spawn faces +x
  assert.ok(c.pos.x > -30 + 10, `travelled ${c.pos.x + 30}`);
});
t('no second jump after the 1.25 s window', () => {
  const ph = fresh(); const c = ph.car;
  c.pos.y = 6; c.onGround = false; c.surface = 'air'; c.canDouble = true; c.jumpTimer = 1.3;
  let ev = 0; ph.onEvent = () => ev++;
  run(ph, 0.05, { ...IDLE, jump: true });
  assert.equal(ev, 0);
});

console.log('Ball and shell');
t('ball rolled hard at a side wall climbs the curve and comes back down', () => {
  const ph = fresh(); const b = ph.ball; b.vel.set(0, 0, 35);
  let top = 0; for (let s = 0; s < 4; s += 1 / 60) { ph.step(1 / 60, IDLE); top = Math.max(top, b.pos.y); }
  assert.ok(top > 6, `max height ${top}`); assert.ok(b.vel.z < 0 || b.pos.z < FIELD.halfZ - 5);
});
t('500 random shots never leave the arena', () => {
  const ph = fresh(); const b = ph.ball; ph.autoReset = false;
  let rng = 7; const r = () => ((rng = (rng * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let k = 0; k < 500; k++) {
    b.pos.set(r() * 40, 2 + Math.abs(r()) * 20, r() * 25); b.vel.set(r() * 60, r() * 40, r() * 60); ph.goalLock = false;
    for (let s = 0; s < 1; s += 1 / 60) {
      ph.step(1 / 60, IDLE);
      assert.ok(inside(b.pos, FIELD.ballR), `escaped at ${b.pos.toArray().map((v) => v.toFixed(1))}`);
      assert.ok(Math.abs(b.pos.x) < FIELD.halfX + FIELD.goalDepth && Math.abs(b.pos.z) < FIELD.halfZ && b.pos.y < FIELD.height);
    }
  }
});
t('ball through the orange goal mouth scores for blue', () => {
  let side = null; const ph = new Physics([], { onGoal: (s) => (side = s) }); ph.botOn = false;
  ph.ball.pos.set(48, 2, 0); ph.ball.vel.set(30, 0, 0);
  run(ph, 1, IDLE);
  assert.equal(side, 'orange');
});
t('ball hitting the end wall above the goal bounces back (no goal)', () => {
  let side = null; const ph = new Physics([], { onGoal: (s) => (side = s) }); ph.botOn = false;
  ph.ball.pos.set(45, 16, 0); ph.ball.vel.set(35, 0, 0);
  run(ph, 1.2, IDLE);
  assert.equal(side, null); assert.ok(ph.ball.vel.x < 0 || ph.ball.pos.x < 45);
});
t('ball against the post side of the mouth stays out of the goal', () => {
  let side = null; const ph = new Physics([], { onGoal: (s) => (side = s) }); ph.botOn = false;
  ph.ball.pos.set(40, 2, 16); ph.ball.vel.set(30, 0, 0); // wide of the 11-unit half mouth
  run(ph, 1.5, IDLE);
  assert.equal(side, null);
});

console.log('Boost');
t('boost drains while boosting and recharges by itself', () => {
  const ph = fresh(); const c = ph.car; c.boost = 100;
  run(ph, 1, { throttle: 1, steer: 0, boost: true, jump: false });
  const after = c.boost; assert.ok(after < 75, `boost ${after}`);
  run(ph, 2, IDLE); assert.ok(c.boost > after + 10, 'should recharge');
});

console.log('Podiums');
t('every podium sits on a touchline (half on the pitch, half on the ramp)', () => {
  for (const p of PODIUMS) assert.equal(Math.abs(p.z), FIELD.flatZ, `${p.id} at z=${p.z}`);
});
t('a ball rolling the length of the pitch inside the touchlines never touches a podium', () => {
  const ph = new Physics(PODIUMS); ph.botOn = false; ph.autoReset = false;
  for (const z of [-24, -12, 0, 12, 24]) {
    ph.ball.pos.set(-45, 2, z); ph.ball.vel.set(40, 0, 0);
    for (let s = 0; s < 1.4; s += 1 / 60) { ph.step(1 / 60, IDLE); assert.ok(Math.abs(ph.ball.vel.z) < 0.5, `deflected at z=${z}`); }
  }
});

console.log('Cars and bot');
t('supersonic into a stationary car demolishes it; it respawns after 3 s', () => {
  const ph = new Physics([]); const a = ph.car, b = ph.bot;
  a.pos.set(-10, 0, 0); a.fwd.set(1, 0, 0); a.vel.set(39, 0, 0); a.boost = 100;
  b.pos.set(0, 0, 0); b.vel.set(0, 0, 0);
  let demo = false; ph.onEvent = (e) => { if (e === 'demo') demo = true; };
  run(ph, 0.5, { throttle: 1, steer: 0, boost: true, jump: false });
  assert.ok(demo && b.demoT > 0);
  run(ph, 3, IDLE); assert.equal(b.demoT <= 0, true); assert.ok(Math.abs(b.pos.x - 30) < 0.5, 'back at its kickoff spot');
});
t('slow bumps do not demolish', () => {
  const ph = new Physics([]); const a = ph.car, b = ph.bot;
  a.pos.set(-6, 0, 0); a.fwd.set(1, 0, 0); a.vel.set(15, 0, 0); b.pos.set(0, 0, 0);
  run(ph, 0.6, { throttle: 1, steer: 0, boost: false, jump: false });
  assert.ok(b.demoT <= 0);
});
t('kickoff: player boosting straight vs the bot is a 50/50, no instant goal (20 kickoffs)', () => {
  let goals = 0;
  for (let k = 0; k < 20; k++) {
    let side = null; const ph = new Physics(PODIUMS, { onGoal: (s) => (side = side || s) });
    ph.autoReset = false; ph.resetAll();
    const bot = new Bot();
    for (let s = 0; s < 5 && !side; s += 1 / 60) ph.step(1 / 60, { throttle: 1, steer: 0, boost: s > 0.05, jump: false }, (p) => bot.input(p));
    if (side) goals++;
  }
  assert.ok(goals <= 4, `${goals} instant kickoff goals`);
});
t('bot vs bot: 4 full 90 s matches produce goals for both sides', () => {
  const tally = { orange: 0, blue: 0 };
  for (let m = 0; m < 4; m++) {
    let pending = 0; const ph = new Physics(PODIUMS, { onGoal: (s) => tally[s]++ }); ph.autoReset = false;
    const red = new Bot(), blue = new Bot({ attack: 1, key: 'car' });
    for (let s = 0; s < 90; s += 1 / 60) {
      ph.step(1 / 60, pending ? IDLE : blue.input(ph, 1 / 60), pending ? null : (p) => red.input(p));
      if (ph.goalLock && !pending) pending = 1;
      if (pending && (pending += 1 / 60) > 2) { ph.resetAll(); red.reset(); blue.reset(); pending = 0; }
    }
  }
  assert.ok(tally.orange > 0 && tally.blue > 0, JSON.stringify(tally));
});

console.log(`\n${n} physics tests passed`);
