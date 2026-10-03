export function defaultConfig() {
  return {
    seed_value: 170403,
    chunk_size: 48,
    stream_radius: 2,
    tree_density: 1,
    mushroom_density: 1,
    flower_density: 1,
    firefly_population: 1,
    firefly_cluster_size: 1,
    firefly_attraction: 1,
    firefly_score_value: 1,
    overglow_threshold: 1,
    overglow_duration: 1,
    player_normal_glow: 1,
    player_light_radius: 1,
    trail_brightness: 1,
    trail_length: 1,
    trail_lifetime: 3.5,
    trail_predator_attract: 1,
    dim_effectiveness: 1,
    glow_energy_capacity: 1,
    boost_brightness: 1,
    acceleration: 18,
    drag: 3.2,
    max_speed: 14,
    boost_speed: 26,
    vertical_speed: 10,
    turn_speed: 2.4,
    bank_strength: 0.55,
    hover_bob_amount: 0.12,
    mouse_sensitivity: 0.0024,
    owl_population: 1,
    crow_population: 1,
    bat_population: 1,
    frog_population: 1,
    spider_population: 1,
    bobcat_population: 1,
    fox_population: 0.7,
    dragonfly_population: 0.5,
    raccoon_population: 0.5,
    fog_density: 1,
    moon_size: 1,
    moon_brightness: 1,
    star_density: 1,
    rain_frequency: 0.35,
    difficulty_growth: 1,
    maximum_difficulty: 1,
    biome_weights: {
      moonlit_grove: 1,
      emerald_hollow: 1,
      violet_fungal: 1,
      blackwood: 0.7,
      firefly_meadow: 0.9,
      crystal_creek: 0.8,
      ancient_grove: 0.8,
      thornwood: 0.6,
      mist_basin: 0.7,
      fallen_forest: 0.6,
    },
  };
}

export function performanceWarning(cfg) {
  if (cfg.tree_density > 2.4 && cfg.firefly_population > 2) {
    return "VERY HIGH VEGETATION + VERY HIGH PARTICLES MAY REDUCE PERFORMANCE.";
  }
  return "";
}

export function applyCalm(cfg) {
  Object.assign(cfg, {
    owl_population: 0.15,
    crow_population: 0.15,
    bat_population: 0.2,
    bobcat_population: 0.1,
    difficulty_growth: 0,
    firefly_population: 1.4,
  });
}

export function applyDanger(cfg) {
  Object.assign(cfg, {
    owl_population: 1.8,
    crow_population: 1.6,
    bat_population: 1.7,
    bobcat_population: 1.4,
    difficulty_growth: 1.6,
  });
  cfg.biome_weights.blackwood = 1.6;
}
