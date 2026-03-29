'use client';
import { SHOP_ITEMS, RARITY_COLORS_HEX, SUPPLY_CRATES } from '../../game/shop/monetization';
import { SkinSystem } from '../../game/shop/SkinSystem';

interface CratesTabProps {
  skinSystem: SkinSystem;
  onOpenCrate: (crateId: string) => void;
}

export function CratesTab({ skinSystem, onOpenCrate }: CratesTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[#a0a890] text-xs font-mono uppercase tracking-wider">Open supply crates for random field equipment. Basic crates cost WP. Premium crates cost BC.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SUPPLY_CRATES.map(crate => {
          const canOpen = (crate.priceWP ? skinSystem.purchases.blitzPoints >= crate.priceWP : false)
            || (crate.priceCUB ? skinSystem.purchases.blitzCoins >= crate.priceCUB : false);
          return (
            <div key={crate.id} className="relative p-4 flex flex-col gap-3 overflow-hidden bg-[#1a1f16] border border-[#c4a35a]/15"
              style={{
                clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(196,163,90,0.03) 10px, rgba(196,163,90,0.03) 11px)',
              }}>
              <div>
                <h3 className="text-[#c4a35a] font-bold text-lg tracking-wider uppercase" style={{ fontFamily: "'Teko', sans-serif" }}>{crate.name}</h3>
                <div className="flex gap-2 mt-1">
                  {crate.priceWP && (
                    <span className="text-xs font-mono font-bold text-[#4a6741]">{crate.priceWP} WP</span>
                  )}
                  {crate.priceCUB && (
                    <span className="text-xs font-mono font-bold text-[#d4a24e]">{crate.priceCUB} BC</span>
                  )}
                  {crate.priceINR && (
                    <span className="text-[#a0a890] text-xs font-mono">or &#8377;{crate.priceINR}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {crate.items.map(ci => {
                  const shopItem = SHOP_ITEMS.find(i => i.id === ci.itemId);
                  if (!shopItem) return null;
                  const rColor = RARITY_COLORS_HEX[shopItem.rarity];
                  return (
                    <span key={ci.itemId} className="text-[9px] font-mono px-1.5 py-0.5"
                      style={{ color: rColor, background: `${rColor}10`, border: `1px solid ${rColor}20` }}>
                      {shopItem.name}
                    </span>
                  );
                })}
              </div>
              <button
                onClick={() => onOpenCrate(crate.id)}
                disabled={!canOpen}
                className={`w-full py-2 text-sm font-bold tracking-wider uppercase active:scale-95 transition-all ${
                  canOpen
                    ? 'bg-[#d4a24e] text-black hover:bg-[#c4a35a]'
                    : 'bg-[#2a2d2f] text-[#a0a890] cursor-not-allowed'
                }`}
                style={{ fontFamily: "'Teko', sans-serif", fontSize: '16px' }}
              >
                OPEN CRATE
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
