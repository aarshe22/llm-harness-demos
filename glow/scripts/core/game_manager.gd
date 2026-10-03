extends Node

enum Phase { MENU, PLAY, PAUSED, DEAD }

var phase: Phase = Phase.MENU
var paused: bool = false
var play_time: float = 0.0
var fireflies: int = 0
var score: int = 0
var predators_escaped: int = 0
var near_misses: int = 0
var regions: Dictionary = {}
var overglow_events: int = 0
var debug_overlay: bool = false
var debug_ai_off: bool = false
var world: Node
var start_pos: Vector3 = Vector3.ZERO

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS


func difficulty_scale() -> float:
	var cfg = GameConfigManager.current_config
	var t = play_time / 180.0 * cfg.difficulty_growth
	return clampf(1.0 + t, 0.2, 1.0 + cfg.maximum_difficulty)


func start_run() -> void:
	play_time = 0.0
	fireflies = 0
	score = 0
	predators_escaped = 0
	near_misses = 0
	regions.clear()
	overglow_events = 0
	paused = false
	phase = Phase.PLAY
	get_tree().paused = false
	InputManager.capture_mouse(true)
	AudioManager.start_night_forest()


func pause_game(on: bool) -> void:
	if phase == Phase.DEAD or phase == Phase.MENU:
		return
	paused = on
	phase = Phase.PAUSED if on else Phase.PLAY
	get_tree().paused = on
	InputManager.capture_mouse(not on)


func collect_firefly(n: int) -> void:
	fireflies += n
	score += int(12 * n * GameConfigManager.current_config.firefly_score_value)


func predator_escaped() -> void:
	predators_escaped += 1
	score += 40


func near_miss() -> void:
	near_misses += 1
	score += 25


func note_region(id: String) -> void:
	if not regions.has(id):
		regions[id] = true
		score += 15


func player_died() -> void:
	phase = Phase.DEAD
	paused = true
	get_tree().paused = false
	InputManager.capture_mouse(false)
	AudioManager.danger()
	var moth = get_tree().get_first_node_in_group("moth")
	var dist = moth.distance_flown if moth else 0.0
	score += int(play_time * 2.0 + dist * 0.4 + near_misses * 10 + predators_escaped * 20)
	SaveManager.record_run(score, play_time, dist, fireflies)


func final_stats() -> Dictionary:
	var moth = get_tree().get_first_node_in_group("moth")
	return {
		"fireflies": fireflies,
		"survival": play_time,
		"distance": moth.distance_flown if moth else 0.0,
		"escaped": predators_escaped,
		"near_misses": near_misses,
		"regions": regions.size(),
		"overglow": overglow_events,
		"score": score,
		"best": int(SaveManager.data.get("high_score", 0)),
	}


func _process(dt: float) -> void:
	if phase == Phase.PLAY and not paused:
		play_time += dt
	if Input.is_action_just_pressed("debug_overlay"):
		debug_overlay = not debug_overlay
	if OS.is_debug_build() and Input.is_key_pressed(KEY_I) and Input.is_key_pressed(KEY_SHIFT):
		var moth = get_tree().get_first_node_in_group("moth")
		if moth:
			moth.health.debug_invulnerable = not moth.health.debug_invulnerable


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		if phase == Phase.PLAY:
			pause_game(true)
