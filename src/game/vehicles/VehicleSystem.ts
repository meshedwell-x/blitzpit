import * as THREE from 'three';
import { WorldGenerator } from '../world/WorldGenerator';
import { PlayerController } from '../player/PlayerController';

export interface Vehicle {
  id: string;
  type: 'jeep' | 'buggy' | 'truck';
  position: THREE.Vector3;
  rotation: number; // yaw
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
      const x = (rand() - 0.5) * 300;
      const z = (rand() - 0.5) * 300;
      const h = this.world.getHeightAt(x, z);
      if (h <= 5) continue; // skip water

      const type = types[Math.floor(rand() * types.length)];
      const mesh = this.createVehicleMesh(type);
      mesh.position.set(x, h + 0.8, z);
      mesh.rotation.y = rand() * Math.PI * 2;
      this.scene.add(mesh);

      this.vehicles.push({
        id: `vehicle_${i}`,
        type,
        position: new THREE.Vector3(x, h + 0.8, z),
        rotation: mesh.rotation.y,
        speed: 0,
        maxSpeed: type === 'truck' ? 18 : type === 'jeep' ? 25 : 30,
        health: type === 'truck' ? 200 : 150,
        mesh,
        isOccupied: false,
        occupantId: null,
        fuel: 100,
        headlight: null,
      });
    }
  }

  private createVehicleMesh(type: Vehicle['type']): THREE.Group {
    const group = new THREE.Group();

    if (type === 'jeep') {
      // Body
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.0, 3.5),
        new THREE.MeshLambertMaterial({ color: 0x4a6a3a })
      );
      body.position.y = 0.8;
      body.castShadow = true;
      group.add(body);

      // Cabin frame
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.8, 1.5),
        new THREE.MeshLambertMaterial({ color: 0x3a5a2a })
      );
      cabin.position.set(0, 1.5, -0.3);
      group.add(cabin);

      // Windshield
      const windshield = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.7, 0.1),
        new THREE.MeshLambertMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.5 })
      );
      windshield.position.set(0, 1.5, -1.0);
      windshield.rotation.x = -0.2;
      group.add(windshield);

      // Wheels
      this.addWheels(group, 1.0, 1.2, 0x222222);

      // Roll bar
      const rollBar = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 0.08, 0.08),
        new THREE.MeshLambertMaterial({ color: 0x333333 })
      );
      rollBar.position.set(0, 2.0, 0.5);
      group.add(rollBar);

    } else if (type === 'buggy') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.6, 2.8),
        new THREE.MeshLambertMaterial({ color: 0xcc6600 })
      );
      body.position.y = 0.7;
      body.castShadow = true;
      group.add(body);

      // Open top frame
      const frame1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 1.0, 0.08),
        new THREE.MeshLambertMaterial({ color: 0x333333 })
      );
      frame1.position.set(-0.8, 1.2, -0.5);
      group.add(frame1);
      const frame2 = frame1.clone();
      frame2.position.x = 0.8;
      group.add(frame2);

      this.addWheels(group, 0.9, 1.0, 0x222222);

    } else { // truck
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 1.5, 5.0),
        new THREE.MeshLambertMaterial({ color: 0x5a5a4a })
      );
      body.position.y = 1.2;
      body.castShadow = true;
      group.add(body);

      // Cabin
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 1.2, 2.0),
        new THREE.MeshLambertMaterial({ color: 0x4a4a3a })
      );
      cabin.position.set(0, 2.2, -1.5);
      group.add(cabin);

      // Windshield
      const ws = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.9, 0.1),
        new THREE.MeshLambertMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.5 })
      );
      ws.position.set(0, 2.3, -2.5);
      group.add(ws);

      // Cargo bed
      const cargo = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 0.8, 2.5),
        new THREE.MeshLambertMaterial({ color: 0x6a6a5a })
      );
      cargo.position.set(0, 1.8, 1.2);
      group.add(cargo);

      this.addWheels(group, 1.3, 1.8, 0x222222);
    }

    return group;
  }

  private addWheels(group: THREE.Group, offsetX: number, offsetZ: number, color: number): void {
    const wheelGeo = new THREE.BoxGeometry(0.3, 0.6, 0.6);
    const wheelMat = new THREE.MeshLambertMaterial({ color });

    const positions = [
      [-offsetX - 0.15, 0.3, -offsetZ],
      [offsetX + 0.15, 0.3, -offsetZ],
      [-offsetX - 0.15, 0.3, offsetZ],
      [offsetX + 0.15, 0.3, offsetZ],
    ];

    for (const p of positions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(p[0], p[1], p[2]);
      group.add(wheel);
    }
  }

  private toggleVehicle(): void {
    if (this.playerVehicle) {
      // Exit vehicle
      this.playerVehicle.isOccupied = false;
      this.playerVehicle.occupantId = null;
      this.playerVehicle.speed = 0;

      // Place player next to vehicle
      const exitOffset = new THREE.Vector3(2.5, 0, 0);
      exitOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerVehicle.rotation);
      this.player.state.position.copy(this.playerVehicle.position).add(exitOffset);
      this.player.mesh.visible = true;
      this.playerVehicle = null;
      return;
    }

    // Try enter nearest vehicle
    for (const v of this.vehicles) {
      if (v.isOccupied || v.health <= 0) continue;
      const dist = this.player.state.position.distanceTo(v.position);
      if (dist < 4) {
        v.isOccupied = true;
        v.occupantId = 'player';
        this.playerVehicle = v;
        this.player.mesh.visible = false;
        break;
      }
    }
  }

  update(delta: number): void {
    if (!this.playerVehicle) return;

    const v = this.playerVehicle;
    const accel = 15;
    const turnSpeed = 2.5;
    const friction = 0.95;

    // Honk cooldown
    if (this.honkCooldown > 0) this.honkCooldown -= delta;

    // Controls -- exponential acceleration
    if (this.keys.has('KeyW')) {
      const targetSpeed = v.maxSpeed;
      v.speed += (targetSpeed - v.speed) * accel * delta * 0.15;
    } else if (this.keys.has('KeyS')) {
      const targetSpeed = -v.maxSpeed * 0.3;
      v.speed += (targetSpeed - v.speed) * accel * delta * 0.2;
    } else {
      // Friction deceleration (exponential)
      v.speed *= Math.pow(friction, delta * 60);
      if (Math.abs(v.speed) < 0.3) v.speed = 0;
    }

    if (this.keys.has('KeyA')) v.rotation += turnSpeed * delta * (v.speed > 0 ? 1 : -1);
    if (this.keys.has('KeyD')) v.rotation -= turnSpeed * delta * (v.speed > 0 ? 1 : -1);

    // Calculate new position
    const newX = v.position.x - Math.sin(v.rotation) * v.speed * delta;
    const newZ = v.position.z - Math.cos(v.rotation) * v.speed * delta;

    // Building collision check BEFORE moving
    const buildings = this.world.getNearbyBuildings(newX, newZ);
    let blocked = false;
    for (const b of buildings) {
      if (newX > b.x - 2 && newX < b.x + b.width + 2 &&
          newZ > b.z - 2 && newZ < b.z + b.depth + 2) {
        blocked = true;
        v.speed = 0;
        break;
      }
    }

    if (!blocked) {
      v.position.x = newX;
      v.position.z = newZ;
    }

    // Ground height
    const groundH = this.world.getHeightAt(v.position.x, v.position.z);
    v.position.y = groundH + 0.8;

    // Slope physics -- uphill deceleration, downhill acceleration
    const aheadX = v.position.x - Math.sin(v.rotation) * 2;
    const aheadZ = v.position.z - Math.cos(v.rotation) * 2;
    const aheadH = this.world.getHeightAt(aheadX, aheadZ);
    const slope = (aheadH - groundH) / 2; // -1 to +1
    v.speed -= slope * 15 * delta;
    // Steep slope (>45 deg) blocks climbing
    if (slope > 0.7 && v.speed < 3) {
      v.speed = Math.max(v.speed, -1);
    }

    // Fuel
    if (v.speed !== 0) {
      v.fuel -= Math.abs(v.speed) * delta * 0.05;
      if (v.fuel <= 0) {
        v.fuel = 0;
        v.speed = 0;
      }
    }

    // Update mesh
    v.mesh.position.copy(v.position);
    v.mesh.rotation.y = v.rotation;

    // Wheel rotation -- spin based on speed
    const childCount = v.mesh.children.length;
    for (let wi = Math.max(0, childCount - 4); wi < childCount; wi++) {
      const wheel = v.mesh.children[wi];
      if (wheel) wheel.rotation.x += v.speed * delta * 0.5;
    }

    // Visual suspension -- tilt based on terrain slope
    const frontH = this.world.getHeightAt(
      v.position.x - Math.sin(v.rotation) * 1.5,
      v.position.z - Math.cos(v.rotation) * 1.5
    );
    const backH = this.world.getHeightAt(
      v.position.x + Math.sin(v.rotation) * 1.5,
      v.position.z + Math.cos(v.rotation) * 1.5
    );
    const targetPitch = Math.atan2(backH - frontH, 3.0);
    v.mesh.rotation.x += (targetPitch - v.mesh.rotation.x) * delta * 5;

    // Player follows vehicle
    this.player.state.position.copy(v.position);
    this.player.state.position.y += 1.5;

    // Vehicle destruction check
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

  setNightMode(isNight: boolean): void {
    // Only add headlight to player's vehicle (1 light max for performance)
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

  isPlayerInVehicle(): boolean {
    return this.playerVehicle !== null;
  }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  }
}
