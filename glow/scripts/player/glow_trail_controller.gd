class_name GlowTrailController
extends Node
## Logical trail (AI) is independent of the visual ribbon.

class Sample:
	var position: Vector3
	var time: float
	var intensity: float
	var direction: Vector3
	var velocity: Vector3

var samples: Array[Sample] = []
var visual: MeshInstance3D
var _accum: float = 0.0
var clock: float = 0.0

func _ready() -> void:
	visual = MeshInstance3D.new()
	var im = ImmediateMesh.new()
	visual.mesh = im
	var mat = StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.albedo_color = Color(0.75, 0.9, 1.0, 0.35)
	mat.emission_enabled = true
	mat.emission = Color(0.7, 0.88, 1.0)
	mat.emission_energy_multiplier = 1.4
	visual.material_override = mat
	add_child(visual)


func _physics_process(dt: float) -> void:
	clock += dt
	var moth: Node3D = get_parent() as Node3D
	if moth == null:
		return
	var glow = moth.get_node_or_null("Glow")
	var intensity = glow.intensity if glow else 1.0
	var vel = Vector3.ZERO
	if moth is CharacterBody3D:
		vel = (moth as CharacterBody3D).velocity
	_accum += dt
	var step = 0.045
	if _accum >= step:
		_accum = 0.0
		var s = Sample.new()
		s.position = moth.global_position
		s.time = clock
		s.intensity = intensity * GameConfigManager.current_config.trail_brightness
		s.direction = (-moth.global_transform.basis.z).normalized()
		s.velocity = vel
		samples.append(s)
	_prune()
	_draw()


func _prune() -> void:
	var life = GameConfigManager.current_config.trail_lifetime * GameConfigManager.current_config.trail_length
	var i = 0
	while i < samples.size():
		if clock - samples[i].time > life:
			samples.remove_at(i)
		else:
			i += 1
	if samples.size() > 180:
		samples = samples.slice(samples.size() - 180)


func _draw() -> void:
	var im = visual.mesh as ImmediateMesh
	im.clear_surfaces()
	if samples.size() < 2:
		return
	im.surface_begin(Mesh.PRIMITIVE_LINE_STRIP)
	for s in samples:
		var age = clock - s.time
		var life = GameConfigManager.current_config.trail_lifetime
		var a = clampf(1.0 - age / maxf(0.2, life), 0.0, 1.0) * clampf(s.intensity, 0.05, 2.0)
		im.surface_set_color(Color(0.8, 0.93, 1.0, a * 0.65))
		im.surface_add_vertex(visual.to_local(s.position))
	im.surface_end()


func interest_at(pos: Vector3, sensitivity: float) -> Dictionary:
	var best = 0.0
	var best_pos = pos
	var best_dir = Vector3.FORWARD
	for s in samples:
		var age = clock - s.time
		var life = GameConfigManager.current_config.trail_lifetime
		var fresh = clampf(1.0 - age / maxf(0.2, life), 0.0, 1.0)
		var dist = pos.distance_to(s.position)
		var dist_f = clampf(1.0 - dist / 28.0, 0.0, 1.0)
		var v: float = s.intensity * fresh * sensitivity * dist_f * GameConfigManager.current_config.trail_predator_attract
		if v > best:
			best = v
			best_pos = s.position
			best_dir = s.direction
	return {"interest": best, "position": best_pos, "direction": best_dir}
