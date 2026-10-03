extends CharacterBody3D
## Wildlife predator: vision + trail + species-specific motion. Not a shooter.

@export var kind: String = "owl"

enum State { IDLE, ROAM, PERCH, OBSERVE, ALERT, INVESTIGATE, TRAIL, CHASE, ATTACK, SEARCH, RETURN }

var state: State = State.IDLE
var home: Vector3
var t: float = 0.0
var interest: float = 0.0
var trail_target: Vector3
var escaped_flag: bool = false

func recycle(pos: Vector3) -> void:
	home = pos
	global_position = pos
	velocity = Vector3.ZERO
	t = 0.0
	interest = 0.0
	escaped_flag = false
	state = State.PERCH if kind == "owl" else State.ROAM


func _ready() -> void:
	home = global_position
	add_to_group("predator")
	var mi = MeshInstance3D.new()
	var mesh: PrimitiveMesh
	var fid := GlowRules.clamp_fidelity(SettingsManager.fidelity)
	match kind:
		"owl", "crow":
			if fid <= 1:
				var b = BoxMesh.new()
				b.size = Vector3(0.7, 0.35, 1.1)
				mesh = b
			else:
				var s_owl = SphereMesh.new()
				s_owl.radius = 0.32
				s_owl.height = 0.5
				s_owl.radial_segments = mini(20, 6 + fid * 2)
				mesh = s_owl
		"bat", "dragonfly":
			var s = SphereMesh.new()
			s.radius = 0.22
			s.height = 0.44
			if fid > 1:
				s.radial_segments = mini(20, 6 + fid * 2)
			mesh = s
		"bobcat", "fox", "raccoon":
			if fid <= 1:
				var c = BoxMesh.new()
				c.size = Vector3(0.7, 0.45, 1.3)
				mesh = c
			else:
				var s_cat = SphereMesh.new()
				s_cat.radius = 0.34
				s_cat.height = 0.5
				s_cat.radial_segments = mini(20, 6 + fid * 2)
				mesh = s_cat
		"frog", "snake", "mantis":
			var s2 = SphereMesh.new()
			s2.radius = 0.28
			s2.height = 0.4
			if fid > 1:
				s2.radial_segments = mini(20, 6 + fid * 2)
			mesh = s2
		_:
			var s3 = SphereMesh.new()
			s3.radius = 0.3
			s3.height = 0.6
			if fid > 1:
				s3.radial_segments = mini(20, 6 + fid * 2)
			mesh = s3
	mi.mesh = mesh
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.05, 0.05, 0.06)
	mat.emission_enabled = true
	mat.emission = Color(0.9, 0.15, 0.1) if kind in ["owl", "bobcat"] else Color(0.7, 0.5, 0.2)
	mat.emission_energy_multiplier = 0.35
	mi.material_override = mat
	if fid > 1 and kind in ["owl", "crow", "bobcat", "fox"]:
		mi.scale = Vector3(0.8, 0.65, 1.55)
	add_child(mi)
	if fid >= 3 and kind in ["owl", "crow", "bat", "dragonfly"]:
		var wmat = StandardMaterial3D.new()
		wmat.albedo_color = Color(0.08, 0.08, 0.1)
		wmat.cull_mode = BaseMaterial3D.CULL_DISABLED
		var wmesh = QuadMesh.new()
		wmesh.size = Vector2(0.8, 0.28)
		var wl = MeshInstance3D.new()
		wl.mesh = wmesh
		wl.material_override = wmat
		wl.position = Vector3(-0.4, 0.05, 0)
		var wr = wl.duplicate()
		wr.position.x = 0.4
		add_child(wl)
		add_child(wr)
	var eyes = MeshInstance3D.new()
	var es = SphereMesh.new()
	es.radius = 0.06
	es.height = 0.12
	eyes.mesh = es
	var em = StandardMaterial3D.new()
	em.emission_enabled = true
	em.emission = Color(1, 0.15, 0.08)
	em.emission_energy_multiplier = 4.0
	em.albedo_color = Color(0.1, 0, 0)
	eyes.material_override = em
	eyes.position = Vector3(0.12, 0.12, -0.45)
	add_child(eyes)
	var col = CollisionShape3D.new()
	var shp = SphereShape3D.new()
	shp.radius = 0.45
	col.shape = shp
	add_child(col)
	match kind:
		"owl":
			state = State.PERCH
		"crow":
			state = State.ROAM
		"bat", "dragonfly":
			state = State.ROAM
		_:
			state = State.IDLE


func _physics_process(dt: float) -> void:
	if GameManager.paused or GameManager.phase != GameManager.Phase.PLAY:
		return
	if GameManager.debug_ai_off:
		return
	t += dt
	var moth = get_tree().get_first_node_in_group("moth") as Node3D
	if moth == null:
		return
	_sense(moth)
	_think(moth)
	_act(dt, moth)
	_strike(moth)


func _sense(moth: Node3D) -> void:
	var glow = moth.get_node_or_null("Glow")
	var g = glow.detection_multiplier() if glow else 1.0
	var dist = global_position.distance_to(moth.global_position)
	var range = _vision_range()
	var los = true
	var dist_f = clampf(1.0 - dist / range, 0.0, 1.0)
	var move_f = 0.6
	if moth is CharacterBody3D:
		move_f = clampf((moth as CharacterBody3D).velocity.length() / 16.0, 0.25, 1.4)
	interest = dist_f * g * move_f * _species_vision() * (1.0 if los else 0.25)
	var trail = moth.get_node_or_null("Trail")
	if trail:
		var info: Dictionary = trail.interest_at(global_position, _trail_sense())
		if float(info.interest) > interest * 0.7:
			interest = maxf(interest, float(info.interest))
			trail_target = info.position
			if state in [State.IDLE, State.ROAM, State.PERCH, State.OBSERVE] and float(info.interest) > 0.28:
				state = State.TRAIL


func _think(moth: Node3D) -> void:
	match state:
		State.PERCH, State.IDLE, State.ROAM, State.OBSERVE:
			if interest > 0.42:
				state = State.ALERT
				if kind == "owl":
					AudioManager.hoot()
		State.ALERT:
			if interest > 0.55:
				state = State.CHASE
			elif interest < 0.2:
				state = State.SEARCH
		State.TRAIL:
			if interest > 0.6:
				state = State.CHASE
			elif global_position.distance_to(trail_target) < 1.4:
				state = State.SEARCH
		State.CHASE:
			if interest < 0.18:
				state = State.SEARCH
				if not escaped_flag:
					escaped_flag = true
					GameManager.predator_escaped()
		State.SEARCH:
			if interest > 0.4:
				state = State.CHASE
			elif t > 8.0:
				state = State.RETURN
		State.RETURN:
			if global_position.distance_to(home) < 2.0:
				state = State.PERCH if kind == "owl" else State.ROAM
				escaped_flag = false
				t = 0.0


func _act(dt: float, moth: Node3D) -> void:
	var dest = home
	var spd = _speed()
	match state:
		State.PERCH:
			dest = home
			spd *= 0.15
		State.ROAM, State.IDLE:
			dest = home + Vector3(sin(t * 0.4), cos(t * 0.25) * 0.4, cos(t * 0.33)) * 6.0
		State.ALERT, State.OBSERVE:
			dest = moth.global_position
			spd *= 0.35
			look_at(moth.global_position, Vector3.UP)
		State.TRAIL:
			dest = trail_target
		State.CHASE, State.ATTACK:
			dest = moth.global_position
			if kind == "crow":
				dest += moth.global_transform.basis.z * -3.0
			if kind in ["bobcat", "fox"] and moth.global_position.y > 4.5:
				dest.y = 1.2
			if kind == "frog":
				spd *= 0.2
				if global_position.distance_to(moth.global_position) < 7.0 and moth.global_position.y < 4.0:
					dest = moth.global_position
					spd = 28.0
		State.SEARCH:
			dest = moth.global_position + Vector3(sin(t), 0.4, cos(t)) * 5.0
		State.RETURN:
			dest = home
	var to = dest - global_position
	if to.length() > 0.05:
		velocity = velocity.lerp(to.normalized() * spd, 1.0 - exp(-3.0 * dt))
	if kind in ["bobcat", "fox", "frog", "raccoon", "snake"]:
		global_position.y = maxf(0.4, global_position.y)
		if kind != "frog" or state != State.CHASE:
			velocity.y = 0.0
	move_and_slide()


func _strike(moth: Node3D) -> void:
	var reach = 1.15 if kind != "frog" else 1.6
	if global_position.distance_to(moth.global_position) < reach and state in [State.CHASE, State.ATTACK, State.ALERT]:
		if moth.is_in_group("moth"):
			var mc = moth
			if global_position.distance_to(moth.global_position) < 0.55:
				mc.health.hit("predator", 1.0)
			elif global_position.distance_to(moth.global_position) < 1.05:
				GameManager.near_miss()
				var cam = get_tree().get_first_node_in_group("cam_mgr")
				if cam and cam.has_method("shake"):
					cam.shake(0.6)


func _vision_range() -> float:
	match kind:
		"owl":
			return 34.0
		"crow":
			return 28.0
		"bat":
			return 14.0
		"bobcat":
			return 18.0
		"dragonfly":
			return 16.0
		_:
			return 12.0


func _species_vision() -> float:
	match kind:
		"owl":
			return 1.3
		"bat":
			return 0.55
		"crow":
			return 1.1
		_:
			return 0.85


func _trail_sense() -> float:
	match kind:
		"owl", "fox":
			return 1.2
		"crow":
			return 1.0
		"bat":
			return 0.25
		"bobcat":
			return 0.8
		_:
			return 0.5


func _speed() -> float:
	match kind:
		"owl":
			return 13.0
		"crow":
			return 11.5
		"bat", "dragonfly":
			return 16.0
		"bobcat":
			return 9.0
		"fox":
			return 10.0
		_:
			return 6.0
