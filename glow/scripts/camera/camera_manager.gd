class_name CameraManager
extends Node3D
## First-person and above-behind follow. Switching does not change sim.

enum Mode { FOLLOW, FIRST }

var mode: Mode = Mode.FOLLOW
var blend: float = 1.0
var moth: Node3D
var cam: Camera3D
var _shake: float = 0.0

func setup(p_moth: Node3D, p_cam: Camera3D) -> void:
	moth = p_moth
	cam = p_cam
	var pref: Variant = SaveManager.load_json("camera")
	if pref == "first":
		mode = Mode.FIRST
		blend = 0.0


func toggle() -> void:
	mode = Mode.FIRST if mode == Mode.FOLLOW else Mode.FOLLOW
	SaveManager.save_json("camera", "first" if mode == Mode.FIRST else "follow")


func shake(amt: float) -> void:
	if SettingsManager.reduced_shake:
		return
	_shake = maxf(_shake, amt)


func _process(dt: float) -> void:
	if moth == null or cam == null:
		return
	var target = 0.0 if mode == Mode.FIRST else 1.0
	blend = lerpf(blend, target, 1.0 - exp(-dt / 0.35))
	_shake = maxf(0.0, _shake - dt * 4.0)

	var follow_pos = moth.global_position + moth.global_transform.basis * Vector3(0.0, 2.4, 6.2)
	if DisplayManager.portrait:
		follow_pos = moth.global_position + moth.global_transform.basis * Vector3(0.0, 3.1, 7.4)
	var speed = 0.0
	if moth is CharacterBody3D:
		speed = (moth as CharacterBody3D).velocity.length()
	follow_pos += -moth.global_transform.basis.z * (speed * 0.08)
	var fp_pos = moth.global_position + moth.global_transform.basis * Vector3(0.0, 0.12, -0.18)
	var pos = fp_pos.lerp(follow_pos, blend)
	if _shake > 0.0:
		pos += Vector3(randf() - 0.5, randf() - 0.5, randf() - 0.5) * _shake * 0.15
	cam.global_position = cam.global_position.lerp(pos, 1.0 - exp(-8.0 * dt))
	var look_at = moth.global_position + (-moth.global_transform.basis.z) * (4.0 + speed * 0.2)
	if blend < 0.25:
		look_at = moth.global_position + (-moth.global_transform.basis.z) * 8.0
	if DisplayManager.portrait and blend > 0.5:
		# Moth sits ~65% down the frame: look slightly above moth.
		look_at += Vector3.UP * 1.6
	cam.look_at(look_at, Vector3.UP)
	cam.fov = lerpf(78.0, 62.0, blend) + speed * 0.35
