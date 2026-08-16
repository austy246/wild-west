import * as THREE from 'three';
import { Net, PlayerState } from './Net';

/**
 * The other players, drawn in your world.
 *
 * Their positions arrive a few times a second, not every frame, so each one is
 * eased toward the last position we heard about instead of being snapped to
 * it — otherwise everyone else jitters around like a bad connection looks.
 */

/** How quickly a remote player catches up to where we last heard they were */
const SMOOTHING = 8;

interface Remote {
  group: THREE.Group;
  target: THREE.Vector3;
  targetRotY: number;
}

export class RemotePlayers {
  private scene: THREE.Scene;
  private net: Net;
  private remotes = new Map<string, Remote>();

  constructor(scene: THREE.Scene, net: Net) {
    this.scene = scene;
    this.net = net;

    this.net.onPeerLeft = (id) => this.remove(id);
  }

  update(dt: number): void {
    // Add or update from whatever the network last told us
    for (const state of this.net.others.values()) {
      let remote = this.remotes.get(state.id);
      if (!remote) {
        remote = {
          group: buildCowboy(state.color, state.name),
          target: new THREE.Vector3(state.x, state.y, state.z),
          targetRotY: state.rotY,
        };
        remote.group.position.copy(remote.target);
        this.scene.add(remote.group);
        this.remotes.set(state.id, remote);
      }
      remote.target.set(state.x, state.mounted ? state.y + 1.15 : state.y, state.z);
      remote.targetRotY = state.rotY;
    }

    // Drop anyone the network has forgotten
    for (const id of [...this.remotes.keys()]) {
      if (!this.net.others.has(id)) this.remove(id);
    }

    // Ease toward the last known position
    const t = Math.min(1, SMOOTHING * dt);
    for (const remote of this.remotes.values()) {
      remote.group.position.lerp(remote.target, t);

      // Shortest way round, so they don't spin the long way to turn
      let delta = remote.targetRotY - remote.group.rotation.y;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      remote.group.rotation.y += delta * t;
    }
  }

  private remove(id: string): void {
    const remote = this.remotes.get(id);
    if (!remote) return;
    this.scene.remove(remote.group);
    this.remotes.delete(id);
  }

  clear(): void {
    for (const id of [...this.remotes.keys()]) this.remove(id);
  }
}

/**
 * A simplified cowboy — same silhouette as the player so they read as the same
 * kind of character, but far fewer parts, since there can be two of them and
 * they're never the centre of attention.
 */
function buildCowboy(color: number, name: string): THREE.Group {
  const group = new THREE.Group();

  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf5c6a0, roughness: 0.7 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x3b5998, roughness: 0.75 });
  const hat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.6 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.3, 6, 12), shirt);
  torso.position.y = 0.98;
  torso.castShadow = true;
  torso.userData.keepShadow = true;
  group.add(torso);

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.2, 4, 8), jeans);
    leg.position.set(side * 0.16, 0.48, 0);
    group.add(leg);

    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.2, 4, 8), shirt);
    arm.position.set(side * 0.36, 0.95, 0);
    arm.rotation.z = side * Math.PI / 10;
    group.add(arm);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), skin);
  head.position.y = 1.42;
  head.castShadow = true;
  head.userData.keepShadow = true;
  group.add(head);

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 14), hat);
  brim.position.y = 1.58;
  group.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.24, 12), hat);
  crown.position.y = 1.71;
  group.add(crown);

  group.add(nameLabel(name));
  return group;
}

/** Floating name so you know who you're looking at */
function nameLabel(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText(name, 128, 42);
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText(name, 128, 42);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })
  );
  sprite.scale.set(2.4, 0.6, 1);
  sprite.position.y = 2.2;
  return sprite;
}
