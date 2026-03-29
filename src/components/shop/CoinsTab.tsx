'use client';
import { BLITZ_COIN_PACKS } from '../../game/shop/monetization';
import { stripeCheckout } from './shopTypes';

export function CoinsTab() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {BLITZ_COIN_PACKS.map(pack => (
        <div
          key={pack.id}
          className="p-4 flex flex-col gap-2 bg-[#1a1f16] border border-[#d4a24e]/15"
          style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[#eddcaa] font-bold text-sm uppercase">{pack.name}</p>
              <p className="font-mono text-lg font-bold text-[#d4a24e]">
                {(pack.coins + pack.bonus).toLocaleString()} BC
                {pack.bonus > 0 && (
                  <span className="text-xs ml-1 font-normal text-[#4a6741]">
                    +{pack.bonus} bonus
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <div className="text-[#c4a35a] font-mono font-bold text-sm">&#8377;{pack.priceINR}</div>
              <div className="text-[#a0a890] text-[10px] font-mono">${pack.priceUSD.toFixed(2)}</div>
            </div>
          </div>
          <button
            className="w-full py-2 bg-[#d4a24e] text-black font-bold text-sm active:scale-95 transition-all uppercase tracking-wider hover:bg-[#c4a35a]"
            onClick={() => stripeCheckout(pack.id)}
            style={{ fontFamily: "'Teko', sans-serif", fontSize: '16px' }}
          >
            ACQUIRE &#8377;{pack.priceINR}
          </button>
        </div>
      ))}
    </div>
  );
}
