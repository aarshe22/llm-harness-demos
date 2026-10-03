class_name SafeAreaManager
extends Node

static func margins(viewport: Viewport) -> Vector4:
	var r = viewport.get_visible_rect()
	var portrait = r.size.y > r.size.x
	var pad = 28.0 if portrait else 20.0
	return Vector4(pad, pad, pad, pad)
