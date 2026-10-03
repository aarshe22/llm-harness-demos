extends Node
## Landscape desktop / portrait mobile, fullscreen, render scale.

signal orientation_changed(portrait: bool)

var portrait: bool = false
var fullscreen: bool = false

func _ready() -> void:
	get_viewport().size_changed.connect(_on_size)
	_on_size()
	_apply_render_scale()


func _on_size() -> void:
	var sz = get_viewport().get_visible_rect().size
	var now_portrait = sz.y > sz.x
	if now_portrait != portrait:
		portrait = now_portrait
		orientation_changed.emit(portrait)


func toggle_fullscreen() -> void:
	fullscreen = not fullscreen
	if fullscreen:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	else:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)


func _apply_render_scale() -> void:
	var rs: float = SettingsManager.render_scale
	get_viewport().scaling_3d_scale = clampf(rs, 0.5, 1.25)


func _process(_dt: float) -> void:
	if Input.is_action_just_pressed("toggle_fullscreen"):
		toggle_fullscreen()
