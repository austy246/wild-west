import * as THREE from 'three';

/**
 * Stops tiny props from casting shadows.
 *
 * The shadow pass re-draws every casting mesh a second time, and the village is
 * full of barrels, fence rails, bottles and cutlery whose shadows are a few
 * pixels at most. Rather than hunting down hundreds of `castShadow = true`
 * lines across the building factory, we measure each mesh once at startup and
 * drop the ones too small to matter.
 */

/** Meshes whose bounding sphere is smaller than this stop casting */
const MIN_CASTER_RADIUS = 0.55;

export function pruneSmallShadowCasters(scene: THREE.Scene): number {
  let pruned = 0;

  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.castShadow) return;
    // The player and NPCs keep their shadows whatever their size
    if (mesh.userData.keepShadow) return;

    const geo = mesh.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const radius = geo.boundingSphere?.radius ?? 0;

    // Account for the mesh's own scale
    const scale = Math.max(
      Math.abs(mesh.scale.x),
      Math.abs(mesh.scale.y),
      Math.abs(mesh.scale.z)
    );

    if (radius * scale < MIN_CASTER_RADIUS) {
      mesh.castShadow = false;
      pruned++;
    }
  });

  return pruned;
}
