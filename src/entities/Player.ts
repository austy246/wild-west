import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { InputManager } from '../core/InputManager';
import {
  PLAYER_SPEED,
  PLAYER_SPRINT_SPEED,
  PLAYER_MAX_STAMINA,
  STAMINA_DRAIN_RATE,
  STAMINA_REGEN_RATE,
} from '../utils/constants';
import { clamp } from '../utils/math';

export class Player {
  readonly mesh: THREE.Group;
  readonly body: CANNON.Body;

  stamina = PLAYER_MAX_STAMINA;
  maxStamina = PLAYER_MAX_STAMINA;
  isSprinting = false;

  constructor() {
    this.mesh = this.createMesh();
    this.body = this.createBody();
  }

  /** Build a Stumble Guys-style placeholder character from primitives */
  private createMesh(): THREE.Group {
    const group = new THREE.Group();

    // Body (capsule-like: cylinder + two spheres)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd2691e }); // brown coat
    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.45, 0.8, 12);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.6;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Head
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffe0bd }); // skin
    const headGeo = new THREE.SphereGeometry(0.32, 12, 12);
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.y = 1.25;
    headMesh.castShadow = true;
    group.add(headMesh);

    // Eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.12, 1.3, 0.28);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.12, 1.3, 0.28);
    group.add(rightEye);

    // Cowboy Hat (wide brim + top)
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e });
    // Brim
    const brimGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.06, 16);
    const brimMesh = new THREE.Mesh(brimGeo, hatMat);
    brimMesh.position.y = 1.52;
    brimMesh.castShadow = true;
    group.add(brimMesh);
    // Top of hat
    const topGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.3, 12);
    const topMesh = new THREE.Mesh(topGeo, hatMat);
    topMesh.position.y = 1.67;
    topMesh.castShadow = true;
    group.add(topMesh);

    // Left leg
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3b5998 }); // blue jeans
    const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.35, 8);
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.18, 0.17, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);
    // Right leg
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.18, 0.17, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    // Left arm
    const armMat = new THREE.MeshStandardMaterial({ color: 0xd2691e });
    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.35, 8);
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.52, 0.65, 0);
    leftArm.rotation.z = Math.PI / 8;
    leftArm.castShadow = true;
    group.add(leftArm);
    // Right arm
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.52, 0.65, 0);
    rightArm.rotation.z = -Math.PI / 8;
    rightArm.castShadow = true;
    group.add(rightArm);

    return group;
  }

  private createBody(): CANNON.Body {
    const body = new CANNON.Body({
      mass: 5,
      shape: new CANNON.Cylinder(0.4, 0.4, 1.4, 8),
      fixedRotation: true,
      linearDamping: 0.4,
    });
    body.position.set(0, 2, 0);
    return body;
  }

  update(dt: number): void {
    // WASD movement
    const moveDir = new CANNON.Vec3(0, 0, 0);

    if (InputManager.isKeyDown('KeyW') || InputManager.isKeyDown('ArrowUp')) {
      moveDir.z -= 1;
    }
    if (InputManager.isKeyDown('KeyS') || InputManager.isKeyDown('ArrowDown')) {
      moveDir.z += 1;
    }
    if (InputManager.isKeyDown('KeyA') || InputManager.isKeyDown('ArrowLeft')) {
      moveDir.x -= 1;
    }
    if (InputManager.isKeyDown('KeyD') || InputManager.isKeyDown('ArrowRight')) {
      moveDir.x += 1;
    }

    // Sprint with Shift
    const wantsSprint = InputManager.isKeyDown('ShiftLeft') || InputManager.isKeyDown('ShiftRight');
    const len = moveDir.length();
    const isMoving = len > 0;

    if (wantsSprint && isMoving && this.stamina > 0) {
      this.isSprinting = true;
      this.stamina = clamp(this.stamina - STAMINA_DRAIN_RATE * dt, 0, this.maxStamina);
    } else {
      this.isSprinting = false;
      // Regen stamina when not sprinting
      this.stamina = clamp(this.stamina + STAMINA_REGEN_RATE * dt, 0, this.maxStamina);
    }

    const speed = this.isSprinting ? PLAYER_SPRINT_SPEED : PLAYER_SPEED;

    // Normalize so diagonal movement isn't faster
    if (isMoving) {
      moveDir.scale(1 / len, moveDir);
      this.body.velocity.x = moveDir.x * speed;
      this.body.velocity.z = moveDir.z * speed;

      // Rotate character to face movement direction
      const angle = Math.atan2(moveDir.x, moveDir.z);
      this.mesh.rotation.y = angle;
    }

    // Sync mesh to physics body
    this.mesh.position.set(
      this.body.position.x,
      this.body.position.y - 0.7, // offset so feet touch ground
      this.body.position.z
    );

    // Simple bobbing animation while moving (faster when sprinting)
    if (isMoving) {
      const bobSpeed = this.isSprinting ? 0.015 : 0.01;
      const bobAmount = this.isSprinting ? 0.08 : 0.05;
      this.mesh.position.y += Math.sin(Date.now() * bobSpeed) * bobAmount;
    }

    // Update stamina HUD
    this.updateStaminaHUD();
  }

  private updateStaminaHUD(): void {
    let fill = document.getElementById('stamina-bar-fill');
    if (!fill) return;
    const pct = (this.stamina / this.maxStamina) * 100;
    fill.style.width = `${pct}%`;

    const text = document.getElementById('stamina-text');
    if (text) {
      text.textContent = `${Math.round(this.stamina)} / ${this.maxStamina}`;
    }
  }
}
