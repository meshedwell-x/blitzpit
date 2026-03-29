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
  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      const nx = x / WORLD_SIZE;
      const nz = z / WORLD_SIZE;

      let h = noise.fbm(nx * 3, nz * 3, 4, 2, 0.45);
      h = (h + 1) / 2;

      // Island falloff
      const dx = (x - WORLD_SIZE / 2) / (WORLD_SIZE / 2);
      const dz = (z - WORLD_SIZE / 2) / (WORLD_SIZE / 2);
      const dist = Math.sqrt(dx * dx + dz * dz);
      const falloff = Math.max(0, 1 - dist * 1.1);
      h *= falloff;

      const height = Math.floor(h * 20) + WATER_LEVEL;
      heightMap[x + z * WORLD_SIZE] = height;
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
