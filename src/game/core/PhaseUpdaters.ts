import type { GameEngine } from './GameEngine';
import {
  PLANE_SPEED,
  PLANE_AUTO_DROP_TIME,
  WORLD_SIZE,
  REINFORCEMENT_MIN_ALIVE,
  REINFORCEMENT_MIN_COUNT,
  REINFORCEMENT_MAX_EXTRA,
} from './constants';

export function updatePlane(engine: GameEngine, delta: number): void {
  engine.planeTimer += delta;
  const speed = PLANE_SPEED * delta;
  engine.planePosition.x += engine.planeDirection.x * speed;
  engine.planePosition.y += engine.planeDirection.y * speed;
  engine.planePosition.z += engine.planeDirection.z * speed;
  engine.player.state.position.copy(engine.planePosition);
  if (engine.planeMesh) {
    engine.planeMesh.position.copy(engine.planePosition);
    // Plane model faces -Z, so we rotate Y to match flight direction
    engine.planeMesh.rotation.y = Math.atan2(engine.planeDirection.x, engine.planeDirection.z) + Math.PI;
  }

  // 3rd person camera using player yaw/pitch for free-look
  const planeYaw = engine.player.getYaw();
  const planePitch = engine.player.pitch;
  const camDist = 40;
  const camHeight = 12;
  engine.camera.position.set(
    engine.planePosition.x + Math.sin(planeYaw) * camDist,
    engine.planePosition.y + camHeight - Math.sin(planePitch) * camDist * 0.5,
    engine.planePosition.z + Math.cos(planeYaw) * camDist
  );
  engine.camera.lookAt(engine.planePosition);

  if (engine.planeTimer > PLANE_AUTO_DROP_TIME ||
      Math.abs(engine.planePosition.x) > WORLD_SIZE * 0.6 ||
      Math.abs(engine.planePosition.z) > WORLD_SIZE * 0.6) {
    engine.drop();
  }
}

export function updateDropping(engine: GameEngine, delta: number): void {
  const groundH = engine.world.getHeightAt(engine.player.state.position.x, engine.player.state.position.z);
  const altitude = engine.player.state.position.y - groundH;

  // Auto-deploy parachute at very low altitude if player hasn't opened it
  if (!engine.parachuteOpen && altitude < 20) {
    engine.openParachute();
  }

  const keys = engine.player.keys;
  const yaw = engine.player.getYaw();

  if (engine.parachuteOpen) {
    // === PARACHUTE PHASE: slow descent, good lateral control ===
    engine.dropSpeed = 5;
    const lateralSpeed = 12;
    let fwd = 0;
    let strafe = 0;
    if (keys.has('KeyW')) fwd = lateralSpeed;
    if (keys.has('KeyS')) fwd = -lateralSpeed * 0.5;
    if (keys.has('KeyA')) strafe -= lateralSpeed;
    if (keys.has('KeyD')) strafe += lateralSpeed;

    engine.player.state.position.x += (-Math.sin(yaw) * fwd + -Math.cos(yaw) * strafe) * delta;
    engine.player.state.position.z += (-Math.cos(yaw) * fwd + Math.sin(yaw) * strafe) * delta;
    engine.player.state.position.y -= engine.dropSpeed * delta;
  } else {
    // === FREEFALL PHASE: realistic skydiving ===
    const baseDescend = 15;
    const diveBoost = keys.has('KeyW') ? 3.0 : 1.0;
    const spreadSlow = keys.has('KeyS') ? 0.4 : 1.0;
    const fallSpeed = baseDescend * diveBoost * spreadSlow;
    engine.dropSpeed = fallSpeed;

    const lateralSpeed = 8;
    const fwd = keys.has('KeyW') ? lateralSpeed * 2 : 0;
    const strafe = (keys.has('KeyA') ? -lateralSpeed : 0) + (keys.has('KeyD') ? lateralSpeed : 0);

    const vx = -Math.sin(yaw) * fwd + -Math.cos(yaw) * strafe;
    const vz = -Math.cos(yaw) * fwd + Math.sin(yaw) * strafe;

    engine.player.state.position.x += vx * delta;
    engine.player.state.position.z += vz * delta;
    engine.player.state.position.y -= fallSpeed * delta;

    engine.player.state.velocity.set(vx, -fallSpeed, vz);
  }

  engine.player.mesh.position.copy(engine.player.state.position);
  // Dive body tilt
  if (!engine.parachuteOpen) {
    const targetTilt = keys.has('KeyW') ? -1.2 : keys.has('KeyS') ? -0.1 : -0.4;
    engine.player.mesh.rotation.x += (targetTilt - engine.player.mesh.rotation.x) * 0.08;
    engine.player.mesh.rotation.y = -engine.player.getYaw();
  } else {
    engine.player.mesh.rotation.x += (0 - engine.player.mesh.rotation.x) * 0.1;
  }
  if (engine.playerDropMesh && engine.parachuteOpen) {
    engine.playerDropMesh.position.copy(engine.player.state.position);
  }

  // Camera: free-look
  const dropYaw = engine.player.getYaw();
  const dropPitch = engine.player.pitch;
  if (!engine.parachuteOpen) {
    const ffDist = 20;
    const ffHeight = 10;
    engine.camera.position.set(
      engine.player.state.position.x + Math.sin(dropYaw) * ffDist * Math.cos(dropPitch),
      engine.player.state.position.y + ffHeight - Math.sin(dropPitch) * ffDist,
      engine.player.state.position.z + Math.cos(dropYaw) * ffDist * Math.cos(dropPitch)
    );
    engine.camera.lookAt(engine.player.state.position);
  } else {
    engine.camera.position.set(
      engine.player.state.position.x + Math.sin(dropYaw) * 12 * Math.cos(dropPitch),
      engine.player.state.position.y + 8 - Math.sin(dropPitch) * 12,
      engine.player.state.position.z + Math.cos(dropYaw) * 12 * Math.cos(dropPitch)
    );
    engine.camera.lookAt(engine.player.state.position);
  }

  if (engine.player.state.position.y <= groundH + 0.6) {
    engine.player.state.position.y = groundH + 0.6;
    if (!engine.parachuteOpen) {
      engine.player.takeDamage(200);
      engine.soundManager.playExplosion();
      engine.player.addShake(0.5);
    } else if (engine.dropSpeed > 12) {
      engine.player.takeDamage(20);
      engine.player.addShake(0.3);
    }
    engine.player.state.velocity.set(0, 0, 0);
    engine.player.state.isGrounded = true;
    engine.gameState.phase = 'playing';
    engine.player.mesh.visible = true;
    if (engine.planeMesh) engine.planeMesh.visible = false;
    if (engine.playerDropMesh) engine.playerDropMesh.visible = false;
    engine.soundManager.playWaveStart();
    engine.notifyStateChange();
  }
}

export function updatePlayingPhase(engine: GameEngine, delta: number): void {
  if (engine.vehicleSystem.isPlayerInVehicle()) {
    engine.vehicleSystem.update(delta);
    const v = engine.vehicleSystem.playerVehicle;
    if (v) {
      // Roadkill
      if (Math.abs(v.speed) > 3) {
        for (const bot of engine.botSystem.bots) {
          if (bot.isDead) continue;
          const dx = v.position.x - bot.position.x;
          const dz = v.position.z - bot.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 2.5) {
            const damage = Math.abs(v.speed) * 4;
            bot.health -= damage;
            v.speed *= 0.7;
            engine.particleSystem.emitHitSpark(bot.position.clone());
            engine.soundManager.playExplosion();
            if (bot.health <= 0 && !bot.isDead) {
              bot.isDead = true;
              bot.health = 0;
              bot.mesh.rotation.x = Math.PI / 2;
              engine.botSystem.alive = Math.max(0, engine.botSystem.alive - 1);
              engine.player.state.kills++;
              engine.scoreboardSystem.recordKill(false);
              engine.particleSystem.emitDeath(bot.position.clone());
              engine.soundManager.playKillConfirm();
              bot.deathTime = Date.now();
              const vehicleKillerName = (typeof localStorage !== 'undefined' && localStorage.getItem('blitzpit_name')) || 'You';
              engine.botSystem.killFeed.push({
                killer: vehicleKillerName, victim: bot.name, weapon: 'Vehicle', time: Date.now()
              });
            }
          }
        }
      }

      // Tree collision
      if (Math.abs(v.speed) > 5) {
        for (let i = engine.world.treePositions.length - 1; i >= 0; i--) {
          const tree = engine.world.treePositions[i];
          const dx = v.position.x - tree.x;
          const dz = v.position.z - tree.z;
          if (Math.sqrt(dx * dx + dz * dz) < 2) {
            engine.particleSystem.emitDeath(tree.clone());
            engine.world.treePositions.splice(i, 1);
            v.speed *= 0.85;
            v.health -= 10;
            break;
          }
        }
      }

      // Vehicle camera
      const vCamDist = 10;
      const vCamHeight = 4;
      const pYaw = engine.player.yaw;
      const pPitch = engine.player.pitch;
      engine._tmpBehind.set(
        Math.sin(pYaw) * vCamDist * Math.cos(pPitch),
        vCamHeight - Math.sin(pPitch) * vCamDist,
        Math.cos(pYaw) * vCamDist * Math.cos(pPitch)
      );
      engine.camera.position.copy(v.position).add(engine._tmpBehind);
      const vLookTarget = v.position.clone();
      vLookTarget.y += 1.5;
      engine.camera.lookAt(vLookTarget);
      engine.soundManager.playVehicleEngine(v.speed);
    }
  } else {
    engine.player.update(delta);
    engine.soundManager.stopVehicleEngine();
  }

  engine.weaponSystem.update(delta);
  engine.grenadeSystem.update(delta, engine.botSystem.bots);
  engine.botSystem.update(delta);
  engine.bossSystem.updatePhases();
  engine.zoneSystem.update(delta, engine.botSystem.bots);
  engine.particleSystem.update(delta);

  // Day/night cycle
  engine.dayNightSystem.update(delta);
  engine.vehicleSystem.setNightMode(engine.dayNightSystem.isNight);
  engine.botSystem.setNightMode(engine.dayNightSystem.isNight);

  // Biome effects
  const playerBiome = engine.biomeSystem.getBiome(
    engine.player.state.position.x,
    engine.player.state.position.z
  );
  engine.player.biomeSpeedMultiplier = engine.biomeSystem.getSpeedMultiplier(playerBiome);

  // Animal update
  engine.animalSystem.update(delta, engine.player.state.position, engine.dayNightSystem.isNight);
  const animalDmg = engine.animalSystem.getAttackingAnimalDamage(engine.player.state.position);
  if (animalDmg > 0) {
    engine.player.takeDamage(animalDmg);
    engine.soundManager.playDamageTaken();
    engine.player.addShake(0.15);
  }

  // Environment damage from biome
  const envDmg = engine.biomeSystem.getEnvironmentDamage(playerBiome, engine.dayNightSystem.isNight, delta);
  if (envDmg > 0) {
    engine.player.takeDamage(envDmg);
  }

  // Nearby bot footsteps
  engine.botFootstepTimer -= delta;
  if (engine.botFootstepTimer <= 0) {
    engine.botFootstepTimer = 0.4;
    const playerPos = engine.player.state.position;
    const nearbyBots = engine.botSystem.bots
      .filter(b => !b.isDead && b.state !== 'landing')
      .map(b => ({ bot: b, dist: b.position.distanceTo(playerPos) }))
      .filter(b => b.dist < 25)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);
    for (const { bot } of nearbyBots) {
      const vol = engine.soundManager.getDistanceVolume(playerPos, bot.position, 25);
      if (vol > 0.1) {
        const pan = engine.soundManager.getStereoPan(playerPos, engine.player.getYaw(), bot.position);
        const biome = engine.biomeSystem.getBiome(bot.position.x, bot.position.z);
        const terrain = biome === 'tundra' ? 'snow' : biome === 'desert' ? 'sand' : biome === 'urban' ? 'concrete' : 'grass';
        engine.soundManager.playFootstep3D(terrain, vol * 0.5, pan);
      }
    }
  }

  engine.weatherSystem.update(delta, engine.player.state.position, playerBiome);

  // Weather affects combat
  const weather = engine.weatherSystem.currentWeather;
  if (weather === 'storm') {
    engine.weaponSystem.weatherSpreadMultiplier = 1.3;
    engine.botSystem.weatherDetectionMultiplier = 0.6;
  } else if (weather === 'rain') {
    engine.weaponSystem.weatherSpreadMultiplier = 1.1;
    engine.botSystem.weatherDetectionMultiplier = 0.8;
  } else if (weather === 'fog') {
    engine.weaponSystem.weatherSpreadMultiplier = 1.0;
    engine.botSystem.weatherDetectionMultiplier = 0.5;
  } else {
    engine.weaponSystem.weatherSpreadMultiplier = 1.0;
    engine.botSystem.weatherDetectionMultiplier = 1.0;
  }

  // Reinforcement plane
  updateReinforcements(engine, delta);

  // Rain ambient sound
  if (engine.weatherSystem.currentWeather === 'rain' || engine.weatherSystem.currentWeather === 'storm') {
    engine.soundManager.playRainAmbient();
  } else {
    engine.soundManager.stopRainAmbient();
  }

  // Check bullet hits
  const bullets = engine.weaponSystem.getBullets();
  const prevKills = engine.player.state.kills;
  engine.botSystem.checkBulletHits(bullets);

  // Bullet-animal collision
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const bullet = bullets[bi];
    if (bullet.ownerId !== 'player') continue;
    for (const animal of engine.animalSystem.animals) {
      if (animal.state === 'dead') continue;
      if (bullet.position.distanceTo(animal.position) < 1.5) {
        const killed = engine.animalSystem.damageAnimal(animal.id, bullet.damage);
        engine.particleSystem.emitBlood(animal.position.clone());
        if (killed) {
          engine.particleSystem.emitDeath(animal.position.clone());
          engine.soundManager.playKillConfirm();
        }
        engine.weaponSystem.removeBullet(bi);
        break;
      }
    }
  }

  const newKills = engine.player.state.kills;

  if (newKills > prevKills) {
    const killsDelta = newKills - prevKills;
    for (let k = 0; k < killsDelta; k++) {
      engine.scoreboardSystem.recordKill(false);
      engine.soundManager.playKillConfirm();
      let wpGain = 10;
      if (engine.skinSystem.hasXPBoost()) wpGain *= 2;
      engine.skinSystem.purchases.blitzPoints += wpGain;
    }

    // Boss kill reward
    const killedBoss = engine.bossSystem.bosses.find(b => b.isDead && !b.rewardClaimed);
    if (killedBoss) {
      killedBoss.rewardClaimed = true;
      engine.soundManager.playWaveComplete();
      engine.player.heal(50);
      engine.player.addArmor(50);
      const bossWpGain = engine.skinSystem.hasXPBoost() ? 200 : 100;
      engine.skinSystem.purchases.blitzPoints += bossWpGain;
    }

    engine.skinSystem.save();

    // Kill streak
    engine.killStreakTimer = 5;
    engine.gameState.killStreak = engine.scoreboardSystem.stats.currentKillStreak;
    engine.gameState.bestKillStreak = engine.scoreboardSystem.stats.bestKillStreak;

    const streakLabel = engine.scoreboardSystem.getKillStreakLabel(engine.gameState.killStreak);
    if (streakLabel) {
      engine.soundManager.playKillStreak(engine.gameState.killStreak);
    }

    // Achievement titles
    if (engine.scoreboardSystem.stats.totalKills >= 100 && !engine.skinSystem.owns('title_hunter')) {
      engine.skinSystem.purchases.ownedItems.push('title_hunter');
      engine.skinSystem.save();
    }
  }

  // Streak timeout
  if (engine.killStreakTimer > 0) {
    engine.killStreakTimer -= delta;
    if (engine.killStreakTimer <= 0) {
      engine.scoreboardSystem.resetStreak();
      engine.gameState.killStreak = 0;
    }
  }

  engine.scoreboardSystem.updateSurvivalTime(delta);

  engine.gameState.playersAlive = engine.botSystem.getAliveCount();
  engine.gameState.kills = engine.player.state.kills;
  engine.gameState.totalKills = engine.player.state.kills;

  if (engine.player.state.isDead) {
    if (engine.skinSystem.purchases.reviveTokens > 0 && !engine.reviveOffered) {
      engine.reviveOffered = true;
      engine.reviveTimer = 3.0;
    } else if (engine.reviveOffered && engine.reviveTimer > 0) {
      engine.reviveTimer -= delta;
      if (engine.reviveTimer <= 0) {
        engine.reviveOffered = false;
        engine.scoreboardSystem.endGame();
        engine.gameState.phase = 'dead';
        engine.notifyStateChange();
      }
    } else if (!engine.reviveOffered) {
      engine.scoreboardSystem.endGame();
      engine.gameState.phase = 'dead';
      engine.notifyStateChange();
    }
  } else if (engine.botSystem.alive <= 0) {
    engine.gameState.phase = 'wave_transition';
    engine.waveManager.startTransition();
    engine.soundManager.playWaveComplete();
    engine.notifyStateChange();
  }
}

function updateReinforcements(engine: GameEngine, delta: number): void {
  engine.reinforcementTimer -= delta;
  if (engine.reinforcementTimer <= 0 && engine.botSystem.alive < REINFORCEMENT_MIN_ALIVE) {
    engine.reinforcementTimer = engine.reinforcementInterval;
    const spawnCount = REINFORCEMENT_MIN_COUNT + Math.floor(Math.random() * REINFORCEMENT_MAX_EXTRA);
    engine.botSystem.spawnReinforcements(spawnCount);
    engine.gameState.playersAlive = engine.botSystem.getAliveCount();
    engine.soundManager.playWaveStart();
  }
}
