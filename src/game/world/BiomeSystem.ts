export type BiomeType = 'jungle' | 'desert' | 'tundra' | 'urban';

export class BiomeSystem {
  getBiome(x: number, z: number): BiomeType {
    const dist = Math.sqrt(x * x + z * z);
    if (dist < 100) return 'urban';

    const angle = Math.atan2(z, x);
    if (angle > 0 && angle < Math.PI * 0.6) return 'tundra';
    if (angle < 0 && angle > -Math.PI * 0.6) return 'desert';
    if (x < 0) return 'jungle';
    return 'urban';
  }

  getSpeedMultiplier(biome: BiomeType): number {
    switch (biome) {
      case 'jungle': return 0.8;
      case 'tundra': return 0.7;
      case 'desert': return 0.9;
      case 'urban': return 1.0;
    }
  }

  getEnvironmentDamage(biome: BiomeType, isNight: boolean, delta: number): number {
    if (biome === 'desert' && !isNight) return 0.3 * delta;
    if (biome === 'tundra' && isNight) return 0.5 * delta;
    return 0;
  }

  getBiomeColor(biome: BiomeType): number {
    switch (biome) {
      case 'jungle': return 0x1a4a12;
      case 'desert': return 0xe8c878;
      case 'tundra': return 0xf0f0f5;
      case 'urban': return 0x5ba34d;
    }
  }
}
