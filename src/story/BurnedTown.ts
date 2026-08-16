import * as THREE from 'three';
import { Village } from '../world/Village';

/**
 * What's left of the town after the forty hours in the cellar.
 *
 * Every building is charred over with one shared material — the batcher
 * already collapsed the town into a handful of meshes, so swapping the
 * material on those is both the cheapest and the most complete way to burn
 * the place down. Fires are then scattered through the streets: emissive
 * cones that flicker, with only a few actual lights among them, since lights
 * are the expensive part and the LightBudget will thin them out anyway.
 */

interface Fire {
  flames: THREE.Mesh[];
  light: THREE.PointLight | null;
  phase: number;
}

/** Where fires burn, in world coordinates */
const FIRE_SPOTS: [number, number][] = [
  [10, 24], [-10, 24], [10, 12], [-12, 12],
  [10, -12], [-7, -12], [-10, -24], [10, -24],
  [3, 18], [-4, 2], [6, -4], [-14, 20],
];

/** Only this many fires get a real light; the rest just glow */
const LIT_FIRES = 4;

export class BurnedTown {
  private scene: THREE.Scene;
  private village: Village;
  private fires: Fire[] = [];
  private burned = false;

  get isBurned(): boolean {
    return this.burned;
  }

  constructor(scene: THREE.Scene, village: Village) {
    this.scene = scene;
    this.village = village;
  }

  /** Char the town and set it alight. Permanent. */
  burn(): void {
    if (this.burned) return;
    this.burned = true;

    const charred = new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 1 });
    const charredRoof = new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 1 });

    for (const building of this.village.buildings) {
      building.exteriorGroup.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        // Roofs sit high up — darken those a shade further so the silhouette
        // still reads against the sky
        mesh.material = mesh.position.y > 2 ? charredRoof : charred;
      });
    }

    for (let i = 0; i < FIRE_SPOTS.length; i++) {
      const [x, z] = FIRE_SPOTS[i];
      this.addFire(x, z, i < LIT_FIRES);
    }
  }

  private addFire(x: number, z: number, lit: boolean): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const flames: THREE.Mesh[] = [];
    const colors = [0xff6a00, 0xffa726, 0xffd54f];

    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: colors[i],
        emissive: colors[i],
        emissiveIntensity: 1.4,
        roughness: 1,
      });
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32 - i * 0.08, 1.1 - i * 0.25, 6), mat);
      flame.position.set(
        (Math.random() - 0.5) * 0.7,
        (1.1 - i * 0.25) / 2,
        (Math.random() - 0.5) * 0.7
      );
      group.add(flame);
      flames.push(flame);
    }

    // Charred ground under it
    const scorch = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 12),
      new THREE.MeshStandardMaterial({ color: 0x140f0c, roughness: 1 })
    );
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.y = 0.03;
    group.add(scorch);

    let light: THREE.PointLight | null = null;
    if (lit) {
      light = new THREE.PointLight(0xff7a1a, 22, 14, 1.4);
      light.position.y = 1.2;
      group.add(light);
    }

    this.scene.add(group);
    this.fires.push({ flames, light, phase: Math.random() * Math.PI * 2 });
  }

  /** Flicker. Cheap: it's just scale and intensity, no new objects per frame. */
  update(dt: number): void {
    if (!this.burned) return;

    for (const fire of this.fires) {
      fire.phase += dt * (4 + Math.random());
      const flicker = 0.82 + Math.sin(fire.phase) * 0.12 + Math.random() * 0.08;

      for (let i = 0; i < fire.flames.length; i++) {
        const flame = fire.flames[i];
        flame.scale.y = flicker + i * 0.05;
        flame.rotation.y += dt * (0.8 + i * 0.4);
      }
      if (fire.light) fire.light.intensity = 18 + flicker * 8;
    }
  }
}
