extends CanvasLayer

var firefly_label: Label
var dim_pip: ColorRect
var title: Control
var pause_panel: Control
var dead_panel: Control
var dead_stats: Label
var debug_label: Label
var touch: Control
var custom: Control
var sliders: Dictionary = {}
var warn_label: Label

var _joy_down: bool = false
var _joy_id: int = -1
var _steer_id: int = -1
var joy: ColorRect
var steer: ColorRect

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	layer = 20
	_build()
	InputManager.camera_toggle.connect(_on_cam)
	InputManager.pause_toggle.connect(_on_pause)
	DisplayManager.orientation_changed.connect(func(_p): _layout())
	_layout()
	_sync_sliders()
	_refresh()


func _build() -> void:
	var safe = Control.new()
	safe.name = "Safe"
	safe.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(safe)

	var top = HBoxContainer.new()
	top.position = Vector2(8, 8)
	safe.add_child(top)
	firefly_label = Label.new()
	firefly_label.text = "0"
	firefly_label.add_theme_font_size_override("font_size", 28)
	top.add_child(firefly_label)
	dim_pip = ColorRect.new()
	dim_pip.custom_minimum_size = Vector2(72, 8)
	dim_pip.color = Color(0.6, 0.85, 1, 0.4)
	top.add_child(dim_pip)

	debug_label = Label.new()
	debug_label.position = Vector2(8, 48)
	debug_label.visible = false
	safe.add_child(debug_label)

	title = _panel(safe, "GLOW")
	_btn(title, "ENTER THE FOREST", _play)
	_btn(title, "CUSTOM GAME", func(): custom.visible = true)
	_btn(title, "CALM PRESET", func(): GameConfigManager.apply_calm_preset(); _play())
	var hint = Label.new()
	hint.text = "WASD fly · mouse steer · Shift boost · E dim · C camera · Esc pause"
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title.add_child(hint)

	pause_panel = _panel(safe, "PAUSED")
	_btn(pause_panel, "RESUME", func(): GameManager.pause_game(false); _refresh())
	_btn(pause_panel, "MAIN MENU", _to_menu)

	dead_panel = _panel(safe, "THE FOREST CLAIMED YOU")
	dead_stats = Label.new()
	dead_panel.add_child(dead_stats)
	_btn(dead_panel, "RETURN TO FOREST", _restart)
	_btn(dead_panel, "MAIN MENU", _to_menu)

	custom = _panel(safe, "CUSTOM GAME")
	for pair in [
		["tree_density", "TREES", 0.0, 5.0],
		["firefly_population", "FIREFLIES", 0.0, 5.0],
		["owl_population", "PREDATORS", 0.0, 3.0],
		["player_normal_glow", "GLOW", 0.5, 2.0],
		["trail_brightness", "TRAIL", 0.0, 3.0],
		["difficulty_growth", "DANGER GROWTH", 0.0, 2.0],
	]:
		var lab = Label.new()
		lab.text = pair[1]
		custom.add_child(lab)
		var sl = HSlider.new()
		sl.min_value = pair[2]
		sl.max_value = pair[3]
		sl.step = 0.05
		sl.custom_minimum_size = Vector2(280, 16)
		custom.add_child(sl)
		sliders[pair[0]] = sl
	warn_label = Label.new()
	custom.add_child(warn_label)
	_btn(custom, "APPLY", _apply_custom)
	_btn(custom, "RESET TO DEFAULTS", func(): GameConfigManager.reset_to_defaults(); _sync_sliders())
	_btn(custom, "CLOSE", func(): custom.visible = false)
	custom.visible = false

	touch = Control.new()
	touch.set_anchors_preset(Control.PRESET_FULL_RECT)
	safe.add_child(touch)
	joy = ColorRect.new()
	joy.size = Vector2(120, 120)
	joy.color = Color(0.4, 0.8, 1, 0.18)
	touch.add_child(joy)
	steer = ColorRect.new()
	steer.size = Vector2(160, 180)
	steer.color = Color(1, 1, 1, 0.06)
	touch.add_child(steer)
	for name in ["BOOST", "DIM", "RISE", "DESCEND", "CAMERA", "PAUSE"]:
		var b = Button.new()
		b.text = name
		b.modulate.a = SettingsManager.control_opacity
		var id = name.to_lower()
		b.button_down.connect(func(): InputManager.set_touch_button(id, true))
		b.button_up.connect(func(): InputManager.set_touch_button(id, false))
		touch.add_child(b)
		b.set_meta("touch_id", id)
	touch.visible = DisplayServer.is_touchscreen_available()


func _panel(parent: Control, heading: String) -> VBoxContainer:
	var box = VBoxContainer.new()
	box.position = Vector2(40, 90)
	box.add_theme_constant_override("separation", 10)
	var h = Label.new()
	h.text = heading
	h.add_theme_font_size_override("font_size", 34)
	box.add_child(h)
	parent.add_child(box)
	return box


func _btn(parent: Control, text: String, cb: Callable) -> void:
	var b = Button.new()
	b.text = text
	b.pressed.connect(cb)
	parent.add_child(b)


func _play() -> void:
	custom.visible = false
	GameManager.start_run()
	var moth = get_tree().get_first_node_in_group("moth")
	if moth:
		moth.global_position = Vector3(24, 6, 24)
		moth.velocity = Vector3.ZERO
		moth.health.integrity = 1.0
		moth.health.state = 0
	var glow = moth.glow if moth else null
	if glow and not glow.overglow_started.is_connected(_og):
		glow.overglow_started.connect(_og)
	_refresh()


func _og() -> void:
	GameManager.overglow_events += 1


func _restart() -> void:
	get_tree().reload_current_scene()


func _to_menu() -> void:
	GameManager.phase = GameManager.Phase.MENU
	GameManager.paused = false
	get_tree().paused = false
	InputManager.capture_mouse(false)
	_refresh()


func _on_cam() -> void:
	var cam = get_tree().get_first_node_in_group("cam_mgr")
	if cam:
		cam.toggle()


func _on_pause() -> void:
	if GameManager.phase == GameManager.Phase.PLAY:
		GameManager.pause_game(true)
	elif GameManager.phase == GameManager.Phase.PAUSED:
		GameManager.pause_game(false)
	_refresh()


func _layout() -> void:
	if joy:
		joy.position = Vector2(24, get_viewport().get_visible_rect().size.y - 200)
	if steer:
		var sz = get_viewport().get_visible_rect().size
		steer.position = Vector2(sz.x - 200, sz.y * 0.35)
	var i = 0
	if touch:
		for c in touch.get_children():
			if c is Button:
				c.position = Vector2(get_viewport().get_visible_rect().size.x - 140, 80 + i * 46)
				i += 1


func _process(_dt: float) -> void:
	_refresh()
	if GameManager.phase == GameManager.Phase.PLAY:
		var moth = get_tree().get_first_node_in_group("moth")
		if moth and moth.glow:
			dim_pip.scale.x = maxf(0.08, moth.glow.energy)
			firefly_label.text = "%d" % GameManager.fireflies
	debug_label.visible = GameManager.debug_overlay
	if GameManager.debug_overlay:
		_debug()


func _refresh() -> void:
	title.visible = GameManager.phase == GameManager.Phase.MENU
	pause_panel.visible = GameManager.phase == GameManager.Phase.PAUSED
	dead_panel.visible = GameManager.phase == GameManager.Phase.DEAD
	if GameManager.phase == GameManager.Phase.DEAD:
		var s = GameManager.final_stats()
		dead_stats.text = "FIREFLIES %d   SURVIVAL %.0fs   DISTANCE %.0f\nESCAPED %d   NEAR MISSES %d   REGIONS %d\nOVERGLOW %d   SCORE %d   BEST %d" % [
			s.fireflies, s.survival, s.distance, s.escaped, s.near_misses, s.regions, s.overglow, s.score, s.best
		]


func _debug() -> void:
	var moth = get_tree().get_first_node_in_group("moth")
	var world = get_tree().get_first_node_in_group("chunks")
	var p = moth.global_position if moth else Vector3.ZERO
	debug_label.text = "FPS %d  xyz %.1f %.1f %.1f  spd %.1f  biome %s  chunks %d  glow %.2f  %s" % [
		Engine.get_frames_per_second(), p.x, p.y, p.z,
		moth.velocity.length() if moth else 0.0,
		world.current_biome() if world else "?",
		world.chunks.size() if world else 0,
		moth.glow.intensity if moth else 0.0,
		GameConfigManager.preset_name,
	]


func _input(event: InputEvent) -> void:
	if not touch.visible or GameManager.phase != GameManager.Phase.PLAY:
		return
	if event is InputEventScreenTouch:
		if event.pressed and joy.get_global_rect().has_point(event.position):
			_joy_down = true
			_joy_id = event.index
		elif not event.pressed and event.index == _joy_id:
			_joy_down = false
			_joy_id = -1
			InputManager.set_virtual_joystick(Vector2.ZERO)
		if event.pressed and steer.get_global_rect().has_point(event.position):
			_steer_id = event.index
		elif not event.pressed and event.index == _steer_id:
			_steer_id = -1
	if event is InputEventScreenDrag:
		if event.index == _joy_id:
			InputManager.set_virtual_joystick((event.position - joy.get_global_rect().get_center()) / 70.0)
		if event.index == _steer_id:
			InputManager.set_steer(event.relative * 0.01)


func _sync_sliders() -> void:
	var cfg = GameConfigManager.current_config
	for k in sliders.keys():
		if k in cfg:
			sliders[k].value = cfg.get(k)


func _apply_custom() -> void:
	var cfg = GameConfigManager.user_custom_config
	for k in sliders.keys():
		cfg.set(k, sliders[k].value)
	cfg.crow_population = cfg.owl_population
	cfg.bat_population = cfg.owl_population * 0.9
	GameConfigManager.apply_user_custom()
	GameConfigManager.persist_custom()
	warn_label.text = cfg.performance_warning()
	custom.visible = false
