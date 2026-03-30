import { GameState } from '../../game/core/GameEngine';
import { SkinSystem } from '../../game/shop/SkinSystem';

export interface GameOverScreenProps {
  gameState: GameState;
  stats: { totalKills: number; survivalTime: number; bestKillStreak: number } | undefined;
  rank: string;
  leaderboard: { name: string; wave: number; kills: number }[];
  skinSystem: React.RefObject<SkinSystem | null>;
  fmt: (s: number) => string;
  onShowShop: () => void;
  onShowArena?: () => void;
}

export function GameOverScreen({ gameState, stats, rank, leaderboard, skinSystem, fmt, onShowShop, onShowArena }: GameOverScreenProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center z-30 overflow-y-auto py-2 md:py-0 md:justify-center"
      style={{ background: 'radial-gradient(ellipse at center, rgba(13,15,11,0.88) 0%, rgba(13,15,11,0.97) 100%)', backdropFilter: 'blur(6px)' }}>

      {/* GAME OVER Title */}
      <h2 className="text-3xl sm:text-6xl md:text-8xl font-bold mb-0 tracking-[0.2em] md:tracking-[0.4em] text-[#c93a3a] mt-auto md:mt-0 shrink-0"
        style={{
          fontFamily: "'Teko', sans-serif",
          filter: 'drop-shadow(0 0 20px rgba(201,58,58,0.4))',
        }}>
        GAME OVER
      </h2>
      <p className="text-[#6b7b6a] text-[10px] md:text-sm font-mono mb-1 md:mb-5 tracking-[0.3em] uppercase shrink-0">WAVE {gameState.currentWave}</p>

      {/* Final stats card -- compact on mobile landscape */}
      <div className="relative w-[420px] max-w-[92vw] mb-2 md:mb-4 overflow-hidden bg-[#12150f] border border-[#c4a35a]/20 shrink-0"
        style={{ clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))' }}>
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#c93a3a]" />
        <div className="p-2 md:p-5">
          <div className="grid grid-cols-4 md:grid-cols-2 gap-1 md:gap-3 text-center">
            <div className="p-1 md:p-3 bg-[#1a1f16] border border-[#c93a3a]/20">
              <div className="text-lg md:text-3xl font-bold text-[#c93a3a]" style={{ fontFamily: "'Teko', sans-serif" }}>{stats?.totalKills ?? gameState.kills}</div>
              <div className="text-[#6b7b6a] text-[7px] md:text-[10px] font-mono tracking-wider">KILLS</div>
            </div>
            <div className="p-1 md:p-3 bg-[#1a1f16] border border-[#4a6741]/20">
              <div className="text-lg md:text-3xl font-bold text-[#4a6741]" style={{ fontFamily: "'Teko', sans-serif" }}>{gameState.currentWave}</div>
              <div className="text-[#6b7b6a] text-[7px] md:text-[10px] font-mono tracking-wider">WAVES</div>
            </div>
            <div className="p-1 md:p-3 bg-[#1a1f16] border border-[#c4a35a]/20">
              <div className="text-base md:text-2xl font-bold text-[#c4a35a]" style={{ fontFamily: "'Teko', sans-serif" }}>{fmt(stats?.survivalTime ?? gameState.gameTime)}</div>
              <div className="text-[#6b7b6a] text-[7px] md:text-[10px] font-mono tracking-wider">TIME</div>
            </div>
            <div className="p-1 md:p-3 bg-[#1a1f16] border border-[#d4a24e]/20">
              <div className="text-base md:text-2xl font-bold text-[#d4a24e]" style={{ fontFamily: "'Teko', sans-serif" }}>{stats?.bestKillStreak ?? gameState.bestKillStreak}</div>
              <div className="text-[#6b7b6a] text-[7px] md:text-[10px] font-mono tracking-wider">STREAK</div>
            </div>
          </div>
          {/* Rank -- inline on mobile */}
          <div className="mt-1 md:mt-4 text-center pt-1 md:pt-3 border-t border-[#c4a35a]/10">
            <span className="text-[#6b7b6a] text-[8px] md:text-[10px] font-mono tracking-wider uppercase">RANK </span>
            <span className="text-base md:text-2xl font-bold text-[#d4a24e]" style={{ fontFamily: "'Teko', sans-serif" }}>{rank}</span>
          </div>
        </div>
      </div>

      {/* Leaderboard top 3 on mobile, top 5 on desktop */}
      <div className="w-[360px] max-w-[90vw] mb-2 md:mb-4 overflow-hidden bg-[#12150f] border border-[#c4a35a]/15 shrink-0">
        <div className="p-2 md:p-4">
          <h3 className="text-[#c4a35a] font-bold text-[10px] md:text-sm mb-1 md:mb-3 text-center tracking-[0.25em] uppercase" style={{ fontFamily: "'Teko', sans-serif" }}>LEADERBOARD</h3>
          {leaderboard.slice(0, typeof window !== 'undefined' && window.innerWidth < 768 ? 3 : 5).map((entry, i) => {
            const rankColors = ['#d4a24e', '#c4a35a', '#8a7a4a', '#6b7b6a', '#555'];
            return (
              <div key={i} className="flex items-center justify-between text-[10px] md:text-xs font-mono py-1 md:py-1.5 px-1.5 md:px-2 mb-0.5 border-b border-[#c4a35a]/05">
                <span className="font-bold text-xs md:text-sm w-5 md:w-6 text-center" style={{ color: rankColors[i] }}>
                  #{i + 1}
                </span>
                <span className="text-[#c4a35a] flex-1 ml-1.5 md:ml-2 truncate">{entry.name}</span>
                <span className="font-bold ml-1.5 md:ml-2 text-[#4a6741]">W{entry.wave}</span>
                <span className="font-bold ml-1.5 md:ml-2 text-[#c93a3a]">{entry.kills}K</span>
              </div>
            );
          })}
          {leaderboard.length === 0 && (
            <p className="text-[#6b7b6a] text-xs text-center font-mono py-2">No records yet</p>
          )}
        </div>
      </div>

      {/* Welcome Pack Banner -- hidden on mobile landscape to prevent overflow */}
      {skinSystem.current && !skinSystem.current.purchases.welcomePurchased && (
        <div className="hidden md:block w-[360px] max-w-[90vw] mb-4 overflow-hidden bg-[#12150f] border-2 border-[#d4a24e]/40"
          style={{
            clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(212,162,78,0.04) 20px, rgba(212,162,78,0.04) 21px)',
          }}>
          <div className="p-4 text-center">
            <div className="font-bold text-lg tracking-wider text-[#d4a24e] uppercase" style={{ fontFamily: "'Teko', sans-serif" }}>WELCOME PACK -- &#8377;9</div>
            <div className="text-[#6b7b6a] text-xs mt-1">500 BC + VIP Badge + Random Skin</div>
            <button onClick={() => {
              skinSystem.current!.buyWelcomePack();
            }} className="mt-3 px-6 py-2 bg-[#d4a24e] text-black font-bold text-sm active:scale-95 transition-all uppercase tracking-wider hover:bg-[#c4a35a]"
              style={{ fontFamily: "'Teko', sans-serif" }}>
              REQUISITION &#8377;9
            </button>
          </div>
        </div>
      )}

      {/* Tournament score submission indicator */}
      {skinSystem.current?.getActiveTournament() && (
        <div className="w-[360px] max-w-[90vw] mb-3 p-2 bg-[#4a6741]/10 border border-[#4a6741]/30 text-center">
          <span className="text-xs font-mono text-[#4a6741] uppercase tracking-wider">
            ARENA SCORE SUBMITTED: {gameState.currentWave * 1000 + (stats?.totalKills ?? gameState.kills)} pts
          </span>
        </div>
      )}

      <div className="flex flex-row gap-2 md:gap-3 w-[90vw] max-w-[360px] shrink-0 mb-auto md:mb-0">
        <button
          onClick={(e) => {
            (e.currentTarget as HTMLButtonElement).textContent = 'LOADING...';
            window.location.reload();
          }}
          className="flex-1 py-2 md:py-3.5 min-h-[44px] bg-[#d4a24e] text-black font-bold text-sm md:text-xl active:scale-95 transition-all tracking-[0.2em] uppercase hover:bg-[#c4a35a]"
          style={{ fontFamily: "'Teko', sans-serif" }}
        >
          AGAIN
        </button>
        <button
          onClick={onShowShop}
          className="px-4 md:px-6 py-2 md:py-3.5 min-h-[44px] bg-[#4a6741] text-white font-bold text-sm md:text-xl active:scale-95 transition-all tracking-[0.2em] uppercase hover:bg-[#5a7751]"
          style={{ fontFamily: "'Teko', sans-serif" }}
        >
          SHOP
        </button>
        {onShowArena && (
          <button
            onClick={onShowArena}
            className="px-4 md:px-6 py-2 md:py-3.5 min-h-[44px] bg-[#c93a3a] text-white font-bold text-sm md:text-xl active:scale-95 transition-all tracking-[0.2em] uppercase hover:bg-[#b93030]"
            style={{ fontFamily: "'Teko', sans-serif" }}
          >
            ARENA
          </button>
        )}
      </div>
    </div>
  );
}
