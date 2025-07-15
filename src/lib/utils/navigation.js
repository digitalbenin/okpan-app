import { browser } from "$app/environment";

export function back() {
    if (browser) window.history.back();
}