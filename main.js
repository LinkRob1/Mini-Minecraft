// Mini-Minecraft: improved
// Three.js scene + Perlin noise terrain + block types + save/load

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); dirLight.position.set(10, 20, 10); scene.add(dirLight);

// Controls
const controls = new THREE.PointerLockControls(camera, document.body);
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
startBtn.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => overlay.style.display = 'none');
controls.addEventListener('unlock', () => overlay.style.display = '');

// Player
const player = {
  velocity: new THREE.Vector3(0, 0, 0),
  direction: new THREE.Vector3(0, 0, 0),
  canJump: false,
  speed: 6,
};
const moveState = { forward: false, back: false, left: false, right: false };

// Blocks (per-block dynamic meshes)
const BLOCK_SIZE = 1;
const boxGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
const MATERIALS = {
  grass: new THREE.MeshLambertMaterial({ color: 0x2e8b57 }),
  dirt: new THREE.MeshLambertMaterial({ color: 0x8b5a2b }),
  stone: new THREE.MeshLambertMaterial({ color: 0x808080 }),
  wood: new THREE.MeshLambertMaterial({ color: 0x8b4513 }),
};

// dynamic blocks map (user-placed or non-instanced)
const blocks = new Map();
function keyFromVec(x, y, z) { return `${x},${y},${z}`; }

function addBlock(x, y, z, type = 'grass') {
  const key = keyFromVec(x, y, z);
  if (blocks.has(key)) return null;
  if (!(type in MATERIALS)) type = 'grass';
  const mesh = new THREE.Mesh(boxGeometry, MATERIALS[type]);
  mesh.position.set(x, y, z);
  mesh.userData = { type };
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

// Instanced mesh support (static terrain blocks)
const instancedData = { grass: [], dirt: [], stone: [], wood: [] };
const instancedMeshes = {};
const staticBlockSet = new Set(); // to check collisions

function createInstancedMeshes(capacity = 8192) {
  Object.keys(instancedData).forEach((t) => {
    if (instancedMeshes[t]) scene.remove(instancedMeshes[t]);
    const mesh = new THREE.InstancedMesh(boxGeometry, MATERIALS[t], capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instancedMeshes[t] = mesh;
    scene.add(mesh);
  });
}
createInstancedMeshes(20000);

function addInstancedBlock(type, x, y, z) {
  if (!(type in instancedData)) type = 'grass';
  instancedData[type].push({ x, y, z });
  staticBlockSet.add(`${x},${y},${z}`);
}

function removeInstancedBlock(type, x, y, z) {
  if (!(type in instancedData)) return false;
  const list = instancedData[type];
  const key = `${x},${y},${z}`;
  const idx = list.findIndex((p) => p.x === x && p.y === y && p.z === z);
  if (idx === -1) return false;
  list.splice(idx, 1);
  staticBlockSet.delete(key);
  rebuildInstancedMesh(type);
  return true;
}

function rebuildInstancedMesh(type) {
  const list = instancedData[type];
  const mesh = instancedMeshes[type];
  if (!mesh) return;
  // Set matrices for instances
  const count = list.length;
  for (let i = 0; i < count; i++) {
    const pos = list[i];
    const m = new THREE.Matrix4();
    m.makeTranslation(pos.x, pos.y, pos.z);
    mesh.setMatrixAt(i, m);
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
}

// Perlin implementation (improved Perlin, ported)
const Perlin = (function() {
  const permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57, 177,33,88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244, 102,143,54,65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152, 2,44,154,163,70,221,153,101,155,167, 43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,49,192,214, 31,181,199,106,157,184,84,204,176,115,121,50,45,127, 4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
  const p = new Array(512);
  for (let i = 0; i < 512; i++) p[i] = permutation[i % 256];

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return (1 - t) * a + t * b; }
  function grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  return {
    noise: function(x, y, z) {
      const X = Math.floor(x) & 255,
            Y = Math.floor(y) & 255,
            Z = Math.floor(z) & 255;
      x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
      const u = fade(x), v = fade(y), w = fade(z);
      const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
      const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;

      return lerp(w, lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
                             lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))),
                     lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
                             lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))));
    }
  };
})();

function perlin2D(x, y, options = {}) {
  const octaves = options.octaves || 4;
  const persistence = options.persistence || 0.5;
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    total += Perlin.noise(x * frequency, y * frequency, 0) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return total / maxValue;
}

// Terrain generation
function generateTerrain(width = 40, depth = 40, maxHeight = 6, seed = 0) {
  const xOffset = -Math.floor(width / 2);
  const zOffset = -Math.floor(depth / 2);
  for (let i = 0; i < width; i++) {
    for (let k = 0; k < depth; k++) {
      const nx = (i + seed) / 10.0;
      const nz = (k + seed) / 10.0;
      const noiseVal = perlin2D(nx, nz, { octaves: 4, persistence: 0.5 });
      const normalized = (noiseVal + 1) / 2;
      const height = Math.max(1, Math.floor(normalized * (maxHeight - 1)) + 1);
      for (let y = 0; y < height; y++) {
        const type = (y === height - 1) ? 'grass' : 'dirt';
        addInstancedBlock(type, i + xOffset, y, k + zOffset);
      }
    }
  }
}

// generate initial terrain
generateTerrain(40, 40, 8, 42);
Object.keys(instancedData).forEach(t => rebuildInstancedMesh(t));

// grid
const grid = new THREE.GridHelper(80, 80, 0x000000, 0x000000); grid.material.opacity = 0.08; grid.material.transparent = true; scene.add(grid);

// Crosshair
const crosshair = document.createElement('div'); crosshair.id = 'crosshair'; crosshair.innerText = '+'; document.body.appendChild(crosshair);

// Raycaster and ghost
const raycaster = new THREE.Raycaster();
const ghostCube = new THREE.Mesh(boxGeometry, new THREE.MeshLambertMaterial({ color: 0xffffff, opacity: 0.6, transparent: true }));
ghostCube.visible = false; scene.add(ghostCube);

// UI elements
const blockSelect = document.getElementById('blockSelect');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');
const clearBtn = document.getElementById('clearBtn');

function updateGhost() {
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  // Intersect dynamic blocks + instanced meshes
  const intersectObjects = Array.from(blocks.values()).concat(Object.values(instancedMeshes));
  const intersects = raycaster.intersectObjects(intersectObjects);
  if (intersects.length > 0) {
    const it = intersects[0];
    // If instantiated mesh, compute pos from instanceId
    let pos;
    if (it.object.isInstancedMesh && it.instanceId !== undefined && it.instanceId !== null) {
      const mat = new THREE.Matrix4();
      it.object.getMatrixAt(it.instanceId, mat);
      const position = new THREE.Vector3();
      position.setFromMatrixPosition(mat);
      pos = position.clone().add(it.face.normal);
    } else {
      pos = it.object.position.clone().add(it.face.normal);
    }
    ghostCube.position.copy(pos);
    ghostCube.material = MATERIALS[blockSelect.value];
    ghostCube.material.transparent = true;
    ghostCube.material.opacity = 0.5;
    ghostCube.visible = true;
  } else {
    ghostCube.visible = false;
  }
}

// Click handlers
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('mousedown', (e) => {
  if (!controls.isLocked) return;
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const intersectObjects = Array.from(blocks.values()).concat(Object.values(instancedMeshes));
  const intersects = raycaster.intersectObjects(intersectObjects);
  if (e.button === 0) {
    // left click remove
    if (intersects.length > 0) {
      const it = intersects[0];
      if (it.object.isInstancedMesh && it.instanceId !== undefined && it.instanceId !== null) {
        // find type for this mesh
        const type = Object.keys(instancedMeshes).find(k => instancedMeshes[k] === it.object);
        if (type) {
          // retrieve instance position
          const mat = new THREE.Matrix4();
          it.object.getMatrixAt(it.instanceId, mat);
          const position = new THREE.Vector3();
          position.setFromMatrixPosition(mat);
          removeInstancedBlock(type, Math.round(position.x), Math.round(position.y), Math.round(position.z));
        }
      } else {
        removeBlock(it.object.position.x, it.object.position.y, it.object.position.z);
      }
    }
  } else if (e.button === 2) {
    // right click add block of selected type
    if (intersects.length > 0) {
      const it = intersects[0];
      let pos;
      if (it.object.isInstancedMesh && it.instanceId !== undefined && it.instanceId !== null) {
        const mat = new THREE.Matrix4();
        it.object.getMatrixAt(it.instanceId, mat);
        const position = new THREE.Vector3();
        position.setFromMatrixPosition(mat);
        pos = position.clone().add(it.face.normal);
      } else {
        pos = it.object.position.clone().add(it.face.normal);
      }
      // add as dynamic block
      addBlock(Math.round(pos.x), Math.round(pos.y), Math.round(pos.z), blockSelect.value);
    }
  }
});

// Input
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
  const key = keyFromVec(Math.round(pos.x), footY, Math.round(pos.z));
  return blocks.has(key) || staticBlockSet.has(key);
}

// Player collision / AABB helpers
const PLAYER_HEIGHT = 1.7; // eye height ~1.7
const PLAYER_RADIUS = 0.25;

function aabbIntersects(minA, maxA, minB, maxB) {
  return (minA.x <= maxB.x && maxA.x >= minB.x) &&
         (minA.y <= maxB.y && maxA.y >= minB.y) &&
         (minA.z <= maxB.z && maxA.z >= minB.z);
}

function playerAABBAt(pos) {
  return {
    min: new THREE.Vector3(pos.x - PLAYER_RADIUS, pos.y - PLAYER_HEIGHT, pos.z - PLAYER_RADIUS),
    max: new THREE.Vector3(pos.x + PLAYER_RADIUS, pos.y, pos.z + PLAYER_RADIUS)
  };
}

function worldAABBAt(x, y, z) {
  return {
    min: new THREE.Vector3(x - 0.5, y - 0.5, z - 0.5),
    max: new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5)
  };
}

function anyBlockIntersectingAABB(min, max) {
  const minX = Math.floor(min.x);
  const maxX = Math.floor(max.x);
  const minY = Math.floor(min.y);
  const maxY = Math.floor(max.y);
  const minZ = Math.floor(min.z);
  const maxZ = Math.floor(max.z);
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        const key = `${x},${y},${z}`;
        if (staticBlockSet.has(key) || blocks.has(key)) {
          // check aabb precise
          const blockAABB = worldAABBAt(x, y, z);
          if (aabbIntersects({min, max}, {min: blockAABB.min, max: blockAABB.max})) return true;
        }
      }
    }
  }
  return false;
}

function updatePlayer(delta) {
  const speed = player.speed;
  player.direction.set(0, 0, 0);
  if (moveState.forward) player.direction.z -= 1;
  if (moveState.back) player.direction.z += 1;
  if (moveState.left) player.direction.x -= 1;
  if (moveState.right) player.direction.x += 1;

  player.direction.normalize();
  const forwardVector = new THREE.Vector3(); camera.getWorldDirection(forwardVector); forwardVector.y = 0; forwardVector.normalize();
  const rightVector = new THREE.Vector3(); rightVector.crossVectors(forwardVector, camera.up).normalize();
  const move = new THREE.Vector3();
  move.addScaledVector(forwardVector, -player.direction.z * speed * delta);
  move.addScaledVector(rightVector, player.direction.x * speed * delta);

  // gravity
  player.velocity.y -= 9.8 * delta;
  const standingOn = isOnGround();
  if (standingOn) { player.canJump = true; player.velocity.y = Math.max(0, player.velocity.y); }
  else player.canJump = false;

  // collisions: resolve axis separately to allow sliding
  const pos = controls.getObject().position.clone();
  // horizontal X
  const nextPosX = pos.clone(); nextPosX.x += move.x;
  const aabbX = playerAABBAt(new THREE.Vector3(nextPosX.x, pos.y, pos.z));
  if (!anyBlockIntersectingAABB(aabbX.min, aabbX.max)) {
    controls.getObject().position.x = nextPosX.x;
  } else {
    // zero out horizontal x movement
  }
  // horizontal Z
  const nextPosZ = pos.clone(); nextPosZ.z += move.z;
  const aabbZ = playerAABBAt(new THREE.Vector3(pos.x, pos.y, nextPosZ.z));
  if (!anyBlockIntersectingAABB(aabbZ.min, aabbZ.max)) {
    controls.getObject().position.z = nextPosZ.z;
  } else {
    // zero out
  }
  // vertical
  const nextPosY = pos.clone(); nextPosY.y += player.velocity.y * delta;
  const aabbY = playerAABBAt(new THREE.Vector3(controls.getObject().position.x, nextPosY.y, controls.getObject().position.z));
  if (!anyBlockIntersectingAABB(aabbY.min, aabbY.max)) {
    controls.getObject().position.y = nextPosY.y;
  } else {
    // collision vertical (ground/ceiling)
    if (player.velocity.y < 0) {
      // landed on ground
      player.canJump = true;
      player.velocity.y = 0;
      // snap to top of ground block (set y to integer + PLAYER_HEIGHT)
      const footY = Math.floor(controls.getObject().position.y - 0.1);
      controls.getObject().position.y = footY + 1 + 0.001 + PLAYER_HEIGHT - PLAYER_HEIGHT; // ensure above
    } else {
      // hit ceiling
      player.velocity.y = 0;
    }
  }
  if (controls.getObject().position.y < -50) {
    controls.getObject().position.set(0, 10, 0);
    player.velocity.set(0, 0, 0);
  }
}

// world management: save/load
function saveWorld() {
  const arr = [];
  // static instanced blocks
  for (const type of Object.keys(instancedData)) {
    for (const p of instancedData[type]) arr.push({ x: p.x, y: p.y, z: p.z, type, static: true });
  }
  // dynamic blocks
  for (const [k, mesh] of blocks.entries()) {
    const [x, y, z] = k.split(',').map(Number);
    arr.push({ x, y, z, type: mesh.userData.type || 'grass', static: false });
  }
  localStorage.setItem('mini-minecraft-world', JSON.stringify(arr));
}
function loadWorld() {
  const json = localStorage.getItem('mini-minecraft-world');
  if (!json) return false;
  const arr = JSON.parse(json);
  // clear current dynamic and static
  for (const k of Array.from(blocks.keys())) { const [x,y,z]=k.split(',').map(Number); removeBlock(x,y,z); }
  for (const t of Object.keys(instancedData)) { instancedData[t] = []; staticBlockSet.clear(); }
  // load
  for (const b of arr) {
    if (b.static) addInstancedBlock(b.type, b.x, b.y, b.z);
    else addBlock(b.x, b.y, b.z, b.type);
  }
  // rebuild all instanced meshes
  Object.keys(instancedData).forEach(t => rebuildInstancedMesh(t));
  return true;
}
function clearWorld() {
  for (const k of Array.from(blocks.keys())) { const [x,y,z]=k.split(',').map(Number); removeBlock(x,y,z); }
  for (const t of Object.keys(instancedData)) { instancedData[t] = []; }
  staticBlockSet.clear();
  Object.keys(instancedMeshes).forEach(t => rebuildInstancedMesh(t));
}

// UI button bindings
saveBtn.addEventListener('click', () => { saveWorld(); alert('Monde sauvegardé localement'); });
loadBtn.addEventListener('click', () => { const ok = loadWorld(); if (ok) alert('Monde chargé'); else alert('Aucune sauvegarde trouvée'); });
clearBtn.addEventListener('click', () => { if (confirm('Effacer le monde actuel ?')) clearWorld(); });

// initial player spawn
controls.getObject().position.set(0, 10, 0); scene.add(controls.getObject());

// HUD pos
const posDiv = document.createElement('div'); posDiv.id = 'hud-pos'; posDiv.style.position = 'absolute'; posDiv.style.right = '8px'; posDiv.style.top = '8px'; posDiv.style.color = '#fff'; posDiv.style.background = 'rgba(0,0,0,0.4)'; posDiv.style.padding = '6px 8px'; posDiv.style.borderRadius = '6px'; posDiv.style.fontSize = '12px'; document.body.appendChild(posDiv);

// animation loop
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(0.05, clock.getDelta());
  if (controls.isLocked) updatePlayer(delta);
  updateGhost();
  posDiv.innerText = `x:${controls.getObject().position.x.toFixed(1)} y:${controls.getObject().position.y.toFixed(1)} z:${controls.getObject().position.z.toFixed(1)}`;
  renderer.render(scene, camera);
}
animate();

// resize
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

// Expose for debugging
window.addBlock = addBlock; window.removeBlock = removeBlock; window.saveWorld = saveWorld; window.loadWorld = loadWorld; window.clearWorld = clearWorld;
