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
import { initCallbacks } from './GameInit';
import {
  WORLD_SIZE,
  REINFORCEMENT_FIRST_DELAY,
  REINFORCEMENT_INTERVAL,
  PLANE_ALTITUDE,
} from './constants';

// Re-export types so downstream imports don't break
export type { GamePhase, GameState } from './GameTypes';
import type { GameState } from './GameTypes';
import { updatePlane, updateDropping, updatePlayingPhase } from './PhaseUpdaters';
import { startNextWave } from './WaveTransition';

export class GameEngine {
  private renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
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

  planePosition = new THREE.Vector3();
  planeDirection = new THREE.Vector3();
  planeTimer = 0;
  dropSpeed = 55;
  parachuteOpen = false;
  planeMesh: THREE.Group | null = null;
  playerDropMesh: THREE.Group | null = null;

  flashTimer = 0;
  lastDamageFrom: THREE.Vector3 | null = null;
  lastDamageTime = 0;
  _tmpBehind = new THREE.Vector3();
  botFootstepTimer = 0;
  killStreakTimer = 0;

  // Hit marker: shown on any bot hit (not just kill)
  hitMarkerActive = false;
  hitMarkerTimer = 0;

  // Player hit flash (red overlay)
  playerHitFlash = false;
  playerHitFlashTimer = 0;

  // Countdown before plane phase
  isCountingDown = false;
  countdownTimer = 0;

  reinforcementTimer = REINFORCEMENT_FIRST_DELAY;
  reinforcementInterval = REINFORCEMENT_INTERVAL;

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
    this.camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 4000);
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
    g.add(new THREE.Mesh(new THREE.BoxGeometry(3, 3, 20), new THREE.MeshLambertMaterial({ color: 0x8a8a8a })));
    const cp = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.5, 3), new THREE.MeshLambertMaterial({ color: 0x4488cc, transparent: true, opacity: 0.6 }));
    cp.position.set(0, 1.5, -8); g.add(cp);
    const w = new THREE.Mesh(new THREE.BoxGeometry(28, 0.4, 5), new THREE.MeshLambertMaterial({ color: 0x7a7a7a }));
    w.position.set(0, 0, -1); g.add(w);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 4), new THREE.MeshLambertMaterial({ color: 0x7a7a7a }));
    t.position.set(0, 3, 8); g.add(t);
    const hs = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 3), new THREE.MeshLambertMaterial({ color: 0x7a7a7a }));
    hs.position.set(0, 0, 8); g.add(hs);
    const eMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const eGeo = new THREE.BoxGeometry(1.5, 1.5, 3);
    const le = new THREE.Mesh(eGeo, eMat); le.position.set(-7, -1.2, -1); g.add(le);
    const re = new THREE.Mesh(eGeo, eMat); re.position.set(7, -1.2, -1); g.add(re);
    const s = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.5, 0.1), new THREE.MeshLambertMaterial({ color: 0xcc3333 }));
    s.position.set(0, 0, -10); g.add(s);
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
    this.animalSystem.spawn();

    this.planeMesh = this.createPlaneMesh();
    this.planeMesh.visible = false;
    this.scene.add(this.planeMesh);

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

    // Wire up all subsystem callbacks (extracted to GameInit.ts)
    initCallbacks(this);

    this._onPointerLockChange = () => {
      if (!document.pointerLockElement && this.gameState.phase === 'playing') {
        this.isPaused = true;
      }
    };
    document.addEventListener('pointerlockchange', this._onPointerLockChange);

    this.botSystem.setWaveManager(this.waveManager);
    this.botSystem.setVehicles(this.vehicleSystem.vehicles);
    this.botSystem.setGrenadeSystem(this.grenadeSystem);

    // Mobile: zone shrinks 2x faster so the effective play area collapses
    // quicker, compensating for the wide map on small screens.
    const isMobileDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobileDevice) {
      this.zoneSystem.speedMultiplier = 2.0;
    }

    this.player.mesh.visible = false;
    const spawnH = this.world.getHeightAt(0, 0);
    this.player.state.position.set(0, spawnH + 50, 0);
    this.camera.position.set(0, 60, 80);
    this.camera.lookAt(0, 10, 0);

    this.gameState.phase = 'lobby';
    this.gameState.currentWave = 1;
    this.waveManager.currentWave = 1;
    this.notifyStateChange();
    this.skinSystem.applySkinToMesh(this.player.mesh);
  }

  startGame(): void {
    // 3-second countdown before plane phase
    this.isCountingDown = true;
    this.countdownTimer = 3.0;
    this.soundManager.playWaveStart();
    this.notifyStateChange();
  }

  private actuallyStartGame(): void {
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
    this.dropSpeed = 15;
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
    this.dropSpeed = 5;
    if (this.playerDropMesh) this.playerDropMesh.visible = true;
  }

  movePlayer(dx: number, dz: number): void { this.player.setMobileInput(dx, dz); }
  rotateCamera(dx: number, dy: number): void { this.player.addRotation(dx, dy); }
  fireWeapon(): void { this.weaponSystem.triggerFire(); }
  stopFire(): void { this.weaponSystem.stopFire(); }
  throwGrenadeAction(): void { this.grenadeSystem.throwGrenade(); }
  resume(): void { this.isPaused = false; }

  update(): void {
    if (this.isPaused) { this.renderer.render(this.scene, this.camera); return; }
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.gameState.gameTime += delta;
    if (this.flashTimer > 0) this.flashTimer -= delta;

    // Hit marker timer
    if (this.hitMarkerTimer > 0) {
      this.hitMarkerTimer -= delta;
      if (this.hitMarkerTimer <= 0) this.hitMarkerActive = false;
    }

    // Player hit flash timer
    if (this.playerHitFlashTimer > 0) {
      this.playerHitFlashTimer -= delta;
      if (this.playerHitFlashTimer <= 0) this.playerHitFlash = false;
    }

    // Countdown phase
    if (this.isCountingDown) {
      this.countdownTimer -= delta;
      if (this.countdownTimer <= 0) {
        this.isCountingDown = false;
        this.actuallyStartGame();
      }
      this.renderer.render(this.scene, this.camera);
      return;
    }

    switch (this.gameState.phase) {
      case 'lobby': {
        const t = this.gameState.gameTime * 0.2;
        this.camera.position.set(Math.sin(t) * 200, 120, Math.cos(t) * 200);
        this.camera.lookAt(0, 10, 0);
        break;
      }
      case 'plane': updatePlane(this, delta); break;
      case 'dropping':
        updateDropping(this, delta);
        this.botSystem.update(delta);
        this.dayNightSystem.update(delta);
        break;
      case 'playing': updatePlayingPhase(this, delta); break;
      case 'wave_transition': {
        this.particleSystem.update(delta);
        const done = this.waveManager.updateTransition(delta);
        if (done) startNextWave(this);
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

  notifyStateChange(): void {
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
