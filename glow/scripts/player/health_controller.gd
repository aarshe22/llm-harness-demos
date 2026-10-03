class_name HealthController
extends Node

signal died
signal damaged(kind: String)

enum State { HEALTHY, DAMAGED, CRITICAL, DEAD }

var state: State = State.HEALTHY
var integrity: float = 1.0
var invuln: float = 0.0
var debug_invulnerable: bool = false

func _physics_process(dt: float) -> void:
	invuln = maxf(0.0, invuln - dt)
	if state == State.DEAD:
		return
	if state == State.DAMAGED:
		integrity = minf(1.0, integrity + dt * 0.08)
		if integrity > 0.82:
			state = State.HEALTHY
	elif state == State.CRITICAL:
		integrity = minf(0.7, integrity + dt * 0.04)
		if integrity > 0.55:
			state = State.DAMAGED


func hit(kind: String, amount: float) -> void:
	if state == State.DEAD or debug_invulnerable or invuln > 0.0:
		return
	if kind == "predator":
		integrity = 0.0
		state = State.DEAD
		died.emit()
		return
	integrity = maxf(0.0, integrity - amount)
	invuln = 0.55
	damaged.emit(kind)
	if integrity <= 0.0:
		state = State.DEAD
		died.emit()
	elif integrity < 0.35:
		state = State.CRITICAL
	else:
		state = State.DAMAGED
