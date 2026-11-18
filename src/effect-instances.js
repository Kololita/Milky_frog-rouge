import {DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh} from 'three';

// Effect geometry and materials stay stable across activations. Grow only
// when capacity is exhausted, and upload only the occupied attribute ranges.
export function createEffectInstances(root, {initialCapacity, attributes, layers, copies = 1}) {
  let capacity = 0;
  let buffers;
  let bufferList;
  let meshes = [];
  const layouts = Object.entries(attributes);

  function ensure(count) {
    if (count <= capacity) return buffers;
    for (const mesh of meshes) {
      mesh.removeFromParent();
      mesh.dispose();
      mesh.geometry.dispose();
    }
    capacity = Math.max(initialCapacity, count, capacity * 2);
    buffers = Object.fromEntries(layouts.map(([name, size]) => [
      name,
      new InstancedBufferAttribute(new Float32Array(capacity * size), size, false, copies)
        .setUsage(DynamicDrawUsage),
    ]));
    bufferList = Object.values(buffers);
    meshes = layers.map(({geometry, material}) => {
      const mesh = new InstancedMesh(geometry, material, capacity * copies);
      for (const [name, buffer] of Object.entries(buffers)) {
        if (name === 'instanceColor') mesh.instanceColor = buffer;
        else geometry.setAttribute(name, buffer);
      }
      mesh.frustumCulled = false;
      mesh.count = 0;
      root.add(mesh);
      return mesh;
    });
    return buffers;
  }

  function commit(count) {
    root.visible = count > 0;
    for (const mesh of meshes) mesh.count = count * copies;
    if (!count) return;
    for (const buffer of bufferList) {
      buffer.clearUpdateRanges();
      buffer.addUpdateRange(0, count * buffer.itemSize);
      buffer.needsUpdate = true;
    }
  }

  ensure(initialCapacity);
  commit(0);
  return {ensure, commit};
}
