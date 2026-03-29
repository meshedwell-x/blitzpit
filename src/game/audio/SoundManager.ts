import * as THREE from 'three';

export class SoundManager {
  private ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
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

  // Distance attenuation: returns 0..1 volume based on distance
  getDistanceVolume(listenerPos: THREE.Vector3, sourcePos: THREE.Vector3, maxRange: number): number {
    const dist = listenerPos.distanceTo(sourcePos);
    if (dist >= maxRange) return 0;
    return Math.pow(1 - dist / maxRange, 1.5);
  }

  // Stereo panning: -1 (left) to 1 (right) based on relative angle
  getStereoPan(listenerPos: THREE.Vector3, listenerYaw: number, sourcePos: THREE.Vector3): number {
    const dx = sourcePos.x - listenerPos.x;
    const dz = sourcePos.z - listenerPos.z;
    const angle = Math.atan2(dx, dz) - listenerYaw;
    return Math.sin(angle);
  }

  // Internal gunshot with volume + pan params
  private playGunshotInternal(weaponType: string, volume: number = 1.0, pan: number = 0): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;
    try {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      panner.connect(this.masterGain);

      const playNoiseWithPan = (duration: number, gainValue: number, lowpassFreq: number) => {
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = lowpassFreq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(gainValue * volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        source.start(ctx.currentTime);
      };

      const playToneWithPan = (frequency: number, duration: number, type: OscillatorType, gainValue: number, startFreq?: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(startFreq ?? frequency, ctx.currentTime);
        if (startFreq !== undefined) {
          osc.frequency.linearRampToValueAtTime(frequency, ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(gainValue * volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(panner);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      };

      switch (weaponType) {
        case 'pistol':
          playNoiseWithPan(0.05, 0.25, 600);
          playToneWithPan(180, 0.05, 'square', 0.15);
          break;
        case 'shotgun':
          playNoiseWithPan(0.12, 0.5, 300);
          playToneWithPan(80, 0.12, 'sawtooth', 0.3);
          break;
        case 'smg':
          playNoiseWithPan(0.04, 0.18, 800);
          playToneWithPan(220, 0.04, 'square', 0.1);
          break;
        case 'assault':
          playNoiseWithPan(0.07, 0.3, 500);
          playToneWithPan(140, 0.07, 'sawtooth', 0.2);
          break;
        case 'sniper':
          playNoiseWithPan(0.08, 0.2, 200);
          playToneWithPan(60, 0.15, 'sawtooth', 0.4);
          break;
        default:
          playNoiseWithPan(0.06, 0.2, 600);
          break;
      }
    } catch {
      // ignore
    }
  }

  // Player's own gunshot -- full volume, center pan
  playGunshot(weaponType: string): void {
    this.playGunshotInternal(weaponType, 1.0, 0);
  }

  // 3D gunshot for bots/remote sources -- distance attenuation + stereo pan
  playGunshot3D(weaponType: string, sourcePos: THREE.Vector3, listenerPos: THREE.Vector3, listenerYaw: number): void {
    const maxRange = 200;
    const vol = this.getDistanceVolume(listenerPos, sourcePos, maxRange);
    if (vol <= 0) return;
    const pan = this.getStereoPan(listenerPos, listenerYaw, sourcePos);
    this.playGunshotInternal(weaponType, vol, pan);
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

  // 3D footstep for nearby bots with distance attenuation + stereo pan
  playFootstep3D(terrain: string, volume: number, pan: number): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;
    try {
      const defs: Record<string, { freq: number; dur: number }> = {
        grass:    { freq: 300,  dur: 0.06 },
        sand:     { freq: 200,  dur: 0.08 },
        concrete: { freq: 1200, dur: 0.03 },
        snow:     { freq: 2000, dur: 0.04 },
        water:    { freq: 500,  dur: 0.1  },
        default:  { freq: 400,  dur: 0.06 },
      };
      const d = defs[terrain] || defs.default;
      const bufferSize = Math.floor(ctx.sampleRate * d.dur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = d.freq;
      const gain = ctx.createGain();
      gain.gain.value = volume * 0.06;
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      src.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.masterGain);
      src.start();
    } catch {
      // ignore
    }
  }

  playKillStreak(level: number): void {
    const baseFreq = 400 + level * 80;
    const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.2, 'triangle', 0.3), i * 70);
    });
  }

  playHorn(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playTone(350, 0.5, 'triangle', 0.3);
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
