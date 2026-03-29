import * as THREE from 'three';
import {
  PLAYER_SPEED, SPRINT_MULTIPLIER,
  CROUCH_MULTIPLIER, JUMP_FORCE, GRAVITY,
  CAMERA_DISTANCE, CAMERA_HEIGHT, WORLD_SIZE,
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
  isSwimming: boolean;
}

export class PlayerController {
  camera: THREE.PerspectiveCamera;
  state: PlayerState;
  mesh: THREE.Group;
  keys: Set<string> = new Set();
  yaw = 0;
  pitch = -0.3;
  private world: WorldGenerator;
  private isLocked = false;
  private sensitivity = 0.002;
  private scene: THREE.Scene;
  private animTime = 0;
  private mobileInput = { x: 0, z: 0 };
  biomeSpeedMultiplier = 1.0;
  weatherSpreadMultiplier = 1.0;

  // ADS
  isADS = false;
  private adsFOV = 70;
  private targetFOV = 70;

  // Swim / drowning
  swimTimer = 0;

  // Sliding
  private slideTimer = 0;
  private slideCooldown = 0;
  private slideDir = new THREE.Vector3();
  isSliding = false;

  // Footstep
  private stepDistance = 0;
  private stepThreshold = 1.5;
  onFootstep: (() => void) | null = null;

  private _onKeyDown: (e: KeyboardEvent) => void = () => {};
  private _onKeyUp: (e: KeyboardEvent) => void = () => {};
  private _onMouseMove: (e: MouseEvent) => void = () => {};
  private _onMouseDown: (e: MouseEvent) => void = () => {};
  private _onMouseUp: (e: MouseEvent) => void = () => {};
  private _onPointerLockChange: () => void = () => {};
  private _onClick: () => void = () => {};
  private _onContextMenu: (e: MouseEvent) => void = () => {};
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
      isSwimming: false,
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
    belt.name = 'belt';
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
    leftBoot.name = 'leftBoot';
    group.add(leftBoot);
    const rightBoot = new THREE.Mesh(bootGeo, bootMat);
    rightBoot.position.set(0.15, 0.0, -0.03);
    rightBoot.name = 'rightBoot';
    group.add(rightBoot);

    // --- Backpack ---
    const backpack = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.45, 0.25),
      new THREE.MeshLambertMaterial({ color: 0x5a4a30 })
    );
    backpack.position.set(0, 1.05, 0.3);
    backpack.name = 'backpack';
    group.add(backpack);

    // --- Helmet ---
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.3, 0.55),
      new THREE.MeshLambertMaterial({ color: 0x4a5a3a })
    );
    helmet.position.y = 1.75;
    helmet.name = 'helmet';
    group.add(helmet);

    // Helmet goggles (two small glass panes on front)
    const goggleMat = new THREE.MeshLambertMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.7 });
    const goggleGeo = new THREE.BoxGeometry(0.12, 0.1, 0.05);
    const leftGoggle = new THREE.Mesh(goggleGeo, goggleMat);
    leftGoggle.position.set(-0.13, 1.76, -0.29);
    group.add(leftGoggle);
    const rightGoggle = new THREE.Mesh(goggleGeo, goggleMat);
    rightGoggle.position.set(0.13, 1.76, -0.29);
    group.add(rightGoggle);

    // Boot toes -- slight forward protrusion for detail
    const toeGeo = new THREE.BoxGeometry(0.22, 0.1, 0.12);
    const toeMat = new THREE.MeshLambertMaterial({ color: 0x1a0f00 });
    const leftToe = new THREE.Mesh(toeGeo, toeMat);
    leftToe.position.set(-0.15, 0.0, -0.14);
    group.add(leftToe);
    const rightToe = new THREE.Mesh(toeGeo, toeMat);
    rightToe.position.set(0.15, 0.0, -0.14);
    group.add(rightToe);

    return group;
  }

  init(container: HTMLElement): void {
    this._container = container;

    this._onKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (e.code === 'ShiftLeft') this.state.isSprinting = true;
      if (e.code === 'KeyC') {
        if (this.state.isSprinting && this.slideTimer <= 0 && this.slideCooldown <= 0) {
          // Start sliding
          this.isSliding = true;
          this.slideTimer = 0.8;
          this.slideCooldown = 1.5;
          this.slideDir.copy(this.getForwardDirection());
          this.mesh.scale.y = 0.5;
        } else {
          this.state.isCrouching = !this.state.isCrouching;
        }
      }
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
    this._onMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        this.isADS = true;
        e.preventDefault();
      }
    };
    this._onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        this.isADS = false;
      }
    };
    this._onPointerLockChange = () => {
      this.isLocked = document.pointerLockElement === container;
    };
    this._onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    container.addEventListener('contextmenu', this._onContextMenu);

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
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    if (this._container) {
      this._container.removeEventListener('click', this._onClick);
      this._container.removeEventListener('contextmenu', this._onContextMenu);
    }
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
        if (this.state.position.y < groundH + 0.3) {
          this.state.position.y = groundH + 0.3;
          this.state.velocity.y = 0;
        }
        this.mesh.position.copy(this.state.position);
      }
      return;
    }

    // Slow health regen when not at full health
    if (this.state.health < 100 && this.state.health > 0) {
      this.state.health = Math.min(100, this.state.health + 0.5 * delta);
    }

    // Slide cooldown tick
    if (this.slideCooldown > 0) this.slideCooldown -= delta;

    // Sliding logic (takes priority over normal movement)
    if (this.slideTimer > 0) {
      this.slideTimer -= delta;
      const slideSpeed = 16 * (this.slideTimer / 0.8); // decelerate
      this.state.velocity.x = this.slideDir.x * slideSpeed;
      this.state.velocity.z = this.slideDir.z * slideSpeed;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
        this.mesh.scale.y = this.state.isCrouching ? 0.7 : 1.0;
      }
      // Gravity still applies during slide
      this.state.velocity.y += GRAVITY * delta;
    } else {
      // Normal movement
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

      let speed = PLAYER_SPEED * this.biomeSpeedMultiplier;
      if (this.state.isSprinting) speed *= SPRINT_MULTIPLIER;
      if (this.state.isCrouching) speed *= CROUCH_MULTIPLIER;
      if (this.isADS) speed *= 0.6;

      this.state.velocity.x = moveDir.x * speed;
      this.state.velocity.z = moveDir.z * speed;

      // Gravity
      this.state.velocity.y += GRAVITY * delta;

      // Jump
      if (this.keys.has('Space') && this.state.isGrounded) {
        this.state.velocity.y = JUMP_FORCE;
        this.state.isGrounded = false;
      }

      // Footstep sound
      if (isMoving && this.state.isGrounded) {
        const threshold = this.state.isSprinting ? 1.0 : (this.state.isCrouching ? 2.5 : this.stepThreshold);
        this.stepDistance += speed * delta;
        if (this.stepDistance >= threshold) {
          this.stepDistance = 0;
          if (this.onFootstep) this.onFootstep();
        }
      } else {
        this.stepDistance = 0;
      }
    }

    // Apply velocity
    const newPos = this.state.position.clone();
    newPos.x += this.state.velocity.x * delta;
    newPos.y += this.state.velocity.y * delta;
    newPos.z += this.state.velocity.z * delta;

    // Tree collision -- prevent walking through trees (spatial grid lookup)
    const TREE_RADIUS = 1.0;
    const PLAYER_RADIUS = 0.4;
    const treeCollisionDist = TREE_RADIUS + PLAYER_RADIUS;
    for (const treePos of this.world.getNearbyTrees(newPos.x, newPos.z, 5)) {
      const dx = newPos.x - treePos.x;
      const dz = newPos.z - treePos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < treeCollisionDist * treeCollisionDist && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const pushX = (dx / dist) * (treeCollisionDist - dist);
        const pushZ = (dz / dist) * (treeCollisionDist - dist);
        newPos.x += pushX;
        newPos.z += pushZ;
      }
    }

    // Building collision -- prevent walking through walls
    const buildings = this.world.getNearbyBuildings(newPos.x, newPos.z);
    for (const b of buildings) {
      const baseH = this.world.getHeightAt(b.x, b.z);

      // Expand building AABB by player radius for accurate collision
      const bMinX = b.x - PLAYER_RADIUS;
      const bMaxX = b.x + b.width + PLAYER_RADIUS;
      const bMinZ = b.z - PLAYER_RADIUS;
      const bMaxZ = b.z + b.depth + PLAYER_RADIUS;

      if (
        newPos.x > bMinX && newPos.x < bMaxX &&
        newPos.z > bMinZ && newPos.z < bMaxZ &&
        newPos.y < baseH + b.height + 1
      ) {
        // Check if entering through door (front face z === b.z, centered x, height 2 blocks)
        const doorX = b.x + Math.floor(b.width / 2);
        const isDoor =
          Math.abs(newPos.x - doorX) < 1.5 &&
          Math.abs(newPos.z - b.z) < 1.5 &&
          newPos.y < baseH + 3;

        if (!isDoor) {
          // Calculate penetration depth on each axis
          const overlapLeft = newPos.x - bMinX;
          const overlapRight = bMaxX - newPos.x;
          const overlapFront = newPos.z - bMinZ;
          const overlapBack = bMaxZ - newPos.z;

          // Find the smallest overlap (nearest edge to push to)
          const minOverlap = Math.min(overlapLeft, overlapRight, overlapFront, overlapBack);

          if (minOverlap === overlapLeft) {
            newPos.x = bMinX;
          } else if (minOverlap === overlapRight) {
            newPos.x = bMaxX;
          } else if (minOverlap === overlapFront) {
            newPos.z = bMinZ;
          } else {
            newPos.z = bMaxZ;
          }
        }
      }
    }

    // Ground collision + swimming
    const groundHeight = this.world.getEffectiveHeightAt(newPos.x, newPos.z);
    const surfaceY = groundHeight + 0.6;

    // Swimming: terrain height at or below WATER_LEVEL (4)
    const WATER_SURFACE = 4.5; // WATER_LEVEL + 0.5
    const rawGroundHeight = this.world.getHeightAt(newPos.x, newPos.z);
    if (rawGroundHeight <= 4 && newPos.y < WATER_SURFACE + 0.5) {
      // Swimming mode
      this.state.isSwimming = true;
      this.swimTimer += delta;
      // Drowning damage after 15 seconds
      if (this.swimTimer > 15) {
        this.state.health -= 2 * delta;
        if (this.state.health < 0) this.state.health = 0;
      }
      newPos.y = WATER_SURFACE;
      this.state.velocity.y = 0;
      this.state.isGrounded = false;
      // Reduced speed in water
      this.state.velocity.x *= 0.4;
      this.state.velocity.z *= 0.4;
      // SPACE: surface leap
      if (this.keys.has('Space')) {
        this.state.velocity.y = 3;
      }
    } else {
      this.state.isSwimming = false;
      this.swimTimer = 0;
      if (newPos.y < surfaceY) {
        newPos.y = surfaceY;
        this.state.velocity.y = 0;
        this.state.isGrounded = true;
      }
    }

    // World bounds
    const halfWorld = WORLD_SIZE / 2;
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
    if (!this.isSliding) {
      this.mesh.scale.y = this.state.isCrouching ? 0.7 : 1.0;
    }

    // Limb animation
    const leftArm = this.mesh.getObjectByName('leftArm');
    const rightArm = this.mesh.getObjectByName('rightArm');
    const leftLeg = this.mesh.getObjectByName('leftLeg');
    const rightLeg = this.mesh.getObjectByName('rightLeg');

    if (this.state.isSwimming) {
      // Swimming animation -- breaststroke arms + frog kick legs
      this.animTime += delta * 4;
      const strokePhase = Math.sin(this.animTime);
      const kickPhase = Math.sin(this.animTime + Math.PI * 0.3);

      // Arms: reach forward then sweep outward/back (breaststroke)
      if (leftArm) {
        leftArm.rotation.x = -1.2 + strokePhase * 0.8;
        leftArm.rotation.z = strokePhase > 0 ? -strokePhase * 0.5 : 0;
      }
      if (rightArm) {
        rightArm.rotation.x = -1.2 + strokePhase * 0.8;
        rightArm.rotation.z = strokePhase > 0 ? strokePhase * 0.5 : 0;
      }
      // Legs: frog kick (spread then close)
      if (leftLeg) {
        leftLeg.rotation.x = -0.3 + kickPhase * 0.4;
        leftLeg.rotation.z = kickPhase > 0 ? -kickPhase * 0.3 : 0;
      }
      if (rightLeg) {
        rightLeg.rotation.x = -0.3 + kickPhase * 0.4;
        rightLeg.rotation.z = kickPhase > 0 ? kickPhase * 0.3 : 0;
      }
      // Body bob in water
      this.mesh.position.y += Math.sin(this.animTime * 1.5) * 0.08;
    } else {
      // Reset Z rotation from swimming
      if (leftArm) leftArm.rotation.z = 0;
      if (rightArm) rightArm.rotation.z = 0;
      if (leftLeg) leftLeg.rotation.z = 0;
      if (rightLeg) rightLeg.rotation.z = 0;

      // Walk animation -- Minecraft-style limb swing
      const isMovingAnim = this.state.velocity.x !== 0 || this.state.velocity.z !== 0;
      if (isMovingAnim && this.state.isGrounded && !this.isSliding) {
        const animSpeed = this.state.isSprinting ? 14 : 9;
        this.animTime += delta * animSpeed;
        const swing = Math.sin(this.animTime) * 0.8;
        const armSwing = Math.sin(this.animTime) * 0.6;

        if (leftArm) leftArm.rotation.x = armSwing;
        if (rightArm) rightArm.rotation.x = -armSwing;
        if (leftLeg) leftLeg.rotation.x = -swing;
        if (rightLeg) rightLeg.rotation.x = swing;
        // Slight body bob
        this.mesh.position.y += Math.abs(Math.sin(this.animTime * 2)) * 0.05;
      } else if (!this.state.isGrounded) {
        // Airborne -- arms up, legs dangling
        if (leftArm) leftArm.rotation.x = -0.4;
        if (rightArm) rightArm.rotation.x = -0.4;
        if (leftLeg) leftLeg.rotation.x = 0.2;
        if (rightLeg) rightLeg.rotation.x = 0.2;
      } else {
        // Idle -- smooth return to rest
        if (leftArm) leftArm.rotation.x *= 0.85;
        if (rightArm) rightArm.rotation.x *= 0.85;
        if (leftLeg) leftLeg.rotation.x *= 0.85;
        if (rightLeg) rightLeg.rotation.x *= 0.85;
      }
    }

    // 3rd person camera
    this.updateCamera(delta);
  }

  private updateCamera(_delta: number): void {
    // ADS / sprint FOV transitions
    if (this.isADS) {
      this.targetFOV = 45;
    } else if (this.state.isSprinting) {
      this.targetFOV = 78;
    } else {
      this.targetFOV = 70;
    }
    this.adsFOV += (this.targetFOV - this.adsFOV) * 0.15;
    this.camera.fov = this.adsFOV;
    this.camera.updateProjectionMatrix();

    // PUBG-style over-the-shoulder (OTS) camera
    // ADS = true first-person (through character head, no model visible)
    const RIGHT_SHOULDER_OFFSET = 0.8; // X offset to the right of character

    if (this.isADS) {
      // --- ADS: True first-person view through character's eyes ---
      const headHeight = 1.6;
      const eyeX = this.state.position.x - Math.sin(this.yaw) * 0.3;
      const eyeZ = this.state.position.z - Math.cos(this.yaw) * 0.3;
      const eyeY = this.state.position.y + headHeight;

      this.camera.position.set(eyeX, eyeY, eyeZ);

      // Look forward from eyes
      const lookDist = 50;
      const lookX = eyeX - Math.sin(this.yaw) * lookDist * Math.cos(this.pitch);
      const lookZ = eyeZ - Math.cos(this.yaw) * lookDist * Math.cos(this.pitch);
      const lookY = eyeY + Math.sin(this.pitch) * lookDist;
      this.camera.lookAt(lookX, lookY, lookZ);

      // Hide player mesh during ADS
      if (this.mesh.visible) this.mesh.visible = false;
    } else {
      // --- Normal: PUBG-style over-right-shoulder 3rd person ---
      if (!this.mesh.visible) this.mesh.visible = true;

      const camDist = CAMERA_DISTANCE;
      const camHeight = this.state.isSwimming ? CAMERA_HEIGHT * 0.6 : CAMERA_HEIGHT;

      // Right-hand side offset perpendicular to look direction
      const rightX = -Math.cos(this.yaw) * RIGHT_SHOULDER_OFFSET;
      const rightZ = Math.sin(this.yaw) * RIGHT_SHOULDER_OFFSET;

      // Camera orbits behind player, offset to the right
      const camX = this.state.position.x + Math.sin(this.yaw) * camDist * Math.cos(this.pitch) + rightX;
      const camZ = this.state.position.z + Math.cos(this.yaw) * camDist * Math.cos(this.pitch) + rightZ;
      const camY = this.state.position.y + camHeight - Math.sin(this.pitch) * camDist;

      this.camera.position.set(camX, camY, camZ);

      // Look at player's right shoulder area (not center)
      const lookTarget = new THREE.Vector3(
        this.state.position.x + rightX,
        this.state.position.y + 1.5,
        this.state.position.z + rightZ
      );
      this.camera.lookAt(lookTarget);
    }

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

  private deathAnimTimer = 0;

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
