import * as THREE from 'three';
import { Bot } from './BotTypes';
import { DamageSystem } from '../damage/DamageSystem';
import { WeaponSystem } from '../weapons/WeaponSystem';
import { PlayerController } from '../player/PlayerController';

export interface BotCombatCallbacks {
  onBotHit: ((position: THREE.Vector3, isHeadshot: boolean, damage: number) => void) | null;
  onBotDeath: ((position: THREE.Vector3) => void) | null;
  onPlayerHit: ((fromPosition: THREE.Vector3) => void) | null;
}

export function checkBulletHits(
  bullets: { position: THREE.Vector3; damage: number; ownerId: string }[],
  bots: Bot[],
  player: PlayerController,
  weaponSystem: WeaponSystem,
  killFeed: { killer: string; victim: string; weapon: string; time: number }[],
  aliveRef: { alive: number },
  callbacks: BotCombatCallbacks,
): void {
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const bullet = bullets[bi];

    // Check hit on player (from bot bullets)
    if (bullet.ownerId !== 'player') {
      const distToPlayer = bullet.position.distanceTo(player.state.position);
      if (distToPlayer < 1.0) {
        player.takeDamage(bullet.damage);
        if (callbacks.onPlayerHit) callbacks.onPlayerHit(bullet.position.clone());
        if (player.state.isDead) {
          const killerBot = bots.find(b => b.id === bullet.ownerId);
          killFeed.push({
            killer: killerBot?.name || 'Bot',
            victim: 'You',
            weapon: killerBot?.weaponId || 'unknown',
            time: Date.now(),
          });
        }
        weaponSystem.removeBullet(bi);
        continue;
      }
    }

    // Check hit on bots (from player or other bot)
    for (const bot of bots) {
      if (bot.isDead || bot.id === bullet.ownerId) continue;
      const dist = bullet.position.distanceTo(bot.position);
      if (dist < 1.2) {
        // Headshot check
        const headY = bot.position.y + 1.2;
        const isHeadshot = Math.abs(bullet.position.y - headY) < 0.3;
        const result = DamageSystem.calculateDamage(bullet.damage, bot.health, bot.armor, isHeadshot);
        bot.health = result.remainingHealth;
        bot.armor = result.remainingArmor;

        if (callbacks.onBotHit) callbacks.onBotHit(bot.position.clone(), isHeadshot, result.finalDamage);

        // Hit reaction
        if (!bot.isDead && bot.state !== 'fighting') {
          bot.state = 'fighting';
          bot.stateTimer = 5;
        }

        if (result.killed && !bot.isDead) {
          handleBotDeath(bot, bullet, bots, player, weaponSystem, killFeed, aliveRef, callbacks);
        }

        weaponSystem.removeBullet(bi);
        break;
      }
    }
  }
}

export function damageBotDirect(
  botId: string,
  damage: number,
  killerId: string,
  bots: Bot[],
  player: PlayerController,
  weaponSystem: WeaponSystem,
  killFeed: { killer: string; victim: string; weapon: string; time: number }[],
  aliveRef: { alive: number },
): void {
  const bot = bots.find(b => b.id === botId);
  if (!bot || bot.isDead) return;

  const result = DamageSystem.calculateDamage(damage, bot.health, bot.armor, false);
  bot.health = result.remainingHealth;
  bot.armor = result.remainingArmor;

  if (!bot.isDead && bot.state !== 'fighting') {
    bot.state = 'fighting';
    bot.stateTimer = 5;
  }

  if (result.killed && !bot.isDead) {
    bot.isDead = true;
    bot.health = 0;
    bot.deathTime = Date.now();
    aliveRef.alive = Math.max(0, aliveRef.alive - 1);
    bot.mesh.rotation.x = Math.PI / 2;
    bot.mesh.position.y -= 0.5;

    const playerName = (typeof localStorage !== 'undefined' && localStorage.getItem('blitzpit_name')) || 'You';
    const killerName = killerId === 'player' ? playerName :
      (bots.find(b => b.id === killerId)?.name || 'Bot');
    const weaponName = killerId === 'player' ?
      (weaponSystem.getActiveWeapon()?.def.name || 'Unknown') :
      (bots.find(b => b.id === killerId)?.weaponId || 'unknown');

    killFeed.push({
      killer: killerName,
      victim: bot.name,
      weapon: weaponName,
      time: Date.now(),
    });

    if (killerId === 'player') {
      player.state.kills++;
    }

    // Drop loot on death
    dropLoot(bot, weaponSystem);
  }
}

function handleBotDeath(
  bot: Bot,
  bullet: { position: THREE.Vector3; ownerId: string },
  bots: Bot[],
  player: PlayerController,
  weaponSystem: WeaponSystem,
  killFeed: { killer: string; victim: string; weapon: string; time: number }[],
  aliveRef: { alive: number },
  callbacks: BotCombatCallbacks,
): void {
  bot.isDead = true;
  bot.health = 0;
  aliveRef.alive = Math.max(0, aliveRef.alive - 1);

  // Death animation - lay down + nudge away from bullet origin
  bot.mesh.rotation.x = Math.PI / 2;
  bot.mesh.position.y -= 0.5;
  const nudgeX = bot.position.x - bullet.position.x;
  const nudgeZ = bot.position.z - bullet.position.z;
  const nudgeLen = Math.sqrt(nudgeX * nudgeX + nudgeZ * nudgeZ);
  if (nudgeLen > 0) {
    bot.mesh.position.x += (nudgeX / nudgeLen) * 0.4;
    bot.mesh.position.z += (nudgeZ / nudgeLen) * 0.4;
  }

  if (callbacks.onBotDeath) callbacks.onBotDeath(bot.position.clone());

  // Schedule mesh removal via deathTime (cleaned in update())
  bot.deathTime = Date.now();

  const playerName = (typeof localStorage !== 'undefined' && localStorage.getItem('blitzpit_name')) || 'You';
  const killerName = bullet.ownerId === 'player' ? playerName :
    (bots.find(b => b.id === bullet.ownerId)?.name || 'Bot');
  const weaponName = bullet.ownerId === 'player' ?
    (weaponSystem.getActiveWeapon()?.def.name || 'Unknown') :
    (bots.find(b => b.id === bullet.ownerId)?.weaponId || 'unknown');

  killFeed.push({
    killer: killerName,
    victim: bot.name,
    weapon: weaponName,
    time: Date.now(),
  });

  if (bullet.ownerId === 'player') {
    player.state.kills++;
  }

  // Drop loot on death
  dropLoot(bot, weaponSystem);
}

function dropLoot(bot: Bot, weaponSystem: WeaponSystem): void {
  if (bot.weaponId) {
    weaponSystem.spawnItems([{
      position: bot.position.clone(),
      type: 'weapon',
      weaponId: bot.weaponId,
    }]);
  }
  weaponSystem.spawnItems([{
    position: bot.position.clone().add(new THREE.Vector3(0.5, 0, 0)),
    type: 'health',
  }]);
}
