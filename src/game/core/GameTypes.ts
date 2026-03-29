export type GamePhase = 'lobby' | 'plane' | 'dropping' | 'playing' | 'wave_transition' | 'dead';

export interface GameState {
  phase: GamePhase;
  playersAlive: number;
  kills: number;
  gameTime: number;
  currentWave: number;
  totalKills: number;
  killStreak: number;
  bestKillStreak: number;
}
