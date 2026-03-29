import * as THREE from 'three';
import { WorldGenerator } from '../world/WorldGenerator';
import { PlayerController } from '../player/PlayerController';
import { WeaponSystem } from '../weapons/WeaponSystem';
import { GrenadeSystem } from '../weapons/GrenadeSystem';
import { BotSystem } from '../bots/BotSystem';
import { BossSystem } from '../ai/BossSystem';
import { ZoneSystem } from '../zone/ZoneSystem';
import { VehicleSystem } from '../vehicles/VehicleSystem';
import { WaveManager } from './WaveManager';
import { ScoreboardSystem } from '../score/ScoreboardSystem';
import { SoundManager } from '../audio/SoundManager';
import { ParticleSystem } from '../effects/ParticleSystem';
import { WeatherSystem } from '../world/WeatherSystem';
import { DayNightSystem } from '../world/DayNightSystem';
import { BiomeSystem } from '../world/BiomeSystem';
import { AnimalSystem } from '../world/AnimalSystem';
import { SkinSystem } from '../shop/SkinSystem';
import {
  WORLD_SIZE,
  PLAYER_HEAL_BETWEEN_WAVES,
  WEAPONS,
  REINFORCEMENT_FIRST_DELAY,
  REINFORCEMENT_INTERVAL,
  REINFORCEMENT_MIN_ALIVE,
  REINFORCEMENT_MIN_COUNT,
  REINFORCEMENT_MAX_EXTRA,
  PLANE_ALTITUDE,
  PLANE_SPEED,
  PLANE_AUTO_DROP_TIME,
  DROP_SPEED_FREEFALL,
  DROP_SPEED_PARACHUTE,
} from './constants';

export type GamePhase = 'lobby' | 'plane' | 'dropping' | 'playing' | 'wave_transition' | 'dead';

export interface GameState {
  phase: GamePhase;
  playersAlive: number;
  kills: number;
  gameTime: number;
  currentWave: number;
  totalKills: number;
  killStreak: number;
  bestKillStreak: number;
}

export class GameEngine {
  private renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  private container: HTMLElement;

  world: WorldGenerator;
  player: PlayerController;
  weaponSystem: WeaponSystem;
  grenadeSystem: GrenadeSystem;
  botSystem: BotSystem;
  zoneSystem: ZoneSystem;
  vehicleSystem: VehicleSystem;
  waveManager: WaveManager;
  scoreboardSystem: ScoreboardSystem;
  soundManager: SoundManager;
  particleSystem: ParticleSystem;
  weatherSystem: WeatherSystem;
  dayNightSystem: DayNightSystem;
  biomeSystem: BiomeSystem;
  animalSystem: AnimalSystem;
  bossSystem: BossSystem;

  gameState: GameState = {
    phase: 'lobby',
    playersAlive: 40,
    kills: 0,
    gameTime: 0,
    currentWave: 1,
    totalKills: 0,
    killStreak: 0,
    bestKillStreak: 0,
  };

  private planePosition = new THREE.Vector3();
  private planeDirection = new THREE.Vector3();
  private planeTimer = 0;
  dropSpeed = 55;
  private parachuteOpen = false;
  private planeMesh: THREE.Group | null = null;
  private playerDropMesh: THREE.Group | null = null;

  // Flash effect
  flashTimer = 0;

  // Damage direction indicator
  lastDamageFrom: THREE.Vector3 | null = null;
  lastDamageTime = 0;

  // Reusable temp vectors
  private _tmpBehind = new THREE.Vector3();
  private _tmpSide = new THREE.Vector3();

  // Bot footstep timer
  private botFootstepTimer = 0;

  // Kill streak tracking
  private killStreakTimer = 0;
  private lastKillCount = 0;

  // Reinforcement plane system -- periodic bot drops
  private reinforcementTimer = REINFORCEMENT_FIRST_DELAY;
  private reinforcementInterval = REINFORCEMENT_INTERVAL;

  isPaused = false;

  private _onPointerLockChange: (() => void) | null = null;

  skinSystem: SkinSystem = new SkinSystem();
  reviveOffered = false;
  reviveTimer = 0;

  onStateChange: ((state: GameState) => void) | null = null;
  private _onResize: () => void = () => {};

  constructor(container: HTMLElement) {
    this.container = container;

    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2));
    this.renderer.shadowMap.enabled = !isMobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0006);

    this.camera = new THREE.PerspectiveCamera(
      70, container.clientWidth / container.clientHeight, 0.1, 4000
    );

    this.clock = new THREE.Clock();
    this.setupLighting();

    this.world = new WorldGenerator(this.scene, 42);
    this.player = new PlayerController(this.camera, this.world, this.scene);
    this.weaponSystem = new WeaponSystem(this.scene, this.player, this.world);
    this.grenadeSystem = new GrenadeSystem(this.scene, this.player, this.world);
    this.botSystem = new BotSystem(this.scene, this.world, this.weaponSystem, this.player);
    this.zoneSystem = new ZoneSystem(this.scene, this.player);
    this.vehicleSystem = new VehicleSystem(this.scene, this.world, this.player);
    this.waveManager = new WaveManager();
    this.scoreboardSystem = new ScoreboardSystem();
    this.soundManager = new SoundManager();
    this.particleSystem = new ParticleSystem(this.scene);
    this.weatherSystem = new WeatherSystem(this.scene);
    this.biomeSystem = new BiomeSystem();
    this.dayNightSystem = new DayNightSystem(this.scene);
    this.animalSystem = new AnimalSystem(this.scene, this.world, this.biomeSystem);
    this.bossSystem = new BossSystem();

    this._onResize = () => this.onResize();
    window.addEventListener('resize', this._onResize);
  }

  private setupLighting(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.4);
    sun.position.set(100, 150, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 1200;
    sun.shadow.camera.left = -400;
    sun.shadow.camera.right = 400;
    sun.shadow.camera.top = 400;
    sun.shadow.camera.bottom = -400;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x556B2F, 0.4));
  }

  private createPlaneMesh(): THREE.Group {
    const g = new THREE.Group();
    // Fuselage
    g.add(Object.assign(new THREE.Mesh(
      new THREE.BoxGeometry(3, 3, 20),
      new THREE.MeshLambertMaterial({ color: 0x8a8a8a })
    ), {}));
    // Cockpit
    const cp = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1.5, 3),
      new THREE.MeshLambertMaterial({ color: 0x4488cc, transparent: true, opacity: 0.6 })
    );
    cp.position.set(0, 1.5, -8);
    g.add(cp);
    // Wings
    const w = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.4, 5),
      new THREE.MeshLambertMaterial({ color: 0x7a7a7a })
    );
    w.position.set(0, 0, -1);
    g.add(w);
    // Tail
    const t = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 6, 4),
      new THREE.MeshLambertMaterial({ color: 0x7a7a7a })
    );
    t.position.set(0, 3, 8);
    g.add(t);
    const hs = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.3, 3),
      new THREE.MeshLambertMaterial({ color: 0x7a7a7a })
    );
    hs.position.set(0, 0, 8);
    g.add(hs);
    // Engines
    const eMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const eGeo = new THREE.BoxGeometry(1.5, 1.5, 3);
    const le = new THREE.Mesh(eGeo, eMat); le.position.set(-7, -1.2, -1); g.add(le);
    const re = new THREE.Mesh(eGeo, eMat); re.position.set(7, -1.2, -1); g.add(re);
    // Stripe
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, 0.5, 0.1),
      new THREE.MeshLambertMaterial({ color: 0xcc3333 })
    );
    s.position.set(0, 0, -10);
    g.add(s);
    return g;
  }

  async init(): Promise<void> {
    this.world.generate();
    this.weaponSystem.spawnItems(this.world.itemSpawns);
    this.player.init(this.container);
    this.weaponSystem.init();
    this.grenadeSystem.init();
    this.botSystem.spawn();
    this.vehicleSystem.init();
    this.vehicleSystem.spawnVehicles(20);
    this.vehicleSystem.onHonk = () => {
      this.soundManager.playHorn();
    };

    this.animalSystem.spawn();

    this.planeMesh = this.createPlaneMesh();
    this.planeMesh.visible = false;
    this.scene.add(this.planeMesh);

    // Parachute mesh
    const pg = new THREE.Group();
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(4, 2, 4),
      new THREE.MeshLambertMaterial({ color: 0xff6600, transparent: true, opacity: 0.8 })
    );
    canopy.position.y = 5;
    pg.add(canopy);
    this.playerDropMesh = pg;
    this.playerDropMesh.visible = false;
    this.scene.add(this.playerDropMesh);

    // Zone bot kill callback -> decrement alive
    this.zoneSystem.onBotKill = (_botId: string) => {
      this.botSystem.alive = Math.max(0, this.botSystem.alive - 1);
    };

    // Grenade explosion callback
    this.grenadeSystem.onExplosion = (pos, _damage, radius, type) => {
      if (type === 'flash') this.flashTimer = 2.0;
      if (type === 'frag') {
        this.particleSystem.emitExplosion(pos, radius);
        const dist = pos.distanceTo(this.player.state.position);
        const vol = Math.max(0, 1 - dist / 300);
        if (vol > 0) {
          this.soundManager.playExplosion();
        }
        // Camera shake based on proximity
        if (dist < 30) {
          this.player.addShake(0.3 * (1 - dist / 30));
        }
      }
    };

    // Grenade bot kill callback -> decrement alive
    this.grenadeSystem.onBotKill = (_botId: string) => {
      this.botSystem.alive = Math.max(0, this.botSystem.alive - 1);
      this.scoreboardSystem.recordKill(false);
      this.player.state.kills++;
      this.soundManager.playKillConfirm();
    };

    // Player fire callback
    this.weaponSystem.onFire = (weaponType, pos, dir) => {
      this.soundManager.playGunshot(weaponType);
      this.particleSystem.emitMuzzleFlash(pos, dir);
      const weaponDef = WEAPONS[weaponType];
      if (weaponDef) {
        this.player.applyRecoil(weaponDef.recoilVertical, weaponDef.recoilHorizontal);
      }
    };

    // Bot fire callback -- 3D positional audio
    this.weaponSystem.onBotFire = (pos, _dir, weaponType) => {
      this.soundManager.playGunshot3D(
        weaponType,
        pos,
        this.player.state.position,
        this.player.getYaw()
      );
    };

    // Item pickup callback
    this.weaponSystem.onPickup = (pos) => {
      this.soundManager.playPickup();
      this.particleSystem.emitPickupGlow(pos);
    };

    // Bot hit callback
    this.botSystem.onBotHit = (pos, isHeadshot) => {
      this.particleSystem.emitHitSpark(pos);
      this.particleSystem.emitBlood(pos);
      if (isHeadshot) this.soundManager.playHeadshot();
      this.player.addShake(0.1);
    };

    // Bot death callback
    this.botSystem.onBotDeath = (pos) => {
      this.particleSystem.emitDeath(pos);
    };

    // Player hit callback
    this.botSystem.onPlayerHit = (fromPos) => {
      this.soundManager.playDamageTaken();
      this.player.addShake(0.2);
      this.lastDamageFrom = fromPos.clone();
      this.lastDamageTime = Date.now();
    };

    // Melee attack callback
    this.weaponSystem.onMelee = (pos) => {
      this.soundManager.playDamageTaken(); // impact sound
      this.player.addShake(0.15);
      const fwd = this.player.getForwardDirection();
      const meleeTarget = pos.clone().add(fwd.clone().multiplyScalar(2));
      const meleeDamage = this.weaponSystem.weapons[this.weaponSystem.activeSlot] ? 35 : 20;
      for (const bot of this.botSystem.bots) {
        if (bot.isDead) continue;
        if (bot.position.distanceTo(meleeTarget) < 2.5) {
          bot.health -= meleeDamage;
          this.particleSystem.emitHitSpark(bot.position.clone());
          if (bot.health <= 0 && !bot.isDead) {
            bot.isDead = true;
            bot.health = 0;
            bot.mesh.rotation.x = Math.PI / 2;
            this.botSystem.alive = Math.max(0, this.botSystem.alive - 1);
            this.player.state.kills++;
            this.scoreboardSystem.recordKill(false);
            this.particleSystem.emitDeath(bot.position.clone());
            this.soundManager.playKillConfirm();
            bot.deathTime = Date.now();
            const meleeKillerName = (typeof localStorage !== 'undefined' && localStorage.getItem('blitzpit_name')) || 'You';
            this.botSystem.killFeed.push({
              killer: meleeKillerName, victim: bot.name, weapon: 'Melee', time: Date.now()
            });
          }
          break;
        }
      }
    };

    // Footstep callback
    this.player.onFootstep = () => {
      const groundH = this.world.getHeightAt(this.player.state.position.x, this.player.state.position.z);
      if (groundH <= 4) {
        this.soundManager.playFootstep('water');
        return;
      }
      const biome = this.biomeSystem.getBiome(this.player.state.position.x, this.player.state.position.z);
      const terrain = biome === 'tundra' ? 'snow' : biome === 'desert' ? 'sand' : biome === 'urban' ? 'concrete' : 'grass';
      this.soundManager.playFootstep(terrain);
    };

    // Zone shrink start callback
    this.zoneSystem.onShrinkStart = () => {
      this.soundManager.playZoneWarning();
    };

    // Zone outside warning callback
    this.zoneSystem.onPlayerOutsideZone = () => {
      this.soundManager.playZoneWarning();
    };

    // ESC pause via pointerlock
    this._onPointerLockChange = () => {
      if (!document.pointerLockElement && this.gameState.phase === 'playing') {
        this.isPaused = true;
      }
    };
    document.addEventListener('pointerlockchange', this._onPointerLockChange);

    this.botSystem.setWaveManager(this.waveManager);

    this.player.mesh.visible = false;
    const spawnH = this.world.getHeightAt(0, 0);
    this.player.state.position.set(0, spawnH + 50, 0);

    this.camera.position.set(0, 60, 80);
    this.camera.lookAt(0, 10, 0);

    this.gameState.phase = 'lobby';
    this.gameState.currentWave = 1;
    this.waveManager.currentWave = 1;
    this.notifyStateChange();

    // Apply purchased skin to player mesh
    this.skinSystem.applySkinToMesh(this.player.mesh);
  }

  startGame(): void {
    this.gameState.phase = 'plane';
    const angle = Math.random() * Math.PI * 2;
    const edge = WORLD_SIZE / 2 * 0.8;
    this.planePosition.set(Math.cos(angle) * edge, PLANE_ALTITUDE, Math.sin(angle) * edge);
    this.planeDirection.set(-Math.cos(angle), 0, -Math.sin(angle)).normalize();
    this.planeTimer = 0;
    this.player.state.position.copy(this.planePosition);
    this.player.mesh.visible = false;
    if (this.planeMesh) {
      this.planeMesh.visible = true;
      this.planeMesh.position.copy(this.planePosition);
      this.planeMesh.rotation.y = Math.atan2(this.planeDirection.x, this.planeDirection.z) + Math.PI;
    }
    this.notifyStateChange();
  }

  drop(): void {
    if (this.gameState.phase !== 'plane') return;
    this.gameState.phase = 'dropping';
    this.parachuteOpen = false;
    this.dropSpeed = DROP_SPEED_FREEFALL;
    this.player.state.velocity.set(
      this.planeDirection.x * 20, -this.dropSpeed, this.planeDirection.z * 20
    );
    const yaw = Math.atan2(-this.planeDirection.x, -this.planeDirection.z);
    this.player.setYaw(yaw);
    this.player.mesh.visible = true;
    if (this.planeMesh) this.planeMesh.visible = false;
    this.notifyStateChange();
  }

  openParachute(): void {
    if (this.gameState.phase !== 'dropping') return;
    this.parachuteOpen = true;
    this.dropSpeed = DROP_SPEED_PARACHUTE;
    if (this.playerDropMesh) this.playerDropMesh.visible = true;
  }

  // Mobile API methods
  movePlayer(dx: number, dz: number): void {
    this.player.setMobileInput(dx, dz);
  }

  rotateCamera(dx: number, dy: number): void {
    this.player.addRotation(dx, dy);
  }

  fireWeapon(): void {
    this.weaponSystem.triggerFire();
  }

  stopFire(): void {
    this.weaponSystem.stopFire();
  }

  throwGrenadeAction(): void {
    this.grenadeSystem.throwGrenade();
  }

  private updatePlane(delta: number): void {
    this.planeTimer += delta;
    const speed = PLANE_SPEED * delta;
    this.planePosition.x += this.planeDirection.x * speed;
    this.planePosition.y += this.planeDirection.y * speed;
    this.planePosition.z += this.planeDirection.z * speed;
    this.player.state.position.copy(this.planePosition);
    if (this.planeMesh) {
      this.planeMesh.position.copy(this.planePosition);
      // Plane model faces -Z, so we rotate Y to match flight direction
      this.planeMesh.rotation.y = Math.atan2(this.planeDirection.x, this.planeDirection.z) + Math.PI;
    }

    // 3rd person camera BEHIND the plane
    this.camera.position.set(
      this.planePosition.x - this.planeDirection.x * 40,
      this.planePosition.y + 12,
      this.planePosition.z - this.planeDirection.z * 40
    );
    // Look ahead of the plane
    this._tmpBehind.copy(this.planePosition).addScaledVector(this.planeDirection, 30);
    this.camera.lookAt(this._tmpBehind);

    if (this.planeTimer > PLANE_AUTO_DROP_TIME ||
        Math.abs(this.planePosition.x) > WORLD_SIZE * 0.6 ||
        Math.abs(this.planePosition.z) > WORLD_SIZE * 0.6) {
      this.drop();
    }
  }

  private updateDropping(delta: number): void {
    const groundH = this.world.getHeightAt(this.player.state.position.x, this.player.state.position.z);

    // No safety net -- if you don't open parachute, you take fall damage on landing

    // WASD horizontal steering during drop
    const keys = this.player.keys;
    const yaw = this.player.getYaw();
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
    const moveDir = new THREE.Vector3();
    if (keys.has('KeyW')) moveDir.add(forward);
    if (keys.has('KeyS')) moveDir.sub(forward);
    if (keys.has('KeyA')) moveDir.sub(right);
    if (keys.has('KeyD')) moveDir.add(right);
    if (moveDir.length() > 0) moveDir.normalize();

    const horizontalSpeed = this.parachuteOpen ? 8 : 15;

    this.player.state.position.y -= this.dropSpeed * delta;
    if (moveDir.length() > 0) {
      this.player.state.position.x += moveDir.x * horizontalSpeed * delta;
      this.player.state.position.z += moveDir.z * horizontalSpeed * delta;
    } else if (!this.parachuteOpen) {
      this.player.state.position.x += this.player.state.velocity.x * delta * 0.3;
      this.player.state.position.z += this.player.state.velocity.z * delta * 0.3;
    }

    this.player.mesh.position.copy(this.player.state.position);
    if (this.playerDropMesh && this.parachuteOpen) {
      this.playerDropMesh.position.copy(this.player.state.position);
    }

    // Camera: top-down during freefall, follow behind with parachute
    if (!this.parachuteOpen) {
      // Top-down camera looking down at landing zone
      this.camera.position.set(
        this.player.state.position.x,
        this.player.state.position.y + 20,
        this.player.state.position.z + 10
      );
      this.camera.lookAt(
        this.player.state.position.x,
        groundH,
        this.player.state.position.z
      );
    } else {
      const yaw = this.player.getYaw();
      this.camera.position.set(
        this.player.state.position.x + Math.sin(yaw) * 12,
        this.player.state.position.y + 8,
        this.player.state.position.z + Math.cos(yaw) * 12
      );
      this.camera.lookAt(this.player.state.position);
    }

    if (this.player.state.position.y <= groundH + 0.6) {
      this.player.state.position.y = groundH + 0.6;
      // Fall damage based on landing speed -- no parachute = death
      if (!this.parachuteOpen) {
        // Freefall at 55 m/s = instant death
        this.player.takeDamage(200);
        this.soundManager.playExplosion();
        this.player.addShake(0.5);
      } else if (this.dropSpeed > 12) {
        // Hard landing
        this.player.takeDamage(20);
        this.player.addShake(0.3);
      }
      this.player.state.velocity.set(0, 0, 0);
      this.player.state.isGrounded = true;
      this.gameState.phase = 'playing';
      this.player.mesh.visible = true;
      if (this.planeMesh) this.planeMesh.visible = false;
      if (this.playerDropMesh) this.playerDropMesh.visible = false;
      this.soundManager.playWaveStart();
      this.notifyStateChange();
    }
  }

  private startNextWave(): void {
    const wave = this.waveManager.nextWave();
    const config = this.waveManager.getWaveConfig(wave);

    // Zone reset with new speed multiplier
    this.zoneSystem.reset();
    this.zoneSystem.speedMultiplier = config.zoneShrinkSpeedMultiplier;

    // Clean up old items from previous wave
    for (const item of this.weaponSystem.items) {
      if (!item.collected) {
        item.collected = true;
        this.scene.remove(item.mesh);
      }
      // Dispose mesh resources
      if (item.mesh.geometry) item.mesh.geometry.dispose();
      if (item.mesh.material instanceof THREE.Material) item.mesh.material.dispose();
    }
    this.weaponSystem.items = [];

    // Clear bullets and grenades
    this.weaponSystem.clearBullets();
    this.grenadeSystem.clearAll();

    // Refuel and repair vehicles
    for (const v of this.vehicleSystem.vehicles) {
      v.fuel = 100;
      v.health = v.type === 'truck' ? 200 : 150;
    }

    // Respawn bots
    this.botSystem.respawnForWave(config);

    // Boss spawn check
    const bossTypes = this.bossSystem.shouldSpawnBoss(wave);
    for (const type of bossTypes) {
      const boss = this.bossSystem.createBoss(type, wave, this.scene, this.world);
      this.botSystem.bots.push(boss);
      this.botSystem.alive++;
    }
    this.bossSystem.updatePhases();

    // Spawn new weapons
    this.weaponSystem.spawnItems(this.world.itemSpawns);

    // Animal respawn
    this.animalSystem.destroy();
    this.animalSystem.spawn();

    // Heal player
    this.player.heal(PLAYER_HEAL_BETWEEN_WAVES);

    // Award Wild Points for wave clear (doubled if XP boost active)
    const waveWpGain = this.skinSystem.hasXPBoost() ? 100 : 50;
    this.skinSystem.purchases.blitzPoints += waveWpGain;
    this.skinSystem.save();

    // Achievement titles on wave milestones
    if (wave >= 10 && !this.skinSystem.owns('title_legend')) {
      this.skinSystem.purchases.ownedItems.push('title_legend');
      this.skinSystem.save();
    }
    if (wave >= 20 && !this.skinSystem.owns('title_godofwar')) {
      this.skinSystem.purchases.ownedItems.push('title_godofwar');
      this.skinSystem.save();
    }

    // Update scoreboard wave
    this.scoreboardSystem.updateWave(wave);

    this.gameState.phase = 'playing';
    this.gameState.currentWave = wave;
    this.gameState.playersAlive = this.botSystem.getAliveCount();

    this.particleSystem.emitWaveStart();
    this.soundManager.playWaveStart();

    this.notifyStateChange();
  }

  resume(): void {
    this.isPaused = false;
  }

  update(): void {
    if (this.isPaused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.gameState.gameTime += delta;
    if (this.flashTimer > 0) this.flashTimer -= delta;

    switch (this.gameState.phase) {
      case 'lobby': {
        const t = this.gameState.gameTime * 0.2;
        this.camera.position.set(Math.sin(t) * 200, 120, Math.cos(t) * 200);
        this.camera.lookAt(0, 10, 0);
        break;
      }
      case 'plane':
        this.updatePlane(delta);
        break;
      case 'dropping':
        this.updateDropping(delta);
        // Bots should still move during player drop (don't freeze mid-air)
        this.botSystem.update(delta);
        this.dayNightSystem.update(delta);
        break;
      case 'playing': {
        if (this.vehicleSystem.isPlayerInVehicle()) {
          this.vehicleSystem.update(delta);
          const v = this.vehicleSystem.playerVehicle;
          if (v) {
            // Roadkill -- vehicle hits bots
            if (Math.abs(v.speed) > 3) {
              for (const bot of this.botSystem.bots) {
                if (bot.isDead) continue;
                const dx = v.position.x - bot.position.x;
                const dz = v.position.z - bot.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < 2.5) {
                  const damage = Math.abs(v.speed) * 4;
                  bot.health -= damage;
                  v.speed *= 0.7;
                  this.particleSystem.emitHitSpark(bot.position.clone());
                  this.soundManager.playExplosion();
                  if (bot.health <= 0 && !bot.isDead) {
                    bot.isDead = true;
                    bot.health = 0;
                    bot.mesh.rotation.x = Math.PI / 2;
                    this.botSystem.alive = Math.max(0, this.botSystem.alive - 1);
                    this.player.state.kills++;
                    this.scoreboardSystem.recordKill(false);
                    this.particleSystem.emitDeath(bot.position.clone());
                    this.soundManager.playKillConfirm();
                    bot.deathTime = Date.now();
                    const vehicleKillerName = (typeof localStorage !== 'undefined' && localStorage.getItem('blitzpit_name')) || 'You';
                    this.botSystem.killFeed.push({
                      killer: vehicleKillerName, victim: bot.name, weapon: 'Vehicle', time: Date.now()
                    });
                  }
                }
              }
            }

            // Tree collision (speed > 5)
            if (Math.abs(v.speed) > 5) {
              for (let i = this.world.treePositions.length - 1; i >= 0; i--) {
                const tree = this.world.treePositions[i];
                const dx = v.position.x - tree.x;
                const dz = v.position.z - tree.z;
                if (Math.sqrt(dx * dx + dz * dz) < 2) {
                  this.particleSystem.emitDeath(tree.clone());
                  this.world.treePositions.splice(i, 1);
                  v.speed *= 0.85;
                  v.health -= 10;
                  break;
                }
              }
            }

            // Building collision is now handled in VehicleSystem.update() BEFORE movement

            // Vehicle camera: free-look with mouse (yaw/pitch from player)
            const vCamDist = 10;
            const vCamHeight = 4;
            const pYaw = this.player.yaw;
            const pPitch = this.player.pitch;
            this._tmpBehind.set(
              Math.sin(pYaw) * vCamDist * Math.cos(pPitch),
              vCamHeight - Math.sin(pPitch) * vCamDist,
              Math.cos(pYaw) * vCamDist * Math.cos(pPitch)
            );
            this.camera.position.copy(v.position).add(this._tmpBehind);
            // Look ahead of vehicle, not at vehicle center
            const vLookTarget = v.position.clone();
            vLookTarget.y += 1.5;
            this.camera.lookAt(vLookTarget);
            this.soundManager.playVehicleEngine(v.speed);
          }
        } else {
          this.player.update(delta);
          this.soundManager.stopVehicleEngine();
        }

        this.weaponSystem.update(delta);
        this.grenadeSystem.update(delta, this.botSystem.bots);
        this.botSystem.update(delta);
        this.bossSystem.updatePhases();
        this.zoneSystem.update(delta, this.botSystem.bots);
        this.particleSystem.update(delta);

        // Day/night cycle
        this.dayNightSystem.update(delta);
        // Night mode -- headlights and flashlights
        this.vehicleSystem.setNightMode(this.dayNightSystem.isNight);
        this.botSystem.setNightMode(this.dayNightSystem.isNight);

        // Biome effects on player
        const playerBiome = this.biomeSystem.getBiome(
          this.player.state.position.x,
          this.player.state.position.z
        );
        this.player.biomeSpeedMultiplier = this.biomeSystem.getSpeedMultiplier(playerBiome);

        // Animal update
        this.animalSystem.update(delta, this.player.state.position, this.dayNightSystem.isNight);

        // Animal attack damage
        const animalDmg = this.animalSystem.getAttackingAnimalDamage(this.player.state.position);
        if (animalDmg > 0) {
          this.player.takeDamage(animalDmg);
          this.soundManager.playDamageTaken();
          this.player.addShake(0.15);
        }

        // Environment damage from biome
        const envDmg = this.biomeSystem.getEnvironmentDamage(playerBiome, this.dayNightSystem.isNight, delta);
        if (envDmg > 0) {
          this.player.takeDamage(envDmg);
        }

        // Nearby bot footsteps (max 3 closest, performance guard)
        this.botFootstepTimer -= delta;
        if (this.botFootstepTimer <= 0) {
          this.botFootstepTimer = 0.4;
          const playerPos = this.player.state.position;
          const nearbyBots = this.botSystem.bots
            .filter(b => !b.isDead && b.state !== 'landing')
            .map(b => ({ bot: b, dist: b.position.distanceTo(playerPos) }))
            .filter(b => b.dist < 25)
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 3);
          for (const { bot } of nearbyBots) {
            const vol = this.soundManager.getDistanceVolume(playerPos, bot.position, 25);
            if (vol > 0.1) {
              const pan = this.soundManager.getStereoPan(playerPos, this.player.getYaw(), bot.position);
              const biome = this.biomeSystem.getBiome(bot.position.x, bot.position.z);
              const terrain = biome === 'tundra' ? 'snow' : biome === 'desert' ? 'sand' : biome === 'urban' ? 'concrete' : 'grass';
              this.soundManager.playFootstep3D(terrain, vol * 0.5, pan);
            }
          }
        }

        this.weatherSystem.update(delta, this.player.state.position, playerBiome);

        // Weather affects combat
        const weather = this.weatherSystem.currentWeather;
        if (weather === 'storm') {
          this.weaponSystem.weatherSpreadMultiplier = 1.3;
          this.botSystem.weatherDetectionMultiplier = 0.6;
        } else if (weather === 'rain') {
          this.weaponSystem.weatherSpreadMultiplier = 1.1;
          this.botSystem.weatherDetectionMultiplier = 0.8;
        } else if (weather === 'fog') {
          this.weaponSystem.weatherSpreadMultiplier = 1.0;
          this.botSystem.weatherDetectionMultiplier = 0.5;
        } else {
          this.weaponSystem.weatherSpreadMultiplier = 1.0;
          this.botSystem.weatherDetectionMultiplier = 1.0;
        }

        // Reinforcement plane -- spawn new bots periodically to keep the battlefield alive
        this.updateReinforcements(delta);

        // Rain ambient sound
        if (this.weatherSystem.currentWeather === 'rain' || this.weatherSystem.currentWeather === 'storm') {
          this.soundManager.playRainAmbient();
        } else {
          this.soundManager.stopRainAmbient();
        }

        // Check bullet hits and track particle/sound effects
        const bullets = this.weaponSystem.getBullets();
        const prevKills = this.player.state.kills;
        this.botSystem.checkBulletHits(bullets);

        // Bullet-animal collision
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
          const bullet = bullets[bi];
          if (bullet.ownerId !== 'player') continue;
          for (const animal of this.animalSystem.animals) {
            if (animal.state === 'dead') continue;
            if (bullet.position.distanceTo(animal.position) < 1.5) {
              const killed = this.animalSystem.damageAnimal(animal.id, bullet.damage);
              this.particleSystem.emitBlood(animal.position.clone());
              if (killed) {
                this.particleSystem.emitDeath(animal.position.clone());
                this.soundManager.playKillConfirm();
              }
              this.weaponSystem.removeBullet(bi);
              break;
            }
          }
        }

        const newKills = this.player.state.kills;

        if (newKills > prevKills) {
          const killsDelta = newKills - prevKills;
          for (let k = 0; k < killsDelta; k++) {
            this.scoreboardSystem.recordKill(false);
            this.soundManager.playKillConfirm();
            // Award Wild Points per kill (doubled if XP boost active)
            let wpGain = 10;
            if (this.skinSystem.hasXPBoost()) wpGain *= 2;
            this.skinSystem.purchases.blitzPoints += wpGain;
          }

          // Boss kill reward + WP bonus (rewardClaimed prevents duplicate)
          const killedBoss = this.bossSystem.bosses.find(b => b.isDead && !b.rewardClaimed);
          if (killedBoss) {
            killedBoss.rewardClaimed = true;
            this.soundManager.playWaveComplete();
            this.player.heal(50);
            this.player.addArmor(50);
            const bossWpGain = this.skinSystem.hasXPBoost() ? 200 : 100;
            this.skinSystem.purchases.blitzPoints += bossWpGain;
          }

          this.skinSystem.save();

          // Kill streak
          this.killStreakTimer = 5;
          this.gameState.killStreak = this.scoreboardSystem.stats.currentKillStreak;
          this.gameState.bestKillStreak = this.scoreboardSystem.stats.bestKillStreak;

          const streakLabel = this.scoreboardSystem.getKillStreakLabel(this.gameState.killStreak);
          if (streakLabel) {
            this.soundManager.playKillStreak(this.gameState.killStreak);
          }

          // Achievement titles
          if (this.scoreboardSystem.stats.totalKills >= 100 && !this.skinSystem.owns('title_hunter')) {
            this.skinSystem.purchases.ownedItems.push('title_hunter');
            this.skinSystem.save();
          }
        }

        // Streak timeout
        if (this.killStreakTimer > 0) {
          this.killStreakTimer -= delta;
          if (this.killStreakTimer <= 0) {
            this.scoreboardSystem.resetStreak();
            this.gameState.killStreak = 0;
          }
        }

        this.scoreboardSystem.updateSurvivalTime(delta);

        this.gameState.playersAlive = this.botSystem.getAliveCount();
        this.gameState.kills = this.player.state.kills;
        this.gameState.totalKills = this.player.state.kills;

        if (this.player.state.isDead) {
          // Check for revive token
          if (this.skinSystem.purchases.reviveTokens > 0 && !this.reviveOffered) {
            this.reviveOffered = true;
            this.reviveTimer = 3.0; // 3 second countdown
          } else if (this.reviveOffered && this.reviveTimer > 0) {
            this.reviveTimer -= delta;
            if (this.reviveTimer <= 0) {
              // Time expired, die
              this.reviveOffered = false;
              this.scoreboardSystem.endGame();
              this.gameState.phase = 'dead';
              this.notifyStateChange();
            }
          } else if (!this.reviveOffered) {
            this.scoreboardSystem.endGame();
            this.gameState.phase = 'dead';
            this.notifyStateChange();
          }
        } else if (this.botSystem.alive <= 0) {
          // All bots dead - start wave transition
          this.gameState.phase = 'wave_transition';
          this.waveManager.startTransition();
          this.soundManager.playWaveComplete();
          this.notifyStateChange();
        }
        break;
      }
      case 'wave_transition': {
        this.particleSystem.update(delta);
        const done = this.waveManager.updateTransition(delta);
        if (done) {
          this.startNextWave();
        }
        break;
      }
      case 'dead':
        this.weaponSystem.update(delta);
        this.particleSystem.update(delta);
        break;
    }

    this.renderer.render(this.scene, this.camera);
  }

  private updateReinforcements(delta: number): void {
    this.reinforcementTimer -= delta;
    if (this.reinforcementTimer <= 0 && this.botSystem.alive < REINFORCEMENT_MIN_ALIVE) {
      this.reinforcementTimer = this.reinforcementInterval;
      const spawnCount = REINFORCEMENT_MIN_COUNT + Math.floor(Math.random() * REINFORCEMENT_MAX_EXTRA);
      this.botSystem.spawnReinforcements(spawnCount);
      this.gameState.playersAlive = this.botSystem.getAliveCount();
      this.soundManager.playWaveStart();
    }
  }

  private onResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private notifyStateChange(): void {
    if (this.onStateChange) this.onStateChange({ ...this.gameState });
  }

  revivePlayer(): void {
    if (!this.skinSystem.useReviveToken()) return;
    this.player.state.isDead = false;
    this.player.state.health = 50;
    this.player.mesh.rotation.x = 0;
    this.reviveOffered = false;
    this.reviveTimer = 0;
  }

  destroy(): void {
    if (this._onPointerLockChange) {
      document.removeEventListener('pointerlockchange', this._onPointerLockChange);
      this._onPointerLockChange = null;
    }
    window.removeEventListener('resize', this._onResize);
    this.player.destroy();
    this.weaponSystem.destroy();
    this.grenadeSystem.destroy();
    this.vehicleSystem.destroy();
    this.soundManager.destroy();
    this.particleSystem.destroy();
    this.weatherSystem.destroy();
    this.dayNightSystem.destroy();
    this.animalSystem.destroy();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
