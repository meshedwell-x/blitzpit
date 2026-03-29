/**
 * Gunshot sound generation per weapon type.
 * Extracted from SoundManager to keep it under 350 lines.
 */

interface GunshotDeps {
  ctx: AudioContext;
  masterGain: GainNode;
}

export function playGunshotSound(
  deps: GunshotDeps,
  weaponType: string,
  volume: number = 1.0,
  pan: number = 0,
): void {
  const { ctx, masterGain } = deps;
  try {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(masterGain);

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

export function playFootstep3DSound(
  deps: GunshotDeps,
  terrain: string,
  volume: number,
  pan: number,
): void {
  const { ctx, masterGain } = deps;
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
    panner.connect(masterGain);
    src.start();
  } catch {
    // ignore
  }
}
