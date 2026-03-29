import * as THREE from 'three';
import type { Bullet } from './WeaponTypes';
import type { WorldGenerator } from '../world/WorldGenerator';

/**
 * Updates all active bullets: movement, terrain/tree/building collision, range check.
 * Returns indices of bullets that should be removed (already removed from scene).
 */
export function updateBullets(
  bullets: Bullet[],
  delta: number,
  scene: THREE.Scene,
  world: WorldGenerator | null,
): void {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    const movement = bullet.velocity.clone().multiplyScalar(delta);
    bullet.position.add(movement);
    bullet.mesh.position.copy(bullet.position);
    bullet.traveled += movement.length();

    // Tracer rotation -- align mesh to travel direction
    if (bullet.velocity.length() > 0) {
      bullet.mesh.lookAt(
        bullet.position.x + bullet.velocity.x,
        bullet.position.y + bullet.velocity.y,
        bullet.position.z + bullet.velocity.z
      );
    }

    // Terrain collision -- remove bullet if below ground
    if (world) {
      const bulletGroundH = world.getHeightAt(bullet.position.x, bullet.position.z);
      if (bullet.position.y < bulletGroundH + 0.3) {
        scene.remove(bullet.mesh);
        bullets.splice(i, 1);
        continue;
      }

      // Tree collision -- bullets stopped by tree trunks (spatial grid lookup)
      let hitTree = false;
      const TREE_HIT_RADIUS = 0.8;
      for (const treePos of world.getNearbyTrees(bullet.position.x, bullet.position.z, 3)) {
        const dx = bullet.position.x - treePos.x;
        const dz = bullet.position.z - treePos.z;
        const distSq = dx * dx + dz * dz;
        // Only collide if bullet is at trunk height (ground to ~6 units above ground)
        if (distSq < TREE_HIT_RADIUS * TREE_HIT_RADIUS && bullet.position.y < treePos.y + 6 && bullet.position.y > treePos.y - 1) {
          hitTree = true;
          break;
        }
      }
      if (hitTree) {
        scene.remove(bullet.mesh);
        bullets.splice(i, 1);
        continue;
      }

      // Building collision -- bullets stopped by walls, door opening allowed
      const buildings = world.getNearbyBuildings(bullet.position.x, bullet.position.z);
      let hitWall = false;
      for (const b of buildings) {
        // Quick AABB reject before computing baseH
        if (
          bullet.position.x <= b.x || bullet.position.x >= b.x + b.width ||
          bullet.position.z <= b.z || bullet.position.z >= b.z + b.depth
        ) continue;

        const baseH = world.getHeightAt(b.x, b.z);
        if (bullet.position.y < baseH + 0.5 || bullet.position.y > baseH + b.height + 0.5) continue;

        // Door: front face (z === b.z side), centered x, height 2 blocks
        const doorX = b.x + Math.floor(b.width / 2);
        const isDoor =
          Math.abs(bullet.position.x - doorX) < 1.0 &&
          Math.abs(bullet.position.z - b.z) < 0.5 &&
          bullet.position.y < baseH + 2.5;

        if (!isDoor) {
          hitWall = true;
          break;
        }
      }
      if (hitWall) {
        scene.remove(bullet.mesh);
        bullets.splice(i, 1);
        continue;
      }
    }

    // Check if out of range
    if (bullet.traveled > bullet.range) {
      scene.remove(bullet.mesh);
      bullets.splice(i, 1);
      continue;
    }
    // Hit detection is handled by BotSystem.checkBulletHits
  }
}
