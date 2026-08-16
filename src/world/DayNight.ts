import * as THREE from 'three';

/**
 * Day/night switch for the surface world.
 *
 * Night is not just a colour change — it also pulls the fog in close, which is
 * what actually limits how far you can see. The visible bubble around the
 * player comes from a lantern-style point light that follows him, the same
 * trick the underground lab uses (see UndergroundLab.buildLab).
 *
 * Interiors and the lab save/restore `scene.fog` and `scene.background`
 * themselves, so they pick up whatever state is current — switch to night
 * while OUTSIDE and everything stays consistent.
 */

const NIGHT_SKY = 0x0b1024;

/** How far you can see at night: fully clear up to NEAR, pitch black past FAR. */
const NIGHT_FOG_NEAR = 8;
const NIGHT_FOG_FAR = 34;

export class DayNight {
  private scene: THREE.Scene;
  private followLight: THREE.PointLight | null = null;
  private dayLights: { light: THREE.Light; intensity: number; color: number }[] = [];
  private dayBackground: THREE.Color | THREE.Texture | null = null;
  private dayFog: THREE.Fog | THREE.FogExp2 | null = null;

  private night = false;

  get isNight(): boolean {
    return this.night;
  }

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Switch the world to night. Safe to call twice. */
  setNight(): void {
    if (this.night) return;
    this.night = true;

    // Dim every surface light and cool it down to moonlight
    this.dayLights = [];
    for (const child of this.scene.children) {
      if (!(child instanceof THREE.Light)) continue;
      this.dayLights.push({
        light: child,
        intensity: child.intensity,
        color: child.color.getHex(),
      });
      if (child instanceof THREE.AmbientLight) {
        child.intensity = 0.12;
        child.color.setHex(0x9fb4ff);
      } else if (child instanceof THREE.DirectionalLight) {
        child.intensity = 0.18; // moon
        child.color.setHex(0x8fa8e8);
      } else if (child instanceof THREE.HemisphereLight) {
        child.intensity = 0.12;
      } else {
        child.intensity *= 0.3;
      }
    }

    // Dark sky + close fog = the limited render distance
    this.dayBackground = this.scene.background as THREE.Color | THREE.Texture | null;
    this.dayFog = this.scene.fog;
    this.scene.background = new THREE.Color(NIGHT_SKY);
    this.scene.fog = new THREE.Fog(NIGHT_SKY, NIGHT_FOG_NEAR, NIGHT_FOG_FAR);

    // Lantern bubble that travels with the player
    this.followLight = new THREE.PointLight(0xffe3ac, 90, 22, 1.0);
    this.followLight.position.set(0, 2.6, 0);
    this.scene.add(this.followLight);
  }

  /** Back to daylight (used when a save without night is loaded). */
  setDay(): void {
    if (!this.night) return;
    this.night = false;

    for (const saved of this.dayLights) {
      saved.light.intensity = saved.intensity;
      saved.light.color.setHex(saved.color);
    }
    this.dayLights = [];

    this.scene.background = this.dayBackground;
    this.scene.fog = this.dayFog;
    this.dayBackground = null;
    this.dayFog = null;

    if (this.followLight) {
      this.scene.remove(this.followLight);
      this.followLight.dispose();
      this.followLight = null;
    }
  }

  /** Keep the lantern centred on the player. */
  update(playerPos: THREE.Vector3): void {
    if (!this.followLight) return;
    this.followLight.position.set(playerPos.x, playerPos.y + 1.8, playerPos.z);
  }
}
