import * as THREE from 'three';
import { ZONE_PHASES, WORLD_SIZE } from '../core/constants';
import { PlayerController } from '../player/PlayerController';
import { Bot } from '../bots/BotSystem';

export class ZoneSystem {
  private scene: THREE.Scene;
  private player: PlayerController;
  currentPhase = 0;
  center: THREE.Vector2;
  nextCenter: THREE.Vector2;
  currentRadius: number;
  targetRadius: number;
  private phaseTimer: number;
  private isShrinking = false;
  private shrinkTimer = 0;
  private zoneMesh: THREE.Mesh;
  private zoneEdgeMesh: THREE.Mesh;
  private safeZoneMesh: THREE.Mesh;

  constructor(scene: THREE.Scene, player: PlayerController) {
    this.scene = scene;
    this.player = player;

    this.currentRadius = WORLD_SIZE / 2;
    this.targetRadius = WORLD_SIZE / 2;
    this.center = new THREE.Vector2(0, 0);
    this.nextCenter = new THREE.Vector2(0, 0);
    this.phaseTimer = ZONE_PHASES[0].delay;

    // Blue zone wall (cylinder)
    const zoneGeo = new THREE.CylinderGeometry(this.currentRadius, this.currentRadius, 100, 64, 1, true);
    const zoneMat = new THREE.MeshBasicMaterial({
      color: 0x0044ff,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.zoneMesh = new THREE.Mesh(zoneGeo, zoneMat);
    this.zoneMesh.position.y = 50;
    scene.add(this.zoneMesh);

    // Edge glow ring
    const edgeGeo = new THREE.RingGeometry(this.currentRadius - 1, this.currentRadius + 1, 64);
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0x0066ff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    this.zoneEdgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
    this.zoneEdgeMesh.rotation.x = -Math.PI / 2;
    this.zoneEdgeMesh.position.y = 0.5;
    scene.add(this.zoneEdgeMesh);

    // Safe zone indicator (white circle)
    const safeGeo = new THREE.RingGeometry(0, 2, 32);
    const safeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    this.safeZoneMesh = new THREE.Mesh(safeGeo, safeMat);
    this.safeZoneMesh.rotation.x = -Math.PI / 2;
    this.safeZoneMesh.position.y = 0.5;
    scene.add(this.safeZoneMesh);
  }

  update(delta: number, bots: Bot[]): void {
    if (this.currentPhase >= ZONE_PHASES.length) return;

    const phase = ZONE_PHASES[this.currentPhase];

    if (!this.isShrinking) {
      // Delay phase
      this.phaseTimer -= delta;
      if (this.phaseTimer <= 0) {
        this.isShrinking = true;
        this.shrinkTimer = phase.shrinkTime;

        // Calculate next zone
        const maxOffset = this.currentRadius * 0.3;
        this.nextCenter = new THREE.Vector2(
          this.center.x + (Math.random() - 0.5) * maxOffset,
          this.center.y + (Math.random() - 0.5) * maxOffset
        );
        this.targetRadius = WORLD_SIZE / 2 * phase.radiusPercent;
      }
    } else {
      // Shrinking phase
      this.shrinkTimer -= delta;
      const progress = 1 - Math.max(0, this.shrinkTimer / phase.shrinkTime);

      // Lerp radius
      const startRadius = this.currentPhase === 0 ?
        WORLD_SIZE / 2 :
        WORLD_SIZE / 2 * ZONE_PHASES[this.currentPhase - 1].radiusPercent;
      this.currentRadius = startRadius + (this.targetRadius - startRadius) * progress;

      // Lerp center
      this.center.lerp(this.nextCenter, progress * 0.01);

      if (this.shrinkTimer <= 0) {
        this.isShrinking = false;
        this.currentPhase++;
        if (this.currentPhase < ZONE_PHASES.length) {
          this.phaseTimer = ZONE_PHASES[this.currentPhase].delay;
        }
        this.center.copy(this.nextCenter);
        this.currentRadius = this.targetRadius;
      }
    }

    // Update visuals
    this.updateZoneMesh();

    // Apply damage to player outside zone
    const playerDist = new THREE.Vector2(
      this.player.state.position.x, this.player.state.position.z
    ).distanceTo(this.center);

    if (playerDist > this.currentRadius && !this.player.state.isDead) {
      this.player.takeDamage(phase.damage * delta);
    }

    // Damage bots outside zone
    for (const bot of bots) {
      if (bot.isDead) continue;
      const botDist = new THREE.Vector2(bot.position.x, bot.position.z)
        .distanceTo(this.center);
      if (botDist > this.currentRadius) {
        bot.health -= phase.damage * delta;
        if (bot.health <= 0) {
          bot.isDead = true;
          bot.mesh.rotation.x = Math.PI / 2;
          bot.mesh.position.y -= 0.5;
        }

        // Bots try to run into the zone
        if (bot.state !== 'fleeing') {
          bot.state = 'roaming';
          bot.targetPos = new THREE.Vector3(this.center.x, 0, this.center.y);
          bot.stateTimer = 10;
        }
      }
    }
  }

  private updateZoneMesh(): void {
    // Update cylinder radius
    this.zoneMesh.scale.set(
      this.currentRadius / (WORLD_SIZE / 2),
      1,
      this.currentRadius / (WORLD_SIZE / 2)
    );
    this.zoneMesh.position.set(this.center.x, 50, this.center.y);

    // Update edge ring
    this.zoneEdgeMesh.scale.set(
      this.currentRadius / (WORLD_SIZE / 2),
      this.currentRadius / (WORLD_SIZE / 2),
      1
    );
    this.zoneEdgeMesh.position.set(this.center.x, 0.5, this.center.y);

    // Update safe zone indicator
    if (this.isShrinking) {
      this.safeZoneMesh.visible = true;
      this.safeZoneMesh.scale.set(
        this.targetRadius / 2,
        this.targetRadius / 2,
        1
      );
      this.safeZoneMesh.position.set(this.nextCenter.x, 0.5, this.nextCenter.y);
    } else {
      this.safeZoneMesh.visible = false;
    }
  }

  getPhaseInfo(): {
    phase: number;
    timer: number;
    isShrinking: boolean;
    damage: number;
  } {
    const phase = ZONE_PHASES[Math.min(this.currentPhase, ZONE_PHASES.length - 1)];
    return {
      phase: this.currentPhase + 1,
      timer: this.isShrinking ? this.shrinkTimer : this.phaseTimer,
      isShrinking: this.isShrinking,
      damage: phase.damage,
    };
  }

  isInsideZone(position: THREE.Vector3): boolean {
    const dist = new THREE.Vector2(position.x, position.z).distanceTo(this.center);
    return dist <= this.currentRadius;
  }
}
