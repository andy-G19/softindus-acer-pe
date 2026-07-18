// `src/instrumentation-client.ts` is bundled as part of Next's main-app entry,
// a separate chunk from the app's client-component tree — a module-scope
// singleton imported from both sides is not guaranteed to be the same
// instance. A `window` event is the one channel guaranteed to reach this
// module's live instance regardless of bundling.
export const NAV_TRANSITION_START_EVENT = "acer:nav-transition-start";

type NavProgressState = {
  active: boolean;
  value: number;
};

type Listener = () => void;

const IDLE_STATE: NavProgressState = { active: false, value: 0 };
const TRICKLE_INTERVAL_MS = 300;
const MAX_TRICKLE_VALUE = 90;
const FORCE_FINISH_MS = 8000;
const HIDE_DELAY_MS = 220;

let state: NavProgressState = IDLE_STATE;
const listeners = new Set<Listener>();

let trickleTimer: ReturnType<typeof setInterval> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let forceFinishTimer: ReturnType<typeof setTimeout> | undefined;

function setState(next: NavProgressState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function clearTimers() {
  clearInterval(trickleTimer);
  clearTimeout(hideTimer);
  clearTimeout(forceFinishTimer);
}

/** Runs when any navigation begins (triggered via NAV_TRANSITION_START_EVENT). */
function startNavProgress() {
  clearTimers();
  setState({ active: true, value: 8 });

  // Eases toward MAX_TRICKLE_VALUE but never reaches it, since real navigation
  // duration is unknown — mirrors the classic NProgress/YouTube trickle.
  trickleTimer = setInterval(() => {
    setState({
      active: true,
      value: state.value + (MAX_TRICKLE_VALUE - state.value) * 0.15,
    });
  }, TRICKLE_INTERVAL_MS);

  // Safety net: if navigation never produces a route change we can detect
  // (e.g. same-URL link, router.refresh()), don't leave the bar stuck.
  forceFinishTimer = setTimeout(finishNavProgress, FORCE_FINISH_MS);
}

/** Called once the new route has rendered (pathname/searchParams changed). */
export function finishNavProgress() {
  if (!state.active) return;

  clearTimers();
  setState({ active: true, value: 100 });

  hideTimer = setTimeout(() => {
    setState(IDLE_STATE);
  }, HIDE_DELAY_MS);
}

// Covers Link/router.push/back-forward navigations (dispatched from
// src/instrumentation-client.ts, which can't reach this module directly — see
// the note above).
if (typeof window !== "undefined") {
  window.addEventListener(NAV_TRANSITION_START_EVENT, startNavProgress);
}

let inFlightRequests = 0;
let fetchPatched = false;

function isPrefetchRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const source = init?.headers ?? (input instanceof Request ? input.headers : undefined);
  return new Headers(source).has("next-router-prefetch");
}

// Server actions (e.g. submitting the "new product" form) don't go through
// router.push and never fire NAV_TRANSITION_START_EVENT, but they do run as a
// fetch() call — this is the one place that also catches those. Next's
// automatic viewport/hover <Link> prefetching is excluded via its
// `next-router-prefetch` header, or every sidebar link would light up the bar
// on mount.
function patchFetchOnce() {
  if (fetchPatched || typeof window === "undefined") return;
  fetchPatched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const skip = isPrefetchRequest(args[0], args[1]);

    if (!skip) {
      inFlightRequests += 1;
      startNavProgress();
    }

    try {
      return await originalFetch(...args);
    } finally {
      if (!skip) {
        inFlightRequests -= 1;
        if (inFlightRequests === 0) {
          finishNavProgress();
        }
      }
    }
  };
}

patchFetchOnce();

export function subscribeNavProgress(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getNavProgressSnapshot(): NavProgressState {
  return state;
}

export function getNavProgressServerSnapshot(): NavProgressState {
  return IDLE_STATE;
}
