import * as THREE from 'three';
import { NPC } from '../entities/NPC';
import { InputManager } from '../core/InputManager';
import { DialogBox } from '../ui/DialogBox';

const INTERACT_DISTANCE = 3;

export class InteractionSystem {
  private npcs: NPC[];
  private playerMesh: THREE.Object3D;
  private dialogBox: DialogBox;
  private promptEl: HTMLElement;

  /** Callback invoked when player right-clicks on an NPC */
  onInteract: ((npc: NPC) => void) | null = null;

  constructor(npcs: NPC[], playerMesh: THREE.Object3D, dialogBox: DialogBox) {
    this.npcs = npcs;
    this.playerMesh = playerMesh;
    this.dialogBox = dialogBox;

    // Floating prompt
    this.promptEl = document.createElement('div');
    this.promptEl.id = 'interact-prompt';
    this.promptEl.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      color: #DEB887;
      padding: 6px 16px;
      border: 2px solid #8B4513;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      z-index: 15;
      display: none;
      pointer-events: none;
    `;
    document.body.appendChild(this.promptEl);
  }

  update(): void {
    if (this.dialogBox.isOpen) {
      this.promptEl.style.display = 'none';
      return;
    }

    const playerPos = this.playerMesh.position;
    let nearest: NPC | null = null;
    let nearestDist = INTERACT_DISTANCE;

    for (const npc of this.npcs) {
      const dx = npc.mesh.position.x - playerPos.x;
      const dz = npc.mesh.position.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = npc;
      }
    }

    if (nearest) {
      this.promptEl.textContent = `Pravý klik → ${nearest.def.name}`;
      this.promptEl.style.display = 'block';

      if (InputManager.rightClick) {
        // Face the NPC toward the player
        const dx = playerPos.x - nearest.mesh.position.x;
        const dz = playerPos.z - nearest.mesh.position.z;
        nearest.mesh.rotation.y = Math.atan2(dx, dz);

        if (this.onInteract) {
          this.onInteract(nearest);
        } else {
          this.dialogBox.showSimple(nearest, nearest.def.dialog);
        }
      }
    } else {
      this.promptEl.style.display = 'none';
    }
  }
}
