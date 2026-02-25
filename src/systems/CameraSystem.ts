import * as THREE from 'three';
import {
  CAMERA_OFFSET_X,
  CAMERA_OFFSET_Y,
  CAMERA_OFFSET_Z,
  CAMERA_LERP_SPEED,
} from '../utils/constants';
import { lerp } from '../utils/math';

export class CameraSystem {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Object3D;

  /** Current offset — can be changed dynamically (e.g. for interiors) */
  offset = new THREE.Vector3(CAMERA_OFFSET_X, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z);

  constructor(camera: THREE.PerspectiveCamera, target: THREE.Object3D) {
    this.camera = camera;
    this.target = target;

    // Set initial position
    this.camera.position.set(
      CAMERA_OFFSET_X,
      CAMERA_OFFSET_Y,
      CAMERA_OFFSET_Z
    );
    this.camera.lookAt(0, 0, 0);
  }

  update(dt: number): void {
    const t = 1 - Math.exp(-CAMERA_LERP_SPEED * dt);

    const targetX = this.target.position.x + this.offset.x;
    const targetY = this.target.position.y + this.offset.y;
    const targetZ = this.target.position.z + this.offset.z;

    this.camera.position.x = lerp(this.camera.position.x, targetX, t);
    this.camera.position.y = lerp(this.camera.position.y, targetY, t);
    this.camera.position.z = lerp(this.camera.position.z, targetZ, t);

    this.camera.lookAt(
      this.target.position.x,
      this.target.position.y + 1,
      this.target.position.z
    );
  }
}
