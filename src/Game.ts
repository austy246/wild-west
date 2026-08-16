import * as THREE from 'three';
import { Engine } from './core/Engine';
import { InputManager } from './core/InputManager';
import { PhysicsWorld } from './core/PhysicsWorld';
import { EventBus } from './core/EventBus';
import { Player } from './entities/Player';
import { NPC } from './entities/NPC';
import { Collectible, COLLECTIBLE_SPAWNS } from './entities/Collectible';
import { Bandit, BANDIT_SPAWNS } from './entities/Bandit';
import { CameraSystem } from './systems/CameraSystem';
import { CombatSystem } from './systems/CombatSystem';
import { InteractionSystem } from './systems/InteractionSystem';
import { Village } from './world/Village';
import { InteriorManager } from './world/InteriorManager';
import { UndergroundLab, BEHIND_CHURCH } from './world/UndergroundLab';
import { DialogBox } from './ui/DialogBox';
import { QuestLog } from './ui/QuestLog';
import { QuestManager } from './quest/QuestManager';
import { Wallet } from './economy/Wallet';
import { Shop } from './economy/Shop';
import { ShopUI } from './ui/ShopUI';
import { PauseMenu } from './ui/PauseMenu';
import { GameOverScreen } from './ui/GameOverScreen';
import { TouchControls } from './ui/TouchControls';
import { Hotbar } from './ui/Hotbar';
import { SaveManager, SaveData } from './core/SaveManager';
import { createTerrain } from './world/Terrain';
import { createLighting, followSun, SceneLights } from './world/Lighting';
import { DayNight } from './world/DayNight';
import { Bedtime } from './world/Bedtime';
import { MaryCutscene } from './story/MaryCutscene';
import { WagonCutscene } from './story/WagonCutscene';
import { FlyerOverlay } from './ui/FlyerOverlay';
import { MusicDirector } from './core/Music';
import { LightBudget } from './systems/LightBudget';
import { QualityManager } from './systems/QualityManager';
import { pruneSmallShadowCasters } from './systems/ShadowPruner';
import { dedupeMaterials, mergeStaticDescendants } from './systems/StaticBatcher';
import { createSkybox } from './world/Skybox';
import { NPC_DEFS } from './world/NPCSpawns';
import { PHYSICS_TIMESTEP } from './utils/constants';

export class Game {
  private engine: Engine;
  private physics: PhysicsWorld;
  private player: Player;
  private cameraSystem: CameraSystem;
  private village: Village;
  private interiorManager: InteriorManager;
  private undergroundLab!: UndergroundLab;
  private dayNight: DayNight;
  private bedtime: Bedtime;
  private maryCutscene!: MaryCutscene;
  private wagonCutscene: WagonCutscene;
  private flyerOverlay: FlyerOverlay;
  private music: MusicDirector;
  private sceneLights: SceneLights;
  private lightBudget!: LightBudget;
  private qualityManager!: QualityManager;
  private npcs: NPC[] = [];
  private collectibles: Collectible[] = [];
  private bandits: Bandit[] = [];
  private dialogBox: DialogBox;
  private interactionSystem: InteractionSystem;
  private combatSystem!: CombatSystem;
  private questManager: QuestManager;
  private questLog: QuestLog;
  private wallet: Wallet;
  private shop: Shop;
  private shopUI: ShopUI;
  private pauseMenu: PauseMenu;
  private gameOverScreen: GameOverScreen;
  private hotbar!: Hotbar;

  private terrain!: THREE.Mesh;
  private physicsAccumulator = 0;

  // Chat
  private chatInput!: HTMLInputElement;
  private chatOpen = false;
  private chatHistory: string[] = [];
  private chatHistoryIndex = -1;
  private autoSaveTimer = 0;
  private shackPromptEl: HTMLElement;
  private eKeyWasDown = false;
  private eKeyWasDownUnicorn = false;
  private ridingUnicorn = false;
  private unicornPromptEl!: HTMLElement;

  // Magic herb ("kouzelná travička") trip effect
  private trippy = false;
  private tripTimer = 0;
  private tripOverlayEl!: HTMLElement;

  // Mary story: night falls once the player steps back outside with the pendant
  private nightPending = false;
  private flyerPromptEl!: HTMLElement;
  private eKeyWasDownFlyer = false;
  private starvingVignetteEl: HTMLElement | null = null;
  private wasStarving = false;

  // Bought stable horse (rideable)
  private boughtHorseMesh: THREE.Group | null = null;
  private boughtHorseSpeed = 2.0;
  private ridingHorse = false;
  private eKeyWasDownHorse = false;

  constructor(canvas: HTMLCanvasElement) {
    // Core
    this.engine = new Engine(canvas);
    this.physics = new PhysicsWorld();

    // World
    createSkybox(this.engine.scene);
    this.sceneLights = createLighting(this.engine.scene);
    this.terrain = createTerrain();
    this.engine.scene.add(this.terrain);

    // Player
    this.player = new Player();
    this.engine.scene.add(this.player.mesh);
    this.physics.world.addBody(this.player.body);

    // Village
    this.village = new Village(this.engine.scene, this.physics.world);

    // NPCs
    for (const def of NPC_DEFS) {
      const npc = new NPC(def);
      this.npcs.push(npc);
      this.engine.scene.add(npc.mesh);
    }

    // Lay Wazovský lounging on top of his haystack
    const wazovsky = this.npcs.find((n) => n.def.id === 'wazovsky');
    if (wazovsky) {
      wazovsky.mesh.position.y = 1.5;
      wazovsky.mesh.rotation.x = -Math.PI / 2; // lying on his back on the hay
    }

    // Collectibles
    for (const def of COLLECTIBLE_SPAWNS) {
      const c = new Collectible(def);
      this.collectibles.push(c);
      this.engine.scene.add(c.mesh);
    }

    // Bandits
    for (const def of BANDIT_SPAWNS) {
      const bandit = new Bandit(def);
      this.bandits.push(bandit);
      this.engine.scene.add(bandit.mesh);
    }

    // Economy
    this.wallet = new Wallet();
    this.shop = new Shop(this.wallet);
    this.shopUI = new ShopUI(this.shop);

    // Quests
    this.questManager = new QuestManager();
    this.questLog = new QuestLog(this.questManager);

    // Dialog
    this.dialogBox = new DialogBox();

    // Interaction system — wire up quest-aware dialog
    this.interactionSystem = new InteractionSystem(
      this.npcs,
      this.player.mesh,
      this.dialogBox
    );
    this.interactionSystem.onInteract = (npc) => this.handleNPCInteraction(npc);

    // Combat
    this.combatSystem = new CombatSystem(
      this.player,
      this.bandits,
      this.engine.scene,
      this.engine.camera
    );

    // Camera
    this.cameraSystem = new CameraSystem(this.engine.camera, this.player.mesh);

    // Interior Manager (after camera so we can pass cameraSystem)
    this.interiorManager = new InteriorManager(
      this.village,
      this.player,
      this.engine.scene,
      this.physics.world,
      this.cameraSystem,
      this.terrain,
      this.wallet
    );

    // Underground lab (Wazovský story)
    this.undergroundLab = new UndergroundLab(
      this.engine.scene,
      this.player,
      this.physics.world,
      this.cameraSystem
    );

    // Day/night — night is switched on after Mary hands over the pendant
    this.dayNight = new DayNight(this.engine.scene);
    this.bedtime = new Bedtime(this.village);

    // Chapter 3 — the wagon that brings the werewolf warning
    this.wagonCutscene = new WagonCutscene(this.engine.scene, this.player, this.village);
    this.wagonCutscene.onFinished = () => {
      this.questManager.accept('werewolf-flyer');
    };
    this.flyerOverlay = new FlyerOverlay();

    // Score — starts here because the menu click counts as the user gesture
    // browsers require before any audio may play
    this.music = new MusicDirector();
    this.music.start();
    this.dayNight.onChange = (night) => this.music.setMood(night ? 'night' : 'day');

    // M mutes and unmutes
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyM' || this.chatOpen) return;
      const on = this.music.toggle();
      this.showNotification(on ? '🔊 Hudba zapnutá' : '🔇 Hudba vypnutá');
    });

    // Mary's escort cutscene
    const mary = this.npcs.find((n) => n.def.id === 'townsfolk2');
    if (mary) {
      this.maryCutscene = new MaryCutscene(
        this.player,
        mary,
        this.village,
        this.interiorManager,
        this.dialogBox
      );
      this.maryCutscene.onPendantGiven = () => {
        this.questManager.completeDelivery('townsfolk2');
        this.nightPending = true;
      };
    }

    // --- Performance ---
    // Characters keep their shadows however small their individual parts are
    for (const g of [this.player.mesh, ...this.npcs.map((n) => n.mesh), ...this.bandits.map((b) => b.mesh)]) {
      g.traverse((o) => { o.userData.keepShadow = true; });
    }
    pruneSmallShadowCasters(this.engine.scene);

    // Collapse the town's static clutter into a few big meshes. Buildings are
    // batched individually so each one can still be hidden when you step
    // inside it; interiors are skipped entirely (they're stashed underground
    // and get moved and scaled when entered).
    dedupeMaterials(this.engine.scene);
    const buildingGroups = new Set<THREE.Object3D>();
    for (const b of this.village.buildings) {
      buildingGroups.add(b.exteriorGroup);
      buildingGroups.add(b.interiorGroup);
    }
    mergeStaticDescendants(this.village.group, { skip: buildingGroups });
    for (const b of this.village.buildings) {
      mergeStaticDescendants(b.exteriorGroup);
    }

    this.lightBudget = new LightBudget(this.engine.scene);
    this.qualityManager = new QualityManager(
      this.engine.renderer,
      this.sceneLights.sun,
      this.lightBudget
    );
    this.qualityManager.onTierChange = (tier, reason) => {
      if (tier === 1) this.showNotification(`Snižuji detaily kvůli plynulosti (${reason})`);
    };

    // Input
    InputManager.init(canvas);

    // Touch controls (only visible on touch devices)
    new TouchControls();

    // Pause menu
    this.pauseMenu = new PauseMenu();
    this.pauseMenu.onSave = () => {
      this.saveGame();
      this.showNotification('Hra uložena!');
    };
    this.pauseMenu.onQuit = () => {
      this.saveGame();
      window.location.reload();
    };

    // Chat input
    this.chatInput = document.createElement('input');
    this.chatInput.type = 'text';
    this.chatInput.placeholder = 'Napiš příkaz...';
    this.chatInput.style.cssText = `
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      width: 400px;
      padding: 8px 14px;
      background: rgba(0,0,0,0.8);
      color: #DEB887;
      border: 2px solid #8B4513;
      border-radius: 6px;
      font-size: 16px;
      z-index: 50;
      display: none;
      outline: none;
    `;
    document.body.appendChild(this.chatInput);

    // T to open chat
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyT' && !this.chatOpen) {
        e.preventDefault();
        this.chatOpen = true;
        this.chatInput.style.display = 'block';
        this.chatInput.value = '';
        this.chatInput.focus();
      }
    });

    // Enter to send, Escape to close, ArrowUp for history
    this.chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Enter') {
        const text = this.chatInput.value.trim();
        if (text) this.chatHistory.push(text);
        this.chatHistoryIndex = -1;
        this.processChat(text);
        this.chatOpen = false;
        this.chatInput.style.display = 'none';
        this.chatInput.value = '';
      } else if (e.code === 'Escape') {
        this.chatOpen = false;
        this.chatInput.style.display = 'none';
        this.chatInput.value = '';
        this.chatHistoryIndex = -1;
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        if (this.chatHistory.length > 0) {
          if (this.chatHistoryIndex === -1) {
            this.chatHistoryIndex = this.chatHistory.length - 1;
          } else if (this.chatHistoryIndex > 0) {
            this.chatHistoryIndex--;
          }
          this.chatInput.value = this.chatHistory[this.chatHistoryIndex];
        }
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (this.chatHistoryIndex !== -1) {
          if (this.chatHistoryIndex < this.chatHistory.length - 1) {
            this.chatHistoryIndex++;
            this.chatInput.value = this.chatHistory[this.chatHistoryIndex];
          } else {
            this.chatHistoryIndex = -1;
            this.chatInput.value = '';
          }
        }
      }
    });

    // Game Over screen
    this.gameOverScreen = new GameOverScreen();
    this.gameOverScreen.onContinue = () => {
      const data = SaveManager.load();
      if (data) {
        this.combatSystem.respawn();
        this.loadGame(data);
      }
    };
    this.gameOverScreen.onRestart = () => {
      this.combatSystem.respawn();
    };
    this.gameOverScreen.onMainMenu = () => {
      window.location.reload();
    };

    EventBus.on('player:died', () => {
      this.gameOverScreen.show();
    });

    // Item pickup effects
    EventBus.on('item:collected', (data: { itemType: string }) => {
      if (data.itemType === 'herb') {
        const heal = 25;
        this.combatSystem.playerHp = Math.min(
          this.combatSystem.playerHp + heal,
          this.combatSystem.playerMaxHp
        );
        this.showNotification(`+${heal} HP`);
      }
      if (data.itemType === 'save-elixir') {
        this.saveGame();
        this.showNotification('Hra uložena!');
      }
    });

    // Shop purchased → unlock weapons
    EventBus.on('shop:purchased', (data: { item: { weaponType?: string } }) => {
      if (data.item.weaponType) {
        this.combatSystem.unlockWeapon(data.item.weaponType as any);
        this.combatSystem.switchWeapon(data.item.weaponType as any);
        this.showNotification(`Odemčena zbraň: ${data.item.weaponType === 'shotgun' ? 'Brokovnice' : data.item.weaponType}!`);
      }
    });

    // Quest completion notification (+ Wazovský story chaining)
    EventBus.on('quest:completed', (data: { questId: string; name: string; reward: { lilky: number } }) => {
      if (data.questId === 'wazovsky-supplies') {
        // Gathered the plants → next: bring them to Wazovský
        this.questManager.accept('wazovsky-delivery');
        this.showNotification('Máš dost rostlinek! Dones je Wazovskému.');
        return;
      }
      if (data.questId === 'wazovsky-delivery') {
        // Handed the plants over — they leave the inventory
        this.hotbar.removeAllOf('magic-plant');
        this.questManager.accept('mary-pendant');
        this.showNotification(`Wazovský ti dal ${data.reward.lilky} lilků!`);
        return;
      }
      if (data.questId === 'mary-pendant') {
        return; // the cutscene shows its own messages
      }
      this.showNotification(`Quest dokončen: ${data.name} (+${data.reward.lilky} lilků)`);
    });

    // Night falls the moment the player steps out of Mary's house
    EventBus.on('player:exit-building', () => {
      this.bedtime.onExitBuilding();

      if (!this.nightPending) return;
      this.nightPending = false;
      this.dayNight.setNight();
      // Send Mary back out to her usual spot so she can walk home like everyone
      const mary = this.npcs.find((n) => n.def.id === 'townsfolk2');
      if (mary) mary.mesh.position.set(mary.def.x, 0, mary.def.z);
      this.bedtime.start(this.npcs);
      this.showNotification('Setmělo se... lidi jdou spát.');
      // Nothing left to do tonight but sleep it off at Wazovský's
      this.questManager.accept('sleep-at-wazovsky');
      setTimeout(() => {
        this.showNotification('Taky by ses mohl vyspat. Zajdi za Wazovským.');
      }, 2600);
    });

    // Whoever sleeps here becomes visible while the player is inside
    EventBus.on('player:enter-building', (data: { name: string }) => {
      this.bedtime.onEnterBuilding(data.name);
    });

    // Generic notification requests (e.g. from the stable)
    EventBus.on('notify', (data: { text: string }) => {
      this.showNotification(data.text);
    });

    // Bought a stable horse → spawn a rideable horse outside the stable
    EventBus.on('horse:bought', (data: { name: string; color: number; rideSpeed: number; x: number; z: number }) => {
      if (this.boughtHorseMesh) {
        this.engine.scene.remove(this.boughtHorseMesh);
      }
      const mount = this.village.createRideableHorse(data.color);
      mount.position.set(data.x + 1.5, 0, data.z);
      this.engine.scene.add(mount);
      this.boughtHorseMesh = mount;
      this.boughtHorseSpeed = data.rideSpeed;
      this.ridingHorse = false;
      this.eKeyWasDownHorse = true; // require a fresh E press to mount
      this.showNotification(`Koupil jsi koně ${data.name}! Čeká venku před stájí.`);
    });

    // Auto-save on window close
    window.addEventListener('beforeunload', () => this.saveGame());

    // Show HUD
    document.getElementById('hud')?.classList.remove('hidden');

    // Hotbar
    this.hotbar = new Hotbar(() => this.combatSystem.playerHp >= this.combatSystem.playerMaxHp);

    // Shack interaction prompt
    this.shackPromptEl = document.createElement('div');
    this.shackPromptEl.style.cssText = `
      position: fixed;
      bottom: 105px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      color: #ff69b4;
      padding: 6px 16px;
      border: 2px solid #ff1493;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      z-index: 15;
      display: none;
      pointer-events: none;
    `;
    this.shackPromptEl.textContent = 'Stiskni E pro vyvolání jednorožce';
    document.body.appendChild(this.shackPromptEl);

    // Unicorn mount prompt
    this.unicornPromptEl = document.createElement('div');
    this.unicornPromptEl.style.cssText = `
      position: fixed;
      bottom: 105px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      color: #ff69b4;
      padding: 6px 16px;
      border: 2px solid #ff1493;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      z-index: 15;
      display: none;
      pointer-events: none;
    `;
    document.body.appendChild(this.unicornPromptEl);

    // Leaflet pickup prompt
    this.flyerPromptEl = document.createElement('div');
    this.flyerPromptEl.style.cssText = `
      position: fixed;
      bottom: 105px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      color: #f2ead6;
      padding: 6px 16px;
      border: 2px solid #8b7355;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      z-index: 15;
      display: none;
      pointer-events: none;
    `;
    this.flyerPromptEl.textContent = 'Stiskni E pro zvednutí letáku';
    document.body.appendChild(this.flyerPromptEl);

    this.starvingVignetteEl = document.getElementById('starving-vignette');

    // Rainbow overlay for the magic-herb trip (blends over the 3D canvas)
    this.tripOverlayEl = document.createElement('div');
    this.tripOverlayEl.id = 'trip-overlay';
    this.tripOverlayEl.style.display = 'none';
    document.body.appendChild(this.tripOverlayEl);
  }

  /** Main game loop tick */
  update(): void {
    const dt = this.engine.clock.getDelta();

    // Don't update game when paused, shop is open, or game over
    if (this.pauseMenu.isPaused || this.shopUI.isOpen || this.gameOverScreen.isShown) {
      this.engine.render();
      return;
    }

    // Input
    InputManager.poll();

    // The wagon thunders past — watch, that's all
    if (this.wagonCutscene.active) {
      this.wagonCutscene.update(dt);
      this.player.update(dt);
      for (const npc of this.npcs) npc.update(dt);
      followSun(this.sceneLights.sun, this.player.mesh.position);
      this.lightBudget.update(dt, this.player.mesh.position);
      this.cameraSystem.update(dt);
      this.engine.render();
      return;
    }

    // Cutscene: the script drives everything, normal gameplay is suspended
    if (this.maryCutscene?.active) {
      this.maryCutscene.update(dt);
      this.player.update(dt);
      for (const npc of this.npcs) npc.update(dt);
      this.dayNight.update(this.player.mesh.position, this.interiorManager.isInside);
      followSun(this.sceneLights.sun, this.player.mesh.position);
      this.lightBudget.update(dt, this.player.mesh.position);
      this.cameraSystem.offset.lerp(this.interiorManager.getCameraOffset(), 0.05);
      this.cameraSystem.update(dt);
      this.engine.render();
      return;
    }

    // Auto-save every 60 seconds
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= 60) {
      this.autoSaveTimer = 0;
      this.saveGame();
    }

    // Magic herb trip — count down and end the rainbow effect
    if (this.trippy) {
      this.tripTimer -= dt;
      if (this.tripTimer <= 0) {
        this.trippy = false;
        document.getElementById('game-canvas')?.classList.remove('trippy');
        this.tripOverlayEl.style.display = 'none';
        this.showNotification('Trip skončil...');
      }
    }

    // Physics (fixed timestep)
    this.physicsAccumulator += dt;
    while (this.physicsAccumulator >= PHYSICS_TIMESTEP) {
      this.physics.step();
      this.physicsAccumulator -= PHYSICS_TIMESTEP;
    }

    // Player
    this.player.update(dt);

    // NPCs
    for (const npc of this.npcs) {
      npc.update(dt);
    }

    // Collectibles
    const playerPos = this.player.mesh.position;
    for (const c of this.collectibles) {
      c.update(dt, playerPos);
    }

    // Bandits
    for (const bandit of this.bandits) {
      bandit.update(dt, playerPos);
    }

    // Combat
    this.combatSystem.update(dt);

    // Update holdingFood flag & auto-switch weapon based on hotbar
    this.player.holdingFood = this.hotbar.isSelectedFood();
    const selectedItem = this.hotbar.getSelectedItem();
    if (selectedItem === 'shotgun') {
      if (this.combatSystem.currentWeapon !== 'shotgun') this.combatSystem.switchWeapon('shotgun');
    } else if (selectedItem === 'knife') {
      if (this.combatSystem.currentWeapon !== 'knife') this.combatSystem.switchWeapon('knife');
    } else if (this.combatSystem.currentWeapon === 'shotgun' || this.combatSystem.currentWeapon === 'knife') {
      this.combatSystem.switchWeapon('fists');
    }

    // Eat food or use ammo (left or right click with item selected)
    if (InputManager.leftClick || InputManager.rightClick) {
      const selectedItem = this.hotbar.getSelectedItem();
      if (selectedItem === 'ammo') {
        this.hotbar.consumeSelected();
        this.combatSystem.addAmmo(1);
        this.showNotification('Nabito! +1 náboj');
      } else {
        const result = this.hotbar.consumeSelected();
        if (result) {
          this.player.hunger = Math.min(this.player.hunger + result.hunger, this.player.maxHunger);
          this.showNotification(`Snědl jsi ${result.name}!`);
        }
      }
    }

    // Hunger drain: 1 per 20 seconds = 0.05/s
    this.player.hunger = Math.max(0, this.player.hunger - 0.05 * dt);

    // Update hunger bar
    const hungerFill = document.getElementById('hunger-bar-fill');
    const hungerText = document.getElementById('hunger-text');
    if (hungerFill) hungerFill.style.width = `${(this.player.hunger / this.player.maxHunger) * 100}%`;
    if (hungerText) hungerText.textContent = `${Math.round(this.player.hunger)} / ${this.player.maxHunger}`;

    // Starving: blood at the edges, and no more running
    const starving = this.player.isStarving;
    if (starving !== this.wasStarving) {
      this.wasStarving = starving;
      this.starvingVignetteEl?.classList.toggle('active', starving);
      if (starving) this.showNotification('Máš hlad! Nemůžeš běhat — najez se.');
    }

    // Interaction (right-click on NPCs)
    this.interactionSystem.update();

    // Village (horse animations etc.)
    this.village.update(dt, this.player.mesh.position);

    // Shack unicorn interaction
    if (this.village.isNearShack(playerPos)) {
      this.shackPromptEl.style.display = 'block';
      const eDown = InputManager.isKeyDown('KeyE');
      if (eDown && !this.eKeyWasDown) {
        if (this.village.trySpawnUnicorn(playerPos, this.engine.scene)) {
          this.showNotification('Jednorožec se objevil!');
          this.shackPromptEl.style.display = 'none';
        }
      }
      this.eKeyWasDown = eDown;
    } else {
      this.shackPromptEl.style.display = 'none';
      this.eKeyWasDown = InputManager.isKeyDown('KeyE');
    }

    // Unicorn mount/dismount
    const unicornMesh = this.village.getUnicornMesh();
    if (this.ridingUnicorn && unicornMesh) {
      // Player sits on top of unicorn — raise player, place unicorn beneath
      this.player.mesh.position.y += 1.15;
      unicornMesh.position.set(
        this.player.mesh.position.x,
        0,
        this.player.mesh.position.z
      );
      unicornMesh.rotation.y = this.player.mesh.rotation.y - Math.PI / 2;
      this.unicornPromptEl.textContent = 'Stiskni E pro sesednutí';
      this.unicornPromptEl.style.display = 'block';
    } else if (!this.ridingUnicorn && this.village.isNearUnicorn(playerPos)) {
      this.unicornPromptEl.textContent = 'Stiskni E pro nasednutí na jednorožce';
      this.unicornPromptEl.style.display = 'block';
    } else {
      this.unicornPromptEl.style.display = 'none';
    }

    // Handle E key for mount/dismount
    if (unicornMesh) {
      const eDown = InputManager.isKeyDown('KeyE');
      if (eDown && !this.eKeyWasDownUnicorn) {
        if (this.ridingUnicorn) {
          // Dismount
          this.ridingUnicorn = false;
          this.player.speedMultiplier = 1;
          this.player.body.linearDamping = 0.4;
          this.combatSystem.ridingUnicorn = false;
          unicornMesh.position.set(
            this.player.mesh.position.x + 2,
            0,
            this.player.mesh.position.z
          );
          this.showNotification('Sesedl jsi z jednorožce');
        } else if (this.village.isNearUnicorn(playerPos)) {
          // Mount
          this.ridingUnicorn = true;
          this.player.speedMultiplier = 2.5;
          this.player.body.linearDamping = 0;
          this.combatSystem.ridingUnicorn = true;
          this.showNotification('Nasedl jsi na jednorožce!');
        }
      }
      this.eKeyWasDownUnicorn = eDown;
    }

    // Bought stable horse mount/dismount (speed depends on the horse)
    if (this.boughtHorseMesh && !this.interiorManager.isInside) {
      const horseMesh = this.boughtHorseMesh;
      const dx = horseMesh.position.x - playerPos.x;
      const dz = horseMesh.position.z - playerPos.z;
      const nearHorse = Math.sqrt(dx * dx + dz * dz) < 2.5;

      if (this.ridingHorse) {
        this.player.mesh.position.y += 1.15;
        horseMesh.position.set(this.player.mesh.position.x, 0, this.player.mesh.position.z);
        horseMesh.rotation.y = this.player.mesh.rotation.y - Math.PI / 2;
        this.unicornPromptEl.textContent = 'Stiskni E pro sesednutí z koně';
        this.unicornPromptEl.style.display = 'block';
      } else if (nearHorse) {
        this.unicornPromptEl.textContent = 'Stiskni E pro nasednutí na koně';
        this.unicornPromptEl.style.display = 'block';
      }

      const eDown = InputManager.isKeyDown('KeyE');
      if (eDown && !this.eKeyWasDownHorse && (this.ridingHorse || nearHorse)) {
        if (this.ridingHorse) {
          this.ridingHorse = false;
          this.player.speedMultiplier = 1;
          this.player.body.linearDamping = 0.4;
          horseMesh.position.set(this.player.mesh.position.x + 2, 0, this.player.mesh.position.z);
          this.showNotification('Sesedl jsi z koně');
        } else {
          this.ridingHorse = true;
          this.player.speedMultiplier = this.boughtHorseSpeed;
          this.player.body.linearDamping = 0;
          this.showNotification('Nasedl jsi na koně!');
        }
      }
      this.eKeyWasDownHorse = eDown;
    }

    // Picking a leaflet up off the road
    if (this.wagonCutscene.papers.length > 0 && !this.flyerOverlay.isOpen) {
      this.updateFlyerPickup(playerPos);
    }

    // Behind-church trap → fall into the underground lab
    if (
      this.questManager.isActive('wazovsky-supplies') &&
      !this.undergroundLab.busy &&
      !this.interiorManager.isInside
    ) {
      const bdx = playerPos.x - BEHIND_CHURCH.x;
      const bdz = playerPos.z - BEHIND_CHURCH.z;
      if (Math.sqrt(bdx * bdx + bdz * bdz) < 2.5) {
        // Dismount any horse/unicorn before falling in
        this.ridingHorse = false;
        this.ridingUnicorn = false;
        this.combatSystem.ridingUnicorn = false;
        this.player.speedMultiplier = 1;
        this.player.body.linearDamping = 0.4;
        void this.undergroundLab.enter();
      }
    }
    this.undergroundLab.update(dt);

    // Interior manager (door interactions + stable horses)
    this.interiorManager.update(dt);

    // Night lantern follows the player
    this.dayNight.update(this.player.mesh.position, this.interiorManager.isInside);

    // Performance: keep the shadow box and the lit lamps around the player,
    // and turn detail down if the machine can't keep up
    followSun(this.sceneLights.sun, this.player.mesh.position);
    this.lightBudget.update(dt, this.player.mesh.position);
    this.qualityManager.update(dt);

    // Camera — adapt offset for interiors
    const offset = this.interiorManager.getCameraOffset();
    this.cameraSystem.offset.lerp(offset, 0.05);
    this.cameraSystem.update(dt);

    // Render
    this.engine.render();
  }

  /** Handle NPC interaction — show quest dialog or regular dialog */
  private handleNPCInteraction(npc: NPC): void {
    // Woken up in the middle of the night — no quests, just grumbling
    if (npc.isAsleep) {
      this.dialogBox.showSimple(npc, this.bedtime.sleepyLine(npc));
      return;
    }

    // Mary's story beat — must come before the generic delivery hand-in
    if (npc.def.id === 'townsfolk2' && this.questManager.isActive('mary-pendant')) {
      this.dialogBox.show(
        npc,
        'Konečně jsi tady. Tohle ti ale nemůžu říct na ulici — pojď ke mně domů.',
        [
          {
            label: 'Jít s Mary',
            action: () => {
              this.dialogBox.close();
              this.maryCutscene?.start();
            },
          },
          { label: 'Teď ne', action: () => this.dialogBox.close() },
        ]
      );
      return;
    }

    // Wazovský at night — the place to sleep until morning. Sits above the
    // generic hand-in, which would otherwise treat sleeping as a delivery.
    if (npc.def.id === 'wazovsky' && this.questManager.isActive('sleep-at-wazovsky')) {
      this.dialogBox.show(
        npc,
        'Klídek, kámo. Seno je měkký a je ho dost pro dva. Lehni si vedle a nech tu noc bejt.',
        [
          {
            label: 'Vyspat se',
            action: () => {
              this.dialogBox.close();
              void this.sleepUntilMorning();
            },
          },
          { label: 'Ještě ne', action: () => this.dialogBox.close() },
        ]
      );
      return;
    }

    // Check if this NPC can receive a delivery (priority — e.g. Wazovský's plants)
    const deliveryQuest = this.questManager.getDeliveryReady(npc.def.id);
    if (deliveryQuest) {
      const isWazovskyPlants = deliveryQuest.def.id === 'wazovsky-delivery';
      this.dialogBox.show(
        npc,
        isWazovskyPlants
          ? 'Ty jo, ty jsou nádherný! Tady máš, zasloužíš si to.'
          : 'Díky za doručení! Tady máš odměnu.',
        [
          {
            label: 'Odevzdat',
            action: () => {
              this.questManager.completeDelivery(npc.def.id);
              if (isWazovskyPlants) {
                // Wazovský points him at Mary before letting him go
                this.dialogBox.show(
                  npc,
                  'Hej... a zajdi ještě za Mary. Má něco dost podivnýho.',
                  [{ label: 'Dobře', action: () => this.dialogBox.close() }]
                );
              } else {
                this.dialogBox.close();
              }
            },
          },
        ]
      );
      return;
    }

    // Wazovský — sells the "kouzelná travička" (and kicks off his supply quest)
    if (npc.def.id === 'wazovsky') {
      if (this.trippy) {
        this.dialogBox.showSimple(npc, 'Klídek, kámo... teď si to užívej. Vrať se, až tě to pustí.');
        return;
      }
      const price = 500;
      this.dialogBox.show(
        npc,
        `Psst... mám kouzelnou travičku. Ale kvalita něco stojí — ${price} lilků. Jdeš do toho?`,
        [
          {
            label: `Koupit (${price} lilků)`,
            action: () => {
              this.dialogBox.close();
              if (this.wallet.spend(price)) {
                this.startTrip(20);
                this.startWazovskyQuest();
              } else {
                this.showNotification('Nemáš dost lilků!');
              }
            },
          },
          { label: 'Ne, díky', action: () => this.dialogBox.close() },
        ]
      );
      return;
    }

    // Check for available quests
    const available = this.questManager.getAvailableQuests(npc.def.id);
    if (available.length > 0) {
      const quest = available[0]; // offer first available
      this.dialogBox.show(npc, `${quest.description}\n\nOdměna: ${quest.reward.lilky} lilků`, [
        {
          label: 'Přijmout',
          action: () => {
            this.questManager.accept(quest.id);
            this.dialogBox.close();
          },
        },
        {
          label: 'Odmítnout',
          action: () => {
            this.dialogBox.close();
          },
        },
      ]);
      return;
    }

    // Shopkeeper opens shop
    if (npc.def.id === 'shopkeeper') {
      this.dialogBox.show(npc, 'Vítej v mém obchodě! Co si přeješ?', [
        { label: 'Otevřít obchod', action: () => { this.dialogBox.close(); this.shopUI.open(); } },
        { label: 'Nic, díky', action: () => this.dialogBox.close() },
      ]);
      return;
    }

    // Default dialog
    this.dialogBox.showSimple(npc, npc.def.dialog);
  }

  /**
   * Walk over a leaflet and press E to read it. Reading it clears the rest off
   * the road and sends Wazovský packing.
   */
  private updateFlyerPickup(playerPos: THREE.Vector3): void {
    let nearest: THREE.Group | null = null;
    let nearestDist = 2.2;
    for (const paper of this.wagonCutscene.papers) {
      const dx = paper.position.x - playerPos.x;
      const dz = paper.position.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = paper;
      }
    }

    if (!nearest) {
      this.flyerPromptEl.style.display = 'none';
      this.eKeyWasDownFlyer = InputManager.isKeyDown('KeyE');
      return;
    }

    this.flyerPromptEl.style.display = 'block';
    const eDown = InputManager.isKeyDown('KeyE');
    if (eDown && !this.eKeyWasDownFlyer) {
      this.flyerPromptEl.style.display = 'none';
      this.wagonCutscene.clearPapers();
      EventBus.emit('item:collected', { itemType: 'werewolf-flyer' });
      this.flyerOverlay.show(() => this.wazovskyLeaves());
    }
    this.eKeyWasDownFlyer = eDown;
  }

  /** After the warning sinks in, Wazovský packs up and bolts out of town. */
  private wazovskyLeaves(): void {
    const wazovsky = this.npcs.find((n) => n.def.id === 'wazovsky');
    if (!wazovsky) return;

    this.dialogBox.show(wazovsky, 'No nic... já už musím. Hodně štěstí, kámo.', [
      {
        label: 'Počkej!',
        action: () => {
          this.dialogBox.close();
          // Up off the hay and out of town, then gone
          wazovsky.mesh.rotation.x = 0;
          wazovsky.mesh.position.y = 0;
          wazovsky.sendHome(
            [new THREE.Vector3(0, 0, 4), new THREE.Vector3(0, 0, 48)],
            () => { wazovsky.fallAsleep(); wazovsky.mesh.visible = false; },
            7 // he's not strolling, he's getting out of town
          );
          this.showNotification('Wazovský utekl z města.');

          // Nobody's coming to help — stock up before dark
          this.questManager.accept('buy-supplies');
          setTimeout(() => {
            this.showNotification('Nakup si zásoby: aspoň 3 vody a 3 jídla.');
          }, 2600);
        },
      },
    ]);
  }

  /**
   * Sleep on Wazovský's haystack until dawn, then let the wagon come through.
   * The player wakes rested, the town wakes with him, and the warning arrives.
   */
  private async sleepUntilMorning(): Promise<void> {
    this.player.controlLocked = true;
    this.questManager.completeDelivery('wazovsky');

    const fade = document.getElementById('fade-overlay');
    fade?.classList.add('active');
    await this.wait(2200); // a night passes

    // Morning: daylight back, everyone spills out of their houses
    this.dayNight.setDay();
    this.bedtime.wakeEveryone();
    this.combatSystem.healFull();
    this.player.stamina = this.player.maxStamina;

    fade?.classList.remove('active');
    await this.wait(700);
    this.showNotification('Ráno. Vyspal ses.');

    await this.wait(1200);
    this.player.controlLocked = false;
    this.wagonCutscene.start();
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Start the magic-herb trip: refill everything and go rainbow for `seconds`. */
  private startTrip(seconds: number): void {
    // Refill all bars to 100%
    this.combatSystem.healFull();
    this.player.stamina = this.player.maxStamina;
    this.player.hunger = this.player.maxHunger;

    this.showNotification('🌈 Kouzelná travička! 🌈');

    // Rainbow visuals: hue-cycle the whole scene + rainbow overlay
    this.trippy = true;
    this.tripTimer = seconds;
    document.getElementById('game-canvas')?.classList.add('trippy');
    this.tripOverlayEl.style.display = 'block';
  }

  /** After buying the herb: clear other quests and start Wazovský's supply quest. */
  private startWazovskyQuest(): void {
    if (
      this.questManager.isActive('wazovsky-supplies') ||
      this.questManager.isCompleted('wazovsky-supplies')
    ) {
      return;
    }
    this.questManager.clearActive(); // "ostatní se vynulují"
    this.questManager.accept('wazovsky-supplies');
    setTimeout(() => {
      this.showNotification('Wazovský: Kámo, došly mi zásoby! Zajdi za kostel.');
    }, 1600);
  }

  /** Save current game state */
  saveGame(): void {
    const data: SaveData = {
      version: 1,
      timestamp: Date.now(),
      player: {
        x: this.player.body.position.x,
        y: this.player.body.position.y,
        z: this.player.body.position.z,
        hp: this.combatSystem.playerHp,
        maxHp: this.combatSystem.playerMaxHp,
      },
      wallet: this.wallet.toSaveData(),
      quests: this.questManager.toSaveData(),
      shop: this.shop.toSaveData(),
      unlockedWeapons: [...this.combatSystem.unlockedWeapons],
      currentWeapon: this.combatSystem.currentWeapon,
      collectedItems: this.collectibles.filter((c) => c.collected).map((c) => c.def.id),
      story: {
        pendant: this.player.hasPendant,
        night: this.dayNight.isNight,
      },
    };
    SaveManager.save(data);
  }

  /** Load game from save data */
  loadGame(data: SaveData): void {
    this.player.body.position.set(data.player.x, data.player.y, data.player.z);
    this.player.body.velocity.set(0, 0, 0);
    this.combatSystem.playerHp = data.player.hp;
    this.combatSystem.playerMaxHp = data.player.maxHp;
    this.wallet.loadSaveData(data.wallet);
    this.questManager.loadSaveData(data.quests);
    this.shop.loadSaveData(data.shop);

    for (const wt of data.unlockedWeapons) {
      this.combatSystem.unlockWeapon(wt as any);
    }
    this.combatSystem.switchWeapon(data.currentWeapon as any);

    for (const c of this.collectibles) {
      if (data.collectedItems.includes(c.def.id)) {
        c.collected = true;
        c.mesh.visible = false;
      }
    }

    // Mary story state
    if (data.story?.pendant) this.player.showPendant();
    if (data.story?.night) {
      this.dayNight.setNight();
      this.bedtime.startInstantly(this.npcs); // the walk home already happened
    } else {
      this.dayNight.setDay();
    }
    // Saved inside Mary's house right after the pendant? Night still owes us.
    this.nightPending = !!data.story?.pendant && !data.story?.night;
  }

  /** Show a temporary notification on screen */
  private processChat(text: string): void {
    if (!text) return;
    const match = text.match(/^\/money\s+(\d+)$/);
    if (match) {
      const amount = parseInt(match[1], 10);
      this.wallet.add(amount);
      this.showNotification(`+${amount} lilků`);
    } else {
      this.showNotification('Neznámý příkaz');
    }
  }

  private showNotification(text: string): void {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.8);
      color: #FFD700;
      padding: 12px 28px;
      border: 2px solid #DAA520;
      border-radius: 8px;
      font-size: 18px;
      font-weight: bold;
      z-index: 50;
      text-align: center;
      pointer-events: none;
      animation: fadeNotif 2.5s forwards;
    `;
    el.textContent = text;
    document.body.appendChild(el);

    // Add animation if not already defined
    if (!document.getElementById('notif-style')) {
      const style = document.createElement('style');
      style.id = 'notif-style';
      style.textContent = `
        @keyframes fadeNotif {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
          15% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          75% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -70%); }
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(() => el.remove(), 2500);
  }
}
