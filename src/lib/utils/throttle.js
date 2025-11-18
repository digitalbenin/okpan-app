// Simple throttle utility: invokes immediately, then ignores further calls
// until the wait window passes. The last call during the window is invoked
// once the window ends.
export function throttle(fn, wait = 300) {
  let inThrottle = false;
  let lastArgs = null;
  let lastThis = null;
  let timeoutId = null;

  function invoke() {
    inThrottle = false;
    if (lastArgs) {
      const args = lastArgs;
      const ctx = lastThis;
      lastArgs = null;
      lastThis = null;
      fn.apply(ctx, args);
    }
  }

  return function throttled(...args) {
    if (!inThrottle) {
      inThrottle = true;
      fn.apply(this, args);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(invoke, wait);
    } else {
      lastArgs = args;
      lastThis = this;
    }
  };
}

export function debounce(fn, wait = 300) {
  let timeoutId = null;
  let lastArgs = null;
  let lastThis = null;

  function invoke() {
    fn.apply(lastThis, lastArgs);
    lastArgs = null;
    lastThis = null;
    timeoutId = null;
  }

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(invoke, wait);
  }

  debounced.cancel = () => {
    clearTimeout(timeoutId);
    timeoutId = null;
    lastArgs = null;
    lastThis = null;
  };

  return debounced;
}