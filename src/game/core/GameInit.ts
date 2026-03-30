import { WEAPONS } from './constants';
import type { GameEngine } from './GameEngine';

/**
 * Wires up all callback connections between subsystems.
 * Extracted from GameEngine.init() to keep GameEngine under 350 lines.
 */
export function initCallbacks(engine: GameEngine): void {
  engine.vehicleSystem.onHonk = () => {
    engine.soundManager.playHorn();
  };

  engine.zoneSystem.onBotKill = (_botId: string) => {
    engine.botSystem.alive = Math.max(0, engine.botSystem.alive - 1);
  };

  engine.grenadeSystem.onExplosion = (pos, _damage, radius, type) => {
    if (type === 'flash') engine.flashTimer = 2.0;
    if (type === 'frag') {
      engine.particleSystem.emitExplosion(pos, radius);
      const dist = pos.distanceTo(engine.player.state.position);
      const vol = Math.max(0, 1 - dist / 300);
      if (vol > 0) {
        engine.soundManager.playExplosion();
      }
      if (dist < 30) {
        engine.player.addShake(0.3 * (1 - dist / 30));
      }
    }
  };

  engine.grenadeSystem.onBotKill = (_botId: string) => {
    engine.botSystem.alive = Math.max(0, engine.botSystem.alive - 1);
    engine.scoreboardSystem.recordKill(false);
    engine.player.state.kills++;
    engine.soundManager.playKillConfirm();
  };

  engine.weaponSystem.onFire = (weaponType, pos, dir) => {
    engine.soundManager.playGunshot(weaponType);
    engine.particleSystem.emitMuzzleFlash(pos, dir);
    const weaponDef = WEAPONS[weaponType];
    if (weaponDef) {
      engine.player.applyRecoil(weaponDef.recoilVertical, weaponDef.recoilHorizontal);
    }
  };

  engine.weaponSystem.onBotFire = (pos, _dir, weaponType) => {
    engine.soundManager.playGunshot3D(
      weaponType,
      pos,
      engine.player.state.position,
      engine.player.getYaw()
    );
  };

  engine.weaponSystem.onPickup = (pos) => {
    engine.soundManager.playPickup();
    engine.particleSystem.emitPickupGlow(pos);
  };

  engine.botSystem.onBotHit = (pos, isHeadshot) => {
    engine.particleSystem.emitHitSpark(pos);
    engine.particleSystem.emitBlood(pos);
    if (isHeadshot) engine.soundManager.playHeadshot();
    engine.player.addShake(0.1);
    // Show hit marker on any bot hit
    engine.hitMarkerActive = true;
    engine.hitMarkerTimer = 0.15;
  };

  engine.botSystem.onBotDeath = (pos) => {
    engine.particleSystem.emitDeath(pos);
  };

  engine.botSystem.onPlayerHit = (fromPos) => {
    engine.soundManager.playDamageTaken();
    engine.player.addShake(0.2);
    engine.lastDamageFrom = fromPos.clone();
    engine.lastDamageTime = Date.now();
    // Red screen flash on player hit
    engine.playerHitFlash = true;
    engine.playerHitFlashTimer = 0.1;
  };

  engine.weaponSystem.onMelee = (pos) => {
    engine.soundManager.playDamageTaken();
    engine.player.addShake(0.15);
    const fwd = engine.player.getForwardDirection();
    const meleeTarget = pos.clone().add(fwd.clone().multiplyScalar(2));
    const meleeDamage = engine.weaponSystem.weapons[engine.weaponSystem.activeSlot] ? 35 : 20;
    for (const bot of engine.botSystem.bots) {
      if (bot.isDead) continue;
      if (bot.position.distanceTo(meleeTarget) < 2.5) {
        bot.health -= meleeDamage;
        engine.particleSystem.emitHitSpark(bot.position.clone());
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
          const meleeKillerName = (typeof localStorage !== 'undefined' && localStorage.getItem('blitzpit_name')) || 'You';
          engine.botSystem.killFeed.push({
            killer: meleeKillerName, victim: bot.name, weapon: 'Melee', time: Date.now()
          });
        }
        break;
      }
    }
  };

  engine.player.onFootstep = () => {
    const groundH = engine.world.getHeightAt(engine.player.state.position.x, engine.player.state.position.z);
    if (groundH <= 4) {
      engine.soundManager.playFootstep('water');
      return;
    }
    const biome = engine.biomeSystem.getBiome(engine.player.state.position.x, engine.player.state.position.z);
    const terrain = biome === 'tundra' ? 'snow' : biome === 'desert' ? 'sand' : biome === 'urban' ? 'concrete' : 'grass';
    engine.soundManager.playFootstep(terrain);
  };

  engine.zoneSystem.onShrinkStart = () => {
    engine.soundManager.playZoneWarning();
  };

  engine.zoneSystem.onPlayerOutsideZone = () => {
    engine.soundManager.playZoneWarning();
  };
}
