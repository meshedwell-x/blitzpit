import { GameEngine } from '../../game/core/GameEngine';
import { SkinSystem } from '../../game/shop/SkinSystem';

export interface LobbyScreenProps {
  engineRef: React.RefObject<GameEngine | null>;
  skinSystem: React.RefObject<SkinSystem | null>;
  bestLeaderboardEntry: { wave: number; kills: number } | null;
  onShowShop: () => void;
  onShowArena?: () => void;
}

export function LobbyScreen({ engineRef, skinSystem, bestLeaderboardEntry, onShowShop, onShowArena }: LobbyScreenProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
      <div className="bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded mb-2">
        FREE TO PLAY
      </div>
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
        onClick={() => {
          // Mobile: go fullscreen + landscape before starting
          const isMob = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
          if (isMob) {
            const el = document.documentElement;
            const rfs = el.requestFullscreen || (el as any).webkitRequestFullscreen;
            if (rfs) {
              rfs.call(el).then(() => {
                try {
                  const o = screen.orientation as any;
                  if (o?.lock) o.lock('landscape').catch(() => {});
                } catch {}
                engineRef.current?.startGame();
              }).catch(() => {
                engineRef.current?.startGame();
              });
            } else {
              engineRef.current?.startGame();
            }
          } else {
            engineRef.current?.startGame();
          }
        }}
        className="w-[85vw] max-w-[280px] md:w-auto md:px-14 py-3 min-h-[48px] font-black text-xl uppercase tracking-widest transition-all active:scale-95"
        style={{ background: '#d4a24e', color: '#1a1f16', fontFamily: "'Teko', sans-serif", fontSize: '1.5rem', letterSpacing: '0.15em' }}
      >
        DEPLOY
      </button>
      <div className="flex gap-2 mt-2 w-[85vw] max-w-[280px]">
        <button
          onClick={onShowShop}
          className="flex-1 py-2 min-h-[44px] font-bold text-sm uppercase tracking-wider transition-all active:scale-95"
          style={{ background: '#4a6741', color: '#e8e0d0', fontFamily: "'Teko', sans-serif", letterSpacing: '0.1em' }}
        >
          ARMORY
        </button>
        {onShowArena && (
          <button
            onClick={onShowArena}
            className="flex-1 py-2 min-h-[44px] font-bold text-sm uppercase tracking-wider transition-all active:scale-95"
            style={{ background: '#c93a3a', color: '#e8e0d0', fontFamily: "'Teko', sans-serif", letterSpacing: '0.1em' }}
          >
            ARENA
          </button>
        )}
      </div>

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
      <button onClick={() => {
        if (typeof navigator !== 'undefined') {
          navigator.share?.({ title: 'BLITZPIT', text: 'Free Battle Royale!', url: 'https://blitzpit.com' })
            .catch(() => navigator.clipboard?.writeText('https://blitzpit.com'));
        }
      }} className="mt-3 text-gray-500 text-xs font-mono underline">
        Share with friends
      </button>
    </div>
  );
}
