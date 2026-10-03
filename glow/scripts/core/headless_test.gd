extends SceneTree
## `godot --headless --path glow --script res://scripts/core/headless_test.gd`

const Rules := preload("res://scripts/core/glow_rules.gd")

func _init() -> void:
	var failed = 0
	failed += _check(Rules.detection_score(10.0, 34.0, 1.0, 1.0, 1.3, true, 1.0) > 0.2, "vision score")
	failed += _check(Rules.detection_score(40.0, 34.0, 1.0, 1.0, 1.3, true, 1.0) <= 0.0, "out of range")
	failed += _check(Rules.trail_interest(1.0, 1.0, 1.0, 1.0, 1.0) == 1.0, "trail product")
	failed += _check(Rules.final_score(10, 30.0, 50.0, 2, 1, 1) > 10, "score")
	failed += _check(Rules.overglow_ready(8, 1.0), "overglow")
	failed += _check(not Rules.overglow_ready(3, 1.0), "overglow gate")
	var split = Rules.lod_tree_split(20)
	failed += _check(split.x + split.y == 20, "lod split")
	print("GLOW headless tests failed=", failed)
	quit(failed)


func _check(ok: bool, label: String) -> int:
	if not ok:
		push_error("FAIL " + label)
		return 1
	print("ok ", label)
	return 0
