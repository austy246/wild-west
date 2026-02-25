import * as THREE from 'three';

class InputManagerClass {
  readonly keys = new Set<string>();
  readonly mousePosition = new THREE.Vector2();
  leftClick = false;
  rightClick = false;

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
}

export const InputManager = new InputManagerClass();
