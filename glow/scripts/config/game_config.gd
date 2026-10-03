class_name GameConfig
extends Resource
## All procedural / gameplay knobs. Generators must read this — do not hardcode densities.

@export_group("World")
@export var seed_value: int = 170403
@export var chunk_size: float = 48.0
@export var stream_radius: int = 2
@export var tree_density: float = 1.0
@export var mushroom_density: float = 1.0
@export var flower_density: float = 1.0
@export var fern_density: float = 1.0
@export var moss_density: float = 1.0

@export_group("Fireflies")
@export var firefly_population: float = 1.0
@export var firefly_cluster_size: float = 1.0
@export var firefly_attraction: float = 1.0
@export var firefly_score_value: float = 1.0
@export var overglow_threshold: float = 1.0
@export var overglow_duration: float = 1.0

@export_group("Player glow")
@export var player_normal_glow: float = 1.0
@export var player_light_radius: float = 1.0
@export var trail_brightness: float = 1.0
@export var trail_length: float = 1.0
@export var trail_lifetime: float = 3.5
@export var trail_predator_attract: float = 1.0
@export var dim_effectiveness: float = 1.0
@export var glow_energy_capacity: float = 1.0
@export var boost_brightness: float = 1.0

@export_group("Flight")
@export var acceleration: float = 18.0
@export var drag: float = 3.2
@export var max_speed: float = 14.0
@export var boost_speed: float = 26.0
@export var vertical_speed: float = 10.0
@export var turn_speed: float = 2.4
@export var bank_strength: float = 0.55
@export var hover_bob_amount: float = 0.12
@export var mouse_sensitivity: float = 0.0024
@export var gamepad_sensitivity: float = 2.2

@export_group("Wildlife")
@export var owl_population: float = 1.0
@export var crow_population: float = 1.0
@export var bat_population: float = 1.0
@export var frog_population: float = 1.0
@export var spider_population: float = 1.0
@export var bobcat_population: float = 1.0
@export var fox_population: float = 0.7
@export var snake_population: float = 0.6
@export var mantis_population: float = 0.4
@export var dragonfly_population: float = 0.5
@export var raccoon_population: float = 0.5

@export_group("Atmosphere")
@export var star_density: float = 1.0
@export var moon_size: float = 1.0
@export var moon_brightness: float = 1.0
@export var fog_density: float = 1.0
@export var ground_mist: float = 1.0
@export var spore_density: float = 1.0
@export var rain_frequency: float = 0.35
@export var wind_strength: float = 1.0
@export var shooting_star_frequency: float = 1.0

@export_group("Biomes")
@export var biome_weights: Dictionary = {
	"moonlit_grove": 1.0,
	"emerald_hollow": 1.0,
	"violet_fungal": 1.0,
	"blackwood": 0.7,
	"firefly_meadow": 0.9,
	"crystal_creek": 0.8,
	"ancient_grove": 0.8,
	"thornwood": 0.6,
	"mist_basin": 0.7,
	"fallen_forest": 0.6,
}

@export_group("Difficulty")
@export var difficulty_growth: float = 1.0
@export var maximum_difficulty: float = 1.0

@export_group("Events")
@export var firefly_bloom_frequency: float = 1.0
@export var bat_swarm_frequency: float = 1.0
@export var owl_hunt_frequency: float = 1.0
@export var moonbeam_frequency: float = 1.0
@export var bio_bloom_frequency: float = 1.0
@export var predator_crossing_frequency: float = 1.0

func duplicate_config():
	return duplicate(true)


func to_dict() -> Dictionary:
	var d = {}
	for p in get_property_list():
		if p.usage & PROPERTY_USAGE_SCRIPT_VARIABLE:
			d[p.name] = get(p.name)
	return d


func apply_dict(d: Dictionary) -> void:
	for k in d.keys():
		if k in self:
			set(k, d[k])


func performance_warning() -> String:
	if tree_density > 2.4 and spore_density > 2.0:
		return "VERY HIGH VEGETATION + VERY HIGH PARTICLES MAY REDUCE PERFORMANCE."
	return ""
