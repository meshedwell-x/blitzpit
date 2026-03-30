import * as THREE from 'three';
import type { Vehicle } from './VehicleSystem';

export function createHelicopterMesh(): THREE.Group {
  const group = new THREE.Group();

  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.2, 4.0),
    new THREE.MeshLambertMaterial({ color: 0x4a5a4a })
  );
  body.position.y = 0.8;
  body.castShadow = true;
  group.add(body);

  // Cockpit glass
  const cockpit = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.8, 1.5),
    new THREE.MeshLambertMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.5 })
  );
  cockpit.position.set(0, 1.2, -1.5);
  group.add(cockpit);

  // Tail boom
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.4, 3.0),
    new THREE.MeshLambertMaterial({ color: 0x4a5a4a })
  );
  tail.position.set(0, 0.8, 3.0);
  group.add(tail);

  // Tail fin
  const tailFin = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.0, 0.6),
    new THREE.MeshLambertMaterial({ color: 0x4a5a4a })
  );
  tailFin.position.set(0, 1.5, 4.2);
  group.add(tailFin);

  // Main rotor
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(8.0, 0.05, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x333333 })
  );
  rotor.position.y = 2.0;
  rotor.name = 'mainRotor';
  group.add(rotor);

  // Tail rotor
  const tailRotor = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 1.5, 0.15),
    new THREE.MeshLambertMaterial({ color: 0x333333 })
  );
  tailRotor.position.set(0.3, 1.5, 4.2);
  tailRotor.name = 'tailRotor';
  group.add(tailRotor);

  // Skids
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const skidGeo = new THREE.BoxGeometry(0.1, 0.1, 3.0);
  const leftSkid = new THREE.Mesh(skidGeo, skidMat);
  leftSkid.position.set(-0.7, -0.1, 0);
  group.add(leftSkid);
  const rightSkid = new THREE.Mesh(skidGeo, skidMat);
  rightSkid.position.set(0.7, -0.1, 0);
  group.add(rightSkid);

  return group;
}

export function createVehicleMesh(type: Vehicle['type']): THREE.Group {
  if (type === 'helicopter') return createHelicopterMesh();
  const group = new THREE.Group();

  if (type === 'jeep') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.0, 3.5),
      new THREE.MeshLambertMaterial({ color: 0x4a6a3a })
    );
    body.position.y = 0.8;
    body.castShadow = true;
    group.add(body);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.8, 1.5),
      new THREE.MeshLambertMaterial({ color: 0x3a5a2a })
    );
    cabin.position.set(0, 1.5, -0.3);
    group.add(cabin);

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.7, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.5 })
    );
    windshield.position.set(0, 1.5, -1.0);
    windshield.rotation.x = -0.2;
    group.add(windshield);

    addWheels(group, 1.0, 1.2, 0x222222);

    const rollBar = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.08, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    rollBar.position.set(0, 2.0, 0.5);
    group.add(rollBar);

  } else if (type === 'buggy') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.6, 2.8),
      new THREE.MeshLambertMaterial({ color: 0xcc6600 })
    );
    body.position.y = 0.7;
    body.castShadow = true;
    group.add(body);

    const frame1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.0, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    frame1.position.set(-0.8, 1.2, -0.5);
    group.add(frame1);
    const frame2 = frame1.clone();
    frame2.position.x = 0.8;
    group.add(frame2);

    addWheels(group, 0.9, 1.0, 0x222222);

  } else { // truck
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 1.5, 5.0),
      new THREE.MeshLambertMaterial({ color: 0x5a5a4a })
    );
    body.position.y = 1.2;
    body.castShadow = true;
    group.add(body);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.2, 2.0),
      new THREE.MeshLambertMaterial({ color: 0x4a4a3a })
    );
    cabin.position.set(0, 2.2, -1.5);
    group.add(cabin);

    const ws = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.9, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.5 })
    );
    ws.position.set(0, 2.3, -2.5);
    group.add(ws);

    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.8, 2.5),
      new THREE.MeshLambertMaterial({ color: 0x6a6a5a })
    );
    cargo.position.set(0, 1.8, 1.2);
    group.add(cargo);

    addWheels(group, 1.3, 1.8, 0x222222);
  }

  return group;
}

function addWheels(group: THREE.Group, offsetX: number, offsetZ: number, color: number): void {
  const wheelGeo = new THREE.BoxGeometry(0.3, 0.6, 0.6);
  const wheelMat = new THREE.MeshLambertMaterial({ color });
  const positions = [
    [-offsetX - 0.15, 0.3, -offsetZ],
    [offsetX + 0.15, 0.3, -offsetZ],
    [-offsetX - 0.15, 0.3, offsetZ],
    [offsetX + 0.15, 0.3, offsetZ],
  ];
  for (const p of positions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(p[0], p[1], p[2]);
    group.add(wheel);
  }
}
