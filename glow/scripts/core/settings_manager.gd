extends Node

var graphics_preset: String = "high"
var render_scale: float = 1.0
var fidelity: int = 1
var master_volume: float = 0.85
var music_volume: float = 0.55
var env_volume: float = 0.7
var predator_volume: float = 0.8
var ui_volume: float = 0.7
var invert_y: bool = false
var reduced_flash: bool = false
var reduced_shake: bool = false
var camera_bob: bool = true
var high_visibility_collectibles: bool = false
var ui_scale: float = 1.0
var touch_scheme: String = "classic" # classic | one_finger
var joystick_size: float = 1.0
var button_size: float = 1.0
var control_opacity: float = 0.55
var mouse_sensitivity: float = 1.0
var gamepad_deadzone: float = 0.18

func _ready() -> void:
	var saved: Variant = SaveManager.load_json("settings")
	if typeof(saved) == TYPE_DICTIONARY:
		for k in saved.keys():
			if k in self:
				set(k, saved[k])
	fidelity = GlowRules.clamp_fidelity(fidelity)


func persist() -> void:
	SaveManager.save_json("settings", {
		"graphics_preset": graphics_preset,
		"render_scale": render_scale,
		"fidelity": GlowRules.clamp_fidelity(fidelity),
		"master_volume": master_volume,
		"music_volume": music_volume,
		"env_volume": env_volume,
		"predator_volume": predator_volume,
		"ui_volume": ui_volume,
		"invert_y": invert_y,
		"reduced_flash": reduced_flash,
		"reduced_shake": reduced_shake,
		"camera_bob": camera_bob,
		"high_visibility_collectibles": high_visibility_collectibles,
		"ui_scale": ui_scale,
		"touch_scheme": touch_scheme,
		"joystick_size": joystick_size,
		"button_size": button_size,
		"control_opacity": control_opacity,
		"mouse_sensitivity": mouse_sensitivity,
		"gamepad_deadzone": gamepad_deadzone,
	})
