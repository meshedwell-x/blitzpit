import * as THREE from 'three';
import { PlayerController } from './PlayerController';

export function createPlayerMesh(): THREE.Group {
  const group = new THREE.Group();

  // --- Head ---
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xffcc99 })
  );
  head.position.y = 1.55;
  head.castShadow = true;
  head.name = 'head';
  group.add(head);

  // Eyes
  const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.12, 1.6, -0.26);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.12, 1.6, -0.26);
  group.add(rightEye);

  // --- Body (torso) ---
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.75, 0.35),
    new THREE.MeshLambertMaterial({ color: 0x2d5a1e }) // military green
  );
  torso.position.y = 1.0;
  torso.castShadow = true;
  torso.name = 'torso';
  group.add(torso);

  // Belt
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.1, 0.37),
    new THREE.MeshLambertMaterial({ color: 0x4a3520 })
  );
  belt.position.y = 0.65;
  belt.name = 'belt';
  group.add(belt);

  // --- Arms ---
  const armGeo = new THREE.BoxGeometry(0.2, 0.65, 0.2);
  const armMat = new THREE.MeshLambertMaterial({ color: 0x2d5a1e });

  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.5, 1.0, 0);
  leftArm.castShadow = true;
  leftArm.name = 'leftArm';
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(0.5, 1.0, 0);
  rightArm.castShadow = true;
  rightArm.name = 'rightArm';
  group.add(rightArm);

  // Hands (skin color)
  const handGeo = new THREE.BoxGeometry(0.18, 0.15, 0.18);
  const handMat = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
  const leftHand = new THREE.Mesh(handGeo, handMat);
  leftHand.position.set(-0.5, 0.6, 0);
  group.add(leftHand);
  const rightHand = new THREE.Mesh(handGeo, handMat);
  rightHand.position.set(0.5, 0.6, 0);
  group.add(rightHand);

  // --- Legs ---
  const legGeo = new THREE.BoxGeometry(0.22, 0.65, 0.22);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x3a3a2a }); // dark pants

  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.15, 0.3, 0);
  leftLeg.castShadow = true;
  leftLeg.name = 'leftLeg';
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.15, 0.3, 0);
  rightLeg.castShadow = true;
  rightLeg.name = 'rightLeg';
  group.add(rightLeg);

  // Boots
  const bootGeo = new THREE.BoxGeometry(0.24, 0.12, 0.3);
  const bootMat = new THREE.MeshLambertMaterial({ color: 0x2a1a0a });
  const leftBoot = new THREE.Mesh(bootGeo, bootMat);
  leftBoot.position.set(-0.15, 0.0, -0.03);
  leftBoot.name = 'leftBoot';
  group.add(leftBoot);
  const rightBoot = new THREE.Mesh(bootGeo, bootMat);
  rightBoot.position.set(0.15, 0.0, -0.03);
  rightBoot.name = 'rightBoot';
  group.add(rightBoot);

  // --- Backpack ---
  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.45, 0.25),
    new THREE.MeshLambertMaterial({ color: 0x5a4a30 })
  );
  backpack.position.set(0, 1.05, 0.3);
  backpack.name = 'backpack';
  group.add(backpack);

  // --- Helmet ---
  const helmet = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.3, 0.55),
    new THREE.MeshLambertMaterial({ color: 0x4a5a3a })
  );
  helmet.position.y = 1.75;
  helmet.name = 'helmet';
  group.add(helmet);

  // Helmet goggles (two small glass panes on front)
  const goggleMat = new THREE.MeshLambertMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.7 });
  const goggleGeo = new THREE.BoxGeometry(0.12, 0.1, 0.05);
  const leftGoggle = new THREE.Mesh(goggleGeo, goggleMat);
  leftGoggle.position.set(-0.13, 1.76, -0.29);
  group.add(leftGoggle);
  const rightGoggle = new THREE.Mesh(goggleGeo, goggleMat);
  rightGoggle.position.set(0.13, 1.76, -0.29);
  group.add(rightGoggle);

  // Boot toes -- slight forward protrusion for detail
  const toeGeo = new THREE.BoxGeometry(0.22, 0.1, 0.12);
  const toeMat = new THREE.MeshLambertMaterial({ color: 0x1a0f00 });
  const leftToe = new THREE.Mesh(toeGeo, toeMat);
  leftToe.position.set(-0.15, 0.0, -0.14);
  group.add(leftToe);
  const rightToe = new THREE.Mesh(toeGeo, toeMat);
  rightToe.position.set(0.15, 0.0, -0.14);
  group.add(rightToe);

  return group;
}

export function updatePlayerAnimation(controller: PlayerController, delta: number): void {
  // Limb animation
  const leftArm = controller.mesh.getObjectByName('leftArm');
  const rightArm = controller.mesh.getObjectByName('rightArm');
  const leftLeg = controller.mesh.getObjectByName('leftLeg');
  const rightLeg = controller.mesh.getObjectByName('rightLeg');

  if (controller.state.isSwimming) {
    // Swimming animation -- breaststroke arms + frog kick legs
    controller.animTime += delta * 4;
    const strokePhase = Math.sin(controller.animTime);
    const kickPhase = Math.sin(controller.animTime + Math.PI * 0.3);

    // Arms: reach forward then sweep outward/back (breaststroke)
    if (leftArm) {
      leftArm.rotation.x = -1.2 + strokePhase * 0.8;
      leftArm.rotation.z = strokePhase > 0 ? -strokePhase * 0.5 : 0;
    }
    if (rightArm) {
      rightArm.rotation.x = -1.2 + strokePhase * 0.8;
      rightArm.rotation.z = strokePhase > 0 ? strokePhase * 0.5 : 0;
    }
    // Legs: frog kick (spread then close)
    if (leftLeg) {
      leftLeg.rotation.x = -0.3 + kickPhase * 0.4;
      leftLeg.rotation.z = kickPhase > 0 ? -kickPhase * 0.3 : 0;
    }
    if (rightLeg) {
      rightLeg.rotation.x = -0.3 + kickPhase * 0.4;
      rightLeg.rotation.z = kickPhase > 0 ? kickPhase * 0.3 : 0;
    }
    // Body bob in water
    controller.mesh.position.y += Math.sin(controller.animTime * 1.5) * 0.08;
  } else {
    // Reset Z rotation from swimming
    if (leftArm) leftArm.rotation.z = 0;
    if (rightArm) rightArm.rotation.z = 0;
    if (leftLeg) leftLeg.rotation.z = 0;
    if (rightLeg) rightLeg.rotation.z = 0;

    // Walk animation -- Minecraft-style limb swing
    const isMovingAnim = controller.state.velocity.x !== 0 || controller.state.velocity.z !== 0;
    if (isMovingAnim && controller.state.isGrounded && !controller.isSliding) {
      const animSpeed = controller.state.isSprinting ? 14 : 9;
      controller.animTime += delta * animSpeed;
      const swing = Math.sin(controller.animTime) * 0.8;
      const armSwing = Math.sin(controller.animTime) * 0.6;

      if (leftArm) leftArm.rotation.x = armSwing;
      if (rightArm) rightArm.rotation.x = -armSwing;
      if (leftLeg) leftLeg.rotation.x = -swing;
      if (rightLeg) rightLeg.rotation.x = swing;
      // Slight body bob
      controller.mesh.position.y += Math.abs(Math.sin(controller.animTime * 2)) * 0.05;
    } else if (!controller.state.isGrounded) {
      // Airborne -- arms up, legs dangling
      if (leftArm) leftArm.rotation.x = -0.4;
      if (rightArm) rightArm.rotation.x = -0.4;
      if (leftLeg) leftLeg.rotation.x = 0.2;
      if (rightLeg) rightLeg.rotation.x = 0.2;
    } else {
      // Idle -- smooth return to rest
      if (leftArm) leftArm.rotation.x *= 0.85;
      if (rightArm) rightArm.rotation.x *= 0.85;
      if (leftLeg) leftLeg.rotation.x *= 0.85;
      if (rightLeg) rightLeg.rotation.x *= 0.85;
    }
  }
}
