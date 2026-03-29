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
    <div className="absolute inset-0 flex flex-col items-center justify-center z-30"
      style={{ background: 'radial-gradient(ellipse at center, rgba(13,15,11,0.88) 0%, rgba(13,15,11,0.97) 100%)', backdropFilter: 'blur(6px)' }}>

      {/* GAME OVER Title */}
      <h2 className="text-4xl sm:text-6xl md:text-8xl font-bold mb-0 tracking-[0.2em] md:tracking-[0.4em] text-[#c93a3a]"
        style={{
          fontFamily: "'Teko', sans-serif",
          filter: 'drop-shadow(0 0 20px rgba(201,58,58,0.4))',
        }}>
        GAME OVER
      </h2>
      <p className="text-[#6b7b6a] text-xs md:text-sm font-mono mb-3 md:mb-5 tracking-[0.3em] uppercase">WAVE {gameState.currentWave}</p>

      {/* Final stats card */}
      <div className="relative w-[420px] max-w-[92vw] mb-4 overflow-hidden bg-[#12150f] border border-[#c4a35a]/20"
        style={{ clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))' }}>
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#c93a3a]" />
        <div className="p-3 md:p-5">
          <div className="grid grid-cols-2 gap-2 md:gap-3 text-center">
            <div className="p-2 md:p-3 bg-[#1a1f16] border border-[#c93a3a]/20">
              <div className="text-xl md:text-3xl font-bold text-[#c93a3a]" style={{ fontFamily: "'Teko', sans-serif" }}>{stats?.totalKills ?? gameState.kills}</div>
              <div className="text-[#6b7b6a] text-[8px] md:text-[10px] font-mono tracking-wider mt-0.5 md:mt-1">TOTAL KILLS</div>
            </div>
            <div className="p-2 md:p-3 bg-[#1a1f16] border border-[#4a6741]/20">
              <div className="text-xl md:text-3xl font-bold text-[#4a6741]" style={{ fontFamily: "'Teko', sans-serif" }}>{gameState.currentWave}</div>
              <div className="text-[#6b7b6a] text-[8px] md:text-[10px] font-mono tracking-wider mt-0.5 md:mt-1">WAVES SURVIVED</div>
            </div>
            <div className="p-2 md:p-3 bg-[#1a1f16] border border-[#c4a35a]/20">
              <div className="text-lg md:text-2xl font-bold text-[#c4a35a]" style={{ fontFamily: "'Teko', sans-serif" }}>{fmt(stats?.survivalTime ?? gameState.gameTime)}</div>
              <div className="text-[#6b7b6a] text-[8px] md:text-[10px] font-mono tracking-wider mt-0.5 md:mt-1">SURVIVAL TIME</div>
            </div>
            <div className="p-2 md:p-3 bg-[#1a1f16] border border-[#d4a24e]/20">
              <div className="text-lg md:text-2xl font-bold text-[#d4a24e]" style={{ fontFamily: "'Teko', sans-serif" }}>{stats?.bestKillStreak ?? gameState.bestKillStreak}</div>
              <div className="text-[#6b7b6a] text-[8px] md:text-[10px] font-mono tracking-wider mt-0.5 md:mt-1">BEST STREAK</div>
            </div>
          </div>
          {/* Rank */}
          <div className="mt-3 md:mt-4 text-center pt-2 md:pt-3 border-t border-[#c4a35a]/10">
            <div className="text-[#6b7b6a] text-[9px] md:text-[10px] font-mono tracking-wider uppercase">RANK</div>
            <div className="text-xl md:text-2xl font-bold mt-1 text-[#d4a24e]" style={{ fontFamily: "'Teko', sans-serif" }}>{rank}</div>
          </div>
        </div>
      </div>

      {/* Leaderboard top 5 */}
      <div className="w-[360px] max-w-[90vw] mb-4 overflow-hidden bg-[#12150f] border border-[#c4a35a]/15">
        <div className="p-3 md:p-4">
          <h3 className="text-[#c4a35a] font-bold text-xs md:text-sm mb-2 md:mb-3 text-center tracking-[0.25em] uppercase" style={{ fontFamily: "'Teko', sans-serif" }}>LEADERBOARD</h3>
          {leaderboard.slice(0, 5).map((entry, i) => {
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

      {/* Welcome Pack Banner */}
      {skinSystem.current && !skinSystem.current.purchases.welcomePurchased && (
        <div className="w-[360px] max-w-[90vw] mb-4 overflow-hidden bg-[#12150f] border-2 border-[#d4a24e]/40"
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

      <div className="flex flex-col md:flex-row gap-2 md:gap-3 w-[90vw] max-w-[360px]">
        <button
          onClick={() => window.location.reload()}
          className="flex-1 py-3 md:py-3.5 min-h-[48px] bg-[#d4a24e] text-black font-bold text-lg md:text-xl active:scale-95 transition-all tracking-[0.2em] uppercase hover:bg-[#c4a35a]"
          style={{ fontFamily: "'Teko', sans-serif" }}
        >
          PLAY AGAIN
        </button>
        <button
          onClick={onShowShop}
          className="px-6 py-3 md:py-3.5 min-h-[48px] bg-[#4a6741] text-white font-bold text-lg md:text-xl active:scale-95 transition-all tracking-[0.2em] uppercase hover:bg-[#5a7751]"
          style={{ fontFamily: "'Teko', sans-serif" }}
        >
          SHOP
        </button>
        {onShowArena && (
          <button
            onClick={onShowArena}
            className="px-6 py-3 md:py-3.5 min-h-[48px] bg-[#c93a3a] text-white font-bold text-lg md:text-xl active:scale-95 transition-all tracking-[0.2em] uppercase hover:bg-[#b93030]"
            style={{ fontFamily: "'Teko', sans-serif" }}
          >
            ARENA
          </button>
        )}
      </div>
    </div>
  );
}
