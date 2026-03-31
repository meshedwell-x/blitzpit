import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class AssetManager {
  private loader: GLTFLoader;
  private cache: Map<string, THREE.Group> = new Map();
  private loading: Map<string, Promise<THREE.Group>> = new Map();

  constructor() {
    this.loader = new GLTFLoader();
  }

  async load(path: string): Promise<THREE.Group> {
    if (this.cache.has(path)) {
      return this.cache.get(path)!.clone();
    }
    if (this.loading.has(path)) {
      const result = await this.loading.get(path)!;
      return result.clone();
    }

    const promise = new Promise<THREE.Group>((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => {
          const model = gltf.scene;
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          this.cache.set(path, model);
          resolve(model.clone());
        },
        undefined,
        (error) => {
          console.warn('Failed to load asset:', path, error);
          reject(error);
        }
      );
    });

    this.loading.set(path, promise);
    return promise;
  }

  getClone(path: string): THREE.Group | null {
    const cached = this.cache.get(path);
    return cached ? cached.clone() : null;
  }

  isLoaded(path: string): boolean {
    return this.cache.has(path);
  }
}

export const assetManager = new AssetManager();
