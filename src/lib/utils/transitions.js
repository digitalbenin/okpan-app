import { cubicInOut } from "svelte/easing";

/**
 * Creates a top-down curtain style overlay transition.
 * @param {HTMLElement} node Transition target node.
 * @param {{delay: (number|undefined), duration: (number|undefined), easing: (Function|undefined), y: (number|undefined), opacity: (number|undefined), scale: (number|undefined)}} [params={}] Transition parameters.
 * @returns {{delay: number, duration: number, easing: Function, css: Function}} Svelte transition config.
 */
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