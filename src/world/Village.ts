import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createBuilding, Building, BuildingDef } from './BuildingFactory';
import { createRoads } from './Road';

/** All building definitions for the village layout */
const BUILDING_DEFS: BuildingDef[] = [
  // --- South row (near town entrance, z ~ +24) ---
  {
    name: 'Saloon',
    width: 7, depth: 6, height: 4.5,
    wallColor: 0x8b4513, roofColor: 0x6b3410,
    x: 10, z: 24, rotY: Math.PI, // faces road (door toward negative Z)
  },
  {
    name: 'Dům 1',
    width: 5, depth: 5, height: 3.5,
    wallColor: 0xa0825a, roofColor: 0x7a6242,
    x: -10, z: 24, rotY: Math.PI,
  },
  {
    name: 'Dům 2',
    width: 5, depth: 5, height: 3.5,
    wallColor: 0xb89070, roofColor: 0x8a6a50,
    x: -17, z: 24, rotY: Math.PI,
  },
  // --- Middle row (z ~ +12) ---
  {
    name: 'Obchod',
    width: 6, depth: 5.5, height: 4,
    wallColor: 0xc4a67a, roofColor: 0x8b7355,
    x: 10, z: 12, rotY: Math.PI,
  },
  {
    name: 'Hotel',
    width: 6, depth: 6, height: 5,
    wallColor: 0xd4a060, roofColor: 0x9b7a40,
    x: -12, z: 12, rotY: Math.PI,
  },
  // --- Town square area (z ~ 0) ---
  // No buildings directly on the square — just the fountain
  // --- North-middle row (z ~ -12) ---
  {
    name: 'Šerifův úřad',
    width: 6, depth: 5, height: 4,
    wallColor: 0x9e9e9e, roofColor: 0x6d6d6d,
    x: 10, z: -12, rotY: Math.PI + Math.PI / 2,
  },
  {
    name: 'Stáje',
    width: 7, depth: 5, height: 3.5,
    wallColor: 0x795548, roofColor: 0x5d4037,
    x: -12, z: -12, rotY: Math.PI,
  },
  // --- North row (z ~ -24) ---
  {
    name: 'Kovárna',
    width: 5, depth: 5, height: 3.5,
    wallColor: 0x5d4037, roofColor: 0x3e2723,
    x: -10, z: -24, rotY: Math.PI,
  },
  {
    name: 'Kostel',
    width: 5, depth: 7, height: 5.5,
    wallColor: 0xf5f5dc, roofColor: 0x8b7355,
    x: 10, z: -24, rotY: Math.PI,
  },
];

export class Village {
  readonly buildings: Building[] = [];
  readonly group = new THREE.Group();

  constructor(scene: THREE.Scene, physicsWorld: CANNON.World) {
    // Roads
    createRoads(scene);

    // Buildings
    for (const def of BUILDING_DEFS) {
      const building = createBuilding(def);
      this.buildings.push(building);
      this.group.add(building.exteriorGroup);
      this.group.add(building.interiorGroup);
      physicsWorld.addBody(building.collider);
    }

    // Decorations
    this.addFountain();
    this.addProps();
    this.addBuildingLabels();

    scene.add(this.group);
  }

  /** Stone fountain in the town square */
  private addFountain(): void {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.8 });

    // Base
    const baseGeo = new THREE.CylinderGeometry(1.8, 2, 0.5, 16);
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.set(0, 0.25, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    this.group.add(base);

    // Wall ring
    const wallGeo = new THREE.TorusGeometry(1.5, 0.2, 8, 24);
    const wall = new THREE.Mesh(wallGeo, stoneMat);
    wall.position.set(0, 0.6, 0);
    wall.rotation.x = Math.PI / 2;
    wall.castShadow = true;
    this.group.add(wall);

    // Center pillar
    const pillarGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.8, 8);
    const pillar = new THREE.Mesh(pillarGeo, stoneMat);
    pillar.position.set(0, 0.9, 0);
    pillar.castShadow = true;
    this.group.add(pillar);

    // Water (blue disc inside the ring)
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x4a90d9,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1,
      metalness: 0.3,
    });
    const waterGeo = new THREE.CircleGeometry(1.3, 24);
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.45, 0);
    this.group.add(water);
  }

  /** Scatter barrels, cacti, hitching posts around the village */
  private addProps(): void {
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x6b4226 });
    const cactusMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x795548 });

    // Barrels near buildings
    const barrelPositions = [
      [7, 0.4, 20], [-8, 0.4, 20], [13, 0.4, 12], [-14, 0.4, -10],
      [7, 0.4, -20], [-7, 0.4, -20], [14, 0.4, 24], [-5, 0.4, 12],
    ];
    for (const [bx, by, bz] of barrelPositions) {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.4, 0.8, 10),
        barrelMat
      );
      barrel.position.set(bx, by, bz);
      barrel.castShadow = true;
      this.group.add(barrel);
    }

    // Cacti at village outskirts
    const cactusPositions = [
      [25, 0, 10], [-25, 0, -15], [28, 0, -25], [-30, 0, 20],
      [22, 0, 30], [-22, 0, -30], [35, 0, 0], [-35, 0, 5],
      [30, 0, -10], [-28, 0, 28],
    ];
    for (const [cx, , cz] of cactusPositions) {
      const cactus = this.createCactus(cactusMat);
      cactus.position.set(cx, 0, cz);
      this.group.add(cactus);
    }

    // Hitching posts along the road
    const postPositions = [
      [3.5, 0, 18], [-3.5, 0, 18], [3.5, 0, 6], [-3.5, 0, -6],
      [3.5, 0, -18], [-3.5, 0, -18],
    ];
    for (const [px, , pz] of postPositions) {
      const post = this.createHitchingPost(postMat);
      post.position.set(px, 0, pz);
      this.group.add(post);
    }
  }

  private createCactus(mat: THREE.MeshStandardMaterial): THREE.Group {
    const g = new THREE.Group();
    // Main trunk
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.25, 2, 8);
    const trunk = new THREE.Mesh(trunkGeo, mat);
    trunk.position.y = 1;
    trunk.castShadow = true;
    g.add(trunk);
    // Left arm
    const armGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 6);
    const leftArm = new THREE.Mesh(armGeo, mat);
    leftArm.position.set(-0.35, 1.4, 0);
    leftArm.rotation.z = Math.PI / 3;
    leftArm.castShadow = true;
    g.add(leftArm);
    // Right arm
    const rightArm = new THREE.Mesh(armGeo, mat);
    rightArm.position.set(0.35, 1.1, 0);
    rightArm.rotation.z = -Math.PI / 4;
    rightArm.castShadow = true;
    g.add(rightArm);
    return g;
  }

  private createHitchingPost(mat: THREE.MeshStandardMaterial): THREE.Group {
    const g = new THREE.Group();
    // Two vertical posts
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6);
    const left = new THREE.Mesh(poleGeo, mat);
    left.position.set(-0.5, 0.6, 0);
    left.castShadow = true;
    g.add(left);
    const right = new THREE.Mesh(poleGeo, mat);
    right.position.set(0.5, 0.6, 0);
    right.castShadow = true;
    g.add(right);
    // Horizontal bar
    const barGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6);
    const bar = new THREE.Mesh(barGeo, mat);
    bar.position.set(0, 1, 0);
    bar.rotation.z = Math.PI / 2;
    bar.castShadow = true;
    g.add(bar);
    return g;
  }

  /** 3D text labels floating above each building */
  private addBuildingLabels(): void {
    for (const b of this.buildings) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#00000088';
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = '#DEB887';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(b.def.name, 128, 42);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(3.5, 0.9, 1);
      sprite.position.set(b.def.x, b.def.height + 2.5, b.def.z);
      this.group.add(sprite);
    }
  }

  /** Find the building whose door is closest to the given position, within maxDist */
  findNearestDoor(position: THREE.Vector3, maxDist: number): Building | null {
    let best: Building | null = null;
    let bestDist = maxDist;
    for (const b of this.buildings) {
      const d = position.distanceTo(b.doorPosition);
      if (d < bestDist) {
        bestDist = d;
        best = b;
      }
    }
    return best;
  }
}
