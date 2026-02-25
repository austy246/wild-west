import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { randomRange } from '../utils/math';

type BanditState = 'patrol' | 'alert' | 'chase' | 'attack' | 'retreat' | 'dead';

const DETECTION_RANGE = 15;
const ATTACK_RANGE = 2;
const RETREAT_HP_THRESHOLD = 20;
const ATTACK_COOLDOWN = 1.2;
const ATTACK_DAMAGE = 12;
const PATROL_SPEED = 2;
const CHASE_SPEED = 4;

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

    // Body (red/dark to look menacing)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8b0000 });
    const bodyGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.75, 10);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.57;
    body.castShadow = true;
    group.add(body);

    // Head
    const headMat = new THREE.MeshStandardMaterial({ color: 0xd4a574 });
    const headGeo = new THREE.SphereGeometry(0.3, 10, 10);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.15;
    head.castShadow = true;
    group.add(head);

    // Bandana (mask over lower face)
    const bandanaMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const bandanaGeo = new THREE.BoxGeometry(0.35, 0.12, 0.2);
    const bandana = new THREE.Mesh(bandanaGeo, bandanaMat);
    bandana.position.set(0, 1.07, 0.22);
    group.add(bandana);

    // Evil eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.3 });
    const eyeGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.1, 1.2, 0.26);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.1, 1.2, 0.26);
    group.add(rightEye);

    // Hat
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const brimGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.05, 12);
    const brim = new THREE.Mesh(brimGeo, hatMat);
    brim.position.y = 1.4;
    group.add(brim);
    const topGeo = new THREE.CylinderGeometry(0.2, 0.24, 0.25, 10);
    const top = new THREE.Mesh(topGeo, hatMat);
    top.position.y = 1.53;
    group.add(top);

    // Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 });
    const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 6);
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.15, 0.15, 0);
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.15, 0.15, 0);
    group.add(rightLeg);

    // HP bar background
    const hpBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.7 })
    );
    hpBg.position.y = 2;
    hpBg.name = 'hp-bg';
    group.add(hpBg);

    // HP bar fill
    const hpFill = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xe74c3c })
    );
    hpFill.position.y = 2;
    hpFill.position.z = 0.001;
    hpFill.name = 'hp-fill';
    group.add(hpFill);

    return group;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (this.state === 'dead') {
      this.deathTimer -= dt;
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
      case 'retreat':
        this.doRetreat(dt, dx, dz);
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

    if (this.hp < RETREAT_HP_THRESHOLD) {
      this.state = 'retreat';
      return;
    }

    if (this.attackCooldown <= 0) {
      this.attackCooldown = ATTACK_COOLDOWN;
      EventBus.emit('combat:bandit-attack', { damage: ATTACK_DAMAGE, banditId: this.id });
    }
  }

  private doRetreat(dt: number, dx: number, dz: number): void {
    // Run away from player
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.1) {
      this.mesh.position.x -= (dx / dist) * CHASE_SPEED * dt;
      this.mesh.position.z -= (dz / dist) * CHASE_SPEED * dt;
      this.mesh.rotation.y = Math.atan2(-dx, -dz);
    }
  }

  takeDamage(amount: number): void {
    if (this.state === 'dead') return;
    this.hp = Math.max(0, this.hp - amount);

    if (this.state === 'patrol') {
      this.state = 'alert';
      this.stateTimer = 0.2;
    }

    // Hit flash — briefly turn all meshes white
    this.flashHit();

    if (this.hp <= 0) {
      this.die();
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

  private die(): void {
    this.state = 'dead';
    this.deathTimer = 3;

    // Tilt over
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.position.y = 0.3;

    EventBus.emit('combat:kill', { enemyType: 'bandit', banditId: this.id });
    // Drop some lilky
    EventBus.emit('economy:earn', { amount: 15 });
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
