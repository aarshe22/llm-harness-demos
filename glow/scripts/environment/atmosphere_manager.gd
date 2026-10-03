class_name AtmosphereManager
extends Node

var env: Environment
var moon: MeshInstance3D
var stars: GPUParticles3D
var weather: String = "clear"
var weather_t: float = 0.0

func setup(world_env: WorldEnvironment, moon_node: MeshInstance3D) -> void:
	env = world_env.environment
	moon = moon_node
	_apply()


func _process(dt: float) -> void:
	weather_t += dt
	if weather_t > 40.0:
		weather_t = 0.0
		var r = randf()
		if r < 0.25 * GameConfigManager.current_config.rain_frequency:
			weather = "rain"
		elif r < 0.55:
			weather = "mist"
		else:
			weather = "clear"
		_apply()
	if moon:
		moon.rotate_y(dt * 0.01)


func _apply() -> void:
	if env == null:
		return
	var cfg = GameConfigManager.current_config
	env.fog_enabled = true
	env.fog_light_color = Color(0.05, 0.1, 0.14)
	var dens = 0.012 * cfg.fog_density
	if weather == "mist":
		dens *= 1.8
	env.fog_density = dens
	env.glow_enabled = true
	env.glow_bloom = 0.35
	env.glow_intensity = 0.9
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.15
