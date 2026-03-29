export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private vehicleOscillator: OscillatorNode | null = null;
  private vehicleGain: GainNode | null = null;
  private rainOsc: OscillatorNode | null = null;
  private rainGain: GainNode | null = null;

  constructor() {
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.4;
      this.masterGain.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  private getCtx(): AudioContext | null {
    if (!this.ctx || this.muted) return null;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainValue = 0.3,
    startFreq?: number
  ): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(startFreq ?? frequency, ctx.currentTime);
      if (startFreq !== undefined) {
        osc.frequency.linearRampToValueAtTime(frequency, ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // AudioContext may not be available
    }
  }

  private playNoise(duration: number, gainValue = 0.2, lowpassFreq = 1000): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;
    try {
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpassFreq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      source.start(ctx.currentTime);
    } catch {
      // AudioContext may not be available
    }
  }

  playGunshot(weaponType: string): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;
    try {
      switch (weaponType) {
        case 'pistol':
          this.playNoise(0.05, 0.25, 600);
          this.playTone(180, 0.05, 'square', 0.15);
          break;
        case 'shotgun':
          this.playNoise(0.12, 0.5, 300);
          this.playTone(80, 0.12, 'sawtooth', 0.3);
          break;
        case 'smg':
          this.playNoise(0.04, 0.18, 800);
          this.playTone(220, 0.04, 'square', 0.1);
          break;
        case 'assault':
          this.playNoise(0.07, 0.3, 500);
          this.playTone(140, 0.07, 'sawtooth', 0.2);
          break;
        case 'sniper':
          this.playNoise(0.08, 0.2, 200);
          this.playTone(60, 0.15, 'sawtooth', 0.4);
          break;
        default:
          this.playNoise(0.06, 0.2, 600);
          break;
      }
    } catch {
      // ignore
    }
  }

  playExplosion(): void {
    this.playNoise(0.4, 0.6, 250);
    this.playTone(60, 0.3, 'sawtooth', 0.5);
  }

  playPickup(): void {
    this.playTone(1200, 0.1, 'sine', 0.2, 800);
  }

  playDamageTaken(): void {
    this.playNoise(0.08, 0.3, 400);
    this.playTone(150, 0.08, 'square', 0.2);
  }

  playKillConfirm(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;
    try {
      const notes = [523, 659, 784];
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.15, 'triangle', 0.25), i * 60);
      });
    } catch {
      // ignore
    }
  }

  playWaveStart(): void {
    // Rising siren-like
    this.playTone(300, 1.0, 'sawtooth', 0.3, 150);
    setTimeout(() => this.playTone(200, 0.5, 'sawtooth', 0.2, 400), 400);
  }

  playWaveComplete(): void {
    const fanfare = [523, 659, 784, 1047];
    fanfare.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.25, 'triangle', 0.3), i * 80);
    });
  }

  playZoneWarning(): void {
    this.playTone(110, 0.5, 'sawtooth', 0.2);
    setTimeout(() => this.playTone(110, 0.5, 'sawtooth', 0.2), 600);
  }

  playHeadshot(): void {
    this.playNoise(0.04, 0.4, 800);
    this.playTone(1400, 0.12, 'triangle', 0.3);
  }

  playFootstep(terrain: string): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const defs: Record<string, { freq: number; dur: number; gain: number }> = {
      grass:    { freq: 300,  dur: 0.06, gain: 0.06 },
      sand:     { freq: 200,  dur: 0.08, gain: 0.05 },
      concrete: { freq: 1200, dur: 0.03, gain: 0.08 },
      snow:     { freq: 2000, dur: 0.04, gain: 0.04 },
      water:    { freq: 500,  dur: 0.1,  gain: 0.07 },
      default:  { freq: 400,  dur: 0.06, gain: 0.06 },
    };
    const d = defs[terrain] || defs.default;
    this.playNoise(d.dur, d.gain, d.freq);
  }

  playKillStreak(level: number): void {
    const baseFreq = 400 + level * 80;
    const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.2, 'triangle', 0.3), i * 70);
    });
  }

  playVehicleEngine(speed: number): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;
    try {
      if (!this.vehicleOscillator) {
        this.vehicleOscillator = ctx.createOscillator();
        this.vehicleGain = ctx.createGain();
        this.vehicleOscillator.type = 'sawtooth';
        this.vehicleOscillator.connect(this.vehicleGain);
        this.vehicleGain.connect(this.masterGain);
        this.vehicleGain.gain.value = 0.05;
        this.vehicleOscillator.start();
      }
      const freq = 60 + Math.abs(speed) * 3;
      this.vehicleOscillator.frequency.setTargetAtTime(freq, ctx.currentTime, 0.1);
      if (this.vehicleGain) {
        this.vehicleGain.gain.setTargetAtTime(speed !== 0 ? 0.05 : 0, ctx.currentTime, 0.1);
      }
    } catch {
      // ignore
    }
  }

  playRainAmbient(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain || this.rainOsc) return;
    try {
      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0.03;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      src.connect(filter);
      filter.connect(this.rainGain);
      this.rainGain.connect(this.masterGain);
      src.start();
      this.rainOsc = src as unknown as OscillatorNode;
    } catch {
      // ignore
    }
  }

  stopRainAmbient(): void {
    if (this.rainOsc) {
      try { (this.rainOsc as unknown as AudioBufferSourceNode).stop(); } catch {}
      this.rainOsc = null;
      this.rainGain = null;
    }
  }

  stopVehicleEngine(): void {
    if (this.vehicleOscillator) {
      try {
        this.vehicleOscillator.stop();
      } catch {
        // ignore
      }
      this.vehicleOscillator = null;
      this.vehicleGain = null;
    }
  }

  setVolume(v: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, v));
    }
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : 0.4;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  destroy(): void {
    this.stopVehicleEngine();
    this.stopRainAmbient();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
