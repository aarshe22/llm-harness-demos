import * as THREE from "../vendor/three.module.js";
import { BIOMES, pickBiome, hash2, lodTreeSplit, wildlifeAltitude, fidelityProfile } from "./rules.js";
import { createPredator } from "./predators.js";
import { barkMaterial } from "./bark.js";
import { createPredatorPool } from "./pool.js";

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dummy = new THREE.Object3D();

const matCache = new Map();
function mat(key, make) {
  if (!matCache.has(key)) matCache.set(key, make());
  return matCache.get(key);
}

export function createWorld(scene, cfg, fidelity = 1) {
  const profile = fidelityProfile(fidelity);
  const trunkNear = new THREE.CylinderGeometry(1, 1.15, 1, profile.treeNearSeg);
  const trunkFar = new THREE.CylinderGeometry(1, 1.15, 1, profile.treeFarSeg);
  const groundGeo = new THREE.BoxGeometry(1, 0.8, 1);
  const plantGeo = new THREE.SphereGeometry(1, profile.plantSeg, profile.plantRings);
  const capGeo = new THREE.SphereGeometry(1, profile.plantSeg, Math.max(4, profile.plantRings - 1));
  const stemGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, Math.max(5, profile.plantSeg - 2));
  const canopyGeo = new THREE.SphereGeometry(1, Math.max(6, profile.treeFarSeg), Math.max(5, profile.treeFarSeg - 1));
  const flyGeo = new THREE.SphereGeometry(0.09, profile.flySeg, Math.max(6, profile.flySeg - 2));
  const chunks = new Map();
  const group = new THREE.Group();
  scene.add(group);
  const mist = makeMist(cfg);
  scene.add(mist);
  const events = { stars: [], bloomUntil: 0, weather: "clear" };
  const pool = createPredatorPool((kind, pos) => createPredator(kind, pos, profile.level));

  function key(cx, cz) {
    return `${cx},${cz}`;
  }

  function spawnChunk(cx, cz) {
    const k = key(cx, cz);
    if (chunks.has(k)) return;
    const biomeId = pickBiome(cx, cz, cfg.seed_value, cfg.biome_weights);
    const nId = pickBiome(cx, cz + 1, cfg.seed_value, cfg.biome_weights);
    const biome = BIOMES[biomeId];
    const blend = new THREE.Color(biome.glow).lerp(new THREE.Color(BIOMES[nId].glow), 0.28);
    const origin = new THREE.Vector3(cx * cfg.chunk_size, 0, cz * cfg.chunk_size);
    const rng = mulberry((cfg.seed_value + cx * 131 + cz * 917) >>> 0);
    const root = new THREE.Group();
    root.userData = { biomeId, trees: [], flies: [], preds: [], webs: [], solids: [], nearInst: null, farInst: null };

    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({
        color: 0x080a08,
        roughness: 1,
        emissive: blend,
        emissiveIntensity: (0.03 + (1 - biome.dark) * 0.05) * (cfg.moss_density || 1),
      })
    );
    ground.userData.ground = true;
    ground.scale.set(cfg.chunk_size, 1, cfg.chunk_size);
    ground.position.copy(origin).add(new THREE.Vector3(cfg.chunk_size / 2, -0.4, cfg.chunk_size / 2));
    root.add(ground);

    const n = Math.floor(16 * cfg.tree_density * biome.trees);
    const split = lodTreeSplit(n);
    const tMat = barkMaterial(biome.glow, profile.barkDetail);
    const nearInst = new THREE.InstancedMesh(trunkNear, tMat, Math.max(1, split.near));
    const farInst = new THREE.InstancedMesh(trunkFar, tMat, Math.max(1, split.far));
    nearInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    farInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    nearInst.count = split.near;
    farInst.count = split.far;
    nearInst.frustumCulled = true;
    farInst.frustumCulled = true;
    let ni = 0;
    let fi = 0;
    for (let i = 0; i < n; i++) {
      const h = 8 + rng() * 16 * (biomeId === "ancient_grove" ? 1.35 : 1);
      const r = 0.28 + rng() * 0.45;
      const p = origin.clone().add(new THREE.Vector3(rng() * cfg.chunk_size, h / 2, rng() * cfg.chunk_size));
      dummy.position.copy(p);
      dummy.scale.set(r, h, r);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      if (i < split.near) {
        nearInst.setMatrixAt(ni++, dummy.matrix);
        root.userData.solids.push({ pos: new THREE.Vector3(p.x, 0, p.z), radius: r * 1.2, kind: "hard" });
      } else {
        farInst.setMatrixAt(fi++, dummy.matrix);
      }
      root.userData.trees.push({ pos: p.clone(), radius: r * 1.15, height: h });
    }
    nearInst.instanceMatrix.needsUpdate = true;
    farInst.instanceMatrix.needsUpdate = true;
    root.add(nearInst, farInst);
    root.userData.nearInst = nearInst;
    root.userData.farInst = farInst;

    if (profile.treeCanopy) {
      const cMat = mat("can-" + biomeId + profile.level, () =>
        new THREE.MeshStandardMaterial({
          color: 0x061208,
          emissive: biome.glow,
          emissiveIntensity: 0.22,
          roughness: 0.85,
        })
      );
      const canopy = new THREE.InstancedMesh(canopyGeo, cMat, Math.max(1, split.near));
      canopy.count = split.near;
      canopy.frustumCulled = true;
      let ci = 0;
      for (const t of root.userData.trees) {
        if (ci >= split.near) break;
        dummy.position.set(t.pos.x, t.pos.y + t.height * 0.42, t.pos.z);
        dummy.scale.set(t.radius * 3.4, t.height * 0.18, t.radius * 3.4);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        canopy.setMatrixAt(ci++, dummy.matrix);
      }
      canopy.instanceMatrix.needsUpdate = true;
      root.add(canopy);
    }

    const plants = Math.floor(8 * cfg.mushroom_density + 6 * cfg.flower_density + 4 * (cfg.fern_density || 1));
    const pMat = mat("p-" + biomeId + profile.level, () =>
      new THREE.MeshStandardMaterial({
        color: 0x050508,
        emissive: biome.glow,
        emissiveIntensity: 1.5,
        roughness: profile.level === 1 ? 0.4 : 0.32,
      })
    );
    const plantInst = new THREE.InstancedMesh(plantGeo, pMat, Math.max(1, plants));
    plantInst.count = plants;
    plantInst.frustumCulled = true;
    const mushCount = profile.plantShapes ? Math.floor(plants * 0.45) : 0;
    const mushInst = profile.plantShapes
      ? new THREE.InstancedMesh(capGeo, pMat, Math.max(1, mushCount))
      : null;
    const stemInst = profile.plantShapes
      ? new THREE.InstancedMesh(stemGeo, pMat, Math.max(1, mushCount))
      : null;
    if (mushInst) {
      mushInst.count = mushCount;
      stemInst.count = mushCount;
    }
    let mi = 0;
    let pi = 0;
    for (let i = 0; i < plants; i++) {
      const s = 0.12 + rng() * 0.28;
      dummy.position.copy(origin).add(new THREE.Vector3(rng() * cfg.chunk_size, 0.2, rng() * cfg.chunk_size));
      dummy.rotation.set(0, 0, 0);
      if (profile.plantShapes && i < mushCount) {
        dummy.scale.set(s * 1.6, s * 0.7, s * 1.6);
        dummy.position.y = 0.38;
        dummy.updateMatrix();
        mushInst.setMatrixAt(mi, dummy.matrix);
        dummy.position.y = 0.2;
        dummy.scale.set(s * 0.35, 0.42, s * 0.35);
        dummy.updateMatrix();
        stemInst.setMatrixAt(mi++, dummy.matrix);
      } else {
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        plantInst.setMatrixAt(pi++, dummy.matrix);
      }
    }
    if (profile.plantShapes) {
      plantInst.count = Math.max(1, pi);
      mushInst.instanceMatrix.needsUpdate = true;
      stemInst.instanceMatrix.needsUpdate = true;
      root.add(mushInst, stemInst);
    }
    plantInst.instanceMatrix.needsUpdate = true;
    root.add(plantInst);

    const flies = Math.floor(5 * cfg.firefly_population * cfg.firefly_cluster_size * biome.flies);
    spawnFlies(root, origin, rng, flies, cfg);
    maybeWildlife(root, origin, rng, biomeId, cfg);
    if (biomeId === "thornwood" || biomeId === "violet_fungal") {
      if (rng() < 0.45 * cfg.spider_population) {
        const web = new THREE.Mesh(
          new THREE.PlaneGeometry(2.8, 2.2),
          new THREE.MeshBasicMaterial({ color: 0xccf0ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
        );
        web.position.copy(origin).add(new THREE.Vector3(rng() * cfg.chunk_size, 3 + rng() * 6, rng() * cfg.chunk_size));
        web.userData.web = true;
        root.add(web);
        root.userData.webs.push(web);
      }
    }

    group.add(root);
    chunks.set(k, root);
  }

  function spawnFlies(root, origin, rng, flies, cfg) {
    for (let i = 0; i < flies; i++) {
      const rare = rng() > 0.92;
      const col = rare ? 0xf259d9 : rng() > 0.6 ? 0x8cffb3 : rng() > 0.35 ? 0x73f2ff : 0xffd94d;
      const mesh = new THREE.Mesh(flyGeo, new THREE.MeshBasicMaterial({ color: col }));
      mesh.position.copy(origin).add(new THREE.Vector3(rng() * cfg.chunk_size, 1.2 + rng() * 8, rng() * cfg.chunk_size));
      mesh.userData = { t: rng() * 6, collected: false, rare, home: mesh.position.clone() };
      root.add(mesh);
      root.userData.flies.push(mesh);
    }
  }

  function maybeWildlife(root, origin, rng, biomeId, cfg) {
    const tries = [
      ["owl", cfg.owl_population * (biomeId === "ancient_grove" ? 1.4 : 1)],
      ["crow", cfg.crow_population],
      ["bat", cfg.bat_population * (biomeId === "blackwood" ? 1.3 : 1)],
      ["frog", cfg.frog_population],
      ["bobcat", cfg.bobcat_population * (biomeId === "fallen_forest" ? 1.3 : 1)],
      ["fox", cfg.fox_population],
      ["dragonfly", cfg.dragonfly_population * (biomeId === "crystal_creek" ? 1.4 : 1)],
      ["raccoon", cfg.raccoon_population * 0.6],
      ["snake", cfg.snake_population],
      ["mantis", cfg.mantis_population],
    ];
    for (const [kind, w] of tries) {
      if (rng() > Math.min(0.72, 0.18 * w)) continue;
      const y = wildlifeAltitude(kind);
      const p = origin.clone().add(new THREE.Vector3(rng() * cfg.chunk_size, y, rng() * cfg.chunk_size));
      const pred = pool.acquire(kind, p, root);
      root.userData.preds.push(pred);
    }
  }

  function stream(playerPos) {
    const cs = cfg.chunk_size;
    const cx = Math.floor(playerPos.x / cs);
    const cz = Math.floor(playerPos.z / cs);
    const r = cfg.stream_radius;
    const need = new Set();
    for (let x = cx - r; x <= cx + r; x++) {
      for (let z = cz - r; z <= cz + r; z++) {
        need.add(key(x, z));
        spawnChunk(x, z);
      }
    }
    for (const [k, node] of chunks) {
      if (!need.has(k)) {
        for (const pred of node.userData.preds || []) pool.release(pred);
        group.remove(node);
        chunks.delete(k);
      }
    }
    updateLod(playerPos);
  }

  function updateLod(playerPos) {
    const nearR = cfg.chunk_size * 1.15;
    for (const node of chunks.values()) {
      const g = node.children.find((c) => c.isMesh && c.userData.ground);
      const center = g ? g.position : playerPos;
      const d = Math.hypot(center.x - playerPos.x, center.z - playerPos.z);
      if (node.userData.nearInst) node.userData.nearInst.visible = d < nearR * 1.6;
      if (node.userData.farInst) node.userData.farInst.visible = d > nearR * 0.35;
    }
  }

  function currentBiome(playerPos) {
    const cs = cfg.chunk_size;
    const k = key(Math.floor(playerPos.x / cs), Math.floor(playerPos.z / cs));
    return chunks.get(k)?.userData.biomeId || "moonlit_grove";
  }

  function all(field) {
    const out = [];
    for (const n of chunks.values()) out.push(...n.userData[field]);
    return out;
  }

  function tickEvents(dt, mothPos) {
    mist.rotation.y += dt * 0.02 * (cfg.wind_strength || 1);
    mist.material.opacity = 0.08 * (cfg.ground_mist || 1);
    if (Math.random() < dt * 0.08 * (cfg.shooting_star_frequency || 1)) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      s.position.copy(mothPos).add(new THREE.Vector3(20, 28, -10));
      s.userData.vel = new THREE.Vector3(-18, -6, 8);
      s.userData.life = 1.6;
      scene.add(s);
      events.stars.push(s);
    }
    for (let i = events.stars.length - 1; i >= 0; i--) {
      const s = events.stars[i];
      s.userData.life -= dt;
      s.position.addScaledVector(s.userData.vel, dt);
      if (s.userData.life <= 0) {
        scene.remove(s);
        events.stars.splice(i, 1);
      }
    }
    if (events.bloomUntil <= 0 && Math.random() < dt * 0.012 * (cfg.firefly_bloom_frequency || 1)) {
      events.bloomUntil = 8;
      const origin = mothPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12));
      const chunk = [...chunks.values()][0];
      if (chunk) spawnFlies(chunk, origin, mulberry((Math.random() * 1e9) | 0), 10, cfg);
    }
    events.bloomUntil = Math.max(0, events.bloomUntil - dt);
    if (Math.random() < dt * 0.008 * (cfg.bat_swarm_frequency || 1)) {
      const p = mothPos.clone().add(new THREE.Vector3(18, 10, -8));
      const any = [...chunks.values()][0];
      if (any) {
        const pred = pool.acquire("bat", p, any);
        any.userData.preds.push(pred);
      }
    }
  }

  return { chunks, stream, currentBiome, all, group, updateLod, tickEvents, events, mist, pool };
}

function makeMist(cfg) {
  const n = Math.floor(180 * (cfg.ground_mist || 1) * (cfg.spore_density || 1));
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 80;
    pos[i * 3 + 1] = Math.random() * 6;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0x88ffcc, size: 0.12, transparent: true, opacity: 0.1, depthWrite: false })
  );
}

export function collideMoth(moth, world) {
  const p = moth.root.position;
  for (const s of world.all("solids")) {
    const dx = p.x - s.pos.x;
    const dz = p.z - s.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < s.radius + 0.16 && p.y < 20) {
      const nx = dx / (d || 1);
      const nz = dz / (d || 1);
      p.x += nx * (s.radius + 0.18 - d);
      p.z += nz * (s.radius + 0.18 - d);
      moth.vel.x += nx * 6;
      moth.vel.z += nz * 6;
      return "hard";
    }
  }
  for (const w of world.all("webs")) {
    if (p.distanceTo(w.position) < 1.4) return "web";
  }
  return null;
}

export function hashNoise(x, z, seed) {
  return hash2(x, z, seed);
}
