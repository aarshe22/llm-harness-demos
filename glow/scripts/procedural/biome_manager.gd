class_name BiomeManager
extends RefCounted

const BIOMES := [
	"moonlit_grove", "emerald_hollow", "violet_fungal", "blackwood",
	"firefly_meadow", "crystal_creek", "ancient_grove", "thornwood",
	"mist_basin", "fallen_forest",
]

static func color_for(id: String) -> Color:
	match id:
		"moonlit_grove":
			return Color(0.45, 0.7, 1.0)
		"emerald_hollow":
			return Color(0.2, 0.95, 0.45)
		"violet_fungal":
			return Color(0.72, 0.28, 1.0)
		"blackwood":
			return Color(0.12, 0.14, 0.18)
		"firefly_meadow":
			return Color(1.0, 0.85, 0.25)
		"crystal_creek":
			return Color(0.25, 0.85, 1.0)
		"ancient_grove":
			return Color(0.35, 0.55, 0.3)
		"thornwood":
			return Color(0.45, 0.2, 0.25)
		"mist_basin":
			return Color(0.55, 0.75, 0.7)
		"fallen_forest":
			return Color(0.4, 0.32, 0.22)
	return Color(0.3, 0.6, 0.5)


static func pick(wx: int, wz: int, seed_value: int, weights: Dictionary) -> String:
	var total = 0.0
	var ids: Array[String] = []
	var wts: Array[float] = []
	for id in BIOMES:
		var w = float(weights.get(id, 1.0))
		if w > 0.0:
			ids.append(id)
			wts.append(w)
			total += w
	if ids.is_empty():
		return "moonlit_grove"
	var h = _hash(wx, wz, seed_value)
	var t = fposmod(h, total)
	var acc = 0.0
	for i in ids.size():
		acc += wts[i]
		if t <= acc:
			return ids[i]
	return ids[0]


static func _hash(x: int, z: int, seed_value: int) -> float:
	var n = seed_value * 374761393 + x * 668265263 + z * 1274126177
	n = (n ^ (n >> 13)) * 1274126177
	return float(n & 0x7fffffff) / 2147483647.0 * 10.0
