export interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: 'skin' | 'effect' | 'trail' | 'chute' | 'name_color' | 'banner' | 'utility';
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'special';
  priceINR: number;
  priceUSD: number;
  priceCUB: number;
  colors?: Record<string, number>;
  emissive?: number;
  emissiveIntensity?: number;
}

export interface CubCoinPack {
  id: string;
  name: string;
  coins: number;
  bonus: number;
  priceINR: number;
  priceUSD: number;
}

export const WELCOME_PACK = {
  id: 'welcome',
  name: 'WELCOME PACK',
  description: '500 CUB + VIP Badge + Random Skin',
  priceINR: 9,
  priceUSD: 0.11,
  coins: 500,
  oneTime: true,
};

export const CUB_COIN_PACKS: CubCoinPack[] = [
  { id: 'pack_29', name: 'Small Crate', coins: 300, bonus: 0, priceINR: 29, priceUSD: 0.35 },
  { id: 'pack_79', name: 'Supply Box', coins: 900, bonus: 100, priceINR: 79, priceUSD: 0.95 },
  { id: 'pack_149', name: 'Airdrop', coins: 2000, bonus: 300, priceINR: 149, priceUSD: 1.79 },
  { id: 'pack_299', name: 'War Chest', coins: 4500, bonus: 1000, priceINR: 299, priceUSD: 3.59 },
  { id: 'pack_499', name: 'Arsenal', coins: 8000, bonus: 2500, priceINR: 499, priceUSD: 5.99 },
];

export const DAILY_DEALS = [
  { id: 'daily_boost', name: 'DAILY BOOST', description: '200 CUB + 2x XP 1hr + Random Kill Effect', priceINR: 19, priceUSD: 0.23, daily: true },
  { id: 'lucky_box', name: 'LUCKY BOX', description: 'Random Skin (Legendary 1%!)', priceINR: 29, priceUSD: 0.35, daily: true },
];

export const SHOP_ITEMS: ShopItem[] = [
  // Skins
  { id: 'skin_ghost', name: 'Ghost Ops', description: 'Translucent white', category: 'skin', rarity: 'epic', priceINR: 149, priceUSD: 1.79, priceCUB: 1500, colors: { body: 0xeeeeee, arms: 0xdddddd, legs: 0xcccccc }, emissive: 0xffffff, emissiveIntensity: 0.1 },
  { id: 'skin_lava', name: 'Lava Warrior', description: 'Molten armor', category: 'skin', rarity: 'legendary', priceINR: 299, priceUSD: 3.59, priceCUB: 3000, colors: { body: 0xff4400, arms: 0xff6600, legs: 0x881100 }, emissive: 0xff2200, emissiveIntensity: 0.3 },
  { id: 'skin_gold', name: 'Gold Plated', description: 'Pure gold', category: 'skin', rarity: 'legendary', priceINR: 299, priceUSD: 3.59, priceCUB: 3500, colors: { body: 0xffd700, arms: 0xdaa520, legs: 0xb8860b }, emissive: 0xffd700, emissiveIntensity: 0.2 },
  { id: 'skin_arctic', name: 'Arctic Sniper', description: 'Snow camo', category: 'skin', rarity: 'rare', priceINR: 79, priceUSD: 0.95, priceCUB: 800, colors: { body: 0xf0f0f0, arms: 0xe0e0e0, legs: 0xd0d0d0 } },
  { id: 'skin_neon', name: 'Neon Punk', description: 'Glowing neon', category: 'skin', rarity: 'epic', priceINR: 149, priceUSD: 1.79, priceCUB: 2000, colors: { body: 0x0088ff, arms: 0x00ff88, legs: 0xff0088 }, emissive: 0x00ffff, emissiveIntensity: 0.4 },
  { id: 'skin_shadow', name: 'Shadow Reaper', description: 'Dark assassin', category: 'skin', rarity: 'legendary', priceINR: 299, priceUSD: 3.59, priceCUB: 4000, colors: { body: 0x1a1a1a, arms: 0x111111, legs: 0x0a0a0a }, emissive: 0x330000, emissiveIntensity: 0.15 },
  { id: 'skin_jungle', name: 'Jungle Camo', description: 'Forest camo', category: 'skin', rarity: 'common', priceINR: 29, priceUSD: 0.35, priceCUB: 300, colors: { body: 0x2d5a1e, arms: 0x1a4010, legs: 0x3a3a2a } },
  { id: 'skin_desert', name: 'Desert Storm', description: 'Sand tactical', category: 'skin', rarity: 'common', priceINR: 29, priceUSD: 0.35, priceCUB: 300, colors: { body: 0xc4a35a, arms: 0xb8963e, legs: 0x8b7530 } },
  // Kill Effects
  { id: 'fx_explode', name: 'Block Explosion', description: 'Shatter into blocks', category: 'effect', rarity: 'rare', priceINR: 29, priceUSD: 0.35, priceCUB: 300 },
  { id: 'fx_fire', name: 'Incinerate', description: 'Burn on kill', category: 'effect', rarity: 'rare', priceINR: 29, priceUSD: 0.35, priceCUB: 500 },
  { id: 'fx_electric', name: 'Lightning Strike', description: 'Lightning on kill', category: 'effect', rarity: 'epic', priceINR: 49, priceUSD: 0.59, priceCUB: 800 },
  // Name Colors
  { id: 'name_gold', name: 'Gold Name', description: 'Golden nickname', category: 'name_color', rarity: 'rare', priceINR: 49, priceUSD: 0.59, priceCUB: 500 },
  { id: 'name_rainbow', name: 'Rainbow Name', description: 'Animated rainbow', category: 'name_color', rarity: 'epic', priceINR: 49, priceUSD: 0.59, priceCUB: 800 },
  // Trails
  { id: 'trail_smoke', name: 'Smoke Trail', description: 'Leave smoke', category: 'trail', rarity: 'rare', priceINR: 49, priceUSD: 0.59, priceCUB: 400 },
  { id: 'trail_spark', name: 'Spark Trail', description: 'Sparks when sprinting', category: 'trail', rarity: 'epic', priceINR: 79, priceUSD: 0.95, priceCUB: 800 },
  // Utility
  { id: 'revive_3', name: 'Revive Token x3', description: 'Revive on death (1/wave)', category: 'utility', rarity: 'special', priceINR: 19, priceUSD: 0.23, priceCUB: 200 },
  { id: 'xp_boost', name: '2x XP Boost (3hr)', description: 'Double XP for 3 hours', category: 'utility', rarity: 'special', priceINR: 29, priceUSD: 0.35, priceCUB: 250 },
  { id: 'name_change', name: 'Name Change', description: 'Change your nickname', category: 'utility', rarity: 'common', priceINR: 9, priceUSD: 0.11, priceCUB: 100 },
];

export const RARITY_COLORS_HEX: Record<string, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
  special: '#10b981',
};
