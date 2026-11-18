import {PointLight} from 'three';

// Keep an inactive effect in the same light slots. Hiding a point light
// changes the shader key of every illuminated material in the frame.
export function createEffectLight(scene, color, distance) {
  const light = new PointLight(color, 0, distance, 2);
  scene.add(light);
  return light;
}
