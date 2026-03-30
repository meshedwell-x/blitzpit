import * as THREE from 'three';
import { SimplexNoise } from '../core/noise';
import {
  WORLD_SIZE, BLOCK_TYPES, BLOCK_COLORS,
  WATER_LEVEL,
} from '../core/constants';
import { BiomeSystem } from './BiomeSystem';

export function generateHeightMap(
  noise: SimplexNoise,
  heightMap: Float32Array
): void {
  const biomeSystem = new BiomeSystem();

  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      const nx = x / WORLD_SIZE;
      const nz = z / WORLD_SIZE;

      let h = noise.fbm(nx * 3, nz * 3, 4, 2, 0.45);
      h = (h + 1) / 2;

      // Island falloff with coastal noise for irregular shoreline
      const dx = (x - WORLD_SIZE / 2) / (WORLD_SIZE / 2);
      const dz = (z - WORLD_SIZE / 2) / (WORLD_SIZE / 2);
      const dist = Math.sqrt(dx * dx + dz * dz);
      const coastNoise = noise.fbm(nx * 5, nz * 5, 2, 2, 0.5) * 0.15;
      const falloff = Math.max(0, 1 - (dist * 1.1) + coastNoise);
      h *= falloff;

      // Biome-based height scale
      const worldX = x - WORLD_SIZE / 2;
      const worldZ = z - WORLD_SIZE / 2;
      const biome = biomeSystem.getBiome(worldX, worldZ);
      let heightScale = 20;

      if (biome === 'tundra') {
        heightScale = 45;
        h += noise.fbm(nx * 1.5, nz * 1.5, 3, 2.5, 0.6) * 0.3;
      } else if (biome === 'desert') {
        heightScale = 25;
        h += Math.sin(nx * 8 * Math.PI) * Math.cos(nz * 6 * Math.PI) * 0.15;
      } else if (biome === 'jungle') {
        heightScale = 30;
      } else {
        // urban -- flat
        heightScale = 15;
      }

      const height = Math.floor(h * heightScale) + WATER_LEVEL;
      heightMap[x + z * WORLD_SIZE] = height;
    }
  }
}

export function generateRiver(noise: SimplexNoise, heightMap: Float32Array): void {
  const riverWidth = 8;

  for (let x = 0; x < WORLD_SIZE; x++) {
    const riverNoise = noise.noise2D(x * 0.01, 0.5) * 80;
    const centerZ = WORLD_SIZE / 2 + riverNoise;

    for (let dz = -riverWidth / 2; dz < riverWidth / 2; dz++) {
      const iz = Math.floor(centerZ + dz);
      if (iz < 0 || iz >= WORLD_SIZE) continue;
      // Carve river -- set to below water level
      heightMap[x + iz * WORLD_SIZE] = Math.min(
        heightMap[x + iz * WORLD_SIZE],
        WATER_LEVEL - 1
      );
    }
  }
}

export function generateRoads(
  heightMap: Float32Array,
  villages: Array<{ cx: number; cz: number }>
): void {
  for (const village of villages) {
    carveRoad(heightMap, 0, 0, village.cx, village.cz);
  }
}

function carveRoad(
  heightMap: Float32Array,
  x1: number, z1: number,
  x2: number, z2: number
): void {
  const dist = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
  const steps = Math.ceil(dist);
  const roadWidth = 3;

  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const rx = x1 + (x2 - x1) * t;
    const rz = z1 + (z2 - z1) * t;

    for (let ddx = -roadWidth; ddx <= roadWidth; ddx++) {
      for (let ddz = -roadWidth; ddz <= roadWidth; ddz++) {
        const ix = Math.floor(rx + WORLD_SIZE / 2 + ddx);
        const iz = Math.floor(rz + WORLD_SIZE / 2 + ddz);
        if (ix >= 0 && ix < WORLD_SIZE && iz >= 0 && iz < WORLD_SIZE) {
          const currentH = heightMap[ix + iz * WORLD_SIZE];
          if (currentH > WATER_LEVEL + 1) {
            heightMap[ix + iz * WORLD_SIZE] = Math.max(WATER_LEVEL + 2, currentH - 3);
          }
        }
      }
    }
  }
}

export function buildTerrainMesh(
  scene: THREE.Scene,
  heightMap: Float32Array
): void {
  // Sample every 8 blocks for large map performance
  const step = 8;
  const blockGeo = new THREE.BoxGeometry(step, 2, step);

  const grassPositions: THREE.Matrix4[] = [];
  const dirtPositions: THREE.Matrix4[] = [];
  const sandPositions: THREE.Matrix4[] = [];

  const matrix = new THREE.Matrix4();

  for (let x = 0; x < WORLD_SIZE; x += step) {
    for (let z = 0; z < WORLD_SIZE; z += step) {
      const worldX = x - WORLD_SIZE / 2;
      const worldZ = z - WORLD_SIZE / 2;
      const height = heightMap[x + z * WORLD_SIZE];

      if (height > WATER_LEVEL + 1) {
        matrix.makeTranslation(worldX, height, worldZ);
        grassPositions.push(matrix.clone());

        // Dirt layer below
        matrix.makeTranslation(worldX, height - 1, worldZ);
        dirtPositions.push(matrix.clone());
      } else if (height > WATER_LEVEL - 1) {
        matrix.makeTranslation(worldX, height, worldZ);
        sandPositions.push(matrix.clone());
      }
    }
  }

  // Create instanced meshes
  if (grassPositions.length > 0) {
    const grassMat = new THREE.MeshLambertMaterial({ color: BLOCK_COLORS[BLOCK_TYPES.GRASS], vertexColors: false });
    const grassMesh = new THREE.InstancedMesh(blockGeo, grassMat, grassPositions.length);
    grassMesh.receiveShadow = true;
    grassMesh.castShadow = true;
    // Per-instance biome color
    const biomeSystem = new BiomeSystem();
    const colorArr = new Float32Array(grassPositions.length * 3);
    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3();
    for (let i = 0; i < grassPositions.length; i++) {
      grassPositions[i].decompose(tmpPos, tmpQuat, tmpScale);
      const b = biomeSystem.getBiome(tmpPos.x, tmpPos.z);
      const c = new THREE.Color(biomeSystem.getBiomeColor(b));
      colorArr[i * 3] = c.r;
      colorArr[i * 3 + 1] = c.g;
      colorArr[i * 3 + 2] = c.b;
      grassMesh.setMatrixAt(i, grassPositions[i]);
    }
    grassMesh.instanceColor = new THREE.InstancedBufferAttribute(colorArr, 3);
    grassMesh.instanceColor.needsUpdate = true;
    grassMesh.instanceMatrix.needsUpdate = true;
    scene.add(grassMesh);
  }

  if (dirtPositions.length > 0) {
    const dirtMat = new THREE.MeshLambertMaterial({ color: BLOCK_COLORS[BLOCK_TYPES.DIRT] });
    const dirtMesh = new THREE.InstancedMesh(blockGeo, dirtMat, dirtPositions.length);
    dirtMesh.receiveShadow = true;
    for (let i = 0; i < dirtPositions.length; i++) {
      dirtMesh.setMatrixAt(i, dirtPositions[i]);
    }
    dirtMesh.instanceMatrix.needsUpdate = true;
    scene.add(dirtMesh);
  }

  if (sandPositions.length > 0) {
    const sandMat = new THREE.MeshLambertMaterial({ color: BLOCK_COLORS[BLOCK_TYPES.SAND] });
    const sandMesh = new THREE.InstancedMesh(blockGeo, sandMat, sandPositions.length);
    sandMesh.receiveShadow = true;
    for (let i = 0; i < sandPositions.length; i++) {
      sandMesh.setMatrixAt(i, sandPositions[i]);
    }
    sandMesh.instanceMatrix.needsUpdate = true;
    scene.add(sandMesh);
  }
}

export function addGroundPlane(scene: THREE.Scene): void {
  // Large green ground plane as base
  const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE * 1.5, WORLD_SIZE * 1.5);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x4a7a3a });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = WATER_LEVEL - 0.5;
  ground.receiveShadow = true;
  scene.add(ground);
}

export function addWater(scene: THREE.Scene): void {
  // Single opaque water plane well below terrain to eliminate z-fighting
  const waterGeo = new THREE.PlaneGeometry(WORLD_SIZE * 8, WORLD_SIZE * 8);
  const waterMat = new THREE.MeshLambertMaterial({
    color: 0x2d6ea3,
    side: THREE.FrontSide,
    depthWrite: false,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL - 1.0;
  water.renderOrder = -1;
  scene.add(water);
}
