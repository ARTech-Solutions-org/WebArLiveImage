uniform sampler2D depthMap;
uniform sampler2D maskMap;
uniform float displacementStrength;
uniform float zOffset;

varying vec2 vUv;

void main() {
  vUv = uv;

  float depth = texture2D(depthMap, uv).r;
  float mask = texture2D(maskMap, uv).r;

  vec3 displaced = position;
  displaced.z += zOffset + depth * displacementStrength * mask;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
