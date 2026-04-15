import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { randomRange } from '../utils/math';

type BanditState = 'patrol' | 'alert' | 'chase' | 'attack' | 'dead';

const DETECTION_RANGE = 15;
const ATTACK_RANGE = 2;
const ATTACK_COOLDOWN = 1.2;
const ATTACK_DAMAGE = 12;
const PATROL_SPEED = 2;
const CHASE_SPEED = 3;

export interface BanditDef {
  id: string;
  x: number;
  z: number;
  patrolRadius: number;
}

export class Bandit {
  readonly id: string;
  readonly mesh: THREE.Group;

  hp = 60;
  maxHp = 60;
  state: BanditState = 'patrol';
  private stateTimer = 0;
  private attackCooldown = 0;
  private homePosition: THREE.Vector3;
  private patrolRadius: number;
  private patrolTarget = new THREE.Vector3();
  private deathTimer = 0;
  private flyVelocity = new THREE.Vector3();
  private flySpinSpeed = new THREE.Vector3();
  private flying = false;

  constructor(def: BanditDef) {
    this.id = def.id;
    this.homePosition = new THREE.Vector3(def.x, 0, def.z);
    this.patrolRadius = def.patrolRadius;
    this.mesh = this.createMesh();
    this.mesh.position.set(def.x, 0, def.z);
    this.pickPatrolTarget();
    this.stateTimer = randomRange(2, 5);
  }

  private createMesh(): THREE.Group {
    const group = new THREE.Group();
    const S = 14;

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc8956a, roughness: 0.7 });
    const coatMat = new THREE.MeshStandardMaterial({ color: 0x3e1a0a, roughness: 0.7 }); // dark brown duster
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.75 }); // black pants
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x2c1810, roughness: 0.6 }); // dark boots
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 }); // black hat
    const bandanaMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 }); // black bandana mask
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, emissive: 0xcc0000, emissiveIntensity: 0.3 });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0 });
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.5 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6, roughness: 0.3 });

    // --- Boots ---
    for (const side of [-1, 1]) {
      const x = side * 0.15;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.26, S), bootMat);
      shaft.position.set(x, 0.19, 0);
      shaft.castShadow = true;
      group.add(shaft);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.11, S, S), bootMat);
      foot.scale.set(1, 0.5, 1.3);
      foot.position.set(x, 0.06, 0.02);
      group.add(foot);
      // Spur (small metal)
      const spur = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), metalMat);
      spur.position.set(x, 0.06, -0.12);
      group.add(spur);
    }

    // --- Legs ---
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.2, 6, S), pantsMat);
      leg.position.set(side * 0.15, 0.46, 0);
      leg.castShadow = true;
      group.add(leg);
    }

    // --- Hips ---
    const hips = new THREE.Mesh(new THREE.SphereGeometry(0.26, S, S), pantsMat);
    hips.scale.set(1.1, 0.6, 0.85);
    hips.position.y = 0.58;
    group.add(hips);

    // --- Gun belt ---
    const gunBelt = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 6, S), beltMat);
    gunBelt.position.y = 0.62;
    gunBelt.rotation.x = Math.PI / 2;
    group.add(gunBelt);
    // Holster on right hip
    const holster = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.15, S), beltMat);
    holster.position.set(0.28, 0.54, 0);
    holster.rotation.z = -0.15;
    group.add(holster);

    // --- Torso (dark duster coat) ---
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.3, 8, S), coatMat);
    torso.position.y = 0.95;
    torso.castShadow = true;
    group.add(torso);
    // Coat tails (hanging down at back)
    const coatTail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.06), coatMat);
    coatTail.position.set(0, 0.65, -0.22);
    coatTail.rotation.x = 0.1;
    group.add(coatTail);

    // --- Arms ---
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.11, S, S), coatMat);
      shoulder.position.set(side * 0.32, 1.1, 0);
      group.add(shoulder);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.28, 6, S), coatMat);
      arm.position.set(side * 0.37, 0.85, 0);
      arm.rotation.z = side * Math.PI / 10;
      arm.castShadow = true;
      group.add(arm);
      // Gloved hand
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, S, S), new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.6 }));
      hand.position.set(side * 0.42, 0.64, 0);
      group.add(hand);
    }

    // --- Neck ---
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.08, S), skinMat);
    neck.position.y = 1.18;
    group.add(neck);

    // --- Head ---
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, S * 2, S * 2), skinMat);
    head.position.y = 1.35;
    head.castShadow = true;
    group.add(head);

    // --- Bandana mask (covers lower face) ---
    const maskWrap = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 6, S), bandanaMat);
    maskWrap.position.y = 1.28;
    maskWrap.rotation.x = Math.PI / 2;
    group.add(maskWrap);
    // Front mask piece (covering nose/mouth)
    const maskFront = new THREE.Mesh(new THREE.SphereGeometry(0.14, S, S), bandanaMat);
    maskFront.scale.set(1.1, 0.6, 0.6);
    maskFront.position.set(0, 1.26, 0.16);
    group.add(maskFront);

    // --- Evil eyes ---
    for (const side of [-1, 1]) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.045, S, S), eyeWhiteMat);
      white.position.set(side * 0.09, 1.38, 0.2);
      group.add(white);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.03, S, S), eyeMat);
      iris.position.set(side * 0.09, 1.38, 0.23);
      group.add(iris);
    }
    // Angry eyebrow ridge
    for (const side of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.06, 4, 8), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
      brow.position.set(side * 0.09, 1.42, 0.22);
      brow.rotation.z = side * -0.3; // angry angle
      group.add(brow);
    }

    // --- Ears ---
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.04, S, S), skinMat);
      ear.scale.set(0.5, 1, 0.7);
      ear.position.set(side * 0.25, 1.35, 0);
      group.add(ear);
    }

    // --- Black hat (menacing, larger) ---
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.5, 0.04, S * 2), hatMat);
    brim.position.y = 1.52;
    brim.castShadow = true;
    group.add(brim);
    const brimEdge = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.015, 6, S * 2), hatMat);
    brimEdge.position.y = 1.52;
    brimEdge.rotation.x = Math.PI / 2;
    group.add(brimEdge);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.24, S), hatMat);
    crown.position.y = 1.65;
    group.add(crown);
    const crownTop = new THREE.Mesh(new THREE.SphereGeometry(0.18, S, S, 0, Math.PI * 2, 0, Math.PI / 2), hatMat);
    crownTop.position.y = 1.77;
    group.add(crownTop);

    // --- HP bar ---
    const hpBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.7 })
    );
    hpBg.position.y = 2.1;
    hpBg.name = 'hp-bg';
    group.add(hpBg);

    const hpFill = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xe74c3c })
    );
    hpFill.position.y = 2.1;
    hpFill.position.z = 0.001;
    hpFill.name = 'hp-fill';
    group.add(hpFill);

    return group;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (this.state === 'dead') {
      this.deathTimer -= dt;
      if (this.flying) {
        // Apply gravity and move
        this.flyVelocity.y -= 20 * dt;
        this.mesh.position.x += this.flyVelocity.x * dt;
        this.mesh.position.y += this.flyVelocity.y * dt;
        this.mesh.position.z += this.flyVelocity.z * dt;
        // Spin
        this.mesh.rotation.x += this.flySpinSpeed.x * dt;
        this.mesh.rotation.y += this.flySpinSpeed.y * dt;
        this.mesh.rotation.z += this.flySpinSpeed.z * dt;
        // Stop when hitting ground
        if (this.mesh.position.y < 0.3 && this.flyVelocity.y < 0) {
          this.mesh.position.y = 0.3;
          this.flying = false;
          this.mesh.rotation.set(Math.PI / 2, this.mesh.rotation.y, 0);
        }
      }
      // Fade out when player walks near the body
      if (!this.flying && this.mesh.visible) {
        const dx = playerPos.x - this.mesh.position.x;
        const dz = playerPos.z - this.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 2.5) {
          // Shrink and fade away
          this.mesh.scale.multiplyScalar(1 - dt * 3);
          if (this.mesh.scale.x < 0.05) {
            this.mesh.visible = false;
          }
        }
      }
      if (this.deathTimer <= 0) {
        this.mesh.visible = false;
      }
      return;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    const dx = playerPos.x - this.mesh.position.x;
    const dz = playerPos.z - this.mesh.position.z;
    const distToPlayer = Math.sqrt(dx * dx + dz * dz);

    switch (this.state) {
      case 'patrol':
        this.doPatrol(dt, distToPlayer);
        break;
      case 'alert':
        this.doAlert(dt, dx, dz, distToPlayer);
        break;
      case 'chase':
        this.doChase(dt, dx, dz, distToPlayer);
        break;
      case 'attack':
        this.doAttack(dt, dx, dz, distToPlayer);
        break;
    }

    // Update HP bar
    this.updateHPBar();

    // Bobbing while moving
    if (this.state === 'chase' || this.state === 'patrol') {
      this.mesh.position.y = Math.sin(Date.now() * 0.008) * 0.03;
    }
  }

  private doPatrol(dt: number, distToPlayer: number): void {
    if (distToPlayer < DETECTION_RANGE) {
      this.state = 'alert';
      this.stateTimer = 0.5;
      return;
    }

    const dx = this.patrolTarget.x - this.mesh.position.x;
    const dz = this.patrolTarget.z - this.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.5) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.pickPatrolTarget();
        this.stateTimer = randomRange(2, 5);
      }
    } else {
      this.mesh.position.x += (dx / dist) * PATROL_SPEED * dt;
      this.mesh.position.z += (dz / dist) * PATROL_SPEED * dt;
      this.mesh.rotation.y = Math.atan2(dx, dz);
    }
  }

  private doAlert(dt: number, dx: number, dz: number, distToPlayer: number): void {
    this.mesh.rotation.y = Math.atan2(dx, dz);
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.state = 'chase';
    }
  }

  private doChase(dt: number, dx: number, dz: number, distToPlayer: number): void {
    if (distToPlayer < ATTACK_RANGE) {
      this.state = 'attack';
      return;
    }
    if (distToPlayer > DETECTION_RANGE * 1.5) {
      this.state = 'patrol';
      this.pickPatrolTarget();
      return;
    }

    this.mesh.position.x += (dx / distToPlayer) * CHASE_SPEED * dt;
    this.mesh.position.z += (dz / distToPlayer) * CHASE_SPEED * dt;
    this.mesh.rotation.y = Math.atan2(dx, dz);
  }

  private doAttack(dt: number, dx: number, dz: number, distToPlayer: number): void {
    this.mesh.rotation.y = Math.atan2(dx, dz);

    if (distToPlayer > ATTACK_RANGE * 1.5) {
      this.state = 'chase';
      return;
    }

    if (this.attackCooldown <= 0) {
      this.attackCooldown = ATTACK_COOLDOWN;
      EventBus.emit('combat:bandit-attack', { damage: ATTACK_DAMAGE, banditId: this.id });
    }
  }


  takeDamage(amount: number, attackerPos?: THREE.Vector3): void {
    if (this.state === 'dead') return;
    this.hp = Math.max(0, this.hp - amount);

    if (this.state === 'patrol') {
      this.state = 'alert';
      this.stateTimer = 0.2;
    }

    // Hit flash — briefly turn all meshes white
    this.flashHit();

    if (this.hp <= 0) {
      this.die(attackerPos);
    }
  }

  private flashHit(): void {
    const originalMaterials: { mesh: THREE.Mesh; material: THREE.Material }[] = [];
    const flashMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.8,
    });

    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name !== 'hp-bg' && child.name !== 'hp-fill') {
        originalMaterials.push({ mesh: child, material: child.material as THREE.Material });
        child.material = flashMat;
      }
    });

    setTimeout(() => {
      for (const { mesh, material } of originalMaterials) {
        mesh.material = material;
      }
      flashMat.dispose();
    }, 120);
  }

  private die(attackerPos?: THREE.Vector3): void {
    this.state = 'dead';
    this.deathTimer = 5;

    EventBus.emit('combat:kill', { enemyType: 'bandit', banditId: this.id });
    EventBus.emit('economy:earn', { amount: 15 });

    if (attackerPos) {
      // Launch bandit flying away from attacker
      this.flying = true;
      const dx = this.mesh.position.x - attackerPos.x;
      const dz = this.mesh.position.z - attackerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;
      const launchSpeed = 50;
      this.flyVelocity.set(
        (dx / dist) * launchSpeed,
        18,  // upward launch
        (dz / dist) * launchSpeed
      );
      this.flySpinSpeed.set(
        randomRange(8, 14),
        randomRange(6, 12),
        randomRange(8, 14)
      );
    } else {
      // Fallback: just tilt over
      this.mesh.rotation.x = Math.PI / 2;
      this.mesh.position.y = 0.3;
    }
  }

  private updateHPBar(): void {
    const fill = this.mesh.getObjectByName('hp-fill') as THREE.Mesh | undefined;
    if (fill) {
      const ratio = this.hp / this.maxHp;
      fill.scale.x = Math.max(0.01, ratio);
      fill.position.x = -(1 - ratio) * 0.6;
    }
  }

  private pickPatrolTarget(): void {
    this.patrolTarget.set(
      this.homePosition.x + randomRange(-this.patrolRadius, this.patrolRadius),
      0,
      this.homePosition.z + randomRange(-this.patrolRadius, this.patrolRadius)
    );
  }
}

/** Bandit spawn points around the village outskirts */
export const BANDIT_SPAWNS: BanditDef[] = [
  { id: 'bandit-1', x: 35, z: 15, patrolRadius: 8 },
  { id: 'bandit-2', x: -35, z: -10, patrolRadius: 8 },
  { id: 'bandit-3', x: 30, z: -25, patrolRadius: 6 },
  { id: 'bandit-4', x: -30, z: 25, patrolRadius: 7 },
  { id: 'bandit-5', x: 0, z: 40, patrolRadius: 10 },
  { id: 'bandit-6', x: -25, z: -35, patrolRadius: 6 },
  { id: 'bandit-7', x: 25, z: 35, patrolRadius: 5 },
  { id: 'bandit-8', x: -40, z: 0, patrolRadius: 8 },
];
