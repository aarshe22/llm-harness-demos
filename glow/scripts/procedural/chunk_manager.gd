class_name ChunkManager
extends Node3D

const Biome := preload("res://scripts/procedural/biome_manager.gd")

var chunks: Dictionary = {}
var moth: Node3D
var fireflies: Array[Node3D] = []
var predators: Array[Node3D] = []
var rng = RandomNumberGenerator.new()

func setup(p_moth: Node3D) -> void:
	moth = p_moth
	rng.seed = GameConfigManager.current_config.seed_value


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
		(chunks[k] as Node).queue_free()
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
	var box = BoxMesh.new()
	box.size = Vector3(cfg.chunk_size, 0.8, cfg.chunk_size)
	mesh.mesh = box
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.03, 0.04, 0.03)
	mat.roughness = 1.0
	var glow = Biome.color_for(biome)
	mat.emission_enabled = true
	mat.emission = glow
	mat.emission_energy_multiplier = 0.04 * cfg.moss_density
	mesh.material_override = mat
	mesh.position = origin + Vector3(cfg.chunk_size * 0.5, -0.4, cfg.chunk_size * 0.5)
	node.add_child(mesh)
	var body = StaticBody3D.new()
	var col = CollisionShape3D.new()
	var shp = BoxShape3D.new()
	shp.size = box.size
	col.shape = shp
	body.add_child(col)
	body.position = mesh.position
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
	for i in n:
		var p = origin + Vector3(local.randf() * cfg.chunk_size, 0, local.randf() * cfg.chunk_size)
		var h = local.randf_range(8.0, 22.0)
		if biome == "ancient_grove":
			h *= 1.35
		var trunk = MeshInstance3D.new()
		var cyl = CylinderMesh.new()
		cyl.top_radius = local.randf_range(0.28, 0.7)
		cyl.bottom_radius = cyl.top_radius * 1.25
		cyl.height = h
		trunk.mesh = cyl
		var tm = StandardMaterial3D.new()
		tm.albedo_color = Color(0.04, 0.03, 0.025)
		tm.emission_enabled = true
		tm.emission = Biome.color_for(biome)
		tm.emission_energy_multiplier = 0.12 if biome != "blackwood" else 0.02
		trunk.material_override = tm
		trunk.position = p + Vector3(0, h * 0.5, 0)
		node.add_child(trunk)
		var body = StaticBody3D.new()
		var col = CollisionShape3D.new()
		var shp = CylinderShape3D.new()
		shp.radius = cyl.bottom_radius
		shp.height = h
		col.shape = shp
		body.add_child(col)
		body.position = trunk.position
		body.add_to_group("hard")
		node.add_child(body)


func _plants(node: Node3D, origin: Vector3, biome: String, cfg) -> void:
	var local = RandomNumberGenerator.new()
	local.seed = cfg.seed_value + 99 + int(origin.x)
	var count = int(10.0 * cfg.mushroom_density + 8.0 * cfg.flower_density)
	for i in count:
		var p = origin + Vector3(local.randf() * cfg.chunk_size, 0.2, local.randf() * cfg.chunk_size)
		var mi = MeshInstance3D.new()
		var sph = SphereMesh.new()
		sph.radius = local.randf_range(0.12, 0.38)
		sph.height = sph.radius * 2.0
		mi.mesh = sph
		var m = StandardMaterial3D.new()
		m.albedo_color = Color(0.02, 0.02, 0.03)
		m.emission_enabled = true
		m.emission = Biome.color_for(biome).lerp(Color(1, 0.3, 0.8), local.randf() * 0.4)
		m.emission_energy_multiplier = 1.6
		mi.material_override = m
		mi.position = p
		node.add_child(mi)


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
	var pred_script = preload("res://scripts/ai/predator.gd")
	var n = CharacterBody3D.new()
	n.set_script(pred_script)
	n.kind = kind
	n.position = p
	node.add_child(n)
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
