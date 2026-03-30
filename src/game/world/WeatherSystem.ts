import * as THREE from 'three';
import { BiomeType } from './BiomeSystem';

export type WeatherType = 'clear' | 'rain' | 'fog' | 'storm';

export class WeatherSystem {
  private scene: THREE.Scene;
  currentWeather: WeatherType = 'clear';
  private rainMesh: THREE.Points | null = null;
  private weatherTimer = 0;
  private weatherDuration = 0;
  private rainPositions: Float32Array;
  private rainCount = 3000;
  private lightningTimer = 0;
  lightningFlash = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.rainPositions = new Float32Array(this.rainCount * 3);
    this.initRain();
    this.cycleWeather('urban');
  }

  private initRain(): void {
    const geo = new THREE.BufferGeometry();
    for (let i = 0; i < this.rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 200;
      this.rainPositions[i * 3 + 1] = Math.random() * 100;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xaaaacc,
      size: 0.15,
      transparent: true,
      opacity: 0.6,
    });
    this.rainMesh = new THREE.Points(geo, mat);
    this.rainMesh.visible = false;
    this.scene.add(this.rainMesh);
  }

  update(delta: number, playerPos: THREE.Vector3, biome: BiomeType = 'urban'): void {
    // Weather transition timer
    this.weatherTimer -= delta;
    if (this.weatherTimer <= 0) {
      this.cycleWeather(biome);
    }

    const inTundra = biome === 'tundra';

    // Rain/snow update
    if (inTundra || this.currentWeather === 'rain' || this.currentWeather === 'storm') {
      if (this.rainMesh) {
        this.rainMesh.visible = true;
        this.rainMesh.position.set(playerPos.x, 0, playerPos.z);
        const mat = this.rainMesh.material as THREE.PointsMaterial;
        if (inTundra) {
          mat.color.setHex(0xffffff);
          mat.size = 0.25;
        } else {
          mat.color.setHex(0xaaaacc);
          mat.size = 0.15;
        }
        const positions = this.rainMesh.geometry.attributes.position;
        const arr = positions.array as Float32Array;
        const speed = inTundra ? 8 : (this.currentWeather === 'storm' ? 80 : 40);
        for (let i = 0; i < this.rainCount; i++) {
          arr[i * 3 + 1] -= speed * delta;
          if (arr[i * 3 + 1] < 0) {
            arr[i * 3 + 1] = 80 + Math.random() * 20;
            arr[i * 3] = (Math.random() - 0.5) * 200;
            arr[i * 3 + 2] = (Math.random() - 0.5) * 200;
          }
        }
        positions.needsUpdate = true;
      }
    } else {
      if (this.rainMesh) this.rainMesh.visible = false;
    }

    // Fog adjustment
    if (this.scene.fog instanceof THREE.FogExp2) {
      const targetDensity = this.currentWeather === 'fog' ? 0.004 :
                            this.currentWeather === 'storm' ? 0.003 :
                            this.currentWeather === 'rain' ? 0.002 : 0.0015;
      this.scene.fog.density += (targetDensity - this.scene.fog.density) * delta * 0.5;
    }

    // Lightning during storm
    if (this.currentWeather === 'storm') {
      this.lightningTimer -= delta;
      if (this.lightningTimer <= 0) {
        this.lightningFlash = true;
        this.lightningTimer = 5 + Math.random() * 15;
        setTimeout(() => { this.lightningFlash = false; }, 100);
      }
    }
  }

  private cycleWeather(biome: BiomeType): void {
    const weatherTables: Record<BiomeType, WeatherType[]> = {
      jungle: ['clear', 'clear', 'rain', 'rain', 'fog', 'storm'],
      desert: ['clear', 'clear', 'clear', 'clear', 'fog', 'storm'],
      tundra: ['clear', 'clear', 'fog', 'fog', 'storm', 'storm'],
      urban:  ['clear', 'clear', 'clear', 'rain', 'fog', 'storm'],
    };
    const table = weatherTables[biome] ?? weatherTables.urban;
    this.currentWeather = table[Math.floor(Math.random() * table.length)];
    this.weatherDuration = 120 + Math.random() * 180; // 120~300 seconds (2~5 minutes)
    this.weatherTimer = this.weatherDuration;
    // Reset lightning timer on weather change
    this.lightningTimer = 5 + Math.random() * 10;
    this.lightningFlash = false;
  }

  getWeatherInfo(): { type: WeatherType; timeLeft: number } {
    return { type: this.currentWeather, timeLeft: Math.ceil(this.weatherTimer) };
  }

  destroy(): void {
    if (this.rainMesh) {
      this.scene.remove(this.rainMesh);
      this.rainMesh.geometry.dispose();
      (this.rainMesh.material as THREE.Material).dispose();
      this.rainMesh = null;
    }
  }
}
