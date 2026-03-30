import * as THREE from 'three';
import {
  WORLD_SIZE, BLOCK_SIZE, BLOCK_TYPES, BLOCK_COLORS,
} from '../core/constants';

export interface Building {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  type: 'house' | 'warehouse' | 'tower' | 'bunker' | 'apartment' | 'ruin' | 'shop';
}

export function generateBuildings(
  buildings: Building[],
  seededRandom: (seed: number) => () => number
): void {
  const rand = seededRandom(12345);

  // Central main city (radius 80, dense)
  const mainCityCount = 45 + Math.floor(rand() * 15);
  spawnCluster(buildings, rand, 0, 0, 80, mainCityCount, true);

  // 6 outer villages at distance 150-250
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + rand() * 0.5;
    const dist = 150 + rand() * 100;
    const cx = Math.cos(angle) * dist;
    const cz = Math.sin(angle) * dist;
    const count = 5 + Math.floor(rand() * 8);
    spawnCluster(buildings, rand, cx, cz, 30, count, false);
  }

  // Additional scattered clusters for map density
  for (let c = 0; c < 12; c++) {
    const cx = (rand() - 0.5) * WORLD_SIZE * 0.55;
    const cz = (rand() - 0.5) * WORLD_SIZE * 0.55;
    const count = 6 + Math.floor(rand() * 10);
    spawnCluster(buildings, rand, cx, cz, 35, count, false);
  }
}

function spawnCluster(
  buildings: Building[],
  rand: () => number,
  cx: number, cz: number,
  clusterRadius: number,
  count: number,
  isMainCity: boolean
): void {
  // Main city gets more apartments and towers; villages get houses/shops/ruins
  const types: Building['type'][] = isMainCity
    ? ['house', 'warehouse', 'tower', 'apartment', 'apartment', 'tower', 'shop', 'ruin']
    : ['house', 'house', 'warehouse', 'bunker', 'apartment', 'ruin', 'shop'];

  for (let b = 0; b < count; b++) {
    const bx = cx + (rand() - 0.5) * clusterRadius * 2;
    const bz = cz + (rand() - 0.5) * clusterRadius * 2;
    const type = types[Math.floor(rand() * types.length)];

    let width: number, depth: number, height: number;
    switch (type) {
      case 'house':
        width = 5 + Math.floor(rand() * 3);
        depth = 5 + Math.floor(rand() * 3);
        height = 4 + Math.floor(rand() * 2);
        break;
      case 'warehouse':
        width = 7 + Math.floor(rand() * 4);
        depth = 8 + Math.floor(rand() * 5);
        height = 4 + Math.floor(rand() * 2);
        break;
      case 'tower':
        width = 4 + Math.floor(rand() * 2);
        depth = 4 + Math.floor(rand() * 2);
        height = 8 + Math.floor(rand() * 8);
        break;
      case 'bunker':
        width = 5 + Math.floor(rand() * 3);
        depth = 5 + Math.floor(rand() * 3);
        height = 3;
        break;
      case 'apartment':
        width = 6 + Math.floor(rand() * 3);
        depth = 6 + Math.floor(rand() * 3);
        height = 10 + Math.floor(rand() * 8);
        break;
      case 'ruin':
        width = 4 + Math.floor(rand() * 5);
        depth = 4 + Math.floor(rand() * 5);
        height = 2 + Math.floor(rand() * 3);
        break;
      case 'shop':
        width = 4 + Math.floor(rand() * 2);
        depth = 3 + Math.floor(rand() * 2);
        height = 3;
        break;
      default:
        width = 5; depth = 5; height = 4;
    }

    buildings.push({ x: Math.floor(bx), z: Math.floor(bz), width, depth, height, type });
  }
}

export function buildBuildingMeshes(
  scene: THREE.Scene,
  buildings: Building[],
  getHeightAt: (x: number, z: number) => number
): void {
  const blockGeo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  const brickPositions: THREE.Matrix4[] = [];
  const concretePositions: THREE.Matrix4[] = [];
  const glassPositions: THREE.Matrix4[] = [];
  const roofPositions: THREE.Matrix4[] = [];
  const cratePositions: THREE.Matrix4[] = [];
  const ruinPositions: THREE.Matrix4[] = [];
  const shopPositions: THREE.Matrix4[] = [];
  const matrix = new THREE.Matrix4();

  // Deterministic ruin seed per building index
  let ruinRandState = 77777;
  const ruinRand = () => {
    ruinRandState = (ruinRandState * 16807 + 0) % 2147483647;
    return ruinRandState / 2147483647;
  };

  for (const b of buildings) {
    const baseHeight = getHeightAt(b.x, b.z);

    let wallBlock: 'concrete' | 'brick' | 'shop';
    if (b.type === 'bunker') wallBlock = 'concrete';
    else if (b.type === 'shop') wallBlock = 'shop';
    else wallBlock = 'brick';

    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        for (let z = 0; z < b.depth; z++) {
          const isWall = x === 0 || x === b.width - 1 || z === 0 || z === b.depth - 1;
          const isFloor = y === 0;
          const isRoof = y === b.height - 1;

          // Door
          const isDoor = y < 2 && x === Math.floor(b.width / 2) && z === 0;
          // Window
          const isWindow = y >= 2 && y < b.height - 1 && isWall &&
            ((x > 1 && x < b.width - 2 && (z === 0 || z === b.depth - 1)) ||
             (z > 1 && z < b.depth - 2 && (x === 0 || x === b.width - 1))) &&
            (x + z) % 3 === 0;

          if (isDoor) continue;

          // Ruin: skip 40% of blocks randomly for destroyed look
          if (b.type === 'ruin' && ruinRand() < 0.4) continue;

          const px = b.x + x;
          const py = baseHeight + y + 1;
          const pz = b.z + z;

          if (isRoof) {
            matrix.makeTranslation(px, py, pz);
            if (b.type === 'ruin') {
              ruinPositions.push(matrix.clone());
            } else {
              roofPositions.push(matrix.clone());
            }
          } else if (isWall || isFloor) {
            matrix.makeTranslation(px, py, pz);
            if (isWindow) {
              glassPositions.push(matrix.clone());
            } else if (b.type === 'ruin') {
              ruinPositions.push(matrix.clone());
            } else if (b.type === 'shop') {
              shopPositions.push(matrix.clone());
            } else if (wallBlock === 'concrete') {
              concretePositions.push(matrix.clone());
            } else {
              brickPositions.push(matrix.clone());
            }
          }
        }
      }
    }

    // Crate inside (skip for ruins -- they are looted)
    if (b.type !== 'ruin') {
      matrix.makeTranslation(
        b.x + Math.floor(b.width / 2),
        baseHeight + 1,
        b.z + Math.floor(b.depth / 2)
      );
      cratePositions.push(matrix.clone());
    }
  }

  const createBatch = (positions: THREE.Matrix4[], color: string, transparent = false) => {
    if (positions.length === 0) return;
    const mat = new THREE.MeshLambertMaterial({ color });
    if (transparent) { mat.transparent = true; mat.opacity = 0.4; }
    const mesh = new THREE.InstancedMesh(blockGeo, mat, positions.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    for (let i = 0; i < positions.length; i++) {
      mesh.setMatrixAt(i, positions[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  };

  createBatch(brickPositions, BLOCK_COLORS[BLOCK_TYPES.BRICK]);
  createBatch(concretePositions, BLOCK_COLORS[BLOCK_TYPES.CONCRETE]);
  createBatch(glassPositions, BLOCK_COLORS[BLOCK_TYPES.GLASS], true);
  createBatch(roofPositions, BLOCK_COLORS[BLOCK_TYPES.ROOF]);
  createBatch(cratePositions, BLOCK_COLORS[BLOCK_TYPES.CRATE]);
  // Ruin: dark crumbling grey
  createBatch(ruinPositions, '#7a7060');
  // Shop: light warm beige
  createBatch(shopPositions, '#d4b896');
}
