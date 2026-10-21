// ─────────────────────────────────────────────────────────────
//  The dugout behind the top touchline: benches, a few seated
//  players, and the floating "My Academy" emblem above it.
//  Drive into the glowing technical area in front and press E.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeStatic } from './merge.js';
import { FIELD, DUGOUT } from './arena.js';

export const ACADEMY_COLOR = '#38f2c7';

function titleTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.font = '900 132px "Orbitron", "Chakra Petch", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = 34;
  ctx.fillStyle = color;
  ctx.fillText(text, 512, 132, 980);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(4,8,30,.85)';
  ctx.strokeText(text, 512, 132, 980);
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.92;
  ctx.fillText(text, 512, 132, 980);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Emblem: a hexagonal badge holding a small neural network, crowned by a graduation cap
function buildEmblem(color) {
  const g = new THREE.Group();
  const glow = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.3 });
  const dim = new THREE.MeshStandardMaterial({ color: 0x0d1633, roughness: 0.4, metalness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 });

  // badge: dark hex plate + glowing hex rim
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.3, 6), dim);
  plate.rotation.x = Math.PI / 2;
  g.add(plate);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.14, 8, 6), glow);
  rim.rotation.z = Math.PI / 6;
  g.add(rim);

  // neural network: 3 → 4 → 2 nodes, joined by thin bars
  const layers = [
    [[-1.2, 0.8], [-1.2, 0], [-1.2, -0.8]],
    [[0, 1.05], [0, 0.35], [0, -0.35], [0, -1.05]],
    [[1.2, 0.45], [1.2, -0.45]],
  ];
  const nodeGeo = new THREE.SphereGeometry(0.17, 16, 12);
  const link = (a, b) => {
    const [x1, y1] = a, [x2, y2] = b;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 6), glow);
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2 - 0.25, 0.2);
    m.rotation.z = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
    g.add(m);
  };
  for (let l = 0; l < layers.length - 1; l++) for (const a of layers[l]) for (const b of layers[l + 1]) link(a, b);
  for (const layer of layers) for (const [x, y] of layer) {
    const n = new THREE.Mesh(nodeGeo, white);
    n.position.set(x, y - 0.25, 0.22);
    g.add(n);
  }

  // graduation cap on top of the badge
  const cap = new THREE.Group();
  cap.position.set(0, 2.35, 0);
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 2.2), glow);
  board.rotation.y = Math.PI / 4;
  board.position.y = 0.45;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.5, 20), dim);
  crown.position.y = 0.15;
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), white);
  button.position.y = 0.55;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), white);
  cord.position.set(0.9, 0.05, 0);
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), white);
  tassel.position.set(0.9, -0.45, 0);
  cap.add(board, crown, button, cord, tassel);
  g.add(cap);
  return g;
}

// A simple seated player: jersey torso, head, thighs forward, shins down
function seatedPlayer(jersey, skin, shorts) {
  const p = new THREE.Group();
  const jm = new THREE.MeshStandardMaterial({ color: jersey, roughness: 0.6 });
  const sm = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const shm = new THREE.MeshStandardMaterial({ color: shorts, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.45, 4, 10), jm);
  torso.position.y = 1.45;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), sm);
  head.position.y = 2.1;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1b1410 }));
  hair.position.y = 2.13;
  p.add(torso, head, hair);
  for (const s of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.62), shm);
    thigh.position.set(s * 0.15, 1.02, 0.28);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.18), sm);
    shin.position.set(s * 0.15, 0.62, 0.56);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.34), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    boot.position.set(s * 0.15, 0.3, 0.64);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.45, 3, 6), jm);
    arm.position.set(s * 0.36, 1.35, 0.12);
    arm.rotation.x = -0.5;
    p.add(thigh, shin, boot, arm);
  }
  p.userData.head = head;
  p.userData.hair = hair;
  p.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return p;
}

export function buildDugout(scene) {
  const { halfZ } = FIELD;
  const { x: cx, halfW, depth, h } = DUGOUT;
  const color = new THREE.Color(ACADEMY_COLOR);
  const z0 = -(halfZ + 0.3);          // front edge (just behind the glass)
  const zc = z0 - depth / 2;          // centre of the dugout
  const d = new THREE.Group();

  const shell = new THREE.MeshStandardMaterial({ color: 0x141b3a, roughness: 0.7, metalness: 0.3 });
  const trim = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1 });
  const roofMat = new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.22, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = true; d.add(m); return m; };

  // floor, back wall, side walls, glass roof + glowing front edge
  add(new THREE.BoxGeometry(halfW * 2, 0.3, depth), shell, cx, 0.15, zc);
  add(new THREE.BoxGeometry(halfW * 2, h, 0.3), shell, cx, h / 2, z0 - depth);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.3, h, depth), shell, cx + s * halfW, h / 2, zc);
  const roof = add(new THREE.BoxGeometry(halfW * 2 + 0.6, 0.12, depth + 0.6), roofMat, cx, h + 0.06, zc);
  roof.rotation.x = -0.06;
  add(new THREE.BoxGeometry(halfW * 2 + 0.6, 0.14, 0.14), trim, cx, h + 0.1, z0 + 0.3);
  add(new THREE.BoxGeometry(halfW * 2, 0.08, 0.08), trim, cx, 0.32, z0 - 0.05);

  // bucket seats along the back wall
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x2c49b8, roughness: 0.5 });
  const seatZ = z0 - depth + 1.0;
  const nSeats = 9;
  const seatX = (i) => cx - halfW + 1.1 + i * ((halfW * 2 - 2.2) / (nSeats - 1));
  for (let i = 0; i < nSeats; i++) {
    add(new THREE.BoxGeometry(1.0, 0.18, 0.9), seatMat, seatX(i), 0.9, seatZ + 0.1);
    add(new THREE.BoxGeometry(1.0, 1.0, 0.14), seatMat, seatX(i), 1.45, seatZ - 0.35);
    add(new THREE.BoxGeometry(0.12, 0.6, 0.12), shell, seatX(i), 0.5, seatZ + 0.1);
  }

  // a few players on the bench
  const players = [];
  const who = [
    [1, 0x2f5bd6, 0xc68a5b, 0x1b2550], [2, 0x6d4bff, 0x8d5a3b, 0x1b2550], [4, 0x2f5bd6, 0xe0ac86, 0x1b2550],
    [6, 0x6d4bff, 0xb97a4e, 0x1b2550], [7, 0x2f5bd6, 0x7a4a2e, 0x1b2550],
  ];
  for (const [i, j, s, sh] of who) {
    const p = seatedPlayer(j, s, sh);
    p.position.set(seatX(i), 0, seatZ + 0.05);
    p.userData.phase = Math.random() * 6;
    d.add(p);
    players.push(p);
  }

  // warm light inside
  const lamp = new THREE.PointLight(0xffe2b0, 10, 12, 2);
  lamp.position.set(cx, h - 0.4, zc);
  d.add(lamp);

  // technical area on the pitch in front of the dugout (glowing dashed box)
  const area = new THREE.Group();
  const w = halfW * 2 + 2, depthA = 5;
  const dashMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
  dashMat.userData.unique = true; // animated, never share it
  const dash = (x, z, lx, lz) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(lx, lz), dashMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.035, z); area.add(m); };
  // on the grass just in front of the ramp (the arena is closed, so the area sits inside the glass)
  const za = -FIELD.flatZ;
  for (let t = -w / 2; t < w / 2; t += 1.4) for (const zz of [za, za + depthA]) dash(cx + t + 0.45, zz, 0.9, 0.22);
  for (const s of [-1, 1]) for (let t = 0; t < depthA; t += 1.4) dash(cx + s * w / 2, za + t + 0.45, 0.22, 0.9);
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, depthA), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, depthWrite: false }));
  fill.rotation.x = -Math.PI / 2;
  fill.position.set(cx, 0.03, za + depthA / 2);
  area.add(fill);
  d.add(area);

  // floating emblem + title above the dugout
  const emblem = buildEmblem(color);
  emblem.position.set(cx, h + 6.6, zc + 0.5);
  emblem.scale.setScalar(0.95);
  emblem.userData.dynamic = true; // floats and turns
  d.add(emblem);
  const title = new THREE.Sprite(new THREE.SpriteMaterial({ map: titleTexture('MY ACADEMY', ACADEMY_COLOR), transparent: true, depthWrite: false }));
  title.scale.set(13, 3.25, 1);
  title.position.set(cx, h + 2.6, zc + 0.5);
  title.renderOrder = 11;
  d.add(title);
  const beamLight = new THREE.PointLight(color, 14, 14, 2);
  beamLight.position.set(cx, h + 5, zc + 2);
  d.add(beamLight);

  mergeStatic(d); // benches, players, roof: one draw call per material
  scene.add(d);

  // where the car has to be to press E (centre of the technical area)
  const spot = {
    x: cx, z: za + depthA / 2,
    data: { id: 'academy', label: 'MY ACADEMY', color: ACADEMY_COLOR },
  };

  function update(t, near) {
    emblem.rotation.y = Math.sin(t * 0.6) * 0.6;
    emblem.position.y = h + 6.6 + Math.sin(t * 1.2) * 0.25;
    dashMat.opacity = 0.55 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3)) + 0.15 * near;
    beamLight.intensity = 10 + 8 * near;
  }
  return { spot, update };
}
