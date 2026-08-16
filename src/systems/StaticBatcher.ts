import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Collapses the village's hundreds of little static meshes into a handful of
 * big ones.
 *
 * The town is built from individually created boxes and cylinders — every
 * fence rail, barrel and roof shingle is its own mesh with its own material.
 * Each one costs a draw call every frame, and draw calls are paid on the CPU,
 * which is exactly what runs out first on a slow machine. The triangles
 * themselves are cheap (~30k for the whole map); it's the per-object overhead
 * that hurts.
 *
 * Two passes:
 *   1. `dedupeMaterials` — 1500-odd material instances describing ~180 actual
 *      looks become ~180 shared ones.
 *   2. `mergeStaticDescendants` — meshes sharing a material are baked into one
 *      geometry, in place, so the group they belonged to can still be hidden
 *      as a whole (which is how entering a building works).
 *
 * Anything that moves must be flagged `userData.dynamic`, and anything hidden
 * at the time (stashed interiors) is left untouched.
 */

/** Build a key describing what a material actually looks like */
function materialKey(m: THREE.Material): string {
  const s = m as THREE.MeshStandardMaterial;
  return [
    m.type,
    s.color?.getHex(),
    s.roughness,
    s.metalness,
    s.emissive?.getHex(),
    s.emissiveIntensity,
    s.map?.uuid ?? '',
    m.transparent,
    m.opacity,
    m.side,
    s.fog,
    (s as THREE.Material & { flatShading?: boolean }).flatShading,
  ].join('|');
}

/**
 * Replace duplicate material instances with a single shared one. Fewer
 * distinct materials means fewer shader/uniform switches per frame.
 */
export function dedupeMaterials(root: THREE.Object3D): { before: number; after: number } {
  const canonical = new Map<string, THREE.Material>();
  let before = 0;

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material || Array.isArray(mesh.material)) return;
    before++;
    const key = materialKey(mesh.material);
    const existing = canonical.get(key);
    if (existing) {
      if (existing !== mesh.material) mesh.material.dispose();
      mesh.material = existing;
    } else {
      canonical.set(key, mesh.material);
    }
  });

  return { before, after: canonical.size };
}

interface MergeOptions {
  /** Subtrees to leave alone entirely (e.g. building groups merged separately) */
  skip?: Set<THREE.Object3D>;
}

/**
 * Merge the static mesh descendants of `group` into one mesh per material,
 * parented to `group` itself so its transform and visibility still apply.
 */
export function mergeStaticDescendants(
  group: THREE.Object3D,
  options: MergeOptions = {}
): { merged: number; into: number } {
  const skip = options.skip ?? new Set<THREE.Object3D>();

  group.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(group.matrixWorld).invert();

  // Bucket candidates by everything that has to match for a merge to be valid
  const buckets = new Map<string, { material: THREE.Material; meshes: THREE.Mesh[] }>();

  const walk = (o: THREE.Object3D): void => {
    if (o !== group && skip.has(o)) return;
    if (o.userData.dynamic) return;      // moves every frame
    if (o.visible === false) return;     // stashed interiors, hidden props
    if (o.userData.noMerge) return;

    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry?.isBufferGeometry && !Array.isArray(mesh.material)) {
      const key = `${materialKey(mesh.material)}|${mesh.castShadow}|${mesh.receiveShadow}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { material: mesh.material, meshes: [] };
        buckets.set(key, bucket);
      }
      bucket.meshes.push(mesh);
    }

    // Copy the child list — we mutate the tree as we go
    for (const child of [...o.children]) walk(child);
  };
  walk(group);

  let merged = 0;
  let into = 0;

  for (const bucket of buckets.values()) {
    if (bucket.meshes.length < 2) continue;

    const geometries: THREE.BufferGeometry[] = [];
    for (const mesh of bucket.meshes) {
      // Primitives disagree on whether they're indexed; merging needs one or
      // the other for all of them, so flatten everything to non-indexed.
      const source = mesh.geometry;
      const geo = source.index ? source.toNonIndexed() : source.clone();
      // Bake the mesh's placement relative to `group` into the vertices
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, mesh.matrixWorld));
      // Merging needs identical attribute sets; drop the extras primitives vary on
      for (const name of Object.keys(geo.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv') {
          geo.deleteAttribute(name);
        }
      }
      if (!geo.attributes.uv) {
        const count = geo.attributes.position.count;
        geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
      }
      geometries.push(geo);
    }

    let combined: THREE.BufferGeometry | null = null;
    try {
      combined = mergeGeometries(geometries, false);
    } catch {
      combined = null;
    }
    if (!combined) {
      for (const g of geometries) g.dispose();
      continue; // incompatible bucket — leave those meshes as they were
    }

    const sample = bucket.meshes[0];
    const batched = new THREE.Mesh(combined, bucket.material);
    batched.castShadow = sample.castShadow;
    batched.receiveShadow = sample.receiveShadow;
    batched.matrixAutoUpdate = false;
    batched.userData.batched = true;
    group.add(batched);

    for (const mesh of bucket.meshes) {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const g of geometries) g.dispose();

    merged += bucket.meshes.length;
    into++;
  }

  return { merged, into };
}
