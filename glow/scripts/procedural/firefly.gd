extends Node3D

var color: Color = Color(1.0, 0.85, 0.3)
var collected: bool = false
var t: float = 0.0
var mesh: MeshInstance3D
var rare: bool = false

func _ready() -> void:
	var r = randf()
	if r > 0.92:
		color = Color(0.95, 0.35, 0.85)
		rare = true
	elif r > 0.6:
		color = Color(0.55, 1.0, 0.7)
	elif r > 0.35:
		color = Color(0.45, 0.95, 1.0)
	mesh = MeshInstance3D.new()
	var s = SphereMesh.new()
	s.radius = 0.09 if not SettingsManager.high_visibility_collectibles else 0.16
	s.height = s.radius * 2.0
	var fid := GlowRules.clamp_fidelity(SettingsManager.fidelity)
	if fid > 1:
		s.radial_segments = mini(16, 6 + fid)
		s.rings = mini(12, 4 + fid)
	mesh.mesh = s
	var m = StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = color
	m.emission_enabled = true
	m.emission = color
	m.emission_energy_multiplier = 3.4
	mesh.material_override = m
	add_child(mesh)
	t = randf() * TAU


func _process(dt: float) -> void:
	if collected or GameManager.phase != GameManager.Phase.PLAY:
		return
	t += dt
	position.y += sin(t * 2.4) * 0.008
	var moth: Node = get_tree().get_first_node_in_group("moth")
	if moth == null:
		return
	var glow = moth.get_node_or_null("Glow")
	var attract = 0.0
	if glow:
		attract = glow.intensity * GameConfigManager.current_config.firefly_attraction
	var d: float = global_position.distance_to(moth.global_position)
	var radius = 1.5 + attract * 1.8
	if glow:
		radius = glow.collect_radius()
	if d < 11.0 and attract > 0.35:
		global_position = global_position.lerp(moth.global_position, dt * attract * 0.9)
	if d < radius * 0.45:
		_collect(moth)


func _collect(moth: Node) -> void:
	collected = true
	GameManager.collect_firefly(1 if not rare else 3)
	var glow = moth.get_node_or_null("Glow")
	if glow:
		glow.collect_firefly()
	AudioManager.chime()
	queue_free()
