import * as THREE from 'three';
import {
  WORLD_SIZE, BLOCK_SIZE, BLOCK_TYPES, BLOCK_COLORS,
  WATER_LEVEL,
} from '../core/constants';
import { Building } from './BuildingGenerator';

export interface ItemSpawn {
  position: THREE.Vector3;
  type: string;
  weaponId?: string;
}

export interface POILocation {
  type: string;
  x: number;
  z: number;
  radius: number;
}

export function generateTrees(
  scene: THREE.Scene,
  treePositions: THREE.Vector3[],
  treeGrid: Map<string, THREE.Vector3[]>,
  treeGridCellSize: number,
  buildings: Building[],
  getHeightAt: (x: number, z: number) => number,
  seededRandom: (seed: number) => () => number
): void {
  const rand = seededRandom(9999);
  const trunkPositions: THREE.Matrix4[] = [];
  const leafPositions: THREE.Matrix4[] = [];
  const matrix = new THREE.Matrix4();

  for (let i = 0; i < 6000; i++) {
    const x = Math.floor((rand() - 0.5) * WORLD_SIZE * 0.8);
    const z = Math.floor((rand() - 0.5) * WORLD_SIZE * 0.8);
    const height = getHeightAt(x, z);

    if (height <= WATER_LEVEL + 1) continue;

    const inBuilding = buildings.some(b =>
      x >= b.x - 2 && x <= b.x + b.width + 2 &&
      z >= b.z - 2 && z <= b.z + b.depth + 2
    );
    if (inBuilding) continue;

    const trunkHeight = 3 + Math.floor(rand() * 3);

    treePositions.push(new THREE.Vector3(x, height, z));

    for (let y = 1; y <= trunkHeight; y++) {
      matrix.makeTranslation(x, height + y, z);
      trunkPositions.push(matrix.clone());
    }

    const leafRadius = 2;
    for (let lx = -leafRadius; lx <= leafRadius; lx++) {
      for (let lz = -leafRadius; lz <= leafRadius; lz++) {
        for (let ly = 0; ly <= 2; ly++) {
          if (Math.abs(lx) + Math.abs(lz) + ly > leafRadius + 1) continue;
          matrix.makeTranslation(x + lx, height + trunkHeight + ly, z + lz);
          leafPositions.push(matrix.clone());
        }
      }
    }
  }

  const blockGeo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

  if (trunkPositions.length > 0) {
    const trunkMat = new THREE.MeshLambertMaterial({ color: BLOCK_COLORS[BLOCK_TYPES.WOOD] });
    const trunkMesh = new THREE.InstancedMesh(blockGeo, trunkMat, trunkPositions.length);
    trunkMesh.castShadow = true;
    for (let i = 0; i < trunkPositions.length; i++) {
      trunkMesh.setMatrixAt(i, trunkPositions[i]);
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    scene.add(trunkMesh);
  }

  if (leafPositions.length > 0) {
    const leafMat = new THREE.MeshLambertMaterial({
      color: BLOCK_COLORS[BLOCK_TYPES.LEAVES],
      transparent: true,
      opacity: 0.9,
    });
    const leafMesh = new THREE.InstancedMesh(blockGeo, leafMat, leafPositions.length);
    leafMesh.castShadow = true;
    for (let i = 0; i < leafPositions.length; i++) {
      leafMesh.setMatrixAt(i, leafPositions[i]);
    }
    leafMesh.instanceMatrix.needsUpdate = true;
    scene.add(leafMesh);
  }

  // Build spatial grid for tree collision lookups
  treeGrid.clear();
  for (const tp of treePositions) {
    const cx = Math.floor(tp.x / treeGridCellSize);
    const cz = Math.floor(tp.z / treeGridCellSize);
    const key = `${cx},${cz}`;
    if (!treeGrid.has(key)) treeGrid.set(key, []);
    treeGrid.get(key)!.push(tp);
  }
}

export function generateRocks(
  scene: THREE.Scene,
  buildings: Building[],
  getHeightAt: (x: number, z: number) => number,
  seededRandom: (seed: number) => () => number
): void {
  const rand = seededRandom(55555);
  const rockPositions: THREE.Matrix4[] = [];
  const matrix = new THREE.Matrix4();
  const count = 1200;

  for (let i = 0; i < count; i++) {
    const x = Math.floor((rand() - 0.5) * WORLD_SIZE * 0.8);
    const z = Math.floor((rand() - 0.5) * WORLD_SIZE * 0.8);
    const height = getHeightAt(x, z);

    if (height <= WATER_LEVEL + 1) continue;

    const inBuilding = buildings.some(b =>
      x >= b.x - 2 && x <= b.x + b.width + 2 &&
      z >= b.z - 2 && z <= b.z + b.depth + 2
    );
    if (inBuilding) continue;

    const rockH = 2 + Math.floor(rand() * 3);
    for (let y = 0; y < rockH; y++) {
      const scale = 1 + rand() * 0.5;
      matrix.makeScale(scale, 1, scale);
      matrix.setPosition(x, height + y + 0.5, z);
      rockPositions.push(matrix.clone());
    }
  }

  if (rockPositions.length > 0) {
    const rockGeo = new THREE.BoxGeometry(1.5, 1.0, 1.5);
    const rockMat = new THREE.MeshLambertMaterial({ color: BLOCK_COLORS[BLOCK_TYPES.ROCK] });
    const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rockPositions.length);
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;
    for (let i = 0; i < rockPositions.length; i++) {
      rockMesh.setMatrixAt(i, rockPositions[i]);
    }
    rockMesh.instanceMatrix.needsUpdate = true;
    scene.add(rockMesh);
  }
}

export function generateItemSpawns(
  itemSpawns: ItemSpawn[],
  buildings: Building[],
  getHeightAt: (x: number, z: number) => number,
  seededRandom: (seed: number) => () => number
): void {
  const rand = seededRandom(7777);
  const weaponIds = ['pistol', 'shotgun', 'smg', 'assault', 'sniper'];
  const rarityWeights = [0.35, 0.25, 0.20, 0.15, 0.05];

  for (const b of buildings) {
    const baseHeight = getHeightAt(b.x, b.z);
    const itemCount = 2 + Math.floor(rand() * 3);

    for (let i = 0; i < itemCount; i++) {
      const ix = b.x + 1 + Math.floor(rand() * (b.width - 2));
      const iz = b.z + 1 + Math.floor(rand() * (b.depth - 2));

      let r = rand();
      let weaponIdx = 0;
      for (let w = 0; w < rarityWeights.length; w++) {
        r -= rarityWeights[w];
        if (r <= 0) { weaponIdx = w; break; }
      }

      if (rand() < 0.6) {
        itemSpawns.push({
          position: new THREE.Vector3(ix, baseHeight + 1.5, iz),
          type: 'weapon',
          weaponId: weaponIds[weaponIdx],
        });
      } else if (rand() < 0.5) {
        itemSpawns.push({
          position: new THREE.Vector3(ix, baseHeight + 1.5, iz),
          type: 'health',
        });
      } else {
        itemSpawns.push({
          position: new THREE.Vector3(ix, baseHeight + 1.5, iz),
          type: 'ammo',
        });
      }
    }
  }

  for (let i = 0; i < 800; i++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.6;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.6;
    const h = getHeightAt(x, z);
    if (h <= WATER_LEVEL) continue;

    let r = rand();
    let weaponIdx = 0;
    for (let w = 0; w < rarityWeights.length; w++) {
      r -= rarityWeights[w];
      if (r <= 0) { weaponIdx = w; break; }
    }

    itemSpawns.push({
      position: new THREE.Vector3(x, h + 1, z),
      type: 'weapon',
      weaponId: weaponIds[weaponIdx],
    });
  }
}

