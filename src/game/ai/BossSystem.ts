import * as THREE from 'three';
import { BotMeshFactory } from '../rendering/BotMeshFactory';
import { Bot } from '../bots/BotSystem';

export interface BossBot extends Bot {
  bossType: 'tank' | 'hunter' | 'bomber' | 'sniper_king';
  phase: 1 | 2 | 3;
  specialCooldown: number;
  maxHealth: number;
  rewardClaimed: boolean;
}

export class BossSystem {
  bosses: BossBot[] = [];

  createBoss(type: BossBot['bossType'], wave: number, scene: THREE.Scene, world: { getHeightAt: (x: number, z: number) => number }): BossBot {
    const configs: Record<BossBot['bossType'], { hp: number; armor: number; speed: number; scale: number; color: number; weapon: string | null }> = {
      tank: { hp: 500 + wave * 20, armor: 100, speed: 0.4, scale: 1.5, color: 0x2d5a1e, weapon: 'assault' },
      hunter: { hp: 300 + wave * 15, armor: 50, speed: 1.2, scale: 1.2, color: 0x6a0dad, weapon: 'smg' },
      bomber: { hp: 200 + wave * 10, armor: 0, speed: 0.8, scale: 1.3, color: 0xcc0000, weapon: null },
      sniper_king: { hp: 250 + wave * 10, armor: 30, speed: 0.5, scale: 1.3, color: 0x1a1a1a, weapon: 'sniper' },
    };
    const cfg = configs[type];

    const skill = 0.95;
    const mesh = BotMeshFactory.create(skill);
    mesh.scale.setScalar(cfg.scale);

    // Override body color
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
        if (child.position.y > 0.3 && child.position.y < 0.8) {
          child.material = child.material.clone();
          (child.material as THREE.MeshLambertMaterial).color.setHex(cfg.color);
          (child.material as THREE.MeshLambertMaterial).emissive = new THREE.Color(cfg.color);
          (child.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.3;
        }
      }
    });

    // Spawn position
    const angle = Math.random() * Math.PI * 2;
    const radius = 100 + Math.random() * 150;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const h = world.getHeightAt(x, z);

    mesh.position.set(x, h + 0.6, z);
    scene.add(mesh);

    const bossName = type === 'tank' ? 'TANK' : type === 'hunter' ? 'HUNTER' : type === 'bomber' ? 'BOMBER' : 'SNIPER KING';

    const boss: BossBot = {
      id: `boss_${type}_${Date.now()}`,
      position: new THREE.Vector3(x, h + 0.6, z),
      velocity: new THREE.Vector3(),
      health: cfg.hp,
      armor: cfg.armor,
      isDead: false,
      weaponId: cfg.weapon,
      mesh,
      targetPos: null,
      state: 'roaming',
      stateTimer: 3,
      fireTimer: 0,
      detectionRange: type === 'sniper_king' ? 200 : 80,
      accuracy: 0.9,
      skill: 0.95,
      name: bossName,
      lootingTimeLeft: 0,
      inBuilding: false,
      flashlight: null,
      personality: type === 'sniper_king' ? 'sniper' : 'aggressive',
      level: 'boss',
      deathTime: 0,
      bossType: type,
      phase: 1,
      specialCooldown: 5,
      maxHealth: cfg.hp,
      rewardClaimed: false,
    };

    this.bosses.push(boss);
    return boss;
  }

  shouldSpawnBoss(wave: number): BossBot['bossType'][] {
    if (wave === 5) return ['tank'];
    if (wave === 10) return ['hunter', 'tank'];
    if (wave === 15) return ['bomber', 'sniper_king'];
    if (wave === 20) return ['tank', 'hunter', 'bomber', 'sniper_king'];
    if (wave > 20 && wave % 5 === 0) return ['tank', 'hunter'];
    return [];
  }

  updatePhases(): void {
    for (const boss of this.bosses) {
      if (boss.isDead) continue;
      const hpPercent = boss.health / boss.maxHealth;
      if (hpPercent <= 0.25) boss.phase = 3;
      else if (hpPercent <= 0.5) boss.phase = 2;
      else boss.phase = 1;
    }
  }

  getActiveBosses(): BossBot[] {
    return this.bosses.filter(b => !b.isDead);
  }

  clear(): void {
    this.bosses = [];
  }
}
