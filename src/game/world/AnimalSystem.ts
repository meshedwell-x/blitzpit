import * as THREE from 'three';
import { WorldGenerator } from './WorldGenerator';
import { BiomeSystem, BiomeType } from './BiomeSystem';

export interface Animal {
  id: string;
  type: 'cobra' | 'tiger' | 'monkey' | 'cow' | 'eagle';
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number;
  mesh: THREE.Group;
  state: 'idle' | 'roaming' | 'aggressive' | 'fleeing' | 'dead';
  stateTimer: number;
  targetPos: THREE.Vector3 | null;
  biome: BiomeType;
  damage: number;
  speed: number;
  detectionRange: number;
  aggressive: boolean;
}

export class AnimalSystem {
  private scene: THREE.Scene;
  private world: WorldGenerator;
  private biomeSystem: BiomeSystem;
  animals: Animal[] = [];
  private maxAnimals = 30;

  constructor(scene: THREE.Scene, world: WorldGenerator, biomeSystem: BiomeSystem) {
    this.scene = scene;
    this.world = world;
    this.biomeSystem = biomeSystem;
  }

  spawn(): void {
    const animalDefs = [
      { type: 'cobra' as Animal['type'], biomes: ['jungle', 'desert'], damage: 15, speed: 3, detection: 8, health: 20, color: 0x228b22 },
      { type: 'tiger' as Animal['type'], biomes: ['jungle'], damage: 30, speed: 7, detection: 25, health: 80, color: 0xff8c00 },
      { type: 'monkey' as Animal['type'], biomes: ['jungle', 'urban'], damage: 5, speed: 5, detection: 15, health: 15, color: 0x8b4513 },
      { type: 'cow' as Animal['type'], biomes: ['urban', 'desert'], damage: 0, speed: 2, detection: 10, health: 60, color: 0xf5f5dc },
      { type: 'eagle' as Animal['type'], biomes: ['tundra', 'jungle'], damage: 10, speed: 10, detection: 40, health: 25, color: 0x4a3728 },
    ];

    let spawned = 0;
    let attempts = 0;
    while (spawned < this.maxAnimals && attempts < this.maxAnimals * 5) {
      attempts++;
      const def = animalDefs[Math.floor(Math.random() * animalDefs.length)];
      const angle = Math.random() * Math.PI * 2;
      const radius = 50 + Math.random() * 300;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const biome = this.biomeSystem.getBiome(x, z);

      if (!(def.biomes as string[]).includes(biome)) continue;

      const h = this.world.getHeightAt(x, z);
      if (h <= 4) continue;

      const mesh = this.createAnimalMesh(def.type, def.color);
      mesh.position.set(x, h + 0.5, z);
      this.scene.add(mesh);

      this.animals.push({
        id: `animal_${spawned}`,
        type: def.type,
        position: new THREE.Vector3(x, h + 0.5, z),
        velocity: new THREE.Vector3(),
        health: def.health,
        mesh,
        state: 'roaming',
        stateTimer: 3 + Math.random() * 5,
        targetPos: null,
        biome,
        damage: def.damage,
        speed: def.speed,
        detectionRange: def.detection,
        aggressive: false,
      });
      spawned++;
    }
  }

  private createAnimalMesh(type: Animal['type'], color: number): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color });

    switch (type) {
      case 'tiger': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 1.4), mat);
        body.position.y = 0.4;
        group.add(body);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), mat);
        head.position.set(0, 0.5, -0.8);
        group.add(head);
        const legGeo = new THREE.BoxGeometry(0.15, 0.35, 0.15);
        const legMat = new THREE.MeshLambertMaterial({ color: 0xcc7700 });
        [-0.3, 0.3].forEach(lx => {
          [-0.5, 0.5].forEach(lz => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(lx, 0.1, lz);
            group.add(leg);
          });
        });
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.82, 0.1, 0.15),
          new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
        );
        stripe.position.set(0, 0.55, 0);
        group.add(stripe);
        break;
      }
      case 'cobra': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1.0), mat);
        body.position.y = 0.15;
        group.add(body);
        const hood = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.2), mat);
        hood.position.set(0, 0.3, -0.5);
        group.add(hood);
        break;
      }
      case 'monkey': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.3), mat);
        body.position.y = 0.4;
        group.add(body);
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.3, 0.3),
          new THREE.MeshLambertMaterial({ color: 0xdeb887 })
        );
        head.position.set(0, 0.7, 0);
        group.add(head);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.6), mat);
        tail.position.set(0, 0.3, 0.3);
        tail.rotation.x = -0.5;
        group.add(tail);
        break;
      }
      case 'cow': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 1.2), mat);
        body.position.y = 0.6;
        group.add(body);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.4), mat);
        head.position.set(0, 0.7, -0.7);
        group.add(head);
        const legGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
        [-0.25, 0.25].forEach(lx => {
          [-0.4, 0.4].forEach(lz => {
            const leg = new THREE.Mesh(legGeo, new THREE.MeshLambertMaterial({ color: 0xe8dcc8 }));
            leg.position.set(lx, 0.1, lz);
            group.add(leg);
          });
        });
        break;
      }
      case 'eagle': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.5), mat);
        body.position.y = 15;
        group.add(body);
        const wingGeo = new THREE.BoxGeometry(1.5, 0.05, 0.4);
        const wing = new THREE.Mesh(wingGeo, mat);
        wing.position.set(0, 15, 0);
        group.add(wing);
        break;
      }
    }
    return group;
  }

  update(delta: number, playerPos: THREE.Vector3, isNight: boolean): void {
    for (const animal of this.animals) {
      if (animal.state === 'dead') continue;

      animal.stateTimer -= delta;
      animal.aggressive = isNight && (animal.type === 'tiger' || animal.type === 'cobra');

      const distToPlayer = animal.position.distanceTo(playerPos);

      switch (animal.state) {
        case 'idle':
          if (animal.stateTimer <= 0) {
            animal.state = 'roaming';
            animal.stateTimer = 3 + Math.random() * 5;
          }
          if (distToPlayer < animal.detectionRange) {
            if (animal.aggressive && animal.damage > 0) {
              animal.state = 'aggressive';
            } else if (animal.type !== 'cow') {
              animal.state = 'fleeing';
              animal.stateTimer = 3;
            }
          }
          break;

        case 'roaming': {
          if (!animal.targetPos || animal.stateTimer <= 0) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 10 + Math.random() * 20;
            animal.targetPos = new THREE.Vector3(
              animal.position.x + Math.cos(angle) * dist,
              0,
              animal.position.z + Math.sin(angle) * dist
            );
            animal.stateTimer = 5 + Math.random() * 5;
          }
          if (animal.targetPos) {
            const dir = new THREE.Vector3().subVectors(animal.targetPos, animal.position).setY(0);
            if (dir.length() > 1) {
              dir.normalize();
              animal.position.x += dir.x * animal.speed * delta;
              animal.position.z += dir.z * animal.speed * delta;
              animal.mesh.rotation.y = Math.atan2(dir.x, dir.z);
            } else {
              animal.state = 'idle';
              animal.stateTimer = 2 + Math.random() * 3;
            }
          }
          if (distToPlayer < animal.detectionRange) {
            if (animal.aggressive && animal.damage > 0) {
              animal.state = 'aggressive';
            } else if (animal.type !== 'cow' && distToPlayer < animal.detectionRange * 0.5) {
              animal.state = 'fleeing';
              animal.stateTimer = 3;
            }
          }
          break;
        }

        case 'aggressive':
          if (distToPlayer > 1.5) {
            const dir = new THREE.Vector3().subVectors(playerPos, animal.position).setY(0).normalize();
            animal.position.x += dir.x * animal.speed * 1.5 * delta;
            animal.position.z += dir.z * animal.speed * 1.5 * delta;
            animal.mesh.rotation.y = Math.atan2(dir.x, dir.z);
          }
          if (distToPlayer < 2.0 && animal.stateTimer <= 0) {
            animal.stateTimer = 1.5;
          }
          if (distToPlayer > animal.detectionRange * 2) {
            animal.state = 'roaming';
            animal.stateTimer = 3;
          }
          break;

        case 'fleeing': {
          const fleeDir = new THREE.Vector3().subVectors(animal.position, playerPos).setY(0).normalize();
          animal.position.x += fleeDir.x * animal.speed * 1.3 * delta;
          animal.position.z += fleeDir.z * animal.speed * 1.3 * delta;
          animal.mesh.rotation.y = Math.atan2(fleeDir.x, fleeDir.z);
          if (animal.stateTimer <= 0 || distToPlayer > animal.detectionRange * 2) {
            animal.state = 'roaming';
            animal.stateTimer = 5;
          }
          break;
        }
      }

      if (animal.type !== 'eagle') {
        const groundH = this.world.getHeightAt(animal.position.x, animal.position.z);
        animal.position.y = groundH + 0.5;
      }

      animal.position.x = Math.max(-380, Math.min(380, animal.position.x));
      animal.position.z = Math.max(-380, Math.min(380, animal.position.z));

      animal.mesh.position.copy(animal.position);
    }
  }

  damageAnimal(animalId: string, damage: number): boolean {
    const animal = this.animals.find(a => a.id === animalId);
    if (!animal || animal.state === 'dead') return false;
    animal.health -= damage;
    if (animal.health <= 0) {
      animal.state = 'dead';
      animal.mesh.rotation.x = Math.PI / 2;
      animal.mesh.position.y -= 0.3;
      setTimeout(() => {
        this.scene.remove(animal.mesh);
        animal.mesh.traverse(c => {
          if (c instanceof THREE.Mesh) {
            c.geometry.dispose();
            if (c.material instanceof THREE.Material) c.material.dispose();
          }
        });
      }, 5000);
      return true;
    }
    if (animal.state !== 'aggressive') {
      animal.state = 'fleeing';
      animal.stateTimer = 5;
    }
    return false;
  }

  getAttackingAnimalDamage(playerPos: THREE.Vector3): number {
    let totalDamage = 0;
    for (const animal of this.animals) {
      if (animal.state !== 'aggressive' || animal.stateTimer > 0) continue;
      if (animal.position.distanceTo(playerPos) < 2.0) {
        totalDamage += animal.damage;
        animal.stateTimer = 1.5;
      }
    }
    return totalDamage;
  }

  destroy(): void {
    for (const animal of this.animals) {
      this.scene.remove(animal.mesh);
      animal.mesh.traverse(c => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          if (c.material instanceof THREE.Material) c.material.dispose();
        }
      });
    }
    this.animals = [];
  }
}
