import * as THREE from 'three';
import {
  PLAYER_SPEED, SPRINT_MULTIPLIER,
  CROUCH_MULTIPLIER, JUMP_FORCE, GRAVITY,
  CAMERA_DISTANCE, CAMERA_HEIGHT,
} from '../core/constants';
import { WorldGenerator } from '../world/WorldGenerator';

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
}

export class PlayerController {
  camera: THREE.PerspectiveCamera;
  state: PlayerState;
  mesh: THREE.Group;
  keys: Set<string> = new Set();
  private yaw = 0;
  private pitch = -0.3;
  private world: WorldGenerator;
  private isLocked = false;
  private sensitivity = 0.002;
  private scene: THREE.Scene;
  private animTime = 0;
  private mobileInput = { x: 0, z: 0 };

  private _onKeyDown: (e: KeyboardEvent) => void = () => {};
  private _onKeyUp: (e: KeyboardEvent) => void = () => {};
  private _onMouseMove: (e: MouseEvent) => void = () => {};
  private _onPointerLockChange: () => void = () => {};
  private _onClick: () => void = () => {};
  private _container: HTMLElement | null = null;

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
    };

    this.mesh = this.createPlayerMesh();
    scene.add(this.mesh);
  }

  private createPlayerMesh(): THREE.Group {
    const group = new THREE.Group();

    // --- Head ---
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xffcc99 })
    );
    head.position.y = 1.55;
    head.castShadow = true;
    head.name = 'head';
    group.add(head);

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.12, 1.6, -0.26);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.12, 1.6, -0.26);
    group.add(rightEye);

    // --- Body (torso) ---
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.75, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x2d5a1e }) // military green
    );
    torso.position.y = 1.0;
    torso.castShadow = true;
    torso.name = 'torso';
    group.add(torso);

    // Belt
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.1, 0.37),
      new THREE.MeshLambertMaterial({ color: 0x4a3520 })
    );
    belt.position.y = 0.65;
    group.add(belt);

    // --- Arms ---
    const armGeo = new THREE.BoxGeometry(0.2, 0.65, 0.2);
    const armMat = new THREE.MeshLambertMaterial({ color: 0x2d5a1e });

    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.5, 1.0, 0);
    leftArm.castShadow = true;
    leftArm.name = 'leftArm';
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.5, 1.0, 0);
    rightArm.castShadow = true;
    rightArm.name = 'rightArm';
    group.add(rightArm);

    // Hands (skin color)
    const handGeo = new THREE.BoxGeometry(0.18, 0.15, 0.18);
    const handMat = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
    const leftHand = new THREE.Mesh(handGeo, handMat);
    leftHand.position.set(-0.5, 0.6, 0);
    group.add(leftHand);
    const rightHand = new THREE.Mesh(handGeo, handMat);
    rightHand.position.set(0.5, 0.6, 0);
    group.add(rightHand);

    // --- Legs ---
    const legGeo = new THREE.BoxGeometry(0.22, 0.65, 0.22);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x3a3a2a }); // dark pants

    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.15, 0.3, 0);
    leftLeg.castShadow = true;
    leftLeg.name = 'leftLeg';
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.15, 0.3, 0);
    rightLeg.castShadow = true;
    rightLeg.name = 'rightLeg';
    group.add(rightLeg);

    // Boots
    const bootGeo = new THREE.BoxGeometry(0.24, 0.12, 0.3);
    const bootMat = new THREE.MeshLambertMaterial({ color: 0x2a1a0a });
    const leftBoot = new THREE.Mesh(bootGeo, bootMat);
    leftBoot.position.set(-0.15, 0.0, -0.03);
    group.add(leftBoot);
    const rightBoot = new THREE.Mesh(bootGeo, bootMat);
    rightBoot.position.set(0.15, 0.0, -0.03);
    group.add(rightBoot);

    // --- Backpack ---
    const backpack = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.45, 0.25),
      new THREE.MeshLambertMaterial({ color: 0x5a4a30 })
    );
    backpack.position.set(0, 1.05, 0.3);
    group.add(backpack);

    // --- Helmet ---
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.3, 0.55),
      new THREE.MeshLambertMaterial({ color: 0x4a5a3a })
    );
    helmet.position.y = 1.75;
    group.add(helmet);

    return group;
  }

  init(container: HTMLElement): void {
    this._container = container;

    this._onKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (e.code === 'ShiftLeft') this.state.isSprinting = true;
      if (e.code === 'KeyC') this.state.isCrouching = !this.state.isCrouching;
    };
    this._onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
      if (e.code === 'ShiftLeft') this.state.isSprinting = false;
    };
    this._onMouseMove = (e: MouseEvent) => {
      if (this.isLocked) {
        this.yaw -= e.movementX * this.sensitivity;
        this.pitch -= e.movementY * this.sensitivity;
        this.pitch = Math.max(-1.2, Math.min(0.6, this.pitch));
      }
    };
    this._onPointerLockChange = () => {
      this.isLocked = document.pointerLockElement === container;
    };

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);

    this._onClick = () => {
      if (!this.isLocked) {
        container.requestPointerLock();
      }
    };
    container.addEventListener('click', this._onClick);
  }

  destroy(): void {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    if (this._container) {
      this._container.removeEventListener('click', this._onClick);
    }
  }

  update(delta: number): void {
    if (this.state.isDead) return;

    // Slow health regen when not at full health
    if (this.state.health < 100 && this.state.health > 0) {
      this.state.health = Math.min(100, this.state.health + 0.5 * delta);
    }

    // Movement direction based on yaw
    const moveDir = new THREE.Vector3();
    const forward = new THREE.Vector3(
      -Math.sin(this.yaw), 0, -Math.cos(this.yaw)
    ).normalize();
    const right = new THREE.Vector3(
      Math.cos(this.yaw), 0, -Math.sin(this.yaw)
    ).normalize();

    if (this.keys.has('KeyW') || this.mobileInput.z < -0.1) moveDir.add(forward);
    if (this.keys.has('KeyS') || this.mobileInput.z > 0.1) moveDir.sub(forward);
    if (this.keys.has('KeyA') || this.mobileInput.x < -0.1) moveDir.sub(right);
    if (this.keys.has('KeyD') || this.mobileInput.x > 0.1) moveDir.add(right);

    const isMoving = moveDir.length() > 0;
    if (isMoving) moveDir.normalize();

    let speed = PLAYER_SPEED;
    if (this.state.isSprinting) speed *= SPRINT_MULTIPLIER;
    if (this.state.isCrouching) speed *= CROUCH_MULTIPLIER;

    this.state.velocity.x = moveDir.x * speed;
    this.state.velocity.z = moveDir.z * speed;

    // Gravity
    this.state.velocity.y += GRAVITY * delta;

    // Jump
    if (this.keys.has('Space') && this.state.isGrounded) {
      this.state.velocity.y = JUMP_FORCE;
      this.state.isGrounded = false;
    }

    // Apply velocity
    const newPos = this.state.position.clone();
    newPos.x += this.state.velocity.x * delta;
    newPos.y += this.state.velocity.y * delta;
    newPos.z += this.state.velocity.z * delta;

    // Ground collision
    const groundHeight = this.world.getHeightAt(newPos.x, newPos.z);

    // Block top surface is at groundHeight + 0.5 (blocks are 1 unit tall, centered)
    const surfaceY = groundHeight + 0.6;
    if (newPos.y < surfaceY) {
      newPos.y = surfaceY;
      this.state.velocity.y = 0;
      this.state.isGrounded = true;
    }

    // World bounds
    const halfWorld = 400;
    newPos.x = Math.max(-halfWorld, Math.min(halfWorld, newPos.x));
    newPos.z = Math.max(-halfWorld, Math.min(halfWorld, newPos.z));

    this.state.position.copy(newPos);

    // Update player mesh position & rotation
    this.mesh.position.set(
      this.state.position.x,
      this.state.position.y,
      this.state.position.z
    );
    this.mesh.rotation.y = this.yaw;
    this.mesh.scale.y = this.state.isCrouching ? 0.7 : 1.0;

    // Walk animation
    if (isMoving && this.state.isGrounded) {
      this.animTime += delta * (this.state.isSprinting ? 12 : 8);
      const swing = Math.sin(this.animTime) * 0.5;

      const leftArm = this.mesh.getObjectByName('leftArm');
      const rightArm = this.mesh.getObjectByName('rightArm');
      const leftLeg = this.mesh.getObjectByName('leftLeg');
      const rightLeg = this.mesh.getObjectByName('rightLeg');

      if (leftArm) leftArm.rotation.x = swing;
      if (rightArm) rightArm.rotation.x = -swing;
      if (leftLeg) leftLeg.rotation.x = -swing;
      if (rightLeg) rightLeg.rotation.x = swing;
    } else {
      // Reset pose
      const leftArm = this.mesh.getObjectByName('leftArm');
      const rightArm = this.mesh.getObjectByName('rightArm');
      const leftLeg = this.mesh.getObjectByName('leftLeg');
      const rightLeg = this.mesh.getObjectByName('rightLeg');
      if (leftArm) leftArm.rotation.x *= 0.9;
      if (rightArm) rightArm.rotation.x *= 0.9;
      if (leftLeg) leftLeg.rotation.x *= 0.9;
      if (rightLeg) rightLeg.rotation.x *= 0.9;
    }

    // 3rd person camera
    this.updateCamera(delta);
  }

  private updateCamera(_delta: number): void {
    const camDist = CAMERA_DISTANCE;
    const camHeight = CAMERA_HEIGHT;

    // Camera orbits behind player
    const camX = this.state.position.x + Math.sin(this.yaw) * camDist * Math.cos(this.pitch);
    const camZ = this.state.position.z + Math.cos(this.yaw) * camDist * Math.cos(this.pitch);
    const camY = this.state.position.y + camHeight - Math.sin(this.pitch) * camDist;

    this.camera.position.set(camX, camY, camZ);

    // Look at player head area
    const lookTarget = new THREE.Vector3(
      this.state.position.x,
      this.state.position.y + 1.5,
      this.state.position.z
    );
    this.camera.lookAt(lookTarget);

    // Camera shake
    if (this.shakeAmount > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmount;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmount * 0.5;
      this.shakeAmount *= 0.9;
      if (this.shakeAmount < 0.01) this.shakeAmount = 0;
    }

    // Camera terrain collision
    const camGroundH = this.world.getHeightAt(this.camera.position.x, this.camera.position.z);
    if (this.camera.position.y < camGroundH + 1.5) {
      this.camera.position.y = camGroundH + 1.5;
    }
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
      // Death: fall over
      this.mesh.rotation.x = Math.PI / 2;
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

  applyRecoil(amount: number): void {
    this.pitch += amount * 0.015;
    this.pitch = Math.max(-1.2, Math.min(0.6, this.pitch));
  }

  private shakeAmount = 0;
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
