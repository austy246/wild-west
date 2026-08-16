import * as THREE from 'three';
import { SUN_COLOR } from '../utils/constants';

export interface SceneLights {
  ambient: THREE.AmbientLight;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
}

/** Offset of the sun from whatever it is currently following */
const SUN_OFFSET = new THREE.Vector3(30, 40, 20);

/**
 * How wide an area the sun's shadow camera covers. Kept tight and moved with
 * the player instead of spanning the whole map — a small box means a small
 * shadow map can stay sharp, which is far cheaper than a huge one.
 */
const SHADOW_EXTENT = 26;

export function createLighting(scene: THREE.Scene): SceneLights {
  // Ambient light
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  // Directional light (sun)
  const sun = new THREE.DirectionalLight(SUN_COLOR, 1.5);
  sun.position.copy(SUN_OFFSET);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 110;
  sun.shadow.camera.left = -SHADOW_EXTENT;
  sun.shadow.camera.right = SHADOW_EXTENT;
  sun.shadow.camera.top = SHADOW_EXTENT;
  sun.shadow.camera.bottom = -SHADOW_EXTENT;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);

  // Hemisphere light for nicer sky/ground color blending
  const hemi = new THREE.HemisphereLight(0x87ceeb, 0xc2956b, 0.3);
  scene.add(hemi);

  return { ambient, sun, hemi };
}

/**
 * Keep the sun (and with it the shadow camera) centred on the player, so the
 * tight shadow box always covers what is actually on screen.
 */
export function followSun(sun: THREE.DirectionalLight, target: THREE.Vector3): void {
  sun.position.set(
    target.x + SUN_OFFSET.x,
    target.y + SUN_OFFSET.y,
    target.z + SUN_OFFSET.z
  );
  sun.target.position.copy(target);
  sun.target.updateMatrixWorld();
}
