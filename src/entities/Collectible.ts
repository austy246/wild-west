import * as THREE from 'three';
import { EventBus } from '../core/EventBus';

export interface CollectibleDef {
  id: string;
  itemType: string; // 'gold-nugget', 'herb', 'wood', 'save-elixir'
  x: number;
  z: number;
}

const ITEM_COLORS: Record<string, number> = {
  'gold-nugget': 0xffd700,
  'herb': 0x4caf50,
  'wood': 0x8d6e63,
};

const PICKUP_DISTANCE = 1.5;

export class Collectible {
  readonly def: CollectibleDef;
  readonly mesh: THREE.Group;
  collected = false;

  constructor(def: CollectibleDef) {
    this.def = def;
    this.mesh = this.createMesh();
    this.mesh.position.set(def.x, 0.5, def.z);
  }

  private createMesh(): THREE.Group {
    const group = new THREE.Group();

    if (this.def.itemType === 'herb') {
      return this.createHerbMesh(group);
    }

    if (this.def.itemType === 'gold-nugget') {
      return this.createGoldNuggetMesh(group);
    }

    if (this.def.itemType === 'save-elixir') {
      return this.createSaveElixirMesh(group);
    }

    const color = ITEM_COLORS[this.def.itemType] ?? 0xffffff;

    // Glowing sphere
    const geo = new THREE.SphereGeometry(0.25, 10, 10);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
      roughness: 0.3,
    });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.castShadow = true;
    group.add(sphere);

    // Small point light for glow effect
    const light = new THREE.PointLight(color, 0.5, 3);
    light.position.y = 0.3;
    group.add(light);

    return group;
  }

  private createGoldNuggetMesh(group: THREE.Group): THREE.Group {
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xdaa520,
      emissiveIntensity: 0.2,
      roughness: 0.35,
      metalness: 0.9,
    });

    // Main boulder shape — squashed, irregular dodecahedron
    const mainGeo = new THREE.DodecahedronGeometry(0.22, 0);
    const main = new THREE.Mesh(mainGeo, goldMat);
    main.scale.set(1.2, 0.7, 1);
    main.rotation.set(0.3, 0.5, 0.2);
    main.castShadow = true;
    group.add(main);

    // Smaller bump on top
    const bumpGeo = new THREE.DodecahedronGeometry(0.12, 0);
    const bump = new THREE.Mesh(bumpGeo, goldMat);
    bump.position.set(0.08, 0.12, 0.05);
    bump.scale.set(1, 0.6, 0.8);
    bump.rotation.set(0.8, 1.2, 0);
    bump.castShadow = true;
    group.add(bump);

    // Warm golden glow
    const light = new THREE.PointLight(0xffd700, 0.4, 2.5);
    light.position.y = 0.2;
    group.add(light);

    return group;
  }

  private createSaveElixirMesh(group: THREE.Group): THREE.Group {
    // Bottle body
    const bottleMat = new THREE.MeshStandardMaterial({
      color: 0x6a0dad,
      emissive: 0x9b30ff,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.75,
      roughness: 0.1,
      metalness: 0.3,
    });
    const bottleGeo = new THREE.CylinderGeometry(0.1, 0.13, 0.35, 8);
    const bottle = new THREE.Mesh(bottleGeo, bottleMat);
    bottle.position.y = 0.18;
    bottle.castShadow = true;
    group.add(bottle);

    // Bottle neck
    const neckGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.12, 8);
    const neck = new THREE.Mesh(neckGeo, bottleMat);
    neck.position.y = 0.41;
    group.add(neck);

    // Cork
    const corkMat = new THREE.MeshStandardMaterial({ color: 0x8b6914 });
    const corkGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.06, 6);
    const cork = new THREE.Mesh(corkGeo, corkMat);
    cork.position.y = 0.5;
    group.add(cork);

    // Purple glow
    const light = new THREE.PointLight(0x9b30ff, 0.6, 3);
    light.position.y = 0.25;
    group.add(light);

    return group;
  }

  private createHerbMesh(group: THREE.Group): THREE.Group {
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x4caf50,
      emissive: 0x4caf50,
      emissiveIntensity: 0.15,
    });
    const flowerMat = new THREE.MeshStandardMaterial({
      color: 0xffeb3b,
      emissive: 0xffeb3b,
      emissiveIntensity: 0.3,
    });

    // Main stem
    const stemGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.4, 5);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.2;
    group.add(stem);

    // Leaves (small flat ellipses around the stem)
    const leafGeo = new THREE.SphereGeometry(0.12, 6, 4);
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      const angle = (i / 4) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 0.1, 0.12 + i * 0.05, Math.sin(angle) * 0.1);
      leaf.scale.set(1, 0.3, 0.7);
      leaf.rotation.y = angle;
      leaf.rotation.z = 0.4;
      group.add(leaf);
    }

    // Small flower on top
    const flowerGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const flower = new THREE.Mesh(flowerGeo, flowerMat);
    flower.position.y = 0.42;
    group.add(flower);

    // Subtle green glow
    const light = new THREE.PointLight(0x4caf50, 0.3, 2);
    light.position.y = 0.3;
    group.add(light);

    return group;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (this.collected) return;

    // Floating animation
    this.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.003) * 0.15;
    this.mesh.rotation.y += dt * 2;

    // Check pickup
    const dx = this.mesh.position.x - playerPos.x;
    const dz = this.mesh.position.z - playerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < PICKUP_DISTANCE) {
      this.collected = true;
      this.mesh.visible = false;
      EventBus.emit('item:collected', { itemType: this.def.itemType, id: this.def.id });
    }
  }
}

/** Spawn positions for collectibles in the village area */
export const COLLECTIBLE_SPAWNS: CollectibleDef[] = [
  // Gold nuggets (5)
  { id: 'nugget-1', itemType: 'gold-nugget', x: -20, z: 5 },
  { id: 'nugget-2', itemType: 'gold-nugget', x: 15, z: -18 },
  { id: 'nugget-3', itemType: 'gold-nugget', x: -25, z: -20 },
  { id: 'nugget-4', itemType: 'gold-nugget', x: 22, z: 28 },
  { id: 'nugget-5', itemType: 'gold-nugget', x: -8, z: -30 },
  // Herbs (5)
  { id: 'herb-1', itemType: 'herb', x: -18, z: 15 },
  { id: 'herb-2', itemType: 'herb', x: 20, z: -5 },
  { id: 'herb-3', itemType: 'herb', x: -30, z: -10 },
  { id: 'herb-4', itemType: 'herb', x: 12, z: 30 },
  { id: 'herb-5', itemType: 'herb', x: -15, z: -28 },
  // Save elixirs (3)
  { id: 'elixir-1', itemType: 'save-elixir', x: 5, z: 20 },
  { id: 'elixir-2', itemType: 'save-elixir', x: -20, z: -15 },
  { id: 'elixir-3', itemType: 'save-elixir', x: 25, z: -5 },
  // Wood (6)
  { id: 'wood-1', itemType: 'wood', x: -22, z: 0 },
  { id: 'wood-2', itemType: 'wood', x: 18, z: 15 },
  { id: 'wood-3', itemType: 'wood', x: -12, z: 28 },
  { id: 'wood-4', itemType: 'wood', x: 25, z: -12 },
  { id: 'wood-5', itemType: 'wood', x: -28, z: 25 },
  { id: 'wood-6', itemType: 'wood', x: 8, z: -28 },
];
