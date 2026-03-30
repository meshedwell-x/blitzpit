'use client';

import { useState, useEffect, useCallback } from 'react';
import { SkinSystem, TIER_COLORS, PlayerTier } from '../game/shop/SkinSystem';
import {
  checkArenaStatus,
  getActiveTournaments,
  joinTournament,
  getTournamentResults,
  getSeasonLeaderboard,
  Tournament,
  TournamentResult,
  LeaderboardEntry,
  ArenaStatus,
  TIER_ARENA_COLORS,
  TIER_LABELS,
} from '../game/arena/ArenaAPI';

interface ArenaModalProps {
  skinSystem: SkinSystem;
  onClose: () => void;
}

type ArenaTab = 'tournaments' | 'leaderboard' | 'results' | 'tier';

export function ArenaModal({ skinSystem, onClose }: ArenaModalProps) {
  const [tab, setTab] = useState<ArenaTab>('tournaments');
  const [arenaStatus, setArenaStatus] = useState<ArenaStatus | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedResult, setSelectedResult] = useState<TournamentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinEmail, setJoinEmail] = useState('');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const userId = skinSystem.getUserId();
  const currentTier = skinSystem.getTier();
  const tierProgress = skinSystem.getTierProgress();
  const activeTournament = skinSystem.getActiveTournament();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await checkArenaStatus();
      setArenaStatus(status);
      if (!status.enabled) {
        setLoading(false);
        return;
      }
      const [tourns, lb] = await Promise.all([
        getActiveTournaments(),
        getSeasonLeaderboard(),
      ]);
      setTournaments(tourns);
      setLeaderboard(lb);
    } catch {
      setError('Failed to load arena data');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleJoin = async (tournament: Tournament) => {
    if (!joinEmail || !joinEmail.includes('@')) {
      setError('Enter a valid email for your account');
      return;
    }
    setJoiningId(tournament.id);
    setError(null);
    const result = await joinTournament(
      tournament.id,
      userId,
      joinEmail,
      window.location.origin + window.location.pathname,
      window.location.origin + window.location.pathname,
    );
    if (result.alreadyJoined) {
      skinSystem.setActiveTournament(tournament.id);
      setError('Already joined this tournament. Score will be submitted automatically.');
    } else if (result.url) {
      skinSystem.setActiveTournament(tournament.id);
      window.location.href = result.url;
    } else {
      setError(result.error || 'Failed to join tournament');
    }
    setJoiningId(null);
  };

  const handleViewResults = async (tournamentId: string) => {
    const result = await getTournamentResults(tournamentId, userId);
    if (result) {
      setSelectedResult(result);
      setTab('results');
    }
  };

  const canJoinTier = (tier: string): boolean => {
    const tierOrder: PlayerTier[] = ['free', 'bronze', 'silver', 'gold', 'diamond'];
    const requiredIdx = tierOrder.indexOf(tier as PlayerTier);
    const currentIdx = tierOrder.indexOf(currentTier);
    return currentIdx >= requiredIdx;
  };

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const timeRemaining = (endTime: number): string => {
    const diff = endTime - Date.now();
    if (diff <= 0) return 'ENDED';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  // Arena blocked for KR users
  if (arenaStatus && !arenaStatus.enabled) {
    return (
      <div className="absolute inset-0 bg-[#0d0f0b]/97 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-[#12150f] border border-[#c4a35a]/25 p-8 max-w-md text-center" onClick={e => e.stopPropagation()}>
          <h2 className="text-2xl font-bold text-[#c93a3a] tracking-[0.2em] uppercase mb-4" style={{ fontFamily: "'Teko', sans-serif" }}>
            ARENA UNAVAILABLE
          </h2>
          <p className="text-[#8a7e6b] text-sm font-mono mb-2">
            {arenaStatus.reason || 'Arena tournaments are not available in your region.'}
          </p>
          <p className="text-[#6b6356] text-xs font-mono mb-6">
            Country: {arenaStatus.country}
          </p>
          <button onClick={onClose} className="px-8 py-2 bg-[#4a6741] text-[#e8e0d0] font-bold text-sm uppercase tracking-wider"
            style={{ fontFamily: "'Teko', sans-serif" }}>
            CLOSE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-[#0d0f0b]/97 backdrop-blur-sm flex items-start pt-4 justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#12150f]/98 border border-[#c93a3a]/25 w-full max-w-2xl max-h-[92vh] flex flex-col mx-1 md:mx-4"
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-3 py-2 md:px-5 md:py-3 border-b border-[#c93a3a]/15">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#c93a3a]" />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[#c93a3a] font-bold text-lg md:text-2xl tracking-[0.2em] md:tracking-[0.3em] uppercase"
                style={{ fontFamily: "'Teko', sans-serif" }}>
                P2E ARENA
              </h2>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs font-mono font-bold px-2 py-0.5 border" style={{
                  color: TIER_COLORS[currentTier],
                  borderColor: TIER_COLORS[currentTier],
                  background: 'rgba(0,0,0,0.3)',
                }}>
                  {currentTier.toUpperCase()}
                </span>
                {activeTournament && (
                  <span className="text-[9px] font-mono text-[#4a6741] uppercase tracking-wider">
                    IN TOURNAMENT
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-[#a0a890] hover:text-[#c93a3a] transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-2 md:px-3 py-1.5 border-b border-[#c93a3a]/10 bg-[#0d0f0b]/50">
          <div className="flex gap-0.5">
            {(['tournaments', 'leaderboard', 'tier'] as ArenaTab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative px-3 py-1.5 text-[10px] font-bold tracking-[0.15em] uppercase transition-all ${
                  tab === t ? 'text-[#c93a3a] bg-[#c93a3a]/10' : 'text-[#a0a890] hover:text-[#c93a3a]/70'
                }`}
              >
                {t === 'tournaments' ? 'TOURNAMENTS' : t === 'leaderboard' ? 'LEADERBOARD' : 'MY TIER'}
                {tab === t && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#c93a3a]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-2 px-3 py-2 bg-[#c93a3a]/10 border border-[#c93a3a]/30 text-[#c93a3a] text-xs font-mono">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-2 md:p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <span className="text-[#8a7e6b] font-mono text-sm animate-pulse uppercase tracking-wider">LOADING ARENA...</span>
            </div>
          )}

          {/* TOURNAMENTS TAB */}
          {!loading && tab === 'tournaments' && (
            <div className="space-y-3">
              {/* Email input for account */}
              <div className="p-3 bg-[#1a1f16] border border-[#4a4535]">
                <label className="text-[9px] font-mono text-[#8a7e6b] uppercase tracking-wider block mb-1">
                  EMAIL (for your account)
                </label>
                <input
                  type="email"
                  value={joinEmail}
                  onChange={e => setJoinEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2 text-sm font-mono focus:outline-none"
                  style={{ background: '#12150f', border: '1px solid #4a4535', color: '#e8e0d0' }}
                />
              </div>

              {tournaments.length === 0 && (
                <div className="text-center py-8 text-[#6b6356] font-mono text-sm">
                  No active tournaments. Check back later.
                </div>
              )}

              {tournaments.map(t => {
                const canJoin = canJoinTier(t.tier);
                const isJoined = activeTournament === t.id;
                const isCompleted = t.status === 'completed';
                return (
                  <div key={t.id} className="p-3 bg-[#1a1f16] border" style={{
                    borderColor: isJoined ? '#4a6741' : TIER_ARENA_COLORS[t.tier] + '40',
                  }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold uppercase tracking-wider" style={{
                          color: TIER_ARENA_COLORS[t.tier],
                          fontFamily: "'Teko', sans-serif",
                        }}>
                          {TIER_LABELS[t.tier]} ARENA
                        </span>
                        {isJoined && (
                          <span className="text-[8px] font-mono px-1.5 py-0.5 bg-[#4a6741]/20 text-[#4a6741] border border-[#4a6741]/30">
                            JOINED
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono" style={{ color: '#8a7e6b' }}>
                        {timeRemaining(t.endTime)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-2 text-center">
                      <div>
                        <div className="text-lg font-bold" style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif" }}>
                          ${t.entryFee.toFixed(2)}
                        </div>
                        <div className="text-[8px] font-mono text-[#6b6356] uppercase">ENTRY</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold" style={{ color: '#4a6741', fontFamily: "'Teko', sans-serif" }}>
                          {t.prizePool.toLocaleString()} BC
                        </div>
                        <div className="text-[8px] font-mono text-[#6b6356] uppercase">COIN PRIZE</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold" style={{ color: '#c4a35a', fontFamily: "'Teko', sans-serif" }}>
                          {t.entryCount}
                        </div>
                        <div className="text-[8px] font-mono text-[#6b6356] uppercase">PLAYERS</div>
                      </div>
                    </div>

                    <div className="text-[9px] font-mono text-[#6b6356] mb-2">
                      {formatTime(t.startTime)} -- {formatTime(t.endTime)}
                    </div>

                    {isCompleted ? (
                      <button
                        onClick={() => handleViewResults(t.id)}
                        className="w-full py-2 text-sm font-bold uppercase tracking-wider transition-all active:scale-95"
                        style={{ background: '#4a4535', color: '#e8e0d0', fontFamily: "'Teko', sans-serif" }}
                      >
                        VIEW RESULTS
                      </button>
                    ) : isJoined ? (
                      <div className="w-full py-2 text-center text-sm font-bold uppercase tracking-wider text-[#4a6741]"
                        style={{ fontFamily: "'Teko', sans-serif" }}>
                        SCORE SUBMITTED AUTOMATICALLY ON GAME OVER
                      </div>
                    ) : canJoin ? (
                      <button
                        onClick={() => handleJoin(t)}
                        disabled={joiningId === t.id}
                        className="w-full py-2 text-sm font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                        style={{ background: '#c93a3a', color: '#e8e0d0', fontFamily: "'Teko', sans-serif" }}
                      >
                        {joiningId === t.id ? 'JOINING...' : `JOIN -- $${t.entryFee.toFixed(2)}`}
                      </button>
                    ) : (
                      <div className="w-full py-2 text-center text-[10px] font-mono text-[#6b6356]">
                        REQUIRES {TIER_LABELS[t.tier]} TIER (spend ${
                          ({ bronze: 5, silver: 25, gold: 60, diamond: 120 })[t.tier]
                        }+ total)
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="p-3 bg-[#1a1f16]/50 border border-[#4a4535]/30 text-[9px] font-mono text-[#6b6356] space-y-1">
                <p>-- 24-hour asynchronous tournaments. Play anytime, best score counts.</p>
                <p>-- Score = Wave x 1000 + Kills. Higher wave = better score.</p>
                <p>-- Top 3 win in-game coin prizes. Coins credited to your account.</p>
                <p>-- Use coins to unlock skins, effects, and exclusive items.</p>
              </div>
            </div>
          )}

          {/* LEADERBOARD TAB */}
          {!loading && tab === 'leaderboard' && (
            <div>
              <div className="mb-3 p-2 bg-[#1a1f16] border border-[#4a4535] text-center">
                <span className="text-sm font-bold text-[#c4a35a] uppercase tracking-[0.2em]" style={{ fontFamily: "'Teko', sans-serif" }}>
                  SEASON LEADERBOARD
                </span>
              </div>
              {leaderboard.length === 0 && (
                <div className="text-center py-8 text-[#6b6356] font-mono text-sm">
                  No scores yet this season.
                </div>
              )}
              {leaderboard.map((entry, i) => {
                const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32', '#6b7b6a', '#555'];
                const isMe = entry.userId === userId;
                return (
                  <div key={entry.userId + i} className="flex items-center justify-between text-xs font-mono py-2 px-3 mb-0.5 border-b border-[#4a4535]/20"
                    style={{ background: isMe ? 'rgba(74,103,65,0.15)' : 'transparent' }}>
                    <span className="font-bold text-sm w-8 text-center" style={{ color: rankColors[Math.min(i, 4)] }}>
                      #{i + 1}
                    </span>
                    <span className="text-[#c4a35a] flex-1 ml-2 truncate">
                      {entry.name} {isMe ? '(YOU)' : ''}
                    </span>
                    <span className="font-bold ml-2 text-[#4a6741]">W{entry.bestWave}</span>
                    <span className="font-bold ml-2 text-[#c93a3a]">{entry.totalKills}K</span>
                    <span className="font-bold ml-2 text-[#d4a24e]">{entry.score}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* RESULTS TAB */}
          {!loading && tab === 'results' && selectedResult && (
            <div>
              <div className="mb-3 p-3 bg-[#1a1f16] border" style={{ borderColor: TIER_ARENA_COLORS[selectedResult.tournament.tier] + '40' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold uppercase tracking-wider" style={{
                    color: TIER_ARENA_COLORS[selectedResult.tournament.tier],
                    fontFamily: "'Teko', sans-serif",
                  }}>
                    {TIER_LABELS[selectedResult.tournament.tier]} ARENA RESULTS
                  </span>
                  <span className="text-xs font-mono text-[#8a7e6b]">
                    Coin Prize: {selectedResult.tournament.prizePool.toLocaleString()} BC
                  </span>
                </div>
                {selectedResult.myEntry && (
                  <div className="p-2 bg-[#4a6741]/10 border border-[#4a6741]/30 mb-2">
                    <span className="text-xs font-mono text-[#4a6741]">
                      YOUR RANK: #{selectedResult.myEntry.rank} | SCORE: {selectedResult.myEntry.bestScore}
                      {selectedResult.myEntry.prizeWon > 0 && ` | WON: ${selectedResult.myEntry.prizeWon.toLocaleString()} BC`}
                    </span>
                  </div>
                )}
              </div>
              {selectedResult.entries.map((entry, i) => {
                const isMe = entry.userId === userId;
                const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32', '#6b7b6a', '#555'];
                return (
                  <div key={entry.userId + i} className="flex items-center justify-between text-xs font-mono py-1.5 px-3 mb-0.5 border-b border-[#4a4535]/20"
                    style={{ background: isMe ? 'rgba(74,103,65,0.15)' : 'transparent' }}>
                    <span className="font-bold text-sm w-8 text-center" style={{ color: rankColors[Math.min(i, 4)] }}>
                      #{entry.rank}
                    </span>
                    <span className="text-[#c4a35a] flex-1 ml-2 truncate">{isMe ? 'YOU' : entry.userId.slice(0, 8)}</span>
                    <span className="font-bold ml-2 text-[#d4a24e]">{entry.bestScore}</span>
                    {entry.prizeWon > 0 && (
                      <span className="font-bold ml-2 text-[#4a6741]">{entry.prizeWon.toLocaleString()} BC</span>
                    )}
                  </div>
                );
              })}
              <button
                onClick={() => setTab('tournaments')}
                className="mt-3 w-full py-2 text-sm font-bold uppercase tracking-wider bg-[#4a4535] text-[#e8e0d0] active:scale-95 transition-all"
                style={{ fontFamily: "'Teko', sans-serif" }}
              >
                BACK TO TOURNAMENTS
              </button>
            </div>
          )}

          {/* TIER TAB */}
          {!loading && tab === 'tier' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#1a1f16] border text-center" style={{ borderColor: TIER_COLORS[currentTier] + '60' }}>
                <div className="text-3xl font-bold uppercase tracking-[0.3em] mb-1" style={{
                  color: TIER_COLORS[currentTier],
                  fontFamily: "'Teko', sans-serif",
                }}>
                  {currentTier}
                </div>
                <div className="text-xs font-mono text-[#8a7e6b]">
                  Total Spent: ${tierProgress.spent.toFixed(2)}
                </div>
                {tierProgress.nextTier && (
                  <div className="mt-3">
                    <div className="w-full h-2 bg-[#4a4535] mb-1">
                      <div className="h-full transition-all" style={{
                        width: `${Math.min(100, (tierProgress.spent / tierProgress.nextThreshold) * 100)}%`,
                        backgroundColor: TIER_COLORS[tierProgress.nextTier],
                      }} />
                    </div>
                    <div className="text-[9px] font-mono text-[#6b6356]">
                      ${(tierProgress.nextThreshold - tierProgress.spent).toFixed(2)} more to {tierProgress.nextTier.toUpperCase()}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {(['bronze', 'silver', 'gold', 'diamond'] as const).map(tier => {
                  const threshold = ({ bronze: 5, silver: 25, gold: 60, diamond: 120 })[tier];
                  const unlocked = canJoinTier(tier);
                  return (
                    <div key={tier} className="flex items-center justify-between p-3 bg-[#1a1f16] border" style={{
                      borderColor: unlocked ? TIER_COLORS[tier] + '40' : '#4a4535',
                      opacity: unlocked ? 1 : 0.5,
                    }}>
                      <div>
                        <span className="text-sm font-bold uppercase tracking-wider" style={{
                          color: TIER_COLORS[tier],
                          fontFamily: "'Teko', sans-serif",
                        }}>
                          {tier}
                        </span>
                        <span className="text-[9px] font-mono text-[#6b6356] ml-2">
                          ${threshold}+ spent
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono" style={{ color: unlocked ? '#4a6741' : '#6b6356' }}>
                          {unlocked ? 'UNLOCKED' : 'LOCKED'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-[#1a1f16]/50 border border-[#4a4535]/30 text-[9px] font-mono text-[#6b6356] space-y-1">
                <p>-- Tier unlocks based on total USD spent in the shop.</p>
                <p>-- Higher tiers unlock higher-stakes tournaments.</p>
                <p>-- Diamond tier: access to $10 entry tournaments.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 md:px-5 md:py-2 border-t border-[#c93a3a]/10 text-center">
          <p className="text-[#a0a890] text-[8px] md:text-[10px] font-mono uppercase tracking-wider">
            Skill-based tournaments. Play your best, win in-game coins.
          </p>
        </div>
      </div>
    </div>
  );
}
