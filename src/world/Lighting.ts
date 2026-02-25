import * as THREE from 'three';
import { SUN_COLOR } from '../utils/constants';

export function createLighting(scene: THREE.Scene): void {
  // Ambient light
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  // Directional light (sun)
  const sun = new THREE.DirectionalLight(SUN_COLOR, 1.5);
  sun.position.set(30, 40, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  scene.add(sun);

  // Hemisphere light for nicer sky/ground color blending
  const hemi = new THREE.HemisphereLight(0x87ceeb, 0xc2956b, 0.3);
  scene.add(hemi);
}
