import * as THREE from 'three';
import { BOT_COUNT, PLAYER_HEIGHT, BOT_SPAWN_RADIUS_MIN, BOT_SPAWN_RADIUS_MAX, BOT_LANDING_HEIGHT_MIN, BOT_LANDING_HEIGHT_MAX, REINFORCEMENT_WEAPON_CHANCE, WORLD_SIZE } from '../core/constants';
import { WorldGenerator } from '../world/WorldGenerator';
import { WeaponSystem } from '../weapons/WeaponSystem';
import { PlayerController } from '../player/PlayerController';
import { WaveConfig, WaveManager } from '../core/WaveManager';
import { BotMeshFactory } from '../rendering/BotMeshFactory';

// Re-export Bot so downstream imports don't break
export type { Bot } from './BotTypes';
import { type Bot, BOT_NAMES, randomPersonality, skillToLevel } from './BotTypes';
import { GrenadeSystem } from '../weapons/GrenadeSystem';
import { BotAIContext, updateLanding, updateRoaming, updateLooting, updateFighting, updateFleeing, updateWalkAnimation, updateBotDriving } from './BotAI';
import { checkBulletHits as combatCheckBulletHits, damageBotDirect, BotCombatCallbacks } from './BotCombat';

export class BotSystem {
  bots: Bot[] = [];
  private world: WorldGenerator;
  private weaponSystem: WeaponSystem;
  private player: PlayerController;
  private scene: THREE.Scene;
  private waveManager: WaveManager | null = null;
  private vehicles: import('../vehicles/VehicleSystem').Vehicle[] = [];
  alive = BOT_COUNT;
  killFeed: { killer: string; victim: string; weapon: string; time: number }[] = [];

  weatherDetectionMultiplier = 1.0;
  private grenadeSystem: GrenadeSystem | null = null;

  onBotHit: ((position: THREE.Vector3, isHeadshot: boolean, damage: number) => void) | null = null;
  onBotDeath: ((position: THREE.Vector3) => void) | null = null;
  onPlayerHit: ((fromPosition: THREE.Vector3) => void) | null = null;

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

  setWaveManager(wm: WaveManager): void {
    this.waveManager = wm;
  }

  setVehicles(vehicles: import('../vehicles/VehicleSystem').Vehicle[]): void {
    this.vehicles = vehicles;
  }

  setGrenadeSystem(gs: GrenadeSystem): void {
    this.grenadeSystem = gs;
  }

  private getAIContext(): BotAIContext {
    return {
      player: this.player,
      world: this.world,
      weaponSystem: this.weaponSystem,
      scene: this.scene,
      bots: this.bots,
      weatherDetectionMultiplier: this.weatherDetectionMultiplier,
      grenadeSystem: this.grenadeSystem,
    };
  }

  spawn(): void {
    const lootTime = this.waveManager ? this.waveManager.getLootingTime(1) : 20;
    for (let i = 0; i < BOT_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = BOT_SPAWN_RADIUS_MIN + Math.random() * (BOT_SPAWN_RADIUS_MAX - BOT_SPAWN_RADIUS_MIN);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const h = this.world.getHeightAt(x, z);

      const skill = 0.3 + Math.random() * 0.7;
      const group = BotMeshFactory.create(skill);

      // Start slightly high for landing animation
      const spawnY = h + 0.6 + PLAYER_HEIGHT + BOT_LANDING_HEIGHT_MIN + Math.random() * (BOT_LANDING_HEIGHT_MAX - BOT_LANDING_HEIGHT_MIN);
      group.position.set(x, spawnY, z);
      this.scene.add(group);

      // Wave 1: all bots unarmed, start looting
      const personality = randomPersonality();
      this.bots.push({
        id: `bot_${i}`,
        position: new THREE.Vector3(x, spawnY, z),
        velocity: new THREE.Vector3(0, 0, 0),
        health: 100,
        armor: Math.random() < 0.3 ? 50 : 0,
        isDead: false,
        weaponId: null,
        mesh: group,
        targetPos: null,
        state: 'landing',
        stateTimer: 2 + Math.random() * 5,
        fireTimer: 0,
        detectionRange: 20 + skill * 30,
        accuracy: 0.3 + skill * 0.5,
        skill,
        name: BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? `_${Math.floor(i / BOT_NAMES.length)}` : ''),
        lootingTimeLeft: lootTime,
        inBuilding: false,
        flashlight: null,
        personality,
        level: skillToLevel(skill),
        deathTime: 0,
        inVehicle: false,
        vehicleRef: null,
      });
    }
  }

  update(delta: number): void {
    const ctx = this.getAIContext();

    for (const bot of this.bots) {
      if (bot.isDead) continue;

      bot.stateTimer -= delta;
      if (bot.fireTimer > 0) bot.fireTimer -= delta;
      // Decrement looting timer over time
      if (bot.lootingTimeLeft > 0) bot.lootingTimeLeft -= delta;

      // Check if bot is inside a building (spatial grid lookup)
      const nearbyBuildings = this.world.getNearbyBuildings(bot.position.x, bot.position.z);
      bot.inBuilding = nearbyBuildings.some(b =>
        bot.position.x >= b.x && bot.position.x <= b.x + b.width &&
        bot.position.z >= b.z && bot.position.z <= b.z + b.depth
      );

      // Vehicle boarding check: skilled armed bots board nearby empty vehicles
      if (!bot.inVehicle && bot.weaponId && bot.skill > 0.5 && bot.state !== 'landing' && this.vehicles.length > 0) {
        for (const v of this.vehicles) {
          if (v.isOccupied || v.health <= 0 || v.fuel <= 0 || v.type === 'helicopter') continue;
          const dist = bot.position.distanceTo(v.position);
          if (dist < 15) {
            v.isOccupied = true;
            v.occupantId = bot.id;
            bot.inVehicle = true;
            bot.vehicleRef = v;
            bot.mesh.visible = false;
            bot.state = 'driving';
            bot.stateTimer = 20 + Math.random() * 20;
            break;
          }
        }
      }

      // State machine -- delegates to BotAI functions
      switch (bot.state) {
        case 'landing':
          updateLanding(bot, delta, ctx);
          break;
        case 'roaming':
          updateRoaming(bot, delta, ctx);
          break;
        case 'looting':
          updateLooting(bot, delta, ctx);
          break;
        case 'fighting':
          updateFighting(bot, delta, ctx);
          break;
        case 'fleeing':
          updateFleeing(bot, delta, ctx);
          break;
        case 'driving':
          updateBotDriving(bot, delta, ctx.player.state.position, this.world);
          break;
      }

      // Ground collision -- snap to terrain/building height (bots always walk on ground)
      if (bot.state !== 'landing' && !bot.inVehicle) {
        const groundH = this.world.getEffectiveHeightAt(bot.position.x, bot.position.z);
        const surfaceY = groundH + 0.6;
        bot.position.y = surfaceY; // Always snap to ground -- no floating
      }

      // Building collision for bots -- only check when bot is moving and not in vehicle
      const isMovingBot = !bot.inVehicle && (bot.velocity.x !== 0 || bot.velocity.z !== 0);
      if (isMovingBot && bot.state !== 'landing') {
        for (const b of this.world.getNearbyBuildings(bot.position.x, bot.position.z)) {
          if (
            bot.position.x > b.x + 0.3 && bot.position.x < b.x + b.width - 0.3 &&
            bot.position.z > b.z + 0.3 && bot.position.z < b.z + b.depth - 0.3
          ) {
            const baseH = this.world.getHeightAt(b.x, b.z);
            if (bot.position.y < baseH + b.height) {
              // Door exception
              const doorX = b.x + Math.floor(b.width / 2);
              const isDoor =
                Math.abs(bot.position.x - doorX) < 1.5 &&
                Math.abs(bot.position.z - b.z) < 1.5;
              if (!isDoor) {
                // Push bot out -- find shortest exit axis
                const cx = b.x + b.width / 2;
                const cz = b.z + b.depth / 2;
                const dx = bot.position.x - cx;
                const dz = bot.position.z - cz;
                if (Math.abs(dx) > Math.abs(dz)) {
                  bot.position.x = dx > 0 ? b.x + b.width + 0.5 : b.x - 0.5;
                } else {
                  bot.position.z = dz > 0 ? b.z + b.depth + 0.5 : b.z - 0.5;
                }
              }
            }
          }
        }
      }

      // Map bounds -- use full world radius so bots roam the entire map
      const botBound = WORLD_SIZE * 0.45;
      bot.position.x = Math.max(-botBound, Math.min(botBound, bot.position.x));
      bot.position.z = Math.max(-botBound, Math.min(botBound, bot.position.z));

      // Update mesh (driving bots: vehicle mesh drives position; bot mesh is hidden)
      if (!bot.inVehicle) {
        bot.mesh.position.copy(bot.position);
      }

      // Walking animation (not while driving)
      if (!bot.inVehicle) updateWalkAnimation(bot);
    }

    // Clean up dead bot meshes after 5 seconds; eject from vehicle on death
    const now = Date.now();
    for (const bot of this.bots) {
      if (bot.isDead) {
        // Eject from vehicle if still marked as driver
        if (bot.inVehicle && bot.vehicleRef) {
          bot.vehicleRef.isOccupied = false;
          bot.vehicleRef.occupantId = null;
          bot.vehicleRef.speed = 0;
          bot.vehicleRef = null;
          bot.inVehicle = false;
          bot.mesh.visible = true;
        }
        if (bot.deathTime > 0 && now - bot.deathTime > 5000) {
          this.scene.remove(bot.mesh);
          BotMeshFactory.dispose(bot.mesh);
          bot.deathTime = 0; // Mark as cleaned
        }
      }
    }
  }

  checkBulletHits(bullets: { position: THREE.Vector3; damage: number; ownerId: string }[]): void {
    const callbacks: BotCombatCallbacks = {
      onBotHit: this.onBotHit,
      onBotDeath: this.onBotDeath,
      onPlayerHit: this.onPlayerHit,
    };
    combatCheckBulletHits(bullets, this.bots, this.player, this.weaponSystem, this.killFeed, this, callbacks);
  }

  damageBot(botId: string, damage: number, killerId: string): void {
    damageBotDirect(botId, damage, killerId, this.bots, this.player, this.weaponSystem, this.killFeed, this);
  }

  respawnForWave(config: WaveConfig): void {
    for (const bot of this.bots) {
      this.scene.remove(bot.mesh);
      BotMeshFactory.dispose(bot.mesh);
    }
    this.bots = [];
    this.alive = config.botCount;

    const wave = this.waveManager ? this.waveManager.currentWave : 1;
    const lootTime = this.waveManager ? this.waveManager.getLootingTime(wave) : 15;

    for (let i = 0; i < config.botCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = BOT_SPAWN_RADIUS_MIN + Math.random() * (BOT_SPAWN_RADIUS_MAX - BOT_SPAWN_RADIUS_MIN);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const h = this.world.getHeightAt(x, z);

      const skill = config.botSkillMin + Math.random() * (config.botSkillMax - config.botSkillMin);
      const group = BotMeshFactory.create(skill);

      const spawnY = h + 0.6 + BOT_LANDING_HEIGHT_MIN + Math.random() * (BOT_LANDING_HEIGHT_MAX - BOT_LANDING_HEIGHT_MIN);
      group.position.set(x, spawnY, z);
      this.scene.add(group);

      const weapons = ['pistol', 'smg', 'assault', 'shotgun', 'sniper'];
      const hasWeapon = Math.random() < config.botWeaponChance;
      const weaponId = hasWeapon ? weapons[Math.floor(Math.random() * weapons.length)] : null;

      const hasArmor = Math.random() < config.botArmorChance;
      const wavePersonality = randomPersonality();
      this.bots.push({
        id: `bot_w${i}_${Date.now()}`,
        position: new THREE.Vector3(x, spawnY, z),
        velocity: new THREE.Vector3(0, 0, 0),
        health: 100 + (config.botHealthBonus || 0),
        armor: hasArmor ? 50 + (config.botArmorBonus || 0) : 0,
        isDead: false,
        weaponId,
        mesh: group,
        targetPos: null,
        state: 'landing',
        stateTimer: 2 + Math.random() * 5,
        fireTimer: 0,
        detectionRange: 20 + skill * 30,
        accuracy: 0.3 + skill * 0.5,
        skill,
        name: BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? `_${Math.floor(i / BOT_NAMES.length)}` : ''),
        lootingTimeLeft: lootTime,
        inBuilding: false,
        flashlight: null,
        personality: wavePersonality,
        level: skillToLevel(skill),
        deathTime: 0,
        inVehicle: false,
        vehicleRef: null,
      });
    }
  }

  spawnReinforcements(count: number): void {
    const weapons = ['pistol', 'smg', 'assault', 'shotgun', 'sniper'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = BOT_SPAWN_RADIUS_MIN + Math.random() * (BOT_SPAWN_RADIUS_MAX - BOT_SPAWN_RADIUS_MIN);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const h = this.world.getHeightAt(x, z);
      if (h <= 4) continue;

      const skill = 0.3 + Math.random() * 0.7;
      const group = BotMeshFactory.create(skill);
      const spawnY = h + 0.6 + BOT_LANDING_HEIGHT_MIN + Math.random() * (BOT_LANDING_HEIGHT_MAX - BOT_LANDING_HEIGHT_MIN);
      group.position.set(x, spawnY, z);
      this.scene.add(group);

      const hasWeapon = Math.random() < REINFORCEMENT_WEAPON_CHANCE;
      const weaponId = hasWeapon ? weapons[Math.floor(Math.random() * weapons.length)] : null;

      this.bots.push({
        id: `reinforce_${Date.now()}_${i}`,
        position: new THREE.Vector3(x, spawnY, z),
        velocity: new THREE.Vector3(0, 0, 0),
        health: 100, armor: Math.random() < 0.3 ? 50 : 0,
        isDead: false, weaponId,
        mesh: group, targetPos: null,
        state: 'landing' as const,
        stateTimer: 2, fireTimer: 0,
        detectionRange: 20 + skill * 30,
        accuracy: 0.3 + skill * 0.5, skill,
        name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + '_' + Math.floor(Math.random() * 100),
        lootingTimeLeft: 5 + Math.random() * 5,
        inBuilding: false, flashlight: null,
        personality: randomPersonality(),
        level: skillToLevel(skill),
        deathTime: 0,
        inVehicle: false,
        vehicleRef: null,
      });
      this.alive++;
    }
  }

  setNightMode(_isNight: boolean): void {
    // PointLight per bot is too expensive (40+ lights kills GPU)
    // Night mode is handled by DayNightSystem ambient lighting only
  }

  getAliveCount(): number {
    return this.alive + (this.player.state.isDead ? 0 : 1);
  }
}
