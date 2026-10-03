extends Node
## Keyboard / mouse / gamepad / touch. Touch is analog, not key emulation.

signal camera_toggle
signal pause_toggle

var move: Vector2 = Vector2.ZERO
var rise: float = 0.0
var look: Vector2 = Vector2.ZERO
var boosting: bool = false
var dimming: bool = false
var touch_enabled: bool = false
var pointer_captured: bool = false

var _joy_vec: Vector2 = Vector2.ZERO
var _steer_vec: Vector2 = Vector2.ZERO
var _touch_rise: bool = false
var _touch_descend: bool = false
var _touch_boost: bool = false
var _touch_dim: bool = false

func _ready() -> void:
	touch_enabled = DisplayServer.is_touchscreen_available()


func capture_mouse(on: bool) -> void:
	pointer_captured = on
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if on else Input.MOUSE_MODE_VISIBLE


func set_virtual_joystick(v: Vector2) -> void:
	_joy_vec = v.limit_length(1.0)


func set_steer(v: Vector2) -> void:
	_steer_vec = v


func set_touch_button(name: String, down: bool) -> void:
	match name:
		"rise": _touch_rise = down
		"descend": _touch_descend = down
		"boost": _touch_boost = down
		"dim": _touch_dim = down
		"camera":
			if down:
				camera_toggle.emit()
		"pause":
			if down:
				pause_toggle.emit()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and pointer_captured:
		var inv = -1.0 if SettingsManager.invert_y else 1.0
		look += event.relative * GameConfigManager.current_config.mouse_sensitivity * SettingsManager.mouse_sensitivity * Vector2(1, inv)
	if event.is_action_pressed("switch_camera"):
		camera_toggle.emit()
	if event.is_action_pressed("pause"):
		pause_toggle.emit()


func _process(_dt: float) -> void:
	var k = Input.get_vector("move_left", "move_right", "move_back", "move_forward")
	var stick = Vector2(
		Input.get_joy_axis(0, JOY_AXIS_LEFT_X),
		-Input.get_joy_axis(0, JOY_AXIS_LEFT_Y)
	)
	if stick.length() < SettingsManager.gamepad_deadzone:
		stick = Vector2.ZERO
	move = (k + stick + _joy_vec).limit_length(1.0)
	if SettingsManager.touch_scheme == "one_finger" and touch_enabled:
		move.y = maxf(move.y, 0.55)

	var r = 1.0 if Input.is_action_pressed("rise") or _touch_rise or Input.is_joy_button_pressed(0, JOY_BUTTON_RIGHT_SHOULDER) else 0.0
	var d = 1.0 if Input.is_action_pressed("descend") or _touch_descend or Input.is_joy_button_pressed(0, JOY_BUTTON_LEFT_SHOULDER) else 0.0
	rise = r - d

	var rs = Vector2(Input.get_joy_axis(0, JOY_AXIS_RIGHT_X), Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y))
	if rs.length() < SettingsManager.gamepad_deadzone:
		rs = Vector2.ZERO
	look += rs * GameConfigManager.current_config.gamepad_sensitivity * get_process_delta_time()
	look += _steer_vec
	_steer_vec = Vector2.ZERO

	boosting = Input.is_action_pressed("boost") or _touch_boost or Input.get_joy_axis(0, JOY_AXIS_TRIGGER_RIGHT) > 0.45
	dimming = Input.is_action_pressed("dim") or _touch_dim or Input.get_joy_axis(0, JOY_AXIS_TRIGGER_LEFT) > 0.45

	if Input.is_joy_button_pressed(0, JOY_BUTTON_RIGHT_STICK):
		if not _rs_latched:
			_rs_latched = true
			camera_toggle.emit()
	else:
		_rs_latched = false

	if Input.is_joy_button_pressed(0, JOY_BUTTON_START):
		if not _start_latched:
			_start_latched = true
			pause_toggle.emit()
	else:
		_start_latched = false


var _rs_latched: bool = false
var _start_latched: bool = false

func consume_look() -> Vector2:
	var v = look
	look = Vector2.ZERO
	return v
