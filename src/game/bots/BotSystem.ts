import * as THREE from 'three';
import { BOT_COUNT, PLAYER_HEIGHT, PLAYER_SPEED, WEAPONS } from '../core/constants';
import { WorldGenerator } from '../world/WorldGenerator';
import { WeaponSystem } from '../weapons/WeaponSystem';
import { PlayerController } from '../player/PlayerController';
import { WaveConfig } from '../core/WaveManager';

export interface Bot {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number;
  armor: number;
  isDead: boolean;
  weaponId: string | null;
  mesh: THREE.Group;
  targetPos: THREE.Vector3 | null;
  state: 'landing' | 'looting' | 'roaming' | 'fighting' | 'fleeing';
  stateTimer: number;
  fireTimer: number;
  detectionRange: number;
  accuracy: number;
  skill: number; // 0-1
  name: string;
}

const BOT_NAMES = [
  'Striker', 'Ghost', 'Viper', 'Shadow', 'Phoenix',
  'Hawk', 'Storm', 'Blade', 'Wolf', 'Titan',
  'Cobra', 'Falcon', 'Raven', 'Steel', 'Frost',
  'Thunder', 'Ninja', 'Sniper', 'Tank', 'Scout',
  'Rogue', 'Ace', 'Blaze', 'Reaper', 'Hunter',
  'Eagle', 'Bear', 'Lynx', 'Omega', 'Alpha',
  'Chaos', 'Fury', 'Wraith', 'Doom', 'Spark',
  'Flux', 'Onyx', 'Pulse', 'Shade', 'Apex',
  'Drift', 'Hex', 'Nova', 'Zen', 'Crypt',
  'Pike', 'Volt', 'Clash', 'Bane',
];

export class BotSystem {
  bots: Bot[] = [];
  private world: WorldGenerator;
  private weaponSystem: WeaponSystem;
  private player: PlayerController;
  private scene: THREE.Scene;
  alive = BOT_COUNT;
  killFeed: { killer: string; victim: string; weapon: string; time: number }[] = [];
  // Reusable temp vectors to reduce GC pressure
  private _tmpDir = new THREE.Vector3();
  private _tmpFireDir = new THREE.Vector3();
  private _tmpStrafeDir = new THREE.Vector3();
  private _tmpFirePos = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    world: WorldGenerator,
    weaponSystem: WeaponSystem,
    player: PlayerController
  ) {
    this.scene = scene;
    this.world = world;
    this.weaponSystem = weaponSystem;
    this.player = player;
  }

  spawn(): void {
    for (let i = 0; i < BOT_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 30 + Math.random() * 120;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const h = this.world.getHeightAt(x, z);

      // Bot mesh (simple colored box figure)
      const group = new THREE.Group();

      // Body
      const bodyGeo = new THREE.BoxGeometry(0.6, 1.0, 0.4);
      const skill = 0.3 + Math.random() * 0.7;
      const bodyColor = new THREE.Color().setHSL(0.0 + skill * 0.3, 0.7, 0.5);
      const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.5;
      group.add(body);

      // Head
      const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      const headMat = new THREE.MeshLambertMaterial({ color: 0xffdbac });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.2;
      group.add(head);

      // Arms
      const armGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
      const armMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const leftArm = new THREE.Mesh(armGeo, armMat);
      leftArm.position.set(-0.5, 0.4, 0);
      group.add(leftArm);
      const rightArm = new THREE.Mesh(armGeo, armMat);
      rightArm.position.set(0.5, 0.4, 0);
      group.add(rightArm);

      // Legs
      const legGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
      const legMat = new THREE.MeshLambertMaterial({ color: 0x333366 });
      const leftLeg = new THREE.Mesh(legGeo, legMat);
      leftLeg.position.set(-0.15, -0.4, 0);
      group.add(leftLeg);
      const rightLeg = new THREE.Mesh(legGeo, legMat);
      rightLeg.position.set(0.15, -0.4, 0);
      group.add(rightLeg);

      group.position.set(x, h + 0.6 + PLAYER_HEIGHT, z);
      this.scene.add(group);

      const weapons = ['pistol', 'smg', 'assault', 'shotgun', 'sniper'];
      const weaponId = Math.random() < 0.3 ? null : weapons[Math.floor(Math.random() * weapons.length)];

      this.bots.push({
        id: `bot_${i}`,
        position: new THREE.Vector3(x, h + 0.6 + PLAYER_HEIGHT, z),
        velocity: new THREE.Vector3(0, 0, 0),
        health: 100,
        armor: Math.random() < 0.3 ? 50 : 0,
        isDead: false,
        weaponId,
        mesh: group,
        targetPos: null,
        state: 'roaming',
        stateTimer: 2 + Math.random() * 5,
        fireTimer: 0,
        detectionRange: 30 + skill * 40,
        accuracy: 0.3 + skill * 0.5,
        skill,
        name: BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? `_${Math.floor(i / BOT_NAMES.length)}` : ''),
      });
    }
  }

  update(delta: number): void {
    const playerPos = this.player.state.position;

    for (const bot of this.bots) {
      if (bot.isDead) continue;

      bot.stateTimer -= delta;
      if (bot.fireTimer > 0) bot.fireTimer -= delta;

      // State machine
      switch (bot.state) {
        case 'landing':
          this.updateLanding(bot, delta);
          break;
        case 'roaming':
          this.updateRoaming(bot, delta, playerPos);
          break;
        case 'looting':
          this.updateLooting(bot, delta);
          break;
        case 'fighting':
          this.updateFighting(bot, delta, playerPos);
          break;
        case 'fleeing':
          this.updateFleeing(bot, delta, playerPos);
          break;
      }

      // Ground collision
      const groundH = this.world.getHeightAt(bot.position.x, bot.position.z);
      const surfaceY = groundH + 0.6;
      if (bot.position.y < surfaceY + PLAYER_HEIGHT) {
        bot.position.y = surfaceY + PLAYER_HEIGHT;
      }

      // Update mesh
      bot.mesh.position.copy(bot.position);

      // Walking animation
      if (bot.velocity.length() > 0.5) {
        const walkCycle = Math.sin(Date.now() * 0.01) * 0.3;
        const legs = bot.mesh.children;
        if (legs[4]) legs[4].rotation.x = walkCycle;
        if (legs[5]) legs[5].rotation.x = -walkCycle;
        if (legs[2]) legs[2].rotation.x = -walkCycle * 0.5;
        if (legs[3]) legs[3].rotation.x = walkCycle * 0.5;
      }
    }
  }

  private updateLanding(bot: Bot, delta: number): void {
    const groundH = this.world.getHeightAt(bot.position.x, bot.position.z);
    const surfaceY = groundH + 0.6 + PLAYER_HEIGHT;
    bot.position.y -= 12 * delta; // fall speed
    if (bot.position.y <= surfaceY) {
      bot.position.y = surfaceY;
      bot.state = 'roaming';
      bot.stateTimer = 2 + Math.random() * 5;
    }
  }

  private updateRoaming(bot: Bot, delta: number, playerPos: THREE.Vector3): void {
    const distToPlayer = bot.position.distanceTo(playerPos);

    // Detect player
    if (distToPlayer < bot.detectionRange && bot.weaponId && !this.player.state.isDead) {
      bot.state = 'fighting';
      bot.stateTimer = 3 + Math.random() * 5;
      return;
    }

    // Pick new target
    if (bot.stateTimer <= 0 || !bot.targetPos) {
      // Look for nearby loot if no weapon
      if (!bot.weaponId) {
        bot.state = 'looting';
        bot.stateTimer = 5;
        return;
      }

      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 40;
      bot.targetPos = new THREE.Vector3(
        bot.position.x + Math.cos(angle) * dist,
        0,
        bot.position.z + Math.sin(angle) * dist
      );
      bot.stateTimer = 5 + Math.random() * 10;
    }

    // Move toward target
    if (bot.targetPos) {
      const dir = new THREE.Vector3()
        .subVectors(bot.targetPos, bot.position)
        .setY(0)
        .normalize();

      bot.velocity.x = dir.x * PLAYER_SPEED * 0.6;
      bot.velocity.z = dir.z * PLAYER_SPEED * 0.6;
      bot.position.x += bot.velocity.x * delta;
      bot.position.z += bot.velocity.z * delta;

      // Face direction
      bot.mesh.rotation.y = Math.atan2(dir.x, dir.z);

      if (bot.position.distanceTo(bot.targetPos) < 3) {
        bot.targetPos = null;
      }
    }
  }

  private updateLooting(bot: Bot, delta: number): void {
    // Find nearest weapon
    let nearestItem: { position: THREE.Vector3; weaponId?: string; index: number } | null = null;
    let nearestDist = Infinity;

    for (let i = 0; i < this.weaponSystem.items.length; i++) {
      const item = this.weaponSystem.items[i];
      if (item.collected || item.type !== 'weapon') continue;
      const dist = bot.position.distanceTo(item.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestItem = { position: item.position, weaponId: item.weaponId, index: i };
      }
    }

    if (nearestItem && nearestDist < 100) {
      const dir = new THREE.Vector3()
        .subVectors(nearestItem.position, bot.position)
        .setY(0)
        .normalize();
      bot.velocity.x = dir.x * PLAYER_SPEED * 0.7;
      bot.velocity.z = dir.z * PLAYER_SPEED * 0.7;
      bot.position.x += bot.velocity.x * delta;
      bot.position.z += bot.velocity.z * delta;
      bot.mesh.rotation.y = Math.atan2(dir.x, dir.z);

      if (nearestDist < 2 && nearestItem.weaponId) {
        bot.weaponId = nearestItem.weaponId;
        this.weaponSystem.items[nearestItem.index].collected = true;
        this.scene.remove(this.weaponSystem.items[nearestItem.index].mesh);
        bot.state = 'roaming';
        bot.stateTimer = 3;
      }
    } else {
      // No loot nearby, just roam
      bot.state = 'roaming';
      bot.stateTimer = 5;
    }

    if (bot.stateTimer <= 0) {
      bot.state = 'roaming';
      bot.stateTimer = 5;
    }
  }

  private updateFighting(bot: Bot, delta: number, playerPos: THREE.Vector3): void {
    if (!bot.weaponId || this.player.state.isDead) {
      bot.state = 'fleeing';
      bot.stateTimer = 5;
      return;
    }

    const distToPlayer = bot.position.distanceTo(playerPos);
    const weapon = WEAPONS[bot.weaponId];
    if (!weapon) return;

    // Face player
    const dir = this._tmpDir
      .subVectors(playerPos, bot.position)
      .setY(0)
      .normalize();
    bot.mesh.rotation.y = Math.atan2(dir.x, dir.z);

    // Optimal range behavior
    const optimalRange = weapon.range * 0.4;
    if (distToPlayer > optimalRange * 1.5) {
      // Move closer
      bot.position.x += dir.x * PLAYER_SPEED * 0.5 * delta;
      bot.position.z += dir.z * PLAYER_SPEED * 0.5 * delta;
    } else if (distToPlayer < optimalRange * 0.5) {
      // Back away
      bot.position.x -= dir.x * PLAYER_SPEED * 0.4 * delta;
      bot.position.z -= dir.z * PLAYER_SPEED * 0.4 * delta;
    } else {
      // Strafe
      this._tmpStrafeDir.set(-dir.z, 0, dir.x);
      const strafeSide = Math.sin(Date.now() * 0.002 + bot.position.x) > 0 ? 1 : -1;
      bot.position.x += this._tmpStrafeDir.x * PLAYER_SPEED * 0.3 * strafeSide * delta;
      bot.position.z += this._tmpStrafeDir.z * PLAYER_SPEED * 0.3 * strafeSide * delta;
    }

    // Fire at player
    if (distToPlayer < weapon.range && bot.fireTimer <= 0) {
      const fireDir = this._tmpFireDir
        .subVectors(playerPos, bot.position)
        .normalize();

      // Add inaccuracy based on skill
      const inaccuracy = (1 - bot.accuracy) * 0.15;
      fireDir.x += (Math.random() - 0.5) * inaccuracy;
      fireDir.y += (Math.random() - 0.5) * inaccuracy;
      fireDir.z += (Math.random() - 0.5) * inaccuracy;
      fireDir.normalize();

      this._tmpFirePos.copy(bot.position);
      this._tmpFirePos.y += 0.5;
      this.weaponSystem.fireBotWeapon(
        this._tmpFirePos,
        fireDir,
        bot.weaponId,
        bot.id
      );

      bot.fireTimer = 1 / weapon.fireRate * (1 + (1 - bot.skill) * 0.5);
    }

    // Switch to fleeing if low health
    if (bot.health < 30) {
      bot.state = 'fleeing';
      bot.stateTimer = 5;
      return;
    }

    // Lose interest if player too far
    if (distToPlayer > bot.detectionRange * 1.5) {
      bot.state = 'roaming';
      bot.stateTimer = 5;
    }

    // Also fight other bots
    this.botVsBotCombat(bot, delta);
  }

  private updateFleeing(bot: Bot, delta: number, playerPos: THREE.Vector3): void {
    const dir = new THREE.Vector3()
      .subVectors(bot.position, playerPos)
      .setY(0)
      .normalize();

    bot.velocity.x = dir.x * PLAYER_SPEED * 0.8;
    bot.velocity.z = dir.z * PLAYER_SPEED * 0.8;
    bot.position.x += bot.velocity.x * delta;
    bot.position.z += bot.velocity.z * delta;
    bot.mesh.rotation.y = Math.atan2(dir.x, dir.z);

    if (bot.stateTimer <= 0 || bot.position.distanceTo(playerPos) > 60) {
      bot.state = 'roaming';
      bot.stateTimer = 5;
    }
  }

  private botVsBotCombat(attacker: Bot, _delta: number): void {
    for (const target of this.bots) {
      if (target.id === attacker.id || target.isDead) continue;
      const dist = attacker.position.distanceTo(target.position);
      if (dist < 20 && dist < attacker.detectionRange * 0.5) {
        // Occasionally shoot at other bots
        if (Math.random() < 0.02 && attacker.weaponId) {
          this._tmpDir
            .subVectors(target.position, attacker.position)
            .normalize();
          this._tmpFirePos.copy(attacker.position);
          this._tmpFirePos.y += 0.5;
          this.weaponSystem.fireBotWeapon(
            this._tmpFirePos,
            this._tmpDir, attacker.weaponId, attacker.id
          );
        }
      }
    }
  }

  checkBulletHits(bullets: { position: THREE.Vector3; damage: number; ownerId: string }[]): void {
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const bullet = bullets[bi];

      // Check hit on player (from bot bullets)
      if (bullet.ownerId !== 'player') {
        const distToPlayer = bullet.position.distanceTo(this.player.state.position);
        if (distToPlayer < 1.0) {
          this.player.takeDamage(bullet.damage);
          if (this.player.state.isDead) {
            const killerBot = this.bots.find(b => b.id === bullet.ownerId);
            this.killFeed.push({
              killer: killerBot?.name || 'Bot',
              victim: 'You',
              weapon: killerBot?.weaponId || 'unknown',
              time: Date.now(),
            });
          }
          this.weaponSystem.removeBullet(bi);
          continue;
        }
      }

      // Check hit on bots (from player or other bot)
      for (const bot of this.bots) {
        if (bot.isDead || bot.id === bullet.ownerId) continue;
        const dist = bullet.position.distanceTo(bot.position);
        if (dist < 1.2) {
          // Headshot check
          const headY = bot.position.y + 0.4;
          const isHeadshot = Math.abs(bullet.position.y - headY) < 0.3;
          const damage = isHeadshot ? bullet.damage * 2.5 : bullet.damage;

          if (bot.armor > 0) {
            const armorAbsorb = Math.min(bot.armor, damage * 0.5);
            bot.armor -= armorAbsorb;
            bot.health -= (damage - armorAbsorb);
          } else {
            bot.health -= damage;
          }

          // Hit reaction
          if (!bot.isDead && bot.state !== 'fighting') {
            bot.state = 'fighting';
            bot.stateTimer = 5;
          }

          if (bot.health <= 0) {
            bot.isDead = true;
            bot.health = 0;
            this.alive = Math.max(0, this.alive - 1);

            // Death animation - lay down
            bot.mesh.rotation.x = Math.PI / 2;
            bot.mesh.position.y -= 0.5;

            const killerName = bullet.ownerId === 'player' ? 'You' :
              (this.bots.find(b => b.id === bullet.ownerId)?.name || 'Bot');
            const weaponName = bullet.ownerId === 'player' ?
              (this.weaponSystem.getActiveWeapon()?.def.name || 'Unknown') :
              (this.bots.find(b => b.id === bullet.ownerId)?.weaponId || 'unknown');

            this.killFeed.push({
              killer: killerName,
              victim: bot.name,
              weapon: weaponName,
              time: Date.now(),
            });

            if (bullet.ownerId === 'player') {
              this.player.state.kills++;
            }

            // Drop loot on death
            if (bot.weaponId) {
              this.weaponSystem.spawnItems([{
                position: bot.position.clone(),
                type: 'weapon',
                weaponId: bot.weaponId,
              }]);
            }
            this.weaponSystem.spawnItems([{
              position: bot.position.clone().add(new THREE.Vector3(0.5, 0, 0)),
              type: 'health',
            }]);
          }

          this.weaponSystem.removeBullet(bi);
          break;
        }
      }
    }
  }

  damageBot(botId: string, damage: number, killerId: string): void {
    const bot = this.bots.find(b => b.id === botId);
    if (!bot || bot.isDead) return;

    if (bot.armor > 0) {
      const armorAbsorb = Math.min(bot.armor, damage * 0.5);
      bot.armor -= armorAbsorb;
      bot.health -= (damage - armorAbsorb);
    } else {
      bot.health -= damage;
    }

    if (!bot.isDead && bot.state !== 'fighting') {
      bot.state = 'fighting';
      bot.stateTimer = 5;
    }

    if (bot.health <= 0) {
      bot.isDead = true;
      bot.health = 0;
      this.alive--;
      bot.mesh.rotation.x = Math.PI / 2;
      bot.mesh.position.y -= 0.5;

      const killerName = killerId === 'player' ? 'You' :
        (this.bots.find(b => b.id === killerId)?.name || 'Bot');
      const weaponName = killerId === 'player' ?
        (this.weaponSystem.getActiveWeapon()?.def.name || 'Unknown') :
        (this.bots.find(b => b.id === killerId)?.weaponId || 'unknown');

      this.killFeed.push({
        killer: killerName,
        victim: bot.name,
        weapon: weaponName,
        time: Date.now(),
      });

      if (killerId === 'player') {
        this.player.state.kills++;
      }

      if (bot.weaponId) {
        this.weaponSystem.spawnItems([{
          position: bot.position.clone(),
          type: 'weapon',
          weaponId: bot.weaponId,
        }]);
      }
      this.weaponSystem.spawnItems([{
        position: bot.position.clone().add(new THREE.Vector3(0.5, 0, 0)),
        type: 'health',
      }]);
    }
  }

  respawnForWave(config: WaveConfig): void {
    // Remove and dispose existing bot meshes
    for (const bot of this.bots) {
      this.scene.remove(bot.mesh);
      bot.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    }
    this.bots = [];
    this.alive = config.botCount;

    for (let i = 0; i < config.botCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 30 + Math.random() * 120;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const h = this.world.getHeightAt(x, z);

      const group = new THREE.Group();

      const skill = config.botSkillMin + Math.random() * (config.botSkillMax - config.botSkillMin);
      const bodyColor = new THREE.Color().setHSL(0.0 + skill * 0.3, 0.7, 0.5);
      const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.4), bodyMat);
      body.position.y = 0.5;
      group.add(body);

      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.4),
        new THREE.MeshLambertMaterial({ color: 0xffdbac })
      );
      head.position.y = 1.2;
      group.add(head);

      const armGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
      const armMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const leftArm = new THREE.Mesh(armGeo, armMat);
      leftArm.position.set(-0.5, 0.4, 0);
      group.add(leftArm);
      const rightArm = new THREE.Mesh(armGeo, armMat);
      rightArm.position.set(0.5, 0.4, 0);
      group.add(rightArm);

      const legGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
      const legMat = new THREE.MeshLambertMaterial({ color: 0x333366 });
      const leftLeg = new THREE.Mesh(legGeo, legMat);
      leftLeg.position.set(-0.15, -0.4, 0);
      group.add(leftLeg);
      const rightLeg = new THREE.Mesh(legGeo, legMat);
      rightLeg.position.set(0.15, -0.4, 0);
      group.add(rightLeg);

      // Start high for landing animation
      const spawnY = h + 0.6 + PLAYER_HEIGHT + 60 + Math.random() * 20;
      group.position.set(x, spawnY, z);
      this.scene.add(group);

      const weapons = ['pistol', 'smg', 'assault', 'shotgun', 'sniper'];
      const hasWeapon = Math.random() < config.botWeaponChance;
      const weaponId = hasWeapon ? weapons[Math.floor(Math.random() * weapons.length)] : null;

      this.bots.push({
        id: `bot_w${i}_${Date.now()}`,
        position: new THREE.Vector3(x, spawnY, z),
        velocity: new THREE.Vector3(0, 0, 0),
        health: 100,
        armor: Math.random() < config.botArmorChance ? 50 : 0,
        isDead: false,
        weaponId,
        mesh: group,
        targetPos: null,
        state: 'landing',
        stateTimer: 2 + Math.random() * 5,
        fireTimer: 0,
        detectionRange: 30 + skill * 40,
        accuracy: 0.3 + skill * 0.5,
        skill,
        name: BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? `_${Math.floor(i / BOT_NAMES.length)}` : ''),
      });
    }
  }

  getAliveCount(): number {
    return this.alive + (this.player.state.isDead ? 0 : 1);
  }
}
