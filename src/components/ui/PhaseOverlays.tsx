import { GameState, GameEngine } from '../../game/core/GameEngine';
import { SkinSystem } from '../../game/shop/SkinSystem';

export interface PhaseOverlaysProps {
  gameState: GameState;
  engineRef: React.RefObject<GameEngine | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  skinSystem: React.RefObject<SkinSystem | null>;
  rank: string;
  onShowShop: () => void;
}

export function PlaneOverlay({ engineRef }: { engineRef: React.RefObject<GameEngine | null> }) {
  return (
    <div className="absolute bottom-20 md:bottom-28 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
      <div className="px-5 py-2 md:px-8 md:py-3 max-w-[90vw]" style={{ background: 'rgba(26,31,22,0.9)', border: '1px solid #4a4535' }}>
        <p className="text-base md:text-xl font-bold text-center uppercase tracking-widest" style={{ fontFamily: "'Teko', sans-serif", color: '#e8e0d0' }}>IN FLIGHT</p>
        <p className="text-xs md:text-sm font-mono text-center mt-1 uppercase" style={{ color: '#8a7e6b' }}>Press SPACE or tap to jump</p>
      </div>
      <button
        onClick={() => engineRef.current?.drop()}
        className="mt-2 px-10 md:px-12 py-3 min-h-[48px] font-bold text-base md:text-lg uppercase tracking-wider active:scale-95 pointer-events-auto transition-all"
        style={{ background: '#c93a3a', color: '#e8e0d0', fontFamily: "'Teko', sans-serif", letterSpacing: '0.15em' }}
      >
        JUMP!
      </button>
    </div>
  );
}

export function DroppingOverlay({ engineRef }: { engineRef: React.RefObject<GameEngine | null> }) {
  return (
    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 pointer-events-none w-44 md:w-56">
      {/* ALT/SPEED always visible */}
      <div className="px-3 py-2 md:px-4 md:py-3 font-mono text-[10px] md:text-xs space-y-1 border" style={{ background: 'rgba(26,31,22,0.85)', borderColor: '#4a4535' }}>
        <div className="flex justify-between">
          <span style={{ color: '#8a7e6b' }}>ALT</span>
          <span className="font-bold" style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif", fontSize: '14px' }}>
            {Math.max(0, Math.round(
              (engineRef.current?.player.state.position.y ?? 0) -
              (engineRef.current?.world.getHeightAt(
                engineRef.current?.player.state.position.x ?? 0,
                engineRef.current?.player.state.position.z ?? 0
              ) ?? 0)
            ))}m
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: '#8a7e6b' }}>SPEED</span>
          <span className="font-bold" style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif", fontSize: '14px' }}>
            {engineRef.current?.dropSpeed ?? 15} m/s
          </span>
        </div>
      </div>
      {/* PARACHUTE button only when chute NOT open */}
      {!engineRef.current?.parachuteOpen && (
        <button
          onClick={() => engineRef.current?.openParachute()}
          className="mt-2 w-full px-4 md:px-6 py-2 min-h-[48px] font-bold pointer-events-auto active:scale-95 uppercase tracking-wider"
          style={{ background: '#d4a24e', color: '#1a1f16', fontFamily: "'Teko', sans-serif" }}
        >
          PARACHUTE
        </button>
      )}
    </div>
  );
}

export function WaveTransitionOverlay({ gameState, engineRef, rank }: { gameState: GameState; engineRef: React.RefObject<GameEngine | null>; rank: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'rgba(26,31,22,0.88)', backdropFilter: 'blur(4px)' }}>
      <h2 className="text-3xl md:text-5xl font-black mb-3 animate-pulse uppercase tracking-[0.2em]" style={{ fontFamily: "'Teko', sans-serif", color: '#4a6741', filter: 'drop-shadow(0 0 12px rgba(74,103,65,0.5))' }}>
        WAVE {gameState.currentWave} CLEAR
      </h2>
      <p className="text-sm md:text-lg font-mono" style={{ color: '#c4a35a' }}>{gameState.totalKills} Total Kills</p>
      <p className="text-xs md:text-base font-mono mb-4" style={{ color: '#8a7e6b' }}>Rank: {rank}</p>
      <div className="p-3 md:p-4 mb-4 text-center border max-w-[90vw]" style={{ background: '#12150f', borderColor: '#4a4535' }}>
        <p className="text-xl md:text-2xl font-bold uppercase tracking-wider" style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif" }}>
          NEXT WAVE IN {Math.ceil(engineRef.current?.waveManager.transitionTimer ?? 0)}s
        </p>
        <p className="text-xs md:text-sm mt-1" style={{ color: '#8a7e6b' }}>
          Wave {gameState.currentWave + 1}: {engineRef.current?.waveManager.getWaveConfig(gameState.currentWave + 1).botCount ?? '?'} enemies
        </p>
      </div>
    </div>
  );
}

export function RevivePrompt({ engineRef, skinSystem }: { engineRef: React.RefObject<GameEngine | null>; skinSystem: React.RefObject<SkinSystem | null> }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-40" style={{ background: 'rgba(26,31,22,0.85)', backdropFilter: 'blur(4px)' }}>
      <h2 className="text-2xl md:text-4xl font-black mb-3 animate-pulse uppercase tracking-[0.3em]" style={{ fontFamily: "'Teko', sans-serif", color: '#c93a3a' }}>ELIMINATED</h2>
      <div className="p-3 md:p-5 text-center mb-4 border max-w-[85vw]" style={{ background: '#12150f', borderColor: '#4a4535' }}>
        <p className="font-mono text-2xl font-bold mb-1" style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif" }}>
          {Math.ceil(engineRef.current?.reviveTimer ?? 0)}
        </p>
        <p className="text-xs font-mono uppercase tracking-wider" style={{ color: '#8a7e6b' }}>seconds to revive</p>
      </div>
      <button
        onClick={() => engineRef.current?.revivePlayer()}
        disabled={!skinSystem.current || skinSystem.current.purchases.reviveTokens <= 0}
        className="px-8 py-3 font-bold text-lg active:scale-95 mb-2 uppercase tracking-wider"
        style={{
          background: skinSystem.current && skinSystem.current.purchases.reviveTokens > 0 ? '#4a6741' : '#4a4535',
          color: skinSystem.current && skinSystem.current.purchases.reviveTokens > 0 ? '#e8e0d0' : '#8a7e6b',
          fontFamily: "'Teko', sans-serif",
          cursor: (!skinSystem.current || skinSystem.current.purchases.reviveTokens <= 0) ? 'not-allowed' : 'pointer',
        }}
      >
        REVIVE ({skinSystem.current?.purchases.reviveTokens ?? 0} tokens)
      </button>
      <p className="text-xs font-mono" style={{ color: '#8a7e6b' }}>HP 50% | 2s invincible</p>
    </div>
  );
}

export function PauseOverlay({ engineRef, containerRef, onShowShop }: { engineRef: React.RefObject<GameEngine | null>; containerRef: React.RefObject<HTMLDivElement | null>; onShowShop: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50" style={{ background: 'rgba(26,31,22,0.88)', backdropFilter: 'blur(4px)' }}>
      <h2 className="text-3xl md:text-5xl font-bold mb-6 uppercase tracking-[0.3em]" style={{ fontFamily: "'Teko', sans-serif", color: '#c4a35a' }}>PAUSED</h2>
      <div className="flex flex-col gap-3 w-[80vw] max-w-[200px] md:w-48">
        <button
          onClick={() => {
            engineRef.current?.resume();
            containerRef.current?.requestPointerLock();
          }}
          className="px-6 py-3 min-h-[48px] font-bold active:scale-95 uppercase tracking-wider"
          style={{ background: '#d4a24e', color: '#1a1f16', fontFamily: "'Teko', sans-serif", fontSize: '1.1rem' }}
        >
          RESUME
        </button>
        <button
          onClick={onShowShop}
          className="px-6 py-3 min-h-[48px] font-bold active:scale-95 uppercase tracking-wider"
          style={{ background: '#4a6741', color: '#e8e0d0', fontFamily: "'Teko', sans-serif", fontSize: '1.1rem' }}
        >
          SHOP
        </button>
      </div>
    </div>
  );
}
