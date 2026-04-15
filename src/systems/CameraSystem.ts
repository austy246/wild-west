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

  /** When set, camera stays at this fixed world position instead of following the target */
  fixedPosition: THREE.Vector3 | null = null;
  /** When set, camera looks at this fixed world point */
  fixedLookAt: THREE.Vector3 | null = null;

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
    if (this.fixedPosition) {
      // Fixed camera mode (interior corner camera)
      const t = 1 - Math.exp(-CAMERA_LERP_SPEED * dt);
      this.camera.position.x = lerp(this.camera.position.x, this.fixedPosition.x, t);
      this.camera.position.y = lerp(this.camera.position.y, this.fixedPosition.y, t);
      this.camera.position.z = lerp(this.camera.position.z, this.fixedPosition.z, t);

      if (this.fixedLookAt) {
        this.camera.lookAt(this.fixedLookAt);
      }
      return;
    }

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

  /** Instantly snap camera to the target + offset (skip lerp) */
  snap(): void {
    if (this.fixedPosition) {
      this.camera.position.copy(this.fixedPosition);
      if (this.fixedLookAt) {
        this.camera.lookAt(this.fixedLookAt);
      }
      return;
    }

    this.camera.position.set(
      this.target.position.x + this.offset.x,
      this.target.position.y + this.offset.y,
      this.target.position.z + this.offset.z
    );
    this.camera.lookAt(
      this.target.position.x,
      this.target.position.y + 1,
      this.target.position.z
    );
  }

  /** Set camera FOV and update projection */
  setFov(fov: number): void {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }
}
