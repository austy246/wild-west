import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { InputManager } from '../core/InputManager';
import {
  PLAYER_SPEED,
  PLAYER_SPRINT_SPEED,
  PLAYER_MAX_STAMINA,
  STAMINA_DRAIN_RATE,
  STAMINA_REGEN_RATE,
  STAMINA_EXHAUST_COOLDOWN,
} from '../utils/constants';
import { clamp } from '../utils/math';

export class Player {
  readonly mesh: THREE.Group;
  readonly body: CANNON.Body;

  stamina = PLAYER_MAX_STAMINA;
  maxStamina = PLAYER_MAX_STAMINA;
  isSprinting = false;
  speedMultiplier = 1;
  isIndoors = false; // when true, movement is relative to the fixed interior camera
  // Camera-relative movement basis for interiors (W = away from camera, D = screen right)
  indoorForward = { x: 0, z: 1 };
  indoorRight = { x: 1, z: 0 };
  cameraMode = false; // when true, WASD controls camera instead of player
  /** When true, input is ignored — the player is being moved by a cutscene */
  controlLocked = false;
  hunger = 100;
  maxHunger = 100;
  holdingFood = false; // true when holding food/drink/ammo (non-weapon items)
  private exhaustCooldown = 0; // seconds remaining before regen can start
  private pendantMesh: THREE.Group | null = null;

  constructor() {
    this.mesh = this.createMesh();
    this.body = this.createBody();
  }

  /** Build a smooth, rounded cowboy character */
  private createMesh(): THREE.Group {
    const group = new THREE.Group();
    const S = 16; // segment count for smooth curves

    // --- Materials ---
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5c6a0, roughness: 0.7 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xc8c0b0, roughness: 0.8 });
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.65 });
    const jeansMat = new THREE.MeshStandardMaterial({ color: 0x3b5998, roughness: 0.75 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.6 });
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x4a2e14, roughness: 0.5 });
    const bandanaMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.65 });
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.55 });
    const hatBandMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.45 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.6 });
    const buckleMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.7, roughness: 0.25 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8f8f8 });

    // --- Boots (rounded cowboy boots with capsule shape) ---
    for (const side of [-1, 1]) {
      const x = side * 0.16;
      // Boot shaft (smooth cylinder)
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.28, S), bootMat);
      shaft.position.set(x, 0.2, 0);
      shaft.castShadow = true;
      group.add(shaft);
      // Boot foot (rounded box via sphere-stretched)
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.12, S, S), bootMat);
      foot.scale.set(1, 0.5, 1.3);
      foot.position.set(x, 0.06, 0.02);
      foot.castShadow = true;
      group.add(foot);
      // Boot heel
      const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.06, S), bootMat);
      heel.position.set(x, 0.03, -0.08);
      group.add(heel);
    }

    // --- Legs (smooth capsule-like jeans) ---
    for (const side of [-1, 1]) {
      const x = side * 0.16;
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.2, 8, S), jeansMat);
      leg.position.set(x, 0.48, 0);
      leg.castShadow = true;
      group.add(leg);
    }

    // --- Hips (smooth sphere bridge between legs and torso) ---
    const hips = new THREE.Mesh(new THREE.SphereGeometry(0.28, S, S), jeansMat);
    hips.scale.set(1.2, 0.6, 0.9);
    hips.position.y = 0.6;
    hips.castShadow = true;
    group.add(hips);

    // --- Belt ---
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 8, S), beltMat);
    belt.position.y = 0.68;
    belt.rotation.x = Math.PI / 2;
    group.add(belt);
    // Belt buckle
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.03), buckleMat);
    buckle.position.set(0, 0.68, 0.3);
    group.add(buckle);

    // --- Torso (smooth capsule body) ---
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.3, 8, S), shirtMat);
    torso.position.y = 0.98;
    torso.castShadow = true;
    group.add(torso);

    // --- Vest (wrapping around torso) ---
    // Vest uses a slightly larger capsule, clipped with scale
    const vestBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.28, 8, S), vestMat);
    vestBody.position.y = 0.97;
    vestBody.scale.set(1, 1, 0.85);
    vestBody.castShadow = true;
    group.add(vestBody);
    // Vest opening (shirt visible at front via a slightly protruding shirt piece)
    const shirtFront = new THREE.Mesh(new THREE.SphereGeometry(0.18, S, S), shirtMat);
    shirtFront.scale.set(0.7, 1.3, 0.5);
    shirtFront.position.set(0, 0.98, 0.2);
    group.add(shirtFront);

    // --- Shoulders + Arms ---
    for (const side of [-1, 1]) {
      const x = side * 0.36;
      // Shoulder (sphere)
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.12, S, S), shirtMat);
      shoulder.position.set(x, 1.15, 0);
      shoulder.castShadow = true;
      group.add(shoulder);
      // Upper arm (capsule)
      const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.18, 6, S), shirtMat);
      upperArm.position.set(x * 1.2, 0.96, 0);
      upperArm.rotation.z = side * Math.PI / 10;
      upperArm.castShadow = true;
      group.add(upperArm);
      // Forearm (capsule, skin)
      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.16, 6, S), skinMat);
      forearm.position.set(x * 1.35, 0.78, 0);
      forearm.rotation.z = side * Math.PI / 12;
      forearm.castShadow = true;
      group.add(forearm);
      // Glove (rounded sphere-hand)
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.08, S, S), gloveMat);
      glove.position.set(x * 1.4, 0.65, 0);
      glove.castShadow = true;
      group.add(glove);
      // Glove cuff
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, S), gloveMat);
      cuff.position.set(x * 1.35, 0.72, 0);
      cuff.rotation.x = Math.PI / 2;
      group.add(cuff);
    }

    // --- Neck ---
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.1, S), skinMat);
    neck.position.y = 1.25;
    group.add(neck);

    // --- Red bandana ---
    const bandanaWrap = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, S), bandanaMat);
    bandanaWrap.position.y = 1.23;
    bandanaWrap.rotation.x = Math.PI / 2;
    group.add(bandanaWrap);
    // Bandana triangle front
    const bShape = new THREE.Shape();
    bShape.moveTo(-0.15, 0);
    bShape.lineTo(0.15, 0);
    bShape.lineTo(0, -0.14);
    bShape.closePath();
    const bandanaFront = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bShape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 3 }),
      bandanaMat
    );
    bandanaFront.position.set(0, 1.23, 0.14);
    group.add(bandanaFront);

    // --- Head (smooth sphere) ---
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, S * 2, S * 2), skinMat);
    head.position.y = 1.42;
    head.castShadow = true;
    group.add(head);

    // --- Hair ---
    const backHair = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, S, S, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.55),
      hairMat
    );
    backHair.position.set(0, 1.4, -0.03);
    group.add(backHair);
    for (const side of [-1, 1]) {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.07, S, S), hairMat);
      tuft.position.set(side * 0.24, 1.38, 0.05);
      group.add(tuft);
    }

    // --- Face ---
    // Eye whites
    for (const side of [-1, 1]) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.05, S, S), eyeWhiteMat);
      white.position.set(side * 0.09, 1.45, 0.22);
      group.add(white);
      // Iris/pupil
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.035, S, S), eyeMat);
      iris.position.set(side * 0.09, 1.45, 0.25);
      group.add(iris);
    }
    // Nose (small rounded bump)
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, S, S), skinMat);
    nose.scale.set(0.8, 1, 1.2);
    nose.position.set(0, 1.4, 0.25);
    group.add(nose);
    // Ears
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, S, S), skinMat);
      ear.scale.set(0.5, 1, 0.8);
      ear.position.set(side * 0.26, 1.42, 0);
      group.add(ear);
    }

    // --- Cowboy Hat (smooth, detailed) ---
    // Brim (smooth disc with slight curve)
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.05, S * 2), hatMat);
    brim.position.y = 1.6;
    brim.castShadow = true;
    group.add(brim);
    // Brim edge (torus for rounded edge)
    const brimEdge = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.02, 8, S * 2), hatMat);
    brimEdge.position.y = 1.6;
    brimEdge.rotation.x = Math.PI / 2;
    group.add(brimEdge);
    // Crown (tapered cylinder)
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.26, S), hatMat);
    crown.position.y = 1.75;
    crown.castShadow = true;
    group.add(crown);
    // Crown top (dome)
    const crownTop = new THREE.Mesh(new THREE.SphereGeometry(0.18, S, S, 0, Math.PI * 2, 0, Math.PI / 2), hatMat);
    crownTop.position.y = 1.88;
    group.add(crownTop);
    // Hat band (smooth torus)
    const hatBand = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 8, S * 2), hatBandMat);
    hatBand.position.y = 1.64;
    hatBand.rotation.x = Math.PI / 2;
    group.add(hatBand);

    return group;
  }

  private createBody(): CANNON.Body {
    const body = new CANNON.Body({
      mass: 5,
      shape: new CANNON.Cylinder(0.4, 0.4, 1.4, 8),
      fixedRotation: true,
      linearDamping: 0.4,
    });
    body.position.set(3, 2, 3);
    return body;
  }

  /** Does the player already wear the dragon pendant? */
  get hasPendant(): boolean {
    return this.pendantMesh !== null;
  }

  /**
   * Hang Mary's dragon pendant around the player's neck. A small glowing
   * amulet on a cord, sitting on the chest just below the bandana.
   */
  showPendant(): void {
    if (this.pendantMesh) return;

    const group = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, metalness: 0.8, roughness: 0.25,
      emissive: 0x6b4c00, emissiveIntensity: 0.6,
    });
    const gemMat = new THREE.MeshStandardMaterial({
      color: 0x2ecc71, metalness: 0.2, roughness: 0.1,
      emissive: 0x27ff7a, emissiveIntensity: 1.2,
    });

    // Cord around the neck
    const cord = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.008, 6, 20),
      new THREE.MeshStandardMaterial({ color: 0x2b1b0e, roughness: 0.9 })
    );
    cord.position.set(0, 1.19, 0.01);
    cord.rotation.x = Math.PI / 2;
    group.add(cord);

    // Amulet plate — a small coiled dragon reads as a gold ring with a claw
    const plate = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 16), goldMat);
    plate.position.set(0, 1.06, 0.22);
    group.add(plate);

    // Dragon head + tail: two tapered cones biting around the ring
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.055, 6), goldMat);
    head.position.set(0.02, 1.10, 0.235);
    head.rotation.set(Math.PI / 2, 0, -0.6);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 6), goldMat);
    tail.position.set(-0.03, 1.03, 0.235);
    tail.rotation.set(Math.PI / 2, 0, 0.9);
    group.add(tail);

    // Glowing gem in the middle
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), gemMat);
    gem.position.set(0, 1.06, 0.235);
    group.add(gem);

    // Faint green glow so it reads at night
    const glow = new THREE.PointLight(0x4dff9a, 1.2, 1.6, 2);
    glow.userData.alwaysOn = true; // it's on the player — always in range anyway
    glow.position.set(0, 1.06, 0.26);
    group.add(glow);

    this.pendantMesh = group;
    this.mesh.add(group);
  }

  update(dt: number): void {
    // Cutscene: the story script drives the body, input is ignored
    if (this.controlLocked) {
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
      this.mesh.position.set(
        this.body.position.x,
        this.body.position.y - 0.7,
        this.body.position.z
      );
      return;
    }

    // In camera mode, skip player movement (camera handles WASD)
    if (this.cameraMode) {
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
      this.mesh.position.set(
        this.body.position.x,
        this.body.position.y - 0.7,
        this.body.position.z
      );
      return;
    }

    // WASD movement (keyboard) or joystick (touch)
    const moveDir = new CANNON.Vec3(0, 0, 0);
    const touch = InputManager.moveDirection;

    if (touch.x !== 0 || touch.y !== 0) {
      // Joystick input (y maps to world z)
      moveDir.x = touch.x;
      moveDir.z = touch.y;
    } else {
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
    }

    // Sprint with Shift or joystick push
    const wantsSprint = InputManager.isKeyDown('ShiftLeft') || InputManager.isKeyDown('ShiftRight') || InputManager.sprinting;
    const len = moveDir.length();
    const isMoving = len > 0;

    if (wantsSprint && isMoving && this.stamina > 0 && this.exhaustCooldown <= 0) {
      this.isSprinting = true;
      this.stamina = clamp(this.stamina - STAMINA_DRAIN_RATE * dt, 0, this.maxStamina);
      // When fully depleted, start the exhaustion cooldown
      if (this.stamina <= 0) {
        this.exhaustCooldown = STAMINA_EXHAUST_COOLDOWN;
      }
    } else {
      this.isSprinting = false;
      // Tick down exhaust cooldown before allowing regen
      if (this.exhaustCooldown > 0) {
        this.exhaustCooldown -= dt;
      } else {
        this.stamina = clamp(this.stamina + STAMINA_REGEN_RATE * dt, 0, this.maxStamina);
      }
    }

    const speed = (this.isSprinting ? PLAYER_SPRINT_SPEED : PLAYER_SPEED) * this.speedMultiplier;

    // Indoors: movement is relative to the fixed corner camera, so W always
    // moves away from the camera (into the room) regardless of building rotation.
    if (this.isIndoors && isMoving) {
      const forwardAmount = -moveDir.z; // W => +1 (away from camera)
      const rightAmount = moveDir.x;    // D => +1 (screen right)
      const wx = forwardAmount * this.indoorForward.x + rightAmount * this.indoorRight.x;
      const wz = forwardAmount * this.indoorForward.z + rightAmount * this.indoorRight.z;
      moveDir.x = wx;
      moveDir.z = wz;
    }

    // Normalize so diagonal movement isn't faster
    if (isMoving) {
      const newLen = moveDir.length();
      moveDir.scale(1 / newLen, moveDir);
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
