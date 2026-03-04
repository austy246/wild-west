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

  /** Stone well in the town square */
  private addFountain(): void {
    const well = new THREE.Group();
    well.position.set(0, 0, 0);

    // --- Stone base (irregular flagstones around the well) ---
    const flagstoneMat = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.95 });
    const flagstonePositions = [
      [0, 0.04, 1.4, 0.6, 0.5], [0.9, 0.04, 1.1, 0.5, 0.55],
      [-0.9, 0.04, 1.1, 0.55, 0.5], [1.3, 0.04, 0.4, 0.5, 0.6],
      [-1.3, 0.04, 0.4, 0.55, 0.5], [1.3, 0.04, -0.4, 0.5, 0.55],
      [-1.3, 0.04, -0.4, 0.6, 0.5], [0.9, 0.04, -1.1, 0.5, 0.5],
      [-0.9, 0.04, -1.1, 0.55, 0.55], [0, 0.04, -1.4, 0.6, 0.5],
    ];
    for (const [fx, fy, fz, fw, fd] of flagstonePositions) {
      const stone = new THREE.Mesh(
        new THREE.BoxGeometry(fw, 0.08, fd),
        flagstoneMat
      );
      stone.position.set(fx, fy, fz);
      stone.rotation.y = Math.random() * 0.3 - 0.15;
      stone.receiveShadow = true;
      well.add(stone);
    }

    // --- Stone cylinder wall ---
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.9 });
    const wallOuter = new THREE.CylinderGeometry(0.9, 1.0, 1.0, 12);
    const wallInner = new THREE.CylinderGeometry(0.7, 0.8, 1.0, 12);

    // Outer wall
    const outerWall = new THREE.Mesh(wallOuter, stoneMat);
    outerWall.position.y = 0.5;
    outerWall.castShadow = true;
    outerWall.receiveShadow = true;
    well.add(outerWall);

    // Inner wall (darker, inside)
    const innerMat = new THREE.MeshStandardMaterial({ color: 0x555555, side: THREE.BackSide });
    const innerWall = new THREE.Mesh(wallInner, innerMat);
    innerWall.position.y = 0.5;
    well.add(innerWall);

    // Stone rim on top
    const rimGeo = new THREE.TorusGeometry(0.85, 0.12, 8, 16);
    const rim = new THREE.Mesh(rimGeo, stoneMat);
    rim.position.y = 1.05;
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = true;
    well.add(rim);

    // --- Wooden support posts (two vertical posts) ---
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.85 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 });

    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 2.2, 0.12),
        woodMat
      );
      post.position.set(side * 0.65, 1.6, 0);
      post.castShadow = true;
      well.add(post);
    }

    // --- Wooden roof (shingle-style A-frame) ---
    const roofWidth = 1.8;
    const roofDepth = 1.4;
    const roofPeakY = 3.2;
    const roofBaseY = 2.5;

    // Roof shape (triangular prism)
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-roofWidth / 2, 0);
    roofShape.lineTo(0, roofPeakY - roofBaseY);
    roofShape.lineTo(roofWidth / 2, 0);
    roofShape.closePath();

    const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
      depth: roofDepth,
      bevelEnabled: false,
    });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x6d6058, roughness: 0.9 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, roofBaseY, -roofDepth / 2);
    roof.castShadow = true;
    well.add(roof);

    // Shingle rows (decorative horizontal planks on each side)
    const shingleMat = new THREE.MeshStandardMaterial({ color: 0x5a524a, roughness: 0.95 });
    for (let row = 0; row < 4; row++) {
      const t = row / 4;
      const yOff = t * (roofPeakY - roofBaseY);
      const halfW = (roofWidth / 2) * (1 - t) - 0.05;
      for (const side of [-1, 1]) {
        const shingle = new THREE.Mesh(
          new THREE.BoxGeometry(halfW * 0.9, 0.04, roofDepth + 0.06),
          shingleMat
        );
        const sx = side * (halfW * 0.45 + 0.02);
        const sy = roofBaseY + yOff + 0.08;
        shingle.position.set(sx, sy, 0);
        // Tilt shingles to follow roof slope
        shingle.rotation.z = side * -0.45;
        shingle.castShadow = true;
        well.add(shingle);
      }
    }

    // Ridge beam at top
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, roofDepth + 0.15),
      darkWoodMat
    );
    ridge.position.set(0, roofPeakY, 0);
    ridge.castShadow = true;
    well.add(ridge);

    // --- Crossbeam (horizontal bar between posts for the rope/winch) ---
    const crossbeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8),
      woodMat
    );
    crossbeam.position.set(0, 2.5, 0);
    crossbeam.rotation.z = Math.PI / 2;
    crossbeam.castShadow = true;
    well.add(crossbeam);

    // --- Winch / crank handle ---
    // Handle arm
    const handleArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.3, 0.04),
      darkWoodMat
    );
    handleArm.position.set(0.8, 2.5, 0);
    well.add(handleArm);
    // Handle grip
    const handleGrip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.12, 6),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6, roughness: 0.4 })
    );
    handleGrip.position.set(0.8, 2.65, 0);
    handleGrip.rotation.x = Math.PI / 2;
    well.add(handleGrip);

    // --- Rope hanging down ---
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xb89a6a, roughness: 1.0 });
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1.8, 6),
      ropeMat
    );
    rope.position.set(0, 1.6, 0);
    well.add(rope);

    // --- Bucket hanging on the rope ---
    const bucketMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.8 });
    // Bucket body
    const bucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 0.22, 8),
      bucketMat
    );
    bucket.position.set(0, 0.75, 0);
    bucket.castShadow = true;
    well.add(bucket);
    // Bucket metal bands
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.5, roughness: 0.5 });
    for (const by of [0.68, 0.82]) {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.135, 0.012, 6, 12),
        bandMat
      );
      band.position.set(0, by, 0);
      band.rotation.x = Math.PI / 2;
      well.add(band);
    }

    // --- Water surface inside the well (dark, deep) ---
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1a3a5c,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
      metalness: 0.2,
    });
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 16),
      waterMat
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.3;
    well.add(water);

    this.group.add(well);
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
