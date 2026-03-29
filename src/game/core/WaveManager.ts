import { WAVE_TRANSITION_DURATION } from './constants';

export interface WaveInfo {
  wave: number;
  botsTotal: number;
  botsRemaining: number;
  difficulty: number;
  waveStartTime: number;
}

export interface WaveConfig {
  botCount: number;
  botSkillMin: number;
  botSkillMax: number;
  zoneShrinkSpeedMultiplier: number;
  botArmorChance: number;
  botWeaponChance: number;
  scoreMultiplier: number;
}

export class WaveManager {
  currentWave = 0;
  transitionTimer = 0;
  isTransitioning = false;
  private transitionDuration = WAVE_TRANSITION_DURATION;
  private waveStartTime = 0;
  private botsTotal = 0;

  getWaveConfig(wave: number): WaveConfig {
    // Wave-based weapon chance: Wave1=0%, Wave2=20%, Wave3+=30%+wave*5%, Wave5+=50%+
    let botWeaponChance: number;
    if (wave <= 1) {
      botWeaponChance = 0;
    } else if (wave === 2) {
      botWeaponChance = 0.2;
    } else if (wave >= 5) {
      botWeaponChance = Math.min(0.5 + (wave - 5) * 0.05, 0.95);
    } else {
      botWeaponChance = Math.min(0.3 + wave * 0.05, 0.5);
    }

    return {
      botCount: Math.min(39 + wave * 5, 80),
      botSkillMin: Math.min(0.3 + wave * 0.05, 0.7),
      botSkillMax: Math.min(0.7 + wave * 0.05, 1.0),
      zoneShrinkSpeedMultiplier: 1 + wave * 0.1,
      botArmorChance: Math.min(0.3 + wave * 0.05, 0.8),
      botWeaponChance,
      scoreMultiplier: 1 + wave * 0.5,
    };
  }

  getLootingTime(wave: number): number {
    if (wave <= 1) return 15 + Math.random() * 15; // 15-30s
    if (wave === 2) return 10 + Math.random() * 5;  // 10-15s
    if (wave >= 5) return 3 + Math.random() * 2;    // 3-5s
    return 8 + Math.random() * 2;                   // 8-10s
  }

  startTransition(): void {
    this.isTransitioning = true;
    this.transitionTimer = this.transitionDuration;
  }

  updateTransition(delta: number): boolean {
    if (!this.isTransitioning) return false;
    this.transitionTimer -= delta;
    if (this.transitionTimer <= 0) {
      this.isTransitioning = false;
      this.transitionTimer = 0;
      return true;
    }
    return false;
  }

  nextWave(): number {
    this.currentWave++;
    this.waveStartTime = Date.now();
    const config = this.getWaveConfig(this.currentWave);
    this.botsTotal = config.botCount;
    return this.currentWave;
  }

  getWaveInfo(botsRemaining: number): WaveInfo {
    return {
      wave: this.currentWave,
      botsTotal: this.botsTotal,
      botsRemaining,
      difficulty: this.currentWave,
      waveStartTime: this.waveStartTime,
    };
  }
}
