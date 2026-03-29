import * as THREE from 'three';
import { SHOP_ITEMS, ShopItem } from './monetization';

const STORAGE_KEY = 'cubwild_purchases';

export interface PlayerPurchases {
  cubCoins: number;
  ownedItems: string[];
  activeSkin: string | null;
  activeEffect: string | null;
  activeTrail: string | null;
  activeNameColor: string | null;
  isVIP: boolean;
  reviveTokens: number;
  xpBoostEndTime: number; // timestamp
  welcomePurchased: boolean;
}

function defaultStats(): PlayerPurchases {
  return {
    cubCoins: 0,
    ownedItems: [],
    activeSkin: null,
    activeEffect: null,
    activeTrail: null,
    activeNameColor: null,
    isVIP: false,
    reviveTokens: 0,
    xpBoostEndTime: 0,
    welcomePurchased: false,
  };
}

export class SkinSystem {
  purchases: PlayerPurchases;

  constructor() {
    this.purchases = this.load();
  }

  private load(): PlayerPurchases {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        // Merge with defaults to ensure new fields are present
        return { ...defaultStats(), ...parsed };
      }
    } catch {}
    return defaultStats();
  }

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.purchases));
    } catch {}
  }

  owns(itemId: string): boolean {
    return this.purchases.ownedItems.includes(itemId);
  }

  canAfford(item: ShopItem): boolean {
    return this.purchases.cubCoins >= item.priceCUB;
  }

  buyWithCoins(itemId: string): boolean {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item || this.owns(itemId) || !this.canAfford(item)) return false;
    this.purchases.cubCoins -= item.priceCUB;
    this.purchases.ownedItems.push(itemId);
    this.save();
    return true;
  }

  equipSkin(itemId: string | null): void {
    this.purchases.activeSkin = itemId;
    this.save();
  }

  equipEffect(itemId: string | null): void {
    this.purchases.activeEffect = itemId;
    this.save();
  }

  equipTrail(itemId: string | null): void {
    this.purchases.activeTrail = itemId;
    this.save();
  }

  equipNameColor(itemId: string | null): void {
    this.purchases.activeNameColor = itemId;
    this.save();
  }

  getActiveSkin(): ShopItem | null {
    if (!this.purchases.activeSkin) return null;
    return SHOP_ITEMS.find(i => i.id === this.purchases.activeSkin) || null;
  }

  getActiveNameColor(): string | null {
    if (!this.purchases.activeNameColor) return null;
    const item = SHOP_ITEMS.find(i => i.id === this.purchases.activeNameColor);
    if (!item) return null;
    if (item.id === 'name_gold') return '#ffd700';
    if (item.id === 'name_rainbow') return 'rainbow';
    return null;
  }

  buyWelcomePack(): boolean {
    if (this.purchases.welcomePurchased) return false;
    this.purchases.welcomePurchased = true;
    this.purchases.isVIP = true;
    this.purchases.cubCoins += 500;
    // Random skin from common/rare pool
    const skins = SHOP_ITEMS.filter(i => i.category === 'skin' && (i.rarity === 'common' || i.rarity === 'rare'));
    const randomSkin = skins[Math.floor(Math.random() * skins.length)];
    if (randomSkin && !this.purchases.ownedItems.includes(randomSkin.id)) {
      this.purchases.ownedItems.push(randomSkin.id);
    }
    this.save();
    return true;
  }

  buyReviveTokens(): boolean {
    const item = SHOP_ITEMS.find(i => i.id === 'revive_3');
    if (!item || !this.canAfford(item)) return false;
    this.purchases.cubCoins -= item.priceCUB;
    this.purchases.reviveTokens += 3;
    this.save();
    return true;
  }

  useReviveToken(): boolean {
    if (this.purchases.reviveTokens <= 0) return false;
    this.purchases.reviveTokens--;
    this.save();
    return true;
  }

  activateXPBoost(): boolean {
    const item = SHOP_ITEMS.find(i => i.id === 'xp_boost');
    if (!item || !this.canAfford(item)) return false;
    this.purchases.cubCoins -= item.priceCUB;
    this.purchases.xpBoostEndTime = Date.now() + 3 * 60 * 60 * 1000; // 3 hours
    this.save();
    return true;
  }

  hasXPBoost(): boolean {
    return Date.now() < this.purchases.xpBoostEndTime;
  }

  addCoins(amount: number): void {
    this.purchases.cubCoins += amount;
    this.save();
  }

  // Apply skin colors to player mesh using named parts
  applySkinToMesh(mesh: THREE.Group): void {
    const skin = this.getActiveSkin();
    if (!skin || !skin.colors) return;

    const partMap: Record<string, string> = {
      'torso': 'body',
      'leftArm': 'arms',
      'rightArm': 'arms',
      'leftLeg': 'legs',
      'rightLeg': 'legs',
    };

    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial && child.name) {
        const colorKey = partMap[child.name];
        if (colorKey && skin.colors![colorKey]) {
          child.material = child.material.clone(); // Don't share material
          child.material.color.setHex(skin.colors![colorKey]);
          if (skin.emissive) {
            child.material.emissive = new THREE.Color(skin.emissive);
            child.material.emissiveIntensity = skin.emissiveIntensity || 0;
          }
        }
      }
    });
  }
}
