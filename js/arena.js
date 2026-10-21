// ─────────────────────────────────────────────────────────────
//  The arena, Rocket League style: a closed "rounded box".
//  Grass pitch, curved ramps up to the walls, walls up to a curved
//  edge and a glass ceiling. Hex-panel glass tinted blue on the blue
//  half and orange on the orange half; goals cut into the end walls.
//  Outside: the stands with the crowd, the dugout and the big screens.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export const FIELD = {
  halfX: 60,      // goal lines (end walls) at x = ±60
  halfZ: 40,      // side walls at z = ±40
  height: 30,     // ceiling
  R: 8,           // radius of every curved edge: floor→wall, wall→ceiling and the corners
  goalHalfW: 11,  // goal mouth is 22 wide
  goalH: 9,
  goalDepth: 8,
  postR: 0.35,
  ballR: 2,
};
FIELD.wallH = FIELD.height;
// the flat part of the floor (where the ramps start)
FIELD.flatX = FIELD.halfX - FIELD.R;
FIELD.flatZ = FIELD.halfZ - FIELD.R;

// Dugout ("My Academy") behind the top side wall
export const DUGOUT = { x: 24, halfW: 7, depth: 5, h: 3.2 };

export const TEAM = { blue: 0x2f7bff, orange: 0xff7a1a };

// The glass dome over the whole stadium (pitch, stands and big screens): half an ellipsoid on
// the ground, semi-axes ax (along x), ay (height), az (along z). Purely visual: the arena shell
// inside it is what the ball and cars touch.
export const DOME = { ax: 132, ay: 72, az: 102 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// How far a sphere (centre p, radius r) has pushed into the arena shell.
// Returns the depth (0 = not touching) and writes the inward surface normal to `out`.
// The shell is a box with every edge rounded by R; in the goal mouth the end wall is open.
export function arenaContact(p, r, out) {
  const { halfX, halfZ, height, R, goalHalfW, goalH } = FIELD;
  const ix = halfX - R, iz = halfZ - R;
  const mouth = Math.abs(p.z) < goalHalfW && p.y < goalH;
  const qx = mouth ? p.x : clamp(p.x, -ix, ix);
  const qy = clamp(p.y, R, height - R), qz = clamp(p.z, -iz, iz);
  const dx = p.x - qx, dy = p.y - qy, dz = p.z - qz;
  const d = Math.hypot(dx, dy, dz), lim = R - r;
  if (d <= lim) return 0;
  out.set(-dx / d, -dy / d, -dz / d);
  return d - lim;
}

// Goal mouth "channel" and the inside of the net. Keeps a sphere (or a car, isCar) between the
// side cheeks of the mouth and inside the net box. e = bounce kept.
export function goalChannel(p, r, v, e, isCar = false, onHit) {
  const { halfX, R, goalHalfW, goalH, goalDepth } = FIELD;
  const ax = Math.abs(p.x), sx = Math.sign(p.x) || 1;
  if (ax < halfX - R || Math.abs(p.z) > goalHalfW) return;
  if (ax > halfX) {
    // inside the net: nets swallow energy
    if (Math.abs(p.z) > goalHalfW - r) { const s = Math.sign(p.z); p.z = s * (goalHalfW - r); if (v.z * s > 0) v.z *= -e; }
    const top = isCar ? goalH - 2.2 : goalH - r;
    if (p.y > top) { p.y = top; if (v.y > 0) v.y *= -e; }
    if (ax > halfX + goalDepth - r) { p.x = sx * (halfX + goalDepth - r); if (v.x * sx > 0) v.x *= -e; }
    return;
  }
  // between the curved cheeks either side of the mouth
  if (Math.abs(p.z) > goalHalfW - r) {
    const t = ax - (halfX - R);
    const h = R - Math.sqrt(Math.max(0, R * R - t * t)); // height of the ramp at this x
    if ((isCar ? p.y : p.y - r * 0.5) < h) {
      const s = Math.sign(p.z);
      p.z = s * (goalHalfW - r);
      if (v.z * s > 0) { v.z *= -(isCar ? 0.2 : e); onHit?.(); }
    }
  }
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Tech-grid floor: glowing rounded tiles (blue half → orange half) with the

// Tech-grid floor (the original hand-made pitch): glowing rounded tiles with the football
// markings on top, now in an orange theme. Returns { map, glow } canvas textures.
// The texture spans x = ±(halfX + goalDepth) and z = ±flatZ (the flat floor plus the goal mouths).
const PITCH = { x0: -(FIELD.halfX + FIELD.goalDepth), x1: FIELD.halfX + FIELD.goalDepth, z0: -FIELD.flatZ, z1: FIELD.flatZ };
function pitchTextures() {
  const { halfX, goalHalfW, flatX, flatZ } = FIELD;
  const S = 18; // px per unit
  const W = Math.round((PITCH.x1 - PITCH.x0) * S), Hh = Math.round((PITCH.z1 - PITCH.z0) * S);
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = Hh; return c; };
  const baseC = mk(), glowC = mk();
  const base = baseC.getContext('2d'), glow = glowC.getContext('2d');
  const P = (x, z) => [(x - PITCH.x0) * S, (z - PITCH.z0) * S];
  const mix = (t) => {
    // tile outlines: hot amber at the ends → pale gold through the middle
    const stops = [[255, 196, 90], [255, 236, 170], [255, 196, 90]];
    const k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    const [a, b] = t < 0.5 ? [stops[0], stops[1]] : [stops[1], stops[2]];
    return a.map((v, i) => Math.round(v + (b[i] - v) * k));
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const rrect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };

  // base: orange, a touch deeper towards each end
  const bg = base.createLinearGradient(0, 0, W, 0);
  bg.addColorStop(0, '#c9561a'); bg.addColorStop(0.5, '#ec7a28'); bg.addColorStop(1, '#c9561a');
  base.fillStyle = bg; base.fillRect(0, 0, W, Hh);
  glow.fillStyle = '#000'; glow.fillRect(0, 0, W, Hh);

  // tiles, between the goal lines
  const [gx0] = P(-halfX, 0), [gx1] = P(halfX, 0);
  const cols = 16, rows = 9;
  const tw = (gx1 - gx0) / cols, th = Hh / rows;
  const inset = 0.55 * S, rad = 1.1 * S;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = gx0 + i * tw + inset, y = j * th + inset, w = tw - inset * 2, h = th - inset * 2;
    const c = mix((i + 0.5) / cols);
    rrect(base, x, y, w, h, rad);
    base.fillStyle = 'rgba(255,150,70,.35)'; base.fill();
    // circuit dots
    base.fillStyle = 'rgba(255,235,200,.16)';
    for (let dx = x + 10; dx < x + w - 6; dx += 14) for (let dy = y + 10; dy < y + h - 6; dy += 14) {
      if (Math.random() < 0.5) base.fillRect(dx, dy, 3, 3);
    }
    // a short "trace"
    base.strokeStyle = 'rgba(255,235,200,.18)'; base.lineWidth = 3;
    const sx = x + 20 + Math.random() * (w - 40), sy = y + 20 + Math.random() * (h - 40);
    base.beginPath(); base.moveTo(sx, sy); base.lineTo(sx + (Math.random() - 0.5) * 60, sy); base.lineTo(sx + (Math.random() - 0.5) * 60, sy + (Math.random() - 0.5) * 40); base.stroke();
    // glowing outline
    rrect(glow, x, y, w, h, rad);
    glow.shadowColor = rgba(c, 1); glow.shadowBlur = 10;
    glow.strokeStyle = rgba(c, 0.9); glow.lineWidth = 0.2 * S;
    glow.stroke();
    glow.shadowBlur = 0;
    rrect(base, x, y, w, h, rad);
    base.strokeStyle = rgba(c, 0.55); base.lineWidth = 0.2 * S; base.stroke();
  }

  // football markings, warm white, on both layers
  for (const ctx of [base, glow]) {
    ctx.save();
    ctx.strokeStyle = ctx === glow ? 'rgba(255,236,210,.95)' : 'rgba(255,244,230,.9)';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 0.32 * S;
    if (ctx === glow) { ctx.shadowColor = '#ffb070'; ctx.shadowBlur = 8; }
    const rect = (x0, z0, x1, z1) => { const [a, b] = P(x0, z0); const [c, d] = P(x1, z1); ctx.strokeRect(a, b, c - a, d - b); };
    rect(-flatX + 0.5, -flatZ + 0.5, flatX - 0.5, flatZ - 0.5); // the touchlines, where the ramps start
    ctx.beginPath(); ctx.moveTo(...P(0, -flatZ)); ctx.lineTo(...P(0, flatZ)); ctx.stroke();
    ctx.beginPath(); ctx.arc(...P(0, 0), 9.15 * S, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(...P(0, 0), 0.6 * S, 0, Math.PI * 2); ctx.fill();
    for (const s of [-1, 1]) {
      const gx = s * (halfX - 0.5);
      // penalty area 16 deep, six-yard box 6 deep, spot 11 out (measured from the goal line)
      const pen = s * (halfX - 16), six = s * (halfX - 6), spot = s * (halfX - 11);
      rect(Math.min(gx, pen), -(goalHalfW + 12), Math.max(gx, pen), goalHalfW + 12);
      rect(Math.min(gx, six), -(goalHalfW + 3), Math.max(gx, six), goalHalfW + 3);
      ctx.beginPath(); ctx.arc(...P(spot, 0), 0.45 * S, 0, Math.PI * 2); ctx.fill();
      const [cx, cy] = P(spot, 0);
      const a = Math.acos(5 / 9.15);
      ctx.beginPath();
      if (s > 0) ctx.arc(cx, cy, 9.15 * S, Math.PI - a, Math.PI + a); else ctx.arc(cx, cy, 9.15 * S, -a, a);
      ctx.stroke();
      for (const t of [-1, 1]) {
        ctx.beginPath(); ctx.arc(...P(s * (flatX - 0.5), t * (flatZ - 0.5)), 1.5 * S, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
  }

  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { map: tex(baseC), glow: tex(glowC) };
}

// a floor patch (x0..x1, z0..z1) with UVs taken from the pitch texture's world mapping
function floorPatch(x0, x1, z0, z1, mat) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - PITCH.x0) / (PITCH.x1 - PITCH.x0), 1 - (pos.getZ(i) - PITCH.z0) / (PITCH.z1 - PITCH.z0));
  }
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

// Hex-panel lines for the glass (tileable). White lines; tinted by vertex colour.
function hexTexture() {
  const s = 32, W = 3 * s, Hh = Math.round(Math.sqrt(3) * s);
  return (() => {
    const c = document.createElement('canvas'); c.width = W * 2; c.height = Hh * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    ctx.strokeStyle = 'rgba(255,255,255,1)'; ctx.lineWidth = 1.6;
    const hex = (cx, cy) => {
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) { const a = (Math.PI / 3) * i; const x = cx + s * Math.cos(a), y = cy + s * Math.sin(a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    };
    for (let i = -1; i <= 2; i++) for (let j = -1; j <= 2; j++) { hex(i * W, j * Hh); hex(i * W + 1.5 * s, j * Hh + Hh / 2); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
  })();
}

// The shell: a finely divided box, every vertex pushed onto the rounded box surface.
// Floor (drawn separately as grass) and the goal mouths are cut out.
function shellGeometry() {
  const { halfX, halfZ, height, R, goalHalfW, goalH } = FIELD;
  const ix = halfX - R, iz = halfZ - R;
  const box = new THREE.BoxGeometry(halfX * 2, height, halfZ * 2, 120, 30, 80).toNonIndexed();
  box.translate(0, height / 2, 0);
  const src = box.attributes.position;
  const keep = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Vector3();
  for (let t = 0; t < src.count; t += 3) {
    a.fromBufferAttribute(src, t); b.fromBufferAttribute(src, t + 1); c.fromBufferAttribute(src, t + 2);
    m.copy(a).add(b).add(c).divideScalar(3);
    const onFloor = m.y < 0.01, onEnd = Math.abs(Math.abs(m.x) - halfX) < 0.01;
    if (onFloor && Math.abs(m.x) < ix && Math.abs(m.z) < iz) continue;                    // flat floor
    if (onFloor && Math.abs(m.x) >= ix && Math.abs(m.z) < goalHalfW) continue;            // ramp under the goal mouth
    if (onEnd && Math.abs(m.z) < goalHalfW && m.y < goalH) continue;                       // the mouth itself
    keep.push(t);
  }
  const pos = new Float32Array(keep.length * 9), nor = new Float32Array(keep.length * 9);
  const uv = new Float32Array(keep.length * 6), col = new Float32Array(keep.length * 9);
  const v = new THREE.Vector3(), q = new THREE.Vector3(), d = new THREE.Vector3();
  const blue = new THREE.Color(0x3d86ff), orange = new THREE.Color(0xff8a2e), white = new THREE.Color(0xdde8ff), cc = new THREE.Color();
  let k = 0;
  for (const t of keep) for (let j = 0; j < 3; j++, k++) {
    v.fromBufferAttribute(src, t + j);
    q.set(clamp(v.x, -ix, ix), clamp(v.y, R, height - R), clamp(v.z, -iz, iz));
    d.copy(v).sub(q).normalize();
    v.copy(q).addScaledVector(d, R);
    pos.set([v.x, v.y, v.z], k * 3);
    nor.set([-d.x, -d.y, -d.z], k * 3); // facing into the arena
    // triplanar-ish UVs: pick the plane the surface mostly faces
    const ax = Math.abs(d.x), ay = Math.abs(d.y), az = Math.abs(d.z), T = 6;
    if (ay >= ax && ay >= az) uv.set([v.x / T, v.z / T], k * 2);
    else if (ax >= az) uv.set([v.z / T, v.y / T], k * 2);
    else uv.set([v.x / T, v.y / T], k * 2);
    // team tint: blue half / orange half, white near the halfway line, dimmer on the ceiling
    const f = clamp(v.x / (halfX * 0.25), -1, 1);
    cc.copy(white).lerp(f < 0 ? blue : orange, Math.abs(f));
    if (d.y > 0.5) cc.multiplyScalar(0.55);
    col.set([cc.r, cc.g, cc.b], k * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// the curved "cheeks" either side of each goal mouth (fill under the ramp profile)
function cheekGeometry() {
  const { halfX, R } = FIELD, ix = halfX - R;
  const sh = new THREE.Shape();
  sh.moveTo(ix, 0); sh.lineTo(halfX, 0); sh.lineTo(halfX, R);
  for (let i = 1; i <= 24; i++) {
    const a = (Math.PI / 2) * (1 - i / 24); // from the wall back down to the floor
    sh.lineTo(ix + R * Math.sin(a), R - R * Math.cos(a));
  }
  return new THREE.ShapeGeometry(sh);
}

function netTexture(color) {
  const t = canvasTex(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    const n = 8;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo((i * w) / n, 0); ctx.lineTo((i * w) / n, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (i * h) / n); ctx.lineTo(w, (i * h) / n); ctx.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function skyTexture() {
  // light blue overhead, warming to a soft orange at the horizon
  return canvasTex(16, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#5fa8f5');
    g.addColorStop(0.42, '#9fcdf7');
    g.addColorStop(0.68, '#ffd9b0');
    g.addColorStop(0.86, '#ffb070');
    g.addColorStop(1, '#ff9550');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function ballTexture(emissive) {
  return canvasTex(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = emissive ? '#000' : '#5c6270';
    ctx.fillRect(0, 0, w, h);
    // hex panels
    const r = 34;
    const hx = r * Math.sqrt(3);
    for (let row = -1; row < h / (r * 1.5) + 1; row++) {
      for (let col = -1; col < w / hx + 1; col++) {
        const cx = col * hx + (row % 2 ? hx / 2 : 0);
        const cy = row * r * 1.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 6 + (i * Math.PI) / 3;
          const px = cx + Math.cos(a) * (r - 3), py = cy + Math.sin(a) * (r - 3);
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        if (emissive) {
          ctx.strokeStyle = 'rgba(80,200,255,.22)';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          const shade = 128 + ((col * 7 + row * 13) % 5) * 10;
          ctx.fillStyle = `rgb(${shade},${shade + 4},${shade + 14})`;
          ctx.fill();
        }
      }
    }
    // glowing equator band + a ring
    if (emissive) {
      ctx.fillStyle = '#39d7ff';
      ctx.fillRect(0, h / 2 - 5, w, 10);
      ctx.beginPath(); ctx.arc(w * 0.25, h / 2, 40, 0, Math.PI * 2); ctx.lineWidth = 8; ctx.strokeStyle = '#39d7ff'; ctx.stroke();
      ctx.beginPath(); ctx.arc(w * 0.75, h / 2, 40, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = '#2b2f38';
      ctx.fillRect(0, h / 2 - 9, w, 18);
    }
  });
}

export function buildBall() {
  const mat = new THREE.MeshStandardMaterial({
    map: ballTexture(false), emissiveMap: ballTexture(true), emissive: 0xffffff, emissiveIntensity: 1.4,
    roughness: 0.35, metalness: 0.55,
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(FIELD.ballR, 48, 32), mat);
  ball.castShadow = true;

  // ring on the ground under the ball (helps judge where it will land)
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(FIELD.ballR * 0.75, FIELD.ballR * 0.95, 40),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.04;
  return { ball, marker };
}

export function buildArena(scene) {
  const { halfX, halfZ, height, R, goalHalfW, goalH, goalDepth, postR, flatX, flatZ } = FIELD;

  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xf6c9a0, 200, 460);

  // ── lights: a warm late-afternoon sun ──
  scene.add(new THREE.HemisphereLight(0xd6eaff, 0x8a5a3a, 1.2));
  const sun = new THREE.DirectionalLight(0xffe2c0, 2.4);
  sun.position.set(45, 60, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -85, right: 85, top: 60, bottom: -60, near: 10, far: 220 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);

  // ── ground outside the stadium ──
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ color: 0x9a7058, roughness: 1 }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.05;
  outer.receiveShadow = true;
  scene.add(outer);

  // ── pitch: the flat floor and the two goal mouths ──
  // Lambert (no specular) keeps the floor dark at low camera angles; the glow comes from the emissive layer
  const { map, glow: glowMap } = pitchTextures();
  const grass = new THREE.MeshLambertMaterial({ map, color: 0xffffff, emissiveMap: glowMap, emissive: 0xffffff, emissiveIntensity: 0.55 });
  scene.add(floorPatch(-flatX, flatX, -flatZ, flatZ, grass));
  for (const s of [-1, 1]) {
    const a = s * flatX, b = s * (halfX + goalDepth);
    scene.add(floorPatch(Math.min(a, b), Math.max(a, b), -goalHalfW, goalHalfW, grass));
  }

  // ── the shell: ramps, walls, curved edges and the ceiling ──
  const shellGeo = shellGeometry();
  const glass = new THREE.Mesh(shellGeo, new THREE.MeshLambertMaterial({
    vertexColors: true, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false,
  }));
  glass.renderOrder = 1;
  scene.add(glass);
  const hexes = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({
    map: hexTexture(), vertexColors: true, transparent: true, opacity: 0.32, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  hexes.renderOrder = 2;
  scene.add(hexes);
  // cheeks either side of each goal mouth
  const cheek = cheekGeometry();
  const cheekMat = (hex) => new THREE.MeshLambertMaterial({ color: hex, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const m = new THREE.Mesh(cheek, cheekMat(s < 0 ? 0x3d86ff : 0xff8a2e));
    m.scale.x = s;
    m.position.z = t * goalHalfW;
    m.renderOrder = 1;
    scene.add(m);
  }
  // glowing team-colour trim where the grass meets the ramps
  const trim = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  for (const [x0, x1, hex] of [[-flatX, 0, TEAM.blue], [0, flatX, TEAM.orange]]) for (const t of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.08, 0.3), trim(hex));
    m.position.set((x0 + x1) / 2, 0.04, t * flatZ);
    scene.add(m);
  }
  for (const s of [-1, 1]) for (const [z0, z1] of [[-flatZ, -goalHalfW], [goalHalfW, flatZ]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, z1 - z0), trim(s < 0 ? TEAM.blue : TEAM.orange));
    m.position.set(s * flatX, 0.04, (z0 + z1) / 2);
    scene.add(m);
  }
  // stadium light rigs above the glass ceiling
  const rig = new THREE.MeshBasicMaterial({ color: 0xfdfcf2 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.6, metalness: 0.6 });
  for (const z of [-flatZ + 4, flatZ - 4]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(flatX * 2 - 10, 0.6, 1.6), frame);
    bar.position.set(0, height + 1.2, z);
    scene.add(bar);
    for (let x = -flatX + 10; x <= flatX - 10; x += 8) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 1.2), rig);
      l.position.set(x, height + 0.85, z);
      scene.add(l);
    }
  }
  // ribs over the ceiling so it reads as a closed roof
  for (let x = -halfX + 10; x <= halfX - 10; x += 20) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, halfZ * 2 + 2), frame);
    rib.position.set(x, height + 0.3, 0);
    scene.add(rib);
  }

  // ── goals ──
  const goals = [];
  for (const s of [-1, 1]) {
    const color = s < 0 ? TEAM.blue : TEAM.orange;
    const css = s < 0 ? '#7fb3ff' : '#ffb27a';
    const g = new THREE.Group();
    const frame = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 1.6, roughness: 0.3 });
    const post = (x, z) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(postR, postR, goalH, 16), frame);
      m.position.set(x, goalH / 2, z);
      m.castShadow = true;
      g.add(m);
    };
    post(s * halfX, -goalHalfW); post(s * halfX, goalHalfW);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(postR, postR, goalHalfW * 2 + postR * 2, 16), frame);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(s * halfX, goalH, 0);
    g.add(bar);
    // back frame
    const thin = new THREE.MeshStandardMaterial({ color: 0xcfd6e6, roughness: 0.4, metalness: 0.6 });
    const bx = s * (halfX + goalDepth);
    for (const z of [-goalHalfW, goalHalfW]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, goalH, 8), thin);
      m.position.set(bx, goalH / 2, z);
      g.add(m);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, goalDepth, 8), thin);
      top.rotation.z = Math.PI / 2;
      top.position.set(s * (halfX + goalDepth / 2), goalH, z);
      g.add(top);
    }
    // nets
    const netMat = (rx, ry) => {
      const t = netTexture(css);
      t.repeat.set(rx, ry);
      return new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.85 });
    };
    const back = new THREE.Mesh(new THREE.PlaneGeometry(goalHalfW * 2, goalH), netMat(5, 2));
    back.rotation.y = Math.PI / 2;
    back.position.set(bx, goalH / 2, 0);
    g.add(back);
    for (const z of [-goalHalfW, goalHalfW]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(goalDepth, goalH), netMat(2, 2));
      side.position.set(s * (halfX + goalDepth / 2), goalH / 2, z);
      g.add(side);
    }
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(goalDepth, goalHalfW * 2), netMat(2, 5));
    roof.rotation.x = -Math.PI / 2;
    roof.position.set(s * (halfX + goalDepth / 2), goalH, 0);
    g.add(roof);
    // glowing floor inside the goal
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(goalDepth, goalHalfW * 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(s * (halfX + goalDepth / 2), 0.02, 0);
    g.add(floor);
    // goal-line glow strip
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.5, goalHalfW * 2), new THREE.MeshBasicMaterial({ color }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(s * halfX, 0.03, 0);
    g.add(line);
    scene.add(g);
    goals.push({ side: s, group: g, frame });
  }

  // ── small stands with a crowd ──
  const standMat = new THREE.MeshStandardMaterial({ color: 0x3a3f5c, roughness: 0.9 });
  const crowdPalette = [0x2f7bff, 0xff7a1a, 0xe9ecf5, 0x6d5dfc, 0x16213f, 0x2bd4ff, 0xffc93c, 0x384066];
  const seats = [];
  const tiers = 10, step = 2.2, rise = 1.55;
  // gap = [from, to] along the stand, left open for the lowest `gapTiers` tiers (the dugout)
  // gaps = list of [from, to] along the stand, left open for the lowest `gapTiers` tiers
  const addStand = (len, alongX, sign, base, gaps = [], gapTiers = 0) => {
    for (let i = 0; i < tiers; i++) {
      const off = base + 1.2 + i * step;
      const h = 1 + i * rise;
      let spans = [[-len / 2, len / 2]];
      if (gaps.length && i < gapTiers) {
        spans = [];
        let from = -len / 2;
        for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) { spans.push([from, a]); from = b; }
        spans.push([from, len / 2]);
      }
      for (const [a, b] of spans) {
        const L = b - a, mid = (a + b) / 2;
        const m = alongX
          ? new THREE.Mesh(new THREE.BoxGeometry(L, h, step), standMat)
          : new THREE.Mesh(new THREE.BoxGeometry(step, h, L), standMat);
        if (alongX) m.position.set(mid, h / 2, sign * off); else m.position.set(sign * off, h / 2, mid);
        m.receiveShadow = true;
        scene.add(m);
        for (let p = a + 0.8; p < b - 0.6; p += 1.05) {
          if (Math.random() < 0.12) continue;
          seats.push(alongX ? [p, h, sign * off] : [sign * off, h, p]);
        }
      }
    }
  };
  const longLen = (halfX - 4) * 2;
  addStand(longLen, true, -1, halfZ + 1, [[DUGOUT.x - DUGOUT.halfW - 1, DUGOUT.x + DUGOUT.halfW + 1]], 2);
  addStand(longLen, true, 1, halfZ + 1);
  addStand(halfZ * 2 - 4, false, -1, halfX + goalDepth + 2);
  addStand(halfZ * 2 - 4, false, 1, halfX + goalDepth + 2);

  const crowd = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.55, 0.9, 0.45),
    new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    seats.length,
  );
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  seats.forEach(([x, y, z], i) => {
    m4.makeTranslation(x + (Math.random() - 0.5) * 0.2, y + 0.45, z + (Math.random() - 0.5) * 0.3);
    crowd.setMatrixAt(i, m4);
    const base = x < -2 ? 0 : x > 2 ? 1 : Math.floor(Math.random() * 2);
    col.setHex(Math.random() < 0.55 ? crowdPalette[base] : crowdPalette[2 + Math.floor(Math.random() * 6)]);
    crowd.setColorAt(i, col);
  });
  scene.add(crowd);


  // ── the dome over the whole stadium: glass shell, steel ribs, neon rings, roof lamps ──
  buildDome(scene);

  return { goals };
}

// Lattice for the dome glass: thin bright lines on transparent, tiled over the shell.
function latticeTexture() {
  const t = canvasTex(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(170, 215, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.globalAlpha = 0.45;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.stroke();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(56, 10);
  t.anisotropy = 8;
  return t;
}

function buildDome(scene) {
  const { ax, ay, az } = DOME;
  const at = (theta, phi) => new THREE.Vector3(ax * Math.cos(theta) * Math.cos(phi), ay * Math.sin(theta), az * Math.cos(theta) * Math.sin(phi));
  const half = new THREE.SphereGeometry(1, 112, 36, 0, Math.PI * 2, 0, Math.PI / 2);

  // tinted glass, seen from inside: very faint so the night sky still shows through
  const shell = new THREE.Mesh(half, new THREE.MeshBasicMaterial({
    color: 0x2a4a9a, transparent: true, opacity: 0.16, side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  shell.scale.set(ax, ay, az);
  shell.renderOrder = -1;
  scene.add(shell);
  // the panel lattice etched into the glass
  const lattice = new THREE.Mesh(half, new THREE.MeshBasicMaterial({
    map: latticeTexture(), color: 0x5f8fe0, transparent: true, opacity: 0.32, side: THREE.BackSide,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  lattice.scale.set(ax * 0.998, ay * 0.998, az * 0.998);
  scene.add(lattice);

  // steel ribs from the ground ring up to the crown
  const steel = new THREE.MeshStandardMaterial({ color: 0x2b3360, roughness: 0.45, metalness: 0.8, emissive: 0x0a1030, emissiveIntensity: 0.6 });
  const RIBS = 24, CROWN = 1.43; // ribs stop at the crown ring instead of all meeting in one point
  for (let i = 0; i < RIBS; i++) {
    const phi = (i / RIBS) * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 24; k++) pts.push(at((k / 24) * CROWN, phi));
    const rib = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, i % 2 ? 0.35 : 0.6, 6), steel);
    scene.add(rib);
  }
  // horizontal rings; two of them glow in the team colours, the crown is white
  const ring = (theta, r, mat) => {
    const pts = [];
    for (let k = 0; k < 96; k++) pts.push(at(theta * 0.999, (k / 96) * Math.PI * 2));
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 192, r, 6, true), mat);
    scene.add(m);
  };
  ring(0.02, 0.9, steel);
  ring(0.36, 0.45, steel);
  ring(0.72, 0.45, steel);
  ring(1.08, 0.4, steel);
  ring(0.54, 0.22, new THREE.MeshBasicMaterial({ color: 0x5aa0ff }));
  ring(0.9, 0.22, new THREE.MeshBasicMaterial({ color: 0xff8a3a }));
  ring(CROWN, 0.7, new THREE.MeshBasicMaterial({ color: 0xdff4ff }));
  // crown: a closed glowing disc at the very top
  const cap = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, fog: false }),
  );
  cap.rotation.x = Math.PI / 2;
  cap.scale.set(ax * Math.cos(CROWN), az * Math.cos(CROWN), 1);
  cap.position.y = ay * Math.sin(CROWN) - 0.2;
  scene.add(cap);

  // stadium lamps hung from the roof, aimed at the centre spot
  const housing = new THREE.MeshStandardMaterial({ color: 0x3b4262, roughness: 0.6, metalness: 0.5 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xf4f8ff });
  for (let i = 0; i < 8; i++) {
    const phi = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const head = new THREE.Group();
    head.position.copy(at(0.62, phi)).multiplyScalar(0.96);
    head.lookAt(0, 0, 0);
    head.add(new THREE.Mesh(new THREE.BoxGeometry(7, 4, 0.4), housing));
    for (let a = -1; a <= 1; a++) for (let b = -0.5; b <= 0.5; b++) {
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16), lamp);
      l.position.set(a * 2.1, b * 1.8, 0.21);
      head.add(l);
    }
    scene.add(head);
  }
}
