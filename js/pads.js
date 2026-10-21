// ─────────────────────────────────────────────────────────────
//  Boost pads, Rocket League style.
//  Big pads (a floating orange orb) fill you to 100 and come back in 10 s;
//  small pads (a flat disc) give 12 and come back in 4 s.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { FIELD } from './arena.js';

const BIG = { amount: 100, respawn: 10, radius: 2.6 };
const SMALL = { amount: 12, respawn: 4, radius: 1.6 };

// layout: big pads in a wide ring, small pads on a grid, both kept clear of podiums,
// kickoff spots and the academy area
export function padLayout(podiums, keepClear = []) {
  const big = [[-40, -16], [-40, 16], [40, -16], [40, 16], [0, -18], [0, 18]];
  const small = [];
  for (let x = -48; x <= 48; x += 8) for (let z = -24; z <= 24; z += 8) {
    if ((Math.round(x / 8) + Math.round(z / 8)) % 2) continue; // checkerboard, like RL's diamond pattern
    small.push([x, z]);
  }
  const clear = [...podiums.map((p) => [p.x, p.z, 6]), ...keepClear, [0, 0, 3]];
  const ok = ([x, z]) => Math.abs(x) < FIELD.flatX - 2 && Math.abs(z) < FIELD.flatZ - 2 &&
    clear.every(([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r) && big.every(([bx, bz]) => Math.hypot(x - bx, z - bz) > 6);
  return { big: big.filter(([x, z]) => clear.every(([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r)), small: small.filter(ok) };
}

export class Pads {
  constructor(scene, layout, { onPickup } = {}) {
    this.onPickup = onPickup || (() => {});
    this.list = [];
    const orange = new THREE.Color(0xffa31a);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5, metalness: 0.6 });
    const ringOn = new THREE.MeshBasicMaterial({ color: orange });
    const ringOff = new THREE.MeshBasicMaterial({ color: 0x5a4a30 });
    const orbMat = new THREE.MeshStandardMaterial({ color: 0xffc04d, emissive: 0xff9a1a, emissiveIntensity: 2.2, roughness: 0.3 });
    const discOn = new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.95 });
    const discOff = new THREE.MeshBasicMaterial({ color: 0x5a4a30, transparent: true, opacity: 0.7 });
    for (const [x, z] of layout.big) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.4, 0.3, 6), baseMat);
      base.position.y = 0.15; base.receiveShadow = true;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.12, 8, 6), ringOn);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.32;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 16), orbMat);
      orb.position.y = 1.6;
      const light = new THREE.PointLight(0xff9a1a, 6, 9, 2);
      light.position.y = 1.6;
      g.add(base, ring, orb, light);
      scene.add(g);
      this.list.push({ x, z, ...BIG, big: true, t: 0, g, orb, ring, light, ringOn, ringOff });
    }
    const discGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.12, 20);
    for (const [x, z] of layout.small) {
      const d = new THREE.Mesh(discGeo, discOn);
      d.position.set(x, 0.07, z);
      scene.add(d);
      this.list.push({ x, z, ...SMALL, big: false, t: 0, d, discOn, discOff });
    }
  }

  reset() { for (const p of this.list) { p.t = 0; this.show(p, true); } }

  show(p, on) {
    if (p.big) { p.orb.visible = on; p.light.visible = on; p.ring.material = on ? p.ringOn : p.ringOff; }
    else p.d.material = on ? p.discOn : p.discOff;
  }

  // physics step: pick up pads under cars that are on the floor (or just above it)
  step(h, cars) {
    for (const p of this.list) {
      if (p.t > 0) { p.t -= h; if (p.t <= 0) this.show(p, true); continue; }
      for (const c of cars) {
        if (c.demoT > 0 || c.pos.y > 2.5 || c.boost >= 100) continue;
        if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) > p.radius) continue;
        c.boost = Math.min(100, c.boost + p.amount);
        p.t = p.respawn;
        this.show(p, false);
        this.onPickup(c, p.big);
        break;
      }
    }
  }

  // visuals: orbs bob and spin
  update(t) {
    for (const p of this.list) if (p.big && p.orb.visible) {
      p.orb.position.y = 1.6 + Math.sin(t * 2.2 + p.x) * 0.18;
      p.ring.rotation.z = t * 0.8;
    }
  }
}
