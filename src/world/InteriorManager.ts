import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Building } from './BuildingFactory';
import { Village } from './Village';
import { EventBus } from '../core/EventBus';
import { InputManager } from '../core/InputManager';
import {
  CAMERA_OFFSET_X,
  CAMERA_OFFSET_Y,
  CAMERA_OFFSET_Z,
} from '../utils/constants';

const DOOR_INTERACT_DIST = 2.5;
const INTERIOR_Y = -50; // interiors are stored below the world

export class InteriorManager {
  private village: Village;
  private playerBody: CANNON.Body;
  private playerMesh: THREE.Object3D;
  private scene: THREE.Scene;

  private currentBuilding: Building | null = null;
  private fadeOverlay: HTMLElement;
  private promptEl: HTMLElement;
  private isTransitioning = false;

  /** Camera offsets for interior view (closer, more top-down) */
  readonly interiorCameraOffset = new THREE.Vector3(-6, 10, 6);

  get isInside(): boolean {
    return this.currentBuilding !== null;
  }

  constructor(
    village: Village,
    playerBody: CANNON.Body,
    playerMesh: THREE.Object3D,
    scene: THREE.Scene
  ) {
    this.village = village;
    this.playerBody = playerBody;
    this.playerMesh = playerMesh;
    this.scene = scene;

    this.fadeOverlay = document.getElementById('fade-overlay')!;

    // Create "Press E" prompt
    this.promptEl = document.createElement('div');
    this.promptEl.id = 'door-prompt';
    this.promptEl.textContent = 'Stiskni E pro vstup';
    this.promptEl.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      color: #DEB887;
      padding: 8px 20px;
      border: 2px solid #8B4513;
      border-radius: 6px;
      font-size: 16px;
      font-weight: bold;
      z-index: 20;
      display: none;
      pointer-events: none;
    `;
    document.body.appendChild(this.promptEl);
  }

  update(): void {
    if (this.isTransitioning) return;

    const playerPos = new THREE.Vector3(
      this.playerBody.position.x,
      this.playerBody.position.y,
      this.playerBody.position.z
    );

    if (this.currentBuilding) {
      // Inside a building — check for exit (E key near door area = center-front of interior)
      // The exit zone is at positive Z inside the interior
      const interiorExitZ = this.currentBuilding.interiorGroup.position.z + this.currentBuilding.def.depth / 2 - 0.5;
      const exitPos = new THREE.Vector3(
        this.currentBuilding.interiorGroup.position.x,
        INTERIOR_Y + 1,
        interiorExitZ
      );
      const dist = playerPos.distanceTo(exitPos);

      if (dist < DOOR_INTERACT_DIST + 1) {
        this.promptEl.textContent = 'Stiskni E pro odchod';
        this.promptEl.style.display = 'block';
        if (InputManager.isKeyDown('KeyE')) {
          this.exitBuilding();
        }
      } else {
        this.promptEl.style.display = 'none';
      }
    } else {
      // Outside — check proximity to any door
      const nearBuilding = this.village.findNearestDoor(playerPos, DOOR_INTERACT_DIST);
      if (nearBuilding) {
        this.promptEl.textContent = `Stiskni E → ${nearBuilding.def.name}`;
        this.promptEl.style.display = 'block';
        if (InputManager.isKeyDown('KeyE')) {
          this.enterBuilding(nearBuilding);
        }
      } else {
        this.promptEl.style.display = 'none';
      }
    }
  }

  private async enterBuilding(building: Building): Promise<void> {
    this.isTransitioning = true;
    this.promptEl.style.display = 'none';

    // Fade to black
    this.fadeOverlay.classList.add('active');
    await this.wait(350);

    // Hide all exteriors
    for (const b of this.village.buildings) {
      b.exteriorGroup.visible = false;
    }

    // Show this building's interior at its stored position
    building.interiorGroup.visible = true;
    building.interiorGroup.position.y = INTERIOR_Y;

    // Teleport player to interior center
    this.playerBody.position.set(
      building.interiorGroup.position.x,
      INTERIOR_Y + 1.5,
      building.interiorGroup.position.z + building.def.depth / 4
    );
    this.playerBody.velocity.set(0, 0, 0);

    this.currentBuilding = building;
    EventBus.emit('player:enter-building', { name: building.def.name });

    // Fade from black
    this.fadeOverlay.classList.remove('active');
    await this.wait(350);

    this.isTransitioning = false;
  }

  private async exitBuilding(): Promise<void> {
    if (!this.currentBuilding) return;
    this.isTransitioning = true;
    this.promptEl.style.display = 'none';

    const building = this.currentBuilding;

    // Fade to black
    this.fadeOverlay.classList.add('active');
    await this.wait(350);

    // Hide interior
    building.interiorGroup.visible = false;

    // Show all exteriors
    for (const b of this.village.buildings) {
      b.exteriorGroup.visible = true;
    }

    // Teleport player to door position outside
    this.playerBody.position.set(
      building.doorPosition.x,
      1.5,
      building.doorPosition.z
    );
    this.playerBody.velocity.set(0, 0, 0);

    this.currentBuilding = null;
    EventBus.emit('player:exit-building', { name: building.def.name });

    // Fade from black
    this.fadeOverlay.classList.remove('active');
    await this.wait(350);

    this.isTransitioning = false;
  }

  /** Get current camera offset based on inside/outside state */
  getCameraOffset(): THREE.Vector3 {
    if (this.currentBuilding) {
      return this.interiorCameraOffset;
    }
    return new THREE.Vector3(CAMERA_OFFSET_X, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
