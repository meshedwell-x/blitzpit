import * as THREE from 'three';

export interface DamageEvent {
  targetId: string;
  damage: number;
  sourceId: string;
  isHeadshot: boolean;
  position: THREE.Vector3;
}

export interface KillEvent {
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  weaponName: string;
  position: THREE.Vector3;
  isHeadshot: boolean;
}

export interface SpawnConfig {
  count: number;
  skillRange: [number, number];
  weaponChance: number;
  armorChance: number;
  healthBonus: number;
  armorBonus: number;
  lootingTime: number;
}

export interface KillFeedEntry {
  killer: string;
  victim: string;
  weapon: string;
  time: number;
}
