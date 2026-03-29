import * as THREE from 'three';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
  size: number;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private geometry: THREE.BufferGeometry;
  private points: THREE.Points;
  private maxParticles = 2000;

  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    this.maxParticles = isMobile ? 500 : 2000;
    this.geometry = new THREE.BufferGeometry();

    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.sizes = new Float32Array(this.maxParticles);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setDrawRange(0, 0);

    const material = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, material);
    scene.add(this.points);
  }

  private emit(
    position: THREE.Vector3,
    count: number,
    colorFn: () => THREE.Color,
    velFn: () => THREE.Vector3,
    life: number,
    size = 0.3
  ): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      this.particles.push({
        position: position.clone(),
        velocity: velFn(),
        life,
        maxLife: life,
        color: colorFn(),
        size,
      });
    }
  }

  emitMuzzleFlash(position: THREE.Vector3, direction: THREE.Vector3): void {
    const count = 10 + Math.floor(Math.random() * 6);
    this.emit(
      position,
      count,
      () => new THREE.Color(
        0.9 + Math.random() * 0.1,
        0.4 + Math.random() * 0.4,
        0
      ),
      () => {
        const v = direction.clone().multiplyScalar(8 + Math.random() * 6);
        v.x += (Math.random() - 0.5) * 4;
        v.y += (Math.random() - 0.5) * 4;
        v.z += (Math.random() - 0.5) * 4;
        return v;
      },
      0.05,
      0.15
    );
  }

  emitHitSpark(position: THREE.Vector3): void {
    const count = 8 + Math.floor(Math.random() * 5);
    this.emit(
      position,
      count,
      () => new THREE.Color(1, 0.9 + Math.random() * 0.1, 0.5 + Math.random() * 0.5),
      () => new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        Math.random() * 6,
        (Math.random() - 0.5) * 12
      ),
      0.2,
      0.2
    );
  }

  emitBlood(position: THREE.Vector3): void {
    const count = 5 + Math.floor(Math.random() * 4);
    this.emit(
      position,
      count,
      () => new THREE.Color(0.6 + Math.random() * 0.2, 0, 0),
      () => new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 5,
        (Math.random() - 0.5) * 6
      ),
      0.5,
      0.25
    );
  }

  emitExplosion(position: THREE.Vector3, radius: number): void {
    const count = 30 + Math.floor(Math.random() * 20);
    const colors = [
      new THREE.Color(1, 0.3, 0),
      new THREE.Color(1, 0.6, 0),
      new THREE.Color(1, 0.9, 0),
      new THREE.Color(0.8, 0.1, 0),
    ];
    this.emit(
      position,
      count,
      () => colors[Math.floor(Math.random() * colors.length)].clone(),
      () => new THREE.Vector3(
        (Math.random() - 0.5) * radius * 4,
        Math.random() * radius * 3,
        (Math.random() - 0.5) * radius * 4
      ),
      0.5,
      0.5
    );
    // Smoke
    this.emitSmoke(position);
  }

  emitSmoke(position: THREE.Vector3): void {
    const count = 20;
    this.emit(
      position,
      count,
      () => {
        const g = 0.4 + Math.random() * 0.3;
        return new THREE.Color(g, g, g);
      },
      () => new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        1 + Math.random() * 3,
        (Math.random() - 0.5) * 3
      ),
      2.0,
      0.6
    );
  }

  emitPickupGlow(position: THREE.Vector3): void {
    const count = 5;
    this.emit(
      position,
      count,
      () => Math.random() > 0.5
        ? new THREE.Color(0, 0.8 + Math.random() * 0.2, 0.2)
        : new THREE.Color(0, 0.4, 1),
      () => new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        2 + Math.random() * 2,
        (Math.random() - 0.5) * 3
      ),
      0.6,
      0.3
    );
  }

  emitDeath(position: THREE.Vector3): void {
    // Red particles
    const count = 15;
    this.emit(
      position,
      count,
      () => new THREE.Color(0.7 + Math.random() * 0.3, 0, 0),
      () => new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        Math.random() * 6,
        (Math.random() - 0.5) * 8
      ),
      0.8,
      0.3
    );
    this.emitSmoke(position);
  }

  emitWaveStart(): void {
    // Particles from edges sweeping inward - use large spread
    const count = 40;
    const pos = new THREE.Vector3(0, 5, 0);
    this.emit(
      pos,
      count,
      () => new THREE.Color(0.2 + Math.random() * 0.3, 0.4 + Math.random() * 0.3, 1),
      () => new THREE.Vector3(
        (Math.random() - 0.5) * 30,
        Math.random() * 10,
        (Math.random() - 0.5) * 30
      ),
      1.5,
      0.4
    );
  }

  update(delta: number): void {
    const gravity = -15;

    let writeIdx = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= delta;
      if (p.life <= 0) continue; // skip dead

      // Apply gravity to some particles (non-smoke)
      if (p.maxLife < 1.0) {
        p.velocity.y += gravity * delta;
      }
      p.position.addScaledVector(p.velocity, delta);

      const lifeRatio = p.life / p.maxLife;
      const idx3 = writeIdx * 3;

      this.positions[idx3] = p.position.x;
      this.positions[idx3 + 1] = p.position.y;
      this.positions[idx3 + 2] = p.position.z;

      this.colors[idx3] = p.color.r * lifeRatio;
      this.colors[idx3 + 1] = p.color.g * lifeRatio;
      this.colors[idx3 + 2] = p.color.b * lifeRatio;

      this.sizes[writeIdx] = p.size * lifeRatio;

      this.particles[writeIdx] = p;
      writeIdx++;
    }
    this.particles.length = writeIdx;

    this.geometry.setDrawRange(0, writeIdx);
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }

  destroy(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
    if (this.points.material instanceof THREE.Material) {
      this.points.material.dispose();
    }
    this.particles = [];
  }
}
