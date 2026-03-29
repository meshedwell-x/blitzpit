export interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: 'skin' | 'effect' | 'trail' | 'chute' | 'name_color' | 'banner';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  priceUSD: number;
  priceCUB: number;
  colors?: Record<string, number>; // mesh part -> color hex
  emissive?: number;
  emissiveIntensity?: number;
}

export interface CubCoinPack {
  id: string;
  name: string;
  coins: number;
  bonus: number;
  priceUSD: number;
}

export const CUB_COIN_PACKS: CubCoinPack[] = [
  { id: 'starter', name: 'Ammo Box', coins: 200, bonus: 0, priceUSD: 0.99 },
  { id: 'basic', name: 'Supply Crate', coins: 500, bonus: 0, priceUSD: 2.99 },
  { id: 'popular', name: 'Airdrop', coins: 1200, bonus: 150, priceUSD: 5.99 },
  { id: 'value', name: 'War Chest', coins: 2500, bonus: 400, priceUSD: 9.99 },
  { id: 'premium', name: 'Arsenal', coins: 6000, bonus: 1500, priceUSD: 19.99 },
];

export const SHOP_ITEMS: ShopItem[] = [
  // Skins
  { id: 'skin_ghost', name: 'Ghost Ops', description: 'Translucent white tactical gear', category: 'skin', rarity: 'epic', priceUSD: 3.99, priceCUB: 1500, colors: { body: 0xeeeeee, arms: 0xdddddd, legs: 0xcccccc }, emissive: 0xffffff, emissiveIntensity: 0.1 },
  { id: 'skin_lava', name: 'Lava Warrior', description: 'Molten armor with fire trail', category: 'skin', rarity: 'legendary', priceUSD: 5.99, priceCUB: 3000, colors: { body: 0xff4400, arms: 0xff6600, legs: 0x881100 }, emissive: 0xff2200, emissiveIntensity: 0.3 },
  { id: 'skin_gold', name: 'Gold Plated', description: 'Pure gold armor', category: 'skin', rarity: 'legendary', priceUSD: 6.99, priceCUB: 3500, colors: { body: 0xffd700, arms: 0xdaa520, legs: 0xb8860b }, emissive: 0xffd700, emissiveIntensity: 0.2 },
  { id: 'skin_arctic', name: 'Arctic Sniper', description: 'Snow camouflage', category: 'skin', rarity: 'rare', priceUSD: 2.99, priceCUB: 800, colors: { body: 0xf0f0f0, arms: 0xe0e0e0, legs: 0xd0d0d0 } },
  { id: 'skin_neon', name: 'Neon Punk', description: 'Glowing neon edges', category: 'skin', rarity: 'epic', priceUSD: 4.99, priceCUB: 2000, colors: { body: 0x0088ff, arms: 0x00ff88, legs: 0xff0088 }, emissive: 0x00ffff, emissiveIntensity: 0.4 },
  { id: 'skin_shadow', name: 'Shadow Reaper', description: 'Dark assassin with skull effects', category: 'skin', rarity: 'legendary', priceUSD: 7.99, priceCUB: 4000, colors: { body: 0x1a1a1a, arms: 0x111111, legs: 0x0a0a0a }, emissive: 0x330000, emissiveIntensity: 0.15 },
  { id: 'skin_jungle', name: 'Jungle Camo', description: 'Deep forest camouflage', category: 'skin', rarity: 'common', priceUSD: 0.99, priceCUB: 300, colors: { body: 0x2d5a1e, arms: 0x1a4010, legs: 0x3a3a2a } },
  { id: 'skin_desert', name: 'Desert Storm', description: 'Sand tactical gear', category: 'skin', rarity: 'common', priceUSD: 0.99, priceCUB: 300, colors: { body: 0xc4a35a, arms: 0xb8963e, legs: 0x8b7530 } },

  // Kill Effects
  { id: 'fx_explode', name: 'Block Explosion', description: 'Enemies shatter into blocks', category: 'effect', rarity: 'rare', priceUSD: 0.99, priceCUB: 300 },
  { id: 'fx_fire', name: 'Incinerate', description: 'Enemies burn on kill', category: 'effect', rarity: 'rare', priceUSD: 1.49, priceCUB: 500 },
  { id: 'fx_electric', name: 'Lightning Strike', description: 'Lightning on kill', category: 'effect', rarity: 'epic', priceUSD: 1.99, priceCUB: 800 },

  // Name Colors
  { id: 'name_gold', name: 'Gold Name', description: 'Golden nickname in kill feed', category: 'name_color', rarity: 'rare', priceUSD: 1.49, priceCUB: 500 },
  { id: 'name_rainbow', name: 'Rainbow Name', description: 'Animated rainbow nickname', category: 'name_color', rarity: 'epic', priceUSD: 1.99, priceCUB: 800 },

  // Trails
  { id: 'trail_smoke', name: 'Smoke Trail', description: 'Leave smoke when moving', category: 'trail', rarity: 'rare', priceUSD: 0.99, priceCUB: 400 },
  { id: 'trail_spark', name: 'Spark Trail', description: 'Sparks when sprinting', category: 'trail', rarity: 'epic', priceUSD: 1.99, priceCUB: 800 },
];

export const RARITY_COLORS_HEX: Record<string, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};
