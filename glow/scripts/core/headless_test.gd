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
	failed += _check(Rules.clamp_fidelity(null) == 1, "fidelity default")
	failed += _check(Rules.clamp_fidelity(0) == 1, "fidelity min")
	failed += _check(Rules.clamp_fidelity(9) == 8, "fidelity max")
	failed += _check(Rules.clamp_fidelity(4.6) == 5, "fidelity round")
	failed += _check(Rules.step_cruise_altitude(8.0, 0.0, 1.0, 10.0) == 8.0, "altitude hold")
	failed += _check(Rules.step_cruise_altitude(8.0, 1.0, 0.5, 10.0) > 8.0, "explicit climb")
	failed += _check(absf(Rules.moth_track_wave(0.0, 0.0, 0.0)) < 0.0001, "zero wave amp")
	failed += _check(Rules.moth_flight_y(8.0, 1.0, 0.4, 0.42) != 8.0, "track undulates")
	print("GLOW headless tests failed=", failed)
	quit(failed)


func _check(ok: bool, label: String) -> int:
	if not ok:
		push_error("FAIL " + label)
		return 1
	print("ok ", label)
	return 0
