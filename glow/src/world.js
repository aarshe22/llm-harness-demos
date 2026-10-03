import * as THREE from "../vendor/three.module.js";
import { BIOMES, pickBiome, hash2 } from "./rules.js";
import { createPredator } from "./predators.js";

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

export function createWorld(scene, cfg) {
  const chunks = new Map();
  const group = new THREE.Group();
  scene.add(group);

  const trunkGeo = new THREE.CylinderGeometry(1, 1, 1, 7);
  const groundGeo = new THREE.BoxGeometry(1, 0.8, 1);
  const plantGeo = new THREE.SphereGeometry(1, 8, 6);
  const flyGeo = new THREE.SphereGeometry(0.09, 8, 6);

  function key(cx, cz) {
    return `${cx},${cz}`;
  }

  function spawnChunk(cx, cz) {
    const k = key(cx, cz);
    if (chunks.has(k)) return;
    const biomeId = pickBiome(cx, cz, cfg.seed_value, cfg.biome_weights);
    const biome = BIOMES[biomeId];
    const origin = new THREE.Vector3(cx * cfg.chunk_size, 0, cz * cfg.chunk_size);
    const rng = mulberry((cfg.seed_value + cx * 131 + cz * 917) >>> 0);
    const root = new THREE.Group();
    root.userData = { biomeId, trees: [], flies: [], preds: [], webs: [], solids: [] };

    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({
        color: 0x080a08,
        roughness: 1,
        emissive: biome.glow,
        emissiveIntensity: 0.04 + (1 - biome.dark) * 0.06,
      })
    );
    ground.scale.set(cfg.chunk_size, 1, cfg.chunk_size);
    ground.position.copy(origin).add(new THREE.Vector3(cfg.chunk_size / 2, -0.4, cfg.chunk_size / 2));
    root.add(ground);

    let n = Math.floor(16 * cfg.tree_density * biome.trees);
    for (let i = 0; i < n; i++) {
      const h = 8 + rng() * 16 * (biomeId === "ancient_grove" ? 1.35 : 1);
      const r = 0.28 + rng() * 0.45;
      const trunk = new THREE.Mesh(
        trunkGeo,
        new THREE.MeshStandardMaterial({
          color: 0x050403,
          roughness: 1,
          emissive: biome.glow,
          emissiveIntensity: biomeId === "blackwood" ? 0.01 : 0.05,
        })
      );
      trunk.scale.set(r, h, r);
      const p = origin.clone().add(new THREE.Vector3(rng() * cfg.chunk_size, h / 2, rng() * cfg.chunk_size));
      trunk.position.copy(p);
      root.add(trunk);
      root.userData.trees.push({ pos: p.clone(), radius: r * 1.15, height: h });
      root.userData.solids.push({ pos: new THREE.Vector3(p.x, 0, p.z), radius: r * 1.2, kind: "hard" });
    }

    const plants = Math.floor(8 * cfg.mushroom_density + 6 * cfg.flower_density);
    for (let i = 0; i < plants; i++) {
      const s = 0.12 + rng() * 0.28;
      const mesh = new THREE.Mesh(
        plantGeo,
        new THREE.MeshStandardMaterial({
          color: 0x050508,
          emissive: biome.glow,
          emissiveIntensity: 1.5,
          roughness: 0.4,
        })
      );
      mesh.scale.setScalar(s);
      mesh.position.copy(origin).add(new THREE.Vector3(rng() * cfg.chunk_size, 0.2, rng() * cfg.chunk_size));
      root.add(mesh);
    }

    const flies = Math.floor(5 * cfg.firefly_population * cfg.firefly_cluster_size * biome.flies);
    for (let i = 0; i < flies; i++) {
      const rare = rng() > 0.92;
      const col = rare ? 0xf259d9 : rng() > 0.6 ? 0x8cffb3 : rng() > 0.35 ? 0x73f2ff : 0xffd94d;
      const mesh = new THREE.Mesh(
        flyGeo,
        new THREE.MeshBasicMaterial({ color: col })
      );
      mesh.position.copy(origin).add(
        new THREE.Vector3(rng() * cfg.chunk_size, 1.2 + rng() * 8, rng() * cfg.chunk_size)
      );
      mesh.userData = { t: rng() * 6, collected: false, rare, home: mesh.position.clone() };
      root.add(mesh);
      root.userData.flies.push(mesh);
    }

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

  function maybeWildlife(root, origin, rng, biomeId, cfg) {
    const diff = 1;
    const tries = [
      ["owl", cfg.owl_population * (biomeId === "ancient_grove" ? 1.4 : 1), 8],
      ["crow", cfg.crow_population, 12],
      ["bat", cfg.bat_population * (biomeId === "blackwood" ? 1.3 : 1), 10],
      ["frog", cfg.frog_population, 1],
      ["bobcat", cfg.bobcat_population * (biomeId === "fallen_forest" ? 1.3 : 1), 0.6],
      ["fox", cfg.fox_population, 0.5],
      ["dragonfly", cfg.dragonfly_population * (biomeId === "crystal_creek" ? 1.4 : 1), 4],
    ];
    for (const [kind, w, y] of tries) {
      if (rng() > Math.min(0.72, 0.18 * w * diff)) continue;
      const p = origin.clone().add(new THREE.Vector3(rng() * cfg.chunk_size, y, rng() * cfg.chunk_size));
      const pred = createPredator(kind, p);
      root.add(pred.root);
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
        group.remove(node);
        chunks.delete(k);
      }
    }
  }

  function currentBiome(playerPos) {
    const cs = cfg.chunk_size;
    const k = key(Math.floor(playerPos.x / cs), Math.floor(playerPos.z / cs));
    const n = chunks.get(k);
    return n?.userData.biomeId || "moonlit_grove";
  }

  function all(field) {
    const out = [];
    for (const n of chunks.values()) out.push(...n.userData[field]);
    return out;
  }

  return { chunks, stream, currentBiome, all, group };
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
