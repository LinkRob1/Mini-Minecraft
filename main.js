// Mini-Minecraft (simplifié)
// Scène, caméra, rendu, contrôles, terrain procédural, interaction blocs

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // ciel bleu

const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lumières
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// Controls (PointerLockControls)
const controls = new THREE.PointerLockControls(camera, document.body);

const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
startBtn.addEventListener('click', () => {
  controls.lock();
});
controls.addEventListener('lock', () => { overlay.style.display = 'none'; });
controls.addEventListener('unlock', () => { overlay.style.display = ''; });

// Player
const player = {
  velocity: new THREE.Vector3(),
  direction: new THREE.Vector3(),
  canJump: false,
  speed: 6,
};

// Keyboard movement state
const moveState = { forward: false, back: false, left: false, right: false };

// Geometry & materials (shared)
const BLOCK_SIZE = 1;
const boxGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
const defaultMaterial = new THREE.MeshLambertMaterial({ color: 0x00aa00 });
const dirtMaterial = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
const stoneMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });

// Map to keep track of blocks keyed by 'x,y,z'
const blocks = new Map();
function keyFromVec(x, y, z) {
  return `${x},${y},${z}`;
}

function addBlock(x, y, z, mat = defaultMaterial) {
  const key = keyFromVec(x, y, z);
  if (blocks.has(key)) return null;
  const mesh = new THREE.Mesh(boxGeometry, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  blocks.set(key, mesh);
  return mesh;
}

function removeBlock(x, y, z) {
  const key = keyFromVec(x, y, z);
  const mesh = blocks.get(key);
  if (!mesh) return false;
  scene.remove(mesh);
  blocks.delete(key);
  return true;
}

// Procedural Terrain: simple noise approximation
function generateTerrain(width, depth, maxHeight) {
  for (let i = 0; i < width; i++) {
    for (let k = 0; k < depth; k++) {
      // simple hills using sin + random
      const nx = i / width;
      const nz = k / depth;
      const height = Math.floor((Math.sin(nx * Math.PI * 2) + Math.cos(nz * Math.PI * 2) + Math.random() * 0.8) * (maxHeight / 2)) + 1;
      for (let y = 0; y < height; y++) {
        const mat = y === height - 1 ? defaultMaterial : dirtMaterial;
        addBlock(i - Math.floor(width/2), y, k - Math.floor(depth/2), mat);
      }
    }
  }
}

generateTerrain(40, 40, 6);

// Add a directional grid (optional)
const grid = new THREE.GridHelper(80, 80, 0x000000, 0x000000);
grid.material.opacity = 0.07;
grid.material.transparent = true;
scene.add(grid);

// Crosshair
const crosshair = document.createElement('div');
crosshair.id = 'crosshair';
crosshair.innerText = '+';
document.body.appendChild(crosshair);

// Raycaster for interactions
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Ghost block for placement preview
const ghostMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, opacity: 0.6, transparent: true });
const ghostCube = new THREE.Mesh(boxGeometry, ghostMaterial);
ghostCube.visible = false;
scene.add(ghostCube);

function updateGhost() {
  // cast ray from camera center
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const intersects = raycaster.intersectObjects(Array.from(blocks.values()));
  if (intersects.length > 0) {
    const it = intersects[0];
    // For placement: show face-adjacent cell
    const normal = it.face.normal;
    const pos = it.object.position.clone().add(normal);
    ghostCube.position.copy(pos);
    ghostCube.visible = true;
  } else {
    ghostCube.visible = false;
  }
}

// Event listeners for mouse clicks
window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('mousedown', (e) => {
  if (!controls.isLocked) return;
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const intersects = raycaster.intersectObjects(Array.from(blocks.values()));
  if (e.button === 0) { // left click: remove
    if (intersects.length > 0) {
      const it = intersects[0];
      const pos = it.object.position;
      removeBlock(pos.x, pos.y, pos.z);
    }
  } else if (e.button === 2) { // right click: add
    if (intersects.length > 0) {
      const it = intersects[0];
      const normal = it.face.normal;
      const pos = it.object.position.clone().add(normal);
      addBlock(pos.x, pos.y, pos.z, stoneMaterial);
    }
  }
});

// Movement & physics
const clock = new THREE.Clock();

window.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': moveState.forward = true; break;
    case 'KeyS': moveState.back = true; break;
    case 'KeyA': moveState.left = true; break;
    case 'KeyD': moveState.right = true; break;
    case 'Space': if (player.canJump) { player.velocity.y += 8; player.canJump = false; } break;
    case 'Escape': controls.unlock(); break;
  }
});
window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': moveState.forward = false; break;
    case 'KeyS': moveState.back = false; break;
    case 'KeyA': moveState.left = false; break;
    case 'KeyD': moveState.right = false; break;
  }
});

function isOnGround() {
  const pos = controls.getObject().position;
  const footY = Math.floor(pos.y - 0.1);
  // check for block directly below
  const key = keyFromVec(Math.round(pos.x), footY, Math.round(pos.z));
  return blocks.has(key);
}

function updatePlayer(delta) {
  const speed = player.speed;
  player.direction.set(0, 0, 0);
  if (moveState.forward) player.direction.z -= 1;
  if (moveState.back) player.direction.z += 1;
  if (moveState.left) player.direction.x -= 1;
  if (moveState.right) player.direction.x += 1;

  player.direction.normalize();

  // Get forward vector from camera
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0; forward.normalize();
  const right = new THREE.Vector3();
  right.crossVectors(forward, camera.up).normalize();

  const move = new THREE.Vector3();
  move.addScaledVector(forward, -player.direction.z * speed * delta);
  move.addScaledVector(right, player.direction.x * speed * delta);

  // Apply gravity
  player.velocity.y -= 9.8 * delta; // gravity

  // Predict vertical position to check collisions
  const nextPos = controls.getObject().position.clone().add(move);
  nextPos.y += player.velocity.y * delta;

  // Basic collision: check if the predicted y collides with a block
  const standingOn = isOnGround();
  if (standingOn) {
    player.velocity.y = Math.max(0, player.velocity.y);
    player.canJump = true;
  } else {
    player.canJump = false;
  }

  // Move horizontally
  controls.getObject().position.add(move);
  // Move vertically
  controls.getObject().position.y += player.velocity.y * delta;

  // prevent falling too low
  if (controls.getObject().position.y < -50) {
    controls.getObject().position.set(0, 10, 0);
    player.velocity.set(0, 0, 0);
  }
}

// Initialize player start position
controls.getObject().position.set(0, 10, 0);
scene.add(controls.getObject());

// Simple FPS overlay: current pos
const posDiv = document.createElement('div');
posDiv.style.position = 'absolute';
posDiv.style.right = '8px';
posDiv.style.top = '8px';
posDiv.style.color = '#fff';
posDiv.style.background = 'rgba(0,0,0,0.4)';
posDiv.style.padding = '6px 8px';
posDiv.style.borderRadius = '6px';
posDiv.style.fontSize = '12px';
document.body.appendChild(posDiv);


function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(0.05, clock.getDelta());
  if (controls.isLocked) updatePlayer(delta);
  updateGhost();
  posDiv.innerText = `x:${controls.getObject().position.x.toFixed(1)} y:${controls.getObject().position.y.toFixed(1)} z:${controls.getObject().position.z.toFixed(1)}`;
  renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Expose add/remove for console quick testing
window.addBlock = addBlock;
window.removeBlock = removeBlock;
