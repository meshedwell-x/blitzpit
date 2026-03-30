import * as THREE from 'three';
import { SimplexNoise } from '../core/noise';
import { WORLD_SIZE, WATER_LEVEL } from '../core/constants';
import { generateHeightMap, generateRiver, generateRoads, buildTerrainMesh, addGroundPlane, addWater } from './TerrainGenerator';
import { Building, generateBuildings, buildBuildingMeshes } from './BuildingGenerator';
import { ItemSpawn, POILocation, generateTrees, generateRocks, generateItemSpawns, generateBushes, generateFences, generateFallenTrees, generateUrbanDetails } from './VegetationGenerator';
import { generatePOIs } from './POIGenerator';

export class WorldGenerator {
  private noise: SimplexNoise;
  private heightMap: Float32Array;
  private buildings: Building[] = [];
  private buildingGrid: Map<string, Building[]> = new Map();
  private gridCellSize = 30;
  itemSpawns: ItemSpawn[] = [];
  treePositions: THREE.Vector3[] = [];
  private treeGrid: Map<string, THREE.Vector3[]> = new Map();
  private treeGridCellSize = 30;
  poiLocations: POILocation[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, seed: number = 42) {
    this.scene = scene;
    this.noise = new SimplexNoise(seed);
    this.heightMap = new Float32Array(WORLD_SIZE * WORLD_SIZE);
  }

  generate(): void {
    generateHeightMap(this.noise, this.heightMap);
    generateRiver(this.noise, this.heightMap);
    // Village positions must match BuildingGenerator layout (6 villages at dist 150-250)
    const rand = this.seededRandom(12345);
    // Skip main city rand calls (same seed pattern as BuildingGenerator)
    for (let i = 0; i < 60; i++) rand(); // burn through main city rand calls
    const villages: Array<{ cx: number; cz: number }> = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + rand() * 0.5;
      const dist = 150 + rand() * 100;
      villages.push({ cx: Math.cos(angle) * dist, cz: Math.sin(angle) * dist });
    }
    generateRoads(this.heightMap, villages);
    generateBuildings(this.buildings, this.seededRandom.bind(this));
    buildTerrainMesh(this.scene, this.heightMap);
    buildBuildingMeshes(this.scene, this.buildings, this.getHeightAt.bind(this));
    generateTrees(this.scene, this.treePositions, this.treeGrid, this.treeGridCellSize, this.buildings, this.getHeightAt.bind(this), this.seededRandom.bind(this));
    generateRocks(this.scene, this.buildings, this.getHeightAt.bind(this), this.seededRandom.bind(this));
    generateBushes(this.scene, this.buildings, this.getHeightAt.bind(this), this.seededRandom.bind(this));
    generateFences(this.scene, this.buildings, this.getHeightAt.bind(this), this.seededRandom.bind(this));
    generateFallenTrees(this.scene, this.buildings, this.getHeightAt.bind(this), this.seededRandom.bind(this));
    generateUrbanDetails(this.scene, this.buildings, this.getHeightAt.bind(this), this.seededRandom.bind(this));
    generateItemSpawns(this.itemSpawns, this.buildings, this.getHeightAt.bind(this), this.seededRandom.bind(this));
    addGroundPlane(this.scene);
    addWater(this.scene);
    generatePOIs(this.scene, this.buildings, this.itemSpawns, this.poiLocations, this.getHeightAt.bind(this), this.seededRandom.bind(this));
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

  getNearbyTrees(x: number, z: number, radius: number): THREE.Vector3[] {
    const cellRadius = Math.ceil(radius / this.treeGridCellSize);
    const cx = Math.floor(x / this.treeGridCellSize);
    const cz = Math.floor(z / this.treeGridCellSize);
    const result: THREE.Vector3[] = [];
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dz = -cellRadius; dz <= cellRadius; dz++) {
        const key = `${cx + dx},${cz + dz}`;
        const cell = this.treeGrid.get(key);
        if (cell) {
          for (const tp of cell) result.push(tp);
        }
      }
    }
    return result;
  }

  getBuildings(): Building[] {
    return this.buildings;
  }

  seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
  }
}
