import * as THREE from 'three';

const ROAD_WIDTH = 5;
const SIDE_PATH_WIDTH = 2.5;

export function createRoads(scene: THREE.Scene): void {
  // Main road (north-south) from z=-35 to z=35
  addDirtRoad(scene, 0, -35, 0, 35, ROAD_WIDTH);

  // Side paths (east-west) at various z positions
  const sidePathZ = [-24, -12, 0, 12, 24];
  for (const z of sidePathZ) {
    addDirtRoad(scene, -18, z, -ROAD_WIDTH / 2, z, SIDE_PATH_WIDTH);
    addDirtRoad(scene, ROAD_WIDTH / 2, z, 18, z, SIDE_PATH_WIDTH);
  }
}

function addDirtRoad(
  scene: THREE.Scene,
  x1: number, z1: number,
  x2: number, z2: number,
  width: number
): void {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;

  // --- Base dirt surface ---
  const dirtCanvas = createDirtTexture();
  const dirtTexture = new THREE.CanvasTexture(dirtCanvas);
  dirtTexture.wrapS = THREE.RepeatWrapping;
  dirtTexture.wrapT = THREE.RepeatWrapping;

  const dirtMat = new THREE.MeshStandardMaterial({
    map: dirtTexture,
    roughness: 0.95,
    metalness: 0,
  });
  const dirtGeo = new THREE.PlaneGeometry(width, length);
  const dirt = new THREE.Mesh(dirtGeo, dirtMat);
  dirt.rotation.x = -Math.PI / 2;
  dirt.rotation.z = -angle;
  dirt.position.set(cx, 0.015, cz);
  dirt.receiveShadow = true;
  scene.add(dirt);

  // --- Small pebbles scattered on the road ---
  const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.95 });
  const pebbleCount = Math.floor(length * 0.8);
  for (let i = 0; i < pebbleCount; i++) {
    const t = Math.random();
    const lateralOffset = (Math.random() - 0.5) * width * 0.85;
    const alongX = x1 + dx * t;
    const alongZ = z1 + dz * t;
    const perpX = -Math.sin(angle) * lateralOffset;
    const perpZ = Math.cos(angle) * lateralOffset;
    const size = 0.03 + Math.random() * 0.06;
    const pebble = new THREE.Mesh(new THREE.SphereGeometry(size, 4, 3), pebbleMat);
    pebble.scale.y = 0.35;
    pebble.position.set(alongX + perpX, 0.02, alongZ + perpZ);
    scene.add(pebble);
  }
}

/** Generate a procedural dirt texture with color variation */
function createDirtTexture(): HTMLCanvasElement {
  const res = 256;
  const canvas = document.createElement('canvas');
  canvas.width = res;
  canvas.height = res;
  const ctx = canvas.getContext('2d')!;

  // Base sandy-brown dirt color
  ctx.fillStyle = '#a08050';
  ctx.fillRect(0, 0, res, res);

  // Noise patches for variation
  for (let i = 0; i < 800; i++) {
    const px = Math.random() * res;
    const py = Math.random() * res;
    const r = 2 + Math.random() * 6;
    const brightness = Math.floor(Math.random() * 40 - 20);
    const base = [0xa0, 0x80, 0x50];
    const c = base.map(v => Math.max(0, Math.min(255, v + brightness)));
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Darker edges
  const edgeFade = res * 0.12;
  const grad1 = ctx.createLinearGradient(0, 0, edgeFade, 0);
  grad1.addColorStop(0, 'rgba(80,60,30,0.35)');
  grad1.addColorStop(1, 'rgba(80,60,30,0)');
  ctx.fillStyle = grad1;
  ctx.fillRect(0, 0, edgeFade, res);

  const grad2 = ctx.createLinearGradient(res, 0, res - edgeFade, 0);
  grad2.addColorStop(0, 'rgba(80,60,30,0.35)');
  grad2.addColorStop(1, 'rgba(80,60,30,0)');
  ctx.fillStyle = grad2;
  ctx.fillRect(res - edgeFade, 0, edgeFade, res);

  return canvas;
}
