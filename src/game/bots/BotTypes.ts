import * as THREE from 'three';

export interface Bot {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number;
  armor: number;
  isDead: boolean;
  weaponId: string | null;
  mesh: THREE.Group;
  targetPos: THREE.Vector3 | null;
  state: 'landing' | 'looting' | 'roaming' | 'fighting' | 'fleeing';
  stateTimer: number;
  fireTimer: number;
  detectionRange: number;
  accuracy: number;
  skill: number; // 0-1
  name: string;
  lootingTimeLeft: number; // required looting time before switching to fighting
  inBuilding: boolean; // is bot currently inside a building
  flashlight: THREE.PointLight | null;
  personality: 'aggressive' | 'cautious' | 'sniper' | 'scavenger' | 'camper';
  level: 'recruit' | 'soldier' | 'veteran' | 'elite' | 'boss';
  deathTime: number; // timestamp when bot died, 0 if alive or mesh already cleaned
}

export const BOT_NAMES = [
  // Global callsigns
  'Striker', 'Ghost', 'Viper', 'Shadow', 'Phoenix',
  'Hawk', 'Storm', 'Blade', 'Wolf', 'Titan',
  'Cobra', 'Falcon', 'Raven', 'Steel', 'Frost',
  'Thunder', 'Ninja', 'Tank', 'Scout', 'Rogue',
  'Ace', 'Blaze', 'Reaper', 'Hunter', 'Eagle',
  'Bear', 'Lynx', 'Omega', 'Alpha', 'Chaos',
  'Fury', 'Wraith', 'Doom', 'Spark', 'Flux',
  'Onyx', 'Pulse', 'Shade', 'Apex', 'Drift',
  'Hex', 'Nova', 'Zen', 'Crypt', 'Volt',
  // Indian themed
  'Arjun', 'Kali', 'Shiva', 'Indra', 'Agni',
  'Vayu', 'Durga', 'Rajan', 'Vikram', 'Ashoka',
  'Priya', 'Rani', 'Deepak', 'Surya', 'Chandra',
  'Naga', 'Garuda', 'Raksha', 'Deva', 'Maya',
  // IO-style random names
  'xX_Pro_Xx', 'NoScope360', 'BotKiller', 'EZclap',
  'SendHelp', 'Tryhard', 'Camper69', 'RushB',
  'Potato', 'Noob', 'GG_WP', 'Clutch',
  'Sweat', 'Goated', 'TouchGrass', 'Ratio',
  'Sussy', 'NPC_Andy', 'AimBot', 'Lag',
];

export const BOT_PERSONALITIES: Bot['personality'][] = ['aggressive', 'cautious', 'sniper', 'scavenger', 'camper'];

export function randomPersonality(): Bot['personality'] {
  return BOT_PERSONALITIES[Math.floor(Math.random() * BOT_PERSONALITIES.length)];
}

export function skillToLevel(skill: number): Bot['level'] {
  if (skill > 0.8) return 'elite';
  if (skill > 0.6) return 'veteran';
  if (skill > 0.4) return 'soldier';
  return 'recruit';
}
