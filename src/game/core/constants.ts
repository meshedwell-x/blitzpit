export const WORLD_SIZE = 800;
export const CHUNK_SIZE = 16;
export const BLOCK_SIZE = 1;
export const MAX_HEIGHT = 64;
export const WATER_LEVEL = 4;
export const GRAVITY = -25;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_RADIUS = 0.4;
export const PLAYER_SPEED = 8;
export const SPRINT_MULTIPLIER = 1.6;
export const CROUCH_MULTIPLIER = 0.5;
export const JUMP_FORCE = 9;
export const CROUCH_HEIGHT = 1.2;

export const MAX_PLAYERS = 40;
export const BOT_COUNT = 39;

// 3rd person camera
export const CAMERA_DISTANCE = 6;
export const CAMERA_HEIGHT = 3;
export const CAMERA_SMOOTH = 8;

export const ZONE_PHASES = [
  { delay: 120, shrinkTime: 60, damage: 1, radiusPercent: 1.0 },
  { delay: 60, shrinkTime: 50, damage: 2, radiusPercent: 0.6 },
  { delay: 50, shrinkTime: 40, damage: 3, radiusPercent: 0.35 },
  { delay: 40, shrinkTime: 30, damage: 5, radiusPercent: 0.15 },
  { delay: 25, shrinkTime: 20, damage: 8, radiusPercent: 0.05 },
  { delay: 15, shrinkTime: 10, damage: 10, radiusPercent: 0.0 },
];

export const BLOCK_TYPES = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  WOOD: 6,
  LEAVES: 7,
  BRICK: 8,
  CONCRETE: 9,
  GLASS: 10,
  METAL: 11,
  ROOF: 12,
  ROAD: 13,
  CRATE: 14,
  ROCK: 15,
} as const;

export const BLOCK_COLORS: Record<number, string> = {
  [BLOCK_TYPES.GRASS]: '#5ba34d',
  [BLOCK_TYPES.DIRT]: '#9b7530',
  [BLOCK_TYPES.STONE]: '#909090',
  [BLOCK_TYPES.SAND]: '#e0c890',
  [BLOCK_TYPES.WATER]: '#3a7bd5',
  [BLOCK_TYPES.WOOD]: '#9b6e3c',
  [BLOCK_TYPES.LEAVES]: '#3d8b3d',
  [BLOCK_TYPES.BRICK]: '#b86040',
  [BLOCK_TYPES.CONCRETE]: '#c0c0c0',
  [BLOCK_TYPES.GLASS]: '#a0d8ef',
  [BLOCK_TYPES.METAL]: '#b8b8b8',
  [BLOCK_TYPES.ROOF]: '#9b5020',
  [BLOCK_TYPES.ROAD]: '#505050',
  [BLOCK_TYPES.CRATE]: '#d8a040',
  [BLOCK_TYPES.ROCK]: '#707070',
};

export type WeaponType = 'pistol' | 'shotgun' | 'smg' | 'assault' | 'sniper';

export interface WeaponDef {
  name: string;
  type: WeaponType;
  damage: number;
  fireRate: number;
  range: number;
  spread: number;
  magazineSize: number;
  reloadTime: number;
  bulletSpeed: number;
  color: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
}

export const WEAPONS: Record<string, WeaponDef> = {
  pistol: {
    name: 'Pistol',
    type: 'pistol',
    damage: 18,
    fireRate: 4,
    range: 80,
    spread: 0.03,
    magazineSize: 15,
    reloadTime: 1.5,
    bulletSpeed: 200,
    color: '#888888',
    rarity: 'common',
  },
  shotgun: {
    name: 'Shotgun',
    type: 'shotgun',
    damage: 12,
    fireRate: 1.2,
    range: 30,
    spread: 0.12,
    magazineSize: 5,
    reloadTime: 2.5,
    bulletSpeed: 150,
    color: '#b87333',
    rarity: 'uncommon',
  },
  smg: {
    name: 'SMG',
    type: 'smg',
    damage: 14,
    fireRate: 12,
    range: 60,
    spread: 0.06,
    magazineSize: 30,
    reloadTime: 2.0,
    bulletSpeed: 180,
    color: '#4a4a4a',
    rarity: 'uncommon',
  },
  assault: {
    name: 'Assault Rifle',
    type: 'assault',
    damage: 22,
    fireRate: 8,
    range: 120,
    spread: 0.04,
    magazineSize: 30,
    reloadTime: 2.2,
    bulletSpeed: 250,
    color: '#2d2d2d',
    rarity: 'rare',
  },
  sniper: {
    name: 'Sniper Rifle',
    type: 'sniper',
    damage: 80,
    fireRate: 0.8,
    range: 300,
    spread: 0.005,
    magazineSize: 5,
    reloadTime: 3.0,
    bulletSpeed: 400,
    color: '#1a1a1a',
    rarity: 'epic',
  },
};

export const ITEM_TYPES = {
  WEAPON: 'weapon',
  AMMO: 'ammo',
  HEALTH: 'health',
  ARMOR: 'armor',
} as const;

export const WAVE_TRANSITION_DURATION = 8;
export const PLAYER_HEAL_BETWEEN_WAVES = 25;
export const MAX_BOTS_PER_WAVE = 80;
export const KILL_STREAK_TIMEOUT = 5;

export const KILL_STREAK_LABELS: Record<number, string> = {
  2: 'DOUBLE KILL',
  3: 'TRIPLE KILL',
  5: 'RAMPAGE',
  8: 'UNSTOPPABLE',
  10: 'GODLIKE',
  15: 'LEGENDARY',
};

export const RANK_THRESHOLDS: [number, string][] = [
  [1, 'Rookie'],
  [3, 'Survivor'],
  [5, 'Veteran'],
  [8, 'Elite'],
  [10, 'Legend'],
  [15, 'Immortal'],
  [20, 'God of War'],
];
