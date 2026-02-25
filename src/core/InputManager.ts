import * as THREE from 'three';

class InputManagerClass {
  readonly keys = new Set<string>();
  readonly mousePosition = new THREE.Vector2();
  leftClick = false;
  rightClick = false;

  /** Touch-specific state */
  readonly isTouchDevice = 'ontouchstart' in globalThis;
  /** Joystick move direction (x, z), length 0..1. Zero when idle. */
  readonly moveDirection = new THREE.Vector2(); // x, y maps to world x, z
  /** Whether sprint is active (joystick pushed far or sprint button held) */
  sprinting = false;
  /** Aim direction on mobile (mirrors moveDirection by default) */
  readonly aimDirection = new THREE.Vector2();

  private _leftClickThisFrame = false;
  private _rightClickThisFrame = false;

  init(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    canvas.addEventListener('mousemove', (e) => {
      this.mousePosition.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mousePosition.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this._leftClickThisFrame = true;
      if (e.button === 2) this._rightClickThisFrame = true;
    });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Prevent default touch behaviors on canvas (zoom, scroll)
    if (this.isTouchDevice) {
      canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
      canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    }
  }

  /** Call at the start of each frame to capture click state */
  poll(): void {
    this.leftClick = this._leftClickThisFrame;
    this.rightClick = this._rightClickThisFrame;
    this._leftClickThisFrame = false;
    this._rightClickThisFrame = false;
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  // --- Touch control helpers ---

  setMoveDirection(x: number, z: number): void {
    this.moveDirection.set(x, z);
    // Mirror as aim direction so attacks follow movement
    if (x !== 0 || z !== 0) {
      this.aimDirection.set(x, z).normalize();
    }
  }

  triggerLeftClick(): void {
    this._leftClickThisFrame = true;
  }

  triggerRightClick(): void {
    this._rightClickThisFrame = true;
  }

  simulateKeyDown(code: string): void {
    this.keys.add(code);
  }

  simulateKeyUp(code: string): void {
    this.keys.delete(code);
  }
}

export const InputManager = new InputManagerClass();
