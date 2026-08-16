import * as THREE from 'three';
import { NPC } from '../entities/NPC';
import { Village } from './Village';

/**
 * Sends the town to bed once night falls.
 *
 * Everyone walks to their own front door, steps inside and is hidden from the
 * street. They aren't deleted — each sleeper is parked inside his building, so
 * if the player follows one in he's standing right there and can still be
 * talked to. He just won't be pleased about it.
 */

/** Who sleeps where. An NPC missing from this map stays outside all night. */
const HOMES: Record<string, string> = {
  sheriff: 'Šerifův úřad',
  bartender: 'Saloon',
  blacksmith: 'Kovárna',
  townsfolk1: 'Hotel',      // Farmář Bill
  townsfolk2: 'Maryin dům', // Mary
  townsfolk3: 'Hotel',      // Starý Tom
  // 'wazovsky' is deliberately absent — he sleeps on his haystack
};

/** Grumbles when you wake someone in the middle of the night */
const SLEEPY_LINES = [
  'Mhm... nech mě spát.',
  'Běž pryč, je noc!',
  'Co tady děláš? Spím.',
  'Zítra. Všechno zítra.',
  'Kdo to leze do baráku po tmě...',
  'Nech mě být, prosím tě.',
];

interface Sleeper {
  npc: NPC;
  buildingName: string;
  /** Where he stands once he's indoors (world coords, inside the room) */
  indoorSpot: THREE.Vector3;
}

/** Main road runs along x = 0; side paths at these z values */
const SIDE_PATH_Z = [-24, -12, 0, 12, 24];

/** Nearest point on the road network to a given spot */
function roadPointNear(x: number, z: number): THREE.Vector3 {
  // Closest side path by z, clamped to its length
  let bestZ = SIDE_PATH_Z[0];
  for (const sz of SIDE_PATH_Z) {
    if (Math.abs(sz - z) < Math.abs(bestZ - z)) bestZ = sz;
  }
  // Approach along the side path at the door's x, or the main road if closer
  return Math.abs(x) < 4
    ? new THREE.Vector3(0, 0, z)
    : new THREE.Vector3(Math.max(-18, Math.min(18, x)), 0, bestZ);
}

export class Bedtime {
  private village: Village;
  private sleepers: Sleeper[] = [];
  private started = false;

  get isBedtime(): boolean {
    return this.started;
  }

  constructor(village: Village) {
    this.village = village;
  }

  /** Night has fallen — everyone heads home. */
  start(npcs: NPC[]): void {
    if (this.started) return;
    this.started = true;

    for (const npc of npcs) {
      const buildingName = HOMES[npc.def.id];
      if (!buildingName) continue;

      const building = this.village.buildings.find((b) => b.def.name === buildingName);
      if (!building) continue;

      const door = building.doorPosition;
      const sleeper: Sleeper = {
        npc,
        buildingName,
        // Interiors are shown at the building's own position, so a spot near
        // its centre puts him in the middle of the room
        indoorSpot: new THREE.Vector3(building.def.x, 0, building.def.z),
      };
      this.sleepers.push(sleeper);

      npc.sendHome(
        [roadPointNear(door.x, door.z), new THREE.Vector3(door.x, 0, door.z)],
        () => this.goInside(sleeper)
      );
    }
  }

  /**
   * Same as `start`, but everyone is already indoors — used when loading a
   * save made after nightfall, where the walk home happened long ago.
   */
  startInstantly(npcs: NPC[]): void {
    this.start(npcs);
    for (const s of this.sleepers) this.goInside(s);
  }

  /** He reached his door — off the street, into the room. */
  private goInside(sleeper: Sleeper): void {
    sleeper.npc.fallAsleep();
    sleeper.npc.mesh.visible = false;
    // Spread housemates out a little so they don't stand in each other
    const housemates = this.sleepers.filter((s) => s.buildingName === sleeper.buildingName);
    const index = housemates.indexOf(sleeper);
    sleeper.npc.mesh.position.set(
      sleeper.indoorSpot.x + index * 1.6 - 0.8,
      0,
      sleeper.indoorSpot.z + 1.6
    );
  }

  /** Show whoever lives here; called when the player steps into a building. */
  onEnterBuilding(buildingName: string): void {
    for (const s of this.sleepers) {
      if (s.npc.isAsleep && s.buildingName === buildingName) {
        s.npc.mesh.visible = true;
      }
    }
  }

  /** Hide the sleepers again once the player is back outside. */
  onExitBuilding(): void {
    for (const s of this.sleepers) {
      if (s.npc.isAsleep) s.npc.mesh.visible = false;
    }
  }

  /**
   * Morning — everyone spills back out of their front door and carries on as
   * usual. Called when the wagon comes through shouting.
   */
  wakeEveryone(): void {
    for (const s of this.sleepers) {
      const building = this.village.buildings.find((b) => b.def.name === s.buildingName);
      const door = building?.doorPosition;
      if (door) {
        // Step out onto the street, spread a little so they don't overlap
        const spread = (Math.random() - 0.5) * 1.5;
        s.npc.mesh.position.set(door.x + spread, 0, door.z + spread);
      }
      s.npc.mesh.visible = true;
      s.npc.wakeUp();
    }
    this.sleepers = [];
    this.started = false;
  }

  /** A random half-asleep grumble, stable per NPC so he doesn't flip-flop. */
  sleepyLine(npc: NPC): string {
    let hash = 0;
    for (let i = 0; i < npc.def.id.length; i++) hash += npc.def.id.charCodeAt(i);
    return SLEEPY_LINES[hash % SLEEPY_LINES.length];
  }
}
