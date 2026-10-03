shader_type spatial;
render_mode cull_disabled;

uniform vec4 glow : source_color = vec4(0.25, 0.85, 0.7, 1.0);
uniform float pulse = 1.0;

varying vec3 world_pos;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = world_pos.xz;
	float n = sin(p.x * 0.31) + sin(p.y * 0.27) + sin((p.x + p.y) * 0.19);
	float litter = sin(p.x * 1.9) * sin(p.y * 1.7) * 0.5 + 0.5;
	float moss = smoothstep(0.15, 0.82, 0.52 + 0.22 * n);
	float veins = smoothstep(0.62, 0.92, sin(p.x * 0.85 + p.y * 0.4) * sin(p.y * 0.7) * 0.5 + 0.5);
	vec3 soil = vec3(0.028, 0.034, 0.024);
	vec3 duff = vec3(0.045, 0.055, 0.032);
	vec3 col = mix(soil, duff, litter * 0.55);
	ALBEDO = col;
	EMISSION = glow.rgb * (moss * (0.18 + 0.12 * pulse) + veins * 0.22 * pulse);
	ROUGHNESS = 0.95;
}
