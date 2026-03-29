'use client';
import { WELCOME_PACK, DAILY_DEALS } from '../../game/shop/monetization';
import { SkinSystem } from '../../game/shop/SkinSystem';
import { stripeCheckout } from './shopTypes';

export function WelcomeTab({ skinSystem }: { skinSystem: SkinSystem }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Welcome Pack -- CLASSIFIED military style */}
      <div className="relative p-4 overflow-hidden bg-[#1a1f16] border-2 border-[#d4a24e]/40"
        style={{
          clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(212,162,78,0.04) 20px, rgba(212,162,78,0.04) 21px)',
        }}>
        {/* CLASSIFIED stamp */}
        <div className="absolute top-3 right-4 text-[#c93a3a]/30 font-bold text-xs tracking-[0.4em] uppercase rotate-[-8deg]"
          style={{ fontFamily: "'Teko', sans-serif", fontSize: '14px' }}>
          CLASSIFIED
        </div>
        <div className="relative flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-xl tracking-wider text-[#d4a24e] uppercase"
              style={{ fontFamily: "'Teko', sans-serif" }}>{WELCOME_PACK.name}</h3>
            <p className="text-[#a0a890] text-sm mt-0.5">{WELCOME_PACK.description}</p>
          </div>
          <div className="text-right">
            <div className="font-bold text-xl text-[#d4a24e]" style={{ fontFamily: "'Teko', sans-serif" }}>&#8377;{WELCOME_PACK.priceINR}</div>
            <div className="text-[#a0a890] text-xs font-mono">${WELCOME_PACK.priceUSD.toFixed(2)}</div>
          </div>
        </div>
        {skinSystem.purchases.welcomePurchased ? (
          <div className="w-full py-2 bg-[#2a2d2f] text-[#a0a890] font-bold text-sm text-center uppercase tracking-wider"
            style={{ fontFamily: "'Teko', sans-serif" }}>
            ACQUIRED
          </div>
        ) : (
          <button
            onClick={() => stripeCheckout('welcome')}
            className="w-full py-2.5 bg-[#d4a24e] text-black font-bold text-sm active:scale-95 transition-all uppercase tracking-wider hover:bg-[#c4a35a]"
            style={{ fontFamily: "'Teko', sans-serif", fontSize: '16px' }}
          >
            REQUISITION FOR &#8377;{WELCOME_PACK.priceINR}
          </button>
        )}
      </div>

      {/* Daily Deals */}
      <div>
        <h3 className="font-bold text-sm font-mono mb-2 tracking-[0.2em] text-[#4a6741] uppercase"
          style={{ fontFamily: "'Teko', sans-serif", fontSize: '18px' }}>FIELD DEALS</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DAILY_DEALS.map(deal => (
            <div key={deal.id} className="p-3 bg-[#1a1f16] border border-[#4a6741]/20">
              <div className="flex justify-between items-start mb-1.5">
                <p className="text-[#c4a35a] font-bold text-sm uppercase">{deal.name}</p>
                <div className="text-right">
                  <div className="font-bold text-sm text-[#4a6741] font-mono">&#8377;{deal.priceINR}</div>
                  <div className="text-[#a0a890] text-[10px] font-mono">${deal.priceUSD.toFixed(2)}</div>
                </div>
              </div>
              <p className="text-[#a0a890] text-xs mb-2">{deal.description}</p>
              <button
                className="w-full py-1.5 bg-[#4a6741] text-white font-bold text-xs active:scale-95 transition-all uppercase tracking-wider hover:bg-[#5a7751]"
                onClick={() => stripeCheckout(deal.id)}
              >
                ACQUIRE &#8377;{deal.priceINR}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
