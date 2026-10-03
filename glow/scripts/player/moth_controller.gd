class_name MothController
extends CharacterBody3D

@onready var glow = $Glow
@onready var trail = $Trail
@onready var health = $Health
@onready var body_mesh: MeshInstance3D = $Body
@onready var wing_l: MeshInstance3D = $WingL
@onready var wing_r: MeshInstance3D = $WingR
@onready var light: OmniLight3D = $Light

var yaw: float = 0.0
var pitch: float = 0.0
var bank: float = 0.0
var bob_t: float = 0.0
var cruise_alt: float = 6.0
var wave_t: float = 0.0
var web_slow: float = 0.0
var distance_flown: float = 0.0
var max_alt: float = 0.0
var min_alt: float = 8.0

func _ready() -> void:
	floor_snap_length = 0.0
	motion_mode = MOTION_MODE_FLOATING
	cruise_alt = global_position.y
	_apply_fidelity()


func _apply_fidelity() -> void:
	var f = GlowRules.clamp_fidelity(SettingsManager.fidelity)
	if body_mesh and body_mesh.mesh is SphereMesh:
		var sm = body_mesh.mesh as SphereMesh
		if f > 1:
			sm.radial_segments = mini(32, 8 + f * 4)
			sm.rings = mini(24, 8 + f * 2)
			body_mesh.scale = Vector3(0.92, 0.85, 1.28)
	if f >= 3 and get_node_or_null("AntL") == null:
		var ant_mesh = CylinderMesh.new()
		ant_mesh.top_radius = 0.003
		ant_mesh.bottom_radius = 0.008
		ant_mesh.height = 0.22
		ant_mesh.radial_segments = 6
		var ant_mat = StandardMaterial3D.new()
		ant_mat.albedo_color = Color(0.9, 0.95, 1)
		ant_mat.emission_enabled = true
		ant_mat.emission = Color(0.7, 0.86, 1)
		var ant_l = MeshInstance3D.new()
		ant_l.name = "AntL"
		ant_l.mesh = ant_mesh
		ant_l.material_override = ant_mat
		ant_l.position = Vector3(-0.04, 0.12, -0.08)
		ant_l.rotation_degrees = Vector3(-40, 0, 20)
		add_child(ant_l)
		var ant_r = ant_l.duplicate()
		ant_r.name = "AntR"
		ant_r.position.x = 0.04
		ant_r.rotation_degrees.z = -20
		add_child(ant_r)
	if f >= 3 and get_node_or_null("HindL") == null and wing_l:
		var hind = wing_l.duplicate()
		hind.name = "HindL"
		hind.scale = Vector3(0.62, 0.62, 0.62)
		hind.position = Vector3(-0.12, 0.0, 0.06)
		add_child(hind)
		var hind_r = hind.duplicate()
		hind_r.name = "HindR"
		hind_r.position.x = 0.12
		add_child(hind_r)


func _physics_process(dt: float) -> void:
	if GameManager.phase != GameManager.Phase.PLAY or GameManager.paused:
		return
	var cfg = GameConfigManager.current_config
	var look = InputManager.consume_look()
	yaw -= look.x
	pitch = clampf(pitch - look.y, -1.15, 1.15)

	var wish = InputManager.move
	var boost = InputManager.boosting
	var dim: bool = InputManager.dimming and glow.overglow <= 0.1
	var accel: float = cfg.acceleration * (0.82 if dim else 1.0)
	var max_s: float = cfg.max_speed * (1.55 if boost else 1.0) * (0.78 if dim else 1.0)
	if glow.overglow > 0.0:
		max_s *= 1.08
	if web_slow > 0.0:
		max_s *= 0.28
		web_slow = maxf(0.0, web_slow - dt)

	var basis_y = Basis(Vector3.UP, yaw)
	var forward: Vector3 = -basis_y.z
	var right: Vector3 = basis_y.x
	var wish_dir = (forward * wish.y + right * wish.x)
	wish_dir.y = 0.0
	if wish_dir.length() > 0.001:
		wish_dir = wish_dir.normalized()
	else:
		wish_dir = forward * 0.15

	var target: Vector3 = wish_dir * max_s
	target.y = 0.0
	velocity = velocity.lerp(target, 1.0 - exp(-accel * dt * 0.2))
	velocity *= 1.0 - cfg.drag * dt * 0.12
	velocity.y = 0.0

	cruise_alt = GlowRules.step_cruise_altitude(cruise_alt, InputManager.rise, dt, cfg.vertical_speed)
	wave_t += dt
	var desired_y: float = GlowRules.moth_flight_y(cruise_alt, distance_flown, wave_t, cfg.track_wave_amount)
	velocity.y = (desired_y - global_position.y) / maxf(dt, 0.0001)

	var before = global_position
	move_and_slide()
	for i in range(get_slide_collision_count()):
		var c = get_slide_collision(i)
		var col = c.get_collider()
		if col and col.is_in_group("hard"):
			health.hit("hard", 0.28)
			velocity += c.get_normal() * 6.0
		elif col and col.is_in_group("medium"):
			health.hit("medium", 0.12)
		elif col and col.is_in_group("web"):
			web_slow = 1.4
	distance_flown += before.distance_to(global_position)
	max_alt = maxf(max_alt, global_position.y)
	min_alt = minf(min_alt, global_position.y)
	global_position.y = desired_y

	bank = lerpf(bank, -wish.x * cfg.bank_strength, 1.0 - exp(-6.0 * dt))
	bob_t += dt * (8.0 + velocity.length() * 0.35)
	var bob: float = sin(bob_t) * cfg.hover_bob_amount * (0.4 if SettingsManager.camera_bob else 0.15)
	rotation.y = yaw
	rotation.x = pitch * 0.35
	rotation.z = bank
	if body_mesh:
		body_mesh.position.y = 0.04 + bob
	_flap(dt)
	_update_light()


func _flap(dt: float) -> void:
	var hurt = 1.0 if int(health.state) == 0 else 1.7
	var flap = sin(Time.get_ticks_msec() * 0.028 * hurt) * 0.7
	if wing_l:
		wing_l.rotation.z = 0.55 + flap
	if wing_r:
		wing_r.rotation.z = -0.55 - flap
	var hind_l = get_node_or_null("HindL")
	var hind_r = get_node_or_null("HindR")
	if hind_l:
		hind_l.rotation.z = 0.35 + flap * 0.75
	if hind_r:
		hind_r.rotation.z = -0.35 - flap * 0.75


func _update_light() -> void:
	if light == null or glow == null:
		return
	var r: float = 7.0 * glow.intensity * GameConfigManager.current_config.player_light_radius
	light.omni_range = r
	light.light_energy = 1.1 * glow.intensity
	light.light_color = Color(0.85, 0.93, 1.0)
	if body_mesh and body_mesh.material_override:
		var m = body_mesh.material_override as StandardMaterial3D
		m.emission_energy_multiplier = 2.2 * glow.intensity
