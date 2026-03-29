'use client';
import { useState } from 'react';
import { SHOP_ITEMS, CUB_COIN_PACKS, RARITY_COLORS_HEX } from '../game/shop/monetization';
import { SkinSystem } from '../game/shop/SkinSystem';

type ShopTab = 'skins' | 'effects' | 'coins';

export function ShopModal({ skinSystem, onClose }: { skinSystem: SkinSystem; onClose: () => void }) {
  const [tab, setTab] = useState<ShopTab>('skins');
  const [tick, setTick] = useState(0);

  const refresh = () => setTick(t => t + 1);
  void tick;

  const categoryMap: Record<ShopTab, string[]> = {
    skins: ['skin'],
    effects: ['effect', 'trail', 'name_color'],
    coins: [],
  };

  const visibleItems = tab === 'coins'
    ? []
    : SHOP_ITEMS.filter(item => categoryMap[tab].includes(item.category));

  const handleBuy = (itemId: string) => {
    skinSystem.buyWithCoins(itemId);
    refresh();
  };

  const handleEquip = (itemId: string, category: string) => {
    if (category === 'skin') skinSystem.equipSkin(skinSystem.purchases.activeSkin === itemId ? null : itemId);
    else if (category === 'effect' || category === 'trail') skinSystem.equipEffect(skinSystem.purchases.activeEffect === itemId ? null : itemId);
    else if (category === 'name_color') skinSystem.equipNameColor(skinSystem.purchases.activeNameColor === itemId ? null : itemId);
    refresh();
  };

  const isEquipped = (itemId: string, category: string): boolean => {
    if (category === 'skin') return skinSystem.purchases.activeSkin === itemId;
    if (category === 'effect' || category === 'trail') return skinSystem.purchases.activeEffect === itemId;
    if (category === 'name_color') return skinSystem.purchases.activeNameColor === itemId;
    return false;
  };

  const TAB_LABELS: Record<ShopTab, string> = { skins: 'SKINS', effects: 'EFFECTS', coins: 'CUB COINS' };

  return (
    <div
      className="absolute inset-0 bg-black/85 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-600 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
          <div>
            <h2 className="text-white font-black text-xl tracking-widest">CUB STORE</h2>
            <p className="text-yellow-400 text-xs font-mono mt-0.5">
              {skinSystem.purchases.cubCoins.toLocaleString()} CUB
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white font-bold text-lg px-2"
          >
            X
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {(Object.keys(TAB_LABELS) as ShopTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-bold font-mono tracking-wider transition-colors ${
                tab === t
                  ? 'text-white border-b-2 border-purple-500 bg-purple-900/20'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4">
          {tab === 'coins' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CUB_COIN_PACKS.map(pack => (
                <div
                  key={pack.id}
                  className="bg-gray-800 border border-gray-600 rounded-lg p-4 flex flex-col gap-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-bold text-sm">{pack.name}</p>
                      <p className="text-yellow-400 font-mono text-lg font-bold">
                        {(pack.coins + pack.bonus).toLocaleString()} CUB
                        {pack.bonus > 0 && (
                          <span className="text-green-400 text-xs ml-1 font-normal">
                            +{pack.bonus} bonus
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-gray-300 font-mono text-sm">${pack.priceUSD.toFixed(2)}</span>
                  </div>
                  <button
                    className="w-full py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm rounded active:scale-95 transition-all"
                    onClick={() => {
                      skinSystem.addCoins(pack.coins + pack.bonus);
                      refresh();
                    }}
                  >
                    BUY ${pack.priceUSD.toFixed(2)}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {visibleItems.map(item => {
                const owned = skinSystem.owns(item.id);
                const equipped = isEquipped(item.id, item.category);
                const canAfford = skinSystem.purchases.cubCoins >= item.priceCUB;
                const rarityColor = RARITY_COLORS_HEX[item.rarity];

                return (
                  <div
                    key={item.id}
                    className="bg-gray-800 rounded-lg p-3 flex flex-col gap-2"
                    style={{ border: `1px solid ${rarityColor}40` }}
                  >
                    {/* Rarity badge */}
                    <div className="flex justify-between items-center">
                      <span
                        className="text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded"
                        style={{ color: rarityColor, background: `${rarityColor}20` }}
                      >
                        {item.rarity}
                      </span>
                      {equipped && (
                        <span className="text-[9px] font-bold font-mono text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">
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

                    <div className="mt-auto">
                      {owned ? (
                        <button
                          onClick={() => handleEquip(item.id, item.category)}
                          className={`w-full py-1.5 text-xs font-bold rounded active:scale-95 transition-all ${
                            equipped
                              ? 'bg-green-700 hover:bg-green-600 text-white'
                              : 'bg-gray-600 hover:bg-gray-500 text-white'
                          }`}
                        >
                          {equipped ? 'UNEQUIP' : 'EQUIP'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuy(item.id)}
                          disabled={!canAfford}
                          className={`w-full py-1.5 text-xs font-bold rounded active:scale-95 transition-all ${
                            canAfford
                              ? 'bg-purple-600 hover:bg-purple-500 text-white'
                              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          {item.priceCUB.toLocaleString()} CUB
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
        <div className="px-5 py-2 border-t border-gray-700 text-center">
          <p className="text-gray-600 text-[10px] font-mono">
            Earn CUB coins by purchasing packs in the CUB COINS tab
          </p>
        </div>
      </div>
    </div>
  );
}
