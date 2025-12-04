import * as THREE from "https://esm.sh/three@0.175.0";
import { EffectComposer } from "https://esm.sh/three@0.175.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://esm.sh/three@0.175.0/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://esm.sh/three@0.175.0/examples/jsm/postprocessing/UnrealBloomPass.js";
import Stats from "https://esm.sh/stats.js@0.17.0";
import { GUI } from "https://esm.sh/dat.gui@0.7.9";

// Simple configuration
const config = {
  particleCount: 100000,
  particleSize: 0.05,

  // Mouse interaction
  repulsionStrength: 0.5,
  repulsionRadius: 3.0,
  mouseInfluence: 0.8,

  // Physics
  damping: 0.99,
  randomMovement: 0.002,
  maxSpeed: 0.1,

  // Floating behavior
  floatStrength: 0.002,
  floatSpeed: 0.15,
  floatScale: 0.8,

  // Anti-grouping
  centerRepelStrength: 0.001,
  distributionFactor: 0.7,

  // Visual
  colorTheme: "ember",
  brightness: 1.5,
  bloomStrength: 2.0,
  bloomRadius: 0.7,
  bloomThreshold: 0.2,

  // Boundary
  boundaryRadius: 10,
  boundaryStrength: 0.05,
  bounceAmount: 0.8
};

// Color themes
const colorThemes = {
  cosmic: {
    background: 0x000011,
    colors: (v) => ({
      r: 0.2 + 0.4 * v,
      g: 0.2 + 0.2 * (1 - v),
      b: 0.5 + 0.5 * v
    }),
    bloom: { strength: 1.5, radius: 0.7, threshold: 0.2 }
  },
  ember: {
    background: 0x110000,
    colors: (v) => ({ r: 0.5 + 0.5 * v, g: 0.2 + 0.3 * v, b: 0.1 + 0.1 * v }),
    bloom: { strength: 1.5, radius: 0.7, threshold: 0.2 }
  },
  emerald: {
    background: 0x001100,
    colors: (v) => ({
      r: 0.1 + 0.1 * v,
      g: 0.5 + 0.5 * v,
      b: 0.2 + 0.3 * (1 - v)
    }),
    bloom: { strength: 1.5, radius: 0.7, threshold: 0.2 }
  },
  monochrome: {
    background: 0x050505,
    colors: (v) => {
      const val = 0.3 + 0.7 * v;
      return { r: val, g: val, b: val };
    },
    bloom: { strength: 1.5, radius: 0.7, threshold: 0.2 }
  }
};

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(colorThemes[config.colorTheme].background);
document.getElementById("container").appendChild(renderer.domElement);

// Post-processing
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  config.bloomStrength,
  config.bloomRadius,
  config.bloomThreshold
);
composer.addPass(bloomPass);

// Stats
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

// Mouse tracking
const mouse = new THREE.Vector2();
const prevMouse = new THREE.Vector2();
const mouseVelocity = new THREE.Vector2();
let mouseSpeed = 0;
let mouseDown = false;

function updateMousePosition(event) {
  prevMouse.copy(mouse);
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  mouseVelocity.x = mouse.x - prevMouse.x;
  mouseVelocity.y = mouse.y - prevMouse.y;
  mouseSpeed = Math.sqrt(
    mouseVelocity.x * mouseVelocity.x + mouseVelocity.y * mouseVelocity.y
  );
}

// Event listeners
window.addEventListener("mousemove", updateMousePosition);
window.addEventListener("mousedown", () => (mouseDown = true));
window.addEventListener("mouseup", () => (mouseDown = false));

// Touch support
window.addEventListener(
  "touchmove",
  (event) => {
    event.preventDefault();
    updateMousePosition({
      clientX: event.touches[0].clientX,
      clientY: event.touches[0].clientY
    });
  },
  { passive: false }
);
window.addEventListener("touchstart", () => (mouseDown = true));
window.addEventListener("touchend", () => (mouseDown = false));

// Convert mouse coordinates to 3D
function mouseToWorld(mouseX, mouseY, depth) {
  const vector = new THREE.Vector3(mouseX, mouseY, 0.5);
  vector.unproject(camera);
  const dir = vector.sub(camera.position).normalize();
  const distance = (depth - camera.position.z) / dir.z;
  return camera.position.clone().add(dir.multiplyScalar(distance));
}

// Particle system
const particles = new THREE.BufferGeometry();
const positions = new Float32Array(config.particleCount * 3);
const velocities = new Float32Array(config.particleCount * 3);
const colors = new Float32Array(config.particleCount * 3);
const baseColors = new Float32Array(config.particleCount * 3);
const sizes = new Float32Array(config.particleCount);
const colorValues = new Float32Array(config.particleCount);

// Initialize particles with true uniform distribution
function initializeParticles() {
  for (let i = 0; i < config.particleCount; i++) {
    const i3 = i * 3;

    // Truly uniform distribution throughout the volume
    // Using cube distribution and then normalizing to sphere boundary
    let x, y, z, mag;

    // Generate points in a cube then normalize to get uniform sphere volume
    do {
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      z = Math.random() * 2 - 1;
      mag = Math.sqrt(x * x + y * y + z * z);
    } while (mag > 1); // Reject points outside the unit sphere

    // Scale to desired radius - using cubic distribution for more uniform volume filling
    const volumetricRadius =
      Math.cbrt(Math.random()) * config.boundaryRadius * 0.9;

    positions[i3] = (x / mag) * volumetricRadius;
    positions[i3 + 1] = (y / mag) * volumetricRadius;
    positions[i3 + 2] = (z / mag) * volumetricRadius;

    // Random initial velocity - completely random directions
    const speed = 0.001 + Math.random() * 0.003;
    const vx = Math.random() * 2 - 1;
    const vy = Math.random() * 2 - 1;
    const vz = Math.random() * 2 - 1;
    const vMag = Math.sqrt(vx * vx + vy * vy + vz * vz);

    velocities[i3] = (vx / vMag) * speed;
    velocities[i3 + 1] = (vy / vMag) * speed;
    velocities[i3 + 2] = (vz / vMag) * speed;

    // Color and size
    colorValues[i] = Math.random();
    sizes[i] = config.particleSize * (0.6 + Math.random() * 0.8);
  }

  updateParticleColors();
}

// Update colors
function updateParticleColors() {
  const theme = colorThemes[config.colorTheme];

  for (let i = 0; i < config.particleCount; i++) {
    const i3 = i * 3;
    const colorValue = colorValues[i];
    const color = theme.colors(colorValue);

    baseColors[i3] = color.r * config.brightness;
    baseColors[i3 + 1] = color.g * config.brightness;
    baseColors[i3 + 2] = color.b * config.brightness;

    colors[i3] = baseColors[i3];
    colors[i3 + 1] = baseColors[i3 + 1];
    colors[i3 + 2] = baseColors[i3 + 2];
  }
}

// Initialize
initializeParticles();

// Set geometry attributes
particles.setAttribute("position", new THREE.BufferAttribute(positions, 3));
particles.setAttribute("particleColor", new THREE.BufferAttribute(colors, 3));
particles.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

// Shader material
const particleMaterial = new THREE.ShaderMaterial({
  uniforms: {
    pixelRatio: { value: window.devicePixelRatio }
  },
  vertexShader: `
    attribute float size;
    attribute vec3 particleColor;
    varying vec3 vColor;
    uniform float pixelRatio;
    
    void main() {
      vColor = particleColor;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * pixelRatio * (350.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    
    void main() {
      vec2 xy = gl_PointCoord.xy - vec2(0.5);
      float radius = length(xy);
      if (radius > 0.5) discard;
      
      float alpha = 1.0 - smoothstep(0.0, 0.5, radius);
      gl_FragColor = vec4(vColor, alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexColors: true
});

// Create particle system
const particleSystem = new THREE.Points(particles, particleMaterial);
scene.add(particleSystem);

// GUI
const gui = new GUI();
gui.width = 300;

// Visual controls
const visualFolder = gui.addFolder("Visual");
visualFolder
  .add(config, "colorTheme", Object.keys(colorThemes))
  .onChange((value) => {
    const theme = colorThemes[value];
    renderer.setClearColor(theme.background);
    bloomPass.strength = theme.bloom.strength;
    bloomPass.radius = theme.bloom.radius;
    bloomPass.threshold = theme.bloom.threshold;
    updateParticleColors();
  });
visualFolder
  .add(config, "brightness", 0.1, 2.0, 0.1)
  .onChange(updateParticleColors);
visualFolder
  .add(config, "bloomStrength", 0.1, 3.0, 0.1)
  .onChange((value) => (bloomPass.strength = value));
visualFolder.open();

// Interaction controls
const interactionFolder = gui.addFolder("Interaction");
interactionFolder.add(config, "repulsionStrength", 0.1, 1.0, 0.05);
interactionFolder.add(config, "repulsionRadius", 0.5, 5.0, 0.1);
interactionFolder.add(config, "mouseInfluence", 0.1, 2.0, 0.1);
interactionFolder.open();

// Physics controls
const physicsFolder = gui.addFolder("Physics");
physicsFolder.add(config, "damping", 0.8, 0.99, 0.01);
physicsFolder.add(config, "randomMovement", 0.0001, 0.005, 0.0001);
physicsFolder.add(config, "maxSpeed", 0.01, 0.5, 0.01);
physicsFolder.open();

// Floating behavior controls
const floatFolder = gui.addFolder("Floating Behavior");
floatFolder
  .add(config, "floatStrength", 0.0005, 0.005, 0.0005)
  .name("Flow Strength");
floatFolder.add(config, "floatSpeed", 0.05, 0.5, 0.05).name("Flow Speed");
floatFolder.add(config, "floatScale", 0.1, 2.0, 0.1).name("Flow Scale");
floatFolder
  .add(config, "centerRepelStrength", 0.0001, 0.005, 0.0001)
  .name("Anti-Grouping");
floatFolder
  .add(config, "distributionFactor", 0.2, 1.0, 0.1)
  .name("Distribution");
floatFolder.open();

// Reset function
const resetButton = { reset: initializeParticles };
gui.add(resetButton, "reset").name("Reset Particles");

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  stats.begin();

  // Create mouse ray
  const mouseRay = new THREE.Vector3(mouse.x, mouse.y, 0.5)
    .unproject(camera)
    .sub(camera.position)
    .normalize();

  // Convert mouse to 3D world coordinates at different depths
  const nearPoint = mouseToWorld(mouse.x, mouse.y, camera.position.z - 5);
  const farPoint = mouseToWorld(mouse.x, mouse.y, camera.position.z + 5);

  // Update particles
  for (let i = 0; i < config.particleCount; i++) {
    const i3 = i * 3;

    // Current position
    const x = positions[i3];
    const y = positions[i3 + 1];
    const z = positions[i3 + 2];

    // Reset colors to base
    colors[i3] = baseColors[i3];
    colors[i3 + 1] = baseColors[i3 + 1];
    colors[i3 + 2] = baseColors[i3 + 2];

    // Ray repulsion
    const particlePos = new THREE.Vector3(x, y, z);

    // Find closest point on ray to particle
    const rayToParticle = new THREE.Vector3().subVectors(
      particlePos,
      camera.position
    );
    const dotProduct = rayToParticle.dot(mouseRay);
    const closestPointOnRay = new THREE.Vector3()
      .copy(camera.position)
      .add(mouseRay.clone().multiplyScalar(dotProduct));

    // Distance from particle to ray
    const distanceToRay = new THREE.Vector3()
      .subVectors(particlePos, closestPointOnRay)
      .length();

    // Check if close enough to ray
    if (distanceToRay < config.repulsionRadius) {
      // Calculate direction from ray to particle (for pushing away)
      const direction = new THREE.Vector3()
        .subVectors(particlePos, closestPointOnRay)
        .normalize();

      // Repulsion strength decreases with distance
      const strength =
        config.repulsionStrength * (1 - distanceToRay / config.repulsionRadius);

      // Apply repulsion force
      velocities[i3] += direction.x * strength * (1 + mouseSpeed * 5);
      velocities[i3 + 1] += direction.y * strength * (1 + mouseSpeed * 5);
      velocities[i3 + 2] += direction.z * strength * (1 + mouseSpeed * 5);

      // Apply mouse velocity influence (for sweeping motion)
      if (mouseSpeed > 0.001) {
        // Project mouse velocity to 3D
        const vel3D = new THREE.Vector3(
          mouseVelocity.x,
          mouseVelocity.y,
          0
        ).multiplyScalar(config.mouseInfluence * 10 * strength);

        velocities[i3] += vel3D.x;
        velocities[i3 + 1] += vel3D.y;
        velocities[i3 + 2] += vel3D.z * 0.2;
      }

      // Make affected particles brighter
      const brightnessFactor = 1.0 + strength * 2;
      colors[i3] = Math.min(1, baseColors[i3] * brightnessFactor);
      colors[i3 + 1] = Math.min(1, baseColors[i3 + 1] * brightnessFactor);
      colors[i3 + 2] = Math.min(1, baseColors[i3 + 2] * brightnessFactor);

      // Slightly larger
      sizes[i] = config.particleSize * (1.0 + strength * 0.5);
    } else {
      // Return to normal size gradually
      sizes[i] += (config.particleSize - sizes[i]) * 0.1;
    }

    // Apply velocities to positions
    positions[i3] += velocities[i3];
    positions[i3 + 1] += velocities[i3 + 1];
    positions[i3 + 2] += velocities[i3 + 2];

    // Higher damping for more stability
    velocities[i3] *= 0.98;
    velocities[i3 + 1] *= 0.98;
    velocities[i3 + 2] *= 0.98;

    // Speed limit
    // More intelligent speed limiting
    const speedSq =
      velocities[i3] ** 2 + velocities[i3 + 1] ** 2 + velocities[i3 + 2] ** 2;

    // Different speed limits based on whether the particle is being affected by mouse
    const isAffectedByMouse = distanceToRay < config.repulsionRadius * 1.5;
    const effectiveMaxSpeed = isAffectedByMouse
      ? config.maxSpeed * 1.5 // Allow faster movement when affected by mouse
      : config.maxSpeed * 0.6; // Slower natural movement

    if (speedSq > effectiveMaxSpeed * effectiveMaxSpeed) {
      const factor = effectiveMaxSpeed / Math.sqrt(speedSq);
      velocities[i3] *= factor;
      velocities[i3 + 1] *= factor;
      velocities[i3 + 2] *= factor;
    }

    // Gradually slow down very slow particles to prevent complete stopping
    if (speedSq < 0.00001) {
      // Add tiny random velocity to prevent particles from becoming completely static
      velocities[i3] += (Math.random() - 0.5) * 0.0005;
      velocities[i3 + 1] += (Math.random() - 0.5) * 0.0005;
      velocities[i3 + 2] += (Math.random() - 0.5) * 0.0005;
    }

    // Natural floating behavior when not affected by the ray
    if (distanceToRay >= config.repulsionRadius) {
      // Use position-based flow field for consistent direction
      const time = performance.now() * 0.001;

      // Complete overhaul of floating behavior
      // Use repulsion between nearby particles + random motion + simple curl noise

      // 1. Add a small random motion component first
      velocities[i3] += (Math.random() * 2 - 1) * 0.0005;
      velocities[i3 + 1] += (Math.random() * 2 - 1) * 0.0005;
      velocities[i3 + 2] += (Math.random() * 2 - 1) * 0.0005;

      // 2. Add strong repulsion from center
      const distFromCenter = Math.sqrt(x * x + y * y + z * z);
      if (distFromCenter < config.boundaryRadius * 0.7) {
        const repulsionStrength =
          0.0006 * (1 - distFromCenter / (config.boundaryRadius * 0.7));
        const normX = x / distFromCenter;
        const normY = y / distFromCenter;
        const normZ = z / distFromCenter;

        velocities[i3] += normX * repulsionStrength;
        velocities[i3 + 1] += normY * repulsionStrength;
        velocities[i3 + 2] += normZ * repulsionStrength;
      }

      // 3. Simple curl noise for some directional flow
      const curTime = performance.now() * 0.0001;
      const scale = 0.4;

      // Simple curl approximation (not true curl noise but gives similar effect)
      const curl = {
        x: Math.sin(y * scale + time) * Math.cos(z * scale + time * 0.7),
        y: Math.sin(z * scale + time * 0.5) * Math.cos(x * scale + time * 0.8),
        z: Math.sin(x * scale + time * 0.6) * Math.cos(y * scale + time * 0.9)
      };

      // Apply curl with random strength
      const curlStrength = 0.0003;
      velocities[i3] += curl.x * curlStrength;
      velocities[i3 + 1] += curl.y * curlStrength;
      velocities[i3 + 2] += curl.z * curlStrength;

      // Apply slight outward force if close to center to prevent grouping
      const distToCenter = Math.sqrt(x * x + y * y + z * z);
      if (distToCenter < config.boundaryRadius * 0.5) {
        // Apply force away from center, stronger the closer to center
        const centerRepelStrength =
          0.001 * (1 - distToCenter / (config.boundaryRadius * 0.5));
        const dirFromCenter = new THREE.Vector3(x, y, z).normalize();

        velocities[i3] += dirFromCenter.x * centerRepelStrength;
        velocities[i3 + 1] += dirFromCenter.y * centerRepelStrength;
        velocities[i3 + 2] += dirFromCenter.z * centerRepelStrength;
      }

      // Random subtle movement for more natural feel - very occasional
      if (Math.random() > 0.997) {
        velocities[i3] += (Math.random() - 0.5) * config.randomMovement * 1.5;
        velocities[i3 + 1] +=
          (Math.random() - 0.5) * config.randomMovement * 1.5;
        velocities[i3 + 2] +=
          (Math.random() - 0.5) * config.randomMovement * 1.5;
      }
    }

    // Softer boundary with inward force as particles get close to edge
    const distance = Math.sqrt(x * x + y * y + z * z);
    const boundaryDist = config.boundaryRadius - distance;

    // Only apply boundary force when close to boundary
    if (boundaryDist < 2) {
      // Direction toward center
      const dirX = -x / distance;
      const dirY = -y / distance;
      const dirZ = -z / distance;

      // Nonlinear inward force (stronger when very close to edge)
      const boundaryForce =
        0.01 * (1 - boundaryDist / 2) * (1 - boundaryDist / 2);
      velocities[i3] += dirX * boundaryForce;
      velocities[i3 + 1] += dirY * boundaryForce;
      velocities[i3 + 2] += dirZ * boundaryForce;

      // Random inward jitter to prevent edge clustering
      if (boundaryDist < 0.5) {
        velocities[i3] += dirX * 0.01 * Math.random();
        velocities[i3 + 1] += dirY * 0.01 * Math.random();
        velocities[i3 + 2] += dirZ * 0.01 * Math.random();
      }
    }
  }

  // Update buffers
  particles.attributes.position.needsUpdate = true;
  particles.attributes.particleColor.needsUpdate = true;
  particles.attributes.size.needsUpdate = true;

  // Render
  composer.render();
  stats.end();
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  particleMaterial.uniforms.pixelRatio.value = window.devicePixelRatio;
}

window.addEventListener("resize", onWindowResize);

// Start animation
animate();