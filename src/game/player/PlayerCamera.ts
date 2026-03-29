import * as THREE from 'three';
import { CAMERA_DISTANCE, CAMERA_HEIGHT } from '../core/constants';
import { PlayerController } from './PlayerController';

export function updatePlayerCamera(controller: PlayerController, _delta: number): void {
  // ADS / sprint FOV transitions
  if (controller.isADS) {
    controller.targetFOV = 45;
  } else if (controller.state.isSprinting) {
    controller.targetFOV = 78;
  } else {
    controller.targetFOV = 70;
  }
  controller.adsFOV += (controller.targetFOV - controller.adsFOV) * 0.15;
  controller.camera.fov = controller.adsFOV;
  controller.camera.updateProjectionMatrix();

  // PUBG-style over-the-shoulder (OTS) camera
  // ADS = true first-person (through character head, no model visible)
  const RIGHT_SHOULDER_OFFSET = 0.8; // X offset to the right of character

  if (controller.isADS) {
    // --- ADS: True first-person view through character's eyes ---
    const headHeight = 1.6;
    const eyeX = controller.state.position.x - Math.sin(controller.yaw) * 0.3;
    const eyeZ = controller.state.position.z - Math.cos(controller.yaw) * 0.3;
    const eyeY = controller.state.position.y + headHeight;

    controller.camera.position.set(eyeX, eyeY, eyeZ);

    // Look forward from eyes
    const lookDist = 50;
    const lookX = eyeX - Math.sin(controller.yaw) * lookDist * Math.cos(controller.pitch);
    const lookZ = eyeZ - Math.cos(controller.yaw) * lookDist * Math.cos(controller.pitch);
    const lookY = eyeY + Math.sin(controller.pitch) * lookDist;
    controller.camera.lookAt(lookX, lookY, lookZ);

    // Hide player mesh during ADS
    if (controller.mesh.visible) controller.mesh.visible = false;
  } else {
    // --- Normal: PUBG-style over-right-shoulder 3rd person ---
    if (!controller.mesh.visible) controller.mesh.visible = true;

    const camDist = CAMERA_DISTANCE;
    const camHeight = controller.state.isSwimming ? CAMERA_HEIGHT * 0.6 : CAMERA_HEIGHT;

    // Right-hand side offset perpendicular to look direction
    const rightX = -Math.cos(controller.yaw) * RIGHT_SHOULDER_OFFSET;
    const rightZ = Math.sin(controller.yaw) * RIGHT_SHOULDER_OFFSET;

    // Camera orbits behind player, offset to the right
    const camX = controller.state.position.x + Math.sin(controller.yaw) * camDist * Math.cos(controller.pitch) + rightX;
    const camZ = controller.state.position.z + Math.cos(controller.yaw) * camDist * Math.cos(controller.pitch) + rightZ;
    const camY = controller.state.position.y + camHeight - Math.sin(controller.pitch) * camDist;

    controller.camera.position.set(camX, camY, camZ);

    // Look at player's right shoulder area (not center)
    const lookTarget = new THREE.Vector3(
      controller.state.position.x + rightX,
      controller.state.position.y + 1.5,
      controller.state.position.z + rightZ
    );
    controller.camera.lookAt(lookTarget);
  }

  // Camera shake
  if (controller.shakeAmount > 0) {
    controller.camera.position.x += (Math.random() - 0.5) * controller.shakeAmount;
    controller.camera.position.y += (Math.random() - 0.5) * controller.shakeAmount * 0.5;
    controller.shakeAmount *= 0.9;
    if (controller.shakeAmount < 0.01) controller.shakeAmount = 0;
  }

  // Camera terrain collision
  const camGroundH = controller.world.getHeightAt(controller.camera.position.x, controller.camera.position.z);
  if (controller.camera.position.y < camGroundH + 1.5) {
    controller.camera.position.y = camGroundH + 1.5;
  }
}
