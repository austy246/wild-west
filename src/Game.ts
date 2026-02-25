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
import { DialogBox } from './ui/DialogBox';
import { QuestLog } from './ui/QuestLog';
import { QuestManager } from './quest/QuestManager';
import { Wallet } from './economy/Wallet';
import { Shop } from './economy/Shop';
import { ShopUI } from './ui/ShopUI';
import { PauseMenu } from './ui/PauseMenu';
import { GameOverScreen } from './ui/GameOverScreen';
import { TouchControls } from './ui/TouchControls';
import { SaveManager, SaveData } from './core/SaveManager';
import { createTerrain } from './world/Terrain';
import { createLighting } from './world/Lighting';
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

  private physicsAccumulator = 0;
  private autoSaveTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    // Core
    this.engine = new Engine(canvas);
    this.physics = new PhysicsWorld();

    // World
    createSkybox(this.engine.scene);
    createLighting(this.engine.scene);
    this.engine.scene.add(createTerrain());

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

    // Interior Manager
    this.interiorManager = new InteriorManager(
      this.village,
      this.player.body,
      this.player.mesh,
      this.engine.scene
    );

    // Combat
    this.combatSystem = new CombatSystem(
      this.player,
      this.bandits,
      this.engine.scene,
      this.engine.camera
    );

    // Camera
    this.cameraSystem = new CameraSystem(this.engine.camera, this.player.mesh);

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
        this.showNotification(`Odemčena zbraň!`);
      }
    });

    // Quest completion notification
    EventBus.on('quest:completed', (data: { name: string; reward: { lilky: number } }) => {
      this.showNotification(`Quest dokončen: ${data.name} (+${data.reward.lilky} lilků)`);
    });

    // Auto-save on window close
    window.addEventListener('beforeunload', () => this.saveGame());

    // Show HUD
    document.getElementById('hud')?.classList.remove('hidden');
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

    // Auto-save every 60 seconds
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= 60) {
      this.autoSaveTimer = 0;
      this.saveGame();
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

    // Interaction (right-click on NPCs)
    this.interactionSystem.update();

    // Interior manager (door interactions)
    this.interiorManager.update();

    // Camera — adapt offset for interiors
    const offset = this.interiorManager.getCameraOffset();
    this.cameraSystem.offset.lerp(offset, 0.05);
    this.cameraSystem.update(dt);

    // Render
    this.engine.render();
  }

  /** Handle NPC interaction — show quest dialog or regular dialog */
  private handleNPCInteraction(npc: NPC): void {
    // Check if this NPC can receive a delivery
    const deliveryQuest = this.questManager.getDeliveryReady(npc.def.id);
    if (deliveryQuest) {
      this.dialogBox.show(npc, `Díky za doručení! Tady máš odměnu.`, [
        {
          label: 'Odevzdat',
          action: () => {
            this.questManager.completeDelivery(npc.def.id);
            this.dialogBox.close();
          },
        },
      ]);
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
  }

  /** Show a temporary notification on screen */
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
