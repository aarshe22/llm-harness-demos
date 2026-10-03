extends Node3D

const MOTH_SCENE := preload("res://scenes/player/moth.tscn")
const ChunkManagerScript := preload("res://scripts/procedural/chunk_manager.gd")
const CameraManagerScript := preload("res://scripts/camera/camera_manager.gd")
const AtmosphereManagerScript := preload("res://scripts/environment/atmosphere_manager.gd")

var moth
var cam: Camera3D
var cam_mgr
var chunks
var atmosphere

func _ready() -> void:
	_build_world()
	_build_player()
	_build_sky()
	var hud_script = preload("res://scripts/ui/hud.gd")
	var hud = CanvasLayer.new()
	hud.set_script(hud_script)
	add_child(hud)
	var health = moth.get_node("Health")
	health.died.connect(GameManager.player_died)


func _build_world() -> void:
	chunks = ChunkManagerScript.new()
	chunks.name = "Chunks"
	chunks.add_to_group("chunks")
	add_child(chunks)


func _build_player() -> void:
	moth = MOTH_SCENE.instantiate()
	moth.position = Vector3(24, 6, 24)
	add_child(moth)
	if moth.body_mesh and moth.body_mesh.material_override == null:
		var m = StandardMaterial3D.new()
		m.albedo_color = Color(0.92, 0.96, 1)
		m.emission_enabled = true
		m.emission = Color(0.85, 0.93, 1)
		m.emission_energy_multiplier = 2.4
		moth.body_mesh.material_override = m
	cam = Camera3D.new()
	cam.current = true
	add_child(cam)
	cam_mgr = CameraManagerScript.new()
	cam_mgr.add_to_group("cam_mgr")
	add_child(cam_mgr)
	cam_mgr.setup(moth, cam)
	chunks.setup(moth)


func _build_sky() -> void:
	var we = WorldEnvironment.new()
	var env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.015, 0.02, 0.05)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.04, 0.06, 0.1)
	env.ambient_light_energy = 0.15
	env.fog_enabled = true
	env.fog_light_color = Color(0.04, 0.08, 0.12)
	env.fog_density = 0.012
	env.glow_enabled = true
	env.glow_intensity = 1.0
	env.glow_bloom = 0.4
	env.glow_hdr_threshold = 0.4
	env.volumetric_fog_enabled = false
	we.environment = env
	add_child(we)

	var moon = MeshInstance3D.new()
	var sph = SphereMesh.new()
	sph.radius = 18.0 * GameConfigManager.current_config.moon_size
	sph.height = sph.radius * 2.0
	moon.mesh = sph
	var mm = StandardMaterial3D.new()
	mm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mm.albedo_color = Color(0.85, 0.9, 1.0)
	mm.emission_enabled = true
	mm.emission = Color(0.75, 0.85, 1.0)
	mm.emission_energy_multiplier = 2.2 * GameConfigManager.current_config.moon_brightness
	moon.material_override = mm
	moon.position = Vector3(80, 70, -180)
	add_child(moon)

	var moon_light = DirectionalLight3D.new()
	moon_light.light_color = Color(0.55, 0.65, 0.85)
	moon_light.light_energy = 0.18 * GameConfigManager.current_config.moon_brightness
	moon_light.rotation_degrees = Vector3(-25, 40, 0)
	add_child(moon_light)

	_stars()

	atmosphere = AtmosphereManagerScript.new()
	add_child(atmosphere)
	atmosphere.setup(we, moon)


func _stars() -> void:
	var n = int(220 * GameConfigManager.current_config.star_density)
	var rng = RandomNumberGenerator.new()
	rng.seed = GameConfigManager.current_config.seed_value + 5
	var parent = Node3D.new()
	parent.name = "Stars"
	add_child(parent)
	for i in n:
		var s = MeshInstance3D.new()
		var sm = SphereMesh.new()
		sm.radius = rng.randf_range(0.08, 0.28)
		sm.height = sm.radius * 2.0
		s.mesh = sm
		var mat = StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.albedo_color = Color(0.8, 0.88, 1.0)
		s.material_override = mat
		var dir = Vector3(rng.randf() - 0.5, rng.randf() * 0.55 + 0.15, rng.randf() - 0.5).normalized()
		s.position = dir * 220.0
		parent.add_child(s)


func _process(_dt: float) -> void:
	if moth and GameManager.phase == GameManager.Phase.PLAY:
		GameManager.note_region(chunks.current_biome())
