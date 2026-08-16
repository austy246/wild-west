import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from '../entities/Player';
import { EventBus } from '../core/EventBus';
import { InputManager } from '../core/InputManager';
import { CameraSystem } from '../systems/CameraSystem';
import { playFall, playMatchStrike } from '../core/Audio';

/** Where the player pops back out (behind the church). */
export const BEHIND_CHURCH = new THREE.Vector3(10, 0, -30);

const PLANT_COUNT = 5;
const PICKUP_DIST = 1.6;
const LADDER_DIST = 2.2;

interface LabPlant {
  mesh: THREE.Group;
  collected: boolean;
}

/**
 * A hidden underground drug lab ("varna"). The player falls in behind the
 * church, gathers magic plants, then climbs a ladder back to the surface.
 * Built far from the village so the surface world stays out of view.
 */
export class UndergroundLab {
  private scene: THREE.Scene;
  private player: Player;
  private physicsWorld: CANNON.World;
  private cameraSystem: CameraSystem;
  private fadeOverlay: HTMLElement;
  private promptEl: HTMLElement;

  private readonly origin = new THREE.Vector3(300, 0, 300);
  private group: THREE.Group | null = null;
  private colliders: CANNON.Body[] = [];
  private plants: LabPlant[] = [];
  private plantsCollected = 0;
  private ladderPos = new THREE.Vector3();

  private labLights: THREE.Light[] = [];
  private followLight: THREE.PointLight | null = null;
  private savedLights: { light: THREE.Light; intensity: number }[] = [];
  private savedBackground: THREE.Color | THREE.Texture | null = null;
  private savedFog: THREE.Fog | THREE.FogExp2 | null = null;

  private active = false;
  private isTransitioning = false;
  private eKeyWasDown = false;

  constructor(scene: THREE.Scene, player: Player, physicsWorld: CANNON.World, cameraSystem: CameraSystem) {
    this.scene = scene;
    this.player = player;
    this.physicsWorld = physicsWorld;
    this.cameraSystem = cameraSystem;
    this.fadeOverlay = document.getElementById('fade-overlay')!;

    this.promptEl = document.createElement('div');
    this.promptEl.id = 'lab-prompt';
    this.promptEl.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      color: #b6ff8a;
      padding: 8px 20px;
      border: 2px solid #4a7a3a;
      border-radius: 6px;
      font-size: 16px;
      font-weight: bold;
      z-index: 20;
      display: none;
      pointer-events: none;
    `;
    document.body.appendChild(this.promptEl);
  }

  get isActive(): boolean {
    return this.active;
  }

  get busy(): boolean {
    return this.active || this.isTransitioning;
  }

  /** Trigger the fall-in sequence: darkness → match strike → dim reveal. */
  async enter(): Promise<void> {
    if (this.busy) return;
    this.isTransitioning = true;

    // Reaching the spot completes the "go behind the church" objective
    EventBus.emit('location:reached', { location: 'behind-church' });

    this.fadeOverlay.classList.add('active');
    playFall();
    await this.wait(2000); // 2 seconds of total darkness

    playMatchStrike();
    this.buildLab();
    this.active = true;

    await this.wait(400);
    this.fadeOverlay.classList.remove('active'); // reveal the dim lab
    this.isTransitioning = false;
  }

  update(dt: number): void {
    if (!this.active || this.isTransitioning) {
      this.promptEl.style.display = 'none';
      return;
    }

    const px = this.player.mesh.position.x;
    const pz = this.player.mesh.position.z;

    // Warm light follows the player — this is what defines the visible bubble
    if (this.followLight) {
      this.followLight.position.set(px, 2.2, pz);
    }

    // Plant pickup
    for (const p of this.plants) {
      if (p.collected) continue;
      p.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.003 + p.mesh.position.x) * 0.12;
      p.mesh.rotation.y += dt * 1.5;
      const dx = p.mesh.position.x - px;
      const dz = p.mesh.position.z - pz;
      if (Math.sqrt(dx * dx + dz * dz) < PICKUP_DIST) {
        p.collected = true;
        p.mesh.visible = false;
        this.plantsCollected++;
        EventBus.emit('item:collected', { itemType: 'magic-plant', id: 'magic-plant' });
        EventBus.emit('notify', { text: `🌿 Kouzelná rostlinka (${this.plantsCollected}/${PLANT_COUNT})` });
      }
    }

    // Ladder to climb back up
    const ldx = this.ladderPos.x - px;
    const ldz = this.ladderPos.z - pz;
    const nearLadder = Math.sqrt(ldx * ldx + ldz * ldz) < LADDER_DIST;
    const eDown = InputManager.isKeyDown('KeyE');

    if (nearLadder) {
      this.promptEl.textContent = 'Stiskni E pro výlez nahoru';
      this.promptEl.style.display = 'block';
      if (eDown && !this.eKeyWasDown) {
        void this.exit();
      }
    } else {
      this.promptEl.style.display = 'none';
    }
    this.eKeyWasDown = eDown;
  }

  private async exit(): Promise<void> {
    if (!this.active || this.isTransitioning) return;
    this.isTransitioning = true;
    this.promptEl.style.display = 'none';

    this.fadeOverlay.classList.add('active');
    await this.wait(400);

    this.teardownLab();
    this.active = false;

    // Pop out behind the church (nudged toward town so we don't re-trigger)
    this.player.body.position.set(BEHIND_CHURCH.x, 1.5, BEHIND_CHURCH.z + 3);
    this.player.body.velocity.set(0, 0, 0);
    this.player.mesh.position.set(
      this.player.body.position.x,
      this.player.body.position.y - 0.7,
      this.player.body.position.z
    );
    this.cameraSystem.snap();

    await this.wait(300);
    this.fadeOverlay.classList.remove('active');
    this.isTransitioning = false;
    EventBus.emit('notify', { text: 'Vylezl jsi ven za kostelem.' });
  }

  // ---------------- Scene construction ----------------

  private buildLab(): void {
    // Dim the surface lights, go dark
    this.savedLights = [];
    for (const child of this.scene.children) {
      if (child instanceof THREE.Light) {
        this.savedLights.push({ light: child, intensity: child.intensity });
        child.intensity *= 0.05;
      }
    }
    this.savedBackground = this.scene.background as THREE.Color | THREE.Texture | null;
    this.savedFog = this.scene.fog;
    this.scene.background = new THREE.Color(0x050403);
    // No fog: fog is measured from the CAMERA (which sits ~29 units away at an
    // angle), so it renders as a diagonal band instead of a ring around you.
    // The visible bubble comes from the follow light's falloff instead — that
    // one really is centred on the player.
    this.scene.fog = null;

    const g = new THREE.Group();
    g.position.copy(this.origin);
    const half = 12; // room half-size (24 x 24)

    // Floor
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x6a5a45, roughness: 1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, half * 2), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.02;
    floor.receiveShadow = true;
    g.add(floor);

    // Walls. Kept LOW visually (the isometric camera looks over them) but the
    // colliders are tall so the player still can't walk out. No ceiling — it
    // would sit between the overhead camera and the player.
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x7a6650, roughness: 1 });
    const wallVisualH = 1.0;
    const wallColliderH = 6;
    const wallDefs: [number, number, number, number][] = [
      // [x, z, sizeX, sizeZ]
      [0, -half, half * 2, 0.5],
      [0, half, half * 2, 0.5],
      [-half, 0, 0.5, half * 2],
      [half, 0, 0.5, half * 2],
    ];
    for (const [wx, wz, sx, sz] of wallDefs) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, wallVisualH, sz), wallMat);
      wall.position.set(wx, wallVisualH / 2, wz);
      g.add(wall);
      // Matching collider (world coords), full height so you can't escape
      const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
      body.addShape(new CANNON.Box(new CANNON.Vec3(sx / 2, wallColliderH / 2, sz / 2)));
      body.position.set(this.origin.x + wx, wallColliderH / 2, this.origin.z + wz);
      this.physicsWorld.addBody(body);
      this.colliders.push(body);
    }

    // The "varna" (cook lab) toward the far wall
    const varna = this.createVarna();
    varna.position.set(0, 0, -half + 3.5);
    g.add(varna);

    // Magic plants scattered around
    this.plants = [];
    this.plantsCollected = 0;
    // Kept well away from the spawn point (0, +6) so none is auto-collected
    const plantSpots: [number, number][] = [
      [-6, 3], [6, 3], [-7, -4], [7, -4], [0, -1],
    ];
    for (let i = 0; i < PLANT_COUNT; i++) {
      const [lx, lz] = plantSpots[i % plantSpots.length];
      const plant = this.createMagicPlant();
      plant.position.set(this.origin.x + lx, 0.5, this.origin.z + lz);
      this.scene.add(plant); // added to scene (world coords) for simple pickup checks
      this.plants.push({ mesh: plant, collected: false });
    }

    // Ladder near the entry wall (+z)
    const ladder = this.createLadder();
    ladder.position.set(0, 0, half - 0.6);
    g.add(ladder);
    this.ladderPos.set(this.origin.x + 0, 0, this.origin.z + half - 0.6);

    // Near-black room + a bright lamp that follows the player. The light's
    // `distance` is what sets how far you can see — everything past it is black.
    const labAmbient = new THREE.AmbientLight(0xffe6c0, 0.1);
    this.scene.add(labAmbient);
    this.labLights.push(labAmbient);

    this.followLight = new THREE.PointLight(0xffd9a0, 60, 11, 1.1);
    this.followLight.position.set(this.origin.x, 2.2, this.origin.z + 6); // at the spawn spot
    this.followLight.userData.alwaysOn = true; // the lab is pitch black without it
    this.scene.add(this.followLight);
    this.labLights.push(this.followLight);

    const cauldronGlow = new THREE.PointLight(0x9CFF40, 18, 10, 1.2);
    cauldronGlow.position.set(this.origin.x, 1.3, this.origin.z - half + 3.5);
    cauldronGlow.userData.alwaysOn = true;
    this.scene.add(cauldronGlow);
    this.labLights.push(cauldronGlow);

    this.scene.add(g);
    this.group = g;

    // Teleport the player into the lab (near the ladder, facing the varna)
    this.player.isIndoors = false;
    this.player.body.position.set(this.origin.x, 1.5, this.origin.z + 6);
    this.player.body.velocity.set(0, 0, 0);
    this.player.mesh.position.set(this.origin.x, 0.8, this.origin.z + 6);
    this.player.mesh.rotation.y = Math.PI; // look toward the varna (-z)
    this.cameraSystem.snap(); // don't let the camera fly across the map
  }

  private teardownLab(): void {
    // Restore surface lighting & sky
    for (const s of this.savedLights) s.light.intensity = s.intensity;
    this.savedLights = [];
    if (this.savedBackground) this.scene.background = this.savedBackground;
    this.scene.fog = this.savedFog;

    // Remove lab lights
    for (const l of this.labLights) this.scene.remove(l);
    this.labLights = [];
    this.followLight = null;

    // Remove plants
    for (const p of this.plants) this.scene.remove(p.mesh);
    this.plants = [];

    // Remove colliders
    for (const b of this.colliders) this.physicsWorld.removeBody(b);
    this.colliders = [];

    // Remove room group
    if (this.group) {
      this.scene.remove(this.group);
      this.group = null;
    }
  }

  private createVarna(): THREE.Group {
    const v = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x555049, metalness: 0.6, roughness: 0.5 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x7CFC00, emissive: 0x4CAF50, emissiveIntensity: 0.6,
      transparent: true, opacity: 0.7, roughness: 0.2,
    });
    const glassMat2 = new THREE.MeshStandardMaterial({
      color: 0xff77cc, emissive: 0xff33aa, emissiveIntensity: 0.5,
      transparent: true, opacity: 0.7, roughness: 0.2,
    });
    const emberMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5500, emissiveIntensity: 1 });

    // Big cauldron
    const cauldron = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 1.0, 14), metal);
    cauldron.position.set(0, 0.5, 0);
    cauldron.castShadow = true;
    v.add(cauldron);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 8, 16), metal);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 1.0, 0);
    v.add(rim);
    // Glowing brew surface
    const brew = new THREE.Mesh(new THREE.CircleGeometry(0.82, 16), glassMat);
    brew.rotation.x = -Math.PI / 2;
    brew.position.set(0, 1.0, 0);
    v.add(brew);
    // Embers under the cauldron
    for (let i = 0; i < 5; i++) {
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 5), emberMat);
      const a = (i / 5) * Math.PI * 2;
      ember.position.set(Math.cos(a) * 0.35, 0.05, Math.sin(a) * 0.35);
      v.add(ember);
    }

    // Two work tables with flasks
    for (const side of [-1, 1]) {
      const table = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.15, 0.8), wood);
      table.position.set(side * 2.6, 0.9, 0.3);
      table.castShadow = true;
      v.add(table);
      for (let l = 0; l < 4; l++) legAt(v, wood, side * 2.6 - 0.85 + l * 0.57, side * 2.6);
      // Flasks on the table
      for (let f = 0; f < 3; f++) {
        const mat = (f + (side > 0 ? 1 : 0)) % 2 === 0 ? glassMat : glassMat2;
        const flask = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 8), mat);
        flask.position.set(side * 2.6 - 0.6 + f * 0.6, 1.15, 0.3);
        v.add(flask);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 6), metal);
        neck.position.set(side * 2.6 - 0.6 + f * 0.6, 1.38, 0.3);
        v.add(neck);
      }
    }

    // A couple of barrels
    for (const bx of [-3.6, 3.6]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.8, 10), wood);
      barrel.position.set(bx, 0.4, -1.2);
      v.add(barrel);
    }

    return v;

    function legAt(parent: THREE.Group, mat: THREE.Material, x: number, _base: number): void {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), mat);
      leg.position.set(x, 0.45, 0.3);
      parent.add(leg);
    }
  }

  private createMagicPlant(): THREE.Group {
    const g = new THREE.Group();
    // fog:false → the plants glow through the darkness as green beacons
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, fog: false });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x55ff55, emissive: 0x3bff44, emissiveIntensity: 1.0, fog: false,
    });
    const budMat = new THREE.MeshStandardMaterial({
      color: 0xbfff3a, emissive: 0x9dff22, emissiveIntensity: 1.0, fog: false,
    });

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.26, 8),
      new THREE.MeshStandardMaterial({ color: 0x5d4037, fog: false }));
    pot.position.y = -0.38;
    g.add(pot);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.6, 5), stemMat);
    stem.position.y = 0.0;
    g.add(stem);

    // Big serrated cannabis-style leaves
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.55, 4), leafMat);
      const a = (i / 7) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.18, 0.1 + (i % 2) * 0.16, Math.sin(a) * 0.18);
      leaf.rotation.z = Math.PI;
      leaf.rotation.x = 0.5;
      leaf.rotation.y = a;
      g.add(leaf);
    }
    // Glowing green bud on top
    const bud = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), budMat);
    bud.position.y = 0.38;
    g.add(bud);

    // Green glow so it clearly reads as collectible
    const light = new THREE.PointLight(0x66ff44, 9, 6, 1.2);
    light.position.y = 0.3;
    g.add(light);

    return g;
  }

  private createLadder(): THREE.Group {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
    const railGeo = new THREE.BoxGeometry(0.1, 6, 0.1);
    for (const side of [-0.4, 0.4]) {
      const rail = new THREE.Mesh(railGeo, woodMat);
      rail.position.set(side, 3, 0);
      g.add(rail);
    }
    for (let r = 0; r < 10; r++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), woodMat);
      rung.position.set(0, 0.4 + r * 0.55, 0);
      g.add(rung);
    }
    // Glowing exit hint at the top
    const light = new THREE.PointLight(0xffe08a, 0.7, 6);
    light.position.set(0, 5.5, 0);
    g.add(light);
    return g;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
