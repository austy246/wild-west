import * as THREE from 'three';

/**
 * The ride out of the burned town: a compass pinned to the right of the screen
 * pointing the way, and the cabin waiting at the end of it.
 *
 * The compass needle points at the cabin rather than at true north, because
 * what the player actually needs to know is "which way do I go", and the
 * camera angle makes a fixed north arrow useless.
 */

/**
 * North is -Z. Roughly fifteen seconds of hard riding out of town — far
 * enough that the village is long out of sight before the cabin appears.
 */
export const CABIN_POS = new THREE.Vector3(4, 0, -1150);

/** How close counts as arriving */
const ARRIVE_DIST = 6;

export class NorthRide {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private cabin: THREE.Group | null = null;

  private el: HTMLElement;
  private needleEl: HTMLElement;
  private distEl: HTMLElement;

  private running = false;
  private arrived = false;

  onArrive: (() => void) | null = null;

  get isRunning(): boolean {
    return this.running;
  }

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;

    this.el = document.createElement('div');
    this.el.id = 'compass';
    this.el.style.cssText = `
      position: fixed;
      right: 18px;
      top: 50%;
      transform: translateY(-50%);
      width: 96px;
      z-index: 16;
      display: none;
      text-align: center;
      pointer-events: none;
      font-family: 'Segoe UI', Arial, sans-serif;
    `;
    this.el.innerHTML = `
      <div style="
        width: 88px; height: 88px; margin: 0 auto;
        border-radius: 50%;
        background: rgba(20, 13, 6, 0.78);
        border: 3px solid #8B6508;
        box-shadow: 0 4px 14px rgba(0,0,0,0.6);
        position: relative;
      ">
        <span style="position:absolute;top:3px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:bold;color:#DEB887;">S</span>
        <span style="position:absolute;bottom:3px;left:50%;transform:translateX(-50%);font-size:11px;color:#8a7150;">J</span>
        <span style="position:absolute;left:5px;top:50%;transform:translateY(-50%);font-size:11px;color:#8a7150;">Z</span>
        <span style="position:absolute;right:5px;top:50%;transform:translateY(-50%);font-size:11px;color:#8a7150;">V</span>
        <div id="compass-needle" style="
          position:absolute; left:50%; top:50%;
          width:0; height:0; transform-origin: 50% 50%;
        ">
          <div style="
            position:absolute; left:-5px; top:-30px;
            width:0; height:0;
            border-left:5px solid transparent;
            border-right:5px solid transparent;
            border-bottom:30px solid #d64545;
          "></div>
          <div style="
            position:absolute; left:-4px; top:0px;
            width:0; height:0;
            border-left:4px solid transparent;
            border-right:4px solid transparent;
            border-top:26px solid #cfc3a6;
          "></div>
        </div>
      </div>
      <div id="compass-dist" style="
        margin-top: 5px; font-size: 13px; font-weight: bold;
        color: #DEB887; text-shadow: 0 1px 3px rgba(0,0,0,0.9);
      "></div>
    `;
    document.body.appendChild(this.el);
    this.needleEl = this.el.querySelector('#compass-needle') as HTMLElement;
    this.distEl = this.el.querySelector('#compass-dist') as HTMLElement;
  }

  /** Put the cabin out there and switch the compass on. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.arrived = false;

    if (!this.cabin) {
      this.cabin = buildCabin();
      this.cabin.position.copy(CABIN_POS);
      this.scene.add(this.cabin);
    }
    this.el.style.display = 'block';
  }

  update(playerPos: THREE.Vector3): void {
    if (!this.running || this.arrived) return;

    const dx = CABIN_POS.x - playerPos.x;
    const dz = CABIN_POS.z - playerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Point the needle the way it looks on screen, not the way it is in world
    // space — the camera is at a fixed angle, so those aren't the same thing
    const target = new THREE.Vector3(CABIN_POS.x, playerPos.y, CABIN_POS.z).project(this.camera);
    const self = playerPos.clone().project(this.camera);
    const angle = Math.atan2(target.x - self.x, target.y - self.y);
    this.needleEl.style.transform = `rotate(${angle}rad)`;

    this.distEl.textContent = `${Math.round(dist)} m`;

    if (dist < ARRIVE_DIST) {
      this.arrived = true;
      this.running = false;
      this.el.style.display = 'none';
      this.onArrive?.();
    }
  }
}

/**
 * The cabin at the end of the road: someone holed up here with a mountain of
 * gold junk and a crate of red caps. Left open at the top so the overhead
 * camera can see in.
 */
function buildCabin(): THREE.Group {
  const group = new THREE.Group();

  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5433, roughness: 0.9 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xffc94d, metalness: 0.85, roughness: 0.2,
    emissive: 0x3d2c00, emissiveIntensity: 0.5,
  });
  const red = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.75 });

  const W = 7, D = 6, H = 1.6;

  // Floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.2, D), darkWood);
  floor.position.y = 0.1;
  floor.receiveShadow = true;
  group.add(floor);

  // Three walls kept low so you can see inside, plus a gap for the door
  const wallDefs: [number, number, number, number][] = [
    [0, -D / 2, W, 0.25],
    [-W / 2, 0, 0.25, D],
    [W / 2, 0, 0.25, D],
  ];
  for (const [wx, wz, sx, sz] of wallDefs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, H, sz), wood);
    wall.position.set(wx, H / 2, wz);
    wall.castShadow = true;
    group.add(wall);
  }
  // Front wall in two pieces with a doorway between them
  for (const side of [-1, 1]) {
    const piece = new THREE.Mesh(new THREE.BoxGeometry(W / 2 - 0.8, H, 0.25), wood);
    piece.position.set(side * (W / 4 + 0.4), H / 2, D / 2);
    group.add(piece);
  }

  // Gold: piles of coins and a few bars
  for (let i = 0; i < 14; i++) {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 10), gold);
    coin.position.set(
      (Math.random() - 0.5) * (W - 1.6),
      0.22 + Math.random() * 0.35,
      (Math.random() - 0.5) * (D - 1.6)
    );
    coin.rotation.set(Math.random(), Math.random(), Math.random());
    group.add(coin);
  }
  for (let i = 0; i < 5; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.26), gold);
    bar.position.set(-W / 2 + 1 + i * 0.3, 0.29 + i * 0.19, -D / 2 + 1);
    bar.rotation.y = Math.random() * 0.4;
    bar.castShadow = true;
    group.add(bar);
  }

  // A crate spilling red caps
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.1), darkWood);
  crate.position.set(W / 2 - 1.3, 0.55, -D / 2 + 1.2);
  crate.castShadow = true;
  group.add(crate);

  for (let i = 0; i < 11; i++) {
    const cap = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), red);
    cap.add(dome);
    const peak = new THREE.Mesh(new THREE.CircleGeometry(0.22, 10, 0, Math.PI), red);
    peak.rotation.x = -Math.PI / 2;
    peak.position.z = 0.16;
    cap.add(peak);

    cap.position.set(
      W / 2 - 2.4 + Math.random() * 2,
      i < 4 ? 1.05 + Math.random() * 0.2 : 0.22,
      -D / 2 + 0.5 + Math.random() * 2.4
    );
    cap.rotation.y = Math.random() * Math.PI * 2;
    cap.rotation.z = (Math.random() - 0.5) * 0.5;
    group.add(cap);
  }

  // A crooked sign over the door
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.08), darkWood);
  sign.position.set(0, H + 0.5, D / 2);
  sign.rotation.z = -0.06;
  group.add(sign);

  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#2a1c10';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 58px Georgia';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SAMÉ BLBINY', 256, 68);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 0.55),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })
  );
  label.position.set(0, H + 0.5, D / 2 + 0.06);
  label.rotation.z = -0.06;
  group.add(label);

  // Warm glow so the gold reads from a distance
  const glow = new THREE.PointLight(0xffca6a, 16, 16, 1.4);
  glow.position.set(0, 1.6, 0);
  glow.userData.alwaysOn = true;
  group.add(glow);

  return group;
}
