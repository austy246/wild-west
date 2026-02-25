import { InputManager } from '../core/InputManager';

const SPRINT_THRESHOLD = 0.75; // joystick distance to trigger sprint

export class TouchControls {
  private container!: HTMLElement;
  private joystickBase!: HTMLElement;
  private joystickThumb!: HTMLElement;
  private joystickTouchId: number | null = null;
  private joystickOrigin = { x: 0, y: 0 };
  private joystickRadius = 50;

  constructor() {
    // Don't create anything on non-touch devices
    if (!InputManager.isTouchDevice) {
      this.container = document.createElement('div');
      return;
    }

    this.container = document.createElement('div');
    this.container.id = 'touch-controls';
    this.container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 25;
    `;
    document.body.appendChild(this.container);

    // --- Joystick (left side) ---
    this.joystickBase = this.createDiv(`
      position: absolute; bottom: 40px; left: 30px;
      width: 120px; height: 120px; border-radius: 50%;
      background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3);
      pointer-events: auto; touch-action: none;
    `);
    this.joystickThumb = this.createDiv(`
      position: absolute; top: 50%; left: 50%;
      width: 50px; height: 50px; border-radius: 50%;
      background: rgba(255,255,255,0.5);
      transform: translate(-50%, -50%);
      pointer-events: none;
    `);
    this.joystickBase.appendChild(this.joystickThumb);
    this.container.appendChild(this.joystickBase);

    this.joystickRadius = 50; // max thumb offset in px

    this.joystickBase.addEventListener('touchstart', (e) => this.onJoystickStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.onJoystickMove(e), { passive: false });
    window.addEventListener('touchend', (e) => this.onJoystickEnd(e));
    window.addEventListener('touchcancel', (e) => this.onJoystickEnd(e));

    // --- Action buttons (right side) ---
    this.createActionButton('attack-btn', '60px', '30px', '70px', '#c0392b', 'Attack', () => {
      InputManager.triggerLeftClick();
    });
    this.createActionButton('interact-btn', '140px', '30px', '54px', '#2980b9', 'Talk', () => {
      InputManager.triggerRightClick();
    });
    this.createActionButton('enter-btn', '60px', '110px', '54px', '#27ae60', 'E', () => {
      InputManager.simulateKeyDown('KeyE');
      setTimeout(() => InputManager.simulateKeyUp('KeyE'), 150);
    });
    this.createActionButton('reload-btn', '140px', '110px', '46px', '#8e44ad', 'R', () => {
      InputManager.simulateKeyDown('KeyR');
      setTimeout(() => InputManager.simulateKeyUp('KeyR'), 150);
    });

    // --- Weapon selector (bottom center) ---
    this.createWeaponBar();
  }

  private createDiv(css: string): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = css;
    return el;
  }

  private createActionButton(
    id: string,
    bottom: string,
    right: string,
    size: string,
    color: string,
    label: string,
    onPress: () => void
  ): void {
    const btn = this.createDiv(`
      position: absolute; bottom: ${bottom}; right: ${right};
      width: ${size}; height: ${size}; border-radius: 50%;
      background: ${color}; opacity: 0.7;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 13px; font-weight: bold;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.6);
      pointer-events: auto; touch-action: none;
      border: 2px solid rgba(255,255,255,0.3);
      user-select: none; -webkit-user-select: none;
    `);
    btn.id = id;
    btn.textContent = label;
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      btn.style.opacity = '1';
      btn.style.transform = 'scale(0.9)';
      onPress();
    }, { passive: false });
    btn.addEventListener('touchend', () => {
      btn.style.opacity = '0.7';
      btn.style.transform = 'scale(1)';
    });
    this.container.appendChild(btn);
  }

  private createWeaponBar(): void {
    const bar = this.createDiv(`
      position: absolute; bottom: 8px; left: 50%;
      transform: translateX(-50%);
      display: flex; gap: 6px;
      pointer-events: auto; touch-action: none;
    `);
    const weapons = [
      { key: 'Digit1', label: '1', name: 'Fists' },
      { key: 'Digit2', label: '2', name: 'Lasso' },
      { key: 'Digit3', label: '3', name: 'Rev' },
      { key: 'Digit4', label: '4', name: 'Rifle' },
    ];
    for (const w of weapons) {
      const slot = this.createDiv(`
        width: 44px; height: 44px; border-radius: 6px;
        background: rgba(0,0,0,0.6); border: 2px solid #8B4513;
        display: flex; align-items: center; justify-content: center;
        flex-direction: column;
        color: #DEB887; font-size: 10px; font-weight: bold;
        user-select: none; -webkit-user-select: none;
      `);
      slot.innerHTML = `<span style="font-size:14px">${w.label}</span><span style="font-size:8px">${w.name}</span>`;
      slot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        InputManager.simulateKeyDown(w.key);
        setTimeout(() => InputManager.simulateKeyUp(w.key), 100);
      }, { passive: false });
      bar.appendChild(slot);
    }
    this.container.appendChild(bar);
  }

  // --- Joystick touch handling ---

  private onJoystickStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.changedTouches[0];
    this.joystickTouchId = touch.identifier;
    const rect = this.joystickBase.getBoundingClientRect();
    this.joystickOrigin.x = rect.left + rect.width / 2;
    this.joystickOrigin.y = rect.top + rect.height / 2;
    this.updateJoystick(touch.clientX, touch.clientY);
  }

  private onJoystickMove(e: TouchEvent): void {
    if (this.joystickTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.joystickTouchId) {
        e.preventDefault();
        this.updateJoystick(t.clientX, t.clientY);
        return;
      }
    }
  }

  private onJoystickEnd(e: TouchEvent): void {
    if (this.joystickTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.joystickTouchId) {
        this.joystickTouchId = null;
        this.joystickThumb.style.transform = 'translate(-50%, -50%)';
        InputManager.setMoveDirection(0, 0);
        InputManager.sprinting = false;
        return;
      }
    }
  }

  private updateJoystick(touchX: number, touchY: number): void {
    let dx = touchX - this.joystickOrigin.x;
    let dy = touchY - this.joystickOrigin.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = this.joystickRadius;

    // Clamp to circle
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }

    // Move thumb visual
    this.joystickThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    // Normalize to -1..1
    const nx = dx / maxDist;
    const ny = dy / maxDist; // screen Y → world Z

    InputManager.setMoveDirection(nx, ny);

    // Sprint when pushed far
    const normalizedDist = dist / maxDist;
    InputManager.sprinting = normalizedDist > SPRINT_THRESHOLD;
  }
}
