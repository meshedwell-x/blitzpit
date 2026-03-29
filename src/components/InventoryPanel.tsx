import { GameEngine, GameState } from '../game/core/GameEngine';
import { WeaponInstance } from '../game/weapons/WeaponSystem';
import { GRENADES } from '../game/weapons/GrenadeSystem';

const RARITY_COLORS: Record<string, string> = {
  common: 'text-gray-300 border-gray-500',
  uncommon: 'text-green-300 border-green-500',
  rare: 'text-blue-300 border-blue-500',
  epic: 'text-purple-300 border-purple-500',
};

const RARITY_BG: Record<string, string> = {
  common: 'bg-gray-700/60',
  uncommon: 'bg-green-900/40',
  rare: 'bg-blue-900/40',
  epic: 'bg-purple-900/40',
};

export function InventoryPanel({ engine, weapons, activeSlot, grenadeCount, gameState, onClose }: {
  engine: GameEngine | null;
  weapons: (WeaponInstance | null)[];
  activeSlot: number;
  grenadeCount: Record<string, number>;
  gameState: GameState;
  onClose: () => void;
}) {
  const rank = engine?.scoreboardSystem.getRank(gameState.currentWave, gameState.totalKills) ?? 'ROOKIE';
  const stats = engine?.scoreboardSystem.stats;

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 w-80 max-w-[90vw]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-white font-bold">INVENTORY</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">X</button>
        </div>

        {/* Wave + stats */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="bg-gray-800 p-2 rounded text-center">
            <div className="text-cyan-400 text-lg font-bold">{gameState.currentWave}</div>
            <div className="text-gray-500 text-[10px] font-mono">WAVE</div>
          </div>
          <div className="bg-gray-800 p-2 rounded text-center">
            <div className="text-yellow-400 text-lg font-bold">{stats?.totalKills ?? gameState.kills}</div>
            <div className="text-gray-500 text-[10px] font-mono">TOTAL KILLS</div>
          </div>
          <div className="bg-gray-800 p-2 rounded text-center">
            <div className="text-orange-400 text-lg font-bold">{stats?.currentKillStreak ?? gameState.killStreak}</div>
            <div className="text-gray-500 text-[10px] font-mono">STREAK</div>
          </div>
          <div className="bg-gray-800 p-2 rounded text-center">
            <div className="text-purple-400 text-sm font-bold">{rank}</div>
            <div className="text-gray-500 text-[10px] font-mono">RANK</div>
          </div>
        </div>

        {/* Weapons */}
        <div className="mb-3">
          <p className="text-gray-400 text-xs mb-1 font-mono">WEAPONS</p>
          {weapons.map((w, i) => {
            const rarity = w?.def.rarity ?? 'common';
            return (
              <div key={i} className={`flex justify-between items-center p-2 mb-1 rounded ${
                i === activeSlot ? `${RARITY_BG[rarity]} border ${RARITY_COLORS[rarity]}` : 'bg-gray-800'
              }`}>
                <span className={`text-sm ${i === activeSlot ? RARITY_COLORS[rarity].split(' ')[0] : 'text-white'}`}>
                  {w ? w.def.name : `Slot ${i + 1} (Empty)`}
                </span>
                {w && (
                  <span className="text-gray-400 text-xs">
                    {w.currentAmmo}/{w.def.magazineSize} | {w.reserveAmmo}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Grenades */}
        <div className="mb-3">
          <p className="text-gray-400 text-xs mb-1 font-mono">THROWABLES</p>
          <div className="flex gap-2">
            {Object.entries(GRENADES).map(([id, def]) => (
              <div key={id} className="bg-gray-800 p-2 rounded flex-1 text-center">
                <div className="text-white text-xs">{def.name}</div>
                <div className="text-yellow-400 text-lg font-bold">{grenadeCount[id] || 0}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <p className="text-gray-400 text-xs mb-1 font-mono">STATUS</p>
          <div className="bg-gray-800 p-2 rounded text-xs text-gray-300 space-y-0.5">
            <p>HP: {Math.ceil(engine?.player.state.health || 0)} | Armor: {Math.ceil(engine?.player.state.armor || 0)}</p>
            <p>Kills: {engine?.player.state.kills || 0} | Best Streak: {stats?.bestKillStreak ?? 0}</p>
          </div>
        </div>

        <p className="text-gray-500 text-[10px] mt-2 text-center font-mono">TAB to close</p>
      </div>
    </div>
  );
}
