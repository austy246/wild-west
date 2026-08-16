import * as THREE from 'three';
import { LightBudget } from './LightBudget';

/**
 * Watches the frame rate and turns things down until the game runs smoothly.
 *
 * Rather than guessing a machine's speed from its user agent, we just measure:
 * if frames keep taking too long, drop to the next tier. Each step down is
 * permanent for the session — stepping back up would make the game oscillate
 * between tiers, which reads as stutter even when the average is fine.
 */

export type QualityTier = 0 | 1 | 2 | 3;

/** Below this many FPS the game feels like it is stuttering */
const TARGET_FPS = 45;
/** How long it has to stay bad before we react (seconds) */
const SAMPLE_WINDOW = 2.5;

export class QualityManager {
  private renderer: THREE.WebGLRenderer;
  private sun: THREE.DirectionalLight;
  private lightBudget: LightBudget;

  private frames = 0;
  private elapsed = 0;
  private gracePeriod = 3; // ignore the first seconds — startup is always slow

  tier: QualityTier = 0;
  onTierChange: ((tier: QualityTier, reason: string) => void) | null = null;

  constructor(
    renderer: THREE.WebGLRenderer,
    sun: THREE.DirectionalLight,
    lightBudget: LightBudget
  ) {
    this.renderer = renderer;
    this.sun = sun;
    this.lightBudget = lightBudget;

    // Start one tier down on machines that are obviously modest, so weak
    // hardware doesn't have to suffer through the measuring window first.
    const cores = navigator.hardwareConcurrency ?? 4;
    if (cores <= 4) this.applyTier(1);
  }

  update(dt: number): void {
    if (this.gracePeriod > 0) {
      this.gracePeriod -= dt;
      return;
    }

    this.frames++;
    this.elapsed += dt;
    if (this.elapsed < SAMPLE_WINDOW) return;

    const fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;

    if (fps < TARGET_FPS && this.tier < 3) {
      this.applyTier((this.tier + 1) as QualityTier);
      this.onTierChange?.(this.tier, `${Math.round(fps)} FPS`);
    }
  }

  /** Drop to a given tier. Tiers are cumulative — each one is cheaper. */
  applyTier(tier: QualityTier): void {
    this.tier = tier;

    switch (tier) {
      case 0: // full
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.setShadowMapSize(1024);
        this.lightBudget.budget = 4;
        break;

      case 1: // native resolution, softer shadows
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = true;
        this.setShadowMapSize(512);
        this.lightBudget.budget = 3;
        break;

      case 2: // no shadows at all
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
        this.lightBudget.budget = 2;
        break;

      case 3: // render below native resolution and upscale
        this.renderer.setPixelRatio(0.75);
        this.renderer.shadowMap.enabled = false;
        this.lightBudget.budget = 1;
        break;
    }
  }

  private setShadowMapSize(size: number): void {
    if (this.sun.shadow.mapSize.width === size) return;
    this.sun.shadow.mapSize.set(size, size);
    // Force three.js to rebuild the shadow map at the new size
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
  }
}
