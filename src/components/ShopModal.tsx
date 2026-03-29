// Font loaded via Google Fonts link in layout (Teko + Rajdhani)
'use client';
import { useState } from 'react';
import { SHOP_ITEMS, BLITZ_COIN_PACKS, RARITY_COLORS_HEX, WELCOME_PACK, DAILY_DEALS, SUPPLY_CRATES } from '../game/shop/monetization';
import { SkinSystem } from '../game/shop/SkinSystem';

const BLITZPIT_API = 'https://blitzpit-api.meshedwell.workers.dev';

async function stripeCheckout(packId: string): Promise<void> {
  try {
    const res = await fetch(`${BLITZPIT_API}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packId,
        successUrl: window.location.origin + window.location.pathname,
        cancelUrl: window.location.origin + window.location.pathname,
      }),
    });
    const data = await res.json() as { url?: string; error?: string };
    if (data.url) {
      window.location.href = data.url;
    } else {
      console.error('Stripe checkout error:', data.error);
    }
  } catch (err) {
    console.error('Checkout failed:', err);
  }
}

type ShopTab = 'welcome' | 'crates' | 'skins' | 'weapons' | 'vehicles' | 'effects' | 'utility' | 'coins';

// Military rarity bar colors
const RARITY_BAR: Record<string, string> = {
  common: '#6b7b6a',
  uncommon: '#4a6741',
  rare: '#c4a35a',
  epic: '#d4a24e',
  legendary: '#c93a3a',
};

export function ShopModal({ skinSystem, onClose, onSkinChange }: { skinSystem: SkinSystem; onClose: () => void; onSkinChange?: () => void }) {
  const [tab, setTab] = useState<ShopTab>('welcome');
  const [tick, setTick] = useState(0);
  const [crateResult, setCrateResult] = useState<string | null>(null);

  const refresh = () => setTick(t => t + 1);
  void tick;

  const categoryMap: Record<ShopTab, string[]> = {
    welcome: [],
    crates: [],
    skins: ['skin'],
    weapons: ['weapon_skin'],
    vehicles: ['vehicle_skin'],
    effects: ['effect', 'trail', 'name_color'],
    utility: ['utility', 'title'],
    coins: [],
  };

  const visibleItems = (tab === 'coins' || tab === 'welcome' || tab === 'crates')
    ? []
    : SHOP_ITEMS.filter(item => categoryMap[tab].includes(item.category));

  const handleOpenCrate = (crateId: string) => {
    const result = skinSystem.openCrate(crateId);
    if (result) {
      const item = SHOP_ITEMS.find(i => i.id === result);
      setCrateResult(item ? `${item.name} (${item.rarity.toUpperCase()})` : result);
      setTimeout(() => setCrateResult(null), 3000);
    } else {
      setCrateResult('Not enough currency');
      setTimeout(() => setCrateResult(null), 2000);
    }
    refresh();
  };

  const handleBuy = (itemId: string) => {
    skinSystem.buyWithCoins(itemId);
    refresh();
  };

  const handleEquip = (itemId: string, category: string) => {
    if (category === 'skin') skinSystem.equipSkin(skinSystem.purchases.activeSkin === itemId ? null : itemId);
    else if (category === 'effect') skinSystem.equipEffect(skinSystem.purchases.activeEffect === itemId ? null : itemId);
    else if (category === 'trail') skinSystem.equipTrail(skinSystem.purchases.activeTrail === itemId ? null : itemId);
    else if (category === 'name_color') skinSystem.equipNameColor(skinSystem.purchases.activeNameColor === itemId ? null : itemId);
    else if (category === 'weapon_skin') skinSystem.equipWeaponSkin(skinSystem.purchases.activeWeaponSkin === itemId ? null : itemId);
    else if (category === 'vehicle_skin') skinSystem.equipVehicleSkin(skinSystem.purchases.activeVehicleSkin === itemId ? null : itemId);
    else if (category === 'title') skinSystem.equipTitle(skinSystem.purchases.activeTitle === itemId ? null : itemId);
    refresh();
    if (onSkinChange) onSkinChange();
  };

  const isEquipped = (itemId: string, category: string): boolean => {
    if (category === 'skin') return skinSystem.purchases.activeSkin === itemId;
    if (category === 'effect') return skinSystem.purchases.activeEffect === itemId;
    if (category === 'trail') return skinSystem.purchases.activeTrail === itemId;
    if (category === 'name_color') return skinSystem.purchases.activeNameColor === itemId;
    if (category === 'weapon_skin') return skinSystem.purchases.activeWeaponSkin === itemId;
    if (category === 'vehicle_skin') return skinSystem.purchases.activeVehicleSkin === itemId;
    if (category === 'title') return skinSystem.purchases.activeTitle === itemId;
    return false;
  };

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

  const TAB_LABELS: Record<ShopTab, string> = {
    welcome: 'WELCOME',
    crates: 'CRATES',
    skins: 'SKINS',
    weapons: 'WEAPONS',
    vehicles: 'VEHICLES',
    effects: 'EFFECTS',
    utility: 'UTILITY',
    coins: 'BLITZ COINS',
  };

  // Get skin colors for character preview
  const activeSkin = skinSystem.getActiveSkin();
  const previewColors = {
    head: activeSkin?.colors?.body ?? 0xffcc99,
    body: activeSkin?.colors?.body ?? 0x2d5a1e,
    arms: activeSkin?.colors?.arms ?? 0x2d5a1e,
    legs: activeSkin?.colors?.legs ?? 0x3a3a2a,
  };
  const toHex = (n: number) => '#' + n.toString(16).padStart(6, '0');

  return (
    <div
      className="absolute inset-0 bg-[#0d0f0b]/97 backdrop-blur-sm flex items-start pt-4 justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#12150f]/98 border border-[#c4a35a]/25 w-full max-w-2xl max-h-[92vh] flex flex-col mx-1 md:mx-4"
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-3 py-2 md:px-5 md:py-3 border-b border-[#c4a35a]/15">
          {/* Diagonal stripe accent */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#d4a24e]" />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[#c4a35a] font-bold text-lg md:text-2xl tracking-[0.2em] md:tracking-[0.3em] uppercase"
                style={{ fontFamily: "'Teko', sans-serif" }}>
                BLITZ STORE
              </h2>
              <div className="flex items-center gap-2 md:gap-3 mt-0.5">
                <p className="text-xs md:text-sm font-mono font-bold text-[#d4a24e]">
                  {skinSystem.purchases.blitzCoins.toLocaleString()} BC
                </p>
                <p className="text-xs md:text-sm font-mono font-bold text-[#4a6741]">
                  {skinSystem.purchases.blitzPoints.toLocaleString()} WP
                </p>
                {skinSystem.purchases.isVIP && (
                  <span className="text-[9px] font-black font-mono px-2 py-0.5 bg-[#d4a24e]/15 text-[#d4a24e] border border-[#d4a24e]/30">
                    VIP
                  </span>
                )}
              </div>
            </div>

            {/* Character Preview */}
            <div className="flex items-center gap-2 md:gap-3">
              <div className="hidden sm:flex flex-col items-center gap-0.5 p-2 bg-[#1a1f16] border border-[#c4a35a]/10">
                <div className="text-[8px] font-mono text-[#6b7b6a] mb-1 tracking-wider uppercase">PREVIEW</div>
                <div className="flex flex-col items-center">
                  <div style={{ width: 18, height: 8, background: toHex(previewColors.body), opacity: 0.8 }} />
                  <div style={{ width: 14, height: 14, background: toHex(previewColors.head) }} />
                  <div className="flex gap-px items-start">
                    <div style={{ width: 6, height: 20, background: toHex(previewColors.arms) }} />
                    <div style={{ width: 16, height: 22, background: toHex(previewColors.body) }} />
                    <div style={{ width: 6, height: 20, background: toHex(previewColors.arms) }} />
                  </div>
                  <div className="flex gap-px">
                    <div style={{ width: 7, height: 18, background: toHex(previewColors.legs) }} />
                    <div style={{ width: 7, height: 18, background: toHex(previewColors.legs) }} />
                  </div>
                </div>
                {activeSkin && <div className="text-[7px] font-mono mt-1 truncate max-w-[60px] text-[#c4a35a]">{activeSkin.name}</div>}
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-[#6b7b6a] hover:text-[#c4a35a] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 1l12 12M13 1L1 13" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-2 md:px-3 py-1.5 md:py-2 border-b border-[#c4a35a]/10 bg-[#0d0f0b]/50 overflow-x-auto">
          <div className="flex gap-0.5 min-w-max md:min-w-0 md:flex-wrap">
            {(Object.keys(TAB_LABELS) as ShopTab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative px-3 py-1.5 text-[10px] font-bold tracking-[0.15em] uppercase transition-all ${
                  tab === t
                    ? 'text-[#c4a35a] bg-[#c4a35a]/10'
                    : 'text-[#6b7b6a] hover:text-[#c4a35a]/70'
                }`}
              >
                {TAB_LABELS[t]}
                {tab === t && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#d4a24e]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Crate Result Popup */}
        {crateResult && (
          <div className="mx-4 mt-2 px-4 py-2 text-center bg-[#1a1f16] border border-[#d4a24e]/40">
            <p className="text-[#d4a24e] text-sm font-bold font-mono uppercase">{crateResult}</p>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-2 md:p-4">
          {tab === 'crates' && (
            <div className="flex flex-col gap-4">
              <p className="text-[#6b7b6a] text-xs font-mono uppercase tracking-wider">Open supply crates for random field equipment. Basic crates cost WP. Premium crates cost BC.</p>
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
                            <span className="text-[#6b7b6a] text-xs font-mono">or &#8377;{crate.priceINR}</span>
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
                        onClick={() => handleOpenCrate(crate.id)}
                        disabled={!canOpen}
                        className={`w-full py-2 text-sm font-bold tracking-wider uppercase active:scale-95 transition-all ${
                          canOpen
                            ? 'bg-[#d4a24e] text-black hover:bg-[#c4a35a]'
                            : 'bg-[#2a2d2f] text-[#6b7b6a] cursor-not-allowed'
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
          )}

          {tab === 'welcome' && (
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
                    <p className="text-[#6b7b6a] text-sm mt-0.5">{WELCOME_PACK.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-xl text-[#d4a24e]" style={{ fontFamily: "'Teko', sans-serif" }}>&#8377;{WELCOME_PACK.priceINR}</div>
                    <div className="text-[#6b7b6a] text-xs font-mono">${WELCOME_PACK.priceUSD.toFixed(2)}</div>
                  </div>
                </div>
                {skinSystem.purchases.welcomePurchased ? (
                  <div className="w-full py-2 bg-[#2a2d2f] text-[#6b7b6a] font-bold text-sm text-center uppercase tracking-wider"
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
                          <div className="text-[#6b7b6a] text-[10px] font-mono">${deal.priceUSD.toFixed(2)}</div>
                        </div>
                      </div>
                      <p className="text-[#6b7b6a] text-xs mb-2">{deal.description}</p>
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
          )}

          {tab === 'coins' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BLITZ_COIN_PACKS.map(pack => (
                <div
                  key={pack.id}
                  className="p-4 flex flex-col gap-2 bg-[#1a1f16] border border-[#d4a24e]/15"
                  style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[#c4a35a] font-bold text-sm uppercase">{pack.name}</p>
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
                      <div className="text-[#6b7b6a] text-[10px] font-mono">${pack.priceUSD.toFixed(2)}</div>
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
          )}

          {tab === 'utility' && (
            <div className="flex flex-col gap-4">
              {/* Daily Deals in utility tab too */}
              <div>
                <h3 className="font-bold text-xs tracking-[0.2em] mb-2 text-[#4a6741] uppercase"
                  style={{ fontFamily: "'Teko', sans-serif", fontSize: '16px' }}>FIELD DEALS</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  {DAILY_DEALS.map(deal => (
                    <div key={deal.id} className="p-3 bg-[#1a1f16] border border-[#4a6741]/15">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-[#c4a35a] font-bold text-xs uppercase">{deal.name}</p>
                        <div className="text-right">
                          <div className="font-bold text-xs text-[#4a6741] font-mono">&#8377;{deal.priceINR}</div>
                        </div>
                      </div>
                      <p className="text-[#6b7b6a] text-[10px] mb-2">{deal.description}</p>
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
                          <p className="text-[#c4a35a] text-xs font-bold leading-tight uppercase">{item.name}</p>
                          <p className="text-[#6b7b6a] text-[10px] leading-tight mt-0.5">{item.description}</p>
                        </div>
                        <div className="text-[10px] font-mono text-[#6b7b6a]">
                          <span className="text-[#c4a35a] font-bold">&#8377;{item.priceINR}</span>
                          <span className="ml-1">or <span className="text-[#d4a24e]">{item.priceCUB} BC</span></span>
                        </div>
                        <div className="mt-auto">
                          <button
                            onClick={() => handleUtilityAction(item.id)}
                            disabled={!canAfford}
                            className={`w-full py-1.5 text-xs font-bold active:scale-95 transition-all uppercase tracking-wider ${
                              !canAfford ? 'bg-[#2a2d2f] text-[#6b7b6a] cursor-not-allowed' : 'bg-[#d4a24e] text-black hover:bg-[#c4a35a]'
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
          )}

          {(tab === 'skins' || tab === 'effects' || tab === 'weapons' || tab === 'vehicles') && (
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
                        <p className="text-[#c4a35a] text-xs font-bold leading-tight uppercase">{item.name}</p>
                        <p className="text-[#6b7b6a] text-[10px] leading-tight mt-0.5">{item.description}</p>
                      </div>

                      {/* Price display */}
                      {!owned && (
                        <div className="text-[10px] font-mono text-[#6b7b6a]">
                          <span className="text-[#c4a35a] font-bold">&#8377;{item.priceINR}</span>
                          <span className="ml-1">or <span className="text-[#d4a24e]">{item.priceCUB} BC</span></span>
                        </div>
                      )}

                      <div className="mt-auto">
                        {owned ? (
                          <button
                            onClick={() => handleEquip(item.id, item.category)}
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
                            onClick={() => handleBuy(item.id)}
                            disabled={!canAfford}
                            className={`w-full py-1.5 text-xs font-bold active:scale-95 transition-all uppercase tracking-wider ${
                              !canAfford ? 'bg-[#2a2d2f] text-[#6b7b6a] cursor-not-allowed' : 'bg-[#d4a24e] text-black hover:bg-[#c4a35a]'
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
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 md:px-5 md:py-2 border-t border-[#c4a35a]/10 text-center">
          <p className="text-[#6b7b6a] text-[8px] md:text-[10px] font-mono uppercase tracking-wider">
            Earn WP by playing (10/kill, 50/wave). BC via BLITZ COINS tab.
          </p>
        </div>
      </div>
    </div>
  );
}
