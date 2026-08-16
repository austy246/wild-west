import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Building } from './BuildingFactory';
import { Village } from './Village';
import { Player } from '../entities/Player';
import { EventBus } from '../core/EventBus';
import { InputManager } from '../core/InputManager';
import {
  CAMERA_OFFSET_X,
  CAMERA_OFFSET_Y,
  CAMERA_OFFSET_Z,
} from '../utils/constants';
import { CameraSystem } from '../systems/CameraSystem';
import { Wallet } from '../economy/Wallet';

const DOOR_INTERACT_DIST = 2.5;
const INTERIOR_Y = -50; // interiors stored underground when not in use

export class InteriorManager {
  private village: Village;
  private player: Player;
  private scene: THREE.Scene;
  private physicsWorld: CANNON.World;
  private cameraSystem: CameraSystem;
  private terrain: THREE.Mesh;
  private wallet: Wallet;

  private currentBuilding: Building | null = null;
  private fadeOverlay: HTMLElement;
  private promptEl: HTMLElement;
  private horsePromptEl!: HTMLElement;
  private tmpVec = new THREE.Vector3();
  private horseBuyEKeyWasDown = false;
  private isTransitioning = false;

  /**
   * Set while another interaction owns the E key at this spot — the cellar
   * behind the church sits within door range of the church itself, and without
   * this the one press would both hide the player and walk him inside.
   */
  doorInteractionBlocked = false;

  // Temporary objects created when entering a building
  private wallBody: CANNON.Body | null = null;
  private furnitureBodies: CANNON.Body[] = [];
  private frontWallMesh: THREE.Mesh | null = null;
  private savedBackground: THREE.Color | THREE.Texture | null = null;
  private savedFog: THREE.Fog | THREE.FogExp2 | null = null;

  private savedFov = 45;
  private isSitting = false;
  private chairWorldPos: THREE.Vector3 | null = null;
  private counterWorldPos: THREE.Vector3 | null = null;
  private shopMenuEl: HTMLElement | null = null;
  private shopMenuOpen = false;
  private shopCooldown = 0;

  get isInside(): boolean {
    return this.currentBuilding !== null;
  }

  constructor(
    village: Village,
    player: Player,
    scene: THREE.Scene,
    physicsWorld: CANNON.World,
    cameraSystem: CameraSystem,
    terrain: THREE.Mesh,
    wallet: Wallet
  ) {
    this.village = village;
    this.player = player;
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.cameraSystem = cameraSystem;
    this.terrain = terrain;
    this.wallet = wallet;

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

    // Horse name label (shown when the player is near a stable horse)
    this.horsePromptEl = document.createElement('div');
    this.horsePromptEl.id = 'horse-prompt';
    this.horsePromptEl.style.cssText = `
      position: fixed;
      bottom: 120px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      color: #DEB887;
      padding: 6px 18px;
      border: 2px solid #8B6508;
      border-radius: 6px;
      font-size: 16px;
      font-weight: bold;
      z-index: 20;
      display: none;
      pointer-events: none;
    `;
    document.body.appendChild(this.horsePromptEl);

    // Shop menu
    this.shopMenuEl = document.createElement('div');
    this.shopMenuEl.id = 'shop-menu';
    this.shopMenuEl.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(20, 12, 5, 0.92);
      color: #DEB887;
      padding: 20px 30px;
      border: 3px solid #8B4513;
      border-radius: 10px;
      font-size: 18px;
      z-index: 30;
      display: none;
      min-width: 280px;
    `;
    this.shopMenuEl.innerHTML = `
      <div style="font-size:22px;font-weight:bold;margin-bottom:14px;text-align:center;color:#daa520;">Co si přejete, pane?</div>
      <div class="shop-item" data-item="steak" style="cursor:pointer;padding:8px 12px;margin:4px 0;border:1px solid #5a3a1a;border-radius:4px;">
        🥩 Stejk <span style="float:right;color:#ffd700;">200 lilků</span>
      </div>
      <div class="shop-item" data-item="beans" style="cursor:pointer;padding:8px 12px;margin:4px 0;border:1px solid #5a3a1a;border-radius:4px;">
        🫘 Fazole <span style="float:right;color:#ffd700;">60 lilků</span>
      </div>
      <div class="shop-item" data-item="water" style="cursor:pointer;padding:8px 12px;margin:4px 0;border:1px solid #5a3a1a;border-radius:4px;">
        💧 Voda <span style="float:right;color:#ffd700;">30 lilků</span>
      </div>
      <div class="shop-item" data-item="whisky" style="cursor:pointer;padding:8px 12px;margin:4px 0;border:1px solid #5a3a1a;border-radius:4px;">
        🥃 Whisky <span style="float:right;color:#ffd700;">40 lilků</span>
      </div>
      <div style="border-top:1px solid #5a3a1a;margin:8px 0;"></div>
      <div class="shop-item" data-item="knife" style="cursor:pointer;padding:8px 12px;margin:4px 0;border:1px solid #5a3a1a;border-radius:4px;">
        🔪 Nůž <span style="float:right;color:#ffd700;">250 lilků</span>
      </div>
      <div class="shop-item" data-item="shotgun" style="cursor:pointer;padding:8px 12px;margin:4px 0;border:1px solid #5a3a1a;border-radius:4px;">
        🔫 Brokovnice <span style="float:right;color:#ffd700;">500 lilků</span>
      </div>
      <div class="shop-item" data-item="ammo" style="cursor:pointer;padding:8px 12px;margin:4px 0;border:1px solid #5a3a1a;border-radius:4px;">
        💥 Náboje (2x) <span style="float:right;color:#ffd700;">10 lilků</span>
      </div>
      <div id="shop-status" style="text-align:center;margin-top:10px;font-size:15px;min-height:20px;"></div>
      <div style="text-align:center;margin-top:8px;font-size:14px;color:#8B4513;">Stiskni E pro zavření</div>
    `;
    document.body.appendChild(this.shopMenuEl);

    // Shop menu items with prices
    const shopPrices: Record<string, number> = {
      steak: 200,
      beans: 60,
      water: 30,
      whisky: 40,
      knife: 250,
      shotgun: 500,
      ammo: 10,
    };
    const shopNames: Record<string, string> = {
      steak: 'Stejk',
      beans: 'Fazole',
      water: 'Vodu',
      whisky: 'Whisky',
      knife: 'Nůž',
      shotgun: 'Brokovnici',
      ammo: 'Náboje',
    };

    // Shop menu hover effect & buy logic
    this.shopMenuEl.querySelectorAll('.shop-item').forEach((el) => {
      (el as HTMLElement).addEventListener('mouseenter', () => {
        (el as HTMLElement).style.background = 'rgba(139, 69, 19, 0.4)';
      });
      (el as HTMLElement).addEventListener('mouseleave', () => {
        (el as HTMLElement).style.background = 'transparent';
      });
      (el as HTMLElement).addEventListener('click', () => {
        const item = (el as HTMLElement).dataset.item!;
        const price = shopPrices[item] || 0;
        const statusEl = this.shopMenuEl!.querySelector('#shop-status') as HTMLElement;
        if (this.wallet.spend(price)) {
          statusEl.style.color = '#66bb6a';
          statusEl.textContent = `Koupil jsi ${shopNames[item]}!`;
          if (item === 'knife') {
            EventBus.emit('shop:purchased', { item: { weaponType: 'knife' } });
            EventBus.emit('item:collected', { itemType: 'knife' });
          } else if (item === 'shotgun') {
            EventBus.emit('shop:purchased', { item: { weaponType: 'shotgun' } });
            EventBus.emit('item:collected', { itemType: 'shotgun' });
          } else if (item === 'ammo') {
            EventBus.emit('item:collected', { itemType: 'ammo' });
            EventBus.emit('item:collected', { itemType: 'ammo' });
          } else {
            EventBus.emit('item:collected', { itemType: item });
          }
        } else {
          statusEl.style.color = '#ef5350';
          statusEl.textContent = 'Nedostatek peněz!';
        }
        setTimeout(() => { statusEl.textContent = ''; }, 2000);
      });
    });

    // E to close shop menu
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && this.shopMenuOpen) {
        this.shopMenuOpen = false;
        this.shopMenuEl!.style.display = 'none';
        this.shopCooldown = 0.5;
      }
    });

    // Disable frustum culling on all interior groups
    for (const b of this.village.buildings) {
      b.interiorGroup.traverse((child) => {
        child.frustumCulled = false;
      });
    }
  }

  update(dt: number = 0.016): void {
    if (this.isTransitioning) return;

    const playerPos = new THREE.Vector3(
      this.player.body.position.x,
      this.player.body.position.y,
      this.player.body.position.z
    );

    if (this.currentBuilding) {
      // Inside — check for exit near the interior door (front wall, scaled)
      const def = this.currentBuilding.def;

      // Stable: roam the horses and show a name when the player gets close
      if (def.name === 'Stáje') {
        this.updateStableHorses(dt, playerPos);
      } else {
        this.horsePromptEl.style.display = 'none';
      }

      const S = 2;
      const doorLocal = new THREE.Vector3(0, 0, (def.depth * S) / 2 - 0.5);
      doorLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), def.rotY);
      const doorWorldPos = new THREE.Vector3(def.x + doorLocal.x, 1, def.z + doorLocal.z);

      const dist = playerPos.distanceTo(doorWorldPos);

      // Check if sitting — E to stand up
      if (this.isSitting) {
        this.promptEl.textContent = 'Stiskni E pro vstání';
        this.promptEl.style.display = 'block';
        if (InputManager.isKeyDown('KeyE')) {
          this.isSitting = false;
          this.player.body.type = CANNON.Body.DYNAMIC;
          // Move player slightly away from chair
          if (this.chairWorldPos) {
            const awayDir = new THREE.Vector3(0, 0, 0.8);
            awayDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), def.rotY);
            this.player.body.position.set(
              this.chairWorldPos.x + awayDir.x,
              0.7,
              this.chairWorldPos.z + awayDir.z
            );
          }
          this.player.body.velocity.set(0, 0, 0);
        }
        // Sync mesh to chair while sitting
        if (this.chairWorldPos) {
          this.player.mesh.position.set(this.chairWorldPos.x, 0.48 - 0.7, this.chairWorldPos.z);
        }
        return;
      }

      // Check near chair
      if (this.chairWorldPos) {
        const chairDist = playerPos.distanceTo(this.chairWorldPos);
        if (chairDist < 1.5 && dist >= 1.5) {
          this.promptEl.textContent = 'Stiskni E pro sezení';
          this.promptEl.style.display = 'block';
          if (InputManager.isKeyDown('KeyE')) {
            this.isSitting = true;
            this.player.body.type = CANNON.Body.STATIC;
            this.player.body.velocity.set(0, 0, 0);
            this.player.body.position.set(this.chairWorldPos.x, 0.48, this.chairWorldPos.z);
            this.player.mesh.position.set(this.chairWorldPos.x, 0.48 - 0.7, this.chairWorldPos.z);
          }
          return;
        }
      }

      // Tick shop cooldown
      if (this.shopCooldown > 0) this.shopCooldown -= dt;

      // Check near shop counter
      if (this.counterWorldPos && !this.shopMenuOpen && this.shopCooldown <= 0) {
        const counterDist = playerPos.distanceTo(this.counterWorldPos);
        if (counterDist < 2.0 && dist >= 1.5) {
          this.promptEl.textContent = 'Stiskni E pro nákup';
          this.promptEl.style.display = 'block';
          if (InputManager.isKeyDown('KeyE')) {
            this.shopMenuOpen = true;
            this.shopMenuEl!.style.display = 'block';
            this.promptEl.style.display = 'none';
          }
          return;
        }
      }

      // If shop menu is open, hide prompt
      if (this.shopMenuOpen) {
        this.promptEl.style.display = 'none';
        return;
      }

      if (dist < 1.5) {
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
      this.horsePromptEl.style.display = 'none';
      if (this.doorInteractionBlocked) {
        this.promptEl.style.display = 'none';
        return;
      }
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

  /** Roam the stable horses within their stalls and label the nearest one. */
  private updateStableHorses(dt: number, playerPos: THREE.Vector3): void {
    const ig = this.currentBuilding!.interiorGroup;
    const horses = ig.userData.stableHorses as THREE.Group[] | undefined;
    if (!horses || horses.length === 0) {
      this.horsePromptEl.style.display = 'none';
      return;
    }

    // Player position in interior-local space (undo translate → rotate → scale)
    const S = 2;
    const def = this.currentBuilding!.def;
    this.tmpVec.set(playerPos.x - def.x, 0, playerPos.z - def.z);
    this.tmpVec.applyAxisAngle(new THREE.Vector3(0, 1, 0), -def.rotY);
    const plx = this.tmpVec.x / S;
    const plz = this.tmpVec.z / S;

    let nearest: THREE.Group | null = null;
    let nearestDx = Infinity;

    for (const horse of horses) {
      const u = horse.userData;

      // Wander toward a random target inside the stall bounds
      if (u.waitTimer > 0) {
        u.waitTimer -= dt;
      } else {
        const dx = u.targetX - horse.position.x;
        const dz = u.targetZ - horse.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < 0.15) {
          u.waitTimer = 1 + Math.random() * 3;
          u.targetX = u.minX + Math.random() * (u.maxX - u.minX);
          u.targetZ = u.minZ + Math.random() * (u.maxZ - u.minZ);
        } else {
          const step = u.speed * dt;
          horse.position.x += (dx / d) * step;
          horse.position.z += (dz / d) * step;
          horse.rotation.y = Math.atan2(dx, dz) + Math.PI; // head leads
          horse.position.y = Math.abs(Math.sin(Date.now() * 0.005 * (u.speed + 1))) * 0.05;
        }
      }

      // Is the player standing in front of this stall (near the barrier)?
      const inFrontZone = plz > u.gateZ - 0.3 && plz < u.gateZ + 1.0;
      const dxStall = Math.abs(plx - u.centerX);
      if (inFrontZone && dxStall < u.halfW && dxStall < nearestDx) {
        nearestDx = dxStall;
        nearest = horse;
      }
    }

    if (nearest) {
      const u = nearest.userData;
      const eDown = InputManager.isKeyDown('KeyE');
      if (u.bought) {
        this.horsePromptEl.textContent = `🐴 ${u.horseName} — už je tvůj`;
      } else {
        this.horsePromptEl.textContent =
          `🐴 ${u.horseName} — ${u.horseDesc}  •  E: koupit (${u.price} lilků)`;
        if (eDown && !this.horseBuyEKeyWasDown) {
          if (this.wallet.spend(u.price)) {
            u.bought = true;
            nearest.visible = false; // led out of the stall
            const door = this.currentBuilding!.doorPosition;
            EventBus.emit('horse:bought', {
              name: u.horseName,
              color: u.color,
              rideSpeed: u.rideSpeed,
              x: door.x,
              z: door.z,
            });
          } else {
            EventBus.emit('notify', { text: 'Nemáš dost lilků!' });
          }
        }
      }
      this.horsePromptEl.style.display = 'block';
      this.horseBuyEKeyWasDown = eDown;
    } else {
      this.horsePromptEl.style.display = 'none';
      this.horseBuyEKeyWasDown = InputManager.isKeyDown('KeyE');
    }
  }

  /**
   * Walk the player into a building from a script (cutscene) rather than from
   * an E press. Resolves once the fade-in has finished.
   */
  async forceEnter(building: Building): Promise<void> {
    if (this.currentBuilding || this.isTransitioning) return;
    await this.enterBuilding(building);
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

    const inW = def.width - 0.4;
    const inD = def.depth - 0.4;

    // --- Add physics walls (4 sides, using SCALED dimensions) ---
    const halfW = (def.width * S) / 2;
    const halfH = def.height * 1.5;  // full interior height
    const halfD = (def.depth * S) / 2;
    const t = 0.5;  // thick walls to prevent clipping

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

    // --- Furniture colliders (local coords, scaled & rotated with the room) ---
    this.furnitureBodies = [];

    // Helper: add a box collider at local position (pre-scale) with given half-extents
    const addFurniture = (lx: number, lz: number, hw: number, hh: number, hd: number) => {
      const body = new CANNON.Body({ type: CANNON.Body.STATIC });
      body.addShape(new CANNON.Box(new CANNON.Vec3(hw * S, hh, hd * S)));
      // Transform local position by scale, then rotation, then translation
      const local = new THREE.Vector3(lx * S, hh, lz * S);
      local.applyAxisAngle(new THREE.Vector3(0, 1, 0), def.rotY);
      body.position.set(def.x + local.x, local.y, def.z + local.z);
      body.quaternion.setFromEuler(0, def.rotY, 0);
      this.physicsWorld.addBody(body);
      this.furnitureBodies.push(body);
    };

    if (def.name === 'Šerifův úřad') {
      const iH = def.height * 1.5;
      // Desk (center, smaller)
      addFurniture(0, -inD * 0.15, inW * 0.18 + 0.05, iH * 0.15, inD * 0.11 + 0.05);
      // Chair (behind desk)
      addFurniture(0, -inD * 0.15 - inD * 0.11 - 0.45, 0.3, 0.5, 0.25);
      // Bed (left back corner)
      addFurniture(-inW / 2 + 0.6, -inD / 2 + 0.9, 0.55, 0.25, 0.85);
      // Barrel (near front left)
      addFurniture(-inW / 2 + 0.4, inD / 2 - 0.4, 0.25, 0.25, 0.25);
      // Crate (near front left)
      addFurniture(-inW / 2 + 0.9, inD / 2 - 0.35, 0.22, 0.2, 0.22);
    } else if (def.name === 'Obchod') {
      // Counter
      addFurniture(0, -inD * 0.2, inW * 0.35 + 0.05, 0.5, 0.3);
    } else if (def.name === 'Stáje') {
      // Barrier across the front of the horse stalls so the player can't
      // walk straight up to the horses (matches the visual stall gates)
      const gateZ = -inD / 4 + inD * 0.3;
      addFurniture(0, gateZ, inW / 2 + 0.4, 0.6, 0.12);
    }

    // --- Teleport player inside ---
    // Stables: spawn in the open front area, in front of the stall barrier
    if (def.name === 'Stáje') {
      const spawnLocal = new THREE.Vector3(0, 0, inD * 0.3 * S);
      spawnLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), def.rotY);
      this.player.body.position.set(def.x + spawnLocal.x, 0.7, def.z + spawnLocal.z);
    } else {
      this.player.body.position.set(def.x, 0.7, def.z);
    }
    this.player.body.velocity.set(0, 0, 0);

    this.player.mesh.position.set(
      this.player.body.position.x,
      this.player.body.position.y - 0.7,
      this.player.body.position.z
    );

    // --- Calculate chair world position ---
    this.isSitting = false;
    this.shopMenuOpen = false;
    this.shopMenuEl!.style.display = 'none';
    if (def.name === 'Šerifův úřad') {
      const deskZ = -inD * 0.15;
      const deskD = inD * 0.22;
      const chairLocalX = 0;
      const chairLocalZ = deskZ - deskD / 2 - 0.45;
      const chairLocal = new THREE.Vector3(chairLocalX * S, 0, chairLocalZ * S);
      chairLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), def.rotY);
      this.chairWorldPos = new THREE.Vector3(def.x + chairLocal.x, 0.48, def.z + chairLocal.z);
    } else {
      this.chairWorldPos = null;
    }

    // --- Calculate counter world position (shop) ---
    if (def.name === 'Obchod') {
      const counterLocal = new THREE.Vector3(0, 0, -inD * 0.2 * S);
      counterLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), def.rotY);
      this.counterWorldPos = new THREE.Vector3(def.x + counterLocal.x, 1, def.z + counterLocal.z);
    } else {
      this.counterWorldPos = null;
    }

    // --- Fixed corner camera (using scaled room size) ---
    const scaledW = def.width * S;
    const scaledD = def.depth * S;
    const cornerLocal = new THREE.Vector3(scaledW * 0.35, def.height * 1.7, scaledD * 0.35);
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
    this.cameraSystem.setFov(85);
    this.cameraSystem.snap();

    // Camera-relative movement basis so W goes away from the camera into the room
    const camFwd = new THREE.Vector3(
      this.cameraSystem.fixedLookAt.x - this.cameraSystem.fixedPosition.x,
      0,
      this.cameraSystem.fixedLookAt.z - this.cameraSystem.fixedPosition.z
    );
    if (camFwd.lengthSq() > 1e-6) camFwd.normalize();
    this.player.indoorForward = { x: camFwd.x, z: camFwd.z };
    this.player.indoorRight = { x: -camFwd.z, z: camFwd.x };

    this.currentBuilding = building;
    this.player.isIndoors = true;
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
    this.horsePromptEl.style.display = 'none';

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

    // Remove furniture colliders
    for (const fb of this.furnitureBodies) {
      this.physicsWorld.removeBody(fb);
    }
    this.furnitureBodies = [];

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
    this.player.body.position.set(
      building.doorPosition.x,
      1.5,
      building.doorPosition.z
    );
    this.player.body.velocity.set(0, 0, 0);

    this.player.mesh.position.set(
      this.player.body.position.x,
      this.player.body.position.y - 0.7,
      this.player.body.position.z
    );

    // Restore exterior camera
    this.cameraSystem.fixedPosition = null;
    this.cameraSystem.fixedLookAt = null;
    this.cameraSystem.setFov(this.savedFov);
    const extOffset = new THREE.Vector3(CAMERA_OFFSET_X, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z);
    this.cameraSystem.offset.copy(extOffset);
    this.cameraSystem.snap();

    this.currentBuilding = null;
    this.player.isIndoors = false;
    this.isSitting = false;
    this.chairWorldPos = null;
    this.counterWorldPos = null;
    this.shopMenuOpen = false;
    this.shopMenuEl!.style.display = 'none';
    this.player.body.type = CANNON.Body.DYNAMIC;
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
