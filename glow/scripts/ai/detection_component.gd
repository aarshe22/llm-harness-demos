class_name DetectionComponent
extends RefCounted

static func score(distance: float, vision_range: float, glow: float, movement: float, species: float, los: bool, env_vis: float) -> float:
	return GlowRules.detection_score(distance, vision_range, glow, movement, species, los, env_vis)
