import * as THREE from 'three';
import { WorldGenerator } from '../world/WorldGenerator';
import { PlayerController } from '../player/PlayerController';
import { createVehicleMesh } from './VehicleMesh';

export interface Vehicle {
  id: string;
  type: 'jeep' | 'buggy' | 'truck' | 'helicopter';
  position: THREE.Vector3;
  rotation: number;
  speed: number;
  maxSpeed: number;
  health: number;
  mesh: THREE.Group;
  isOccupied: boolean;
  occupantId: string | null;
  fuel: number;
  headlight: THREE.PointLight | null;
}

export class VehicleSystem {
  private scene: THREE.Scene;
  private world: WorldGenerator;
  private player: PlayerController;
  vehicles: Vehicle[] = [];
  playerVehicle: Vehicle | null = null;
  private keys: Set<string> = new Set();
  private _onKeyDown: (e: KeyboardEvent) => void = () => {};
  private _onKeyUp: (e: KeyboardEvent) => void = () => {};
  private honkCooldown = 0;
  onHonk: (() => void) | null = null;
  onEnterVehicle: (() => void) | null = null;
  onExitVehicle: (() => void) | null = null;

  constructor(scene: THREE.Scene, world: WorldGenerator, player: PlayerController) {
    this.scene = scene;
    this.world = world;
    this.player = player;
  }

  init(): void {
    this._onKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.toggleVehicle();
      if (e.code === 'KeyH') this.honk();
    };
    this._onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  destroy(): void {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
  }

  private honk(): void {
    if (this.honkCooldown > 0 || !this.playerVehicle) return;
    this.honkCooldown = 1.5;
    if (this.onHonk) this.onHonk();
  }

  spawnVehicles(count: number = 12): void {
    const rand = this.seededRandom(54321);
    const types: Vehicle['type'][] = ['jeep', 'buggy', 'truck'];
    for (let i = 0; i < count; i++) {
      const x = (rand() - 0.5) * 1200;
      const z = (rand() - 0.5) * 1200;
      const h = this.world.getHeightAt(x, z);
      if (h <= 5) continue;
      const type = types[Math.floor(rand() * types.length)];
      const mesh = createVehicleMesh(type);
      mesh.position.set(x, h + 1.2, z);
      mesh.rotation.y = rand() * Math.PI * 2;
      this.scene.add(mesh);
      this.vehicles.push({
        id: `vehicle_${i}`, type,
        position: new THREE.Vector3(x, h + 1.2, z),
        rotation: mesh.rotation.y, speed: 0,
        maxSpeed: type === 'truck' ? 18 : type === 'jeep' ? 25 : 30,
        health: type === 'truck' ? 200 : 150,
        mesh, isOccupied: false, occupantId: null, fuel: 100, headlight: null,
      });
    }

    // Spawn 2 helicopters near map center (military area)
    const heliRand = this.seededRandom(99887);
    for (let i = 0; i < 2; i++) {
      const angle = (i / 2) * Math.PI * 2 + heliRand() * 0.5;
      const dist = 80 + heliRand() * 60;
      const hx = Math.cos(angle) * dist;
      const hz = Math.sin(angle) * dist;
      const hh = this.world.getHeightAt(hx, hz);
      if (hh <= 3) continue;
      const heliMesh = createVehicleMesh('helicopter');
      heliMesh.position.set(hx, hh + 2.5, hz);
      heliMesh.rotation.y = heliRand() * Math.PI * 2;
      this.scene.add(heliMesh);
      this.vehicles.push({
        id: `heli_${i}`, type: 'helicopter',
        position: new THREE.Vector3(hx, hh + 2.5, hz),
        rotation: heliMesh.rotation.y, speed: 0,
        maxSpeed: 35, health: 180,
        mesh: heliMesh, isOccupied: false, occupantId: null, fuel: 60, headlight: null,
      });
    }
  }

  private toggleVehicle(): void {
    if (this.playerVehicle) {
      this.playerVehicle.isOccupied = false;
      this.playerVehicle.occupantId = null;
      this.playerVehicle.speed = 0;
      const exitOffset = new THREE.Vector3(2.5, 0, 0);
      exitOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerVehicle.rotation);
      this.player.state.position.copy(this.playerVehicle.position).add(exitOffset);
      this.player.mesh.visible = true;
      this.playerVehicle = null;
      if (this.onExitVehicle) this.onExitVehicle();
      return;
    }
    for (const v of this.vehicles) {
      if (v.isOccupied || v.health <= 0) continue;
      const dist = this.player.state.position.distanceTo(v.position);
      if (dist < 4) {
        v.isOccupied = true;
        v.occupantId = 'player';
        this.playerVehicle = v;
        this.player.mesh.visible = false;
        if (this.onEnterVehicle) this.onEnterVehicle();
        break;
      }
    }
  }

  update(delta: number): void {
    if (!this.playerVehicle) return;
    const v = this.playerVehicle;
    if (this.honkCooldown > 0) this.honkCooldown -= delta;

    if (v.type === 'helicopter') {
      this.updateHelicopter(v, delta);
    } else {
      this.updateGroundVehicle(v, delta);
    }

    this.player.state.position.copy(v.position);
    this.player.state.position.y += 1.5;

    if (v.health <= 0) {
      v.isOccupied = false;
      v.occupantId = null;
      this.player.state.position.copy(v.position);
      this.player.state.position.y += 2;
      this.player.mesh.visible = true;
      this.player.takeDamage(30);
      this.playerVehicle = null;
    }
  }

  private updateHelicopter(v: Vehicle, delta: number): void {
    // Ascend / descend
    if (this.keys.has('Space')) {
      v.position.y += 12 * delta;
      v.fuel -= 0.15 * delta;
    }
    if (this.keys.has('KeyC') || this.keys.has('ControlLeft')) {
      v.position.y -= 10 * delta;
    }

    // Minimum altitude: ground + 2
    const groundH = this.world.getHeightAt(v.position.x, v.position.z);
    if (v.position.y < groundH + 2.5) v.position.y = groundH + 2.5;
    if (v.position.y > 100) v.position.y = 100;

    // Horizontal movement
    const moveSpeed = v.maxSpeed * 0.8;
    if (this.keys.has('KeyW')) {
      v.position.x -= Math.sin(v.rotation) * moveSpeed * delta;
      v.position.z -= Math.cos(v.rotation) * moveSpeed * delta;
      v.speed = moveSpeed;
    } else if (this.keys.has('KeyS')) {
      v.position.x += Math.sin(v.rotation) * moveSpeed * 0.5 * delta;
      v.position.z += Math.cos(v.rotation) * moveSpeed * 0.5 * delta;
      v.speed = -moveSpeed * 0.5;
    } else {
      v.speed *= 0.9;
    }
    if (this.keys.has('KeyA')) v.rotation += 2.5 * delta;
    if (this.keys.has('KeyD')) v.rotation -= 2.5 * delta;

    // Fuel consumption
    v.fuel -= Math.abs(v.speed) * delta * 0.1;
    if (v.fuel <= 0) { v.fuel = 0; v.position.y -= 5 * delta; }

    v.mesh.position.copy(v.position);
    v.mesh.rotation.y = v.rotation;

    // Rotor animation
    const mainRotor = v.mesh.getObjectByName('mainRotor');
    if (mainRotor) mainRotor.rotation.y += 15 * delta;
    const tailRotor = v.mesh.getObjectByName('tailRotor');
    if (tailRotor) tailRotor.rotation.x += 20 * delta;
  }

  private updateGroundVehicle(v: Vehicle, delta: number): void {
    const accel = 15;
    const turnSpeed = 2.5;
    const friction = 0.95;

    if (this.keys.has('KeyW')) {
      v.speed += (v.maxSpeed - v.speed) * accel * delta * 0.15;
    } else if (this.keys.has('KeyS')) {
      v.speed += (-v.maxSpeed * 0.3 - v.speed) * accel * delta * 0.2;
    } else {
      v.speed *= Math.pow(friction, delta * 60);
      if (Math.abs(v.speed) < 0.3) v.speed = 0;
    }
    if (this.keys.has('KeyA')) v.rotation += turnSpeed * delta * (v.speed > 0 ? 1 : -1);
    if (this.keys.has('KeyD')) v.rotation -= turnSpeed * delta * (v.speed > 0 ? 1 : -1);

    const newX = v.position.x - Math.sin(v.rotation) * v.speed * delta;
    const newZ = v.position.z - Math.cos(v.rotation) * v.speed * delta;
    const buildings = this.world.getNearbyBuildings(newX, newZ);
    let blocked = false;
    for (const b of buildings) {
      if (newX > b.x - 2 && newX < b.x + b.width + 2 && newZ > b.z - 2 && newZ < b.z + b.depth + 2) {
        blocked = true; v.speed = 0; break;
      }
    }
    if (!blocked) { v.position.x = newX; v.position.z = newZ; }

    const groundH = this.world.getHeightAt(v.position.x, v.position.z);
    v.position.y = groundH + 1.2;

    const aheadX = v.position.x - Math.sin(v.rotation) * 2;
    const aheadZ = v.position.z - Math.cos(v.rotation) * 2;
    const aheadH = this.world.getHeightAt(aheadX, aheadZ);
    const slope = (aheadH - groundH) / 2;
    v.speed -= slope * 15 * delta;
    if (slope > 0.7 && v.speed < 3) v.speed = Math.max(v.speed, -1);

    if (v.speed !== 0) {
      v.fuel -= Math.abs(v.speed) * delta * 0.05;
      if (v.fuel <= 0) { v.fuel = 0; v.speed = 0; }
    }

    v.mesh.position.copy(v.position);
    v.mesh.rotation.y = v.rotation;

    const childCount = v.mesh.children.length;
    for (let wi = Math.max(0, childCount - 4); wi < childCount; wi++) {
      const wheel = v.mesh.children[wi];
      if (wheel) wheel.rotation.x += v.speed * delta * 0.5;
    }

    const frontH = this.world.getHeightAt(
      v.position.x - Math.sin(v.rotation) * 1.5, v.position.z - Math.cos(v.rotation) * 1.5);
    const backH = this.world.getHeightAt(
      v.position.x + Math.sin(v.rotation) * 1.5, v.position.z + Math.cos(v.rotation) * 1.5);
    const targetPitch = Math.atan2(backH - frontH, 3.0);
    v.mesh.rotation.x += (targetPitch - v.mesh.rotation.x) * delta * 5;
  }

  setNightMode(isNight: boolean): void {
    if (this.playerVehicle) {
      if (isNight) {
        if (!this.playerVehicle.headlight) {
          const light = new THREE.PointLight(0xffee88, 1.5, 40);
          light.position.set(0, 1.5, -2);
          this.playerVehicle.mesh.add(light);
          this.playerVehicle.headlight = light;
        }
        this.playerVehicle.headlight.visible = true;
      } else {
        if (this.playerVehicle.headlight) this.playerVehicle.headlight.visible = false;
      }
    }
  }

  getGear(vehicle: Vehicle): number {
    const s = Math.abs(vehicle.speed);
    if (s < 0.5) return 0;
    if (s < 8) return 1;
    if (s < 16) return 2;
    if (s < 24) return 3;
    return 4;
  }

  isPlayerInVehicle(): boolean { return this.playerVehicle !== null; }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  }
}
