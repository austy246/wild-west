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
import { CameraSystem } from '../systems/CameraSystem';

const DOOR_INTERACT_DIST = 2.5;
const INTERIOR_Y = -50; // interiors stored underground when not in use

export class InteriorManager {
  private village: Village;
  private playerBody: CANNON.Body;
  private playerMesh: THREE.Object3D;
  private scene: THREE.Scene;
  private physicsWorld: CANNON.World;
  private cameraSystem: CameraSystem;
  private terrain: THREE.Mesh;

  private currentBuilding: Building | null = null;
  private fadeOverlay: HTMLElement;
  private promptEl: HTMLElement;
  private isTransitioning = false;

  // Temporary objects created when entering a building
  private wallBody: CANNON.Body | null = null;
  private frontWallMesh: THREE.Mesh | null = null;
  private savedBackground: THREE.Color | THREE.Texture | null = null;
  private savedFog: THREE.Fog | THREE.FogExp2 | null = null;

  private savedFov = 45;

  get isInside(): boolean {
    return this.currentBuilding !== null;
  }

  constructor(
    village: Village,
    playerBody: CANNON.Body,
    playerMesh: THREE.Object3D,
    scene: THREE.Scene,
    physicsWorld: CANNON.World,
    cameraSystem: CameraSystem,
    terrain: THREE.Mesh
  ) {
    this.village = village;
    this.playerBody = playerBody;
    this.playerMesh = playerMesh;
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.cameraSystem = cameraSystem;
    this.terrain = terrain;

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

    // Disable frustum culling on all interior groups
    for (const b of this.village.buildings) {
      b.interiorGroup.traverse((child) => {
        child.frustumCulled = false;
      });
    }
  }

  update(): void {
    if (this.isTransitioning) return;

    const playerPos = new THREE.Vector3(
      this.playerBody.position.x,
      this.playerBody.position.y,
      this.playerBody.position.z
    );

    if (this.currentBuilding) {
      // Inside — check for exit near the door area
      const def = this.currentBuilding.def;
      const exitLocal = new THREE.Vector3(0, 0, def.depth / 2 - 0.5);
      exitLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), def.rotY);
      const exitPos = new THREE.Vector3(def.x + exitLocal.x, 1, def.z + exitLocal.z);

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

    const def = building.def;

    // --- Hide the outside world ---
    this.terrain.visible = false;
    this.savedFog = this.scene.fog;
    this.scene.fog = null;
    this.savedBackground = this.scene.background as THREE.Color | THREE.Texture | null;
    this.scene.background = new THREE.Color(0x1a1410); // dark brown/black

    for (const b of this.village.buildings) {
      b.exteriorGroup.visible = false;
    }

    // Remove building physics collider
    this.physicsWorld.removeBody(building.collider);

    // --- Show interior at ground level, 2x scaled, with rotation ---
    const S = 2; // interior scale multiplier
    const ig = building.interiorGroup;
    ig.visible = true;
    ig.position.set(def.x, 0, def.z);
    ig.rotation.y = def.rotY;
    ig.scale.set(S, 1, S); // 2x wider & deeper, same height

    // Hide ceiling so camera sees inside from above
    ig.traverse((child) => {
      if (child.name === 'ceiling') child.visible = false;
    });

    ig.updateMatrixWorld(true);

    // --- Add a front wall to close off the room (in scaled local space) ---
    const inW = def.width - 0.4;
    const inD = def.depth - 0.4;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xb0a090,
      side: THREE.DoubleSide,
      roughness: 0.85,
    });
    this.frontWallMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(inW, def.height),
      wallMat
    );
    this.frontWallMesh.position.set(0, def.height / 2, inD / 2);
    ig.add(this.frontWallMesh);

    // --- Add physics walls (4 sides, using SCALED dimensions) ---
    const halfW = (def.width * S) / 2;
    const halfH = def.height / 2;
    const halfD = (def.depth * S) / 2;
    const t = 0.15;

    this.wallBody = new CANNON.Body({ type: CANNON.Body.STATIC });
    this.wallBody.addShape(
      new CANNON.Box(new CANNON.Vec3(halfW, halfH, t)),
      new CANNON.Vec3(0, halfH, -halfD)
    );
    this.wallBody.addShape(
      new CANNON.Box(new CANNON.Vec3(halfW, halfH, t)),
      new CANNON.Vec3(0, halfH, halfD)
    );
    this.wallBody.addShape(
      new CANNON.Box(new CANNON.Vec3(t, halfH, halfD)),
      new CANNON.Vec3(-halfW, halfH, 0)
    );
    this.wallBody.addShape(
      new CANNON.Box(new CANNON.Vec3(t, halfH, halfD)),
      new CANNON.Vec3(halfW, halfH, 0)
    );
    this.wallBody.position.set(def.x, 0, def.z);
    this.wallBody.quaternion.setFromEuler(0, def.rotY, 0);
    this.physicsWorld.addBody(this.wallBody);

    // --- Teleport player inside (center of scaled room) ---
    this.playerBody.position.set(def.x, 0.7, def.z);
    this.playerBody.velocity.set(0, 0, 0);

    this.playerMesh.position.set(
      this.playerBody.position.x,
      this.playerBody.position.y - 0.7,
      this.playerBody.position.z
    );

    // --- Fixed corner camera (using scaled room size) ---
    const scaledW = def.width * S;
    const scaledD = def.depth * S;
    const cornerLocal = new THREE.Vector3(-scaledW / 2 + 0.5, def.height - 0.3, scaledD / 2 - 0.5);
    cornerLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), def.rotY);
    const centerLocal = new THREE.Vector3(0, 0.5, 0);
    centerLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), def.rotY);

    this.cameraSystem.fixedPosition = new THREE.Vector3(
      def.x + cornerLocal.x,
      cornerLocal.y,
      def.z + cornerLocal.z
    );
    this.cameraSystem.fixedLookAt = new THREE.Vector3(
      def.x + centerLocal.x,
      centerLocal.y,
      def.z + centerLocal.z
    );
    this.savedFov = 45;
    this.cameraSystem.setFov(50);
    this.cameraSystem.snap();

    this.currentBuilding = building;
    EventBus.emit('player:enter-building', { name: def.name });

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

    // --- Clean up interior ---
    const ig = building.interiorGroup;

    // Remove front wall
    if (this.frontWallMesh) {
      ig.remove(this.frontWallMesh);
      this.frontWallMesh.geometry.dispose();
      (this.frontWallMesh.material as THREE.Material).dispose();
      this.frontWallMesh = null;
    }

    // Remove physics walls
    if (this.wallBody) {
      this.physicsWorld.removeBody(this.wallBody);
      this.wallBody = null;
    }

    // Hide interior, restore ceiling, stash underground, return to village group
    ig.visible = false;
    ig.traverse((child) => {
      if (child.name === 'ceiling') child.visible = true;
    });
    ig.position.y = INTERIOR_Y;
    ig.rotation.y = 0;
    ig.scale.set(1, 1, 1);

    // --- Restore outside world ---
    this.terrain.visible = true;
    this.scene.fog = this.savedFog;
    if (this.savedBackground) {
      this.scene.background = this.savedBackground;
    }

    for (const b of this.village.buildings) {
      b.exteriorGroup.visible = true;
    }
    building.exteriorGroup.visible = true;
    this.physicsWorld.addBody(building.collider);

    // Teleport player outside
    this.playerBody.position.set(
      building.doorPosition.x,
      1.5,
      building.doorPosition.z
    );
    this.playerBody.velocity.set(0, 0, 0);

    this.playerMesh.position.set(
      this.playerBody.position.x,
      this.playerBody.position.y - 0.7,
      this.playerBody.position.z
    );

    // Restore exterior camera
    this.cameraSystem.fixedPosition = null;
    this.cameraSystem.fixedLookAt = null;
    this.cameraSystem.setFov(this.savedFov);
    const extOffset = new THREE.Vector3(CAMERA_OFFSET_X, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z);
    this.cameraSystem.offset.copy(extOffset);
    this.cameraSystem.snap();

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
      return new THREE.Vector3(0, 0, 0); // fixed camera mode, offset unused
    }
    return new THREE.Vector3(CAMERA_OFFSET_X, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
