import * as THREE from 'three';
import { WEAPONS, WeaponDef } from '../core/constants';
import { PlayerController } from '../player/PlayerController';
import { WorldGenerator } from '../world/WorldGenerator';

export interface WeaponInstance {
  def: WeaponDef;
  currentAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
  reloadTimer: number;
  fireTimer: number;
}

interface Bullet {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  range: number;
  traveled: number;
  mesh: THREE.Mesh;
  ownerId: string;
}

interface ItemDrop {
  id: string;
  position: THREE.Vector3;
  type: string;
  weaponId?: string;
  mesh: THREE.Mesh;
  collected: boolean;
}

export class WeaponSystem {
  private scene: THREE.Scene;
  private player: PlayerController;
  private world: WorldGenerator | null = null;
  weapons: (WeaponInstance | null)[] = [null, null];
  activeSlot = 0;
  private bullets: Bullet[] = [];
  private isFiring = false;
  items: ItemDrop[] = [];
  private bulletGeometry: THREE.SphereGeometry;
  private bulletMaterial: THREE.MeshBasicMaterial;
  private weaponModel: THREE.Group;
  weatherSpreadMultiplier = 1.0;

  onFire: ((weaponType: string, position: THREE.Vector3, direction: THREE.Vector3) => void) | null = null;
  onBotFire: ((position: THREE.Vector3, direction: THREE.Vector3, weaponType: string) => void) | null = null;
  onPickup: ((position: THREE.Vector3, type: string) => void) | null = null;
  onMelee: ((position: THREE.Vector3) => void) | null = null;

  private meleeCooldown = 0;

  private _onMouseDown: (e: MouseEvent) => void = () => {};
  private _onMouseUp: (e: MouseEvent) => void = () => {};
  private _onKeyDown: (e: KeyboardEvent) => void = () => {};
  private _onWheel: (e: WheelEvent) => void = () => {};

  constructor(scene: THREE.Scene, player: PlayerController, world?: WorldGenerator) {
    this.scene = scene;
    this.player = player;
    if (world) this.world = world;
    this.bulletGeometry = new THREE.SphereGeometry(0.05, 4, 4);
    this.bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    this.weaponModel = this.createWeaponModel();
    scene.add(this.weaponModel);
  }

  private createWeaponModel(): THREE.Group {
    const group = new THREE.Group();

    // Simple box gun model
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    body.position.set(0, -0.05, -0.25);
    group.add(body);

    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    barrel.position.set(0, 0, -0.5);
    group.add(barrel);

    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.15, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x444444 })
    );
    grip.position.set(0, -0.14, -0.12);
    group.add(grip);

    return group;
  }

  init(): void {
    this._onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) this.isFiring = true;
    };
    this._onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) this.isFiring = false;
    };
    this._onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Digit1') this.activeSlot = 0;
      if (e.code === 'Digit2') this.activeSlot = 1;
      if (e.code === 'KeyR') this.reload();
      if (e.code === 'KeyF') this.tryPickup();
      if (e.code === 'KeyQ') this.dropWeapon();
      if (e.code === 'KeyV') this.meleeAttack();
    };
    this._onWheel = (e: WheelEvent) => {
      if (e.deltaY > 0) this.activeSlot = (this.activeSlot + 1) % 2;
      else this.activeSlot = (this.activeSlot - 1 + 2) % 2;
    };

    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('wheel', this._onWheel);
  }

  destroy(): void {
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('wheel', this._onWheel);
    // Clean up active bullets
    for (const bullet of this.bullets) {
      this.scene.remove(bullet.mesh);
    }
    this.bullets = [];
    // Clean up item meshes
    for (const item of this.items) {
      if (!item.collected) {
        this.scene.remove(item.mesh);
      }
    }
    this.items = [];
    // Dispose shared geometry/material
    this.bulletGeometry.dispose();
    this.bulletMaterial.dispose();
  }

  spawnItems(spawns: { position: THREE.Vector3; type: string; weaponId?: string }[]): void {
    for (const spawn of spawns) {
      const id = `item_${this.items.length}_${Math.random().toString(36).slice(2, 8)}`;
      let mesh: THREE.Mesh;

      if (spawn.type === 'weapon') {
        const weaponDef = WEAPONS[spawn.weaponId || 'pistol'];
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.3, 0.7),
          new THREE.MeshLambertMaterial({ color: weaponDef.color, emissive: new THREE.Color(weaponDef.color), emissiveIntensity: 0.3 })
        );
      } else if (spawn.type === 'health') {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 0.35, 0.35),
          new THREE.MeshLambertMaterial({ color: 0xff4444, emissive: 0xff0000, emissiveIntensity: 0.3 })
        );
      } else if (spawn.type === 'ammo') {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, 0.25, 0.25),
          new THREE.MeshLambertMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 0.2 })
        );
      } else {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.3, 0.3),
          new THREE.MeshLambertMaterial({ color: 0x4444ff })
        );
      }

      mesh.position.copy(spawn.position);
      this.scene.add(mesh);

      this.items.push({
        id,
        position: spawn.position.clone(),
        type: spawn.type,
        weaponId: spawn.weaponId,
        mesh,
        collected: false,
      });
    }
  }

  private tryPickup(): void {
    const playerPos = this.player.state.position;
    const pickupRange = 3;

    for (const item of this.items) {
      if (item.collected) continue;
      if (item.position.distanceTo(playerPos) > pickupRange) continue;

      if (item.type === 'weapon' && item.weaponId) {
        const def = WEAPONS[item.weaponId];
        if (!def) continue;

        const weapon: WeaponInstance = {
          def,
          currentAmmo: def.magazineSize,
          reserveAmmo: def.magazineSize * 3,
          isReloading: false,
          reloadTimer: 0,
          fireTimer: 0,
        };

        if (this.weapons[this.activeSlot] === null) {
          this.weapons[this.activeSlot] = weapon;
        } else {
          // Swap weapons
          this.dropWeapon();
          this.weapons[this.activeSlot] = weapon;
        }
      } else if (item.type === 'health') {
        this.player.heal(25);
      } else if (item.type === 'ammo') {
        const w = this.weapons[this.activeSlot];
        if (w) w.reserveAmmo += w.def.magazineSize;
      } else if (item.type === 'armor') {
        this.player.addArmor(50);
      }

      if (this.onPickup) this.onPickup(item.position.clone(), item.type);
      item.collected = true;
      this.scene.remove(item.mesh);
      break;
    }
  }

  private dropWeapon(): void {
    const w = this.weapons[this.activeSlot];
    if (!w) return;

    const dropPos = this.player.state.position.clone();
    const forward = this.player.getForwardDirection();
    dropPos.add(forward.multiplyScalar(2));

    this.spawnItems([{
      position: dropPos,
      type: 'weapon',
      weaponId: Object.keys(WEAPONS).find(k => WEAPONS[k] === w.def) || 'pistol',
    }]);

    this.weapons[this.activeSlot] = null;
  }

  private reload(): void {
    const w = this.weapons[this.activeSlot];
    if (!w || w.isReloading || w.currentAmmo === w.def.magazineSize || w.reserveAmmo <= 0) return;
    w.isReloading = true;
    w.reloadTimer = w.def.reloadTime;
  }

  private meleeAttack(): void {
    if (this.meleeCooldown > 0) return;
    this.meleeCooldown = 0.8;
    const pos = this.player.state.position.clone();
    pos.y += 1.0;
    if (this.onMelee) this.onMelee(pos);
  }

  private fire(): void {
    const w = this.weapons[this.activeSlot];
    if (!w || w.isReloading || w.currentAmmo <= 0) return;

    const fireInterval = 1 / w.def.fireRate;
    if (w.fireTimer > 0) return;
    w.fireTimer = fireInterval;

    w.currentAmmo--;
    if (w.currentAmmo <= 0 && w.reserveAmmo > 0) {
      this.reload();
    }

    const pellets = w.def.type === 'shotgun' ? 8 : 1;
    const dir = this.player.getAimDirection();
    const startPos = this.player.state.position.clone();
    startPos.y += 1.2;

    for (let i = 0; i < pellets; i++) {
      const spreadMult = this.player.getSpreadMultiplier();
      const spread = w.def.spread * spreadMult * this.weatherSpreadMultiplier;
      const bulletDir = dir.clone();
      bulletDir.x += (Math.random() - 0.5) * spread;
      bulletDir.y += (Math.random() - 0.5) * spread;
      bulletDir.z += (Math.random() - 0.5) * spread;
      bulletDir.normalize();

      const bulletMesh = new THREE.Mesh(this.bulletGeometry, this.bulletMaterial);
      const bPos = startPos.clone();
      bPos.add(bulletDir.clone().multiplyScalar(1.5));
      bulletMesh.position.copy(bPos);
      this.scene.add(bulletMesh);

      this.bullets.push({
        position: bPos,
        velocity: bulletDir.multiplyScalar(w.def.bulletSpeed),
        damage: w.def.damage,
        range: w.def.range,
        traveled: 0,
        mesh: bulletMesh,
        ownerId: 'player',
      });
    }

    if (this.onFire) this.onFire(w.def.type, startPos, dir);
  }

  fireBotWeapon(position: THREE.Vector3, direction: THREE.Vector3, weaponId: string, botId: string): void {
    const def = WEAPONS[weaponId];
    if (!def) return;

    const spread = def.spread * 1.5; // Bots have more spread
    const bulletDir = direction.clone();
    bulletDir.x += (Math.random() - 0.5) * spread;
    bulletDir.y += (Math.random() - 0.5) * spread;
    bulletDir.z += (Math.random() - 0.5) * spread;
    bulletDir.normalize();

    const bulletMesh = new THREE.Mesh(this.bulletGeometry, this.bulletMaterial);
    const startPos = position.clone().add(bulletDir.clone().multiplyScalar(1));
    bulletMesh.position.copy(startPos);
    this.scene.add(bulletMesh);

    this.bullets.push({
      position: startPos,
      velocity: bulletDir.multiplyScalar(def.bulletSpeed),
      damage: def.damage,
      range: def.range,
      traveled: 0,
      mesh: bulletMesh,
      ownerId: botId,
    });

    if (this.onBotFire) this.onBotFire(position.clone(), direction.clone(), weaponId);
  }

  update(delta: number): void {
    // Melee cooldown
    if (this.meleeCooldown > 0) this.meleeCooldown -= delta;

    // Weapon timers
    const w = this.weapons[this.activeSlot];
    if (w) {
      if (w.isReloading) {
        w.reloadTimer -= delta;
        if (w.reloadTimer <= 0) {
          const needed = w.def.magazineSize - w.currentAmmo;
          const available = Math.min(needed, w.reserveAmmo);
          w.currentAmmo += available;
          w.reserveAmmo -= available;
          w.isReloading = false;
        }
      }
      if (w.fireTimer > 0) w.fireTimer -= delta;
    }

    // Auto-fire
    if (this.isFiring && this.player.isPointerLocked()) {
      this.fire();
    }

    // Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      const movement = bullet.velocity.clone().multiplyScalar(delta);
      bullet.position.add(movement);
      bullet.mesh.position.copy(bullet.position);
      bullet.traveled += movement.length();

      // Terrain collision -- remove bullet if below ground
      if (this.world) {
        const bulletGroundH = this.world.getHeightAt(bullet.position.x, bullet.position.z);
        if (bullet.position.y < bulletGroundH + 0.3) {
          this.scene.remove(bullet.mesh);
          this.bullets.splice(i, 1);
          continue;
        }

        // Building collision
        const buildings = this.world.getBuildings();
        let hitBuilding = false;
        for (const b of buildings) {
          const baseH = this.world.getHeightAt(b.x, b.z);
          if (
            bullet.position.x > b.x && bullet.position.x < b.x + b.width &&
            bullet.position.z > b.z && bullet.position.z < b.z + b.depth &&
            bullet.position.y > baseH && bullet.position.y < baseH + b.height + 1
          ) {
            hitBuilding = true;
            break;
          }
        }
        if (hitBuilding) {
          this.scene.remove(bullet.mesh);
          this.bullets.splice(i, 1);
          continue;
        }
      }

      // Check if out of range
      if (bullet.traveled > bullet.range) {
        this.scene.remove(bullet.mesh);
        this.bullets.splice(i, 1);
        continue;
      }
      // Hit detection is handled by BotSystem.checkBulletHits
    }

    // Rotate item drops
    const time = Date.now() * 0.001;
    for (const item of this.items) {
      if (!item.collected) {
        item.mesh.rotation.y = time * 2;
        item.mesh.position.y = item.position.y + Math.sin(time * 3) * 0.15;
      }
    }

    // Attach weapon model to player's right hand in 3rd person
    if (w) {
      this.weaponModel.visible = true;
      const playerPos = this.player.state.position;
      const yaw = this.player.getYaw();
      const forward = this.player.getForwardDirection();
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

      this.weaponModel.position.set(
        playerPos.x + right.x * 0.5 + forward.x * 0.4,
        playerPos.y + 1.0,
        playerPos.z + right.z * 0.5 + forward.z * 0.4
      );
      this.weaponModel.rotation.y = yaw;

      if (this.isFiring && w.fireTimer > 0) {
        this.weaponModel.position.add(forward.clone().multiplyScalar(-0.08));
      }
    } else {
      this.weaponModel.visible = false;
    }
  }

  triggerFire(): void {
    this.isFiring = true;
  }

  stopFire(): void {
    this.isFiring = false;
  }

  getActiveWeapon(): WeaponInstance | null {
    return this.weapons[this.activeSlot];
  }

  getBullets(): Bullet[] {
    return this.bullets;
  }

  removeBullet(index: number): void {
    if (index >= 0 && index < this.bullets.length) {
      this.scene.remove(this.bullets[index].mesh);
      this.bullets.splice(index, 1);
    }
  }

  clearBullets(): void {
    for (const b of this.bullets) { this.scene.remove(b.mesh); }
    this.bullets = [];
  }
}
