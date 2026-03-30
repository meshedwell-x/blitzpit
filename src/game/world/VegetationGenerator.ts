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

  for (let i = 0; i < 10000; i++) {
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
  const count = 3000;

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

    const rockH = 1 + Math.floor(rand() * 5);
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

export function generateBushes(
  scene: THREE.Scene,
  buildings: Building[],
  getHeightAt: (x: number, z: number) => number,
  seededRandom: (seed: number) => () => number
): void {
  const rand = seededRandom(33333);
  const bushPositions: THREE.Matrix4[] = [];
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Matrix4();

  for (let i = 0; i < 2000; i++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.85;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.85;
    const height = getHeightAt(x, z);
    if (height <= WATER_LEVEL + 1) continue;

    const inBuilding = buildings.some(b =>
      x >= b.x - 1 && x <= b.x + b.width + 1 &&
      z >= b.z - 1 && z <= b.z + b.depth + 1
    );
    if (inBuilding) continue;

    const sx = 0.6 + rand() * 0.6;
    const sy = 0.4 + rand() * 0.4;
    const sz = 0.6 + rand() * 0.6;
    scale.makeScale(sx, sy, sz);
    matrix.makeTranslation(x, height + 0.25, z);
    matrix.multiply(scale);
    bushPositions.push(matrix.clone());
  }

  if (bushPositions.length > 0) {
    const bushGeo = new THREE.BoxGeometry(1.0, 0.6, 1.0);
    const bushMat = new THREE.MeshLambertMaterial({ color: 0x3a6b2a });
    const bushMesh = new THREE.InstancedMesh(bushGeo, bushMat, bushPositions.length);
    bushMesh.castShadow = false;
    for (let i = 0; i < bushPositions.length; i++) {
      bushMesh.setMatrixAt(i, bushPositions[i]);
    }
    bushMesh.instanceMatrix.needsUpdate = true;
    scene.add(bushMesh);
  }
}

export function generateFences(
  scene: THREE.Scene,
  buildings: Building[],
  getHeightAt: (x: number, z: number) => number,
  seededRandom: (seed: number) => () => number
): void {
  const rand = seededRandom(44444);
  const fencePositions: THREE.Matrix4[] = [];
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Matrix4();

  for (let i = 0; i < 80; i++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.7;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.7;
    const height = getHeightAt(x, z);
    if (height <= WATER_LEVEL + 1) continue;

    const inBuilding = buildings.some(b =>
      x >= b.x - 5 && x <= b.x + b.width + 5 &&
      z >= b.z - 5 && z <= b.z + b.depth + 5
    );
    if (inBuilding) continue;

    const length = 5 + Math.floor(rand() * 8);
    const angle = Math.floor(rand() * 2) * Math.PI * 0.5;
    rotation.makeRotationY(angle);
    matrix.makeTranslation(x, height + 0.5, z);
    matrix.multiply(rotation);
    matrix.scale(new THREE.Vector3(length, 1, 1));
    fencePositions.push(matrix.clone());
  }

  if (fencePositions.length > 0) {
    const fenceGeo = new THREE.BoxGeometry(1.0, 1.0, 0.3);
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0x7a6a5a });
    const fenceMesh = new THREE.InstancedMesh(fenceGeo, fenceMat, fencePositions.length);
    fenceMesh.castShadow = true;
    fenceMesh.receiveShadow = true;
    for (let i = 0; i < fencePositions.length; i++) {
      fenceMesh.setMatrixAt(i, fencePositions[i]);
    }
    fenceMesh.instanceMatrix.needsUpdate = true;
    scene.add(fenceMesh);
  }
}

export function generateFallenTrees(
  scene: THREE.Scene,
  buildings: Building[],
  getHeightAt: (x: number, z: number) => number,
  seededRandom: (seed: number) => () => number
): void {
  const rand = seededRandom(66666);
  const logPositions: THREE.Matrix4[] = [];
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Matrix4();

  for (let i = 0; i < 120; i++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.8;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.8;
    const height = getHeightAt(x, z);
    if (height <= WATER_LEVEL + 1) continue;

    const inBuilding = buildings.some(b =>
      x >= b.x - 3 && x <= b.x + b.width + 3 &&
      z >= b.z - 3 && z <= b.z + b.depth + 3
    );
    if (inBuilding) continue;

    const logLength = 4 + Math.floor(rand() * 3);
    const angle = rand() * Math.PI * 2;
    rotation.makeRotationY(angle);
    matrix.makeTranslation(x, height + 0.3, z);
    matrix.multiply(rotation);
    matrix.scale(new THREE.Vector3(logLength, 0.5, 0.5));
    logPositions.push(matrix.clone());
  }

  if (logPositions.length > 0) {
    const logGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    const logMat = new THREE.MeshLambertMaterial({ color: BLOCK_COLORS[BLOCK_TYPES.WOOD] });
    const logMesh = new THREE.InstancedMesh(logGeo, logMat, logPositions.length);
    logMesh.castShadow = true;
    logMesh.receiveShadow = true;
    for (let i = 0; i < logPositions.length; i++) {
      logMesh.setMatrixAt(i, logPositions[i]);
    }
    logMesh.instanceMatrix.needsUpdate = true;
    scene.add(logMesh);
  }
}

export function generateUrbanDetails(
  scene: THREE.Scene,
  buildings: Building[],
  getHeightAt: (x: number, z: number) => number,
  seededRandom: (seed: number) => () => number
): void {
  const rand = seededRandom(77777);
  const containerPositions: THREE.Matrix4[] = [];
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Matrix4();

  for (const b of buildings) {
    if (rand() > 0.35) continue;
    const cx = b.x + b.width + 2;
    const cz = b.z + Math.floor(b.depth / 2);
    const h = getHeightAt(cx, cz);
    if (h <= WATER_LEVEL) continue;
    const angle = Math.floor(rand() * 4) * Math.PI * 0.5;
    rotation.makeRotationY(angle);
    matrix.makeTranslation(cx, h + 1.0, cz);
    matrix.multiply(rotation);
    containerPositions.push(matrix.clone());

    // Occasionally add a second container on the other side
    if (rand() < 0.4) {
      const cx2 = b.x - 3;
      const cz2 = b.z + Math.floor(b.depth / 2);
      const h2 = getHeightAt(cx2, cz2);
      if (h2 > WATER_LEVEL) {
        rotation.makeRotationY(rand() * Math.PI * 2);
        matrix.makeTranslation(cx2, h2 + 1.0, cz2);
        matrix.multiply(rotation);
        containerPositions.push(matrix.clone());
      }
    }
  }

  if (containerPositions.length > 0) {
    const containerGeo = new THREE.BoxGeometry(2.0, 2.0, 4.0);
    const containerMat = new THREE.MeshLambertMaterial({ color: 0x4a6a8a });
    const containerMesh = new THREE.InstancedMesh(containerGeo, containerMat, containerPositions.length);
    containerMesh.castShadow = true;
    containerMesh.receiveShadow = true;
    for (let i = 0; i < containerPositions.length; i++) {
      containerMesh.setMatrixAt(i, containerPositions[i]);
    }
    containerMesh.instanceMatrix.needsUpdate = true;
    scene.add(containerMesh);
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

