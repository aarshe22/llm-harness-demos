class_name ChunkManager
extends Node3D

const Biome := preload("res://scripts/procedural/biome_manager.gd")
const FloorShader := preload("res://shaders/floor.gdshader")

const PoolScript := preload("res://scripts/ai/predator_pool.gd")
const BarkShader := preload("res://shaders/bark.gdshader")

var chunks: Dictionary = {}
var moth: Node3D
var fireflies: Array[Node3D] = []
var predators: Array[Node3D] = []
var rng = RandomNumberGenerator.new()
var pool

func setup(p_moth: Node3D) -> void:
	moth = p_moth
	rng.seed = GameConfigManager.current_config.seed_value
	if pool == null:
		pool = PoolScript.new()
		add_child(pool)


func _physics_process(_dt: float) -> void:
	if moth == null or GameManager.phase != GameManager.Phase.PLAY:
		return
	var cs = GameConfigManager.current_config.chunk_size
	var cx = int(floor(moth.global_position.x / cs))
	var cz = int(floor(moth.global_position.z / cs))
	var r = GameConfigManager.current_config.stream_radius
	var needed: Dictionary = {}
	for x in range(cx - r, cx + r + 1):
		for z in range(cz - r, cz + r + 1):
			var key = Vector2i(x, z)
			needed[key] = true
			if not chunks.has(key):
				_spawn_chunk(key)
	var stale: Array = []
	for k in chunks.keys():
		if not needed.has(k):
			stale.append(k)
	for k in stale:
		var dying = chunks[k] as Node
		for child in dying.get_children():
			if child.is_in_group("predator"):
				pool.release(child)
				predators.erase(child)
		dying.queue_free()
		chunks.erase(k)


func _spawn_chunk(key: Vector2i) -> void:
	var cfg = GameConfigManager.current_config
	var node = Node3D.new()
	node.name = "Chunk_%s_%s" % [key.x, key.y]
	add_child(node)
	chunks[key] = node
	var biome = Biome.pick(key.x, key.y, cfg.seed_value, cfg.biome_weights)
	node.set_meta("biome", biome)
	var origin = Vector3(key.x * cfg.chunk_size, 0, key.y * cfg.chunk_size)
	_ground(node, origin, biome, cfg)
	_trees(node, origin, biome, cfg)
	_plants(node, origin, biome, cfg)
	_fireflies(node, origin, biome, cfg)
	_wildlife(node, origin, biome, cfg)
	if biome == "thornwood" or biome == "violet_fungal":
		_webs(node, origin, cfg)


func _ground(node: Node3D, origin: Vector3, biome: String, cfg) -> void:
	var mesh = MeshInstance3D.new()
	var plane = PlaneMesh.new()
	plane.size = Vector2(cfg.chunk_size + 0.14, cfg.chunk_size + 0.14)
	var fid := GlowRules.clamp_fidelity(SettingsManager.fidelity)
	plane.subdivide_width = mini(36, 16 + fid * 2)
	plane.subdivide_depth = plane.subdivide_width
	mesh.mesh = plane
	var sm = ShaderMaterial.new()
	sm.shader = FloorShader
	sm.set_shader_parameter("glow", Biome.color_for(biome))
	mesh.material_override = sm
	mesh.position = origin + Vector3(cfg.chunk_size * 0.5, 0.0, cfg.chunk_size * 0.5)
	node.add_child(mesh)
	var body = StaticBody3D.new()
	var col = CollisionShape3D.new()
	var shp = BoxShape3D.new()
	shp.size = Vector3(cfg.chunk_size, 0.4, cfg.chunk_size)
	col.shape = shp
	body.add_child(col)
	body.position = origin + Vector3(cfg.chunk_size * 0.5, -0.2, cfg.chunk_size * 0.5)
	body.add_to_group("hard")
	node.add_child(body)


func _trees(node: Node3D, origin: Vector3, biome: String, cfg) -> void:
	var n = int(18.0 * cfg.tree_density)
	if biome == "firefly_meadow" or biome == "moonlit_grove":
		n = int(n * 0.45)
	if biome == "ancient_grove":
		n = int(n * 1.4)
	if biome == "blackwood":
		n = int(n * 1.2)
	var local = RandomNumberGenerator.new()
	local.seed = cfg.seed_value + int(origin.x) * 13 + int(origin.z) * 17
	var cyl = CylinderMesh.new()
	cyl.top_radius = 1.0
	cyl.bottom_radius = 1.15
	cyl.height = 1.0
	cyl.radial_segments = mini(32, 14 + GlowRules.clamp_fidelity(SettingsManager.fidelity) * 2)
	var mm = MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = cyl
	mm.instance_count = maxi(n, 1)
	var tm = ShaderMaterial.new()
	tm.shader = BarkShader
	tm.set_shader_parameter("glow", Biome.color_for(biome))
	var mmi = MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = tm
	mmi.visibility_range_end = 110.0
	mmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
	node.add_child(mmi)
	for i in n:
		var p = origin + Vector3(local.randf() * cfg.chunk_size, 0, local.randf() * cfg.chunk_size)
		var h = local.randf_range(8.0, 22.0)
		if biome == "ancient_grove":
			h *= 1.35
		var r = local.randf_range(0.28, 0.7)
		var xf = Transform3D(Basis.from_scale(Vector3(r, h, r)), p + Vector3(0, h * 0.5, 0))
		mm.set_instance_transform(i, xf)
		if i < int(n * 0.45):
			var body = StaticBody3D.new()
			var col = CollisionShape3D.new()
			var shp = CylinderShape3D.new()
			shp.radius = r
			shp.height = h
			col.shape = shp
			body.add_child(col)
			body.position = p + Vector3(0, h * 0.5, 0)
			body.add_to_group("hard")
			node.add_child(body)


func _plants(node: Node3D, origin: Vector3, biome: String, cfg) -> void:
	var local = RandomNumberGenerator.new()
	local.seed = cfg.seed_value + 99 + int(origin.x)
	var count = int(10.0 * cfg.mushroom_density + 8.0 * cfg.flower_density)
	var sph = SphereMesh.new()
	sph.radius = 1.0
	sph.height = 2.0
	var fid := GlowRules.clamp_fidelity(SettingsManager.fidelity)
	sph.radial_segments = mini(24, 10 + fid * 2)
	sph.rings = mini(16, 8 + fid)
	var mm = MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = sph
	mm.instance_count = maxi(count, 1)
	var m = StandardMaterial3D.new()
	m.albedo_color = Color(0.02, 0.02, 0.03)
	m.emission_enabled = true
	m.emission = Biome.color_for(biome)
	m.emission_energy_multiplier = 1.6
	var mmi = MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = m
	mmi.visibility_range_end = 70.0
	node.add_child(mmi)
	for i in count:
		var p = origin + Vector3(local.randf() * cfg.chunk_size, 0.2, local.randf() * cfg.chunk_size)
		var s = local.randf_range(0.12, 0.38)
		mm.set_instance_transform(i, Transform3D(Basis.from_scale(Vector3(s, s, s)), p))


func _fireflies(node: Node3D, origin: Vector3, biome: String, cfg) -> void:
	var n = int(6.0 * cfg.firefly_population * cfg.firefly_cluster_size)
	if biome == "firefly_meadow":
		n = int(n * 2.2)
	if biome == "blackwood":
		n = int(n * 0.35)
	var local = RandomNumberGenerator.new()
	local.seed = cfg.seed_value + 333 + int(origin.z)
	for i in n:
		var ff = preload("res://scripts/procedural/firefly.gd")
		var f: Node3D = Node3D.new()
		f.set_script(ff)
		f.position = origin + Vector3(local.randf() * cfg.chunk_size, local.randf_range(1.2, 9.0), local.randf() * cfg.chunk_size)
		node.add_child(f)
		fireflies.append(f)


func _wildlife(node: Node3D, origin: Vector3, biome: String, cfg) -> void:
	var local = RandomNumberGenerator.new()
	local.seed = cfg.seed_value + 777 + int(origin.x * 3 + origin.z)
	var diff = GameManager.difficulty_scale()
	_maybe_spawn(node, origin, local, "owl", cfg.owl_population * diff * (1.4 if biome == "ancient_grove" else 1.0), 8.0)
	_maybe_spawn(node, origin, local, "crow", cfg.crow_population * diff, 12.0)
	_maybe_spawn(node, origin, local, "bat", cfg.bat_population * diff * (1.3 if biome == "blackwood" else 1.0), 10.0)
	_maybe_spawn(node, origin, local, "frog", cfg.frog_population * diff, 1.0)
	_maybe_spawn(node, origin, local, "bobcat", cfg.bobcat_population * diff * (1.3 if biome == "fallen_forest" else 1.0), 0.6)
	_maybe_spawn(node, origin, local, "fox", cfg.fox_population * diff, 0.5)
	_maybe_spawn(node, origin, local, "dragonfly", cfg.dragonfly_population * diff * (1.4 if biome == "crystal_creek" else 1.0), 4.0)
	_maybe_spawn(node, origin, local, "raccoon", cfg.raccoon_population * 0.6, 0.8)
	_maybe_spawn(node, origin, local, "snake", cfg.snake_population * diff, 0.4)
	_maybe_spawn(node, origin, local, "mantis", cfg.mantis_population * diff, 2.2)


func _maybe_spawn(node: Node3D, origin: Vector3, local: RandomNumberGenerator, kind: String, weight: float, y: float) -> void:
	if local.randf() > clampf(0.18 * weight, 0.0, 0.72):
		return
	# Do not spawn on top of the moth.
	var p = origin + Vector3(local.randf() * GameConfigManager.current_config.chunk_size, y, local.randf() * GameConfigManager.current_config.chunk_size)
	if moth and p.distance_to(moth.global_position) < 16.0:
		return
	var n = pool.acquire(kind, p, node)
	predators.append(n)


func _webs(node: Node3D, origin: Vector3, cfg) -> void:
	var local = RandomNumberGenerator.new()
	local.seed = cfg.seed_value + 1200 + int(origin.x)
	if local.randf() > 0.45 * GameConfigManager.current_config.spider_population:
		return
	var web = Area3D.new()
	var cs = CollisionShape3D.new()
	var box = BoxShape3D.new()
	box.size = Vector3(2.8, 2.2, 0.18)
	cs.shape = box
	web.add_child(cs)
	web.position = origin + Vector3(local.randf() * cfg.chunk_size, local.randf_range(3.0, 9.0), local.randf() * cfg.chunk_size)
	web.add_to_group("web")
	web.body_entered.connect(func(b):
		if b.is_in_group("moth") and "web_slow" in b:
			b.web_slow = 1.6
	)
	var mi = MeshInstance3D.new()
	var qm = QuadMesh.new()
	qm.size = Vector2(2.8, 2.2)
	mi.mesh = qm
	var mat = StandardMaterial3D.new()
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = Color(0.8, 0.9, 1.0, 0.12)
	mi.material_override = mat
	web.add_child(mi)
	node.add_child(web)


func current_biome() -> String:
	if moth == null:
		return "moonlit_grove"
	var cs = GameConfigManager.current_config.chunk_size
	var key = Vector2i(int(floor(moth.global_position.x / cs)), int(floor(moth.global_position.z / cs)))
	if chunks.has(key):
		return str((chunks[key] as Node).get_meta("biome"))
	return "moonlit_grove"
