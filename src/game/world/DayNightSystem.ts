import * as THREE from 'three';

export class DayNightSystem {
  private scene: THREE.Scene;
  private sunLight: THREE.DirectionalLight | null = null;
  private ambientLight: THREE.AmbientLight | null = null;
  timeOfDay = 0.3; // 0~1 (0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset)
  private daySpeed = 0.01; // 100 seconds per full day cycle
  isNight = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.children.forEach(c => {
      if (c instanceof THREE.DirectionalLight) this.sunLight = c;
      if (c instanceof THREE.AmbientLight) this.ambientLight = c;
    });
  }

  update(delta: number): void {
    this.timeOfDay = (this.timeOfDay + this.daySpeed * delta) % 1.0;
    this.isNight = this.timeOfDay < 0.2 || this.timeOfDay > 0.8;

    const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle) * 150;

    if (this.sunLight) {
      this.sunLight.position.set(sunX, Math.max(10, sunHeight * 150), 80);
      const dayIntensity = Math.max(0.1, sunHeight);
      this.sunLight.intensity = dayIntensity * 1.4;

      if (sunHeight > 0.3) {
        this.sunLight.color.setHex(0xfff5e0);
      } else if (sunHeight > 0) {
        this.sunLight.color.setHex(0xff8844);
      } else {
        this.sunLight.color.setHex(0x334466);
        this.sunLight.intensity = 0.2;
      }
    }

    if (this.ambientLight) {
      if (this.isNight) {
        this.ambientLight.intensity = 0.15;
        this.ambientLight.color.setHex(0x223355);
      } else {
        this.ambientLight.intensity = 0.7;
        this.ambientLight.color.setHex(0xffffff);
      }
    }

    if (sunHeight > 0.3) {
      this.scene.background = new THREE.Color(0x87ceeb);
    } else if (sunHeight > 0) {
      const t = sunHeight / 0.3;
      const sky = new THREE.Color(0x87ceeb).lerp(new THREE.Color(0xff6633), 1 - t);
      this.scene.background = sky;
    } else {
      this.scene.background = new THREE.Color(0x0a0a1a);
    }
  }

  getTimeString(): string {
    const hours = Math.floor(this.timeOfDay * 24);
    const mins = Math.floor((this.timeOfDay * 24 - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  destroy(): void {}
}
