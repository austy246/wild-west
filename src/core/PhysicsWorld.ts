import * as CANNON from 'cannon-es';
import { GRAVITY, PHYSICS_TIMESTEP } from '../utils/constants';

export class PhysicsWorld {
  readonly world: CANNON.World;

  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, GRAVITY, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();

    // Ground physics body
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(groundBody);
  }

  step(): void {
    this.world.step(PHYSICS_TIMESTEP);
  }
}
