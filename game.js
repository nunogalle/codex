import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164/build/three.module.js';

const canvas = document.querySelector('#game');
const hud = document.querySelector('#hud');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#060913');
scene.fog = new THREE.Fog('#060913', 25, 90);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 8, 20);

const hemi = new THREE.HemisphereLight('#9ed9ff', '#110e24', 0.75);
scene.add(hemi);

const sun = new THREE.DirectionalLight('#d1ecff', 1.1);
sun.position.set(16, 24, 8);
sun.castShadow = true;
scene.add(sun);

const gridHelper = new THREE.GridHelper(140, 140, '#1d4d7c', '#152032');
scene.add(gridHelper);

const blockSize = 2;
const half = blockSize / 2;

const materials = {
  prismite: new THREE.MeshStandardMaterial({ color: '#69e7ff', emissive: '#04283f', roughness: 0.35, metalness: 0.2 }),
  mycelux: new THREE.MeshStandardMaterial({ color: '#8cff9e', emissive: '#0e2e17', roughness: 0.55, metalness: 0.05 }),
  ferron: new THREE.MeshStandardMaterial({ color: '#ffbf69', emissive: '#3d2202', roughness: 0.65, metalness: 0.3 }),
  nexus: new THREE.MeshStandardMaterial({ color: '#b194ff', emissive: '#2b0c4a', roughness: 0.25, metalness: 0.45 })
};

const blockTypes = Object.keys(materials);

const blocks = new Map();
const resourceBag = {
  prismite: 0,
  mycelux: 0,
  ferron: 0,
  nexus: 0,
  alloy: 0
};

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const move = {
  forward: false,
  back: false,
  left: false,
  right: false,
  up: false,
  down: false
};

const drone = new THREE.Group();
const droneBody = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1, 0),
  new THREE.MeshStandardMaterial({ color: '#c5e9ff', emissive: '#193f56', roughness: 0.45 })
);
drone.add(droneBody);
drone.position.set(0, 4, 8);
scene.add(drone);

const droneLight = new THREE.PointLight('#87f4ff', 1.2, 18);
droneLight.position.set(0, 1.2, 0);
drone.add(droneLight);

function snap(v) {
  return Math.round(v / blockSize) * blockSize;
}

function keyFromPosition(x, y, z) {
  return `${snap(x)}:${snap(y)}:${snap(z)}`;
}

function placeBlock(x, y, z, type) {
  const sx = snap(x);
  const sy = snap(y);
  const sz = snap(z);
  const key = keyFromPosition(sx, sy, sz);
  if (blocks.has(key)) return false;

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(blockSize, blockSize, blockSize), materials[type]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(sx, sy, sz);
  mesh.userData.type = type;
  scene.add(mesh);
  blocks.set(key, mesh);
  return true;
}

function removeBlock(mesh) {
  const key = keyFromPosition(mesh.position.x, mesh.position.y, mesh.position.z);
  if (blocks.has(key)) {
    resourceBag[mesh.userData.type] += 1;
    scene.remove(mesh);
    blocks.delete(key);
  }
}

function generateWorld() {
  for (let x = -20; x <= 20; x += blockSize) {
    for (let z = -20; z <= 20; z += blockSize) {
      const dist = Math.hypot(x, z);
      const h = Math.max(0, Math.round((10 - dist * 0.45) / 2) * blockSize);
      if (h <= 0) continue;

      for (let y = 0; y <= h; y += blockSize) {
        let type = 'ferron';
        if (y > h - blockSize * 2) type = 'mycelux';
        if (Math.random() < 0.08) type = 'prismite';
        placeBlock(x, y, z, type);
      }
    }
  }

  for (let i = 0; i < 20; i += 1) {
    const x = snap((Math.random() - 0.5) * 34);
    const z = snap((Math.random() - 0.5) * 34);
    const y = snap(8 + Math.random() * 8);
    placeBlock(x, y, z, 'nexus');
  }
}

generateWorld();

function getIntersections(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects([...blocks.values()], false);
}

function buildAtFace(mesh, normal) {
  const target = mesh.position.clone().add(normal.multiplyScalar(blockSize));
  const type = blockTypes[Math.floor(Math.random() * blockTypes.length)];
  if (resourceBag[type] <= 0) return;
  if (placeBlock(target.x, target.y, target.z, type)) {
    resourceBag[type] -= 1;
  }
}

window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('mousedown', (event) => {
  const hits = getIntersections(event);
  if (!hits.length) return;
  const hit = hits[0];

  if (event.button === 2) {
    removeBlock(hit.object);
  }

  if (event.button === 0) {
    buildAtFace(hit.object, hit.face.normal.clone());
  }
});

window.addEventListener('keydown', (event) => {
  const k = event.key.toLowerCase();
  if (k === 'w') move.forward = true;
  if (k === 's') move.back = true;
  if (k === 'a') move.left = true;
  if (k === 'd') move.right = true;
  if (k === ' ') move.up = true;
  if (k === 'shift') move.down = true;

  if (k === 'r') {
    const craftable = Math.min(resourceBag.prismite, resourceBag.ferron);
    if (craftable > 0) {
      resourceBag.prismite -= craftable;
      resourceBag.ferron -= craftable;
      resourceBag.alloy += craftable;
    }
  }
});

window.addEventListener('keyup', (event) => {
  const k = event.key.toLowerCase();
  if (k === 'w') move.forward = false;
  if (k === 's') move.back = false;
  if (k === 'a') move.left = false;
  if (k === 'd') move.right = false;
  if (k === ' ') move.up = false;
  if (k === 'shift') move.down = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const velocity = new THREE.Vector3();
const speed = 16;
const clock = new THREE.Clock();

function updateDrone(delta) {
  const input = new THREE.Vector3(
    Number(move.right) - Number(move.left),
    Number(move.up) - Number(move.down),
    Number(move.back) - Number(move.forward)
  );

  if (input.lengthSq() > 0) input.normalize();

  velocity.lerp(input.multiplyScalar(speed), 0.2);
  drone.position.addScaledVector(velocity, delta);

  drone.position.x = THREE.MathUtils.clamp(drone.position.x, -42, 42);
  drone.position.y = THREE.MathUtils.clamp(drone.position.y, 2, 32);
  drone.position.z = THREE.MathUtils.clamp(drone.position.z, -42, 42);

  const orbitOffset = new THREE.Vector3(0, 8, 18);
  const cameraTarget = drone.position.clone().add(orbitOffset);
  camera.position.lerp(cameraTarget, 0.06);
  camera.lookAt(drone.position);

  drone.rotation.y += delta * 1.6;
}

function updateHUD() {
  hud.textContent = `Drone: (${drone.position.x.toFixed(1)}, ${drone.position.y.toFixed(1)}, ${drone.position.z.toFixed(1)}) | Prismite ${resourceBag.prismite} · Mycelux ${resourceBag.mycelux} · Ferron ${resourceBag.ferron} · Nexus ${resourceBag.nexus} · Aleación ${resourceBag.alloy}`;
}

function animate() {
  const delta = clock.getDelta();
  updateDrone(delta);
  updateHUD();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
