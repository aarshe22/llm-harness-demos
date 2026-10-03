extends Node
## Holds DefaultConfig (immutable), CurrentConfig, and UserCustomConfig.

const GameConfigScript := preload("res://scripts/config/game_config.gd")

var default_config
var current_config
var user_custom_config
var preset_name: String = "default"

func _ready() -> void:
	default_config = GameConfigScript.new()
	current_config = default_config.duplicate_config()
	user_custom_config = default_config.duplicate_config()
	var saved: Variant = SaveManager.load_json("user_custom_config")
	if typeof(saved) == TYPE_DICTIONARY:
		user_custom_config.apply_dict(saved)
		current_config.apply_dict(saved)
		preset_name = "custom"


func reset_to_defaults() -> void:
	current_config = default_config.duplicate_config()
	preset_name = "default"


func apply_user_custom() -> void:
	current_config = user_custom_config.duplicate_config()
	preset_name = "custom"


func persist_custom() -> void:
	SaveManager.save_json("user_custom_config", user_custom_config.to_dict())


func apply_calm_preset() -> void:
	current_config = default_config.duplicate_config()
	current_config.owl_population = 0.15
	current_config.crow_population = 0.15
	current_config.bat_population = 0.2
	current_config.bobcat_population = 0.1
	current_config.difficulty_growth = 0.0
	current_config.firefly_population = 1.4
	preset_name = "calm"


func apply_danger_preset() -> void:
	current_config = default_config.duplicate_config()
	current_config.owl_population = 1.8
	current_config.crow_population = 1.6
	current_config.bat_population = 1.7
	current_config.bobcat_population = 1.4
	current_config.difficulty_growth = 1.6
	current_config.biome_weights["blackwood"] = 1.6
	preset_name = "danger"
