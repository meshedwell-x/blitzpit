import * as THREE from 'three';
import { assetManager } from './AssetManager';

export class BotMeshFactory {
  private static botModels = [
    '/assets/characters/bot1.glb',
    '/assets/characters/bot2.glb',
    '/assets/characters/bot3.glb',
    '/assets/characters/bot4.glb',
    '/assets/characters/bot5.glb',
  ];

  static create(skill: number): THREE.Group {
    // GLB 모델이 로드되어있으면 사용
    const modelIdx = Math.floor(Math.random() * BotMeshFactory.botModels.length);
    const model = assetManager.getClone(BotMeshFactory.botModels[modelIdx]);

    if (model) {
      model.scale.setScalar(0.8);
      // 스킬에 따라 색상 틴트
      const hue = skill * 0.3;
      model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material = child.material.clone();
          child.material.color.setHSL(hue, 0.7, 0.5);
        }
      });
      return model;
    }

    // 폴백: 기존 BoxGeometry 복셀
    return BotMeshFactory.createFallback(skill);
  }

  static createFallback(skill: number): THREE.Group {
    const group = new THREE.Group();
    const bodyColor = new THREE.Color().setHSL(0.0 + skill * 0.3, 0.7, 0.5);
    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.4), bodyMat);
    body.position.y = 0.5;
    group.add(body);

    // Head
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xffdbac })
    );
    head.position.y = 1.2;
    group.add(head);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
    const armMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.5, 0.4, 0);
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.5, 0.4, 0);
    group.add(rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x333366 });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.15, -0.4, 0);
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.15, -0.4, 0);
    group.add(rightLeg);

    return group;
  }

  static dispose(mesh: THREE.Group): void {
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      }
    });
  }
}
