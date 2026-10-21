// ─────────────────────────────────────────────────────────────
//  Particles: boost trails, supersonic streaks, demolitions and the goal explosion.
//  Additive points; a particle fades by darkening its colour.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

class Pool {
  constructor(scene, count, size, tex) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.base = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.max = new Float32Array(count);
    this.grav = new Float32Array(count);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size, map: tex, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, color, life, grav = 0) {
    const i = this.next; this.next = (this.next + 1) % this.count;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.base.set([color.r, color.g, color.b], i * 3);
    this.life[i] = this.max[i] = life;
    this.grav[i] = grav;
  }
  update(dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) { this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      const drag = 1 - 1.6 * dt;
      for (let a = 0; a < 3; a++) {
        this.vel[i * 3 + a] *= drag;
        this.pos[i * 3 + a] += this.vel[i * 3 + a] * dt;
        this.col[i * 3 + a] = this.base[i * 3 + a] * k;
      }
      if (this.pos[i * 3 + 1] < 0.05) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] *= -0.4; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

export class FX {
  constructor(scene) {
    const tex = dotTexture();
    this.trail = new Pool(scene, 500, 0.9, tex);
    this.burst = new Pool(scene, 900, 1.3, tex);
    this.c1 = new THREE.Color(0xffb347);
    this.c2 = new THREE.Color(0xff5a1f);
    this.b1 = new THREE.Color(0x9fd4ff);
    this.b2 = new THREE.Color(0x2f7bff);
    this.white = new THREE.Color(0xdfe8ff);
    this.acc = 0;
  }

  // boost flames out of the exhausts: blue/white for the blue team, orange/yellow for orange
  boost(carGroup, dt, team = 'orange') {
    this.acc += dt * 160;
    const back = new THREE.Vector3(), aft = new THREE.Vector3();
    aft.set(0, 0, -1).transformDirection(carGroup.matrixWorld);
    const [ca, cb] = team === 'blue' ? [this.b1, this.b2] : [this.c1, this.c2];
    while (this.acc >= 1) {
      this.acc -= 1;
      for (const s of [-1, 1]) {
        back.set(s * 0.38, 0.95, -3.0).applyMatrix4(carGroup.matrixWorld);
        const sp = 6 + Math.random() * 6;
        this.trail.emit(
          back.x, back.y, back.z,
          aft.x * sp + (Math.random() - 0.5) * 2, aft.y * sp + (Math.random() - 0.2) * 1.5, aft.z * sp + (Math.random() - 0.5) * 2,
          Math.random() < 0.5 ? ca : cb, 0.35 + Math.random() * 0.25,
        );
      }
    }
  }

  // supersonic: thin white streaks off the wheels
  sonic(carGroup, dt) {
    this.sacc = (this.sacc || 0) + dt * 90;
    const p = new THREE.Vector3();
    while (this.sacc >= 1) {
      this.sacc -= 1;
      for (const [x, z] of [[1.1, -1.3], [-1.1, -1.3]]) {
        p.set(x, 0.35, z).applyMatrix4(carGroup.matrixWorld);
        this.trail.emit(p.x, p.y, p.z, 0, 0.2, 0, this.white, 0.28);
      }
    }
  }

  // demolition: a fireball in the car's colour plus sparks
  demo(pos, hex) {
    const base = new THREE.Color(hex), fire = new THREE.Color(0xffb347);
    for (let i = 0; i < 420; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const sp = 6 + Math.random() * 18;
      this.burst.emit(pos.x, pos.y + 1, pos.z, s * Math.cos(a) * sp, Math.abs(u) * sp + 3, s * Math.sin(a) * sp,
        Math.random() < 0.5 ? base : fire, 0.6 + Math.random() * 0.8, 12);
    }
  }

  goal(pos, hex) {
    const base = new THREE.Color(hex), white = new THREE.Color(0xffffff);
    for (let i = 0; i < 700; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const sp = 12 + Math.random() * 30;
      this.burst.emit(pos.x, pos.y, pos.z, s * Math.cos(a) * sp, Math.abs(u) * sp * 0.9 + 4, s * Math.sin(a) * sp,
        Math.random() < 0.8 ? base : white, 1.2 + Math.random() * 1.2, 14);
    }
  }

  update(dt) {
    this.trail.update(dt);
    this.burst.update(dt);
  }
}
