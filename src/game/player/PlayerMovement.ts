import * as THREE from 'three';
import {
  PLAYER_SPEED, SPRINT_MULTIPLIER,
  CROUCH_MULTIPLIER, JUMP_FORCE, GRAVITY,
  WORLD_SIZE,
} from '../core/constants';
import { PlayerController } from './PlayerController';

export function updatePlayerMovement(controller: PlayerController, delta: number): void {
  // Slow health regen when not at full health
  if (controller.state.health < 100 && controller.state.health > 0) {
    controller.state.health = Math.min(100, controller.state.health + 0.5 * delta);
  }

  // Slide cooldown tick
  if (controller.slideCooldown > 0) controller.slideCooldown -= delta;

  // Sliding logic (takes priority over normal movement)
  if (controller.slideTimer > 0) {
    controller.slideTimer -= delta;
    const slideSpeed = 16 * (controller.slideTimer / 0.8); // decelerate
    controller.state.velocity.x = controller.slideDir.x * slideSpeed;
    controller.state.velocity.z = controller.slideDir.z * slideSpeed;
    if (controller.slideTimer <= 0) {
      controller.isSliding = false;
      controller.mesh.scale.y = controller.state.isCrouching ? 0.7 : 1.0;
    }
    // Gravity still applies during slide
    controller.state.velocity.y += GRAVITY * delta;
  } else {
    // Normal movement
    const moveDir = new THREE.Vector3();
    const forward = new THREE.Vector3(
      -Math.sin(controller.yaw), 0, -Math.cos(controller.yaw)
    ).normalize();
    const right = new THREE.Vector3(
      Math.cos(controller.yaw), 0, -Math.sin(controller.yaw)
    ).normalize();

    if (controller.keys.has('KeyW') || controller.mobileInput.z < -0.1) moveDir.add(forward);
    if (controller.keys.has('KeyS') || controller.mobileInput.z > 0.1) moveDir.sub(forward);
    if (controller.keys.has('KeyA') || controller.mobileInput.x < -0.1) moveDir.sub(right);
    if (controller.keys.has('KeyD') || controller.mobileInput.x > 0.1) moveDir.add(right);

    const isMoving = moveDir.length() > 0;
    if (isMoving) moveDir.normalize();

    let speed = PLAYER_SPEED * controller.biomeSpeedMultiplier;
    if (controller.state.isSprinting) speed *= SPRINT_MULTIPLIER;
    if (controller.state.isCrouching) speed *= CROUCH_MULTIPLIER;
    if (controller.isADS) speed *= 0.6;

    controller.state.velocity.x = moveDir.x * speed;
    controller.state.velocity.z = moveDir.z * speed;

    // Gravity
    controller.state.velocity.y += GRAVITY * delta;

    // Jump
    if (controller.keys.has('Space') && controller.state.isGrounded) {
      controller.state.velocity.y = JUMP_FORCE;
      controller.state.isGrounded = false;
    }

    // Footstep sound
    if (isMoving && controller.state.isGrounded) {
      const threshold = controller.state.isSprinting ? 1.0 : (controller.state.isCrouching ? 2.5 : controller.stepThreshold);
      controller.stepDistance += speed * delta;
      if (controller.stepDistance >= threshold) {
        controller.stepDistance = 0;
        if (controller.onFootstep) controller.onFootstep();
      }
    } else {
      controller.stepDistance = 0;
    }
  }

  // Apply velocity
  const newPos = controller.state.position.clone();
  newPos.x += controller.state.velocity.x * delta;
  newPos.y += controller.state.velocity.y * delta;
  newPos.z += controller.state.velocity.z * delta;

  // Tree collision -- prevent walking through trees (spatial grid lookup)
  const TREE_RADIUS = 1.0;
  const PLAYER_RADIUS = 0.4;
  const treeCollisionDist = TREE_RADIUS + PLAYER_RADIUS;
  for (const treePos of controller.world.getNearbyTrees(newPos.x, newPos.z, 5)) {
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
  const buildings = controller.world.getNearbyBuildings(newPos.x, newPos.z);
  for (const b of buildings) {
    const baseH = controller.world.getHeightAt(b.x, b.z);

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
  const groundHeight = controller.world.getEffectiveHeightAt(newPos.x, newPos.z);
  const surfaceY = groundHeight + 0.6;

  // Swimming: terrain height at or below WATER_LEVEL (4)
  const WATER_SURFACE = 4.5; // WATER_LEVEL + 0.5
  const rawGroundHeight = controller.world.getHeightAt(newPos.x, newPos.z);
  if (rawGroundHeight <= 4 && newPos.y < WATER_SURFACE + 0.5) {
    // Swimming mode
    controller.state.isSwimming = true;
    controller.swimTimer += delta;
    // Drowning damage after 15 seconds
    if (controller.swimTimer > 15) {
      controller.state.health -= 2 * delta;
      if (controller.state.health < 0) controller.state.health = 0;
    }
    newPos.y = WATER_SURFACE;
    controller.state.velocity.y = 0;
    controller.state.isGrounded = false;
    // Reduced speed in water
    controller.state.velocity.x *= 0.4;
    controller.state.velocity.z *= 0.4;
    // SPACE: surface leap
    if (controller.keys.has('Space')) {
      controller.state.velocity.y = 3;
    }
  } else {
    controller.state.isSwimming = false;
    controller.swimTimer = 0;
    if (newPos.y < surfaceY) {
      newPos.y = surfaceY;
      controller.state.velocity.y = 0;
      controller.state.isGrounded = true;
    }
  }

  // World bounds
  const halfWorld = WORLD_SIZE / 2;
  newPos.x = Math.max(-halfWorld, Math.min(halfWorld, newPos.x));
  newPos.z = Math.max(-halfWorld, Math.min(halfWorld, newPos.z));

  controller.state.position.copy(newPos);

  // Update player mesh position & rotation
  controller.mesh.position.set(
    controller.state.position.x,
    controller.state.position.y,
    controller.state.position.z
  );
  controller.mesh.rotation.y = controller.yaw;
  if (!controller.isSliding) {
    controller.mesh.scale.y = controller.state.isCrouching ? 0.7 : 1.0;
  }
}
