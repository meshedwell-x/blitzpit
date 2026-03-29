import { RANK_THRESHOLDS, KILL_STREAK_LABELS, KILL_STREAK_TIMEOUT } from '../core/constants';

export interface PlayerStats {
  totalKills: number;
  currentWave: number;
  highestWave: number;
  survivalTime: number;
  gamesPlayed: number;
  bestKillStreak: number;
  currentKillStreak: number;
  headshotCount: number;
}

export interface LeaderboardEntry {
  name: string;
  wave: number;
  kills: number;
  time: number;
  date: string;
}

const STORAGE_KEY_STATS = 'blitzpit_stats';
const STORAGE_KEY_LEADERBOARD = 'blitzpit_leaderboard';
const STORAGE_KEY_KP = 'blitzpit_kp';
const MAX_LEADERBOARD_ENTRIES = 20;

export class ScoreboardSystem {
  stats: PlayerStats;
  private leaderboard: LeaderboardEntry[];
  private killStreakTimer = 0;
  killPoints = 0;

  constructor() {
    this.stats = this.defaultStats();
    this.leaderboard = [];
    this.loadFromLocalStorage();
  }

  addKillPoints(amount: number): void {
    this.killPoints += amount;
    this.saveToLocalStorage();
  }

  getKillPoints(): number {
    return this.killPoints;
  }

  private defaultStats(): PlayerStats {
    return {
      totalKills: 0,
      currentWave: 1,
      highestWave: 0,
      survivalTime: 0,
      gamesPlayed: 0,
      bestKillStreak: 0,
      currentKillStreak: 0,
      headshotCount: 0,
    };
  }

  recordKill(isHeadshot: boolean): void {
    this.stats.totalKills++;
    this.stats.currentKillStreak++;
    this.killStreakTimer = KILL_STREAK_TIMEOUT;

    if (isHeadshot) {
      this.stats.headshotCount++;
    }

    if (this.stats.currentKillStreak > this.stats.bestKillStreak) {
      this.stats.bestKillStreak = this.stats.currentKillStreak;
    }
  }

  updateStreakTimer(delta: number): void {
    if (this.killStreakTimer > 0) {
      this.killStreakTimer -= delta;
      if (this.killStreakTimer <= 0) {
        this.stats.currentKillStreak = 0;
      }
    }
  }

  resetStreak(): void {
    this.stats.currentKillStreak = 0;
    this.killStreakTimer = 0;
  }

  updateWave(wave: number): void {
    this.stats.currentWave = wave;
    if (wave > this.stats.highestWave) {
      this.stats.highestWave = wave;
    }
  }

  updateSurvivalTime(delta: number): void {
    this.stats.survivalTime += delta;
  }

  endGame(): void {
    this.stats.gamesPlayed++;
    const entry: LeaderboardEntry = {
      name: (typeof localStorage !== 'undefined' && localStorage.getItem('blitzpit_name')) || 'Player',
      wave: this.stats.currentWave,
      kills: this.stats.totalKills,
      time: Math.floor(this.stats.survivalTime),
      date: new Date().toLocaleDateString(),
    };
    this.leaderboard.push(entry);
    this.leaderboard.sort((a, b) => b.wave - a.wave || b.kills - a.kills);
    if (this.leaderboard.length > MAX_LEADERBOARD_ENTRIES) {
      this.leaderboard = this.leaderboard.slice(0, MAX_LEADERBOARD_ENTRIES);
    }
    this.saveToLocalStorage();
  }

  resetForNewGame(): void {
    this.stats.totalKills = 0;
    this.stats.currentWave = 1;
    this.stats.survivalTime = 0;
    this.stats.currentKillStreak = 0;
    this.killStreakTimer = 0;
  }

  getLeaderboard(): LeaderboardEntry[] {
    return [...this.leaderboard];
  }

  getRank(wave: number, _kills: number): string {
    let rank = 'Rookie';
    for (const [threshold, label] of RANK_THRESHOLDS) {
      if (wave >= threshold) {
        rank = label;
      } else {
        break;
      }
    }
    return rank;
  }

  getKillStreakLabel(streak: number): string | null {
    const exactLabel = KILL_STREAK_LABELS[streak];
    return exactLabel || null;
  }

  saveToLocalStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(this.stats));
      localStorage.setItem(STORAGE_KEY_LEADERBOARD, JSON.stringify(this.leaderboard));
      localStorage.setItem(STORAGE_KEY_KP, String(this.killPoints));
    } catch {
      // localStorage may not be available in all environments
    }
  }

  loadFromLocalStorage(): void {
    try {
      const statsStr = localStorage.getItem(STORAGE_KEY_STATS);
      if (statsStr) {
        const loaded = JSON.parse(statsStr) as Partial<PlayerStats>;
        this.stats = { ...this.defaultStats(), ...loaded };
        // Reset per-session fields
        this.stats.currentKillStreak = 0;
        this.stats.currentWave = 1;
        this.stats.totalKills = 0;
        this.stats.survivalTime = 0;
      }
      const lbStr = localStorage.getItem(STORAGE_KEY_LEADERBOARD);
      if (lbStr) {
        this.leaderboard = JSON.parse(lbStr) as LeaderboardEntry[];
      }
      const kpStr = localStorage.getItem(STORAGE_KEY_KP);
      if (kpStr) {
        const parsed = parseInt(kpStr, 10);
        if (!isNaN(parsed)) this.killPoints = parsed;
      }
    } catch {
      // localStorage may not be available
    }
  }
}
