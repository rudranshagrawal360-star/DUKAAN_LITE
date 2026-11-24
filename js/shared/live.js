/**
 * ============================================================================
 * DukaanLite - Live Cross-Tab Event Bus (js/shared/live.js)
 * ============================================================================
 * Uses BroadcastChannel("dukaanlite") with a localStorage event fallback.
 * Allows instant live updates between Customer tracking and Shopkeeper tabs
 * without needing an active backend server or web sockets.
 * ============================================================================
 */

(function () {
  const CHANNEL_NAME = 'dukaanlite';
  const FALLBACK_KEY = 'dukaanlite_live_event_v1';
  const listeners = new Map();

  let bc = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event && event.data) {
          handleIncomingEvent(event.data);
        }
      };
    }
  } catch (err) {
    console.warn('[DukaanLive] BroadcastChannel not supported, falling back to storage events.', err);
  }

  // Storage event listener fallback (for older browsers or isolated contexts)
  window.addEventListener('storage', (e) => {
    if (e.key === FALLBACK_KEY && e.newValue) {
      try {
        const payload = JSON.parse(e.newValue);
        handleIncomingEvent(payload);
      } catch (err) {
        // ignore JSON parse error
      }
    }
  });

  function handleIncomingEvent(data) {
    if (!data || !data.type) return;
    const callbacks = listeners.get(data.type) || [];
    callbacks.forEach((cb) => {
      try {
        cb(data.payload, data.timestamp);
      } catch (e) {
        console.error('[DukaanLive] Callback error:', e);
      }
    });

    // Also trigger wildcard '*' listeners
    const wildcards = listeners.get('*') || [];
    wildcards.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error('[DukaanLive] Wildcard callback error:', e);
      }
    });
  }

  /**
   * Broadcast an event across all open tabs.
   * @param {string} type - Event identifier (e.g. 'ORDER_STATUS_CHANGED', 'ORDER_CREATED')
   * @param {any} payload - Data associated with the event
   */
  function broadcast(type, payload) {
    const message = {
      type,
      payload,
      timestamp: Date.now()
    };

    if (bc) {
      try {
        bc.postMessage(message);
      } catch (e) {
        console.warn('[DukaanLive] postMessage failed:', e);
      }
    }

    // Always update fallback key to trigger storage event in other windows
    try {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(message));
    } catch (e) {
      // quota or private mode
    }

    // Also notify local listeners in the current window
    handleIncomingEvent(message);
  }

  /**
   * Subscribe to live events.
   * @param {string} type - Event type to listen for, or '*' for all
   * @param {Function} callback - Function receiving (payload, timestamp)
   * @returns {Function} Unsubscribe function
   */
  function subscribe(type, callback) {
    if (!listeners.has(type)) {
      listeners.set(type, []);
    }
    listeners.get(type).push(callback);

    return function unsubscribe() {
      const arr = listeners.get(type) || [];
      const idx = arr.indexOf(callback);
      if (idx !== -1) arr.splice(idx, 1);
    };
  }

  window.DukaanLive = {
    broadcast,
    subscribe,
    CHANNEL_NAME
  };
})();
