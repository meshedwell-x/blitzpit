import * as THREE from 'three';
import type { GameEngine } from './GameEngine';
import { PLAYER_HEAL_BETWEEN_WAVES } from './constants';

export function startNextWave(engine: GameEngine): void {
  const wave = engine.waveManager.nextWave();
  const config = engine.waveManager.getWaveConfig(wave);

  // Zone reset with new speed multiplier
  engine.zoneSystem.reset();
  engine.zoneSystem.speedMultiplier = config.zoneShrinkSpeedMultiplier;

  // Clean up old items from previous wave
  for (const item of engine.weaponSystem.items) {
    if (!item.collected) {
      item.collected = true;
      engine.scene.remove(item.mesh);
    }
    // Dispose mesh resources
    if (item.mesh.geometry) item.mesh.geometry.dispose();
    if (item.mesh.material instanceof THREE.Material) item.mesh.material.dispose();
  }
  engine.weaponSystem.items = [];

  // Clear bullets and grenades
  engine.weaponSystem.clearBullets();
  engine.grenadeSystem.clearAll();

  // Refuel and repair vehicles
  for (const v of engine.vehicleSystem.vehicles) {
    v.fuel = 100;
    v.health = v.type === 'truck' ? 200 : 150;
  }

  // Respawn bots
  engine.botSystem.respawnForWave(config);

  // Boss spawn check
  const bossTypes = engine.bossSystem.shouldSpawnBoss(wave);
  for (const type of bossTypes) {
    const boss = engine.bossSystem.createBoss(type, wave, engine.scene, engine.world);
    engine.botSystem.bots.push(boss);
    engine.botSystem.alive++;
  }
  engine.bossSystem.updatePhases();

  // Spawn new weapons
  engine.weaponSystem.spawnItems(engine.world.itemSpawns);

  // Animal respawn
  engine.animalSystem.destroy();
  engine.animalSystem.spawn();

  // Heal player
  engine.player.heal(PLAYER_HEAL_BETWEEN_WAVES);

  // Award Wild Points for wave clear (doubled if XP boost active)
  const waveWpGain = engine.skinSystem.hasXPBoost() ? 100 : 50;
  engine.skinSystem.purchases.blitzPoints += waveWpGain;
  engine.skinSystem.save();

  // Achievement titles on wave milestones
  if (wave >= 10 && !engine.skinSystem.owns('title_legend')) {
    engine.skinSystem.purchases.ownedItems.push('title_legend');
    engine.skinSystem.save();
  }
  if (wave >= 20 && !engine.skinSystem.owns('title_godofwar')) {
    engine.skinSystem.purchases.ownedItems.push('title_godofwar');
    engine.skinSystem.save();
  }

  // Update scoreboard wave
  engine.scoreboardSystem.updateWave(wave);

  engine.gameState.phase = 'playing';
  engine.gameState.currentWave = wave;
  engine.gameState.playersAlive = engine.botSystem.getAliveCount();

  engine.particleSystem.emitWaveStart();
  engine.soundManager.playWaveStart();

  engine.notifyStateChange();
}
