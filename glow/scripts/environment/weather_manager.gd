class_name WeatherManager
extends Node

var state: String = "clear"

func tick(dt: float) -> void:
	if randf() < 0.0004 * GameConfigManager.current_config.rain_frequency * dt * 60.0:
		state = "rain" if state != "rain" else "mist"
