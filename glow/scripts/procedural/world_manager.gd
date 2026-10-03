class_name WorldManager
extends Node
## Facade used by later milestones; chunk streaming lives on ChunkManager.

@export var chunks_path: NodePath

func stream_around(moth: Node3D) -> void:
	var c = get_node_or_null(chunks_path)
	if c and c.moth == null:
		c.setup(moth)
