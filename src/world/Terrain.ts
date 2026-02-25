import * as THREE from 'three';
import { GROUND_SIZE, GROUND_COLOR } from '../utils/constants';

export function createTerrain(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
  const material = new THREE.MeshStandardMaterial({
    color: GROUND_COLOR,
    roughness: 0.9,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}
