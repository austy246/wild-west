import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface BuildingDef {
  name: string;
  width: number;
  depth: number;
  height: number;
  wallColor: number;
  roofColor: number;
  /** Position in world space (x, z). Y is computed automatically. */
  x: number;
  z: number;
  /** Rotation in radians around Y axis */
  rotY: number;
}

export interface Building {
  def: BuildingDef;
  exteriorGroup: THREE.Group;
  interiorGroup: THREE.Group;
  /** Physics body for the outer walls */
  collider: CANNON.Body;
  /** Door trigger zone world position */
  doorPosition: THREE.Vector3;
}

export function createBuilding(def: BuildingDef): Building {
  const exterior = buildExterior(def);
  const interior = buildInterior(def);
  interior.visible = false; // hidden until player enters

  const collider = buildCollider(def);
  const doorPosition = computeDoorPosition(def);

  return { def, exteriorGroup: exterior, interiorGroup: interior, collider, doorPosition };
}

// --------------- Exterior ---------------

function buildExterior(def: BuildingDef): THREE.Group {
  // Use custom exterior for the sheriff's office
  if (def.name === 'Šerifův úřad') {
    return buildSheriffExterior(def);
  }

  const group = new THREE.Group();
  group.position.set(def.x, 0, def.z);
  group.rotation.y = def.rotY;

  const { width, depth, height } = def;

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: def.wallColor, roughness: 0.85 });
  const wallGeo = new THREE.BoxGeometry(width, height, depth);
  const walls = new THREE.Mesh(wallGeo, wallMat);
  walls.position.y = height / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Roof (slightly wider)
  const roofMat = new THREE.MeshStandardMaterial({ color: def.roofColor, roughness: 0.7 });
  const roofGeo = new THREE.BoxGeometry(width + 0.6, 0.3, depth + 0.6);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = height + 0.15;
  roof.castShadow = true;
  group.add(roof);

  // Peaked roof (triangular prism via extruded shape)
  const peakHeight = 1.2;
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-(width + 0.6) / 2, 0);
  roofShape.lineTo(0, peakHeight);
  roofShape.lineTo((width + 0.6) / 2, 0);
  roofShape.lineTo(-(width + 0.6) / 2, 0);
  const extrudeSettings = { depth: depth + 0.6, bevelEnabled: false };
  const peakGeo = new THREE.ExtrudeGeometry(roofShape, extrudeSettings);
  const peak = new THREE.Mesh(peakGeo, roofMat);
  peak.position.set(0, height + 0.3, -(depth + 0.6) / 2);
  peak.castShadow = true;
  group.add(peak);

  // Door (dark rectangle on front face)
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 });
  const doorW = Math.min(1.2, width * 0.35);
  const doorH = Math.min(2.2, height * 0.7);
  const doorGeo = new THREE.PlaneGeometry(doorW, doorH);
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, doorH / 2, depth / 2 + 0.01);
  group.add(door);

  // Sign board above door
  const signMat = new THREE.MeshStandardMaterial({ color: 0xdeb887 });
  const signGeo = new THREE.BoxGeometry(width * 0.6, 0.4, 0.08);
  const sign = new THREE.Mesh(signGeo, signMat);
  sign.position.set(0, doorH + 0.4, depth / 2 + 0.05);
  group.add(sign);

  // Windows (two small squares on front face)
  const winMat = new THREE.MeshStandardMaterial({ color: 0x87ceeb, emissive: 0x334455, emissiveIntensity: 0.3 });
  const winSize = 0.6;
  const winGeo = new THREE.PlaneGeometry(winSize, winSize);
  if (width > 3) {
    const winL = new THREE.Mesh(winGeo, winMat);
    winL.position.set(-width / 4, height * 0.55, depth / 2 + 0.01);
    group.add(winL);
    const winR = new THREE.Mesh(winGeo, winMat);
    winR.position.set(width / 4, height * 0.55, depth / 2 + 0.01);
    group.add(winR);
  }

  return group;
}

// --------------- Sheriff's Office (custom exterior) ---------------

function buildSheriffExterior(def: BuildingDef): THREE.Group {
  const group = new THREE.Group();
  group.position.set(def.x, 0, def.z);
  group.rotation.y = def.rotY;

  const { width, depth, height } = def;
  const facadeHeight = height + 1.8; // False front extends above the roofline

  // Materials
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xb0a090, roughness: 0.85 }); // Weathered stone/plaster
  const woodTrimMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.75 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4e3a2a, roughness: 0.7 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.6 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xdaa520,
    emissive: 0xdaa520,
    emissiveIntensity: 0.15,
    roughness: 0.3,
    metalness: 0.7,
  });

  // --- Main building body ---
  const bodyGeo = new THREE.BoxGeometry(width, height, depth);
  const body = new THREE.Mesh(bodyGeo, wallMat);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // --- False front facade (taller than the building — classic Wild West) ---
  const facadeThickness = 0.25;
  const facadeGeo = new THREE.BoxGeometry(width + 0.3, facadeHeight, facadeThickness);
  const facadeMat = new THREE.MeshStandardMaterial({ color: 0xa09080, roughness: 0.8 });
  const facade = new THREE.Mesh(facadeGeo, facadeMat);
  facade.position.set(0, facadeHeight / 2, depth / 2 + facadeThickness / 2);
  facade.castShadow = true;
  group.add(facade);

  // Facade top trim (decorative crown molding)
  const crownGeo = new THREE.BoxGeometry(width + 0.6, 0.2, 0.35);
  const crown = new THREE.Mesh(crownGeo, woodTrimMat);
  crown.position.set(0, facadeHeight + 0.1, depth / 2 + 0.15);
  crown.castShadow = true;
  group.add(crown);

  // Facade bottom trim
  const baseTrimGeo = new THREE.BoxGeometry(width + 0.4, 0.15, 0.3);
  const baseTrim = new THREE.Mesh(baseTrimGeo, woodTrimMat);
  baseTrim.position.set(0, 0.075, depth / 2 + 0.13);
  group.add(baseTrim);

  // --- Porch / Awning ---
  const porchDepth = 1.8;
  const porchHeight = 2.8;

  // Porch roof (slanted awning)
  const awningGeo = new THREE.BoxGeometry(width + 0.8, 0.12, porchDepth + 0.3);
  const awning = new THREE.Mesh(awningGeo, darkWoodMat);
  awning.position.set(0, porchHeight, depth / 2 + porchDepth / 2 + 0.15);
  awning.rotation.x = 0.08; // Slight downward tilt
  awning.castShadow = true;
  group.add(awning);

  // Porch support posts (4 wooden pillars)
  const postGeo = new THREE.CylinderGeometry(0.08, 0.1, porchHeight, 8);
  const postPositions = [
    [-width / 2 + 0.3, porchHeight / 2, depth / 2 + porchDepth],
    [width / 2 - 0.3, porchHeight / 2, depth / 2 + porchDepth],
    [-width / 2 + 0.3, porchHeight / 2, depth / 2 + 0.5],
    [width / 2 - 0.3, porchHeight / 2, depth / 2 + 0.5],
  ];
  for (const [px, py, pz] of postPositions) {
    const post = new THREE.Mesh(postGeo, woodTrimMat);
    post.position.set(px, py, pz);
    post.castShadow = true;
    group.add(post);
  }

  // Porch floor (wooden planks)
  const porchFloorGeo = new THREE.BoxGeometry(width + 0.4, 0.1, porchDepth);
  const porchFloor = new THREE.Mesh(porchFloorGeo, darkWoodMat);
  porchFloor.position.set(0, 0.05, depth / 2 + porchDepth / 2 + 0.2);
  porchFloor.receiveShadow = true;
  group.add(porchFloor);

  // Porch railing (left and right)
  const railGeo = new THREE.BoxGeometry(0.06, 0.06, porchDepth - 0.3);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railGeo, woodTrimMat);
    rail.position.set(side * (width / 2 + 0.05), 1, depth / 2 + porchDepth / 2 + 0.2);
    group.add(rail);
  }

  // --- Door (double door style) ---
  const doorW = 1.4;
  const doorH = 2.4;
  const doorGeo = new THREE.PlaneGeometry(doorW, doorH);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, doorH / 2, depth / 2 + facadeThickness + 0.01);
  group.add(door);

  // Door frame
  const frameThickness = 0.08;
  const frameMat = woodTrimMat;
  // Top frame
  const topFrame = new THREE.Mesh(
    new THREE.BoxGeometry(doorW + 0.2, frameThickness, 0.1),
    frameMat
  );
  topFrame.position.set(0, doorH + 0.04, depth / 2 + facadeThickness + 0.02);
  group.add(topFrame);
  // Side frames
  for (const side of [-1, 1]) {
    const sideFrame = new THREE.Mesh(
      new THREE.BoxGeometry(frameThickness, doorH + 0.1, 0.1),
      frameMat
    );
    sideFrame.position.set(side * (doorW / 2 + 0.04), doorH / 2, depth / 2 + facadeThickness + 0.02);
    group.add(sideFrame);
  }

  // --- Windows ---
  const winMat = new THREE.MeshStandardMaterial({
    color: 0x87ceeb,
    emissive: 0x334455,
    emissiveIntensity: 0.3,
  });

  // Regular window (left side)
  const winW = 0.7;
  const winH = 0.8;
  const winGeo = new THREE.PlaneGeometry(winW, winH);
  const winLeft = new THREE.Mesh(winGeo, winMat);
  winLeft.position.set(-width / 3.5, height * 0.55, depth / 2 + facadeThickness + 0.01);
  group.add(winLeft);

  // Window frame (left)
  addWindowFrame(group, -width / 3.5, height * 0.55, depth / 2 + facadeThickness + 0.02, winW, winH, woodTrimMat);

  // Jail window (right side — with bars!)
  const winRight = new THREE.Mesh(winGeo, winMat);
  winRight.position.set(width / 3.5, height * 0.55, depth / 2 + facadeThickness + 0.01);
  group.add(winRight);

  // Jail bars on right window
  const barGeo = new THREE.CylinderGeometry(0.02, 0.02, winH + 0.05, 6);
  const barCount = 4;
  for (let i = 0; i < barCount; i++) {
    const bar = new THREE.Mesh(barGeo, metalMat);
    const bx = width / 3.5 - winW / 2 + (winW / (barCount - 1)) * i;
    bar.position.set(bx, height * 0.55, depth / 2 + facadeThickness + 0.03);
    group.add(bar);
  }
  // Horizontal bar across jail window
  const hBarGeo = new THREE.CylinderGeometry(0.02, 0.02, winW + 0.05, 6);
  const hBar = new THREE.Mesh(hBarGeo, metalMat);
  hBar.position.set(width / 3.5, height * 0.55, depth / 2 + facadeThickness + 0.03);
  hBar.rotation.z = Math.PI / 2;
  group.add(hBar);

  // Window frame (right)
  addWindowFrame(group, width / 3.5, height * 0.55, depth / 2 + facadeThickness + 0.02, winW, winH, woodTrimMat);

  // --- Sheriff star badge on facade ---
  const starShape = new THREE.Shape();
  const outerR = 0.35;
  const innerR = 0.15;
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const innerAngle = outerAngle + Math.PI / 5;
    if (i === 0) {
      starShape.moveTo(Math.cos(outerAngle) * outerR, Math.sin(outerAngle) * outerR);
    } else {
      starShape.lineTo(Math.cos(outerAngle) * outerR, Math.sin(outerAngle) * outerR);
    }
    starShape.lineTo(Math.cos(innerAngle) * innerR, Math.sin(innerAngle) * innerR);
  }
  starShape.closePath();

  const starGeo = new THREE.ShapeGeometry(starShape);
  const star = new THREE.Mesh(starGeo, goldMat);
  star.position.set(0, facadeHeight - 0.7, depth / 2 + facadeThickness + 0.02);
  group.add(star);

  // Star center circle
  const starCenter = new THREE.Mesh(
    new THREE.CircleGeometry(0.1, 12),
    goldMat
  );
  starCenter.position.set(0, facadeHeight - 0.7, depth / 2 + facadeThickness + 0.03);
  group.add(starCenter);

  // --- "SHERIFF" sign board ---
  const signW = width * 0.7;
  const signH = 0.5;
  const signGeo = new THREE.BoxGeometry(signW, signH, 0.1);
  const signBoardMat = new THREE.MeshStandardMaterial({ color: 0x2c1e10 });
  const signBoard = new THREE.Mesh(signGeo, signBoardMat);
  signBoard.position.set(0, doorH + 0.5, depth / 2 + facadeThickness + 0.06);
  signBoard.castShadow = true;
  group.add(signBoard);

  // Sign text (canvas texture)
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 256;
  signCanvas.height = 64;
  const ctx = signCanvas.getContext('2d')!;
  ctx.fillStyle = '#2c1e10';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#DAA520';
  ctx.font = 'bold 36px serif';
  ctx.textAlign = 'center';
  ctx.fillText('SHERIFF', 128, 44);
  const signTexture = new THREE.CanvasTexture(signCanvas);
  const signTextGeo = new THREE.PlaneGeometry(signW - 0.1, signH - 0.05);
  const signTextMat = new THREE.MeshBasicMaterial({ map: signTexture, transparent: true });
  const signText = new THREE.Mesh(signTextGeo, signTextMat);
  signText.position.set(0, doorH + 0.5, depth / 2 + facadeThickness + 0.12);
  group.add(signText);

  // --- Roof (flat with slight slope, behind the false front) ---
  const roofW = width + 0.6;
  const roofD = depth + 0.6;
  const roofGeo = new THREE.BoxGeometry(roofW, 0.2, roofD);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, height + 0.1, 0);
  roof.rotation.x = 0.05; // Slight slope backward
  roof.castShadow = true;
  group.add(roof);

  // Roof edge trim (front, visible above porch)
  const roofTrimGeo = new THREE.BoxGeometry(roofW, 0.15, 0.15);
  const roofTrim = new THREE.Mesh(roofTrimGeo, woodTrimMat);
  roofTrim.position.set(0, height + 0.2, depth / 2 + 0.2);
  group.add(roofTrim);

  // --- Side window on left wall (for jail cell light) ---
  const sideWinGeo = new THREE.PlaneGeometry(0.5, 0.5);
  const sideWin = new THREE.Mesh(sideWinGeo, winMat);
  sideWin.position.set(-width / 2 - 0.01, height * 0.6, -depth / 4);
  sideWin.rotation.y = -Math.PI / 2;
  group.add(sideWin);

  // Bars on side window
  const sideBarGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6);
  for (let i = 0; i < 3; i++) {
    const sBar = new THREE.Mesh(sideBarGeo, metalMat);
    sBar.position.set(-width / 2 - 0.02, height * 0.6, -depth / 4 - 0.2 + i * 0.2);
    group.add(sBar);
  }

  // --- Lantern by the door ---
  const lanternGroup = new THREE.Group();
  // Bracket
  const bracketGeo = new THREE.BoxGeometry(0.04, 0.04, 0.3);
  const bracket = new THREE.Mesh(bracketGeo, metalMat);
  bracket.position.set(0, 0, 0.15);
  lanternGroup.add(bracket);
  // Lamp body
  const lampGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.2, 6);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: 0xff8800,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.8,
  });
  const lamp = new THREE.Mesh(lampGeo, lampMat);
  lamp.position.set(0, -0.1, 0.3);
  lanternGroup.add(lamp);
  // Lamp cap
  const capGeo = new THREE.ConeGeometry(0.1, 0.08, 6);
  const cap = new THREE.Mesh(capGeo, metalMat);
  cap.position.set(0, 0.02, 0.3);
  lanternGroup.add(cap);
  // Light
  const lanternLight = new THREE.PointLight(0xffaa44, 0.8, 5);
  lanternLight.position.set(0, -0.05, 0.3);
  lanternGroup.add(lanternLight);

  // Place lantern by door (left side)
  lanternGroup.position.set(-doorW / 2 - 0.3, porchHeight - 0.3, depth / 2 + facadeThickness);
  group.add(lanternGroup);

  return group;
}

function addWindowFrame(
  group: THREE.Group, cx: number, cy: number, cz: number,
  w: number, h: number, mat: THREE.MeshStandardMaterial
): void {
  const t = 0.06;
  // Top
  const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, t, 0.08), mat);
  top.position.set(cx, cy + h / 2 + t / 2, cz);
  group.add(top);
  // Bottom
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, t, 0.08), mat);
  bottom.position.set(cx, cy - h / 2 - t / 2, cz);
  group.add(bottom);
  // Left
  const left = new THREE.Mesh(new THREE.BoxGeometry(t, h + 0.12, 0.08), mat);
  left.position.set(cx - w / 2 - t / 2, cy, cz);
  group.add(left);
  // Right
  const right = new THREE.Mesh(new THREE.BoxGeometry(t, h + 0.12, 0.08), mat);
  right.position.set(cx + w / 2 + t / 2, cy, cz);
  group.add(right);
}

// --------------- Interior ---------------

function buildInterior(def: BuildingDef): THREE.Group {
  // Use custom interior for the sheriff's office
  if (def.name === 'Šerifův úřad') {
    return buildSheriffInterior(def);
  }

  const group = new THREE.Group();
  // Interior is placed at a far-off location to avoid visual overlap
  // InteriorManager will manage positioning
  group.position.set(def.x, -50, def.z);

  const { width, depth, height } = def;
  const inW = width - 0.4;
  const inD = depth - 0.4;

  // Floor
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.9 });
  const floorGeo = new THREE.PlaneGeometry(inW, inD);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  floor.receiveShadow = true;
  group.add(floor);

  // Walls (3 walls — front is open / has door)
  const wallMat = new THREE.MeshStandardMaterial({
    color: def.wallColor,
    side: THREE.DoubleSide,
    roughness: 0.85,
  });

  // Back wall
  const backWallGeo = new THREE.PlaneGeometry(inW, height);
  const backWall = new THREE.Mesh(backWallGeo, wallMat);
  backWall.position.set(0, height / 2, -inD / 2);
  group.add(backWall);

  // Left wall
  const sideWallGeo = new THREE.PlaneGeometry(inD, height);
  const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
  leftWall.position.set(-inW / 2, height / 2, 0);
  leftWall.rotation.y = Math.PI / 2;
  group.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
  rightWall.position.set(inW / 2, height / 2, 0);
  rightWall.rotation.y = -Math.PI / 2;
  group.add(rightWall);

  // Ceiling
  const ceilGeo = new THREE.PlaneGeometry(inW, inD);
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x6b5b4f, side: THREE.DoubleSide });
  const ceil = new THREE.Mesh(ceilGeo, ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = height;
  group.add(ceil);

  // Interior light
  const pointLight = new THREE.PointLight(0xffd27f, 1.2, width * 3);
  pointLight.position.set(0, height - 0.5, 0);
  group.add(pointLight);

  // Some simple furniture based on building size
  addFurniture(group, def);

  return group;
}

// --------------- Sheriff's Office (custom interior) ---------------

function buildSheriffInterior(def: BuildingDef): THREE.Group {
  const group = new THREE.Group();
  group.position.set(def.x, -50, def.z);

  const { width, depth, height } = def;
  const inW = width - 0.4;
  const inD = depth - 0.4;

  // Materials
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xb0a090, side: THREE.DoubleSide, roughness: 0.85 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.8 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.6 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xdaa520, emissive: 0xdaa520, emissiveIntensity: 0.1, metalness: 0.5 });

  // Floor (wooden planks pattern)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x7a6040, roughness: 0.9 });
  const floorGeo = new THREE.PlaneGeometry(inW, inD);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  floor.receiveShadow = true;
  group.add(floor);

  // Walls (3 walls)
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(inW, height), wallMat);
  backWall.position.set(0, height / 2, -inD / 2);
  group.add(backWall);

  const sideWallGeo = new THREE.PlaneGeometry(inD, height);
  const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
  leftWall.position.set(-inW / 2, height / 2, 0);
  leftWall.rotation.y = Math.PI / 2;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
  rightWall.position.set(inW / 2, height / 2, 0);
  rightWall.rotation.y = -Math.PI / 2;
  group.add(rightWall);

  // Ceiling
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(inW, inD),
    new THREE.MeshStandardMaterial({ color: 0x6b5b4f, side: THREE.DoubleSide })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = height;
  group.add(ceil);

  // --- Main light (oil lamp hanging from ceiling) ---
  const mainLight = new THREE.PointLight(0xffd27f, 1.5, width * 3);
  mainLight.position.set(0, height - 0.5, 0);
  group.add(mainLight);

  // Hanging lamp mesh
  const lampChainGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4);
  const chain = new THREE.Mesh(lampChainGeo, metalMat);
  chain.position.set(0, height - 0.25, 0);
  group.add(chain);

  const lampBodyGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.15, 8);
  const lampBody = new THREE.Mesh(lampBodyGeo, new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: 0xff8800,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.8,
  }));
  lampBody.position.set(0, height - 0.55, 0);
  group.add(lampBody);

  // --- Sheriff's desk (left side of room) ---
  const deskW = inW * 0.4;
  const deskD = inD * 0.3;
  const deskH = 0.8;
  const deskX = -inW * 0.2;
  const deskZ = -inD * 0.25;

  // Desk top
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(deskW, 0.08, deskD), woodMat);
  deskTop.position.set(deskX, deskH, deskZ);
  deskTop.castShadow = true;
  group.add(deskTop);

  // Desk legs
  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, deskH, 6);
  const deskLegs = [
    [deskX - deskW / 2 + 0.1, deskH / 2, deskZ - deskD / 2 + 0.1],
    [deskX + deskW / 2 - 0.1, deskH / 2, deskZ - deskD / 2 + 0.1],
    [deskX - deskW / 2 + 0.1, deskH / 2, deskZ + deskD / 2 - 0.1],
    [deskX + deskW / 2 - 0.1, deskH / 2, deskZ + deskD / 2 - 0.1],
  ];
  for (const [lx, ly, lz] of deskLegs) {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(lx, ly, lz);
    group.add(leg);
  }

  // Desk drawer (front panel)
  const drawerGeo = new THREE.BoxGeometry(deskW * 0.4, 0.2, 0.05);
  const drawer = new THREE.Mesh(drawerGeo, darkWoodMat);
  drawer.position.set(deskX, deskH - 0.2, deskZ + deskD / 2 + 0.02);
  group.add(drawer);

  // Drawer handle
  const handleGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.08, 6);
  const handle = new THREE.Mesh(handleGeo, metalMat);
  handle.position.set(deskX, deskH - 0.2, deskZ + deskD / 2 + 0.05);
  handle.rotation.x = Math.PI / 2;
  group.add(handle);

  // Sheriff's chair
  const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), woodMat);
  chairSeat.position.set(deskX, 0.45, deskZ + deskD / 2 + 0.5);
  group.add(chairSeat);

  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.06), woodMat);
  chairBack.position.set(deskX, 0.7, deskZ + deskD / 2 + 0.72);
  group.add(chairBack);

  // Chair legs
  const chairLegGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6);
  const chairLegPositions = [
    [deskX - 0.2, 0.225, deskZ + deskD / 2 + 0.3],
    [deskX + 0.2, 0.225, deskZ + deskD / 2 + 0.3],
    [deskX - 0.2, 0.225, deskZ + deskD / 2 + 0.7],
    [deskX + 0.2, 0.225, deskZ + deskD / 2 + 0.7],
  ];
  for (const [cx, cy, cz] of chairLegPositions) {
    const cLeg = new THREE.Mesh(chairLegGeo, woodMat);
    cLeg.position.set(cx, cy, cz);
    group.add(cLeg);
  }

  // --- Jail cell (right side of room, partitioned by bars) ---
  const cellX = inW / 4;
  const barSpacing = 0.2;
  const cellBarCount = Math.floor((inD * 0.6) / barSpacing);
  const cellBarGeo = new THREE.CylinderGeometry(0.025, 0.025, height - 0.3, 8);

  // Vertical bars forming the cell wall
  for (let i = 0; i <= cellBarCount; i++) {
    const bar = new THREE.Mesh(cellBarGeo, metalMat);
    bar.position.set(cellX, height / 2, -inD / 2 + 0.3 + i * barSpacing);
    group.add(bar);
  }

  // Horizontal bars (top and middle)
  const hCellBarGeo = new THREE.CylinderGeometry(0.02, 0.02, inD * 0.6, 8);
  for (const hy of [height - 0.2, height * 0.5]) {
    const hBar = new THREE.Mesh(hCellBarGeo, metalMat);
    hBar.position.set(cellX, hy, -inD / 2 + 0.3 + (cellBarCount * barSpacing) / 2);
    hBar.rotation.x = Math.PI / 2;
    group.add(hBar);
  }

  // Cell door (gap in the bars with a frame)
  const cellDoorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, height - 0.3, 0.06),
    metalMat
  );
  cellDoorFrame.position.set(cellX, height / 2, -inD / 2 + 0.3);
  group.add(cellDoorFrame);

  // Cot inside the cell (simple bed)
  const cotMat = new THREE.MeshStandardMaterial({ color: 0x8b7355 });
  const cot = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 1.5), cotMat);
  cot.position.set(inW / 2 - 0.6, 0.35, -inD / 2 + 1);
  group.add(cot);

  // Cot legs
  const cotLegGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6);
  const cotLegs = [
    [inW / 2 - 1, 0.175, -inD / 2 + 0.3],
    [inW / 2 - 0.2, 0.175, -inD / 2 + 0.3],
    [inW / 2 - 1, 0.175, -inD / 2 + 1.7],
    [inW / 2 - 0.2, 0.175, -inD / 2 + 1.7],
  ];
  for (const [cx, cy, cz] of cotLegs) {
    const cl = new THREE.Mesh(cotLegGeo, woodMat);
    cl.position.set(cx, cy, cz);
    group.add(cl);
  }

  // Bucket in the cell
  const bucketGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.2, 8, 1, true);
  const bucketMat = new THREE.MeshStandardMaterial({ color: 0x666666, side: THREE.DoubleSide });
  const bucket = new THREE.Mesh(bucketGeo, bucketMat);
  bucket.position.set(inW / 2 - 0.3, 0.1, -inD / 2 + 2);
  group.add(bucket);

  // --- Weapon rack on left wall ---
  const rackGeo = new THREE.BoxGeometry(0.08, 0.08, 1.2);
  const rack = new THREE.Mesh(rackGeo, woodMat);
  rack.position.set(-inW / 2 + 0.05, 1.5, 0);
  group.add(rack);

  // Rifles on rack (2 diagonal sticks)
  const rifleMat = new THREE.MeshStandardMaterial({ color: 0x4a3020 });
  for (let i = 0; i < 2; i++) {
    const rifleGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 6);
    const rifle = new THREE.Mesh(rifleGeo, rifleMat);
    rifle.position.set(-inW / 2 + 0.1, 1.5, -0.3 + i * 0.6);
    rifle.rotation.z = 0.15;
    rifle.rotation.x = 0.1;
    group.add(rifle);
  }

  // --- Wanted posters on back wall ---
  const posterMat = new THREE.MeshStandardMaterial({ color: 0xf5deb3 });
  for (let i = 0; i < 3; i++) {
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), posterMat);
    poster.position.set(-0.8 + i * 0.8, height * 0.55, -inD / 2 + 0.01);
    group.add(poster);

    // "WANTED" text on poster
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f5deb3';
    ctx.fillRect(0, 0, 128, 160);
    ctx.fillStyle = '#8b0000';
    ctx.font = 'bold 20px serif';
    ctx.textAlign = 'center';
    ctx.fillText('WANTED', 64, 30);
    ctx.fillStyle = '#333';
    ctx.font = '14px serif';
    ctx.fillText('DEAD or ALIVE', 64, 50);
    // Simple face silhouette
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(64, 90, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px serif';
    ctx.fillText(`$${(i + 1) * 100}`, 64, 140);

    const texture = new THREE.CanvasTexture(canvas);
    const posterText = new THREE.Mesh(
      new THREE.PlaneGeometry(0.38, 0.48),
      new THREE.MeshBasicMaterial({ map: texture })
    );
    posterText.position.set(-0.8 + i * 0.8, height * 0.55, -inD / 2 + 0.015);
    group.add(posterText);
  }

  // --- Sheriff star on the wall (above desk) ---
  const starShape = new THREE.Shape();
  const outerR = 0.2;
  const innerR = 0.08;
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const innerAngle = outerAngle + Math.PI / 5;
    if (i === 0) {
      starShape.moveTo(Math.cos(outerAngle) * outerR, Math.sin(outerAngle) * outerR);
    } else {
      starShape.lineTo(Math.cos(outerAngle) * outerR, Math.sin(outerAngle) * outerR);
    }
    starShape.lineTo(Math.cos(innerAngle) * innerR, Math.sin(innerAngle) * innerR);
  }
  starShape.closePath();
  const wallStar = new THREE.Mesh(new THREE.ShapeGeometry(starShape), goldMat);
  wallStar.position.set(deskX, height * 0.75, -inD / 2 + 0.02);
  group.add(wallStar);

  // Dim cell light (reddish, moody)
  const cellLight = new THREE.PointLight(0xff6644, 0.4, 4);
  cellLight.position.set(inW / 2 - 0.5, height - 0.5, -inD / 4);
  group.add(cellLight);

  return group;
}

function addFurniture(group: THREE.Group, def: BuildingDef): void {
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4226 });

  const inW = def.width - 0.4;
  const inD = def.depth - 0.4;

  // Table in the center-back
  const tableGeo = new THREE.BoxGeometry(inW * 0.4, 0.1, inD * 0.3);
  const table = new THREE.Mesh(tableGeo, woodMat);
  table.position.set(0, 0.8, -inD * 0.25);
  table.castShadow = true;
  group.add(table);

  // Table legs
  const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6);
  const positions = [
    [-inW * 0.18, 0.4, -inD * 0.35],
    [inW * 0.18, 0.4, -inD * 0.35],
    [-inW * 0.18, 0.4, -inD * 0.15],
    [inW * 0.18, 0.4, -inD * 0.15],
  ];
  for (const [lx, ly, lz] of positions) {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(lx, ly, lz);
    group.add(leg);
  }

  // Chair (simple box)
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x8b6914 });
  const chairGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const chair = new THREE.Mesh(chairGeo, chairMat);
  chair.position.set(inW * 0.25, 0.25, 0);
  chair.castShadow = true;
  group.add(chair);
}

// --------------- Physics collider ---------------

function buildCollider(def: BuildingDef): CANNON.Body {
  const body = new CANNON.Body({ type: CANNON.Body.STATIC });
  const halfW = def.width / 2;
  const halfH = def.height / 2;
  const halfD = def.depth / 2;
  body.addShape(new CANNON.Box(new CANNON.Vec3(halfW, halfH, halfD)));
  body.position.set(def.x, halfH, def.z);
  body.quaternion.setFromEuler(0, def.rotY, 0);
  return body;
}

// --------------- Door position ---------------

function computeDoorPosition(def: BuildingDef): THREE.Vector3 {
  // Door is at the front face (positive Z local) + offset for trigger zone
  const offset = new THREE.Vector3(0, 0, def.depth / 2 + 1.2);
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), def.rotY);
  return new THREE.Vector3(def.x + offset.x, 0, def.z + offset.z);
}
