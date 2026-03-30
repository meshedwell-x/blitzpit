import * as THREE from 'three';

export type TimePeriod = 'deep_night' | 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night';

export class DayNightSystem {
  private scene: THREE.Scene;
  private sunLight: THREE.DirectionalLight | null = null;
  private ambientLight: THREE.AmbientLight | null = null;
  timeOfDay = 0.3; // 0~1 (0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset)
  private daySpeed = 0.002; // 500 seconds (~8 minutes) per full day cycle
  isNight = false;

  // Temp colors reused each frame to avoid per-frame allocations
  private readonly _tempColor = new THREE.Color();
  private readonly _tempSunColor = new THREE.Color();
  private readonly _tempAmbientColor = new THREE.Color();
  private readonly _tempSkyColor = new THREE.Color();

  private readonly LIGHTING_TABLE: Record<TimePeriod, {
    sunIntensity: number; ambientIntensity: number; ambientColor: number;
    sunColor: number; skyColor: number; fogDensity: number;
  }> = {
    deep_night: { sunIntensity: 0.05, ambientIntensity: 0.08, ambientColor: 0x112244, sunColor: 0x223355, skyColor: 0x050510, fogDensity: 0.003 },
    dawn:       { sunIntensity: 0.4,  ambientIntensity: 0.3,  ambientColor: 0x8866aa, sunColor: 0xff8844, skyColor: 0x4a3066, fogDensity: 0.0025 },
    morning:    { sunIntensity: 1.0,  ambientIntensity: 0.55, ambientColor: 0xffeedd, sunColor: 0xffaa66, skyColor: 0xff9944, fogDensity: 0.0018 },
    noon:       { sunIntensity: 1.4,  ambientIntensity: 0.7,  ambientColor: 0xffffff, sunColor: 0xfff5e0, skyColor: 0x87ceeb, fogDensity: 0.0015 },
    afternoon:  { sunIntensity: 1.0,  ambientIntensity: 0.6,  ambientColor: 0xffeedd, sunColor: 0xffcc88, skyColor: 0x87ceeb, fogDensity: 0.0016 },
    dusk:       { sunIntensity: 0.4,  ambientIntensity: 0.3,  ambientColor: 0xcc6644, sunColor: 0xff5522, skyColor: 0xff5522, fogDensity: 0.002 },
    night:      { sunIntensity: 0.1,  ambientIntensity: 0.12, ambientColor: 0x223355, sunColor: 0x334466, skyColor: 0x0a0a1a, fogDensity: 0.0028 },
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.children.forEach(c => {
      if (c instanceof THREE.DirectionalLight) this.sunLight = c;
      if (c instanceof THREE.AmbientLight) this.ambientLight = c;
    });
  }

  getTimePeriod(): TimePeriod {
    const t = this.timeOfDay;
    if (t < 0.15) return 'deep_night';
    if (t < 0.25) return 'dawn';
    if (t < 0.35) return 'morning';
    if (t < 0.60) return 'noon';
    if (t < 0.72) return 'afternoon';
    if (t < 0.82) return 'dusk';
    return 'night';
  }

  update(delta: number): void {
    this.timeOfDay = (this.timeOfDay + this.daySpeed * delta) % 1.0;
    this.isNight = this.timeOfDay < 0.2 || this.timeOfDay > 0.8;

    const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle) * 150;

    if (this.sunLight) {
      this.sunLight.position.set(sunX, Math.max(10, sunHeight * 150), 80);
    }

    const period = this.getTimePeriod();
    const target = this.LIGHTING_TABLE[period];
    const lerpRate = delta * 2;

    if (this.sunLight) {
      this.sunLight.intensity += (target.sunIntensity - this.sunLight.intensity) * lerpRate;
      this._tempSunColor.setHex(target.sunColor);
      this.sunLight.color.lerp(this._tempSunColor, lerpRate);
    }

    if (this.ambientLight) {
      this.ambientLight.intensity += (target.ambientIntensity - this.ambientLight.intensity) * lerpRate;
      this._tempAmbientColor.setHex(target.ambientColor);
      this.ambientLight.color.lerp(this._tempAmbientColor, lerpRate);
    }

    if (this.scene.background instanceof THREE.Color) {
      this._tempSkyColor.setHex(target.skyColor);
      this.scene.background.lerp(this._tempSkyColor, lerpRate);
    } else {
      this.scene.background = new THREE.Color(target.skyColor);
    }

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density += (target.fogDensity - this.scene.fog.density) * lerpRate;
    }
  }

  getTimeString(): string {
    const hours = Math.floor(this.timeOfDay * 24);
    const mins = Math.floor((this.timeOfDay * 24 - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  destroy(): void {}
}
