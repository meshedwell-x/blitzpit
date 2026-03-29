/**
 * ArenaAPI -- Client-side API for P2E League tournament system.
 * Communicates with the blitzpit-api Worker for tournament operations.
 * GeoRestriction: KR users are blocked server-side; client shows appropriate UI.
 */

const BLITZPIT_API = 'https://blitzpit-api.meshedwell.workers.dev';

export interface Tournament {
  id: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  entryFee: number;
  prizePool: number;
  startTime: number;
  endTime: number;
  entryCount: number;
  status: 'active' | 'completed' | 'cancelled';
}

export interface TournamentEntry {
  userId: string;
  bestScore: number;
  rank: number;
  prizeWon: number;
}

export interface TournamentResult {
  tournament: Tournament;
  entries: TournamentEntry[];
  myEntry: TournamentEntry | null;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  bestWave: number;
  totalKills: number;
  score: number;
  rank: number;
}

export interface ArenaStatus {
  enabled: boolean;
  country: string;
  reason?: string;
}

export async function checkArenaStatus(): Promise<ArenaStatus> {
  try {
    const res = await fetch(`${BLITZPIT_API}/api/arena/status`);
    const data = await res.json() as ArenaStatus;
    return data;
  } catch {
    return { enabled: false, country: 'unknown', reason: 'Network error' };
  }
}

export async function getActiveTournaments(): Promise<Tournament[]> {
  try {
    const res = await fetch(`${BLITZPIT_API}/api/tournament/active`);
    if (!res.ok) return [];
    const data = await res.json() as { tournaments: Tournament[] };
    return data.tournaments || [];
  } catch {
    return [];
  }
}

export async function joinTournament(
  tournamentId: string,
  userId: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url?: string; error?: string; alreadyJoined?: boolean }> {
  try {
    const res = await fetch(`${BLITZPIT_API}/api/tournament/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, userId, email, successUrl, cancelUrl }),
    });
    return await res.json() as { url?: string; error?: string; alreadyJoined?: boolean };
  } catch {
    return { error: 'Network error' };
  }
}

export async function submitTournamentScore(
  tournamentId: string,
  userId: string,
  wave: number,
  kills: number,
): Promise<{ success: boolean; bestScore?: number; error?: string }> {
  try {
    const score = wave * 1000 + kills;
    const res = await fetch(`${BLITZPIT_API}/api/tournament/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, userId, score, wave, kills }),
    });
    return await res.json() as { success: boolean; bestScore?: number; error?: string };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

export async function getTournamentResults(tournamentId: string, userId?: string): Promise<TournamentResult | null> {
  try {
    let url = `${BLITZPIT_API}/api/tournament/results?tournament_id=${tournamentId}`;
    if (userId) url += `&user_id=${userId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json() as TournamentResult;
  } catch {
    return null;
  }
}

export async function getSeasonLeaderboard(seasonId?: string): Promise<LeaderboardEntry[]> {
  try {
    let url = `${BLITZPIT_API}/api/leaderboard`;
    if (seasonId) url += `?season_id=${seasonId}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json() as { leaderboard: LeaderboardEntry[] };
    return data.leaderboard || [];
  } catch {
    return [];
  }
}

export async function submitLeaderboardScore(
  userId: string,
  name: string,
  wave: number,
  kills: number,
): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${BLITZPIT_API}/api/leaderboard/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name, wave, kills }),
    });
    return await res.json() as { success: boolean };
  } catch {
    return { success: false };
  }
}

export function computeScore(wave: number, kills: number): number {
  return wave * 1000 + kills;
}

export const TIER_ENTRY_FEES: Record<string, number> = {
  bronze: 0.50,
  silver: 2.00,
  gold: 5.00,
  diamond: 10.00,
};

export const TIER_LABELS: Record<string, string> = {
  bronze: 'BRONZE',
  silver: 'SILVER',
  gold: 'GOLD',
  diamond: 'DIAMOND',
};

export const TIER_ARENA_COLORS: Record<string, string> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  diamond: '#b9f2ff',
};
