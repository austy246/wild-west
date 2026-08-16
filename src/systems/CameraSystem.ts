import * as THREE from 'three';
import {
  CAMERA_OFFSET_X,
  CAMERA_OFFSET_Y,
  CAMERA_OFFSET_Z,
  CAMERA_LERP_SPEED,
} from '../utils/constants';
import { lerp } from '../utils/math';
import { InputManager } from '../core/InputManager';

export class CameraSystem {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Object3D;

  /** Current offset — can be changed dynamically (e.g. for interiors) */
  offset = new THREE.Vector3(CAMERA_OFFSET_X, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z);

  /** When set, camera stays at this fixed world position instead of following the target */
  fixedPosition: THREE.Vector3 | null = null;
  /** When set, camera looks at this fixed world point */
  fixedLookAt: THREE.Vector3 | null = null;

  /** When true, WASD moves the camera instead of the player */
  cameraControlMode = false;
  private cameraSpeed = 8;

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
    // Camera control mode: WASD moves the fixed camera & lookAt
    if (this.cameraControlMode && this.fixedPosition && this.fixedLookAt) {
      let dx = 0, dz = 0;
      if (InputManager.isKeyDown('KeyW') || InputManager.isKeyDown('ArrowUp')) dz -= 1;
      if (InputManager.isKeyDown('KeyS') || InputManager.isKeyDown('ArrowDown')) dz += 1;
      if (InputManager.isKeyDown('KeyA') || InputManager.isKeyDown('ArrowLeft')) dx -= 1;
      if (InputManager.isKeyDown('KeyD') || InputManager.isKeyDown('ArrowRight')) dx += 1;

      const move = this.cameraSpeed * dt;
      this.fixedPosition.x += dx * move;
      this.fixedPosition.z += dz * move;
      this.fixedLookAt.x += dx * move;
      this.fixedLookAt.z += dz * move;

      // Up/down with Space/Shift
      if (InputManager.isKeyDown('Space')) this.fixedPosition.y += move;
      if (InputManager.isKeyDown('ShiftLeft') || InputManager.isKeyDown('ShiftRight')) this.fixedPosition.y -= move;
    }

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
