import * as THREE from 'three';
import { WORLD_SIZE } from '../core/constants';
import { Building } from './BuildingGenerator';
import { ItemSpawn, POILocation } from './VegetationGenerator';

export function generatePOIs(
  scene: THREE.Scene,
  buildings: Building[],
  itemSpawns: ItemSpawn[],
  poiLocations: POILocation[],
  getHeightAt: (x: number, z: number) => number,
  seededRandom: (seed: number) => () => number
): void {
  const rand = seededRandom(31337);

  // Military Base -- 2 locations near map edge
  for (let i = 0; i < 2; i++) {
    const angle = (i / 2) * Math.PI * 2 + rand() * Math.PI * 0.5;
    const dist = WORLD_SIZE * 0.35;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    poiLocations.push({ type: 'military', x, z, radius: 30 });
    generateMilitaryBase(scene, buildings, itemSpawns, x, z, rand, getHeightAt);
  }

  // Temple -- near map center
  poiLocations.push({ type: 'temple', x: 20, z: 20, radius: 20 });
  generateTemple(scene, buildings, itemSpawns, 20, 20, rand, getHeightAt);

  // Gas Station -- 3 scattered locations
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + rand() * Math.PI * 0.3;
    const dist = 80 + rand() * 100;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    poiLocations.push({ type: 'gas_station', x, z, radius: 10 });
    generateGasStation(scene, itemSpawns, x, z, rand, getHeightAt);
  }
}

function generateMilitaryBase(
  scene: THREE.Scene,
  buildings: Building[],
  itemSpawns: ItemSpawn[],
  cx: number, cz: number,
  rand: () => number,
  getHeightAt: (x: number, z: number) => number
): void {
  const blockGeo = new THREE.BoxGeometry(1, 1, 1);
  const concreteMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const positions: THREE.Matrix4[] = [];
  const matrix = new THREE.Matrix4();

  // 4 bunkers around center
  for (let b = 0; b < 4; b++) {
    const bx = cx + Math.cos(b * Math.PI / 2) * 15;
    const bz = cz + Math.sin(b * Math.PI / 2) * 15;
    const bh = getHeightAt(bx, bz);
    for (let x = 0; x < 6; x++) {
      for (let z = 0; z < 6; z++) {
        for (let y = 0; y < 3; y++) {
          const isWall = x === 0 || x === 5 || z === 0 || z === 5;
          const isFloor = y === 0;
          const isRoof = y === 2;
          const isDoor = y < 2 && x === 3 && z === 0;
          if ((isWall || isFloor || isRoof) && !isDoor) {
            matrix.makeTranslation(bx + x, bh + y + 1, bz + z);
            positions.push(matrix.clone());
          }
        }
      }
    }
    buildings.push({ x: Math.floor(bx), z: Math.floor(bz), width: 6, depth: 6, height: 3, type: 'bunker' });
  }

  // Watch tower at center (height 12)
  const towerX = cx;
  const towerZ = cz;
  const towerH = getHeightAt(towerX, towerZ);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 3; x++) {
      for (let z = 0; z < 3; z++) {
        const isWall = x === 0 || x === 2 || z === 0 || z === 2;
        if (isWall || y === 0 || y === 11) {
          matrix.makeTranslation(towerX + x - 1, towerH + y + 1, towerZ + z - 1);
          positions.push(matrix.clone());
        }
      }
    }
  }
  buildings.push({ x: Math.floor(towerX - 1), z: Math.floor(towerZ - 1), width: 3, depth: 3, height: 12, type: 'tower' });

  if (positions.length > 0) {
    const mesh = new THREE.InstancedMesh(blockGeo, concreteMat, positions.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    for (let i = 0; i < positions.length; i++) {
      mesh.setMatrixAt(i, positions[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  // High-tier item spawns inside military base
  for (let i = 0; i < 8; i++) {
    const ix = cx + (rand() - 0.5) * 20;
    const iz = cz + (rand() - 0.5) * 20;
    const ih = getHeightAt(ix, iz);
    const weapons = ['assault', 'sniper', 'assault', 'sniper'];
    itemSpawns.push({
      position: new THREE.Vector3(ix, ih + 1.5, iz),
      type: 'weapon',
      weaponId: weapons[Math.floor(rand() * weapons.length)],
    });
  }
  for (let i = 0; i < 3; i++) {
    const ix = cx + (rand() - 0.5) * 15;
    const iz = cz + (rand() - 0.5) * 15;
    const ih = getHeightAt(ix, iz);
    itemSpawns.push({
      position: new THREE.Vector3(ix, ih + 1.5, iz),
      type: 'armor',
    });
  }
}

function generateTemple(
  scene: THREE.Scene,
  buildings: Building[],
  itemSpawns: ItemSpawn[],
  cx: number, cz: number,
  rand: () => number,
  getHeightAt: (x: number, z: number) => number
): void {
  const baseH = getHeightAt(cx, cz);
  const blockGeo = new THREE.BoxGeometry(1, 1, 1);
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xd4af37, emissive: 0xd4af37, emissiveIntensity: 0.15 });
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0xa0a090 });
  const positions: THREE.Matrix4[] = [];
  const goldPositions: THREE.Matrix4[] = [];
  const matrix = new THREE.Matrix4();

  const tiers = [
    { size: 16, height: 3 },
    { size: 12, height: 3 },
    { size: 8, height: 3 },
    { size: 6, height: 2 },
    { size: 4, height: 2 },
  ];

  let currentY = baseH + 1;
  for (const tier of tiers) {
    const half = tier.size / 2;
    for (let x = 0; x < tier.size; x++) {
      for (let z = 0; z < tier.size; z++) {
        for (let y = 0; y < tier.height; y++) {
          const isWall = x === 0 || x === tier.size - 1 || z === 0 || z === tier.size - 1;
          const isFloor = y === 0;
          const isTop = y === tier.height - 1;
          if (isWall || isFloor || isTop) {
            matrix.makeTranslation(cx - half + x, currentY + y, cz - half + z);
            if (isTop && tier.size <= 6) {
              goldPositions.push(matrix.clone());
            } else {
              positions.push(matrix.clone());
            }
          }
        }
      }
    }
    currentY += tier.height;
  }

  if (positions.length > 0) {
    const mesh = new THREE.InstancedMesh(blockGeo, stoneMat, positions.length);
    mesh.castShadow = true;
    for (let i = 0; i < positions.length; i++) mesh.setMatrixAt(i, positions[i]);
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  if (goldPositions.length > 0) {
    const mesh = new THREE.InstancedMesh(blockGeo, goldMat, goldPositions.length);
    mesh.castShadow = true;
    for (let i = 0; i < goldPositions.length; i++) mesh.setMatrixAt(i, goldPositions[i]);
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  buildings.push({ x: Math.floor(cx - 8), z: Math.floor(cz - 8), width: 16, depth: 16, height: 13, type: 'tower' });

  // Epic weapon spawn at temple top
  itemSpawns.push({
    position: new THREE.Vector3(cx, currentY + 1, cz),
    type: 'weapon',
    weaponId: rand() > 0.5 ? 'sniper' : 'assault',
  });
}

function generateGasStation(
  scene: THREE.Scene,
  itemSpawns: ItemSpawn[],
  cx: number, cz: number,
  rand: () => number,
  getHeightAt: (x: number, z: number) => number
): void {
  const baseH = getHeightAt(cx, cz);
  const blockGeo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshLambertMaterial({ color: 0xbbbbbb });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xcc3333 });
  const positions: THREE.Matrix4[] = [];
  const roofPositions: THREE.Matrix4[] = [];
  const matrix = new THREE.Matrix4();

  // 4 pillars + canopy roof (8x6)
  const corners: [number, number][] = [[0, 0], [7, 0], [0, 5], [7, 5]];
  for (const [px, pz] of corners) {
    for (let y = 0; y < 4; y++) {
      matrix.makeTranslation(cx + px - 4, baseH + y + 1, cz + pz - 3);
      positions.push(matrix.clone());
    }
  }
  // Roof
  for (let x = 0; x < 8; x++) {
    for (let z = 0; z < 6; z++) {
      matrix.makeTranslation(cx + x - 4, baseH + 5, cz + z - 3);
      roofPositions.push(matrix.clone());
    }
  }

  if (positions.length > 0) {
    const mesh = new THREE.InstancedMesh(blockGeo, mat, positions.length);
    for (let i = 0; i < positions.length; i++) mesh.setMatrixAt(i, positions[i]);
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }
  if (roofPositions.length > 0) {
    const mesh = new THREE.InstancedMesh(blockGeo, roofMat, roofPositions.length);
    for (let i = 0; i < roofPositions.length; i++) mesh.setMatrixAt(i, roofPositions[i]);
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  // Ammo + health spawns
  for (let i = 0; i < 4; i++) {
    const ix = cx + (rand() - 0.5) * 6;
    const iz = cz + (rand() - 0.5) * 4;
    itemSpawns.push({
      position: new THREE.Vector3(ix, baseH + 1.5, iz),
      type: rand() > 0.5 ? 'ammo' : 'health',
    });
  }
}
