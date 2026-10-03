class_name CollectionController
extends Node

func radius_for(glow) -> float:
	return glow.collect_radius() if glow else 1.6
