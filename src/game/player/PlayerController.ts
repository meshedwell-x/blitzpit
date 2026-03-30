import * as THREE from 'three';
import {
  JUMP_FORCE,
} from '../core/constants';
import { WorldGenerator } from '../world/WorldGenerator';
import { initPlayerInput, destroyPlayerInput } from './PlayerInput';
import { updatePlayerMovement } from './PlayerMovement';
import { updatePlayerCamera } from './PlayerCamera';
import { createPlayerMesh, updatePlayerAnimation } from './PlayerMesh';

export interface PlayerState {
  health: number;
  armor: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  isSprinting: boolean;
  isCrouching: boolean;
  isGrounded: boolean;
  isDead: boolean;
  kills: number;
  isSwimming: boolean;
}

export class PlayerController {
  camera: THREE.PerspectiveCamera;
  state: PlayerState;
  mesh: THREE.Group;
  keys: Set<string> = new Set();
  yaw = 0;
  pitch = -0.3;
  world: WorldGenerator;
  isLocked = false;
  sensitivity = 0.002;
  scene: THREE.Scene;
  animTime = 0;
  mobileInput = { x: 0, z: 0 };
  biomeSpeedMultiplier = 1.0;
  weatherSpreadMultiplier = 1.0;

  // ADS
  isADS = false;
  adsFOV = 70;
  targetFOV = 70;

  // Swim / drowning
  swimTimer = 0;

  // Sliding
  slideTimer = 0;
  slideCooldown = 0;
  slideDir = new THREE.Vector3();
  isSliding = false;

  // Footstep
  stepDistance = 0;
  stepThreshold = 1.5;
  onFootstep: (() => void) | null = null;

  _onKeyDown: (e: KeyboardEvent) => void = () => {};
  _onKeyUp: (e: KeyboardEvent) => void = () => {};
  _onMouseMove: (e: MouseEvent) => void = () => {};
  _onMouseDown: (e: MouseEvent) => void = () => {};
  _onMouseUp: (e: MouseEvent) => void = () => {};
  _onPointerLockChange: () => void = () => {};
  _onClick: () => void = () => {};
  _onContextMenu: (e: MouseEvent) => void = () => {};
  _container: HTMLElement | null = null;

  deathAnimTimer = 0;
  shakeAmount = 0;

  constructor(camera: THREE.PerspectiveCamera, world: WorldGenerator, scene: THREE.Scene) {
    this.camera = camera;
    this.world = world;
    this.scene = scene;
    this.state = {
      health: 100,
      armor: 0,
      position: new THREE.Vector3(0, 50, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, 0, 0),
      isSprinting: false,
      isCrouching: false,
      isGrounded: false,
      isDead: false,
      kills: 0,
      isSwimming: false,
    };

    this.mesh = createPlayerMesh();
    scene.add(this.mesh);
  }

  init(container: HTMLElement): void {
    initPlayerInput(this, container);
  }

  destroy(): void {
    destroyPlayerInput(this);
  }

  update(delta: number): void {
    if (this.state.isDead) {
      // Death fall-over animation: smoothly rotate to lying down over 0.5s
      if (this.deathAnimTimer > 0) {
        this.deathAnimTimer -= delta;
        const progress = 1 - Math.max(0, this.deathAnimTimer / 0.5);
        this.mesh.rotation.x = (Math.PI / 2) * progress;
        // Apply slight bounce physics
        this.state.velocity.y += -9.8 * delta;
        this.state.position.y += this.state.velocity.y * delta;
        const groundH = this.world.getHeightAt(this.state.position.x, this.state.position.z);
        if (this.state.position.y < groundH + 1.0) {
          this.state.position.y = groundH + 1.0;
          this.state.velocity.y = 0;
        }
        this.mesh.position.copy(this.state.position);
      }
      return;
    }

    updatePlayerMovement(this, delta);
    updatePlayerAnimation(this, delta);
    updatePlayerCamera(this, delta);
  }

  takeDamage(amount: number): void {
    if (this.state.isDead) return;

    let dmg = amount;
    if (this.state.armor > 0) {
      const armorAbsorb = Math.min(this.state.armor, dmg * 0.5);
      this.state.armor -= armorAbsorb;
      dmg -= armorAbsorb;
    }

    this.state.health = Math.max(0, this.state.health - dmg);
    if (this.state.health <= 0) {
      this.state.isDead = true;
      this.deathAnimTimer = 0.5;
      // Small upward bounce on death
      this.state.velocity.y = 4;
    }
  }

  heal(amount: number): void {
    this.state.health = Math.min(100, this.state.health + amount);
  }

  addArmor(amount: number): void {
    this.state.armor = Math.min(100, this.state.armor + amount);
  }

  getForwardDirection(): THREE.Vector3 {
    return new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw)
    ).normalize();
  }

  getAimDirection(): THREE.Vector3 {
    // Direction from camera to crosshair target (forward from player)
    const dir = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    return dir.normalize();
  }

  isPointerLocked(): boolean {
    return this.isLocked;
  }

  getYaw(): number {
    return this.yaw;
  }

  setYaw(value: number): void { this.yaw = value; }

  applyRecoil(vertical: number, horizontal: number): void {
    this.pitch += vertical;
    this.yaw += (Math.random() - 0.5) * horizontal * 2;
    this.pitch = Math.max(-1.2, Math.min(0.6, this.pitch));
  }

  getSpreadMultiplier(): number {
    if (this.state.isDead) return 1.0;
    let mult = 1.0;
    if (this.isADS) mult *= 0.5;
    if (this.state.isCrouching) mult *= 0.7;
    const isMoving = this.keys.has('KeyW') || this.keys.has('KeyS') || this.keys.has('KeyA') || this.keys.has('KeyD');
    if (isMoving && this.state.isSprinting) mult *= 2.5;
    else if (isMoving) mult *= 1.3;
    if (!this.state.isGrounded) mult *= 3.0;
    mult *= this.weatherSpreadMultiplier;
    return mult;
  }

  addShake(amount: number): void { this.shakeAmount = Math.min(this.shakeAmount + amount, 0.5); }

  setMobileInput(x: number, z: number): void {
    this.mobileInput.x = x;
    this.mobileInput.z = z;
  }

  addRotation(dx: number, dy: number): void {
    this.yaw -= dx * this.sensitivity * 3;
    this.pitch -= dy * this.sensitivity * 3;
    this.pitch = Math.max(-1.2, Math.min(0.6, this.pitch));
  }

  triggerJump(): void {
    if (this.state.isGrounded) {
      this.state.velocity.y = JUMP_FORCE;
      this.state.isGrounded = false;
    }
  }

  toggleCrouch(): void {
    this.state.isCrouching = !this.state.isCrouching;
  }

  setSprint(on: boolean): void {
    this.state.isSprinting = on;
  }
}
