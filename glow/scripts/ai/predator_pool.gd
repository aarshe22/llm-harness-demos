class_name PredatorPool
extends Node

var _free: Dictionary = {}
var created: int = 0
var acquired: int = 0
var released: int = 0

func acquire(kind: String, pos: Vector3, parent: Node) -> Node:
	var bucket: Array = _free.get(kind, [])
	var n: Node
	if bucket.size() > 0:
		n = bucket.pop_back()
		_free[kind] = bucket
	else:
		var pred_script = preload("res://scripts/ai/predator.gd")
		n = CharacterBody3D.new()
		n.set_script(pred_script)
		n.kind = kind
		created += 1
	n.kind = kind
	if n.has_method("recycle"):
		n.recycle(pos)
	else:
		n.global_position = pos
	n.visible = true
	n.process_mode = Node.PROCESS_MODE_INHERIT
	if parent:
		parent.add_child(n)
		n.global_position = pos
	acquired += 1
	return n


func release(n: Node) -> void:
	if n == null:
		return
	n.visible = false
	n.process_mode = Node.PROCESS_MODE_DISABLED
	if n.get_parent():
		n.get_parent().remove_child(n)
	var kind = str(n.get("kind"))
	if not _free.has(kind):
		_free[kind] = []
	_free[kind].append(n)
	released += 1
