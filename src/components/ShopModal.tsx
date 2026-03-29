// Font loaded via next/font in layout, applied via CSS variable
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
      className="absolute inset-0 bg-black/90 flex items-start pt-4 justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#0a0e1a]/95 backdrop-blur-xl border border-cyan-500/20 rounded-2xl shadow-2xl shadow-cyan-500/10 w-full max-w-2xl max-h-[92vh] flex flex-col mx-4"
        style={{ fontFamily: "'Rajdhani', sans-serif" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-5 py-3 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-black text-xl tracking-[0.25em]">BLITZ STORE</h2>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-sm font-mono font-bold" style={{ color: '#ffd700', textShadow: '0 0 8px rgba(255,215,0,0.4)' }}>
                  {skinSystem.purchases.blitzCoins.toLocaleString()} BC
                </p>
                <p className="text-sm font-mono font-bold" style={{ color: '#4ade80', textShadow: '0 0 8px rgba(74,222,128,0.3)' }}>
                  {skinSystem.purchases.blitzPoints.toLocaleString()} WP
                </p>
                {skinSystem.purchases.isVIP && (
                  <span className="text-[9px] font-black font-mono px-2 py-0.5 rounded-sm"
                    style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,170,0,0.2))', color: '#ffd700', border: '1px solid rgba(255,215,0,0.4)' }}>
                    VIP
                  </span>
                )}
              </div>
            </div>

            {/* Character Preview */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-0.5 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-[8px] font-mono text-gray-500 mb-1 tracking-wider">PREVIEW</div>
                <div className="flex flex-col items-center">
                  {/* Helmet */}
                  <div className="rounded-sm" style={{ width: 18, height: 8, background: toHex(previewColors.body), opacity: 0.8 }} />
                  {/* Head */}
                  <div className="rounded-sm" style={{ width: 14, height: 14, background: toHex(previewColors.head) }} />
                  {/* Body + Arms row */}
                  <div className="flex gap-px items-start">
                    <div className="rounded-sm" style={{ width: 6, height: 20, background: toHex(previewColors.arms) }} />
                    <div className="rounded-sm" style={{ width: 16, height: 22, background: toHex(previewColors.body) }} />
                    <div className="rounded-sm" style={{ width: 6, height: 20, background: toHex(previewColors.arms) }} />
                  </div>
                  {/* Legs */}
                  <div className="flex gap-px">
                    <div className="rounded-sm" style={{ width: 7, height: 18, background: toHex(previewColors.legs) }} />
                    <div className="rounded-sm" style={{ width: 7, height: 18, background: toHex(previewColors.legs) }} />
                  </div>
                </div>
                {activeSkin && <div className="text-[7px] font-mono mt-1 truncate max-w-[60px]" style={{ color: '#00f0ff' }}>{activeSkin.name}</div>}
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 1l12 12M13 1L1 13" />
                </svg>
              </button>
            </div>
          </div>
          {/* Cyan accent underline */}
          <div className="absolute bottom-0 left-5 right-5 h-px" style={{ background: 'linear-gradient(90deg, transparent, #00f0ff40, transparent)' }} />
        </div>

        {/* Tabs */}
        <div className="px-3 py-2 border-b border-white/5">
          <div className="flex flex-wrap gap-1">
            {(Object.keys(TAB_LABELS) as ShopTab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative px-3 py-1.5 text-[10px] font-bold tracking-wider rounded-t transition-all ${
                  tab === t
                    ? 'text-cyan-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {TAB_LABELS[t]}
                {tab === t && (
                  <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full" style={{ background: '#00f0ff', boxShadow: '0 0 8px #00f0ff80' }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Crate Result Popup */}
        {crateResult && (
          <div className="mx-4 mt-2 rounded-lg px-4 py-2 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(79,70,229,0.2))', border: '1px solid rgba(139,92,246,0.5)', boxShadow: '0 0 20px rgba(139,92,246,0.2)' }}>
            <p className="text-purple-200 text-sm font-bold font-mono">{crateResult}</p>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4">
          {tab === 'crates' && (
            <div className="flex flex-col gap-4">
              <p className="text-gray-500 text-xs font-mono">Open crates to earn random cosmetic items. Basic crates cost WP (earned in-game). Premium crates cost BC.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SUPPLY_CRATES.map(crate => {
                  const canOpen = (crate.priceWP ? skinSystem.purchases.blitzPoints >= crate.priceWP : false)
                    || (crate.priceCUB ? skinSystem.purchases.blitzCoins >= crate.priceCUB : false);
                  return (
                    <div key={crate.id} className="relative rounded-xl p-4 flex flex-col gap-3 overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, #111827, #0a0e1a)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl"
                        style={{ boxShadow: 'inset 0 0 30px rgba(0,240,255,0.05)' }} />
                      <div>
                        <h3 className="text-white font-black text-base tracking-wide">{crate.name}</h3>
                        <div className="flex gap-2 mt-1">
                          {crate.priceWP && (
                            <span className="text-xs font-mono font-bold" style={{ color: '#4ade80' }}>{crate.priceWP} WP</span>
                          )}
                          {crate.priceCUB && (
                            <span className="text-xs font-mono font-bold" style={{ color: '#ffd700' }}>{crate.priceCUB} BC</span>
                          )}
                          {crate.priceINR && (
                            <span className="text-white/50 text-xs font-mono">or &#8377;{crate.priceINR}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {crate.items.map(ci => {
                          const shopItem = SHOP_ITEMS.find(i => i.id === ci.itemId);
                          if (!shopItem) return null;
                          const rColor = RARITY_COLORS_HEX[shopItem.rarity];
                          return (
                            <span key={ci.itemId} className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                              style={{ color: rColor, background: `${rColor}15`, border: `1px solid ${rColor}30`, textShadow: `0 0 6px ${rColor}40` }}>
                              {shopItem.name}
                            </span>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => handleOpenCrate(crate.id)}
                        disabled={!canOpen}
                        className={`w-full py-2 text-sm font-bold rounded-lg active:scale-95 transition-all ${
                          canOpen
                            ? 'text-white'
                            : 'bg-white/5 text-gray-600 cursor-not-allowed'
                        }`}
                        style={canOpen ? { background: 'linear-gradient(90deg, #8b5cf6, #6366f1)', boxShadow: '0 0 15px rgba(139,92,246,0.3)' } : undefined}
                      >
                        OPEN
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'welcome' && (
            <div className="flex flex-col gap-4">
              {/* Welcome Pack */}
              <div className="relative rounded-xl p-4 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(120,80,0,0.3), rgba(60,40,0,0.2))', border: '1px solid rgba(255,215,0,0.3)', boxShadow: '0 0 30px rgba(255,215,0,0.08), inset 0 0 30px rgba(255,215,0,0.03)' }}>
                {/* Animated golden glow border effect via pulsing shadow */}
                <div className="absolute inset-0 rounded-xl pointer-events-none animate-pulse"
                  style={{ boxShadow: '0 0 40px rgba(255,215,0,0.1), inset 0 0 40px rgba(255,215,0,0.02)' }} />
                <div className="relative flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-black text-lg tracking-wider" style={{ color: '#ffd700', textShadow: '0 0 12px rgba(255,215,0,0.4)' }}>{WELCOME_PACK.name}</h3>
                    <p className="text-gray-400 text-sm mt-0.5">{WELCOME_PACK.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-xl" style={{ color: '#ffd700' }}>&#8377;{WELCOME_PACK.priceINR}</div>
                    <div className="text-gray-500 text-xs">${WELCOME_PACK.priceUSD.toFixed(2)}</div>
                  </div>
                </div>
                {skinSystem.purchases.welcomePurchased ? (
                  <div className="relative w-full py-2 bg-white/5 text-gray-500 font-bold text-sm rounded-lg text-center">
                    PURCHASED
                  </div>
                ) : (
                  <button
                    onClick={() => stripeCheckout('welcome')}
                    className="relative w-full py-2.5 text-black font-bold text-sm rounded-lg active:scale-95 transition-all"
                    style={{ background: 'linear-gradient(90deg, #eab308, #f59e0b)', boxShadow: '0 0 20px rgba(234,179,8,0.3)' }}
                  >
                    GET FOR &#8377;{WELCOME_PACK.priceINR}
                  </button>
                )}
              </div>

              {/* Daily Deals */}
              <div>
                <h3 className="font-bold text-sm font-mono mb-2 tracking-wider" style={{ color: '#4ade80' }}>DAILY DEALS</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DAILY_DEALS.map(deal => (
                    <div key={deal.id} className="rounded-lg p-3"
                      style={{ background: 'linear-gradient(135deg, #111827, #0a0e1a)', border: '1px solid rgba(74,222,128,0.15)' }}>
                      <div className="flex justify-between items-start mb-1.5">
                        <p className="text-white font-bold text-sm">{deal.name}</p>
                        <div className="text-right">
                          <div className="font-bold text-sm" style={{ color: '#4ade80' }}>&#8377;{deal.priceINR}</div>
                          <div className="text-gray-600 text-[10px]">${deal.priceUSD.toFixed(2)}</div>
                        </div>
                      </div>
                      <p className="text-gray-500 text-xs mb-2">{deal.description}</p>
                      <button
                        className="w-full py-1.5 text-white font-bold text-xs rounded-lg active:scale-95 transition-all"
                        onClick={() => stripeCheckout(deal.id)}
                        style={{ background: 'linear-gradient(90deg, #16a34a, #15803d)', boxShadow: '0 0 10px rgba(22,163,74,0.2)' }}
                      >
                        BUY &#8377;{deal.priceINR}
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
                  className="rounded-xl p-4 flex flex-col gap-2"
                  style={{ background: 'linear-gradient(135deg, #111827, #0a0e1a)', border: '1px solid rgba(255,215,0,0.1)' }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-bold text-sm">{pack.name}</p>
                      <p className="font-mono text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 8px rgba(255,215,0,0.3)' }}>
                        {(pack.coins + pack.bonus).toLocaleString()} BC
                        {pack.bonus > 0 && (
                          <span className="text-xs ml-1 font-normal" style={{ color: '#4ade80' }}>
                            +{pack.bonus} bonus
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-mono font-bold text-sm">&#8377;{pack.priceINR}</div>
                      <div className="text-gray-600 text-[10px]">${pack.priceUSD.toFixed(2)}</div>
                    </div>
                  </div>
                  <button
                    className="w-full py-2 text-black font-bold text-sm rounded-lg active:scale-95 transition-all"
                    onClick={() => stripeCheckout(pack.id)}
                    style={{ background: 'linear-gradient(90deg, #eab308, #f59e0b)', boxShadow: '0 0 12px rgba(234,179,8,0.25)' }}
                  >
                    BUY &#8377;{pack.priceINR}
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'utility' && (
            <div className="flex flex-col gap-4">
              {/* Daily Deals in utility tab too */}
              <div>
                <h3 className="font-bold text-xs font-mono mb-2 tracking-wider" style={{ color: '#4ade80' }}>DAILY DEALS</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  {DAILY_DEALS.map(deal => (
                    <div key={deal.id} className="rounded-lg p-3"
                      style={{ background: 'linear-gradient(135deg, #111827, #0a0e1a)', border: '1px solid rgba(74,222,128,0.15)' }}>
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-white font-bold text-xs">{deal.name}</p>
                        <div className="text-right">
                          <div className="font-bold text-xs" style={{ color: '#4ade80' }}>&#8377;{deal.priceINR}</div>
                        </div>
                      </div>
                      <p className="text-gray-500 text-[10px] mb-2">{deal.description}</p>
                      <button
                        className="w-full py-1 text-white font-bold text-xs rounded-lg active:scale-95 transition-all"
                        onClick={() => stripeCheckout(deal.id)}
                        style={{ background: 'linear-gradient(90deg, #16a34a, #15803d)' }}
                      >
                        BUY &#8377;{deal.priceINR}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              {/* Utility items */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {visibleItems.map(item => {
                  const rarityColor = RARITY_COLORS_HEX[item.rarity];
                  const canAfford = skinSystem.purchases.blitzCoins >= item.priceCUB;
                  const isRevive = item.id === 'revive_3';
                  const isXP = item.id === 'xp_boost';
                  const xpActive = isXP && skinSystem.hasXPBoost();

                  return (
                    <div
                      key={item.id}
                      className="rounded-lg p-3 flex flex-col gap-2 transition-all hover:scale-[1.02]"
                      style={{ background: 'linear-gradient(135deg, #111827, #0a0e1a)', border: `1px solid ${rarityColor}25`, boxShadow: `0 0 0 0 ${rarityColor}00` }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${rarityColor}50`; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 15px ${rarityColor}15`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${rarityColor}25`; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                    >
                      <div className="flex justify-between items-center">
                        <span
                          className="text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded"
                          style={{ color: rarityColor, background: `${rarityColor}15`, textShadow: `0 0 6px ${rarityColor}40` }}
                        >
                          {item.rarity}
                        </span>
                        {isRevive && skinSystem.purchases.reviveTokens > 0 && (
                          <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded" style={{ color: '#4ade80', background: 'rgba(74,222,128,0.1)' }}>
                            x{skinSystem.purchases.reviveTokens}
                          </span>
                        )}
                        {xpActive && (
                          <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded" style={{ color: '#00f0ff', background: 'rgba(0,240,255,0.1)' }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-white text-xs font-bold leading-tight">{item.name}</p>
                        <p className="text-gray-500 text-[10px] leading-tight mt-0.5">{item.description}</p>
                      </div>
                      <div className="text-[10px] font-mono text-gray-400">
                        <span className="text-white font-bold">&#8377;{item.priceINR}</span>
                        <span className="ml-1">or <span style={{ color: '#ffd700' }}>{item.priceCUB} BC</span></span>
                      </div>
                      <div className="mt-auto">
                        <button
                          onClick={() => handleUtilityAction(item.id)}
                          disabled={!canAfford}
                          className={`w-full py-1.5 text-xs font-bold rounded-lg active:scale-95 transition-all ${
                            !canAfford ? 'bg-white/5 text-gray-600 cursor-not-allowed' : 'text-white'
                          }`}
                          style={canAfford ? { background: 'linear-gradient(90deg, #0891b2, #2563eb)', boxShadow: '0 0 10px rgba(8,145,178,0.25)' } : undefined}
                        >
                          {item.priceCUB.toLocaleString()} BC
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(tab === 'skins' || tab === 'effects' || tab === 'weapons' || tab === 'vehicles') && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {visibleItems.map(item => {
                const owned = skinSystem.owns(item.id);
                const equipped = isEquipped(item.id, item.category);
                const canAfford = skinSystem.purchases.blitzCoins >= item.priceCUB;
                const rarityColor = RARITY_COLORS_HEX[item.rarity];

                return (
                  <div
                    key={item.id}
                    className="rounded-lg p-3 flex flex-col gap-2 transition-all hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, #111827, #0a0e1a)', border: `1px solid ${rarityColor}25` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${rarityColor}50`; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 15px ${rarityColor}15`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${rarityColor}25`; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                  >
                    {/* Rarity badge */}
                    <div className="flex justify-between items-center">
                      <span
                        className="text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded"
                        style={{ color: rarityColor, background: `${rarityColor}15`, textShadow: `0 0 6px ${rarityColor}40` }}
                      >
                        {item.rarity}
                      </span>
                      {equipped && (
                        <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded" style={{ color: '#4ade80', background: 'rgba(74,222,128,0.1)', textShadow: '0 0 6px rgba(74,222,128,0.4)' }}>
                          ON
                        </span>
                      )}
                    </div>

                    {/* Color preview for skins */}
                    {item.category === 'skin' && item.colors && (
                      <div className="flex gap-1 h-5">
                        {Object.values(item.colors).map((hex, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-sm"
                            style={{ backgroundColor: `#${hex.toString(16).padStart(6, '0')}` }}
                          />
                        ))}
                      </div>
                    )}

                    <div>
                      <p className="text-white text-xs font-bold leading-tight">{item.name}</p>
                      <p className="text-gray-500 text-[10px] leading-tight mt-0.5">{item.description}</p>
                    </div>

                    {/* Price display */}
                    {!owned && (
                      <div className="text-[10px] font-mono text-gray-400">
                        <span className="text-white font-bold">&#8377;{item.priceINR}</span>
                        <span className="ml-1">or <span style={{ color: '#ffd700' }}>{item.priceCUB} BC</span></span>
                      </div>
                    )}

                    <div className="mt-auto">
                      {owned ? (
                        <button
                          onClick={() => handleEquip(item.id, item.category)}
                          className={`w-full py-1.5 text-xs font-bold rounded-lg active:scale-95 transition-all ${
                            equipped
                              ? 'text-white'
                              : 'bg-white/10 hover:bg-white/15 text-white'
                          }`}
                          style={equipped ? { background: 'linear-gradient(90deg, #16a34a, #15803d)', boxShadow: '0 0 10px rgba(22,163,74,0.25)' } : undefined}
                        >
                          {equipped ? 'UNEQUIP' : 'EQUIP'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuy(item.id)}
                          disabled={!canAfford}
                          className={`w-full py-1.5 text-xs font-bold rounded-lg active:scale-95 transition-all ${
                            !canAfford ? 'bg-white/5 text-gray-600 cursor-not-allowed' : 'text-white'
                          }`}
                          style={canAfford ? { background: 'linear-gradient(90deg, #0891b2, #2563eb)', boxShadow: '0 0 10px rgba(8,145,178,0.25)' } : undefined}
                        >
                          {item.priceCUB.toLocaleString()} BC
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-white/5 text-center">
          <p className="text-gray-600 text-[10px] font-mono">
            Earn WP by playing (10 per kill, 50 per wave). Earn BC via the BLITZ COINS tab.
          </p>
        </div>
      </div>
    </div>
  );
}
