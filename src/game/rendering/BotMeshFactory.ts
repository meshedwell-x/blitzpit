import * as THREE from 'three';

export class BotMeshFactory {
  static create(skill: number): THREE.Group {
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
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }
}
