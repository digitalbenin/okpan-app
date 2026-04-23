import { cubicInOut } from "svelte/easing";

export function topCurtainOverlay(node, params = {}) {
    const {
        delay = 0,
        duration = 220,
        easing = cubicInOut,
        y = -18,
        opacity = 0.1,
        scale = 0.985
    } = params;

    return {
        delay,
        duration,
        easing,
        css: (t, u) => `
            opacity: ${opacity + t * (1 - opacity)};
            transform: translateY(${u * y}px) scaleY(${scale + t * (1 - scale)});
            transform-origin: top;
            clip-path: inset(0 0 ${u * 100}% 0);
        `
    };
}