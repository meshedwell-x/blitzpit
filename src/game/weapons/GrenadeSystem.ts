import * as THREE from 'three';
import { PlayerController } from '../player/PlayerController';
import { Bot } from '../bots/BotSystem';
import { WorldGenerator } from '../world/WorldGenerator';

export interface GrenadeDef {
  name: string;
  type: 'frag' | 'smoke' | 'flash';
  damage: number;
  radius: number;
  fuseTime: number;
  color: string;
}

export const GRENADES: Record<string, GrenadeDef> = {
  frag: { name: 'Frag Grenade', type: 'frag', damage: 80, radius: 8, fuseTime: 3.0, color: '#3a5a2a' },
  smoke: { name: 'Smoke Grenade', type: 'smoke', damage: 0, radius: 10, fuseTime: 2.0, color: '#888888' },
  flash: { name: 'Flashbang', type: 'flash', damage: 10, radius: 12, fuseTime: 2.0, color: '#cccccc' },
};

interface ActiveGrenade {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  def: GrenadeDef;
  timer: number;
  mesh: THREE.Mesh;
  exploded: boolean;
}

interface SmokeCloud {
  position: THREE.Vector3;
  mesh: THREE.Mesh;
  timer: number;
  duration: number;
}

export class GrenadeSystem {
  private scene: THREE.Scene;
  private player: PlayerController;
  private world: WorldGenerator;
  private grenades: ActiveGrenade[] = [];
  private smokeClouds: SmokeCloud[] = [];
  inventory: Record<string, number> = { frag: 2, smoke: 1, flash: 1 };
  selectedGrenade: string = 'frag';
  onExplosion: ((position: THREE.Vector3, damage: number, radius: number, type: string) => void) | null = null;
  onBotKill: ((botId: string) => void) | null = null;

  private _onKeyDown: (e: KeyboardEvent) => void = () => {};

  constructor(scene: THREE.Scene, player: PlayerController, world: WorldGenerator) {
    this.scene = scene;
    this.player = player;
    this.world = world;
  }

  init(): void {
    this._onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyT') {
        // Cycle grenade type
        const types = Object.keys(GRENADES);
        const idx = types.indexOf(this.selectedGrenade);
        this.selectedGrenade = types[(idx + 1) % types.length];
      }
    };
    document.addEventListener('keydown', this._onKeyDown);
  }

  destroy(): void {
    document.removeEventListener('keydown', this._onKeyDown);
    // Clean up active grenades
    for (const g of this.grenades) {
      this.scene.remove(g.mesh);
    }
    this.grenades = [];
    // Clean up smoke clouds
    for (const s of this.smokeClouds) {
      this.scene.remove(s.mesh);
    }
    this.smokeClouds = [];
  }

  throwGrenade(direction?: THREE.Vector3): void {
    if (this.inventory[this.selectedGrenade] <= 0) return;
    this.inventory[this.selectedGrenade]--;

    const def = GRENADES[this.selectedGrenade];
    const dir = direction || this.player.getAimDirection();

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshLambertMaterial({ color: def.color })
    );

    const startPos = this.player.state.position.clone();
    startPos.y += 1.5;
    startPos.add(dir.clone().multiplyScalar(1));
    mesh.position.copy(startPos);
    this.scene.add(mesh);

    // Arc trajectory: forward + upward
    const throwSpeed = 20;
    const velocity = dir.clone().multiplyScalar(throwSpeed);
    velocity.y += 8; // upward arc

    this.grenades.push({
      position: startPos.clone(),
      velocity,
      def,
      timer: def.fuseTime,
      mesh,
      exploded: false,
    });
  }

  update(delta: number, bots: Bot[]): void {
    const gravity = -20;

    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      if (g.exploded) continue;

      // Physics
      g.velocity.y += gravity * delta;
      g.position.add(g.velocity.clone().multiplyScalar(delta));

      // Bounce off ground using heightmap
      const groundY = this.world.getHeightAt(g.position.x, g.position.z) + 0.5;
      if (g.position.y < groundY) {
        g.position.y = groundY;
        g.velocity.y *= -0.3;
        g.velocity.x *= 0.7;
        g.velocity.z *= 0.7;
      }

      g.mesh.position.copy(g.position);
      g.mesh.rotation.x += delta * 5;
      g.mesh.rotation.z += delta * 3;

      g.timer -= delta;

      if (g.timer <= 0) {
        this.explode(g, bots);
        g.exploded = true;
        this.scene.remove(g.mesh);
        this.grenades.splice(i, 1);
      }
    }

    // Update smoke clouds
    for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
      const s = this.smokeClouds[i];
      s.timer -= delta;
      const progress = 1 - s.timer / s.duration;
      const scale = 1 + progress * 3;
      s.mesh.scale.set(scale, scale * 0.6, scale);

      const mat = s.mesh.material as THREE.MeshLambertMaterial;
      mat.opacity = Math.max(0, 0.6 - progress * 0.6);

      if (s.timer <= 0) {
        this.scene.remove(s.mesh);
        this.smokeClouds.splice(i, 1);
      }
    }
  }

  private explode(grenade: ActiveGrenade, bots: Bot[]): void {
    const pos = grenade.position;
    const def = grenade.def;

    if (def.type === 'frag') {
      // Explosion visual
      const explosion = new THREE.Mesh(
        new THREE.SphereGeometry(def.radius * 0.3, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.8 })
      );
      explosion.position.copy(pos);
      this.scene.add(explosion);

      // Fade out
      setTimeout(() => this.scene.remove(explosion), 300);

      // Damage
      if (this.onExplosion) {
        this.onExplosion(pos, def.damage, def.radius, def.type);
      }

      // Damage player
      const playerDist = pos.distanceTo(this.player.state.position);
      if (playerDist < def.radius) {
        const falloff = 1 - playerDist / def.radius;
        this.player.takeDamage(def.damage * falloff);
      }

      // Damage bots
      for (const bot of bots) {
        if (bot.isDead) continue;
        const dist = pos.distanceTo(bot.position);
        if (dist < def.radius) {
          const falloff = 1 - dist / def.radius;
          bot.health -= def.damage * falloff;
          if (bot.health <= 0 && !bot.isDead) {
            bot.isDead = true;
            bot.health = 0;
            bot.mesh.rotation.x = Math.PI / 2;
            bot.mesh.position.y -= 0.5;
            if (this.onBotKill) this.onBotKill(bot.id);
          }
        }
      }
    } else if (def.type === 'smoke') {
      const smoke = new THREE.Mesh(
        new THREE.SphereGeometry(3, 12, 12),
        new THREE.MeshLambertMaterial({
          color: 0xcccccc,
          transparent: true,
          opacity: 0.6,
        })
      );
      smoke.position.copy(pos);
      this.scene.add(smoke);
      this.smokeClouds.push({
        position: pos.clone(),
        mesh: smoke,
        timer: 10,
        duration: 10,
      });
    } else if (def.type === 'flash') {
      // Flash effect on player if in range and facing
      const playerDist = pos.distanceTo(this.player.state.position);
      if (playerDist < def.radius) {
        // Flash handled by UI
        if (this.onExplosion) {
          this.onExplosion(pos, 0, def.radius, 'flash');
        }
      }
    }
  }

  addGrenade(type: string, count: number = 1): void {
    if (GRENADES[type]) {
      this.inventory[type] = (this.inventory[type] || 0) + count;
    }
  }

  clearAll(): void {
    for (const g of this.grenades) { this.scene.remove(g.mesh); }
    this.grenades = [];
    for (const s of this.smokeClouds) { this.scene.remove(s.mesh); }
    this.smokeClouds = [];
  }
}
