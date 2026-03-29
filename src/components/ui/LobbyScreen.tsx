import { GameEngine } from '../../game/core/GameEngine';
import { SkinSystem } from '../../game/shop/SkinSystem';

export interface LobbyScreenProps {
  engineRef: React.RefObject<GameEngine | null>;
  skinSystem: React.RefObject<SkinSystem | null>;
  bestLeaderboardEntry: { wave: number; kills: number } | null;
  onShowShop: () => void;
}

export function LobbyScreen({ engineRef, skinSystem, bestLeaderboardEntry, onShowShop }: LobbyScreenProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
      <h1 className="text-5xl md:text-7xl font-black mb-0 tracking-wider uppercase" style={{ fontFamily: "'Teko', sans-serif", color: '#e8e0d0', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
        BLITZ<span style={{ color: '#c93a3a' }}>PIT</span>
      </h1>
      <p className="text-xs md:text-sm mb-2 tracking-[0.3em] uppercase font-bold" style={{ fontFamily: "'Teko', sans-serif", color: '#8a7e6b' }}>INFINITE BATTLE ROYALE</p>
      <div className="text-xs font-mono mb-4" style={{ color: '#6b6356' }}>
        40 players waiting...
      </div>

      {/* Nickname input */}
      <div className="mb-3 mt-2 w-[85vw] max-w-[264px]">
        <input
          type="text"
          placeholder="ENTER CALLSIGN"
          maxLength={16}
          defaultValue={localStorage.getItem('blitzpit_name') || ''}
          onChange={(e) => localStorage.setItem('blitzpit_name', e.target.value)}
          className="px-3 py-2 md:px-4 md:py-2.5 text-center font-mono text-base md:text-lg uppercase tracking-wider focus:outline-none w-full min-h-[48px]"
          style={{ background: '#1a1f16', border: '1px solid #4a4535', color: '#e8e0d0', fontFamily: "'Rajdhani', sans-serif" }}
        />
      </div>

      {/* Personal best */}
      {bestLeaderboardEntry && (
        <div className="mb-3 text-center">
          <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#6b6356' }}>PERSONAL BEST: </span>
          <span className="text-sm font-bold" style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif" }}>Wave {bestLeaderboardEntry.wave} | {bestLeaderboardEntry.kills} Kills</span>
        </div>
      )}

      <button
        onClick={() => engineRef.current?.startGame()}
        className="w-[85vw] max-w-[280px] md:w-auto md:px-14 py-3 min-h-[48px] font-black text-xl uppercase tracking-widest transition-all active:scale-95"
        style={{ background: '#d4a24e', color: '#1a1f16', fontFamily: "'Teko', sans-serif", fontSize: '1.5rem', letterSpacing: '0.15em' }}
      >
        DEPLOY
      </button>
      <button
        onClick={onShowShop}
        className="mt-2 w-[85vw] max-w-[280px] md:w-auto md:px-8 py-2 min-h-[44px] font-bold text-sm uppercase tracking-wider transition-all active:scale-95"
        style={{ background: '#4a6741', color: '#e8e0d0', fontFamily: "'Teko', sans-serif", letterSpacing: '0.1em' }}
      >
        ARMORY
      </button>

      {skinSystem.current?.getActiveSkin() && (
        <div className="mt-2 text-center">
          <span className="text-xs font-mono uppercase" style={{ color: '#6b6356' }}>Loadout: </span>
          <span className="text-xs font-bold" style={{ color: '#d4a24e' }}>
            {skinSystem.current?.getActiveSkin()?.name}
          </span>
        </div>
      )}

      <div className="mt-5 text-[8px] md:text-[10px] font-mono space-y-0.5 text-center uppercase max-w-[90vw] md:max-w-none" style={{ color: '#4a4535' }}>
        <p>WASD Move | SHIFT Sprint | C Crouch | V Melee</p>
        <p>Click Shoot | RMB Aim | R Reload | F Pickup</p>
        <p>1/2 Weapons | T Grenade | E Vehicle | TAB Inv</p>
      </div>
    </div>
  );
}
