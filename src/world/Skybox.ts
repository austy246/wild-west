import * as THREE from 'three';
import { SKY_COLOR } from '../utils/constants';

export function createSkybox(scene: THREE.Scene): void {
  scene.background = new THREE.Color(SKY_COLOR);
  scene.fog = new THREE.Fog(SKY_COLOR, 80, 120);
}
