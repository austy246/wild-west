import * as THREE from 'three';

const PROJECTILE_SPEED = 40;
const MAX_LIFETIME = 2; // seconds

export class Projectile {
  readonly mesh: THREE.Mesh;
  private direction: THREE.Vector3;
  private lifetime = 0;
  active = true;
  damage: number;

  constructor(origin: THREE.Vector3, direction: THREE.Vector3, damage: number) {
    this.damage = damage;
    this.direction = direction.clone().normalize();

    const geo = new THREE.SphereGeometry(0.08, 6, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xff8800,
      emissiveIntensity: 0.8,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(origin);
    this.mesh.position.y = 0.8; // fire from chest height
  }

  update(dt: number): void {
    if (!this.active) return;

    this.mesh.position.x += this.direction.x * PROJECTILE_SPEED * dt;
    this.mesh.position.z += this.direction.z * PROJECTILE_SPEED * dt;

    this.lifetime += dt;
    if (this.lifetime > MAX_LIFETIME) {
      this.active = false;
      this.mesh.visible = false;
    }
  }
}
