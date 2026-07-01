uniform sampler2D map;
uniform sampler2D maskMap;

varying vec2 vUv;

void main() {
  float mask = texture2D(maskMap, vUv).r;
  if (mask < 0.04) {
    discard;
  }

  vec4 color = texture2D(map, vUv);
  gl_FragColor = vec4(color.rgb, color.a * mask);
}
