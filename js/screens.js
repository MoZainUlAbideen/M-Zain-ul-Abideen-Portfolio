// ─────────────────────────────────────────────────────────────
//  Stadium screen above the end you face at kick-off.
//  Types "Welcome to My World !" next to the retro portrait.
//  A canvas, redrawn only when something on it changes.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { FIELD } from './arena.js';

const PIXEL = '"Press Start 2P", "Orbitron", monospace';

export const MAIN_TITLE = 'Welcome to My World !';

function makeScreen(scene, { w, h, px, x, y, z, rotY, color }) {
  // drawn in a fixed 2000-wide "logical" space, stored at a lower resolution
  const LW = 2000, LH = Math.round(LW * h / w), k = px / LW;
  const canvas = document.createElement('canvas');
  canvas.width = px; canvas.height = Math.round(LH * k);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // no mipmaps: rebuilding them on every redraw was the expensive part
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.anisotropy = 4;

  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0d1124, roughness: 0.5, metalness: 0.6 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, h + 1.2, 0.8), frameMat);
  frame.position.z = -0.45;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 0.18, 0.9), new THREE.MeshBasicMaterial({ color }));
  trim.position.set(0, -(h / 2 + 0.65), -0.4);
  const trimTop = trim.clone(); trimTop.position.y = h / 2 + 0.65;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color: 0xe6e6e6, toneMapped: false }));
  // legs down to the top of the stand
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a3150, roughness: 0.6, metalness: 0.5 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, y, 0.8), legMat);
    leg.position.set(s * w * 0.32, -y / 2, -0.9);
    g.add(leg);
  }
  g.add(frame, trim, trimTop, panel);
  scene.add(g);
  const ctx = canvas.getContext('2d');
  // static layer (backdrop, portrait, glow), painted once and reused
  const base = document.createElement('canvas');
  base.width = canvas.width; base.height = canvas.height;
  const bctx = base.getContext('2d');
  bctx.setTransform(k, 0, 0, k, 0, 0);
  return { canvas, ctx, tex, base, bctx, LW, LH, k, panel };
}

// LED-panel backdrop: dark gradient, faint dot grid and scanlines
function backdrop(ctx, W, H, accent) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#070b24'); bg.addColorStop(1, '#0b0f30');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(120,150,255,.06)';
  for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) ctx.fillRect(x, y, 2, 2);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  ctx.strokeStyle = accent; ctx.globalAlpha = 0.5; ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.globalAlpha = 1;
}

// wrap text to a width; returns lines
function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export function buildScreens(scene) {
  const { halfX } = FIELD;
  const back = halfX + FIELD.goalDepth + 2 + 1.2 + 10 * 2.2 + 3; // behind the end stands

  // the +x end: what you see at kick-off
  const main = makeScreen(scene, { w: 54, h: 19, px: 1400, x: back, y: 27, z: 0, rotY: -Math.PI / 2, color: 0xff7a1a });
  const { LW: W, LH: H } = main;
  const portrait = new Image();
  portrait.src = 'assets/life/zain-retro.png';

  const seq = { i: 0, t: 0, hold: 0 };
  let last = '', blink = 0, baseReady = false, textLeft = 80, textMaxW = 1000;

  // paint the parts that never change into the static layer
  function paintBase() {
    const ctx = main.bctx;
    backdrop(ctx, W, H, '#ff7a1a');
    const ok = portrait.complete && portrait.naturalWidth;
    const ph = H - 24, pw = ok ? ph * portrait.naturalWidth / portrait.naturalHeight : 0;
    const px = W - pw - 50;
    if (ok) {
      const glow = ctx.createRadialGradient(px + pw / 2, H * 0.5, 20, px + pw / 2, H * 0.5, ph * 0.75);
      glow.addColorStop(0, 'rgba(255,122,26,.3)'); glow.addColorStop(1, 'rgba(255,122,26,0)');
      ctx.fillStyle = glow; ctx.fillRect(px - 120, 0, pw + 240, H);
      ctx.drawImage(portrait, px, H - ph, pw, ph);
    }
    textMaxW = (ok ? px : W) - textLeft - 60;
    baseReady = ok;
  }

  function draw(n, cursorOn) {
    const ctx = main.ctx;
    if (!baseReady) paintBase();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(main.base, 0, 0);
    ctx.setTransform(main.k, 0, 0, main.k, 0, 0);
    const left = textLeft;

    // title
    ctx.textBaseline = 'top';
    ctx.font = `92px ${PIXEL}`;
    const lines = wrap(ctx, MAIN_TITLE.slice(0, n), textMaxW);
    const lh = 126, top = 100;
    ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#ffd27a';
    lines.forEach((l, i) => ctx.fillText(l, left, top + i * lh));
    ctx.shadowBlur = 0;
    if (cursorOn) {
      const lastLine = lines[lines.length - 1] || '';
      ctx.fillRect(left + ctx.measureText(lastLine).width + 12, top + (lines.length - 1) * lh, 48, 90);
    }

    main.tex.needsUpdate = true;
  }

  // only redraw while the screen is actually in view
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), box = new THREE.Box3();
  main.panel.updateWorldMatrix(true, false);
  box.setFromObject(main.panel);
  function inView(camera) {
    if (!camera) return true;
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pv);
    return frustum.intersectsBox(box);
  }

  function update(dt, camera) {
    blink += dt;
    const cursorOn = Math.floor(blink * 2.2) % 2 === 0;

    // type the title, hold, then type it again
    seq.t += dt;
    if (seq.hold > 0) { seq.hold -= dt; if (seq.hold <= 0) seq.i = 0; }
    else if (seq.t > 0.1) { seq.t = 0; seq.i++; if (seq.i >= MAIN_TITLE.length) seq.hold = 8; }
    const n = Math.min(seq.i, MAIN_TITLE.length);

    if (portrait.complete && !baseReady) paintBase();
    const key = `${n}|${cursorOn}|${baseReady}`;
    if (key !== last && inView(camera)) { last = key; draw(n, cursorOn); }
  }

  return { update };
}
