import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createBuilding, Building, BuildingDef } from './BuildingFactory';
import { createRoads } from './Road';

/** All building definitions for the village layout */
export const BUILDING_DEFS: BuildingDef[] = [
  // --- South row (near town entrance, z ~ +24) ---
  {
    name: 'Saloon',
    width: 7, depth: 6, height: 4.5,
    wallColor: 0x8b4513, roofColor: 0x6b3410,
    x: 10, z: 24, rotY: Math.PI, // faces road (door toward negative Z)
  },
  {
    name: 'Maryin dům',
    width: 10, depth: 10, height: 3.5,
    wallColor: 0xa0825a, roofColor: 0x7a6242,
    x: -10, z: 24, rotY: Math.PI,
  },
  // --- Middle row (z ~ +12) ---
  {
    name: 'Obchod',
    width: 6, depth: 5.5, height: 4,
    wallColor: 0xc4a67a, roofColor: 0x8b7355,
    x: 10, z: 12, rotY: Math.PI + 90 * Math.PI / 180,
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
    x: -7, z: -12, rotY: Math.PI / 2,
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

interface CorralHorse {
  mesh: THREE.Group;
  targetX: number;
  targetZ: number;
  speed: number;
  waitTimer: number;
}

interface UnicornShack {
  position: THREE.Vector3;
  unicornSpawned: boolean;
}

export class Village {
  readonly buildings: Building[] = [];
  readonly group = new THREE.Group();
  private corralHorses: CorralHorse[] = [];
  private corralBounds = { minX: -16, maxX: -10, minZ: -14.5, maxZ: -9.5 };
  private horseSoundCooldown = 0;
  private horseAudioElements: HTMLAudioElement[] = [];
  private horseSoundsLoaded = false;
  private unicornShack: UnicornShack | null = null;
  private unicornMesh: THREE.Group | null = null;

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
    this.addStableCorral();
    this.addBuildingLabels();
    this.addCollapsedShack();
    this.addCellarHatch();

    // Haystack between the sheriff's office and the shop (Wazovský sits on top)
    const haystack = this.createHaystack();
    haystack.position.set(10, 0, 0);
    this.group.add(haystack);
    const hayBody = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
    hayBody.addShape(new CANNON.Cylinder(1.25, 1.4, 1.3, 12));
    hayBody.position.set(10, 0.65, 0);
    physicsWorld.addBody(hayBody);

    // Well collider (cylinder at origin)
    const wellBody = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
    wellBody.addShape(new CANNON.Cylinder(1.0, 1.0, 1.2, 12));
    wellBody.position.set(0, 0.6, 0);
    physicsWorld.addBody(wellBody);

    // Corral fence colliders (4 walls around cx=-13, cz=-12, W=6, D=5)
    const cx = -13, cz = -12, fw = 6, fd = 5, fh = 1.4;
    const fenceThickness = 0.3;
    const fenceWalls: [number, number, number, number, number][] = [
      // [x, z, sizeX, sizeZ]  (y is centered at fh/2)
      [cx, cz + fd / 2, fw + fenceThickness, fenceThickness, fh], // front
      [cx, cz - fd / 2, fw + fenceThickness, fenceThickness, fh], // back
      [cx - fw / 2, cz, fenceThickness, fd, fh],                   // left
      [cx + fw / 2, cz, fenceThickness, fd, fh],                   // right
    ];
    for (const [fx, fz, sx, sz, sy] of fenceWalls) {
      const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
      body.addShape(new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)));
      body.position.set(fx, sy / 2, fz);
      physicsWorld.addBody(body);
    }

    scene.add(this.group);
  }

  /** Update animated elements (horses in corral) */
  update(dt: number, playerPos?: THREE.Vector3): void {
    const { minX, maxX, minZ, maxZ } = this.corralBounds;
    const margin = 0.8; // keep horses away from fence

    for (const h of this.corralHorses) {
      if (h.waitTimer > 0) {
        h.waitTimer -= dt;
        continue;
      }

      const dx = h.targetX - h.mesh.position.x;
      const dz = h.targetZ - h.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.3) {
        // Reached target — wait, then pick a new one
        h.waitTimer = 2 + Math.random() * 4;
        h.targetX = minX + margin + Math.random() * (maxX - minX - margin * 2);
        h.targetZ = minZ + margin + Math.random() * (maxZ - minZ - margin * 2);
        h.speed = 0.4 + Math.random() * 0.6;
        continue;
      }

      // Separation: push away from other horses
      let sepX = 0, sepZ = 0;
      const minSep = 1.5; // minimum distance between horses
      for (const other of this.corralHorses) {
        if (other === h) continue;
        const ox = h.mesh.position.x - other.mesh.position.x;
        const oz = h.mesh.position.z - other.mesh.position.z;
        const oDist = Math.sqrt(ox * ox + oz * oz);
        if (oDist < minSep && oDist > 0.01) {
          const force = (minSep - oDist) / minSep;
          sepX += (ox / oDist) * force;
          sepZ += (oz / oDist) * force;
        }
      }

      // Move toward target + separation
      const moveSpeed = h.speed * dt;
      const nx = dx / dist;
      const nz = dz / dist;
      h.mesh.position.x += (nx + sepX * 2) * moveSpeed;
      h.mesh.position.z += (nz + sepZ * 2) * moveSpeed;

      // Face movement direction (horse head points along +X, so offset by -PI/2)
      h.mesh.rotation.y = Math.atan2(nx, nz) - Math.PI / 2;

      // Simple leg animation (bob up and down slightly)
      h.mesh.position.y = Math.abs(Math.sin(Date.now() * 0.008)) * 0.04;
    }

    // Horse sounds when player is near corral
    if (playerPos && this.corralHorses.length > 0) {
      this.horseSoundCooldown -= dt;
      const cx = (this.corralBounds.minX + this.corralBounds.maxX) / 2;
      const cz = (this.corralBounds.minZ + this.corralBounds.maxZ) / 2;
      const dx = playerPos.x - cx;
      const dz = playerPos.z - cz;
      const distToCorral = Math.sqrt(dx * dx + dz * dz);

      if (distToCorral < 12) {
        this.ensureHorseSoundsLoaded();
        if (this.horseSoundCooldown <= 0 && this.horseAudioElements.length > 0) {
          const vol = Math.max(0.1, 1 - distToCorral / 12);
          this.playHorseSound(vol);
          this.horseSoundCooldown = 4 + Math.random() * 6;
        }
      }
    }
  }

  private ensureHorseSoundsLoaded(): void {
    if (this.horseSoundsLoaded) return;
    this.horseSoundsLoaded = true;

    // Preload horse sounds as Audio elements
    const base = import.meta.env.BASE_URL;
    const urls = [`${base}sounds/horse1.mp3`, `${base}sounds/horse2.mp3`, `${base}sounds/horse3.mp3`];
    for (const url of urls) {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.load();
      this.horseAudioElements.push(audio);
    }
  }

  private playHorseSound(volume: number): void {
    if (this.horseAudioElements.length === 0) return;
    const audio = this.horseAudioElements[Math.floor(Math.random() * this.horseAudioElements.length)];
    audio.volume = volume * 0.5;
    audio.currentTime = 0;
    audio.play().catch(() => { /* autoplay blocked, will work after user interaction */ });
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

    // --- Water surface inside the well (blue) ---
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2196f3,
      emissive: 0x0d47a1,
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 0.8,
      roughness: 0.05,
      metalness: 0.3,
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

  /** Open cellar hatch behind the church — the entrance to the underground lab */
  private addCellarHatch(): void {
    const g = new THREE.Group();
    g.position.set(10, 0, -30); // behind the church
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x080705 });

    // Dark opening
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), darkMat);
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.03;
    g.add(hole);

    // Wooden border planks around the hole
    const borders: [number, number, number, number][] = [
      [0, 0.9, 2.0, 0.2], [0, -0.9, 2.0, 0.2],
      [-0.9, 0, 0.2, 1.6], [0.9, 0, 0.2, 1.6],
    ];
    for (const [bx, bz, sx, sz] of borders) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.14, sz), woodMat);
      plank.position.set(bx, 0.07, bz);
      plank.castShadow = true;
      g.add(plank);
    }

    // Open lid leaning to the side
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.8), woodMat);
    lid.position.set(-1.15, 0.55, 0);
    lid.rotation.z = -1.15;
    lid.castShadow = true;
    g.add(lid);

    this.group.add(g);
  }

  /** Golden hay pile with a flat top and stray straw tufts */
  private createHaystack(): THREE.Group {
    const g = new THREE.Group();
    const hayMat = new THREE.MeshStandardMaterial({ color: 0xd9b310, roughness: 1 });
    const hayMat2 = new THREE.MeshStandardMaterial({ color: 0xc99a1a, roughness: 1 });
    const strawMat = new THREE.MeshStandardMaterial({ color: 0xe8c547, roughness: 1 });

    // Bottom tier
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.4, 0.7, 12), hayMat);
    bottom.position.y = 0.35;
    bottom.castShadow = true;
    bottom.receiveShadow = true;
    g.add(bottom);

    // Middle tier
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.3, 0.55, 12), hayMat2);
    mid.position.y = 0.9;
    mid.castShadow = true;
    g.add(mid);

    // Flat top to stand on
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.25, 12), hayMat);
    top.position.y = 1.28;
    top.castShadow = true;
    g.add(top);

    // Stray straw tufts sticking out around the sides
    for (let i = 0; i < 12; i++) {
      const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), strawMat);
      const ang = (i / 12) * Math.PI * 2;
      const r = 1.1 + Math.random() * 0.25;
      straw.position.set(Math.cos(ang) * r, 0.45 + Math.random() * 0.7, Math.sin(ang) * r);
      straw.rotation.z = (Math.random() - 0.5) * 1.3;
      straw.rotation.x = (Math.random() - 0.5) * 1.3;
      g.add(straw);
    }

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

  /** Corral (ohrada) with horses next to the stables */
  private addStableCorral(): void {
    const corralGroup = new THREE.Group();
    // Stáje is at x=-4, z=-12, rotY=-PI/2 (faces toward +X / road)
    // Place corral to the left of the stable (more negative X)
    const cx = -13;
    const cz = -12;
    const fenceW = 6;
    const fenceD = 5;
    const fenceH = 1.2;
    const postH = 1.4;

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.85 });

    // Fence posts (corners + midpoints)
    const postGeo = new THREE.CylinderGeometry(0.06, 0.08, postH, 6);
    const postPositions = [
      // Corners
      [cx - fenceW / 2, cz - fenceD / 2],
      [cx + fenceW / 2, cz - fenceD / 2],
      [cx - fenceW / 2, cz + fenceD / 2],
      [cx + fenceW / 2, cz + fenceD / 2],
      // Midpoints
      [cx, cz - fenceD / 2],
      [cx, cz + fenceD / 2],
      [cx - fenceW / 2, cz],
      [cx + fenceW / 2, cz],
    ];
    for (const [px, pz] of postPositions) {
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(px, postH / 2, pz);
      post.castShadow = true;
      corralGroup.add(post);
    }

    // Fence rails (horizontal bars) - 2 rails high on each side
    const railMat = darkWoodMat;
    for (const railY of [0.4, 0.9]) {
      // Front rail (facing +Z) - has a gap to connect to stable
      const frontRailGeo = new THREE.BoxGeometry(fenceW, 0.08, 0.06);
      const frontRail = new THREE.Mesh(frontRailGeo, railMat);
      frontRail.position.set(cx, railY, cz + fenceD / 2);
      corralGroup.add(frontRail);

      // Back rail
      const backRail = new THREE.Mesh(frontRailGeo, railMat);
      backRail.position.set(cx, railY, cz - fenceD / 2);
      corralGroup.add(backRail);

      // Left rail
      const sideRailGeo = new THREE.BoxGeometry(0.06, 0.08, fenceD);
      const leftRail = new THREE.Mesh(sideRailGeo, railMat);
      leftRail.position.set(cx - fenceW / 2, railY, cz);
      corralGroup.add(leftRail);

      // Right rail (connects toward stable)
      const rightRail = new THREE.Mesh(sideRailGeo, railMat);
      rightRail.position.set(cx + fenceW / 2, railY, cz);
      corralGroup.add(rightRail);
    }

    // Add 3 horses inside the corral
    const horsePositions: [number, number, number][] = [
      [cx - 1.5, 0, cz - 0.5],
      [cx + 0.5, 0, cz + 1],
      [cx + 1.5, 0, cz - 1.2],
    ];
    const horseColors = [0x5c3317, 0x2c1608, 0xc4956a]; // brown, dark brown, palomino
    const horseRotations = [0.3, -0.5, Math.PI * 0.7];

    for (let i = 0; i < 3; i++) {
      const horse = this.createHorse(horseColors[i]);
      const [hx, , hz] = horsePositions[i];
      horse.position.set(hx, 0, hz);
      horse.rotation.y = horseRotations[i];
      horse.userData.dynamic = true; // wanders every frame — never merge it away
      corralGroup.add(horse);

      this.corralHorses.push({
        mesh: horse,
        targetX: hx + (Math.random() - 0.5) * 2,
        targetZ: hz + (Math.random() - 0.5) * 2,
        speed: 0.4 + Math.random() * 0.6,
        waitTimer: 1 + Math.random() * 3,
      });
    }

    // Dirt ground in corral
    const groundGeo = new THREE.PlaneGeometry(fenceW, fenceD);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 1.0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cx, 0.02, cz);
    ground.receiveShadow = true;
    corralGroup.add(ground);

    // Water trough
    const troughMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 });
    const troughGeo = new THREE.BoxGeometry(1.2, 0.4, 0.5);
    const trough = new THREE.Mesh(troughGeo, troughMat);
    trough.position.set(cx - fenceW / 2 + 1, 0.2, cz - fenceD / 2 + 0.5);
    trough.castShadow = true;
    corralGroup.add(trough);
    // Water inside
    const waterGeo = new THREE.PlaneGeometry(1.0, 0.3);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x3a6b8a, transparent: true, opacity: 0.7, roughness: 0.1,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx - fenceW / 2 + 1, 0.38, cz - fenceD / 2 + 0.5);
    corralGroup.add(water);

    this.group.add(corralGroup);
  }

  /** Simple 3D horse model */
  /** Build a standalone rideable horse (used for bought stable horses) */
  createRideableHorse(color: number): THREE.Group {
    return this.createHorse(color);
  }

  private createHorse(color: number): THREE.Group {
    const horse = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });

    // Body (elongated box)
    const bodyGeo = new THREE.BoxGeometry(1.4, 0.7, 0.6);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 1.15, 0);
    body.castShadow = true;
    horse.add(body);

    // Neck (angled box)
    const neckGeo = new THREE.BoxGeometry(0.3, 0.7, 0.35);
    const neck = new THREE.Mesh(neckGeo, bodyMat);
    neck.position.set(0.6, 1.6, 0);
    neck.rotation.z = -0.4;
    neck.castShadow = true;
    horse.add(neck);

    // Head
    const headGeo = new THREE.BoxGeometry(0.5, 0.25, 0.28);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0.9, 1.85, 0);
    head.castShadow = true;
    horse.add(head);

    // Ears
    for (const side of [-1, 1]) {
      const earGeo = new THREE.ConeGeometry(0.04, 0.12, 4);
      const ear = new THREE.Mesh(earGeo, bodyMat);
      ear.position.set(0.8, 2.02, side * 0.1);
      horse.add(ear);
    }

    // Legs (4 cylinders)
    const legGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.8, 6);
    const legPositions = [
      [0.45, 0.4, 0.18], [0.45, 0.4, -0.18],
      [-0.45, 0.4, 0.18], [-0.45, 0.4, -0.18],
    ];
    for (const [lx, ly, lz] of legPositions) {
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      horse.add(leg);

      // Hoof
      const hoofGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.08, 6);
      const hoof = new THREE.Mesh(hoofGeo, darkMat);
      hoof.position.set(lx, 0.04, lz);
      horse.add(hoof);
    }

    // Tail
    const tailGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.6, 6);
    const tail = new THREE.Mesh(tailGeo, darkMat);
    tail.position.set(-0.8, 1.1, 0);
    tail.rotation.z = 0.6;
    horse.add(tail);

    // Mane (along neck)
    const maneMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const maneGeo = new THREE.BoxGeometry(0.04, 0.15, 0.35);
      const mane = new THREE.Mesh(maneGeo, maneMat);
      mane.position.set(0.45 + i * 0.12, 1.55 + i * 0.12, 0);
      horse.add(mane);
    }

    return horse;
  }

  /** Collapsed shack in the middle-right area */
  private addCollapsedShack(): void {
    const shack = new THREE.Group();
    const sx = 50, sz = 5;
    shack.position.set(sx, 0, sz);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.95 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });

    // Back wall (tilted, partially collapsed)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 0.15), woodMat);
    backWall.position.set(0, 1.1, -1.5);
    backWall.rotation.x = 0.15;
    backWall.castShadow = true;
    shack.add(backWall);

    // Left wall (leaning inward)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 3), woodMat);
    leftWall.position.set(-1.9, 1.0, 0);
    leftWall.rotation.z = 0.1;
    leftWall.castShadow = true;
    shack.add(leftWall);

    // Right wall (collapsed, fallen partially)
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2, 2.5), woodMat);
    rightWall.position.set(1.9, 0.7, -0.2);
    rightWall.rotation.z = -0.35;
    rightWall.rotation.x = 0.1;
    rightWall.castShadow = true;
    shack.add(rightWall);

    // Roof (collapsed, angled on ground)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.12, 3.5), darkWoodMat);
    roof.position.set(0.3, 1.8, 0);
    roof.rotation.z = -0.25;
    roof.rotation.x = 0.1;
    roof.castShadow = true;
    shack.add(roof);

    // Fallen planks on ground
    for (let i = 0; i < 5; i++) {
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(0.8 + Math.random() * 1.2, 0.06, 0.15),
        i % 2 === 0 ? woodMat : darkWoodMat
      );
      plank.position.set(
        (Math.random() - 0.5) * 3,
        0.03,
        (Math.random() - 0.5) * 2.5
      );
      plank.rotation.y = Math.random() * Math.PI;
      plank.rotation.z = (Math.random() - 0.5) * 0.3;
      shack.add(plank);
    }

    // Front opening (no wall — this is where player enters/interacts)

    this.group.add(shack);
    this.unicornShack = {
      position: new THREE.Vector3(sx, 0, sz),
      unicornSpawned: false,
    };
  }

  /** Try to spawn unicorn when player presses E near the shack. Returns true if spawned. */
  trySpawnUnicorn(playerPos: THREE.Vector3, scene: THREE.Scene): boolean {
    if (!this.unicornShack || this.unicornShack.unicornSpawned) return false;

    const dx = playerPos.x - this.unicornShack.position.x;
    const dz = playerPos.z - this.unicornShack.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 4) return false;

    this.unicornShack.unicornSpawned = true;
    const unicorn = this.createUnicorn();
    unicorn.position.set(
      this.unicornShack.position.x + 1,
      0,
      this.unicornShack.position.z + 2
    );
    unicorn.rotation.y = -Math.PI / 2;
    this.unicornMesh = unicorn;
    scene.add(unicorn);
    return true;
  }

  /** Check if player is near the shack (for showing prompt) */
  isNearShack(playerPos: THREE.Vector3): boolean {
    if (!this.unicornShack || this.unicornShack.unicornSpawned) return false;
    const dx = playerPos.x - this.unicornShack.position.x;
    const dz = playerPos.z - this.unicornShack.position.z;
    return Math.sqrt(dx * dx + dz * dz) < 4;
  }

  /** Check if player is near the spawned unicorn */
  isNearUnicorn(playerPos: THREE.Vector3): boolean {
    if (!this.unicornMesh) return false;
    const dx = playerPos.x - this.unicornMesh.position.x;
    const dz = playerPos.z - this.unicornMesh.position.z;
    return Math.sqrt(dx * dx + dz * dz) < 3;
  }

  /** Get the unicorn mesh (for attaching to player) */
  getUnicornMesh(): THREE.Group | null {
    return this.unicornMesh;
  }

  /** Pink unicorn — same as horse but pink with a horn */
  private createUnicorn(): THREE.Group {
    const unicorn = new THREE.Group();
    const pinkColor = 0xff69b4;
    const bodyMat = new THREE.MeshStandardMaterial({ color: pinkColor, roughness: 0.7 });
    const darkPinkMat = new THREE.MeshStandardMaterial({ color: 0xff1493, roughness: 0.8 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.6), bodyMat);
    body.position.set(0, 1.15, 0);
    body.castShadow = true;
    unicorn.add(body);

    // Neck
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.35), bodyMat);
    neck.position.set(0.6, 1.6, 0);
    neck.rotation.z = -0.4;
    neck.castShadow = true;
    unicorn.add(neck);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.28), bodyMat);
    head.position.set(0.9, 1.85, 0);
    head.castShadow = true;
    unicorn.add(head);

    // Horn (pink cone on top of head)
    const hornMat = new THREE.MeshStandardMaterial({
      color: 0xff69b4,
      emissive: 0xff69b4,
      emissiveIntensity: 0.3,
      metalness: 0.4,
      roughness: 0.3,
    });
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 8), hornMat);
    horn.position.set(0.9, 2.22, 0);
    horn.castShadow = true;
    unicorn.add(horn);

    // Ears
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), bodyMat);
      ear.position.set(0.8, 2.02, side * 0.1);
      unicorn.add(ear);
    }

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.8, 6);
    const legPositions = [
      [0.45, 0.4, 0.18], [0.45, 0.4, -0.18],
      [-0.45, 0.4, 0.18], [-0.45, 0.4, -0.18],
    ];
    for (const [lx, ly, lz] of legPositions) {
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      unicorn.add(leg);

      const hoof = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.08, 0.08, 6),
        blackMat
      );
      hoof.position.set(lx, 0.04, lz);
      unicorn.add(hoof);
    }

    // Eyes (black)
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 6, 6),
        blackMat
      );
      eye.position.set(1.05, 1.88, side * 0.12);
      unicorn.add(eye);
    }

    // Tail (pink, flowing)
    const tail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.05, 0.6, 6),
      darkPinkMat
    );
    tail.position.set(-0.8, 1.1, 0);
    tail.rotation.z = 0.6;
    unicorn.add(tail);

    // Mane (pink along neck)
    for (let i = 0; i < 4; i++) {
      const mane = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.15, 0.35),
        darkPinkMat
      );
      mane.position.set(0.45 + i * 0.12, 1.55 + i * 0.12, 0);
      unicorn.add(mane);
    }

    return unicorn;
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
