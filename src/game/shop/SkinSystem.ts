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
}

export class SkinSystem {
  purchases: PlayerPurchases;

  constructor() {
    this.purchases = this.load();
  }

  private load(): PlayerPurchases {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch {}
    return { cubCoins: 0, ownedItems: [], activeSkin: null, activeEffect: null, activeTrail: null, activeNameColor: null };
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

  // Apply skin colors to player mesh
  applySkinToMesh(mesh: THREE.Group): void {
    const skin = this.getActiveSkin();
    if (!skin || !skin.colors) return;

    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
        // Torso (index 2 in player mesh)
        if (child.position.y > 0.8 && child.position.y < 1.2 && child.position.x === 0) {
          if (skin.colors!.body) child.material.color.setHex(skin.colors!.body);
          if (skin.emissive) {
            child.material.emissive = new THREE.Color(skin.emissive);
            child.material.emissiveIntensity = skin.emissiveIntensity || 0;
          }
        }
      }
    });
  }

  addCoins(amount: number): void {
    this.purchases.cubCoins += amount;
    this.save();
  }
}
