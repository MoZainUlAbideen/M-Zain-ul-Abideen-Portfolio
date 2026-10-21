// ─────────────────────────────────────────────────────────────
//  "BEYOND": a replica of Zain's translucent-purple Mini 4WD.
//  Built from simple shapes so there's no model file to load.
//  Car faces +z. Ground is y = 0. Length ≈ 5, width ≈ 3.2 (with rollers).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeStatic } from './merge.js';

export const CAR_DIMS = {
  wheelR: 0.5,
  frontAxle: 1.3,
  rearAxle: -1.3,
  track: 1.05,
  // collision box (half sizes) and its centre height
  half: new THREE.Vector3(1.35, 0.72, 2.45),
  centerY: 0.95,
};

// Side profile (z, y) → extruded across the car's width
function sideExtrude(profile, width, bevel = 0.05) {
  const shape = new THREE.Shape();
  profile.forEach(([z, y], i) => (i ? shape.lineTo(z, y) : shape.moveTo(z, y)));
  shape.closePath();
  const depth = Math.max(0.01, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4,
  });
  g.rotateY(-Math.PI / 2); // shape x → +z (forward), extrusion → -x
  g.translate(depth / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// White tribal flames; tips point to the right of the canvas (= rear of the car)
function flameTexture() {
  return canvasTex(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f4f2ff';
    const tongue = (y0, len, amp, thick) => {
      ctx.beginPath();
      ctx.moveTo(40, y0 - thick);
      ctx.bezierCurveTo(40 + len * 0.35, y0 - thick - amp, 40 + len * 0.6, y0 + amp * 0.6, 40 + len, y0 - amp * 0.9);
      ctx.bezierCurveTo(40 + len * 0.7, y0 + amp * 0.2, 40 + len * 0.45, y0 + thick + amp * 0.3, 40, y0 + thick);
      ctx.quadraticCurveTo(20, y0, 40, y0 - thick);
      ctx.fill();
    };
    tongue(128, 440, 34, 30);
    tongue(80, 330, 26, 18);
    tongue(176, 360, 22, 18);
    tongue(44, 210, 18, 11);
    tongue(212, 230, 16, 11);
    // cut-outs give the "tribal" look
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#000';
    for (const [y, l] of [[104, 300], [152, 320], [128, 120]]) {
      ctx.beginPath();
      ctx.moveTo(90, y);
      ctx.bezierCurveTo(90 + l * 0.4, y - 16, 90 + l * 0.7, y + 12, 90 + l, y - 10);
      ctx.stroke();
    }
  });
}

function beyondTexture(bg) {
  return canvasTex(512, 128, (ctx, w, h) => {
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
    ctx.font = 'italic 900 92px "Chakra Petch", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(20,10,70,.9)';
    ctx.strokeText('BEYOND', w / 2, h / 2 + 4);
    ctx.fillStyle = '#f7f6ff';
    ctx.fillText('BEYOND', w / 2, h / 2 + 4);
  });
}

// The default look is Zain's car. Pass a `paint` to make another one (the red bot).
const ZAIN_PAINT = { body: 0x0f0d66, bodyGlow: 0x06052e, canopy: 0x0e6474, canopyGlow: 0x053a46, rim: 0xff5230, rimGlow: 0x3a0800, helmet: 0xff6a1f, glow: 0x3346ff };
export const RED_PAINT = { body: 0x8c0a14, bodyGlow: 0x3a0207, canopy: 0x3a1418, canopyGlow: 0x220508, rim: 0xe9edf5, rimGlow: 0x222222, helmet: 0x1d1f26, glow: 0xff2a2a };

export function buildCar(paint = ZAIN_PAINT) {
  const car = new THREE.Group();
  car.name = 'car';

  // ── materials ──
  const body = new THREE.MeshPhysicalMaterial({
    color: paint.body, emissive: paint.bodyGlow, emissiveIntensity: 0.3, // deep royal blue, like the real toy
    roughness: 0.25, metalness: 0.05, clearcoat: 0.35, clearcoatRoughness: 0.2,
    envMapIntensity: 0.25, // less mirror-like sheen, so the deep blue reads like the real plastic
    transparent: true, opacity: 0.9,
  });
  // dark tinted glass you can see the driver through
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: paint.canopy, emissive: paint.canopyGlow, emissiveIntensity: 0.55,
    roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.9,
    transparent: true, opacity: 0.58, depthWrite: false, side: THREE.DoubleSide,
  });
  const grey = new THREE.MeshStandardMaterial({ color: 0x6d7079, roughness: 0.55, metalness: 0.3 });
  const darkGrey = new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.6, metalness: 0.3 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd4d8e0, roughness: 0.25, metalness: 0.85 });
  const rollerRing = new THREE.MeshStandardMaterial({ color: 0x8a8e98, roughness: 0.35, metalness: 0.8 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x151518, roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: paint.rim, roughness: 0.4, metalness: 0.1, emissive: paint.rimGlow, emissiveIntensity: 0.4 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f0ff, roughness: 0.4 });
  const flameMat = new THREE.MeshStandardMaterial({
    map: flameTexture(), transparent: true, alphaTest: 0.35, roughness: 0.4,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2,
  });

  const add = (geo, mat, x = 0, y = 0, z = 0, parent = car) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  // ── chassis (grey under-tray + bumpers) ──
  add(new THREE.BoxGeometry(1.9, 0.14, 4.3), darkGrey, 0, 0.36, 0);
  // front bumper bar, wider than the body, rollers at both ends
  add(new THREE.BoxGeometry(3.05, 0.12, 0.3), grey, 0, 0.4, 2.45);
  add(new THREE.BoxGeometry(0.5, 0.1, 0.6), grey, 0, 0.4, 2.2);
  // rear bumper plate (the grey bar visible from behind)
  add(new THREE.BoxGeometry(1.7, 0.34, 0.16), grey, 0, 0.62, -2.18);
  // rear roller stays
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.5, 0.08, 0.26), grey, s * 1.28, 0.44, -0.55);

  // ── body: central tub ──
  add(sideExtrude([
    [-2.1, 0.45], [2.2, 0.45], [2.32, 0.62], [1.25, 0.96], [0.55, 1.12],
    [-0.9, 1.2], [-1.8, 1.32], [-2.12, 1.28],
  ], 1.42), body);

  // lower side skirts between the wheels
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.46, 0.6, 1.5), body, s * 0.95, 0.74, 0);

  // front fenders: the swept wings with flames, arching over the front wheels
  const fenderProfile = [
    [0.25, 1.08], [1.9, 1.04], [2.42, 0.7], [2.48, 0.86], [1.8, 1.32], [0.9, 1.46], [0.25, 1.36],
  ];
  for (const s of [-1, 1]) add(sideExtrude(fenderProfile, 0.58), body, s * 1.05, 0, 0);

  // rear pods over the rear wheels
  const podProfile = [[-2.15, 1.05], [-0.72, 1.05], [-0.5, 1.28], [-0.95, 1.62], [-2.15, 1.62]];
  for (const s of [-1, 1]) add(sideExtrude(podProfile, 0.58), body, s * 1.05, 0, 0);

  // rear block between the pods (under the wing)
  add(new THREE.BoxGeometry(1.2, 0.55, 0.5), body, 0, 1.1, -1.88);

  // white chevrons on the nose (follow the nose slope)
  const noseSlope = Math.atan((0.96 - 0.62) / (2.32 - 1.25));
  for (const [z, y] of [[1.52, 0.9], [1.86, 0.79]]) {
    const m = add(new THREE.BoxGeometry(1.2, 0.03, 0.09), white, 0, y, z);
    m.rotation.x = noseSlope;
  }

  // ── canopy: a long teardrop that widens and slopes down toward the front-wheel fenders ──
  const canopyGeo = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const cp = canopyGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i);
    const f = Math.max(0, z);                        // 0 at the back half, 1 at the very front
    cp.setXYZ(i,
      x * (0.7 + 0.28 * f),                          // wider toward the fenders
      y * 0.62 * (1 - 0.5 * f) - 0.26 * f,           // lower and sloping at the front
      z * 1.55);                                      // longer
  }
  canopyGeo.computeVertexNormals();
  const canopy = add(canopyGeo, canopyMat, 0, 1.04, 0.3);
  canopy.castShadow = false;
  canopy.renderOrder = 2;

  // a little driver sitting inside (visible through the tinted glass)
  const driver = new THREE.Group();
  driver.position.set(0, 1.02, -0.15);
  const suit = new THREE.MeshStandardMaterial({ color: 0xf2f2f5, roughness: 0.6 });
  const helmet = new THREE.MeshStandardMaterial({ color: paint.helmet, roughness: 0.35, metalness: 0.2 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x0a0d18, roughness: 0.1, metalness: 0.6 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.18, 4, 10), suit);
  torso.position.y = 0.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), helmet);
  head.position.y = 0.55;
  const shield = new THREE.Mesh(new THREE.SphereGeometry(0.175, 20, 10, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.32, Math.PI * 0.26), visor);
  shield.position.y = 0.55;
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.172, 0.02, 6, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  stripe.position.y = 0.55;
  stripe.rotation.set(0, Math.PI / 2, Math.PI / 2);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.22, 3, 6), suit);
    arm.position.set(s * 0.17, 0.22, 0.14);
    arm.rotation.x = -1.1;
    driver.add(arm);
  }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 16), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  wheel.position.set(0, 0.3, 0.32);
  wheel.rotation.x = -0.5;
  driver.add(torso, head, shield, stripe, wheel);
  car.add(driver);

  // ── rear wing ──
  const wing = new THREE.Group();
  wing.position.set(0, 0, -1.95);
  car.add(wing);
  for (const s of [-1, 1]) {
    const up = add(new THREE.BoxGeometry(0.1, 0.62, 0.28), body, s * 0.52, 1.6, 0, wing);
    up.rotation.x = -0.15;
  }
  const blade = add(new THREE.BoxGeometry(2.5, 0.08, 0.62), body, 0, 1.92, -0.05, wing);
  blade.rotation.x = -0.08;
  // endplates with BEYOND on the outer face (the side view)
  const sideText = new THREE.MeshBasicMaterial({ map: beyondTexture(), transparent: true, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.06, 0.5, 0.78), body, s * 1.25, 1.8, -0.05, wing);
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.18), sideText);
    t.position.set(s * 1.29, 1.82, -0.05);
    t.rotation.y = s * Math.PI / 2;
    if (s < 0) t.scale.x = -1; // keep the text readable on both sides
    wing.add(t);
  }
  // BEYOND on top of the wing, readable from the front (just like the real one)
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.46),
    new THREE.MeshBasicMaterial({ map: beyondTexture(), transparent: true }),
  );
  top.rotation.x = -Math.PI / 2 - 0.08;
  top.position.set(0, 1.97, -0.05);
  wing.add(top);
  // the little knob on the wing mount
  add(new THREE.SphereGeometry(0.13, 16, 12), body, 0, 1.52, -1.5);

  // ── flames ──
  const decal = (w, h, x, y, z, rotY, flip) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), flameMat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    if (flip) m.scale.x = -1;
    car.add(m);
  };
  for (const s of [-1, 1]) {
    // outer side of the rear pods
    decal(1.25, 0.5, s * 1.345, 1.33, -1.35, s * Math.PI / 2, s < 0);
    // outer side of the front fenders
    decal(1.5, 0.3, s * 1.345, 1.22, 1.05, s * Math.PI / 2, s < 0);
    // top of the front fenders (the big ones seen from the front)
    const g = new THREE.PlaneGeometry(1.25, 0.46);
    g.rotateX(-Math.PI / 2);
    g.rotateY(Math.PI / 2); // tips point to the rear
    const m = new THREE.Mesh(g, flameMat);
    m.position.set(s * 1.05, 1.415, 1.28);
    m.rotation.x = Math.atan((1.46 - 1.32) / 0.9);
    car.add(m);
    // small flame on the rear pod top
    const g2 = new THREE.PlaneGeometry(0.8, 0.36);
    g2.rotateX(-Math.PI / 2);
    g2.rotateY(Math.PI / 2);
    const m2 = new THREE.Mesh(g2, flameMat);
    m2.position.set(s * 1.05, 1.64, -1.5);
    car.add(m2);
  }

  // ── rollers (silver discs, spin around a vertical axis) ──
  const roller = (x, y, z) => {
    const r = new THREE.Group();
    r.userData.dynamic = true; // spins
    r.position.set(x, y, z);
    add(new THREE.CylinderGeometry(0.25, 0.25, 0.16, 24), silver, 0, 0, 0, r);
    add(new THREE.TorusGeometry(0.25, 0.035, 8, 24), rollerRing, 0, 0.0, 0, r).rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(0.1, 12, 8), silver, 0, 0.09, 0, r);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(new THREE.SphereGeometry(0.035, 8, 6), darkGrey, Math.cos(a) * 0.16, 0.08, Math.sin(a) * 0.16, r);
    }
    car.add(r);
    return r;
  };
  const rollers = [
    roller(1.52, 0.42, 2.45), roller(-1.52, 0.42, 2.45),
    roller(1.52, 0.44, -0.55), roller(-1.52, 0.44, -0.55),
  ];

  // ── wheels ──
  const { wheelR, frontAxle, rearAxle, track } = CAR_DIMS;
  const wheels = [];
  const makeWheel = (side, z, front) => {
    const pivot = new THREE.Group(); // steers (y)
    pivot.position.set(side * track, wheelR, z);
    const spin = new THREE.Group();   // rolls (x)
    pivot.add(spin);
    pivot.userData.dynamic = spin.userData.dynamic = true; // steers / rolls
    const t = add(new THREE.CylinderGeometry(wheelR, wheelR, 0.42, 36), tyre, 0, 0, 0, spin);
    t.rotation.z = Math.PI / 2;
    // tread grooves
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const g = add(new THREE.BoxGeometry(0.38, 0.03, 0.05), darkGrey, 0, Math.cos(a) * (wheelR + 0.005), Math.sin(a) * (wheelR + 0.005), spin);
      g.rotation.x = a;
    }
    // red 10-spoke rim on the outer face
    const face = side * 0.2;
    const rim = add(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 32), rimMat, face, 0, 0, spin);
    rim.rotation.z = Math.PI / 2;
    const dark = add(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 32), new THREE.MeshStandardMaterial({ color: 0x3a0c06, roughness: 0.8 }), face + side * 0.031, 0, 0, spin);
    dark.rotation.z = Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const sp = add(new THREE.BoxGeometry(0.04, 0.27, 0.06), rimMat, face + side * 0.045, Math.cos(a) * 0.15, Math.sin(a) * 0.15, spin);
      sp.rotation.x = a + 0.25;
    }
    const hub = add(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16), rimMat, face + side * 0.05, 0, 0, spin);
    hub.rotation.z = Math.PI / 2;
    car.add(pivot);
    wheels.push({ pivot, spin, front });
  };
  for (const s of [-1, 1]) {
    makeWheel(s, frontAxle, true);
    makeWheel(s, rearAxle, false);
  }

  // ── boost flames (hidden until boosting) ──
  const boostMat = new THREE.MeshBasicMaterial({
    color: 0xff9a3c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const boostCore = new THREE.MeshBasicMaterial({
    color: 0xfff1b0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const flames = new THREE.Group();
  flames.position.set(0, 0.95, -2.3);
  for (const s of [-1, 1]) {
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.4, 16, 1, true), boostMat);
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(s * 0.38, 0, -0.65);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.8, 12, 1, true), boostCore);
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(s * 0.38, 0, -0.4);
    flames.add(outer, inner);
  }
  flames.visible = false;
  flames.userData.dynamic = true;
  car.add(flames);

  // soft under-glow so the car pops at night
  const glow = new THREE.PointLight(paint.glow, 3, 7, 2);
  glow.position.set(0, 0.4, 0);
  car.add(glow);

  mergeStatic(car); // ~200 parts → a handful of draw calls
  return { group: car, wheels, rollers, flames };
}
