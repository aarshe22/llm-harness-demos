shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_opaque;

uniform vec4 glow_color : source_color = vec4(0.85, 0.93, 1.0, 1.0);
uniform float intensity : hint_range(0.0, 4.0) = 1.0;

void fragment() {
	float rim = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 1.6);
	ALBEDO = glow_color.rgb;
	EMISSION = glow_color.rgb * (0.65 + rim) * intensity;
	ALPHA = glow_color.a * (0.35 + rim * 0.65);
}
