import * as THREE from 'three';

/**
 * Keeps only the handful of point lights nearest the player switched on.
 *
 * Every visible light costs work in EVERY material's fragment shader, so the
 * village's ~20 decorative lamps and fire glows are paid for on every pixel,
 * even the ones on the far side of the map. Lights the player can't be near
 * contribute nothing visible but cost the same as the ones he can.
 *
 * Important: the number of enabled lights is kept CONSTANT. Three.js bakes the
 * light count into the shader, so a changing count triggers a program
 * recompile — which is exactly the stutter this class exists to prevent. We
 * always leave `budget` lights on, just swapping which ones as the player
 * moves; distance falloff makes the far ones free in practice.
 */
export class LightBudget {
  private scene: THREE.Scene;
  private managed: THREE.PointLight[] = [];
  private scored: { light: THREE.PointLight; d2: number }[] = [];
  private rescanTimer = 0;
  private tmpWorld = new THREE.Vector3();

  budget: number;

  constructor(scene: THREE.Scene, budget = 4) {
    this.scene = scene;
    this.budget = budget;
    this.rescan();
  }

  /**
   * Collect the point lights we are allowed to toggle. Anything flagged
   * `userData.alwaysOn` (the night lantern, the pendant glow, the lab lamps)
   * is left alone.
   */
  rescan(): void {
    this.managed = [];
    this.scene.traverse((o) => {
      if ((o as THREE.PointLight).isPointLight && !o.userData.alwaysOn) {
        this.managed.push(o as THREE.PointLight);
      }
    });
    this.scored = this.managed.map((light) => ({ light, d2: 0 }));
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    // Buildings and story props come and go — refresh the list occasionally
    this.rescanTimer -= dt;
    if (this.rescanTimer <= 0) {
      this.rescanTimer = 2;
      this.rescan();
    }
    if (this.managed.length <= this.budget) {
      for (const l of this.managed) l.visible = true;
      return;
    }

    for (const entry of this.scored) {
      entry.light.getWorldPosition(this.tmpWorld);
      entry.d2 = this.tmpWorld.distanceToSquared(playerPos);
    }
    this.scored.sort((a, b) => a.d2 - b.d2);

    for (let i = 0; i < this.scored.length; i++) {
      this.scored[i].light.visible = i < this.budget;
    }
  }

  /** Turn every managed light back on (e.g. when tearing the system down). */
  restoreAll(): void {
    for (const l of this.managed) l.visible = true;
  }
}
