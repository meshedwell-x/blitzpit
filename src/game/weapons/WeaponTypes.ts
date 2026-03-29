import * as THREE from 'three';
import type { WeaponDef } from '../core/constants';

export interface WeaponInstance {
  def: WeaponDef;
  currentAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
  reloadTimer: number;
  fireTimer: number;
}

export interface Bullet {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  range: number;
  traveled: number;
  mesh: THREE.Mesh;
  ownerId: string;
}

export interface ItemDrop {
  id: string;
  position: THREE.Vector3;
  type: string;
  weaponId?: string;
  mesh: THREE.Mesh;
  collected: boolean;
}
