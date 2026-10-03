shader_type spatial;
render_mode cull_back;

uniform vec4 dark : source_color = vec4(0.035, 0.028, 0.02, 1.0);
uniform vec4 glow : source_color = vec4(0.25, 0.85, 0.7, 1.0);
uniform float pulse = 1.0;

varying vec3 wpos;
varying float ang;
varying float hgt;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float sy = length((MODEL_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
	ang = atan(VERTEX.x, VERTEX.z);
	hgt = (VERTEX.y + 0.5) * max(sy, 0.001);
}

void fragment() {
	float grain = sin(ang * 12.0 + hgt * 0.38);
	float grain2 = sin(ang * 7.0 - hgt * 0.21 + 1.3);
	float veins = smoothstep(0.52, 0.9, grain * 0.62 + grain2 * 0.28 + 0.5);
	float moss = smoothstep(0.18, 0.72, 0.5 + 0.5 * sin(wpos.x * 0.55 + wpos.z * 0.48 + hgt * 0.12));
	ALBEDO = mix(dark.rgb, glow.rgb * 0.35, veins * 0.7);
	EMISSION = glow.rgb * (veins * 0.75 + moss * 0.16) * pulse;
	ROUGHNESS = 0.94;
}
