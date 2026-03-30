import * as THREE from 'three';
import { PLAYER_SPEED, WEAPONS } from '../core/constants';
import { Bot } from './BotTypes';
import { WorldGenerator } from '../world/WorldGenerator';
import { WeaponSystem } from '../weapons/WeaponSystem';
import { PlayerController } from '../player/PlayerController';

export interface BotAIContext {
  player: PlayerController;
  world: WorldGenerator;
  weaponSystem: WeaponSystem;
  scene: THREE.Scene;
  bots: Bot[];
  weatherDetectionMultiplier: number;
}

// Module-level temp vectors to reduce GC pressure
const _tmpDir = new THREE.Vector3();
const _tmpFireDir = new THREE.Vector3();
const _tmpStrafeDir = new THREE.Vector3();
const _tmpFirePos = new THREE.Vector3();
const _tmpVec1 = new THREE.Vector3();

export function updateLanding(bot: Bot, delta: number, ctx: BotAIContext): void {
  const groundH = ctx.world.getEffectiveHeightAt(bot.position.x, bot.position.z);
  const surfaceY = groundH + 0.6;
  bot.position.y -= 40 * delta;
  if (bot.position.y <= surfaceY) {
    bot.position.y = surfaceY;
    // All bots start by looting after landing
    bot.state = 'looting';
    bot.stateTimer = bot.lootingTimeLeft;
  }
}

export function updateRoaming(bot: Bot, delta: number, ctx: BotAIContext): void {
  const playerPos = ctx.player.state.position;
  const distToPlayer = bot.position.distanceTo(playerPos);

  // Detection range reduced when inside building or by weather
  const effectiveDetection = (bot.inBuilding
    ? bot.detectionRange * 0.5
    : bot.detectionRange) * ctx.weatherDetectionMultiplier;

  // Unarmed bots flee from player if detected
  if (distToPlayer < effectiveDetection && !ctx.player.state.isDead) {
    if (!bot.weaponId) {
      bot.state = 'fleeing';
      bot.stateTimer = 8;
      return;
    }
    // Armed bot: can loot timer expired -> fight (scavenger: only 50% chance)
    if (bot.lootingTimeLeft <= 0) {
      if (bot.personality === 'scavenger' && Math.random() < 0.5) {
        // Scavenger keeps roaming instead of engaging
      } else {
        bot.state = 'fighting';
        bot.stateTimer = 3 + Math.random() * 5;
        return;
      }
    }
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
    if (!bot.targetPos) bot.targetPos = new THREE.Vector3();
    bot.targetPos.set(
      bot.position.x + Math.cos(angle) * dist,
      0,
      bot.position.z + Math.sin(angle) * dist
    );
    bot.stateTimer = 5 + Math.random() * 10;
  }

  // Move toward target
  if (bot.targetPos) {
    const dir = _tmpVec1
      .subVectors(bot.targetPos, bot.position)
      .setY(0)
      .normalize();

    bot.velocity.x = dir.x * PLAYER_SPEED * 0.6;
    bot.velocity.z = dir.z * PLAYER_SPEED * 0.6;
    bot.position.x += bot.velocity.x * delta;
    bot.position.z += bot.velocity.z * delta;

    bot.mesh.rotation.y = Math.atan2(dir.x, dir.z);

    if (bot.position.distanceTo(bot.targetPos) < 3) {
      bot.targetPos = null;
    }
  }

  // Bot-vs-bot: detect nearby armed bots -- BATTLE ROYALE everyone fights everyone
  if (bot.weaponId && bot.lootingTimeLeft <= 0) {
    for (const other of ctx.bots) {
      if (other.id === bot.id || other.isDead) continue;
      const d = bot.position.distanceTo(other.position);
      if (d < bot.detectionRange * 0.8) {
        bot.state = 'fighting';
        bot.stateTimer = 5 + Math.random() * 5;
        break;
      }
    }
  }
}

export function updateLooting(bot: Bot, delta: number, ctx: BotAIContext): void {
  const distToPlayer = bot.position.distanceTo(ctx.player.state.position);
  if (distToPlayer < bot.detectionRange && !ctx.player.state.isDead) {
    if (!bot.weaponId) { bot.state = 'fleeing'; bot.stateTimer = 8; return; }
  }

  // Find nearest weapon
  let nearestItem: { position: THREE.Vector3; weaponId?: string; index: number } | null = null;
  let nearestDist = Infinity;

  for (let i = 0; i < ctx.weaponSystem.items.length; i++) {
    const item = ctx.weaponSystem.items[i];
    if (item.collected || item.type !== 'weapon') continue;
    const dist = bot.position.distanceTo(item.position);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestItem = { position: item.position, weaponId: item.weaponId, index: i };
    }
  }

  if (nearestItem && nearestDist < 100) {
    const dir = _tmpVec1
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
      ctx.weaponSystem.items[nearestItem.index].collected = true;
      ctx.scene.remove(ctx.weaponSystem.items[nearestItem.index].mesh);
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

export function updateFighting(bot: Bot, delta: number, ctx: BotAIContext): void {
  const playerPos = ctx.player.state.position;

  if (!bot.weaponId) {
    bot.state = 'fleeing';
    bot.stateTimer = 5;
    return;
  }

  // Camper: never leave building -- ignore fight timer if inside
  if (bot.personality === 'camper' && bot.inBuilding) {
    // Stay inside, only shoot if target is within range
    const weapon = WEAPONS[bot.weaponId];
    if (!weapon) return;
    let targetPos = playerPos;
    let targetDist = ctx.player.state.isDead ? Infinity : bot.position.distanceTo(playerPos);
    for (const other of ctx.bots) {
      if (other.id === bot.id || other.isDead) continue;
      const d = bot.position.distanceTo(other.position);
      if (d < targetDist) { targetDist = d; targetPos = other.position; }
    }
    if (targetDist < weapon.range && bot.fireTimer <= 0) {
      const fireDir = _tmpFireDir.subVectors(targetPos, bot.position).normalize();
      const inaccuracy = (1 - bot.accuracy) * 0.15;
      fireDir.x += (Math.random() - 0.5) * inaccuracy;
      fireDir.y += (Math.random() - 0.5) * inaccuracy;
      fireDir.z += (Math.random() - 0.5) * inaccuracy;
      fireDir.normalize();
      _tmpFirePos.copy(bot.position); _tmpFirePos.y += 0.5;
      ctx.weaponSystem.fireBotWeapon(_tmpFirePos, fireDir, bot.weaponId, bot.id);
      bot.fireTimer = 1 / weapon.fireRate * (1 + (1 - bot.skill) * 0.5);
    }
    return;
  }

  const weapon = WEAPONS[bot.weaponId];
  if (!weapon) return;

  // Find nearest target: player OR other bot (BATTLE ROYALE -- everyone fights everyone)
  let targetPos = playerPos;
  let targetDist = ctx.player.state.isDead ? Infinity : bot.position.distanceTo(playerPos);
  for (const other of ctx.bots) {
    if (other.id === bot.id || other.isDead) continue;
    const d = bot.position.distanceTo(other.position);
    if (d < targetDist) {
      targetDist = d;
      targetPos = other.position;
    }
  }

  // Personality: aggressive has extended detection, weather reduces it
  const detectionMult = bot.personality === 'aggressive' ? 1.3 : 1.0;
  const effectiveDetection = (bot.inBuilding
    ? bot.detectionRange * 0.5 * detectionMult
    : bot.detectionRange * detectionMult) * ctx.weatherDetectionMultiplier;

  // Lose interest if target too far
  if (targetDist > effectiveDetection * 2) {
    bot.state = 'roaming';
    bot.stateTimer = 5;
    return;
  }

  // Personality: cautious seeks cover earlier
  const coverHpThreshold = bot.personality === 'cautious' ? bot.health * 100 * 0.5 : 50;
  if (bot.health < coverHpThreshold) {
    const buildings = ctx.world.getNearbyBuildings(bot.position.x, bot.position.z);
    let nearestBuildingDist = Infinity;
    let ncx = 0, ncz = 0;
    for (const b of buildings) {
      const cx = b.x + b.width / 2;
      const cz = b.z + b.depth / 2;
      const dx = bot.position.x - cx;
      const dz = bot.position.z - cz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < nearestBuildingDist) {
        nearestBuildingDist = d;
        ncx = cx; ncz = cz;
      }
    }
    if (nearestBuildingDist < 40 && !bot.inBuilding) {
      const dx = ncx - bot.position.x;
      const dz = ncz - bot.position.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      bot.position.x += (dx / len) * PLAYER_SPEED * 0.7 * delta;
      bot.position.z += (dz / len) * PLAYER_SPEED * 0.7 * delta;
    }
  }

  // Face target
  const dir = _tmpDir
    .subVectors(targetPos, bot.position)
    .setY(0)
    .normalize();
  bot.mesh.rotation.y = Math.atan2(dir.x, dir.z);

  // Optimal range: sniper prefers to stay farther back
  const rangeMultiplier = bot.personality === 'sniper' ? 0.7 : 0.4;
  const optimalRange = weapon.range * rangeMultiplier;
  if (targetDist > optimalRange * 1.5) {
    bot.position.x += dir.x * PLAYER_SPEED * 0.5 * delta;
    bot.position.z += dir.z * PLAYER_SPEED * 0.5 * delta;
  } else if (targetDist < optimalRange * 0.5) {
    bot.position.x -= dir.x * PLAYER_SPEED * 0.4 * delta;
    bot.position.z -= dir.z * PLAYER_SPEED * 0.4 * delta;
  } else {
    _tmpStrafeDir.set(-dir.z, 0, dir.x);
    const strafeSide = Math.sin(Date.now() * 0.002 + bot.skill * 1000 + bot.position.x * 7.3) > 0 ? 1 : -1;
    bot.position.x += _tmpStrafeDir.x * PLAYER_SPEED * 0.3 * strafeSide * delta;
    bot.position.z += _tmpStrafeDir.z * PLAYER_SPEED * 0.3 * strafeSide * delta;
  }

  // Fire at target (player or bot)
  if (targetDist < weapon.range && bot.fireTimer <= 0) {
    const fireDir = _tmpFireDir
      .subVectors(targetPos, bot.position)
      .normalize();

    const inaccuracy = (1 - bot.accuracy) * 0.15;
    fireDir.x += (Math.random() - 0.5) * inaccuracy;
    fireDir.y += (Math.random() - 0.5) * inaccuracy;
    fireDir.z += (Math.random() - 0.5) * inaccuracy;
    fireDir.normalize();

    _tmpFirePos.copy(bot.position);
    _tmpFirePos.y += 0.5;
    ctx.weaponSystem.fireBotWeapon(
      _tmpFirePos,
      fireDir,
      bot.weaponId,
      bot.id
    );

    bot.fireTimer = 1 / weapon.fireRate * (1 + (1 - bot.skill) * 0.5);
  }

  // Personality-based flee HP threshold
  let fleeHpThreshold = 30;
  if (bot.personality === 'aggressive') fleeHpThreshold = 15;
  else if (bot.personality === 'cautious') fleeHpThreshold = 50;

  if (bot.health < fleeHpThreshold) {
    bot.state = 'fleeing';
    bot.stateTimer = 5;
    return;
  }
}

export function updateFleeing(bot: Bot, delta: number, ctx: BotAIContext): void {
  const playerPos = ctx.player.state.position;
  const dir = _tmpVec1
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

export function updateBotDriving(bot: Bot, delta: number, playerPos: THREE.Vector3, world: WorldGenerator): void {
  const v = bot.vehicleRef;
  if (!v || v.health <= 0 || v.fuel <= 0) {
    exitBotVehicle(bot);
    return;
  }

  // Drive toward player
  const dx = playerPos.x - v.position.x;
  const dz = playerPos.z - v.position.z;
  const targetAngle = Math.atan2(-dx, -dz);

  let angleDiff = targetAngle - v.rotation;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  v.rotation += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 2.0 * delta);

  const distToPlayer = Math.sqrt(dx * dx + dz * dz);
  if (distToPlayer > 5) {
    v.speed = Math.min(v.speed + 15 * delta, v.maxSpeed * 0.7);
  } else {
    v.speed *= 0.95;
  }

  const newX = v.position.x - Math.sin(v.rotation) * v.speed * delta;
  const newZ = v.position.z - Math.cos(v.rotation) * v.speed * delta;
  v.position.x = newX;
  v.position.z = newZ;

  const groundH = world.getHeightAt(v.position.x, v.position.z);
  v.position.y = groundH + 0.8;

  // Fuel consumption
  v.fuel -= Math.abs(v.speed) * delta * 0.05;

  // Sync mesh
  v.mesh.position.copy(v.position);
  v.mesh.rotation.y = v.rotation;

  // Wheel animation
  const childCount = v.mesh.children.length;
  for (let wi = Math.max(0, childCount - 4); wi < childCount; wi++) {
    const wheel = v.mesh.children[wi];
    if (wheel) wheel.rotation.x += v.speed * delta * 0.5;
  }

  // Bot follows vehicle position
  bot.position.copy(v.position);

  // Exit conditions
  if (bot.health < 30 || v.fuel < 5 || bot.stateTimer <= 0) {
    exitBotVehicle(bot);
  }
}

function exitBotVehicle(bot: Bot): void {
  if (bot.vehicleRef) {
    bot.vehicleRef.isOccupied = false;
    bot.vehicleRef.occupantId = null;
    bot.vehicleRef.speed = 0;
    bot.position.x += 2;
    bot.vehicleRef = null;
  }
  bot.inVehicle = false;
  bot.mesh.visible = true;
  bot.state = 'roaming';
  bot.stateTimer = 3;
}

export function updateWalkAnimation(bot: Bot): void {
  const isMoving = bot.state === 'roaming' || bot.state === 'fighting' || bot.state === 'fleeing' || bot.state === 'looting';
  if (isMoving && bot.state !== 'landing') {
    const walkSpeed = bot.state === 'fleeing' ? 0.015 : 0.01;
    const walkCycle = Math.sin(Date.now() * walkSpeed + bot.position.x * 3) * 0.7;
    const legs = bot.mesh.children;
    // legs[4]=leftLeg, legs[5]=rightLeg, legs[2]=leftArm, legs[3]=rightArm
    if (legs[4]) legs[4].rotation.x = walkCycle;
    if (legs[5]) legs[5].rotation.x = -walkCycle;
    if (legs[2]) legs[2].rotation.x = -walkCycle * 0.5;
    if (legs[3]) legs[3].rotation.x = walkCycle * 0.5;
  } else {
    const legs = bot.mesh.children;
    if (legs[2]) legs[2].rotation.x *= 0.9;
    if (legs[3]) legs[3].rotation.x *= 0.9;
    if (legs[4]) legs[4].rotation.x *= 0.9;
    if (legs[5]) legs[5].rotation.x *= 0.9;
  }
}
