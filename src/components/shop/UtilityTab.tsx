'use client';
import { SHOP_ITEMS, RARITY_COLORS_HEX, DAILY_DEALS } from '../../game/shop/monetization';
import { SkinSystem } from '../../game/shop/SkinSystem';
import { RARITY_BAR, stripeCheckout } from './shopTypes';

interface UtilityTabProps {
  skinSystem: SkinSystem;
  refresh: () => void;
}

export function UtilityTab({ skinSystem, refresh }: UtilityTabProps) {
  const visibleItems = SHOP_ITEMS.filter(item => ['utility', 'title'].includes(item.category));

  const handleUtilityAction = (itemId: string) => {
    if (itemId === 'revive_3') {
      skinSystem.buyReviveTokens();
    } else if (itemId === 'xp_boost') {
      skinSystem.activateXPBoost();
    } else {
      skinSystem.buyWithCoins(itemId);
    }
    refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Daily Deals in utility tab too */}
      <div>
        <h3 className="font-bold text-xs tracking-[0.2em] mb-2 text-[#4a6741] uppercase"
          style={{ fontFamily: "'Teko', sans-serif", fontSize: '16px' }}>FIELD DEALS</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {DAILY_DEALS.map(deal => (
            <div key={deal.id} className="p-3 bg-[#1a1f16] border border-[#4a6741]/15">
              <div className="flex justify-between items-start mb-1">
                <p className="text-[#eddcaa] font-bold text-xs uppercase">{deal.name}</p>
                <div className="text-right">
                  <div className="font-bold text-xs text-[#4a6741] font-mono">&#8377;{deal.priceINR}</div>
                </div>
              </div>
              <p className="text-[#a0a890] text-[10px] mb-2">{deal.description}</p>
              <button
                className="w-full py-1 bg-[#4a6741] text-white font-bold text-xs active:scale-95 transition-all uppercase tracking-wider hover:bg-[#5a7751]"
                onClick={() => stripeCheckout(deal.id)}
              >
                ACQUIRE &#8377;{deal.priceINR}
              </button>
            </div>
          ))}
        </div>
      </div>
      {/* Utility items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
        {visibleItems.map(item => {
          const rarityColor = RARITY_COLORS_HEX[item.rarity];
          const barColor = RARITY_BAR[item.rarity] ?? '#6b7b6a';
          const canAfford = skinSystem.purchases.blitzCoins >= item.priceCUB;
          const isRevive = item.id === 'revive_3';
          const isXP = item.id === 'xp_boost';
          const xpActive = isXP && skinSystem.hasXPBoost();

          return (
            <div
              key={item.id}
              className="relative flex flex-col gap-2 transition-all hover:border-[#c4a35a]/30 bg-[#1a1f16] border border-[#2a2d2f] overflow-hidden"
            >
              {/* Left rarity bar */}
              <div className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: barColor }} />
              <div className="pl-4 pr-3 pt-3 pb-3 flex flex-col gap-2 flex-1">
                <div className="flex justify-between items-center">
                  <span
                    className="text-[9px] font-bold font-mono uppercase"
                    style={{ color: rarityColor }}
                  >
                    {item.rarity}
                  </span>
                  {isRevive && skinSystem.purchases.reviveTokens > 0 && (
                    <span className="text-[9px] font-bold font-mono text-[#4a6741]">
                      x{skinSystem.purchases.reviveTokens}
                    </span>
                  )}
                  {xpActive && (
                    <span className="text-[9px] font-bold font-mono text-[#d4a24e]">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-[#eddcaa] text-xs font-bold leading-tight uppercase">{item.name}</p>
                  <p className="text-[#a0a890] text-[10px] leading-tight mt-0.5">{item.description}</p>
                </div>
                <div className="text-[10px] font-mono text-[#a0a890]">
                  <span className="text-[#eddcaa] font-bold">&#8377;{item.priceINR}</span>
                  <span className="ml-1">or <span className="text-[#d4a24e]">{item.priceCUB} BC</span></span>
                </div>
                <div className="mt-auto">
                  <button
                    onClick={() => handleUtilityAction(item.id)}
                    disabled={!canAfford}
                    className={`w-full py-1.5 text-xs font-bold active:scale-95 transition-all uppercase tracking-wider ${
                      !canAfford ? 'bg-[#2a2d2f] text-[#a0a890] cursor-not-allowed' : 'bg-[#d4a24e] text-black hover:bg-[#c4a35a]'
                    }`}
                  >
                    {item.priceCUB.toLocaleString()} BC
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
