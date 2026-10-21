// ─────────────────────────────────────────────────────────────
//  Boot: renderer, input, camera, game loop.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SITE, PODIUMS } from './content.js';
import { buildArena, buildBall, FIELD, TEAM } from './arena.js';
import { buildCar, RED_PAINT } from './car.js';
import { buildPodiums, updatePodiums, REACH } from './podiums.js';
import { Physics, SPAWN, CFG } from './physics.js';
import { FX } from './fx.js';
import { UI } from './ui.js';
import { ArenaAudio } from './audio.js';
import { buildDugout } from './dugout.js';
import { mergeStatic } from './merge.js';
import { buildTouchControls, isTouch } from './touch.js';
import { buildScreens } from './screens.js';
import { Academy } from './academy/academy.js';
import { Bot } from './bot.js';
import { Match } from './match.js';
import { arenaContact } from './arena.js';

const DEBUG = new URLSearchParams(location.search).has('debug');

// ── splash text ──

await Promise.all([
  document.fonts.load('italic 700 64px "Chakra Petch"'),
  document.fonts.load('900 64px "Orbitron"'),
  document.fonts.load('32px "Press Start 2P"'),
]).catch(() => {});

// ── renderer ──
const canvas = document.getElementById('scene');
// antialias off: the bloom pipeline renders into its own (non-MSAA) buffers anyway,
// so canvas MSAA only cost memory bandwidth without smoothing anything
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
// Resolution: never more than ~2.4M rendered pixels (a 1080p screen at 1.15x),
// and `quality` drops a notch automatically if the frame rate sags (see loop).
const TOUCH = isTouch();
if (TOUCH) document.documentElement.classList.add('is-touch');
const PIXEL_BUDGET = TOUCH ? 1.1e6 : 2.4e6; // phones: fewer pixels, their GPUs are smaller
let quality = 1;
const pixelRatio = () => Math.max(0.6, Math.min(devicePixelRatio, 1.5, Math.sqrt(PIXEL_BUDGET / (innerWidth * innerHeight))) * quality);
renderer.setPixelRatio(pixelRatio());
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
// soft reflections so metal (rollers, podiums) and the car's clear-coat actually shine
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 600);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.65, 0.5, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function applySize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  const pr = pixelRatio();
  renderer.setPixelRatio(pr);
  composer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', applySize);

// adaptive quality: if frames average slower than ~50 fps for 2 s while driving,
// render at a slightly lower resolution (down to 70%). Never goes back up mid-session,
// so it can't flicker between two settings.
const perf = { t: 0, frames: 0, warm: 0 };
function watchFrameRate(dt, active) {
  if (!active || document.hidden || dt > 0.25) { perf.t = perf.frames = 0; return; } // skip pauses and tab switches
  if ((perf.warm += dt) < 3) return; // ignore shader warm-up
  perf.t += dt; perf.frames++;
  if (perf.t < 2) return;
  const avg = perf.t / perf.frames;
  perf.t = perf.frames = 0;
  if (avg > 1 / 50 && quality > 0.7) { quality = Math.max(0.7, quality - 0.15); applySize(); }
}

// ── world ──
// everything the arena builds is static: gather its meshes and merge them
{
  const before = new Set(scene.children);
  buildArena(scene);
  const arenaStatic = new THREE.Group();
  for (const o of [...scene.children]) if (!before.has(o) && (o.isMesh || o.isGroup)) arenaStatic.add(o);
  scene.add(arenaStatic);
  mergeStatic(arenaStatic);
  // phones: a smaller shadow map is plenty on a small screen
  if (TOUCH) arenaStatic.parent.traverse((o) => { if (o.isDirectionalLight && o.castShadow) o.shadow.mapSize.set(1024, 1024); });
}
const car = buildCar();
scene.add(car.group);
// the red bot: parked at its kickoff spot, drives only during a match
const botCar = buildCar(RED_PAINT);
scene.add(botCar.group);
const bot = new Bot();
const { ball, marker } = buildBall();
scene.add(ball, marker);
const pods = buildPodiums(scene, PODIUMS);
const dugout = buildDugout(scene);
const screens = buildScreens(scene);
const academy = new Academy();
// everything the car can press E at: the podiums plus the dugout's technical area
const spots = [...pods, dugout.spot];
const fx = new FX(scene);
const ui = new UI();
const audio = new ArenaAudio();
const muteBtn = document.getElementById('mute');
const showMute = () => { muteBtn.querySelector('span').textContent = audio.muted ? 'Sound off' : 'Sound on'; muteBtn.setAttribute('aria-pressed', String(audio.muted)); };
showMute();
muteBtn.addEventListener('click', () => { audio.toggleMute(); showMute(); canvas.focus(); });

// full screen (F or the button); Esc leaves it as usual
const fsBtn = document.getElementById('fullscreen');
const root = document.documentElement;
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
const canFs = !!(root.requestFullscreen || root.webkitRequestFullscreen);
function toggleFullscreen() {
  if (!canFs) return;
  try {
    const r = fsElement()
      ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
      : (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    if (r && r.catch) r.catch(() => {});
    // phones: going full screen also turns the view sideways where the browser allows it
    if (TOUCH && !fsElement() && r && r.then) r.then(() => screen.orientation?.lock?.('landscape').catch(() => {}));
  } catch {}
}
const showFs = () => { const on = !!fsElement(); fsBtn.querySelector('span').textContent = on ? 'Exit full screen' : 'Full screen'; fsBtn.setAttribute('aria-pressed', String(on)); };
if (!canFs) fsBtn.hidden = true;
fsBtn.addEventListener('click', () => { toggleFullscreen(); canvas.focus(); });
document.addEventListener('fullscreenchange', showFs);
document.addEventListener('webkitfullscreenchange', showFs);
addEventListener('resize', showFs);

let goals = 0;
let shake = 0;
const physics = new Physics(pods, {
  onGoal(goalSide, pos) {
    if (match.on) {
      if (!match.goal(goalSide)) return;
    } else {
      goals++;
      ui.setScore(goals);
    }
    ui.goal(goalSide);
    fx.goal(pos, goalSide === 'orange' ? TEAM.orange : TEAM.blue);
    audio.goal();
    shake = 0.8;
  },
  onHit(kind, strength) {
    if (kind === 'car' || kind === 'bump') shake = Math.max(shake, Math.min(0.25, strength / 120));
    if (strength > 4) {
      if (kind === 'bump') audio.bump(strength);
      else if (kind === 'car' || kind === 'bot') audio.hit(strength, near(physics.ball.pos));
      else audio.wallHit(strength * 0.5, near(physics.ball.pos));
    }
  },
  onEvent(kind, c, extra) {
    const mine = c === physics.car, v = mine ? 1 : 0.45 * near(c.pos);
    if (kind === 'jump') audio.jump(v, extra);
    else if (kind === 'flip') audio.flip(v);
    else if (kind === 'land') audio.land(v, extra);
    else if (kind === 'supersonic' && mine) audio.supersonic();
    else if (kind === 'demo') {
      fx.demo(c.pos, c === physics.car ? 0x3d86ff : 0xff3b30);
      audio.demo();
      shake = Math.max(shake, mine ? 0.9 : 0.4);
    }
  },
});
// 0..1: how close something is to the player's car (quieter sounds far away)
function near(p) { return Math.max(0.15, 1 - p.distanceTo(physics.car.pos) / 90); }



const match = new Match({
  physics, bot, audio,
  onStart() {
    if (ui.panelOpen) ui.close();
    keys.clear(); touch?.release();
    ui.setPrompt(null);
    canvas.focus();
  },
  onStop() {
    canvas.focus();
  },
});

// ── input ──
const keys = new Set();
let ballCam = false;
const GAME_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
addEventListener('keydown', (e) => {
  if (state !== 'play') return;
  if (academy.isOpen) { if (e.code === 'Escape') academy.back(); return; }
  if (ui.panelOpen) { if (e.code === 'Escape') ui.close(); return; }
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyE') openNear();
  if (e.code === 'KeyC') toggleBallCam();
  if (e.code === 'KeyR' && !match.on) resetPlay(); // no teleporting mid-match
  if (e.code === 'KeyN') match.toggle();
  if (e.code === 'KeyM') { audio.toggleMute(); showMute(); }
  if (e.code === 'KeyF') toggleFullscreen();
  if (e.code === "KeyH") document.getElementById('help').classList.toggle('is-hidden');
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); touch?.release(); });

function openNear() {
  if (!nearPod || state !== 'play' || ui.panelOpen || academy.isOpen || match.on) return;
  keys.clear(); touch?.release();
  if (nearPod.data.id === 'academy') { ui.setPrompt(null); academy.open(); } else ui.open(nearPod.data);
}
function toggleBallCam() { ballCam = !ballCam; ui.setBallCam(ballCam); touch?.el.querySelector('[data-act="cam"]').classList.toggle('is-on', ballCam); }
function resetPlay() { physics.resetCar(); physics.resetBall(); physics.resetBot(); }

// the "Open ..." prompt is also a button (tap on phones, click on desktop)
document.getElementById('prompt').addEventListener('click', openNear);

// phones and tablets: on-screen joystick + buttons
const touch = TOUCH ? buildTouchControls(document.getElementById('hud'), { onCam: toggleBallCam, onReset: resetPlay }) : null;
if (TOUCH) document.querySelector('#prompt kbd').textContent = 'Tap';

function readInput() {
  const k = (...c) => c.some((x) => keys.has(x));
  const t = touch ? touch.state : IDLE;
  const throttle = (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0);
  const steer = (k('KeyA', 'ArrowLeft') ? 1 : 0) - (k('KeyD', 'ArrowRight') ? 1 : 0);
  return {
    throttle: throttle || t.throttle,
    steer: steer || t.steer,
    boost: k('ShiftLeft', 'ShiftRight') || t.boost,
    jump: k('Space') || t.jump,
  };
}
const IDLE = { throttle: 0, steer: 0, boost: false, jump: false };

// ── start ──
let state = 'splash';
const startBtn = document.getElementById('start');
startBtn.disabled = false;
startBtn.querySelector('span').textContent = 'Explore';
startBtn.addEventListener('click', () => {
  state = 'play';
  audio.start();
  document.getElementById('splash').classList.add('is-leaving');
  setTimeout(() => (document.getElementById('splash').hidden = true), 500);
  document.getElementById('hud').hidden = false;
  canvas.focus();
});

// ── camera ──
// Rocket League car cam: behind and above the car, following it up the walls (the view rolls
// with the car while it is on a surface and eases back to level in the air).
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0);
const want = new THREE.Vector3(), look = new THREE.Vector3(), dir = new THREE.Vector3(), fwdS = new THREE.Vector3(1, 0, 0), upS = new THREE.Vector3(0, 1, 0);
const tmpN = new THREE.Vector3(), WUP = new THREE.Vector3(0, 1, 0);
camera.position.set(-30, 5, -9);

function updateCamera(dt, t) {
  const r = physics.render, c = physics.car;
  const pos = r.carPos, b = r.ballPos;
  if (camera.view?.enabled) camera.clearViewOffset();
  if (state === 'splash') {
    // slow orbit around the car so visitors can admire it
    const a = t * 0.25;
    want.set(pos.x + Math.sin(a) * 8.5, 3.2, pos.z + Math.cos(a) * 8.5);
    look.set(pos.x, 1.1, pos.z);
    camera.position.lerp(want, 1 - Math.exp(-3 * dt));
    camLook.lerp(look, 1 - Math.exp(-3 * dt));
    camera.up.set(0, 1, 0);
    camera.lookAt(camLook);
    return;
  }
  // smoothed heading and roof direction of the car
  const k = 1 - Math.exp(-6 * dt);
  fwdS.lerp(c.fwd, k).normalize();
  upS.lerp(c.onGround ? c.up : WUP, 1 - Math.exp(-(c.onGround ? 5 : 2.5) * dt)).normalize();
  camUp.copy(upS);
  if (ballCam) {
    dir.copy(b).sub(pos);
    if (dir.lengthSq() < 1) dir.copy(fwdS);
    dir.normalize();
    want.copy(pos).addScaledVector(dir, -11).addScaledVector(camUp, 4.6);
    look.copy(pos).lerp(b, 0.4).addScaledVector(camUp, 1.5);
  } else {
    // in the air, follow the direction of travel rather than a spinning nose
    if (!c.onGround && c.vel.lengthSq() > 25) dir.copy(c.vel).normalize(); else dir.copy(fwdS);
    if (!c.onGround) dir.y *= 0.4;
    dir.normalize();
    want.copy(pos).addScaledVector(dir, -10.5).addScaledVector(camUp, 4.4);
    look.copy(pos).addScaledVector(dir, 4).addScaledVector(camUp, 1.4);
  }
  // keep the camera inside the arena (push it off the walls and ceiling)
  const pen = arenaContact(want, 1.2, tmpN);
  if (pen > 0) want.addScaledVector(tmpN, pen);
  camPos.lerp(want, 1 - Math.exp(-8 * dt));
  camLook.lerp(look, 1 - Math.exp(-12 * dt));
  camera.position.copy(camPos);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 1.5);
  }
  camera.up.copy(camUp);
  camera.lookAt(camLook);
  // 70° tall on a landscape screen; on a tall phone, widen it so you still see the sides
  const baseFov = camera.aspect >= 1.2 ? 70 : Math.min(100, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(46)) / camera.aspect)));
  const targetFov = baseFov + (c.boosting ? 8 : 0) + (c.supersonic ? 4 : 0);
  camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-4 * dt));
  camera.updateProjectionMatrix();
}
camPos.copy(camera.position);
camLook.set(SPAWN.car.x, 1, SPAWN.car.z);

// ── loop ──
let nearPod = null;
const clock = new THREE.Clock();
let touchBusy = false;
function frame() {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  const t = clock.elapsedTime;
  const busy = ui.panelOpen || academy.isOpen;
  if (state === 'play') match.update(dt);
  if (match.phase === 'countdown') physics.resetBall(); // the ball hangs at centre until GO, then drops
  const input = state === 'play' && !busy && !match.frozen ? readInput() : IDLE;
  if (touch && busy !== touchBusy) { touchBusy = busy; touch.el.classList.toggle('is-hidden', busy); if (busy) touch.release(); }
  physics.step(dt, input, match.botLive ? (p) => bot.input(p) : null);

  // car visuals (both cars): full 3D orientation, wheels, boost, supersonic, demolished
  const drawCar = (k, model, pos, quat, team) => {
    model.group.visible = k.demoT <= 0;
    if (!model.group.visible) return;
    model.group.position.copy(pos);
    model.group.quaternion.copy(quat);
    for (const w of model.wheels) {
      w.spin.rotation.x = k.roll;
      if (w.front) w.pivot.rotation.y = k.steer * 0.4;
    }
    for (const r of model.rollers) r.rotation.y += k.speed * dt * 0.6;
    model.flames.visible = k.boosting;
    if (k.boosting || k.supersonic) model.group.updateMatrixWorld();
    if (k.boosting) { model.flames.scale.set(1, 1, 0.8 + Math.random() * 0.5); fx.boost(model.group, dt, team); }
    if (k.supersonic) fx.sonic(model.group, dt);
  };
  drawCar(physics.bot, botCar, physics.render.botPos, physics.render.botQuat, 'orange');
  const c = physics.car;
  drawCar(c, car, physics.render.carPos, physics.render.carQuat, 'blue');
  audio.setBoost(c.boosting && state === 'play' && !busy);
  // car sound only while actually driving; silent behind popups and in the academy
  if (state === 'play' && !busy && c.demoT <= 0) audio.engine(c.speed, input.throttle || input.boost, c.boosting, c.onGround);
  else audio.engineOff();
  // crowd: louder when the ball is near a goal and moving fast
  if (state === 'play') {
    const bp = physics.ball.pos;
    const danger = Math.max(0, (Math.abs(bp.x) - 30) / 30) * Math.min(1, physics.ball.vel.length() / 25);
    audio.crowd(busy ? 0.2 : 0.55 + danger * 0.9);
  }

  // ball visuals
  const b = physics.ball;
  ball.position.copy(physics.render.ballPos);
  ball.quaternion.copy(physics.render.ballQuat);
  marker.position.set(ball.position.x, 0.04, ball.position.z);
  marker.material.opacity = THREE.MathUtils.clamp((b.pos.y - FIELD.ballR - 0.5) / 6, 0, 0.5);

  // nearest podium in reach
  nearPod = null;
  let best = REACH;
  for (const p of spots) {
    const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
    if (d < best) { best = d; nearPod = p; }
  }
  if (state === 'play' && !busy) ui.setPrompt(match.on ? null : nearPod?.data);
  updatePodiums(pods, t, dt, nearPod?.data.id);
  dugout.update(t, nearPod?.data.id === 'academy' ? 1 : 0);
  if (!academy.isOpen) screens.update(dt, camera);
  ui.setBoost(c.boost);

  fx.update(dt);
  if (!window.freezeCam) updateCamera(dt, t);
  // the academy covers the whole screen, so skip drawing the arena behind it (saves the GPU)
  if (!academy.isOpen) composer.render();
  watchFrameRate(rawDt, state === 'play' && !busy);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (DEBUG) Object.assign(window, { updateCamera, match, bot, botCar, quality: () => quality, physics, camera, scene, renderer, composer, bloom, ui, pods, audio, academy, dugout, screens, THREE, setState: (s) => (state = s), keys });
