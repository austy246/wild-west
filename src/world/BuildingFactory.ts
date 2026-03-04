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
  switch (def.name) {
    case 'Saloon': addSaloonFurniture(group, def); break;
    case 'Dům 1': addHouse1Furniture(group, def); break;
    case 'Dům 2': addHouse2Furniture(group, def); break;
    case 'Obchod': addShopFurniture(group, def); break;
    case 'Hotel': addHotelFurniture(group, def); break;
    case 'Stáje': addStableFurniture(group, def); break;
    case 'Kovárna': addBlacksmithFurniture(group, def); break;
    case 'Kostel': addChurchFurniture(group, def); break;
    default: addGenericFurniture(group, def); break;
  }
}

function addGenericFurniture(group: THREE.Group, def: BuildingDef): void {
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4226 });
  const inW = def.width - 0.4;
  const inD = def.depth - 0.4;
  addTable(group, 0, -inD * 0.25, inW * 0.4, inD * 0.3, woodMat);
  addChair(group, inW * 0.25, 0, woodMat);
}

// ---- Helper: table with legs ----
function addTable(g: THREE.Group, x: number, z: number, w: number, d: number, mat: THREE.Material): void {
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), mat);
  top.position.set(x, 0.8, z);
  top.castShadow = true;
  g.add(top);
  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6);
  const hw = w / 2 - 0.08, hd = d / 2 - 0.08;
  for (const [lx, lz] of [[x - hw, z - hd], [x + hw, z - hd], [x - hw, z + hd], [x + hw, z + hd]]) {
    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.set(lx, 0.4, lz);
    g.add(leg);
  }
}

// ---- Helper: chair ----
function addChair(g: THREE.Group, x: number, z: number, mat: THREE.Material): void {
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.45), mat);
  seat.position.set(x, 0.45, z);
  seat.castShadow = true;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.05), mat);
  back.position.set(x, 0.7, z - 0.2);
  g.add(back);
  const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6);
  for (const [lx, lz] of [[x - 0.18, z - 0.18], [x + 0.18, z - 0.18], [x - 0.18, z + 0.18], [x + 0.18, z + 0.18]]) {
    const l = new THREE.Mesh(legGeo, mat);
    l.position.set(lx, 0.225, lz);
    g.add(l);
  }
}

// ---- Helper: shelf on wall ----
function addShelf(g: THREE.Group, x: number, y: number, z: number, w: number, mat: THREE.Material): void {
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.3), mat);
  shelf.position.set(x, y, z);
  shelf.castShadow = true;
  g.add(shelf);
  // Brackets
  const bGeo = new THREE.BoxGeometry(0.04, 0.15, 0.25);
  for (const bx of [x - w / 2 + 0.1, x + w / 2 - 0.1]) {
    const b = new THREE.Mesh(bGeo, mat);
    b.position.set(bx, y - 0.1, z);
    g.add(b);
  }
}

// ---- Helper: barrel ----
function addBarrel(g: THREE.Group, x: number, z: number): void {
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.8 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.7, 10), mat);
  barrel.position.set(x, 0.35, z);
  barrel.castShadow = true;
  g.add(barrel);
  // Metal bands
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.5 });
  for (const by of [0.15, 0.55]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.015, 6, 12), bandMat);
    band.position.set(x, by, z);
    band.rotation.x = Math.PI / 2;
    g.add(band);
  }
}

// ---- Helper: bed ----
function addBed(g: THREE.Group, x: number, z: number, rotY: number): void {
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  const blanketMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.9 });
  const pillowMat = new THREE.MeshStandardMaterial({ color: 0xf5f5dc });
  // Frame
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 1.8), frameMat);
  frame.position.set(x, 0.35, z);
  frame.rotation.y = rotY;
  frame.castShadow = true;
  g.add(frame);
  // Legs
  const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 6);
  const cos = Math.cos(rotY), sin = Math.sin(rotY);
  for (const [lx, lz] of [[-0.45, -0.85], [0.45, -0.85], [-0.45, 0.85], [0.45, 0.85]]) {
    const wx = x + lx * cos - lz * sin;
    const wz = z + lx * sin + lz * cos;
    const l = new THREE.Mesh(legGeo, frameMat);
    l.position.set(wx, 0.175, wz);
    g.add(l);
  }
  // Blanket
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 1.2), blanketMat);
  blanket.position.set(x + 0.1 * sin, 0.44, z + 0.1 * cos);
  blanket.rotation.y = rotY;
  g.add(blanket);
  // Pillow
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.25), pillowMat);
  const px = x + (-0.65) * sin;
  const pz = z + (-0.65) * cos;
  pillow.position.set(px, 0.45, pz);
  pillow.rotation.y = rotY;
  g.add(pillow);
  // Headboard
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.06), frameMat);
  const hx = x + (-0.9) * sin;
  const hz = z + (-0.9) * cos;
  headboard.position.set(hx, 0.5, hz);
  headboard.rotation.y = rotY;
  g.add(headboard);
}

// ---- Helper: bottle on surface ----
function addBottle(g: THREE.Group, x: number, y: number, z: number, color: number): void {
  const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.7 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.18, 8), mat);
  body.position.set(x, y + 0.09, z);
  g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.08, 8), mat);
  neck.position.set(x, y + 0.22, z);
  g.add(neck);
}

// ======== SALOON ========
function addSaloonFurniture(g: THREE.Group, def: BuildingDef): void {
  const inW = def.width - 0.4;
  const inD = def.depth - 0.4;
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4226 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3e2723 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 });

  // --- Bar counter along the back wall ---
  const barW = inW * 0.85;
  const barTop = new THREE.Mesh(new THREE.BoxGeometry(barW, 0.08, 0.7), darkWood);
  barTop.position.set(0, 1.1, -inD / 2 + 0.5);
  barTop.castShadow = true;
  g.add(barTop);
  const barFront = new THREE.Mesh(new THREE.BoxGeometry(barW, 1.1, 0.06), woodMat);
  barFront.position.set(0, 0.55, -inD / 2 + 0.85);
  g.add(barFront);
  const barBack = new THREE.Mesh(new THREE.BoxGeometry(barW, 1.1, 0.06), woodMat);
  barBack.position.set(0, 0.55, -inD / 2 + 0.2);
  g.add(barBack);
  // Foot rail
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, barW, 8), metalMat);
  rail.position.set(0, 0.2, -inD / 2 + 0.9);
  rail.rotation.z = Math.PI / 2;
  g.add(rail);

  // --- Shelves behind bar with bottles ---
  for (let sy = 0; sy < 3; sy++) {
    addShelf(g, 0, 1.4 + sy * 0.5, -inD / 2 + 0.15, barW * 0.7, woodMat);
    // Bottles on each shelf
    for (let bx = -barW * 0.25; bx <= barW * 0.25; bx += 0.2) {
      const colors = [0x2e7d32, 0x8b4513, 0xdaa520, 0x800020];
      addBottle(g, bx, 1.42 + sy * 0.5, -inD / 2 + 0.15, colors[Math.floor(Math.random() * colors.length)]);
    }
  }

  // --- Bar stools ---
  for (let i = -2; i <= 2; i++) {
    const sx = i * 0.8;
    const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.06, 10), darkWood);
    stoolSeat.position.set(sx, 0.75, -inD / 2 + 1.2);
    stoolSeat.castShadow = true;
    g.add(stoolSeat);
    const stoolLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.75, 6), metalMat);
    stoolLeg.position.set(sx, 0.375, -inD / 2 + 1.2);
    g.add(stoolLeg);
    const footRest = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.015, 6, 10), metalMat);
    footRest.position.set(sx, 0.25, -inD / 2 + 1.2);
    footRest.rotation.x = Math.PI / 2;
    g.add(footRest);
  }

  // --- Round tables with chairs ---
  for (const [tx, tz] of [[-inW * 0.3, inD * 0.1], [inW * 0.3, inD * 0.1], [0, inD * 0.25]]) {
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 12), woodMat);
    tableTop.position.set(tx, 0.78, tz);
    tableTop.castShadow = true;
    g.add(tableTop);
    const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.78, 8), woodMat);
    tableLeg.position.set(tx, 0.39, tz);
    g.add(tableLeg);
    // Chairs around table
    for (const [cx, cz] of [[tx - 0.6, tz], [tx + 0.6, tz], [tx, tz + 0.6]]) {
      addChair(g, cx, cz, woodMat);
    }
    // Some bottles/mugs on tables
    addBottle(g, tx + 0.15, 0.81, tz - 0.1, 0x8b4513);
  }

  // --- Piano in the corner ---
  const pianoMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const pianoBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 0.5), pianoMat);
  pianoBody.position.set(-inW / 2 + 0.7, 0.5, inD / 2 - 0.5);
  pianoBody.castShadow = true;
  g.add(pianoBody);
  // Piano top lid
  const pianoLid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.5), pianoMat);
  pianoLid.position.set(-inW / 2 + 0.7, 1.02, inD / 2 - 0.5);
  g.add(pianoLid);
  // Keys (white strip)
  const keysMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5 });
  const keys = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.12), keysMat);
  keys.position.set(-inW / 2 + 0.7, 0.82, inD / 2 - 0.2);
  keys.rotation.x = -0.15;
  g.add(keys);
  // Piano stool
  const pianoStool = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.06, 10), woodMat);
  pianoStool.position.set(-inW / 2 + 0.7, 0.5, inD / 2 - 0.05);
  g.add(pianoStool);
  const pianoStoolLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.5, 6), woodMat);
  pianoStoolLeg.position.set(-inW / 2 + 0.7, 0.25, inD / 2 - 0.05);
  g.add(pianoStoolLeg);

  // --- Barrels in the corner ---
  addBarrel(g, inW / 2 - 0.5, inD / 2 - 0.5);
  addBarrel(g, inW / 2 - 0.5, inD / 2 - 1.2);
}

// ======== DŮM 1 ========
function addHouse1Furniture(g: THREE.Group, def: BuildingDef): void {
  const inW = def.width - 0.4;
  const inD = def.depth - 0.4;
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4226 });

  // Bed in the corner
  addBed(g, -inW / 2 + 0.7, -inD / 2 + 1, 0);

  // Dining table and chairs in center
  addTable(g, 0.5, 0.3, 1.2, 0.8, woodMat);
  addChair(g, 0.5, 0.8, woodMat);
  addChair(g, 0.5, -0.2, woodMat);
  addChair(g, -0.1, 0.3, woodMat);
  addChair(g, 1.1, 0.3, woodMat);

  // Shelf on back wall
  addShelf(g, 0, 1.5, -inD / 2 + 0.15, inW * 0.6, woodMat);
  addShelf(g, 0, 2.0, -inD / 2 + 0.15, inW * 0.5, woodMat);

  // Fireplace on right wall
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.95 });
  const fireplaceBase = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.5), stoneMat);
  fireplaceBase.position.set(inW / 2 - 0.3, 0.5, -inD / 2 + 0.4);
  g.add(fireplaceBase);
  const fireplaceHood = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.15, 0.55), stoneMat);
  fireplaceHood.position.set(inW / 2 - 0.3, 1.05, -inD / 2 + 0.4);
  g.add(fireplaceHood);
  // Fire glow
  const fireLight = new THREE.PointLight(0xff4400, 0.6, 3);
  fireLight.position.set(inW / 2 - 0.3, 0.4, -inD / 2 + 0.4);
  g.add(fireLight);
  const fireMat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.8 });
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 6), fireMat);
  fire.position.set(inW / 2 - 0.3, 0.2, -inD / 2 + 0.4);
  g.add(fire);

  // Rug on floor
  const rugMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 1 });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1), rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.5, 0.02, 0.3);
  g.add(rug);
}

// ======== DŮM 2 ========
function addHouse2Furniture(g: THREE.Group, def: BuildingDef): void {
  const inW = def.width - 0.4;
  const inD = def.depth - 0.4;
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b7355 });

  // Bed on right side
  addBed(g, inW / 2 - 0.7, -inD / 2 + 1, 0);

  // Small table with one chair
  addTable(g, -0.8, 0, 0.8, 0.6, woodMat);
  addChair(g, -0.8, 0.5, woodMat);

  // Bookshelf on left wall
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  const bookshelf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2, 1.2), shelfMat);
  bookshelf.position.set(-inW / 2 + 0.25, 1, -inD / 2 + 0.8);
  bookshelf.castShadow = true;
  g.add(bookshelf);
  // Shelf dividers
  for (let sy = 0; sy < 3; sy++) {
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 1.18), shelfMat);
    divider.position.set(-inW / 2 + 0.25, 0.5 + sy * 0.55, -inD / 2 + 0.8);
    g.add(divider);
  }
  // Books
  const bookColors = [0x8b0000, 0x006400, 0x00008b, 0x8b4513, 0x4b0082];
  for (let sy = 0; sy < 3; sy++) {
    for (let bx = 0; bx < 4; bx++) {
      const bookMat = new THREE.MeshStandardMaterial({ color: bookColors[Math.floor(Math.random() * bookColors.length)] });
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.2), bookMat);
      book.position.set(-inW / 2 + 0.25, 0.65 + sy * 0.55, -inD / 2 + 0.4 + bx * 0.25);
      g.add(book);
    }
  }

  // Chest at foot of bed
  const chestMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.4), chestMat);
  chest.position.set(inW / 2 - 0.7, 0.2, -inD / 2 + 2);
  chest.castShadow = true;
  g.add(chest);
  const chestLid = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.42), chestMat);
  chestLid.position.set(inW / 2 - 0.7, 0.42, -inD / 2 + 2);
  g.add(chestLid);
  // Metal clasp
  const claspMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6 });
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.06), claspMat);
  clasp.position.set(inW / 2 - 0.7, 0.35, -inD / 2 + 2.22);
  g.add(clasp);

  // Rocking chair
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b4226 });
  const rockSeat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), rockMat);
  rockSeat.position.set(-0.8, 0.4, inD / 2 - 0.6);
  g.add(rockSeat);
  const rockBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.05), rockMat);
  rockBack.position.set(-0.8, 0.7, inD / 2 - 0.85);
  g.add(rockBack);
  // Rockers
  for (const side of [-0.22, 0.22]) {
    const rocker = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.02, 6, 12, Math.PI * 0.6), rockMat);
    rocker.position.set(-0.8 + side, 0.1, inD / 2 - 0.6);
    rocker.rotation.y = Math.PI / 2;
    g.add(rocker);
  }
}

// ======== OBCHOD (Shop) ========
function addShopFurniture(g: THREE.Group, def: BuildingDef): void {
  const inW = def.width - 0.4;
  const inD = def.depth - 0.4;
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4226 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3e2723 });

  // --- Counter across the middle ---
  const counterW = inW * 0.75;
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(counterW, 0.08, 0.7), darkWood);
  counterTop.position.set(0, 1, 0);
  counterTop.castShadow = true;
  g.add(counterTop);
  const counterFront = new THREE.Mesh(new THREE.BoxGeometry(counterW, 1, 0.06), woodMat);
  counterFront.position.set(0, 0.5, 0.35);
  g.add(counterFront);
  const counterBack = new THREE.Mesh(new THREE.BoxGeometry(counterW, 1, 0.06), woodMat);
  counterBack.position.set(0, 0.5, -0.35);
  g.add(counterBack);

  // Cash register on counter
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 });
  const register = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.25), metalMat);
  register.position.set(counterW / 2 - 0.3, 1.16, 0);
  g.add(register);
  // Register drawer handle
  const rHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 6), metalMat);
  rHandle.position.set(counterW / 2 - 0.3, 1.08, 0.14);
  rHandle.rotation.x = Math.PI / 2;
  g.add(rHandle);

  // --- Shelves along back wall with goods ---
  const shelfW = inW * 0.8;
  for (let row = 0; row < 3; row++) {
    addShelf(g, 0, 0.8 + row * 0.6, -inD / 2 + 0.15, shelfW, woodMat);
    // Items on shelves
    const itemColors = [0xdeb887, 0x8b4513, 0xf5f5dc, 0xcd853f, 0xd2691e];
    for (let ix = -3; ix <= 3; ix++) {
      const itemMat = new THREE.MeshStandardMaterial({ color: itemColors[Math.floor(Math.random() * itemColors.length)] });
      const item = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.12), itemMat);
      item.position.set(ix * 0.3, 0.92 + row * 0.6, -inD / 2 + 0.15);
      g.add(item);
    }
  }

  // --- Shelves along left wall ---
  for (let row = 0; row < 2; row++) {
    addShelf(g, -inW / 2 + 0.2, 1 + row * 0.6, 0, 0.35, woodMat);
  }

  // --- Barrels on the right ---
  addBarrel(g, inW / 2 - 0.5, -inD / 2 + 0.5);
  addBarrel(g, inW / 2 - 0.5, -inD / 2 + 1.3);
  addBarrel(g, inW / 2 - 0.5, inD / 2 - 0.5);

  // Sacks of goods
  const sackMat = new THREE.MeshStandardMaterial({ color: 0xc4a67a, roughness: 1 });
  for (const [sx, sz] of [[inW / 2 - 0.4, 0.5], [inW / 2 - 0.7, 0.3]]) {
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), sackMat);
    sack.scale.set(1, 0.7, 1);
    sack.position.set(sx, 0.18, sz);
    sack.castShadow = true;
    g.add(sack);
  }

  // Scale on counter
  const scaleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.04, 10), metalMat);
  scaleBase.position.set(-0.3, 1.06, 0);
  g.add(scaleBase);
  const scalePole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), metalMat);
  scalePole.position.set(-0.3, 1.2, 0);
  g.add(scalePole);
  // Scale arms
  const scaleArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.015, 0.015), metalMat);
  scaleArm.position.set(-0.3, 1.35, 0);
  g.add(scaleArm);
}

// ======== HOTEL ========
function addHotelFurniture(g: THREE.Group, def: BuildingDef): void {
  const inW = def.width - 0.4;
  const inD = def.depth - 0.4;
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4226 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3e2723 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xdaa520, metalness: 0.5 });

  // --- Reception desk near front ---
  const deskW = inW * 0.5;
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(deskW, 0.08, 0.6), darkWood);
  deskTop.position.set(-inW / 4, 1.05, inD / 2 - 1.2);
  deskTop.castShadow = true;
  g.add(deskTop);
  const deskFront = new THREE.Mesh(new THREE.BoxGeometry(deskW, 1.05, 0.06), woodMat);
  deskFront.position.set(-inW / 4, 0.525, inD / 2 - 0.9);
  g.add(deskFront);

  // Guest book on desk
  const bookMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 });
  const guestBook = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.35), bookMat);
  guestBook.position.set(-inW / 4, 1.09, inD / 2 - 1.2);
  guestBook.rotation.y = 0.15;
  g.add(guestBook);

  // Bell on desk
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2), goldMat);
  bell.position.set(-inW / 4 + 0.4, 1.09, inD / 2 - 1.1);
  g.add(bell);

  // --- Key rack on back wall ---
  const rackBoard = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 0.05), woodMat);
  rackBoard.position.set(0, 1.8, -inD / 2 + 0.05);
  g.add(rackBoard);
  // Key hooks and keys
  for (let i = 0; i < 5; i++) {
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.06, 6), metalMat);
    hook.position.set(-0.5 + i * 0.25, 1.7, -inD / 2 + 0.1);
    hook.rotation.x = Math.PI / 4;
    g.add(hook);
    // Key dangling
    if (Math.random() > 0.3) {
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.005), goldMat);
      key.position.set(-0.5 + i * 0.25, 1.62, -inD / 2 + 0.12);
      g.add(key);
    }
  }
  // Room numbers above keys
  const numCanvas = document.createElement('canvas');
  numCanvas.width = 256;
  numCanvas.height = 64;
  const numCtx = numCanvas.getContext('2d')!;
  numCtx.fillStyle = '#6b4226';
  numCtx.fillRect(0, 0, 256, 64);
  numCtx.fillStyle = '#DEB887';
  numCtx.font = 'bold 24px serif';
  numCtx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    numCtx.fillText(`${i + 1}`, 26 + i * 51, 42);
  }
  const numTexture = new THREE.CanvasTexture(numCanvas);
  const numPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.2), new THREE.MeshBasicMaterial({ map: numTexture }));
  numPlane.position.set(0, 2.0, -inD / 2 + 0.06);
  g.add(numPlane);

  // --- Luggage pile ---
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
  const suitcase1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), leatherMat);
  suitcase1.position.set(inW / 2 - 0.5, 0.15, inD / 2 - 0.5);
  suitcase1.castShadow = true;
  g.add(suitcase1);
  const suitcase2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.3), leatherMat);
  suitcase2.position.set(inW / 2 - 0.5, 0.43, inD / 2 - 0.5);
  suitcase2.rotation.y = 0.3;
  g.add(suitcase2);

  // --- Staircase suggestion (posts and railing) ---
  const stairMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  for (let step = 0; step < 4; step++) {
    const stair = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.4), stairMat);
    stair.position.set(inW / 2 - 0.7, 0.06 + step * 0.25, -inD / 2 + 0.5 + step * 0.4);
    stair.castShadow = true;
    g.add(stair);
  }
  // Newel post
  const newel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8), stairMat);
  newel.position.set(inW / 2 - 0.1, 0.75, -inD / 2 + 0.5);
  g.add(newel);
  const newelCap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), stairMat);
  newelCap.position.set(inW / 2 - 0.1, 1.5, -inD / 2 + 0.5);
  g.add(newelCap);

  // --- Coat rack ---
  const coatPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.8, 6), woodMat);
  coatPole.position.set(-inW / 2 + 0.3, 0.9, inD / 2 - 0.4);
  g.add(coatPole);
  // Hooks
  for (let i = 0; i < 3; i++) {
    const hookArm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 6), metalMat);
    hookArm.position.set(-inW / 2 + 0.3, 1.5, inD / 2 - 0.4);
    hookArm.rotation.z = Math.PI / 3;
    hookArm.rotation.y = (i * Math.PI * 2) / 3;
    g.add(hookArm);
  }

  // Rug
  const rugMat = new THREE.MeshStandardMaterial({ color: 0x800020, roughness: 1 });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.5), rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.02, 0);
  g.add(rug);
}

// ======== STÁJE (Stables) ========
function addStableFurniture(g: THREE.Group, def: BuildingDef): void {
  const inW = def.width - 0.4;
  const inD = def.depth - 0.4;
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4226 });
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xdaa520, roughness: 1 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 });

  // --- Horse stall dividers ---
  const stallCount = 3;
  const stallW = inW / stallCount;
  for (let i = 1; i < stallCount; i++) {
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, inD * 0.6), woodMat);
    divider.position.set(-inW / 2 + i * stallW, 0.75, -inD / 4);
    divider.castShadow = true;
    g.add(divider);
  }

  // Stall gates at front
  for (let i = 0; i < stallCount; i++) {
    const gateX = -inW / 2 + i * stallW + stallW / 2;
    const gate = new THREE.Mesh(new THREE.BoxGeometry(stallW - 0.2, 1, 0.08), woodMat);
    gate.position.set(gateX, 0.5, -inD / 4 + inD * 0.3);
    g.add(gate);
    // Gate latch
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.06), metalMat);
    latch.position.set(gateX + stallW / 2 - 0.2, 0.7, -inD / 4 + inD * 0.3 + 0.06);
    g.add(latch);
  }

  // --- Hay bales ---
  for (const [hx, hz] of [[inW / 2 - 0.6, inD / 2 - 0.5], [inW / 2 - 0.6, inD / 2 - 1.2], [-inW / 2 + 0.5, inD / 2 - 0.5]]) {
    const bale = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.5), hayMat);
    bale.position.set(hx, 0.2, hz);
    bale.castShadow = true;
    g.add(bale);
  }
  // Stacked bale
  const topBale = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.5), hayMat);
  topBale.position.set(inW / 2 - 0.6, 0.6, inD / 2 - 0.5);
  topBale.rotation.y = 0.3;
  topBale.castShadow = true;
  g.add(topBale);

  // Hay scattered in stalls
  for (let i = 0; i < stallCount; i++) {
    const stallCenterX = -inW / 2 + i * stallW + stallW / 2;
    const hayPile = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4), hayMat);
    hayPile.scale.set(1.5, 0.3, 1.2);
    hayPile.position.set(stallCenterX, 0.08, -inD / 2 + 0.5);
    g.add(hayPile);
  }

  // --- Water trough ---
  const troughMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  const trough = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.4), troughMat);
  trough.position.set(0, 0.25, inD / 2 - 1.5);
  g.add(trough);
  // Water inside
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x4a90d9, transparent: true, opacity: 0.6 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.3), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.38, inD / 2 - 1.5);
  g.add(water);

  // --- Tools on wall (pitchfork, shovel) ---
  const toolMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  // Pitchfork handle
  const pfHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), toolMat);
  pfHandle.position.set(-inW / 2 + 0.1, 1.2, inD / 2 - 0.3);
  pfHandle.rotation.z = 0.1;
  g.add(pfHandle);
  // Pitchfork head
  for (let t = -1; t <= 1; t++) {
    const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.25, 4), metalMat);
    tine.position.set(-inW / 2 + 0.05, 2, inD / 2 - 0.3 + t * 0.04);
    g.add(tine);
  }

  // Shovel
  const shHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), toolMat);
  shHandle.position.set(-inW / 2 + 0.1, 1.2, inD / 2 - 0.6);
  shHandle.rotation.z = 0.08;
  g.add(shHandle);
  const shBlade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.02), metalMat);
  shBlade.position.set(-inW / 2 + 0.06, 1.95, inD / 2 - 0.6);
  g.add(shBlade);

  addBarrel(g, -inW / 2 + 0.5, inD / 2 - 1.5);
}

// ======== KOVÁRNA (Blacksmith) ========
function addBlacksmithFurniture(g: THREE.Group, def: BuildingDef): void {
  const inW = def.width - 0.4;
  const inD = def.depth - 0.4;
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7, roughness: 0.3 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.95 });

  // --- Forge (stone furnace at back wall) ---
  const forge = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 1), stoneMat);
  forge.position.set(0, 0.5, -inD / 2 + 0.6);
  forge.castShadow = true;
  g.add(forge);
  // Fire inside forge
  const fireMat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 1 });
  const forgeOpening = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.5), fireMat);
  forgeOpening.position.set(0, 0.5, -inD / 2 + 1.11);
  g.add(forgeOpening);
  // Chimney
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.6), stoneMat);
  chimney.position.set(0, 1.75, -inD / 2 + 0.4);
  g.add(chimney);
  // Forge glow
  const forgeLight = new THREE.PointLight(0xff4400, 1.2, 5);
  forgeLight.position.set(0, 0.8, -inD / 2 + 1);
  g.add(forgeLight);

  // --- Anvil ---
  const anvilBase = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.4, 8), metalMat);
  anvilBase.position.set(-0.8, 0.2, 0);
  anvilBase.castShadow = true;
  g.add(anvilBase);
  // Anvil body (tree stump base)
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 0.5, 10), woodMat);
  stump.position.set(-0.8, 0.25, 0);
  g.add(stump);
  const anvilTop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.3), metalMat);
  anvilTop.position.set(-0.8, 0.58, 0);
  anvilTop.castShadow = true;
  g.add(anvilTop);
  // Anvil horn
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 8), metalMat);
  horn.position.set(-0.8, 0.58, 0.25);
  horn.rotation.x = Math.PI / 2;
  g.add(horn);

  // --- Workbench ---
  addTable(g, inW / 2 - 0.7, 0, 1.0, 0.6, woodMat);

  // --- Hammer on anvil ---
  const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.08), metalMat);
  hammerHead.position.set(-0.7, 0.7, 0.05);
  g.add(hammerHead);
  const hammerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), woodMat);
  hammerHandle.position.set(-0.7, 0.7, 0.2);
  hammerHandle.rotation.x = Math.PI / 2;
  g.add(hammerHandle);

  // --- Tongs ---
  const tongsMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 });
  const tongs = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), tongsMat);
  tongs.position.set(-0.5, 0.7, -0.1);
  tongs.rotation.z = 0.3;
  g.add(tongs);

  // --- Horseshoes on wall ---
  for (let i = 0; i < 4; i++) {
    const hsGeo = new THREE.TorusGeometry(0.08, 0.015, 6, 10, Math.PI * 1.5);
    const hs = new THREE.Mesh(hsGeo, metalMat);
    hs.position.set(-inW / 2 + 0.05, 1.5 + (i % 2) * 0.3, -0.5 + i * 0.3);
    hs.rotation.y = Math.PI / 2;
    g.add(hs);
  }

  // --- Water quench barrel ---
  addBarrel(g, 0.8, -inD / 2 + 1.2);
  // Water surface
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, transparent: true, opacity: 0.5 });
  const waterSurface = new THREE.Mesh(new THREE.CircleGeometry(0.28, 10), waterMat);
  waterSurface.rotation.x = -Math.PI / 2;
  waterSurface.position.set(0.8, 0.65, -inD / 2 + 1.2);
  g.add(waterSurface);

  // Metal ingots stacked
  const ingotMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8 });
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const ingot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.1), ingotMat);
      ingot.position.set(inW / 2 - 0.4 + col * 0.22, 0.04 + row * 0.1, inD / 2 - 0.4);
      g.add(ingot);
    }
  }
}

// ======== KOSTEL (Church) ========
function addChurchFurniture(g: THREE.Group, def: BuildingDef): void {
  const inW = def.width - 0.4;
  const inD = def.depth - 0.4;
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4226 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3e2723 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xdaa520, emissive: 0xdaa520, emissiveIntensity: 0.1, metalness: 0.5 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0xf5f5dc });

  // --- Pews (rows of benches) ---
  const pewCount = 4;
  const pewW = inW * 0.35;
  for (let row = 0; row < pewCount; row++) {
    const z = -inD / 4 + row * (inD * 0.15);
    for (const side of [-1, 1]) {
      const x = side * (inW / 4);
      // Seat
      const seat = new THREE.Mesh(new THREE.BoxGeometry(pewW, 0.06, 0.4), woodMat);
      seat.position.set(x, 0.45, z);
      seat.castShadow = true;
      g.add(seat);
      // Back rest
      const backRest = new THREE.Mesh(new THREE.BoxGeometry(pewW, 0.5, 0.05), woodMat);
      backRest.position.set(x, 0.7, z - 0.18);
      g.add(backRest);
      // Legs
      const legGeo = new THREE.BoxGeometry(0.06, 0.45, 0.35);
      for (const lx of [x - pewW / 2 + 0.05, x + pewW / 2 - 0.05]) {
        const leg = new THREE.Mesh(legGeo, woodMat);
        leg.position.set(lx, 0.225, z);
        g.add(leg);
      }
    }
  }

  // --- Aisle (center clear, marked by rug) ---
  const aisleMat = new THREE.MeshStandardMaterial({ color: 0x800020, roughness: 1 });
  const aisle = new THREE.Mesh(new THREE.PlaneGeometry(0.8, inD * 0.8), aisleMat);
  aisle.rotation.x = -Math.PI / 2;
  aisle.position.set(0, 0.02, 0);
  g.add(aisle);

  // --- Altar at front (back wall) ---
  const altarBase = new THREE.Mesh(new THREE.BoxGeometry(inW * 0.5, 0.9, 0.6), darkWood);
  altarBase.position.set(0, 0.45, -inD / 2 + 0.5);
  altarBase.castShadow = true;
  g.add(altarBase);
  // Altar cloth
  const altarCloth = new THREE.Mesh(new THREE.BoxGeometry(inW * 0.52, 0.04, 0.65), clothMat);
  altarCloth.position.set(0, 0.92, -inD / 2 + 0.5);
  g.add(altarCloth);

  // --- Cross on the wall above altar ---
  const crossVert = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.06), goldMat);
  crossVert.position.set(0, 2.2, -inD / 2 + 0.05);
  g.add(crossVert);
  const crossHoriz = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.06), goldMat);
  crossHoriz.position.set(0, 2.5, -inD / 2 + 0.05);
  g.add(crossHoriz);

  // --- Candles on altar ---
  const candleMat = new THREE.MeshStandardMaterial({ color: 0xf5f5dc });
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff8800, emissiveIntensity: 0.8 });
  for (const cx of [-0.5, 0.5]) {
    // Candle holder
    const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.08, 8), goldMat);
    holder.position.set(cx, 0.96, -inD / 2 + 0.5);
    g.add(holder);
    // Candle
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), candleMat);
    candle.position.set(cx, 1.1, -inD / 2 + 0.5);
    g.add(candle);
    // Flame
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 6), flameMat);
    flame.position.set(cx, 1.23, -inD / 2 + 0.5);
    g.add(flame);
    // Candle light
    const candleLight = new THREE.PointLight(0xffaa44, 0.3, 3);
    candleLight.position.set(cx, 1.25, -inD / 2 + 0.5);
    g.add(candleLight);
  }

  // --- Pulpit/lectern to the side ---
  const pulpitBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1, 8), darkWood);
  pulpitBase.position.set(-inW / 2 + 0.6, 0.5, -inD / 2 + 0.8);
  g.add(pulpitBase);
  const pulpitTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.35), darkWood);
  pulpitTop.position.set(-inW / 2 + 0.6, 1.03, -inD / 2 + 0.8);
  pulpitTop.rotation.x = -0.2;
  g.add(pulpitTop);
  // Open book on pulpit
  const openBook = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.25), new THREE.MeshStandardMaterial({ color: 0xf5f5dc }));
  openBook.position.set(-inW / 2 + 0.6, 1.08, -inD / 2 + 0.8);
  openBook.rotation.x = -0.2;
  g.add(openBook);
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
