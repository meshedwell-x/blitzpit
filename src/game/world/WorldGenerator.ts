import * as THREE from 'three';
import { SimplexNoise } from '../core/noise';
import {
  WORLD_SIZE, BLOCK_SIZE, BLOCK_TYPES, BLOCK_COLORS,
  WATER_LEVEL,
} from '../core/constants';
import { BiomeSystem } from './BiomeSystem';

interface Building {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  type: 'house' | 'warehouse' | 'tower' | 'bunker';
}

interface POILocation {
  type: string;
  x: number;
  z: number;
  radius: number;
}

interface ItemSpawn {
  position: THREE.Vector3;
  type: string;
  weaponId?: string;
}

export class WorldGenerator {
  private noise: SimplexNoise;
  private heightMap: Float32Array;
  private buildings: Building[] = [];
  private buildingGrid: Map<string, Building[]> = new Map();
  private gridCellSize = 30;
  itemSpawns: ItemSpawn[] = [];
  treePositions: THREE.Vector3[] = [];
  poiLocations: POILocation[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, seed: number = 42) {
    this.scene = scene;
    this.noise = new SimplexNoise(seed);
    this.heightMap = new Float32Array(WORLD_SIZE * WORLD_SIZE);
  }

  generate(): void {
    this.generateHeightMap();
    this.generateBuildings();
    this.buildTerrainMesh();
    this.buildBuildingMeshes();
    this.generateTrees();
    this.generateRocks();
    this.generateItemSpawns();
    this.addGroundPlane();
    this.addWater();
    this.generatePOIs();
    this.buildBuildingGrid();
  }

  private buildBuildingGrid(): void {
    this.buildingGrid.clear();
    for (const b of this.buildings) {
      const minCx = Math.floor(b.x / this.gridCellSize);
      const maxCx = Math.floor((b.x + b.width) / this.gridCellSize);
      const minCz = Math.floor(b.z / this.gridCellSize);
      const maxCz = Math.floor((b.z + b.depth) / this.gridCellSize);
      for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cz = minCz; cz <= maxCz; cz++) {
          const key = `${cx},${cz}`;
          if (!this.buildingGrid.has(key)) this.buildingGrid.set(key, []);
          this.buildingGrid.get(key)!.push(b);
        }
      }
    }
  }

  getNearbyBuildings(x: number, z: number): Building[] {
    const cx = Math.floor(x / this.gridCellSize);
    const cz = Math.floor(z / this.gridCellSize);
    const result: Building[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${cx + dx},${cz + dz}`;
        const cell = this.buildingGrid.get(key);
        if (cell) {
          for (const b of cell) {
            if (!result.includes(b)) result.push(b);
          }
        }
      }
    }
    return result;
  }

  private generateHeightMap(): void {
    for (let x = 0; x < WORLD_SIZE; x++) {
      for (let z = 0; z < WORLD_SIZE; z++) {
        const nx = x / WORLD_SIZE;
        const nz = z / WORLD_SIZE;

        let h = this.noise.fbm(nx * 3, nz * 3, 4, 2, 0.45);
        h = (h + 1) / 2;

        // Island falloff
        const dx = (x - WORLD_SIZE / 2) / (WORLD_SIZE / 2);
        const dz = (z - WORLD_SIZE / 2) / (WORLD_SIZE / 2);
        const dist = Math.sqrt(dx * dx + dz * dz);
        const falloff = Math.max(0, 1 - dist * 1.1);
        h *= falloff;

        const height = Math.floor(h * 20) + WATER_LEVEL;
        this.heightMap[x + z * WORLD_SIZE] = height;
      }
    }
  }

  getHeightAt(x: number, z: number): number {
    const ix = Math.floor(x + WORLD_SIZE / 2);
    const iz = Math.floor(z + WORLD_SIZE / 2);
    if (ix < 0 || ix >= WORLD_SIZE || iz < 0 || iz >= WORLD_SIZE) return WATER_LEVEL;
    let height = this.heightMap[ix + iz * WORLD_SIZE];

    // Smooth terrain falloff near world edges (within 200 units of boundary)
    const halfWorld = WORLD_SIZE / 2;
    const edgeDist = Math.min(
      x - (-halfWorld), halfWorld - x,
      z - (-halfWorld), halfWorld - z
    );
    const edgeFalloff = 200;
    if (edgeDist < edgeFalloff) {
      const edgeFactor = Math.max(0, edgeDist / edgeFalloff);
      height = WATER_LEVEL + (height - WATER_LEVEL) * edgeFactor * edgeFactor;
    }

    return height;
  }

  private generateBuildings(): void {
    const rand = this.seededRandom(12345);
    const cityCount = 40;

    for (let c = 0; c < cityCount; c++) {
      const cx = (rand() - 0.5) * WORLD_SIZE * 0.7;
      const cz = (rand() - 0.5) * WORLD_SIZE * 0.7;
      const buildingCount = 15 + Math.floor(rand() * 18);

      for (let b = 0; b < buildingCount; b++) {
        const bx = cx + (rand() - 0.5) * 50;
        const bz = cz + (rand() - 0.5) * 50;
        const types: Building['type'][] = ['house', 'warehouse', 'tower', 'bunker'];
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
        }

        this.buildings.push({ x: Math.floor(bx), z: Math.floor(bz), width, depth, height, type });
      }
    }
  }

  private addGroundPlane(): void {
    // Large green ground plane as base
    const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE * 1.5, WORLD_SIZE * 1.5);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x4a7a3a });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = WATER_LEVEL - 0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private addWater(): void {
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
    this.scene.add(water);
  }

  private buildTerrainMesh(): void {
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
        const height = this.heightMap[x + z * WORLD_SIZE];

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
      this.scene.add(grassMesh);
    }

    if (dirtPositions.length > 0) {
      const dirtMat = new THREE.MeshLambertMaterial({ color: BLOCK_COLORS[BLOCK_TYPES.DIRT] });
      const dirtMesh = new THREE.InstancedMesh(blockGeo, dirtMat, dirtPositions.length);
      dirtMesh.receiveShadow = true;
      for (let i = 0; i < dirtPositions.length; i++) {
        dirtMesh.setMatrixAt(i, dirtPositions[i]);
      }
      dirtMesh.instanceMatrix.needsUpdate = true;
      this.scene.add(dirtMesh);
    }

    if (sandPositions.length > 0) {
      const sandMat = new THREE.MeshLambertMaterial({ color: BLOCK_COLORS[BLOCK_TYPES.SAND] });
      const sandMesh = new THREE.InstancedMesh(blockGeo, sandMat, sandPositions.length);
      sandMesh.receiveShadow = true;
      for (let i = 0; i < sandPositions.length; i++) {
        sandMesh.setMatrixAt(i, sandPositions[i]);
      }
      sandMesh.instanceMatrix.needsUpdate = true;
      this.scene.add(sandMesh);
    }
  }

  private buildBuildingMeshes(): void {
    const blockGeo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    const brickPositions: THREE.Matrix4[] = [];
    const concretePositions: THREE.Matrix4[] = [];
    const glassPositions: THREE.Matrix4[] = [];
    const roofPositions: THREE.Matrix4[] = [];
    const cratePositions: THREE.Matrix4[] = [];
    const matrix = new THREE.Matrix4();

    for (const b of this.buildings) {
      const baseHeight = this.getHeightAt(b.x, b.z);
      const wallBlock = b.type === 'bunker' ? 'concrete' : 'brick';

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

            const px = b.x + x;
            const py = baseHeight + y + 1;
            const pz = b.z + z;

            if (isRoof) {
              matrix.makeTranslation(px, py, pz);
              roofPositions.push(matrix.clone());
            } else if (isWall || isFloor) {
              matrix.makeTranslation(px, py, pz);
              if (isWindow) {
                glassPositions.push(matrix.clone());
              } else if (wallBlock === 'concrete') {
                concretePositions.push(matrix.clone());
              } else {
                brickPositions.push(matrix.clone());
              }
            }
          }
        }
      }

      // Crate inside
      matrix.makeTranslation(
        b.x + Math.floor(b.width / 2),
        baseHeight + 1,
        b.z + Math.floor(b.depth / 2)
      );
      cratePositions.push(matrix.clone());
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
      this.scene.add(mesh);
    };

    createBatch(brickPositions, BLOCK_COLORS[BLOCK_TYPES.BRICK]);
    createBatch(concretePositions, BLOCK_COLORS[BLOCK_TYPES.CONCRETE]);
    createBatch(glassPositions, BLOCK_COLORS[BLOCK_TYPES.GLASS], true);
    createBatch(roofPositions, BLOCK_COLORS[BLOCK_TYPES.ROOF]);
    createBatch(cratePositions, BLOCK_COLORS[BLOCK_TYPES.CRATE]);
  }

  private generateRocks(): void {
    const rand = this.seededRandom(55555);
    const rockPositions: THREE.Matrix4[] = [];
    const matrix = new THREE.Matrix4();
    const count = 1200;

    for (let i = 0; i < count; i++) {
      const x = Math.floor((rand() - 0.5) * WORLD_SIZE * 0.8);
      const z = Math.floor((rand() - 0.5) * WORLD_SIZE * 0.8);
      const height = this.getHeightAt(x, z);

      if (height <= WATER_LEVEL + 1) continue;

      const inBuilding = this.buildings.some(b =>
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
      this.scene.add(rockMesh);
    }
  }

  private generateTrees(): void {
    const rand = this.seededRandom(9999);
    const trunkPositions: THREE.Matrix4[] = [];
    const leafPositions: THREE.Matrix4[] = [];
    const matrix = new THREE.Matrix4();

    for (let i = 0; i < 6000; i++) {
      const x = Math.floor((rand() - 0.5) * WORLD_SIZE * 0.8);
      const z = Math.floor((rand() - 0.5) * WORLD_SIZE * 0.8);
      const height = this.getHeightAt(x, z);

      if (height <= WATER_LEVEL + 1) continue;

      const inBuilding = this.buildings.some(b =>
        x >= b.x - 2 && x <= b.x + b.width + 2 &&
        z >= b.z - 2 && z <= b.z + b.depth + 2
      );
      if (inBuilding) continue;

      const trunkHeight = 3 + Math.floor(rand() * 3);

      this.treePositions.push(new THREE.Vector3(x, height, z));

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
      this.scene.add(trunkMesh);
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
      this.scene.add(leafMesh);
    }
  }

  private generateItemSpawns(): void {
    const rand = this.seededRandom(7777);
    const weaponIds = ['pistol', 'shotgun', 'smg', 'assault', 'sniper'];
    const rarityWeights = [0.35, 0.25, 0.20, 0.15, 0.05];

    for (const b of this.buildings) {
      const baseHeight = this.getHeightAt(b.x, b.z);
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
          this.itemSpawns.push({
            position: new THREE.Vector3(ix, baseHeight + 1.5, iz),
            type: 'weapon',
            weaponId: weaponIds[weaponIdx],
          });
        } else if (rand() < 0.5) {
          this.itemSpawns.push({
            position: new THREE.Vector3(ix, baseHeight + 1.5, iz),
            type: 'health',
          });
        } else {
          this.itemSpawns.push({
            position: new THREE.Vector3(ix, baseHeight + 1.5, iz),
            type: 'ammo',
          });
        }
      }
    }

    for (let i = 0; i < 800; i++) {
      const x = (rand() - 0.5) * WORLD_SIZE * 0.6;
      const z = (rand() - 0.5) * WORLD_SIZE * 0.6;
      const h = this.getHeightAt(x, z);
      if (h <= WATER_LEVEL) continue;

      let r = rand();
      let weaponIdx = 0;
      for (let w = 0; w < rarityWeights.length; w++) {
        r -= rarityWeights[w];
        if (r <= 0) { weaponIdx = w; break; }
      }

      this.itemSpawns.push({
        position: new THREE.Vector3(x, h + 1, z),
        type: 'weapon',
        weaponId: weaponIds[weaponIdx],
      });
    }
  }

  private generatePOIs(): void {
    const rand = this.seededRandom(31337);

    // Military Base -- 2 locations near map edge
    for (let i = 0; i < 2; i++) {
      const angle = (i / 2) * Math.PI * 2 + rand() * Math.PI * 0.5;
      const dist = WORLD_SIZE * 0.35;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      this.poiLocations.push({ type: 'military', x, z, radius: 30 });
      this.generateMilitaryBase(x, z, rand);
    }

    // Temple -- near map center
    this.poiLocations.push({ type: 'temple', x: 20, z: 20, radius: 20 });
    this.generateTemple(20, 20, rand);

    // Gas Station -- 3 scattered locations
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + rand() * Math.PI * 0.3;
      const dist = 80 + rand() * 100;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      this.poiLocations.push({ type: 'gas_station', x, z, radius: 10 });
      this.generateGasStation(x, z, rand);
    }
  }

  private generateMilitaryBase(cx: number, cz: number, rand: () => number): void {
    const blockGeo = new THREE.BoxGeometry(1, 1, 1);
    const concreteMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const positions: THREE.Matrix4[] = [];
    const matrix = new THREE.Matrix4();

    // 4 bunkers around center
    for (let b = 0; b < 4; b++) {
      const bx = cx + Math.cos(b * Math.PI / 2) * 15;
      const bz = cz + Math.sin(b * Math.PI / 2) * 15;
      const bh = this.getHeightAt(bx, bz);
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
      this.buildings.push({ x: Math.floor(bx), z: Math.floor(bz), width: 6, depth: 6, height: 3, type: 'bunker' });
    }

    // Watch tower at center (height 12)
    const towerX = cx;
    const towerZ = cz;
    const towerH = this.getHeightAt(towerX, towerZ);
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
    this.buildings.push({ x: Math.floor(towerX - 1), z: Math.floor(towerZ - 1), width: 3, depth: 3, height: 12, type: 'tower' });

    if (positions.length > 0) {
      const mesh = new THREE.InstancedMesh(blockGeo, concreteMat, positions.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      for (let i = 0; i < positions.length; i++) {
        mesh.setMatrixAt(i, positions[i]);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
    }

    // High-tier item spawns inside military base
    for (let i = 0; i < 8; i++) {
      const ix = cx + (rand() - 0.5) * 20;
      const iz = cz + (rand() - 0.5) * 20;
      const ih = this.getHeightAt(ix, iz);
      const weapons = ['assault', 'sniper', 'assault', 'sniper'];
      this.itemSpawns.push({
        position: new THREE.Vector3(ix, ih + 1.5, iz),
        type: 'weapon',
        weaponId: weapons[Math.floor(rand() * weapons.length)],
      });
    }
    for (let i = 0; i < 3; i++) {
      const ix = cx + (rand() - 0.5) * 15;
      const iz = cz + (rand() - 0.5) * 15;
      const ih = this.getHeightAt(ix, iz);
      this.itemSpawns.push({
        position: new THREE.Vector3(ix, ih + 1.5, iz),
        type: 'armor',
      });
    }
  }

  private generateTemple(cx: number, cz: number, rand: () => number): void {
    const baseH = this.getHeightAt(cx, cz);
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
      this.scene.add(mesh);
    }

    if (goldPositions.length > 0) {
      const mesh = new THREE.InstancedMesh(blockGeo, goldMat, goldPositions.length);
      mesh.castShadow = true;
      for (let i = 0; i < goldPositions.length; i++) mesh.setMatrixAt(i, goldPositions[i]);
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
    }

    this.buildings.push({ x: Math.floor(cx - 8), z: Math.floor(cz - 8), width: 16, depth: 16, height: 13, type: 'tower' });

    // Epic weapon spawn at temple top
    this.itemSpawns.push({
      position: new THREE.Vector3(cx, currentY + 1, cz),
      type: 'weapon',
      weaponId: rand() > 0.5 ? 'sniper' : 'assault',
    });
  }

  private generateGasStation(cx: number, cz: number, rand: () => number): void {
    const baseH = this.getHeightAt(cx, cz);
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
      this.scene.add(mesh);
    }
    if (roofPositions.length > 0) {
      const mesh = new THREE.InstancedMesh(blockGeo, roofMat, roofPositions.length);
      for (let i = 0; i < roofPositions.length; i++) mesh.setMatrixAt(i, roofPositions[i]);
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
    }

    // Ammo + health spawns
    for (let i = 0; i < 4; i++) {
      const ix = cx + (rand() - 0.5) * 6;
      const iz = cz + (rand() - 0.5) * 4;
      this.itemSpawns.push({
        position: new THREE.Vector3(ix, baseH + 1.5, iz),
        type: rand() > 0.5 ? 'ammo' : 'health',
      });
    }
  }

  getEffectiveHeightAt(x: number, z: number): number {
    const h = this.getHeightAt(x, z);
    for (const b of this.getNearbyBuildings(x, z)) {
      if (x >= b.x && x <= b.x + b.width && z >= b.z && z <= b.z + b.depth) {
        const baseH = this.getHeightAt(b.x, b.z);
        return Math.max(h, baseH + b.height);
      }
    }
    return h;
  }

  getBuildings(): Building[] {
    return this.buildings;
  }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
  }
}
