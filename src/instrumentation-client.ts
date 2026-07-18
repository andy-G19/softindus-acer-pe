import { NAV_TRANSITION_START_EVENT } from "@/lib/nav-progress";

export function onRouterTransitionStart() {
  window.dispatchEvent(new Event(NAV_TRANSITION_START_EVENT));
}
