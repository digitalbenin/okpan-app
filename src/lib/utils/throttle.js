/**
 * Creates a throttled function that runs immediately and replays the last queued call.
 * @param {Function} fn Function to throttle.
 * @param {number} [wait=300] Minimum interval between invocations in milliseconds.
 * @returns {Function} Throttled function.
 */
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

/**
 * Creates a debounced function with a cancel helper.
 * @param {Function} fn Function to debounce.
 * @param {number} [wait=300] Delay before invocation in milliseconds.
 * @returns {Function} Debounced function with a cancel method.
 */
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