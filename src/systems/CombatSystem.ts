import * as THREE from 'three';
import { InputManager } from '../core/InputManager';
import { EventBus } from '../core/EventBus';
import { Player } from '../entities/Player';
import { Bandit } from '../entities/Bandit';
import { Projectile } from '../entities/Projectile';

export type WeaponType = 'fists' | 'lasso' | 'revolver' | 'rifle';

interface WeaponDef {
  name: string;
  type: 'melee' | 'ranged';
  damage: number;
  range: number;
  cooldown: number;
  ammo: number; // 0 = unlimited (melee)
  reloadTime: number;
}

const WEAPONS: Record<WeaponType, WeaponDef> = {
  fists: { name: 'Pěsti', type: 'melee', damage: 10, range: 1.5, cooldown: 0.5, ammo: 0, reloadTime: 0 },
  lasso: { name: 'Laso', type: 'melee', damage: 5, range: 4, cooldown: 1.5, ammo: 0, reloadTime: 0 },
  revolver: { name: 'Revolver', type: 'ranged', damage: 25, range: 30, cooldown: 0.8, ammo: 6, reloadTime: 2 },
  rifle: { name: 'Puška', type: 'ranged', damage: 40, range: 50, cooldown: 1.5, ammo: 1, reloadTime: 3 },
};

const PROJECTILE_HIT_DIST = 1;

export class CombatSystem {
  private player: Player;
  private bandits: Bandit[];
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  projectiles: Projectile[] = [];

  currentWeapon: WeaponType = 'fists';
  unlockedWeapons = new Set<WeaponType>(['fists']);
  private cooldownTimer = 0;
  private currentAmmo = 0;
  private reloading = false;
  private reloadTimer = 0;

  playerHp = 100;
  playerMaxHp = 100;
  private dead = false;

  private weaponHud: HTMLElement | null;
  private healthFill: HTMLElement | null;
  private healthText: HTMLElement | null;

  constructor(
    player: Player,
    bandits: Bandit[],
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera
  ) {
    this.player = player;
    this.bandits = bandits;
    this.scene = scene;
    this.camera = camera;

    this.weaponHud = document.getElementById('weapon-name');
    this.healthFill = document.getElementById('health-bar-fill');
    this.healthText = document.getElementById('health-text');

    this.currentAmmo = WEAPONS[this.currentWeapon].ammo;

    // Listen for bandit attacks
    EventBus.on('combat:bandit-attack', (data: { damage: number; banditId: string }) => {
      this.takeDamage(data.damage);
      // Show slash effect at the attacking bandit
      const attacker = this.bandits.find((b) => b.id === data.banditId);
      if (attacker) {
        this.spawnBanditAttackEffect(attacker.mesh.position, this.player.mesh.position);
      }
    });

    // Weapon switching with number keys
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Digit1') this.switchWeapon('fists');
      if (e.code === 'Digit2' && this.unlockedWeapons.has('lasso')) this.switchWeapon('lasso');
      if (e.code === 'Digit3' && this.unlockedWeapons.has('revolver')) this.switchWeapon('revolver');
      if (e.code === 'Digit4' && this.unlockedWeapons.has('rifle')) this.switchWeapon('rifle');
      if (e.code === 'KeyR') this.startReload();
    });

    this.updateHUD();
  }

  update(dt: number): void {
    this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);

    // Reload
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.currentAmmo = WEAPONS[this.currentWeapon].ammo;
        this.updateHUD();
      }
    }

    // Left click attack
    if (InputManager.leftClick && this.cooldownTimer <= 0 && !this.reloading) {
      this.attack();
    }

    // Update projectiles
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      proj.update(dt);

      // Check collision with bandits
      for (const bandit of this.bandits) {
        if (bandit.state === 'dead') continue;
        const dx = proj.mesh.position.x - bandit.mesh.position.x;
        const dz = proj.mesh.position.z - bandit.mesh.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < PROJECTILE_HIT_DIST) {
          bandit.takeDamage(proj.damage);
          proj.active = false;
          proj.mesh.visible = false;
          this.spawnDamageNumber(bandit.mesh.position, proj.damage);
          break;
        }
      }
    }

    // Cleanup dead projectiles
    this.projectiles = this.projectiles.filter((p) => {
      if (!p.active) {
        this.scene.remove(p.mesh);
        return false;
      }
      return true;
    });

    this.updateHUD();
  }

  private attack(): void {
    const weapon = WEAPONS[this.currentWeapon];
    this.cooldownTimer = weapon.cooldown;

    if (weapon.type === 'melee') {
      this.meleeAttack(weapon);
    } else {
      if (this.currentAmmo <= 0) {
        this.startReload();
        return;
      }
      this.rangedAttack(weapon);
      this.currentAmmo--;
    }
  }

  private getAimForward(): THREE.Vector3 {
    if (InputManager.isTouchDevice) {
      const aim = InputManager.aimDirection;
      if (aim.x !== 0 || aim.y !== 0) {
        return new THREE.Vector3(aim.x, 0, aim.y).normalize();
      }
      // Fallback: use player facing direction
      const rot = this.player.mesh.rotation.y;
      return new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
    }
    // Mouse-based aiming
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(InputManager.mousePosition, this.camera);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, target);
    const playerPos = this.player.mesh.position;
    return new THREE.Vector3(target.x - playerPos.x, 0, target.z - playerPos.z).normalize();
  }

  private meleeAttack(weapon: WeaponDef): void {
    const playerPos = this.player.mesh.position;

    const forward = this.getAimForward();

    // Rotate player to face mouse direction
    this.player.mesh.rotation.y = Math.atan2(forward.x, forward.z);

    // Spawn swing arc effect
    this.spawnSwingArc(playerPos, this.player.mesh.rotation.y, weapon.range);

    for (const bandit of this.bandits) {
      if (bandit.state === 'dead') continue;
      const dx = bandit.mesh.position.x - playerPos.x;
      const dz = bandit.mesh.position.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > weapon.range) continue;

      // Check if within ~120 degree arc toward mouse
      const dirToBandit = new THREE.Vector3(dx, 0, dz).normalize();
      const dot = forward.dot(dirToBandit);
      if (dot > 0.3) {
        bandit.takeDamage(weapon.damage);
        this.spawnDamageNumber(bandit.mesh.position, weapon.damage);
      }
    }
  }

  private rangedAttack(weapon: WeaponDef): void {
    const playerPos = this.player.mesh.position.clone();
    const direction = this.getAimForward();

    const projectile = new Projectile(playerPos, direction, weapon.damage);
    this.projectiles.push(projectile);
    this.scene.add(projectile.mesh);

    // Rotate player to face aim direction
    this.player.mesh.rotation.y = Math.atan2(direction.x, direction.z);

    // Muzzle flash
    this.spawnMuzzleFlash(playerPos, direction);
  }

  private startReload(): void {
    const weapon = WEAPONS[this.currentWeapon];
    if (weapon.ammo === 0) return; // melee
    if (this.currentAmmo >= weapon.ammo) return; // full
    this.reloading = true;
    this.reloadTimer = weapon.reloadTime;
  }

  switchWeapon(type: WeaponType): void {
    if (!this.unlockedWeapons.has(type)) return;
    this.currentWeapon = type;
    this.currentAmmo = WEAPONS[type].ammo;
    this.reloading = false;
    this.cooldownTimer = 0;
    this.updateHUD();
  }

  unlockWeapon(type: WeaponType): void {
    this.unlockedWeapons.add(type);
  }

  private takeDamage(amount: number): void {
    if (this.dead) return;
    this.playerHp = Math.max(0, this.playerHp - amount);
    this.updateHUD();
    this.flashDamageScreen();

    if (this.playerHp <= 0) {
      this.playerDeath();
    }
  }

  private playerDeath(): void {
    this.dead = true;
    EventBus.emit('player:died');
  }

  /** Reset player to full health at spawn point */
  respawn(): void {
    this.dead = false;
    this.playerHp = this.playerMaxHp;
    this.player.body.position.set(0, 2, 0);
    this.player.body.velocity.set(0, 0, 0);
    this.updateHUD();
    EventBus.emit('player:respawned');
  }

  private updateHUD(): void {
    const weapon = WEAPONS[this.currentWeapon];
    if (this.weaponHud) {
      let text = weapon.name;
      if (weapon.ammo > 0) {
        text += this.reloading ? ' (Nabíjení...)' : ` ${this.currentAmmo}/${weapon.ammo}`;
      }
      this.weaponHud.textContent = text;
    }

    if (this.healthFill) {
      const pct = (this.playerHp / this.playerMaxHp) * 100;
      this.healthFill.style.width = `${pct}%`;
    }
    if (this.healthText) {
      this.healthText.textContent = `${this.playerHp} / ${this.playerMaxHp}`;
    }
  }

  private spawnDamageNumber(pos: THREE.Vector3, damage: number): void {
    const el = document.createElement('div');
    el.textContent = `-${damage}`;
    el.style.cssText = `
      position: fixed;
      color: #ff4444;
      font-size: 22px;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      z-index: 40;
      pointer-events: none;
      animation: floatUp 1s forwards;
    `;

    // Project 3D position to screen
    const screenPos = pos.clone();
    screenPos.y += 2;
    screenPos.project(this.camera);
    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    // Add animation style if not exists
    if (!document.getElementById('damage-style')) {
      const style = document.createElement('style');
      style.id = 'damage-style';
      style.textContent = `
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-60px) scale(1.3); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  /** Spawn a visible arc/sweep in front of the player for melee attacks */
  private spawnSwingArc(origin: THREE.Vector3, rotationY: number, range: number): void {
    const arcGeo = new THREE.RingGeometry(0.3, range, 16, 1, -Math.PI / 3, (Math.PI * 2) / 3);
    const arcMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const arc = new THREE.Mesh(arcGeo, arcMat);
    arc.position.set(origin.x, 0.8, origin.z);
    arc.rotation.x = -Math.PI / 2;
    arc.rotation.z = -(rotationY + Math.PI / 2);
    this.scene.add(arc);

    const start = performance.now();
    const animate = () => {
      const elapsed = performance.now() - start;
      const t = elapsed / 200; // 200ms duration
      if (t >= 1) {
        this.scene.remove(arc);
        arcGeo.dispose();
        arcMat.dispose();
        return;
      }
      arcMat.opacity = 0.6 * (1 - t);
      arc.scale.setScalar(1 + t * 0.3);
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /** Spawn a bright flash at the muzzle position for ranged attacks */
  private spawnMuzzleFlash(origin: THREE.Vector3, direction: THREE.Vector3): void {
    const flashGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 1,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.set(
      origin.x + direction.x * 0.6,
      0.85,
      origin.z + direction.z * 0.6
    );
    this.scene.add(flash);

    // Point light for flash illumination
    const light = new THREE.PointLight(0xff8800, 3, 6);
    light.position.copy(flash.position);
    this.scene.add(light);

    const start = performance.now();
    const animate = () => {
      const elapsed = performance.now() - start;
      const t = elapsed / 120; // 120ms duration
      if (t >= 1) {
        this.scene.remove(flash);
        this.scene.remove(light);
        flashGeo.dispose();
        flashMat.dispose();
        light.dispose();
        return;
      }
      flashMat.opacity = 1 - t;
      flash.scale.setScalar(1 + t * 2);
      light.intensity = 3 * (1 - t);
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /** Spawn a slash effect from a bandit toward the player */
  private spawnBanditAttackEffect(banditPos: THREE.Vector3, playerPos: THREE.Vector3): void {
    const dx = playerPos.x - banditPos.x;
    const dz = playerPos.z - banditPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist === 0) return;

    // Slash line from bandit toward player
    const midX = banditPos.x + (dx / dist) * 1;
    const midZ = banditPos.z + (dz / dist) * 1;

    const slashGeo = new THREE.PlaneGeometry(0.15, 1.2);
    const slashMat = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const slash = new THREE.Mesh(slashGeo, slashMat);
    slash.position.set(midX, 1, midZ);
    slash.rotation.y = Math.atan2(dx, dz);
    slash.rotation.z = Math.PI / 6; // slight diagonal tilt
    this.scene.add(slash);

    const start = performance.now();
    const animate = () => {
      const elapsed = performance.now() - start;
      const t = elapsed / 250;
      if (t >= 1) {
        this.scene.remove(slash);
        slashGeo.dispose();
        slashMat.dispose();
        return;
      }
      slashMat.opacity = 0.8 * (1 - t);
      slash.scale.y = 1 + t * 0.5;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /** Flash a red overlay on screen when the player takes damage */
  private flashDamageScreen(): void {
    let overlay = document.getElementById('damage-flash');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'damage-flash';
      overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        pointer-events: none;
        z-index: 60;
        background: radial-gradient(ellipse at center, transparent 40%, rgba(180,0,0,0.5) 100%);
        opacity: 0;
        transition: opacity 0.08s ease-in;
      `;
      document.body.appendChild(overlay);
    }
    overlay.style.opacity = '1';
    setTimeout(() => {
      overlay!.style.transition = 'opacity 0.35s ease-out';
      overlay!.style.opacity = '0';
      setTimeout(() => {
        overlay!.style.transition = 'opacity 0.08s ease-in';
      }, 350);
    }, 80);
  }
}
