import * as THREE from 'three';
import { ROAD_COLOR } from '../utils/constants';

const ROAD_WIDTH = 5;
const SIDE_PATH_WIDTH = 2.5;

export function createRoads(scene: THREE.Scene): void {
  const mat = new THREE.MeshStandardMaterial({
    color: ROAD_COLOR,
    roughness: 1,
    metalness: 0,
  });

  // Main road (north-south) from z=-35 to z=35
  addRoadSegment(scene, mat, 0, -35, 0, 35, ROAD_WIDTH);

  // Side paths (east-west) at various z positions
  const sidePathZ = [-24, -12, 0, 12, 24];
  for (const z of sidePathZ) {
    // Left side path
    addRoadSegment(scene, mat, -18, z, -ROAD_WIDTH / 2, z, SIDE_PATH_WIDTH);
    // Right side path
    addRoadSegment(scene, mat, ROAD_WIDTH / 2, z, 18, z, SIDE_PATH_WIDTH);
  }
}

function addRoadSegment(
  scene: THREE.Scene,
  material: THREE.MeshStandardMaterial,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  width: number
): void {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);

  const geo = new THREE.PlaneGeometry(width, length);
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = -angle;
  mesh.position.set((x1 + x2) / 2, 0.01, (z1 + z2) / 2);
  mesh.receiveShadow = true;
  scene.add(mesh);
}
