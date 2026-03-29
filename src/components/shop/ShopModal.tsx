// Font loaded via Google Fonts link in layout (Teko + Rajdhani)
'use client';
import { useState } from 'react';
import { SHOP_ITEMS } from '../../game/shop/monetization';
import { SkinSystem } from '../../game/shop/SkinSystem';
import type { ShopTab } from './shopTypes';
import { TAB_LABELS } from './shopTypes';
import { WelcomeTab } from './WelcomeTab';
import { CratesTab } from './CratesTab';
import { CoinsTab } from './CoinsTab';
import { ItemsGrid } from './ItemsGrid';
import { UtilityTab } from './UtilityTab';

export function ShopModal({ skinSystem, onClose, onSkinChange }: { skinSystem: SkinSystem; onClose: () => void; onSkinChange?: () => void }) {
  const [tab, setTab] = useState<ShopTab>('welcome');
  const [tick, setTick] = useState(0);
  const [crateResult, setCrateResult] = useState<string | null>(null);

  const refresh = () => setTick(t => t + 1);
  void tick;

  const categoryMap: Record<string, string[]> = {
    skins: ['skin'],
    weapons: ['weapon_skin'],
    vehicles: ['vehicle_skin'],
    effects: ['effect', 'trail', 'name_color'],
  };

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

  // Get skin colors for character preview
  const activeSkin = skinSystem.getActiveSkin();
  const previewColors = {
    head: activeSkin?.colors?.body ?? 0xffcc99,
    body: activeSkin?.colors?.body ?? 0x2d5a1e,
    arms: activeSkin?.colors?.arms ?? 0x2d5a1e,
    legs: activeSkin?.colors?.legs ?? 0x3a3a2a,
  };
  const toHex = (n: number) => '#' + n.toString(16).padStart(6, '0');

  const isGridTab = tab === 'skins' || tab === 'effects' || tab === 'weapons' || tab === 'vehicles';

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
                <div className="text-[8px] font-mono text-[#a0a890] mb-1 tracking-wider uppercase">PREVIEW</div>
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
                className="w-8 h-8 flex items-center justify-center text-[#a0a890] hover:text-[#c4a35a] transition-colors"
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
                    : 'text-[#a0a890] hover:text-[#c4a35a]/70'
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
          {tab === 'welcome' && <WelcomeTab skinSystem={skinSystem} />}
          {tab === 'crates' && <CratesTab skinSystem={skinSystem} onOpenCrate={handleOpenCrate} />}
          {tab === 'coins' && <CoinsTab />}
          {tab === 'utility' && <UtilityTab skinSystem={skinSystem} refresh={refresh} />}
          {isGridTab && (
            <ItemsGrid
              skinSystem={skinSystem}
              categories={categoryMap[tab] || []}
              onBuy={handleBuy}
              onEquip={handleEquip}
              isEquipped={isEquipped}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 md:px-5 md:py-2 border-t border-[#c4a35a]/10 text-center">
          <p className="text-[#a0a890] text-[8px] md:text-[10px] font-mono uppercase tracking-wider">
            Earn WP by playing (10/kill, 50/wave). BC via BLITZ COINS tab.
          </p>
        </div>
      </div>
    </div>
  );
}
