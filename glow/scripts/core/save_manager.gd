extends Node

const PATH := "user://glow_save.json"

var data: Dictionary = {}

func _ready() -> void:
	_load()


func _load() -> void:
	if not FileAccess.file_exists(PATH):
		data = _defaults()
		return
	var f = FileAccess.open(PATH, FileAccess.READ)
	if f == null:
		data = _defaults()
		return
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	data = parsed if typeof(parsed) == TYPE_DICTIONARY else _defaults()


func _defaults() -> Dictionary:
	return {
		"high_score": 0,
		"longest_survival": 0.0,
		"longest_distance": 0.0,
		"most_fireflies": 0,
		"camera": "follow",
		"settings": {},
	}


func save_all() -> void:
	var f = FileAccess.open(PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(data))


func save_json(key: String, value: Variant) -> void:
	data[key] = value
	save_all()


func load_json(key: String) -> Variant:
	return data.get(key, null)


func record_run(score: int, survival: float, distance: float, fireflies: int) -> void:
	data["high_score"] = maxi(int(data.get("high_score", 0)), score)
	data["longest_survival"] = maxf(float(data.get("longest_survival", 0.0)), survival)
	data["longest_distance"] = maxf(float(data.get("longest_distance", 0.0)), distance)
	data["most_fireflies"] = maxi(int(data.get("most_fireflies", 0)), fireflies)
	save_all()
