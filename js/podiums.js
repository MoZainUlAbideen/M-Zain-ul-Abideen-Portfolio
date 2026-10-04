// ─────────────────────────────────────────────────────────────
//  Glowing podiums: hex pedestal, light beam, floating icon, label.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export const PODIUM_R = 2.3;   // collision radius of the base
export const PODIUM_H = 1.9;   // top of the pedestal
export const REACH = 6.2;      // how close the car must be to press E

function labelTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.font = 'italic 700 104px "Chakra Petch", "Arial Black", sans-serif';
  const tw = Math.min(940, ctx.measureText(text).width + 120);
  const x0 = (1024 - tw) / 2, y0 = 44, h = 168;
  // slanted plate, Rocket League style
  ctx.beginPath();
  ctx.moveTo(x0 + 30, y0); ctx.lineTo(x0 + tw, y0); ctx.lineTo(x0 + tw - 30, y0 + h); ctx.lineTo(x0, y0 + h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,12,38,.82)';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 512, y0 + h / 2 + 6, tw - 90);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { tex: t, aspect: tw / 1024 };
}

// Big glowing sign text (no plate), for podiums with a `headline`
function headlineTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.font = '900 140px "Orbitron", "Chakra Petch", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = 36;
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
  t.anisotropy = 4;
  return t;
}

function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.7, 'rgba(255,255,255,.35)');
  g.addColorStop(1, 'rgba(255,255,255,.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  return new THREE.CanvasTexture(c);
}

function iconFor(kind, mat) {
  const g = new THREE.Group();
  if (kind === 'about') {
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), mat));
    const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), new THREE.MeshBasicMaterial({ color: mat.emissive.clone().multiplyScalar(0.6), wireframe: true }));
    g.add(wire);
  } else if (kind === 'interests') {
    g.add(new THREE.Mesh(new THREE.TorusKnotGeometry(0.42, 0.13, 90, 12), mat));
  } else if (kind === 'experience') {
    // briefcase
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.4), mat));
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 20, Math.PI), mat);
    handle.position.y = 0.4;
    g.add(handle);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.08, 0.44), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    g.add(band);
  } else if (kind === 'stack') {
    // three stacked layers
    for (let i = 0; i < 3; i++) {
      const layer = new THREE.Mesh(new THREE.BoxGeometry(1.1 - i * 0.18, 0.16, 1.1 - i * 0.18), mat);
      layer.position.y = -0.3 + i * 0.3;
      g.add(layer);
    }
  } else if (kind === 'vision') {
    // an eye: ring + pupil
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.1, 10, 36), mat);
    g.add(ring);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), new THREE.MeshBasicMaterial({ color: mat.emissive.clone().multiplyScalar(0.8) }));
    g.add(pupil);
  } else if (kind === 'aspiration') {
    // a mountain peak with a flag on top
    const peak = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.0, 4), mat);
    peak.position.y = -0.15;
    g.add(peak);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    pole.position.y = 0.6;
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    flag.position.set(0.17, 0.77, 0);
    g.add(flag);
  } else if (kind === 'certs') {
    const medal = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 32), mat);
    medal.rotation.x = Math.PI / 2;
    g.add(medal);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 8, 32), mat);
    g.add(ring);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    star.position.z = 0.1;
    g.add(star);
  } else {
    g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), mat));
    const cage = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), new THREE.MeshBasicMaterial({ color: mat.emissive.clone().multiplyScalar(0.6), wireframe: true }));
    g.add(cage);
  }
  return g;
}

export function buildPodiums(scene, list) {
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1b2140, roughness: 0.45, metalness: 0.7 });
  const beamAlpha = beamTexture();
  const out = [];

  for (const data of list) {
    const color = new THREE.Color(data.color);
    const g = new THREE.Group();
    g.position.set(data.x, 0, data.z);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.0, PODIUM_R, 0.55, 6), baseMat);
    base.position.y = 0.275;
    base.castShadow = base.receiveShadow = true;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 1.25, 6), baseMat);
    column.position.y = 1.18;
    column.castShadow = true;
    const glowMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2, roughness: 0.3 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.1, 6), glowMat);
    cap.position.y = PODIUM_H - 0.05;
    // glowing trims
    const trim = new THREE.Mesh(new THREE.CylinderGeometry(2.04, 2.04, 0.08, 6, 1, true), glowMat);
    trim.position.y = 0.55;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.7, 2.95, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(2.7, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.03;

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 9, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color, alphaMap: beamAlpha, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    beam.position.y = PODIUM_H + 4.5;

    // the icon gets its own, softer material so it reads as a shape instead of a white blob
    const iconMat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.45, roughness: 0.35, metalness: 0.4,
    });
    const icon = iconFor(data.kind, iconMat);
    icon.position.y = 3.3;

    const { tex, aspect } = labelTexture(data.label, data.color);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    label.scale.set(7.2, 1.8, 1);
    label.position.y = 5.3;
    label.renderOrder = 10;
    label.userData.aspect = aspect;

    const light = new THREE.PointLight(color, 25, 12, 2);
    light.position.y = 1.1; // low, so it lights the pad without washing out the icon

    let headline = null;
    if (data.headline) {
      headline = new THREE.Sprite(new THREE.SpriteMaterial({ map: headlineTexture(data.headline, data.color), transparent: true, depthWrite: false }));
      headline.scale.set(11, 2.75, 1);
      headline.position.y = 7.6;
      headline.renderOrder = 11;
      g.add(headline);
    }

    if (data.plate === false) {
      label.visible = false;
      if (headline) headline.position.y = 5.9;
    }
    if (headline) headline.userData.baseY = headline.position.y;

    g.add(base, column, cap, trim, ring, disc, beam, icon, label, light);
    scene.add(g);
    out.push({ data, group: g, ring, disc, beam, icon, label, headline, light, glowMat, x: data.x, z: data.z, near: 0 });
  }
  return out;
}

// t = seconds, activeId = podium the car is next to (or null)
export function updatePodiums(pods, t, dt, activeId) {
  for (const p of pods) {
    const target = p.data.id === activeId ? 1 : 0;
    p.near += (target - p.near) * Math.min(1, dt * 8);
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + p.x * 0.3);
    p.icon.rotation.y = t * 0.9;
    p.icon.position.y = 3.3 + Math.sin(t * 1.8 + p.z) * 0.18;
    p.ring.material.opacity = 0.45 + 0.35 * pulse + 0.2 * p.near;
    p.ring.scale.setScalar(1 + 0.04 * pulse + 0.08 * p.near);
    p.beam.material.opacity = 0.12 + 0.05 * pulse + 0.12 * p.near;
    p.glowMat.emissiveIntensity = 1.8 + 0.8 * pulse + 1.5 * p.near;
    p.light.intensity = 14 + 6 * pulse + 16 * p.near;
    const s = 1 + 0.12 * p.near;
    p.label.scale.set(7.2 * s, 1.8 * s, 1);
    if (p.headline) {
      p.headline.position.y = p.headline.userData.baseY + Math.sin(t * 1.3) * 0.15;
      p.headline.material.opacity = 0.85 + 0.15 * pulse;
    }
  }
}
