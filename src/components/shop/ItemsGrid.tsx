'use client';
import { SHOP_ITEMS, RARITY_COLORS_HEX } from '../../game/shop/monetization';
import { SkinSystem } from '../../game/shop/SkinSystem';
import { RARITY_BAR } from './shopTypes';

interface ItemsGridProps {
  skinSystem: SkinSystem;
  categories: string[];
  onBuy: (itemId: string) => void;
  onEquip: (itemId: string, category: string) => void;
  isEquipped: (itemId: string, category: string) => boolean;
}

export function ItemsGrid({ skinSystem, categories, onBuy, onEquip, isEquipped }: ItemsGridProps) {
  const visibleItems = SHOP_ITEMS.filter(item => categories.includes(item.category));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
      {visibleItems.map(item => {
        const owned = skinSystem.owns(item.id);
        const equipped = isEquipped(item.id, item.category);
        const canAfford = skinSystem.purchases.blitzCoins >= item.priceCUB;
        const rarityColor = RARITY_COLORS_HEX[item.rarity];
        const barColor = RARITY_BAR[item.rarity] ?? '#6b7b6a';

        return (
          <div
            key={item.id}
            className="relative flex flex-col gap-2 transition-all hover:border-[#c4a35a]/30 bg-[#1a1f16] border border-[#2a2d2f] overflow-hidden"
          >
            {/* Left rarity bar */}
            <div className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: barColor }} />
            <div className="pl-4 pr-3 pt-3 pb-3 flex flex-col gap-2 flex-1">
              {/* Rarity + equipped indicator */}
              <div className="flex justify-between items-center">
                <span
                  className="text-[9px] font-bold font-mono uppercase"
                  style={{ color: rarityColor }}
                >
                  {item.rarity}
                </span>
                {equipped && (
                  <span className="text-[9px] font-bold font-mono text-[#4a6741] uppercase">
                    DEPLOYED
                  </span>
                )}
              </div>

              {/* Color preview for skins */}
              {item.category === 'skin' && item.colors && (
                <div className="flex gap-1 h-5">
                  {Object.values(item.colors).map((hex, i) => (
                    <div
                      key={i}
                      className="flex-1"
                      style={{ backgroundColor: `#${hex.toString(16).padStart(6, '0')}` }}
                    />
                  ))}
                </div>
              )}

              <div>
                <p className="text-[#eddcaa] text-xs font-bold leading-tight uppercase">{item.name}</p>
                <p className="text-[#a0a890] text-[10px] leading-tight mt-0.5">{item.description}</p>
              </div>

              {/* Price display */}
              {!owned && (
                <div className="text-[10px] font-mono text-[#a0a890]">
                  <span className="text-[#eddcaa] font-bold">&#8377;{item.priceINR}</span>
                  <span className="ml-1">or <span className="text-[#d4a24e]">{item.priceCUB} BC</span></span>
                </div>
              )}

              <div className="mt-auto">
                {owned ? (
                  <button
                    onClick={() => onEquip(item.id, item.category)}
                    className={`w-full py-1.5 text-xs font-bold active:scale-95 transition-all uppercase tracking-wider ${
                      equipped
                        ? 'bg-[#4a6741] text-white hover:bg-[#5a7751]'
                        : 'bg-[#2a2d2f] text-[#c4a35a] hover:bg-[#3a3d3f]'
                    }`}
                  >
                    {equipped ? 'UNEQUIP' : 'EQUIP'}
                  </button>
                ) : (
                  <button
                    onClick={() => onBuy(item.id)}
                    disabled={!canAfford}
                    className={`w-full py-1.5 text-xs font-bold active:scale-95 transition-all uppercase tracking-wider ${
                      !canAfford ? 'bg-[#2a2d2f] text-[#a0a890] cursor-not-allowed' : 'bg-[#d4a24e] text-black hover:bg-[#c4a35a]'
                    }`}
                  >
                    {item.priceCUB.toLocaleString()} BC
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
