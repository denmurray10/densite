
 import * as THREE from 'three';

const container = document.getElementById('orb');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDesktop = window.matchMedia('(min-width: 769px)').matches;

if (container && isDesktop && !reduced) {
  try { init(); } catch (e) {
    console.warn('WebGL unavailable, falling back to static orb', e);
    document.querySelector('.orb-static').style.display = 'block';
    container.style.display = 'none';
  }
}

function init() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // spec 09: DPR cap
  container.appendChild(renderer.domElement);

  const world = new THREE.Group(); // parallax target
  scene.add(world);

  /* ---------- Orb: fresnel + simplex displacement ---------- */
  const uniforms = { uTime: { value: 0 } };

  const vertexShader = /* glsl */ `
    uniform float uTime;
    varying vec3 vNormal;
    varying vec3 vView;
    varying float vNoise;

    // Simplex 3D noise — Ashima Arts / Stefan Gustavson (MIT)
    vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
    vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v){
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + 1.0 * C.xxx;
      vec3 x2 = x0 - i2 + 2.0 * C.xxx;
      vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
      i = mod(i, 289.0);
      vec4 p = permute(permute(permute(
                 i.z + vec4(0.0, i1.z, i2.z, 1.0))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0))
               + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 1.0/7.0;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
      float n = snoise(position * 2.0 + uTime * 0.18);
      vNoise = n;
      vec3 displaced = position + normal * n * 0.07;
      vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vView = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    varying float vNoise;

    void main() {
      vec3 deep   = vec3(0.05, 0.04, 0.10);
      vec3 violet = vec3(0.486, 0.361, 1.0);
      vec3 ice    = vec3(0.83, 0.96, 1.0);

      vec3 n = normalize(vNormal);
      vec3 v = normalize(vView);
      // key light upper-left, like the Figma gradient (38% / 32%)
      float lightAmt = pow(max(dot(n, normalize(vec3(-0.45, 0.55, 0.7))), 0.0), 1.6);
      float fres = pow(1.0 - max(dot(n, v), 0.0), 2.2);

      vec3 col = mix(deep, violet, clamp(lightAmt * 1.1 + vNoise * 0.18, 0.0, 1.0));
      col += ice * pow(lightAmt, 4.0) * 0.55;  // icy core highlight
      col += violet * fres * 0.7;              // violet rim ("bloom")
      col += ice * pow(fres, 3.0) * 0.3;       // hot rim edge

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.22, 48),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })
  );
  world.add(orb);

  /* ---------- Orbit ring + lime satellite ---------- */
  const ringGroup = new THREE.Group();
  const ringRadius = 1.95;
  const pts = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * ringRadius, Math.sin(a) * ringRadius, 0));
  }
  const ring = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 })
  );
  ringGroup.add(ring);
  ringGroup.rotation.x = 1.32;  // tilt to a flattened ellipse
  ringGroup.rotation.z = -0.24; // -14°, matching the Figma ring
  world.add(ringGroup);

  const glowTexture = (color) => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, color);
    g.addColorStop(0.35, color.replace('1)', '0.55)'));
    g.addColorStop(1, color.replace('1)', '0)'));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  };

  const satellite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(215,255,62,1)'),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  }));
  satellite.scale.setScalar(0.34);
  ringGroup.add(satellite);

  // soft violet halo behind the orb (bloom stand-in, additive)
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(124,92,255,1)'),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.5,
  }));
  halo.scale.setScalar(5.4);
  halo.position.z = -1.4;
  world.add(halo);

  /* ---------- Mouse parallax (lerp 0.06) ---------- */
  const mouse = { x: 0, y: 0 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  /* ---------- Sizing ---------- */
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(resize).observe(container);

  /* ---------- Render loop, paused off-screen (spec 09) ---------- */
  let visible = true;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) requestAnimationFrame(tick);
  }).observe(container);

  const clock = new THREE.Clock();
  let elapsed = 0;

  function tick() {
    if (!visible) return;
    elapsed += clock.getDelta();
    uniforms.uTime.value = elapsed;

    orb.rotation.y = elapsed * 0.1;
    orb.rotation.x = Math.sin(elapsed * 0.07) * 0.12;

    const a = elapsed * 0.38;
    satellite.position.set(Math.cos(a) * ringRadius, Math.sin(a) * ringRadius, 0);

    // parallax lerp
    world.rotation.y += (mouse.x * 0.32 - world.rotation.y) * 0.06;
    world.rotation.x += (mouse.y * 0.22 - world.rotation.x) * 0.06;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
