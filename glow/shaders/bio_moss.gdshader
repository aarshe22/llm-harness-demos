shader_type spatial;
render_mode cull_back;

uniform vec4 dark : source_color = vec4(0.03, 0.025, 0.02, 1.0);
uniform vec4 glow : source_color = vec4(0.2, 0.95, 0.55, 1.0);
uniform float pulse = 1.0;

void fragment() {
	float veins = sin(VERTEX.x * 4.0 + TIME * 0.4) * sin(VERTEX.y * 3.2);
	float m = smoothstep(0.35, 0.85, veins * 0.5 + 0.5);
	ALBEDO = dark.rgb;
	EMISSION = glow.rgb * m * 0.8 * pulse;
	ROUGHNESS = 0.92;
}
