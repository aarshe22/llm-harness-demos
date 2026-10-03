class_name GlowController
extends Node

signal overglow_started
signal overglow_ended

var intensity: float = 1.0
var energy: float = 1.0
var overglow: float = 0.0
var combo: int = 0
var combo_timer: float = 0.0

func _physics_process(dt: float) -> void:
	var cfg = GameConfigManager.current_config
	var dimming: bool = InputManager.dimming and overglow <= 0.15
	var boosting: bool = InputManager.boosting
	var target = 1.0 * cfg.player_normal_glow
	if boosting:
		target = 1.55 * cfg.boost_brightness
	if dimming:
		target = 0.15 / maxf(0.35, cfg.dim_effectiveness)
		energy = maxf(0.0, energy - dt * 0.28)
		if energy <= 0.0:
			target = 0.55
	else:
		energy = minf(1.0 * cfg.glow_energy_capacity, energy + dt * 0.22)

	if overglow > 0.0:
		overglow = maxf(0.0, overglow - dt)
		target = maxf(target, 1.85)
		if overglow <= 0.0:
			overglow_ended.emit()

	combo_timer = maxf(0.0, combo_timer - dt)
	if combo_timer <= 0.0:
		combo = 0

	intensity = lerpf(intensity, target, 1.0 - exp(-8.0 * dt))


func collect_firefly() -> void:
	combo += 1
	combo_timer = 4.2
	var need = int(8.0 * GameConfigManager.current_config.overglow_threshold)
	if combo >= need and overglow <= 0.0:
		overglow = 6.0 * GameConfigManager.current_config.overglow_duration
		overglow_started.emit()


func detection_multiplier() -> float:
	return intensity * (1.35 if overglow > 0.0 else 1.0)


func collect_radius() -> float:
	return 1.6 + intensity * 1.4 * GameConfigManager.current_config.firefly_attraction
