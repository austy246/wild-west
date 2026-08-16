import * as THREE from 'three';
import { randomRange } from '../utils/math';
import { BUILDING_DEFS } from '../world/Village';

/** Check if a point is inside any building footprint (with margin) */
function isInsideBuilding(x: number, z: number): boolean {
  const margin = 0.5;
  for (const def of BUILDING_DEFS) {
    const cos = Math.cos(-def.rotY);
    const sin = Math.sin(-def.rotY);
    const dx = x - def.x;
    const dz = z - def.z;
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    if (Math.abs(lx) < def.width / 2 + margin && Math.abs(lz) < def.depth / 2 + margin) {
      return true;
    }
  }
  return false;
}

// Road geometry — main road x=0 width 5, side paths at z=-24,-12,0,12,24 width 2.5
const MAIN_ROAD_HALF_W = 2.5;
const SIDE_PATH_HALF_W = 1.25;
const SIDE_Z = [-24, -12, 0, 12, 24];

/** Snap a point onto the nearest road surface */
function snapToRoad(x: number, z: number): { x: number; z: number } {
  let bestX = x, bestZ = z, bestDist = Infinity;

  // Check main road (x=0, z=-35..35)
  const clampedZ_main = Math.max(-35, Math.min(35, z));
  const clampedX_main = Math.max(-MAIN_ROAD_HALF_W, Math.min(MAIN_ROAD_HALF_W, x));
  const d_main = (x - clampedX_main) ** 2 + (z - clampedZ_main) ** 2;
  if (d_main < bestDist) { bestDist = d_main; bestX = clampedX_main; bestZ = clampedZ_main; }

  // Check each side path
  for (const sz of SIDE_Z) {
    const clampedX_side = Math.max(-18, Math.min(18, x));
    const clampedZ_side = Math.max(sz - SIDE_PATH_HALF_W, Math.min(sz + SIDE_PATH_HALF_W, z));
    const d_side = (x - clampedX_side) ** 2 + (z - clampedZ_side) ** 2;
    if (d_side < bestDist) { bestDist = d_side; bestX = clampedX_side; bestZ = clampedZ_side; }
  }

  return { x: bestX, z: bestZ };
}

export interface NPCDef {
  id: string;
  name: string;
  color: number;     // body color
  hatColor: number;
  x: number;
  z: number;
  /** Patrol radius — 0 for stationary NPCs (e.g. inside buildings) */
  patrolRadius: number;
  dialog: string;
  gender?: 'male' | 'female';
}

type AIState = 'idle' | 'wander' | 'talk' | 'gohome' | 'asleep';

/** How fast an NPC hurries home once night falls */
const GOHOME_SPEED = 2.2;

export class NPC {
  readonly def: NPCDef;
  readonly mesh: THREE.Group;

  state: AIState = 'idle';
  private stateTimer = 0;
  private wanderTarget = new THREE.Vector3();
  private homePosition: THREE.Vector3;

  /** Route home at nightfall, and what to do once the door is reached */
  private route: THREE.Vector3[] = [];
  private routeIndex = 0;
  private routeSpeed = GOHOME_SPEED;
  private onArriveHome: (() => void) | null = null;

  /** True once the NPC has gone indoors for the night */
  get isAsleep(): boolean {
    return this.state === 'asleep';
  }

  /** Floating name label sprite */
  private label: THREE.Sprite;

  constructor(def: NPCDef) {
    this.def = def;
    this.homePosition = new THREE.Vector3(def.x, 0, def.z);
    this.mesh = this.createMesh();
    this.mesh.position.set(def.x, 0, def.z);

    this.label = this.createLabel();
    this.mesh.add(this.label);

    this.stateTimer = randomRange(1, 4);
  }

  private createMesh(): THREE.Group {
    const group = new THREE.Group();

    // Body
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.def.color });
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.7, 10);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    group.add(body);

    // Head
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffe0bd });
    const headGeo = new THREE.SphereGeometry(0.28, 10, 10);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.12;
    head.castShadow = true;
    group.add(head);

    // Eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const eyeGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.1, 1.16, 0.24);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.1, 1.16, 0.24);
    group.add(rightEye);

    // Hat
    const hatMat = new THREE.MeshStandardMaterial({ color: this.def.hatColor });
    const brimGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.05, 12);
    const brim = new THREE.Mesh(brimGeo, hatMat);
    brim.position.y = 1.36;
    group.add(brim);
    const topGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.22, 10);
    const top = new THREE.Mesh(topGeo, hatMat);
    top.position.y = 1.48;
    group.add(top);

    // Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 6);
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.15, 0.15, 0);
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.15, 0.15, 0);
    group.add(rightLeg);

    return group;
  }

  private createLabel(): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#DEB887';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.def.name, 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.5, 0.6, 1);
    sprite.position.y = 2;
    return sprite;
  }

  /**
   * Send the NPC home for the night along a short route (last point is the
   * door). `onArrive` fires once he reaches it — that's when he goes inside.
   */
  sendHome(route: THREE.Vector3[], onArrive: () => void, speed = GOHOME_SPEED): void {
    if (route.length === 0) return;
    this.route = route;
    this.routeIndex = 0;
    this.routeSpeed = speed;
    this.onArriveHome = onArrive;
    this.state = 'gohome';
  }

  /** Mark as tucked in — stops all movement until something wakes him. */
  fallAsleep(): void {
    this.state = 'asleep';
    this.route = [];
    this.onArriveHome = null;
  }

  /** Out of bed and back to normal wandering. */
  wakeUp(): void {
    this.state = 'idle';
    this.stateTimer = randomRange(0.5, 2);
    this.route = [];
    this.onArriveHome = null;
  }

  update(dt: number): void {
    if (this.state === 'talk' || this.state === 'asleep') return; // frozen

    if (this.state === 'gohome') {
      this.walkRoute(dt);
      return;
    }

    this.stateTimer -= dt;

    if (this.state === 'idle' && this.stateTimer <= 0) {
      if (this.def.patrolRadius > 0) {
        // Pick a random wander target within patrol radius, snapped to road
        const rawX = this.homePosition.x + randomRange(-this.def.patrolRadius, this.def.patrolRadius);
        const rawZ = this.homePosition.z + randomRange(-this.def.patrolRadius, this.def.patrolRadius);
        const snapped = snapToRoad(rawX, rawZ);
        this.wanderTarget.set(snapped.x, 0, snapped.z);
        this.state = 'wander';
        this.stateTimer = randomRange(2, 5);
      } else {
        this.stateTimer = randomRange(2, 4);
      }
    } else if (this.state === 'wander') {
      // Move toward wander target
      const dx = this.wanderTarget.x - this.mesh.position.x;
      const dz = this.wanderTarget.z - this.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.3 || this.stateTimer <= 0) {
        this.state = 'idle';
        this.stateTimer = randomRange(2, 5);
      } else {
        const speed = 1.5;
        let newX = this.mesh.position.x + (dx / dist) * speed * dt;
        let newZ = this.mesh.position.z + (dz / dist) * speed * dt;
        // Keep NPC on the road while walking
        const onRoad = snapToRoad(newX, newZ);
        newX = onRoad.x;
        newZ = onRoad.z;
        // Don't walk into buildings
        if (isInsideBuilding(newX, newZ)) {
          this.state = 'idle';
          this.stateTimer = randomRange(1, 3);
          return;
        }
        this.mesh.position.x = newX;
        this.mesh.position.z = newZ;
        // Face movement direction
        this.mesh.rotation.y = Math.atan2(dx, dz);
        // Bobbing
        this.mesh.position.y = Math.sin(Date.now() * 0.008) * 0.03;
      }
    }
  }

  /**
   * Head-down walk toward the door. Unlike wandering this ignores the
   * road-snapping and the building check — he's walking off the road on
   * purpose, straight at his own front door.
   */
  private walkRoute(dt: number): void {
    const target = this.route[this.routeIndex];
    if (!target) {
      const arrived = this.onArriveHome;
      this.onArriveHome = null;
      arrived?.();
      return;
    }

    const dx = target.x - this.mesh.position.x;
    const dz = target.z - this.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.35) {
      this.routeIndex++;
      return;
    }

    const step = Math.min(this.routeSpeed * dt, dist);
    this.mesh.position.x += (dx / dist) * step;
    this.mesh.position.z += (dz / dist) * step;
    this.mesh.rotation.y = Math.atan2(dx, dz);
    this.mesh.position.y = Math.abs(Math.sin(Date.now() * 0.01)) * 0.04;
  }

  startTalk(): void {
    if (this.state !== 'asleep') this.state = 'talk';
  }

  endTalk(): void {
    if (this.state === 'asleep') return; // don't wake him up
    this.state = 'idle';
    this.stateTimer = randomRange(2, 4);
  }
}
