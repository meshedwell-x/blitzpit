import { PlayerController } from './PlayerController';

export function initPlayerInput(controller: PlayerController, container: HTMLElement): void {
  controller._container = container;

  controller._onKeyDown = (e: KeyboardEvent) => {
    controller.keys.add(e.code);
    if (e.code === 'ShiftLeft') controller.state.isSprinting = true;
    if (e.code === 'KeyC') {
      if (controller.state.isSprinting && controller.slideTimer <= 0 && controller.slideCooldown <= 0) {
        // Start sliding
        controller.isSliding = true;
        controller.slideTimer = 0.8;
        controller.slideCooldown = 1.5;
        controller.slideDir.copy(controller.getForwardDirection());
        controller.mesh.scale.y = 0.5;
      } else {
        controller.state.isCrouching = !controller.state.isCrouching;
      }
    }
  };
  controller._onKeyUp = (e: KeyboardEvent) => {
    controller.keys.delete(e.code);
    if (e.code === 'ShiftLeft') controller.state.isSprinting = false;
  };
  controller._onMouseMove = (e: MouseEvent) => {
    if (controller.isLocked) {
      controller.yaw -= e.movementX * controller.sensitivity;
      controller.pitch -= e.movementY * controller.sensitivity;
      controller.pitch = Math.max(-1.2, Math.min(0.6, controller.pitch));
    }
  };
  controller._onMouseDown = (e: MouseEvent) => {
    if (e.button === 2) {
      controller.isADS = true;
      e.preventDefault();
    }
  };
  controller._onMouseUp = (e: MouseEvent) => {
    if (e.button === 2) {
      controller.isADS = false;
    }
  };
  controller._onPointerLockChange = () => {
    controller.isLocked = document.pointerLockElement === container;
  };
  controller._onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  document.addEventListener('keydown', controller._onKeyDown);
  document.addEventListener('keyup', controller._onKeyUp);
  document.addEventListener('mousemove', controller._onMouseMove);
  document.addEventListener('mousedown', controller._onMouseDown);
  document.addEventListener('mouseup', controller._onMouseUp);
  document.addEventListener('pointerlockchange', controller._onPointerLockChange);
  container.addEventListener('contextmenu', controller._onContextMenu);

  controller._onClick = () => {
    if (!controller.isLocked) {
      container.requestPointerLock();
    }
  };
  container.addEventListener('click', controller._onClick);
}

export function destroyPlayerInput(controller: PlayerController): void {
  document.removeEventListener('keydown', controller._onKeyDown);
  document.removeEventListener('keyup', controller._onKeyUp);
  document.removeEventListener('mousemove', controller._onMouseMove);
  document.removeEventListener('mousedown', controller._onMouseDown);
  document.removeEventListener('mouseup', controller._onMouseUp);
  document.removeEventListener('pointerlockchange', controller._onPointerLockChange);
  if (controller._container) {
    controller._container.removeEventListener('click', controller._onClick);
    controller._container.removeEventListener('contextmenu', controller._onContextMenu);
  }
}
