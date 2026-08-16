import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from '../entities/Player';
import { NPC } from '../entities/NPC';
import { Village } from '../world/Village';
import { InteriorManager } from '../world/InteriorManager';
import { DialogBox } from '../ui/DialogBox';
import { InputManager } from '../core/InputManager';
import { EventBus } from '../core/EventBus';

const HOUSE_NAME = 'Maryin dům';
const WALK_SPEED = 3.2;       // units/s
const SPRINT_MULTIPLIER = 3;  // while holding Space
const ARRIVE_DIST = 0.6;

type Phase = 'idle' | 'walking' | 'entering' | 'talking';

/**
 * Mary walks the player home and gives him the dragon pendant.
 *
 * The player's controls are locked for the whole scene — the script drives
 * both bodies along a few road waypoints, then hands off to InteriorManager
 * for the actual door transition. Holding Space fast-forwards the walk.
 */
export class MaryCutscene {
  private player: Player;
  private mary: NPC;
  private village: Village;
  private interiorManager: InteriorManager;
  private dialogBox: DialogBox;

  private phase: Phase = 'idle';
  private waypoints: THREE.Vector3[] = [];
  private wpIndex = 0;
  private hintEl: HTMLElement;
  private savedBodyType: CANNON.BodyType | null = null;

  /** Fired once the pendant has been handed over. */
  onPendantGiven: (() => void) | null = null;

  get active(): boolean {
    return this.phase !== 'idle';
  }

  constructor(
    player: Player,
    mary: NPC,
    village: Village,
    interiorManager: InteriorManager,
    dialogBox: DialogBox
  ) {
    this.player = player;
    this.mary = mary;
    this.village = village;
    this.interiorManager = interiorManager;
    this.dialogBox = dialogBox;

    this.hintEl = document.createElement('div');
    this.hintEl.style.cssText = `
      position: fixed;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.6);
      color: #DEB887;
      padding: 6px 16px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 25;
      display: none;
      pointer-events: none;
    `;
    this.hintEl.textContent = 'Mezerník = zrychlit';
    document.body.appendChild(this.hintEl);
  }

  /** Kick off the walk from wherever the player is standing. */
  start(): void {
    if (this.active) return;

    const house = this.village.buildings.find((b) => b.def.name === HOUSE_NAME);
    if (!house) {
      console.warn(`MaryCutscene: building "${HOUSE_NAME}" not found`);
      return;
    }

    const px = this.player.body.position.x;
    const pz = this.player.body.position.z;
    const door = house.doorPosition;

    // Step onto the main road (x = 0), walk south to the z = 24 row, then to
    // the door. Keeps both of them off the buildings without real pathfinding.
    this.waypoints = [
      new THREE.Vector3(0, 0, pz),
      new THREE.Vector3(0, 0, door.z),
      new THREE.Vector3(door.x, 0, door.z),
    ];
    // Skip the first hop if he is already standing on the road
    if (Math.abs(px) < 3) this.waypoints.shift();
    this.wpIndex = 0;

    this.phase = 'walking';
    this.player.controlLocked = true;
    this.savedBodyType = this.player.body.type;
    this.player.body.type = CANNON.Body.KINEMATIC;
    this.player.body.velocity.set(0, 0, 0);
    this.player.body.position.y = 0.7;

    // Freeze Mary's own AI — the script owns her from here on
    this.mary.startTalk();
    this.mary.mesh.position.set(px + 1.2, 0, pz);

    this.hintEl.style.display = 'block';
    EventBus.emit('notify', { text: 'Mary: Pojď, doprovodím tě.' });
  }

  update(dt: number): void {
    if (this.phase !== 'walking') return;

    const fast = InputManager.isKeyDown('Space');
    const step = WALK_SPEED * (fast ? SPRINT_MULTIPLIER : 1) * dt;

    const target = this.waypoints[this.wpIndex];
    const px = this.player.body.position.x;
    const pz = this.player.body.position.z;
    const dx = target.x - px;
    const dz = target.z - pz;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < ARRIVE_DIST) {
      this.wpIndex++;
      if (this.wpIndex >= this.waypoints.length) {
        void this.enterHouse();
      }
      return;
    }

    const nx = px + (dx / dist) * Math.min(step, dist);
    const nz = pz + (dz / dist) * Math.min(step, dist);
    this.player.body.position.set(nx, 0.7, nz);
    this.player.mesh.rotation.y = Math.atan2(dx, dz);

    // Mary walks alongside, one step to the right of the direction of travel
    const sideX = dz / dist;
    const sideZ = -dx / dist;
    this.mary.mesh.position.set(nx + sideX * 1.2, 0, nz + sideZ * 1.2);
    this.mary.mesh.rotation.y = Math.atan2(dx, dz);
  }

  private async enterHouse(): Promise<void> {
    this.phase = 'entering';
    this.hintEl.style.display = 'none';

    const house = this.village.buildings.find((b) => b.def.name === HOUSE_NAME)!;
    await this.interiorManager.forceEnter(house);

    // Put Mary next to the player inside the room, facing him
    const p = this.player.body.position;
    this.mary.mesh.position.set(p.x + 1.4, 0, p.z + 0.6);
    this.mary.mesh.rotation.y = Math.atan2(-1.4, -0.6);

    this.phase = 'talking';
    this.showFirstLine();
  }

  private showFirstLine(): void {
    this.dialogBox.show(
      this.mary,
      'Posaď se. Tohle jsem nemohla říct venku na ulici.\n\n' +
        'Ta tráva, co ji Wazovský pěstuje pod kostelem — ta tam nerostla vždycky. ' +
        'Můj otec se do té díry dostal dávno přede mnou a už se nikdy nevrátil stejný.',
      [{ label: 'Pokračovat', action: () => this.showSecondLine() }]
    );
  }

  private showSecondLine(): void {
    this.dialogBox.show(
      this.mary,
      'Než zmizel, nechal mi tohle. Dračí přívěsek.\n\n' +
        'Říkal, že až se setmí doopravdy, budu vědět, komu ho dát. ' +
        'Vezmi si ho. A dneska v noci nechoď daleko od světla.',
      [{ label: 'Vzít si přívěsek', action: () => this.finish() }]
    );
  }

  private finish(): void {
    this.dialogBox.close();
    this.player.showPendant();

    this.phase = 'idle';
    this.player.controlLocked = false;
    if (this.savedBodyType !== null) {
      this.player.body.type = this.savedBodyType;
      this.savedBodyType = null;
    }
    this.mary.endTalk();

    EventBus.emit('notify', { text: '🐉 Dostal jsi dračí přívěsek!' });
    this.onPendantGiven?.();
  }
}
