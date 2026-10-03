class_name GlowRules
extends RefCounted
## Pure functions shared conceptually with the browser prototype tests.

static func detection_score(distance: float, vision_range: float, glow: float, movement: float, species: float, los: bool, env_vis: float) -> float:
	var dist_f = clampf(1.0 - distance / maxf(0.001, vision_range), 0.0, 1.0)
	return dist_f * glow * movement * species * (1.0 if los else 0.25) * env_vis


static func trail_interest(brightness: float, freshness: float, sensitivity: float, distance_factor: float, attract: float) -> float:
	return brightness * freshness * sensitivity * distance_factor * attract


static func final_score(fireflies: int, survival: float, distance: float, escaped: int, near_misses: int, overglow: int) -> int:
	return int(fireflies * 12.0 + survival * 2.0 + distance * 0.4 + escaped * 40.0 + near_misses * 25.0 + overglow * 30.0)


static func overglow_ready(combo: int, threshold_scale: float) -> bool:
	return combo >= int(8.0 * threshold_scale)


static func lod_tree_split(count: int, far_ratio: float = 0.55) -> Vector2i:
	var far = int(floor(float(count) * far_ratio))
	return Vector2i(count - far, far)


static func clamp_fidelity(v: Variant) -> int:
	var n = float(v) if typeof(v) == TYPE_INT or typeof(v) == TYPE_FLOAT or typeof(v) == TYPE_STRING else 1.0
	if is_nan(n) or is_inf(n):
		return 1
	return clampi(int(round(n)), 1, 8)


const MOTH_MIN_Y := 0.6
const MOTH_MAX_Y := 42.0


static func step_cruise_altitude(cruise_alt: float, rise: float, dt: float, vertical_speed: float) -> float:
	return clampf(cruise_alt + rise * vertical_speed * dt, MOTH_MIN_Y, MOTH_MAX_Y)


static func moth_track_wave(distance: float, t: float, amp: float = 0.42) -> float:
	return sin(distance * 0.55 + t * 2.15) * amp + sin(distance * 0.22 + t * 0.85) * amp * 0.38


static func moth_flight_y(cruise_alt: float, distance: float, t: float, amp: float) -> float:
	return clampf(cruise_alt + GlowRules.moth_track_wave(distance, t, amp), MOTH_MIN_Y, MOTH_MAX_Y)
