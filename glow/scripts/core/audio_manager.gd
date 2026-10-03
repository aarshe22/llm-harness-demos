extends Node
## Procedural placeholder audio. Replace streams later without changing call sites.

var _player: AudioStreamPlayer
var _rng = RandomNumberGenerator.new()

func _ready() -> void:
	_player = AudioStreamPlayer.new()
	add_child(_player)
	_ensure_bus("Music")
	_ensure_bus("Environment")
	_ensure_bus("Predators")
	_ensure_bus("UI")


func _ensure_bus(bus_name: String) -> void:
	if AudioServer.get_bus_index(bus_name) == -1:
		AudioServer.add_bus()
		AudioServer.set_bus_name(AudioServer.bus_count - 1, bus_name)


func set_volumes() -> void:
	AudioServer.set_bus_volume_db(0, linear_to_db(SettingsManager.master_volume))


func play_tone(hz: float, seconds: float, vol: float = 0.12) -> void:
	var gen = AudioStreamGenerator.new()
	gen.mix_rate = 22050
	gen.buffer_length = 0.1
	var p = AudioStreamPlayer.new()
	add_child(p)
	p.stream = gen
	p.volume_db = linear_to_db(vol * SettingsManager.master_volume)
	p.play()
	var pb = p.get_stream_playback() as AudioStreamGeneratorPlayback
	if pb == null:
		p.queue_free()
		return
	var frames = int(seconds * gen.mix_rate)
	var phase = 0.0
	for i in frames:
		var s = sin(phase) * (1.0 - float(i) / float(frames))
		pb.push_frame(Vector2(s, s))
		phase += TAU * hz / gen.mix_rate
	await get_tree().create_timer(seconds + 0.05).timeout
	p.queue_free()


func chime() -> void:
	play_tone(880.0 + _rng.randf() * 220.0, 0.12, 0.09)


func flutter() -> void:
	play_tone(180.0 + _rng.randf() * 40.0, 0.05, 0.04)


func danger() -> void:
	play_tone(90.0, 0.28, 0.14)


func hoot() -> void:
	play_tone(140.0, 0.4, 0.1)
