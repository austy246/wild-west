import * as THREE from 'three';
import { Player } from '../entities/Player';
import { Village } from './../world/Village';
import { EventBus } from '../core/EventBus';

/**
 * The morning after: a wagon tears through town shouting a warning and
 * throwing leaflets out the back.
 *
 * The player can't do anything while it passes — the whole point is that the
 * town is being told something it can't stop. Once the wagon is gone the
 * leaflets are left lying in the road for the player to pick one up.
 */

/** Where the wagon enters and leaves, along the main road (x = 0) */
const START_Z = -52;
const END_Z = 52;
const SPEED = 13;

/** Shouted lines, fired as the wagon reaches these z positions */
const SHOUTS: { at: number; text: string }[] = [
  { at: -30, text: 'BLÍŽÍ SE VLKODLAK!' },
  { at: -12, text: 'ZACHRAŇ SE KDO MŮŽE!' },
  { at: 6, text: 'UTÍKEJTE Z MĚSTA!' },
  { at: 24, text: 'DNESKA V NOCI TU BUDE!' },
];

/** Leaflets are thrown out between these z values, near the town centre */
const DROP_FROM = -22;
const DROP_TO = 26;
const DROP_COUNT = 7;

export class WagonCutscene {
  private scene: THREE.Scene;
  private player: Player;
  private village: Village;

  private wagon: THREE.Group | null = null;
  private z = START_Z;
  private shoutIndex = 0;
  private dropped = 0;
  private running = false;

  /** Leaflets left lying in the road, for the pickup step */
  readonly papers: THREE.Group[] = [];

  private shoutEl: HTMLElement;

  onFinished: (() => void) | null = null;

  get active(): boolean {
    return this.running;
  }

  constructor(scene: THREE.Scene, player: Player, village: Village) {
    this.scene = scene;
    this.player = player;
    this.village = village;

    this.shoutEl = document.createElement('div');
    this.shoutEl.style.cssText = `
      position: fixed;
      top: 18%;
      left: 50%;
      transform: translateX(-50%);
      color: #ffdf7e;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: clamp(22px, 4vw, 44px);
      font-weight: bold;
      letter-spacing: 1px;
      text-shadow: 0 3px 10px rgba(0,0,0,0.9);
      z-index: 40;
      display: none;
      pointer-events: none;
      white-space: nowrap;
    `;
    document.body.appendChild(this.shoutEl);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.z = START_Z;
    this.shoutIndex = 0;
    this.dropped = 0;

    this.player.controlLocked = true;
    this.player.body.velocity.set(0, 0, 0);

    this.wagon = this.buildWagon();
    this.wagon.position.set(0, 0, START_Z);
    this.scene.add(this.wagon);
  }

  update(dt: number): void {
    if (!this.running || !this.wagon) return;

    this.z += SPEED * dt;
    this.wagon.position.z = this.z;

    // Wheels and horses bob as it rolls
    const bob = Math.abs(Math.sin(this.z * 2)) * 0.04;
    this.wagon.position.y = bob;

    // Shouts
    while (this.shoutIndex < SHOUTS.length && this.z >= SHOUTS[this.shoutIndex].at) {
      this.shout(SHOUTS[this.shoutIndex].text);
      this.shoutIndex++;
    }

    // Leaflets thrown out the back
    if (this.z > DROP_FROM && this.z < DROP_TO) {
      const wanted = Math.floor(((this.z - DROP_FROM) / (DROP_TO - DROP_FROM)) * DROP_COUNT) + 1;
      while (this.dropped < wanted && this.dropped < DROP_COUNT) {
        this.dropPaper(this.z - 1.5);
        this.dropped++;
      }
    }

    if (this.z >= END_Z) this.finish();
  }

  private shout(text: string): void {
    this.shoutEl.textContent = `„${text}"`;
    this.shoutEl.style.display = 'block';
    window.setTimeout(() => {
      if (this.shoutEl.textContent === `„${text}"`) this.shoutEl.style.display = 'none';
    }, 2200);
  }

  /** Drop a leaflet beside the road where the wagon currently is */
  private dropPaper(z: number): void {
    const paper = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf2ead6,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.66), mat);
    sheet.rotation.x = -Math.PI / 2;
    sheet.rotation.z = Math.random() * Math.PI;
    paper.add(sheet);

    // A hint of print so it reads as a flyer, not a white square
    const inkMat = new THREE.MeshStandardMaterial({ color: 0x3a3128 });
    for (let i = 0; i < 3; i++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.035), inkMat);
      line.rotation.x = -Math.PI / 2;
      line.rotation.z = sheet.rotation.z;
      line.position.set(
        Math.sin(sheet.rotation.z) * (i * 0.1 - 0.1),
        0.012,
        Math.cos(sheet.rotation.z) * (i * 0.1 - 0.1)
      );
      paper.add(line);
    }

    paper.position.set((Math.random() - 0.5) * 4, 0.03, z + (Math.random() - 0.5) * 2);
    paper.userData.alwaysOn = true;
    this.scene.add(paper);
    this.papers.push(paper);
  }

  private finish(): void {
    this.running = false;
    this.shoutEl.style.display = 'none';

    if (this.wagon) {
      this.scene.remove(this.wagon);
      this.wagon = null;
    }

    this.player.controlLocked = false;
    this.onFinished?.();
    EventBus.emit('notify', { text: 'Zvedni jeden z těch letáků.' });
  }

  /** Remove the leaflets once the player has read one */
  clearPapers(): void {
    for (const p of this.papers) this.scene.remove(p);
    this.papers.length = 0;
  }

  // ---------------- Mesh ----------------

  private buildWagon(): THREE.Group {
    const group = new THREE.Group();

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.85 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
    const canvasMat = new THREE.MeshStandardMaterial({ color: 0xd8cfb4, roughness: 1 });

    // Cart bed
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 3), woodMat);
    bed.position.y = 0.75;
    bed.castShadow = true;
    group.add(bed);

    // Side boards
    for (const side of [-1, 1]) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 3), woodMat);
      board.position.set(side * 0.9, 1.0, 0);
      group.add(board);
    }

    // Canvas hood — the classic covered wagon silhouette
    const hood = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 2.6, 12, 1, true, 0, Math.PI),
      canvasMat
    );
    hood.rotation.z = Math.PI / 2;
    hood.rotation.y = Math.PI / 2;
    hood.position.y = 1.15;
    hood.castShadow = true;
    group.add(hood);

    // Wheels
    for (const side of [-1, 1]) {
      for (const front of [-1, 1]) {
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.08, 6, 14), darkMat);
        wheel.position.set(side * 0.95, 0.45, front * 1.05);
        wheel.rotation.y = Math.PI / 2;
        wheel.castShadow = true;
        group.add(wheel);
      }
    }

    // Draw bar + two horses out front (reusing the village horse model)
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.6), woodMat);
    bar.position.set(0, 0.6, -2.1);
    group.add(bar);

    for (const side of [-1, 1]) {
      const horse = this.village.createRideableHorse(side < 0 ? 0x4a2f1a : 0x2c1608);
      horse.position.set(side * 0.55, 0, -3.2);
      // The horse model faces +X (the corral code converts with -PI/2), and the
      // wagon travels toward +Z — so it's -PI/2, not +PI/2, or they run backwards
      horse.rotation.y = -Math.PI / 2;
      horse.userData.dynamic = true;
      group.add(horse);
    }

    return group;
  }
}
