shader_type spatial;
render_mode cull_back;

uniform vec4 dark : source_color = vec4(0.035, 0.028, 0.02, 1.0);
uniform vec4 glow : source_color = vec4(0.25, 0.85, 0.7, 1.0);
uniform float pulse = 1.0;

void fragment() {
	float rings = sin(VERTEX.y * 9.0 + VERTEX.x * 2.4) * sin(VERTEX.y * 3.1 + 1.7);
	float veins = smoothstep(0.42, 0.92, rings * 0.5 + 0.5);
	float moss = smoothstep(0.15, 0.55, 0.5 + 0.5 * sin(VERTEX.x * 14.0 + VERTEX.z * 11.0));
	ALBEDO = mix(dark.rgb, glow.rgb * 0.35, veins * 0.7);
	EMISSION = glow.rgb * (veins * 0.55 + moss * 0.12) * pulse;
	ROUGHNESS = 0.94;
}
