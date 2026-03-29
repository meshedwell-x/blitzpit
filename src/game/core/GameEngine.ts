import * as THREE from 'three';
import { WorldGenerator } from '../world/WorldGenerator';
import { PlayerController } from '../player/PlayerController';
import { WeaponSystem } from '../weapons/WeaponSystem';
import { GrenadeSystem } from '../weapons/GrenadeSystem';
import { BotSystem } from '../bots/BotSystem';
import { ZoneSystem } from '../zone/ZoneSystem';
import { VehicleSystem } from '../vehicles/VehicleSystem';
import { WaveManager } from './WaveManager';
import { ScoreboardSystem } from '../score/ScoreboardSystem';
import { SoundManager } from '../audio/SoundManager';
import { ParticleSystem } from '../effects/ParticleSystem';
import { WORLD_SIZE, PLAYER_HEAL_BETWEEN_WAVES } from './constants';

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
  private dropSpeed = 30;
  private parachuteOpen = false;
  private planeMesh: THREE.Group | null = null;
  private playerDropMesh: THREE.Group | null = null;

  // Flash effect
  flashTimer = 0;

  // Reusable temp vectors
  private _tmpBehind = new THREE.Vector3();
  private _tmpSide = new THREE.Vector3();

  // Kill streak tracking
  private killStreakTimer = 0;
  private lastKillCount = 0;

  onStateChange: ((state: GameState) => void) | null = null;
  private _onResize: () => void = () => {};

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.003);

    this.camera = new THREE.PerspectiveCamera(
      70, container.clientWidth / container.clientHeight, 0.1, 1000
    );

    this.clock = new THREE.Clock();
    this.setupLighting();

    this.world = new WorldGenerator(this.scene, 42);
    this.player = new PlayerController(this.camera, this.world, this.scene);
    this.weaponSystem = new WeaponSystem(this.scene, this.player);
    this.grenadeSystem = new GrenadeSystem(this.scene, this.player, this.world);
    this.botSystem = new BotSystem(this.scene, this.world, this.weaponSystem, this.player);
    this.zoneSystem = new ZoneSystem(this.scene, this.player);
    this.vehicleSystem = new VehicleSystem(this.scene, this.world, this.player);
    this.waveManager = new WaveManager();
    this.scoreboardSystem = new ScoreboardSystem();
    this.soundManager = new SoundManager();
    this.particleSystem = new ParticleSystem(this.scene);

    this._onResize = () => this.onResize();
    window.addEventListener('resize', this._onResize);
  }

  private setupLighting(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.4);
    sun.position.set(100, 150, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -150;
    sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 150;
    sun.shadow.camera.bottom = -150;
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
    this.vehicleSystem.spawnVehicles(12);

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
        this.soundManager.playExplosion();
      }
    };

    // Grenade bot kill callback -> decrement alive
    this.grenadeSystem.onBotKill = (_botId: string) => {
      this.botSystem.alive = Math.max(0, this.botSystem.alive - 1);
      this.scoreboardSystem.recordKill(false);
      this.player.state.kills++;
      this.soundManager.playKillConfirm();
    };

    this.player.mesh.visible = false;
    const spawnH = this.world.getHeightAt(0, 0);
    this.player.state.position.set(0, spawnH + 50, 0);

    this.camera.position.set(0, 60, 80);
    this.camera.lookAt(0, 10, 0);

    this.gameState.phase = 'lobby';
    this.gameState.currentWave = 1;
    this.waveManager.currentWave = 1;
    this.notifyStateChange();
  }

  startGame(): void {
    this.gameState.phase = 'plane';
    const angle = Math.random() * Math.PI * 2;
    const edge = WORLD_SIZE / 2 * 0.8;
    this.planePosition.set(Math.cos(angle) * edge, 100, Math.sin(angle) * edge);
    this.planeDirection.set(-Math.cos(angle), 0, -Math.sin(angle)).normalize();
    this.planeTimer = 0;
    this.player.state.position.copy(this.planePosition);
    this.player.mesh.visible = false;
    if (this.planeMesh) {
      this.planeMesh.visible = true;
      this.planeMesh.position.copy(this.planePosition);
      this._tmpBehind.copy(this.planePosition);
      this._tmpBehind.x += this.planeDirection.x * 10;
      this._tmpBehind.y += this.planeDirection.y * 10;
      this._tmpBehind.z += this.planeDirection.z * 10;
      this.planeMesh.lookAt(this._tmpBehind);
    }
    this.notifyStateChange();
  }

  drop(): void {
    if (this.gameState.phase !== 'plane') return;
    this.gameState.phase = 'dropping';
    this.parachuteOpen = false;
    this.dropSpeed = 40;
    this.player.state.velocity.set(
      this.planeDirection.x * 20, -this.dropSpeed, this.planeDirection.z * 20
    );
    this.player.mesh.visible = true;
    this.notifyStateChange();
  }

  openParachute(): void {
    if (this.gameState.phase !== 'dropping') return;
    this.parachuteOpen = true;
    this.dropSpeed = 6;
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
    const speed = 60 * delta;
    this.planePosition.x += this.planeDirection.x * speed;
    this.planePosition.y += this.planeDirection.y * speed;
    this.planePosition.z += this.planeDirection.z * speed;
    this.player.state.position.copy(this.planePosition);
    if (this.planeMesh) this.planeMesh.position.copy(this.planePosition);

    this._tmpSide.set(-this.planeDirection.z * 25, 15, this.planeDirection.x * 25);
    this.camera.position.copy(this.planePosition).add(this._tmpSide);
    this.camera.lookAt(this.planePosition);

    if (this.planeTimer > 15) this.drop();
  }

  private updateDropping(delta: number): void {
    const groundH = this.world.getHeightAt(this.player.state.position.x, this.player.state.position.z);
    if (!this.parachuteOpen && this.player.state.position.y < groundH + 30) this.openParachute();

    this.player.state.position.y -= this.dropSpeed * delta;
    if (this.parachuteOpen) {
      this.player.state.position.x += this.planeDirection.x * 5 * delta;
      this.player.state.position.z += this.planeDirection.z * 5 * delta;
    } else {
      this.player.state.position.x += this.player.state.velocity.x * delta * 0.5;
      this.player.state.position.z += this.player.state.velocity.z * delta * 0.5;
    }

    this.player.mesh.position.copy(this.player.state.position);
    if (this.playerDropMesh && this.parachuteOpen) {
      this.playerDropMesh.position.copy(this.player.state.position);
    }

    this.camera.position.set(
      this.player.state.position.x + this.planeDirection.x * 12,
      this.player.state.position.y + 8,
      this.player.state.position.z + this.planeDirection.z * 12
    );
    this.camera.lookAt(this.player.state.position);

    if (this.player.state.position.y <= groundH + 0.6) {
      this.player.state.position.y = groundH + 0.6;
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

    // Respawn bots
    this.botSystem.respawnForWave(config);

    // Spawn new weapons
    this.weaponSystem.spawnItems(this.world.itemSpawns);

    // Heal player
    this.player.heal(PLAYER_HEAL_BETWEEN_WAVES);

    // Update scoreboard wave
    this.scoreboardSystem.updateWave(wave);

    this.gameState.phase = 'playing';
    this.gameState.currentWave = wave;
    this.gameState.playersAlive = this.botSystem.getAliveCount();

    this.particleSystem.emitWaveStart();
    this.soundManager.playWaveStart();

    this.notifyStateChange();
  }

  update(): void {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.gameState.gameTime += delta;
    if (this.flashTimer > 0) this.flashTimer -= delta;

    switch (this.gameState.phase) {
      case 'lobby': {
        const t = this.gameState.gameTime * 0.2;
        this.camera.position.set(Math.sin(t) * 80, 60, Math.cos(t) * 80);
        this.camera.lookAt(0, 10, 0);
        break;
      }
      case 'plane':
        this.updatePlane(delta);
        break;
      case 'dropping':
        this.updateDropping(delta);
        break;
      case 'playing': {
        if (this.vehicleSystem.isPlayerInVehicle()) {
          this.vehicleSystem.update(delta);
          const v = this.vehicleSystem.playerVehicle!;
          this._tmpBehind.set(
            Math.sin(v.rotation) * 10,
            6,
            Math.cos(v.rotation) * 10
          );
          this.camera.position.copy(v.position).add(this._tmpBehind);
          this.camera.lookAt(v.position);
          this.soundManager.playVehicleEngine(v.speed);
        } else {
          this.player.update(delta);
          this.soundManager.stopVehicleEngine();
        }

        this.weaponSystem.update(delta);
        this.grenadeSystem.update(delta, this.botSystem.bots);
        this.botSystem.update(delta);
        this.zoneSystem.update(delta, this.botSystem.bots);
        this.particleSystem.update(delta);

        // Check bullet hits and track particle/sound effects
        const bullets = this.weaponSystem.getBullets();
        const prevKills = this.player.state.kills;
        this.botSystem.checkBulletHits(bullets);
        const newKills = this.player.state.kills;

        if (newKills > prevKills) {
          const killsDelta = newKills - prevKills;
          for (let k = 0; k < killsDelta; k++) {
            this.scoreboardSystem.recordKill(false);
            this.soundManager.playKillConfirm();
          }
          // Kill streak
          this.killStreakTimer = 5;
          this.gameState.killStreak = this.scoreboardSystem.stats.currentKillStreak;
          this.gameState.bestKillStreak = this.scoreboardSystem.stats.bestKillStreak;

          const streakLabel = this.scoreboardSystem.getKillStreakLabel(this.gameState.killStreak);
          if (streakLabel) {
            this.soundManager.playKillStreak(this.gameState.killStreak);
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
          this.scoreboardSystem.endGame();
          this.gameState.phase = 'dead';
          this.notifyStateChange();
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

  destroy(): void {
    window.removeEventListener('resize', this._onResize);
    this.player.destroy();
    this.weaponSystem.destroy();
    this.grenadeSystem.destroy();
    this.vehicleSystem.destroy();
    this.soundManager.destroy();
    this.particleSystem.destroy();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
