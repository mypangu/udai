/*
  YouDai DevShield — soft, tamper‑evident protection for dev tools
  ---------------------------------------------------------------
  Goals:
  • Detect (don’t block) common DevTools states and page tampering
  • Avoid breaking UX and your PWA (no SW/script blocking)
  • Expose events your app can react to (e.g., blur thumbnails, hide URLs)
  • Be resilient (Shadow DOM, observers, integrity checks) yet lightweight

  Usage:
  1) Host this file as /youdai/dev-shield.js (or dev.js) on the same origin.
  2) In both index.html and player.html, load it early in <head>:
     <script src="/youdai/dev-shield.js" defer></script>
  3) Optionally opt-out with ?debug=1 in the URL for your own testing.

  Events emitted on window:
  - 'youdai:devtools-change' { open: boolean, reason: string }
  - 'youdai:tamper' { type: string, detail?: any }
  - 'youdai:shield-ready'

  Public API (available as window.YouDaiDevShield):
  - isOpen(): boolean               // current devtools state
  - onChange(cb): () => void        // subscribe; returns unsubscribe fn
  - watermark(show?: boolean): void // show/hide the corner badge
  - blurSensitive(show?: boolean): void // toggle CSS class for blurring
*/

(function () {
  if (typeof window === 'undefined') return;

  // Respect explicit opt-out for developers
  const url = new URL(window.location.href);
  if (url.searchParams.get('debug') === '1') {
    console.info('[YouDai DevShield] Debug mode enabled via ?debug=1 — shield disabled.');
    return;
  }

  const NAMESPACE = 'youdai-devshield';
  const STATE = { open: false, reason: 'init', listeners: new Set() };

  // --- Utilities -----------------------------------------------------------
  const raf = (fn) => (window.requestAnimationFrame || setTimeout)(fn, 0);
  const now = () => (performance && performance.now ? performance.now() : Date.now());

  const dispatch = (name, detail) => {
    const evt = new CustomEvent(name, { detail });
    window.dispatchEvent(evt);
    STATE.listeners.forEach((cb) => {
      try { cb(detail); } catch (e) {}
    });
  };

  // Create a shadow-root container for overlay/watermark to resist CSS
  const host = document.createElement('div');
  host.setAttribute('data-' + NAMESPACE, '');
  Object.assign(host.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '2147483646',
  });
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: 'closed' });

  // Styles kept inside shadow root
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .wm { position: fixed; bottom: 10px; right: 10px; pointer-events: auto; }
    .badge { font: 600 11px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu; color: #fff;
             background: linear-gradient(135deg,#4ecdc4,#45b7d1); padding: 6px 10px; border-radius: 12px;
             box-shadow: 0 6px 18px rgba(0,0,0,.25); opacity:.85; user-select:none }
    .badge.hidden { display:none }
    .blur-global :where(img,video,iframe) { filter: blur(8px) saturate(.6) brightness(.9); transition: filter .2s ease }
    .banner { position: fixed; top: 0; left: 50%; transform: translateX(-50%);
              background: rgba(0,0,0,.85); color:#fff; border:1px solid rgba(78,205,196,.4);
              border-bottom-left-radius:10px; border-bottom-right-radius:10px; padding: 8px 12px; font: 500 12px system-ui; display:none }
    .banner.show { display:block }
  `;
  root.appendChild(style);

  // Watermark badge
  const wmWrap = document.createElement('div');
  wmWrap.className = 'wm';
  wmWrap.innerHTML = `<div class="badge" id="wm">Protected</div>`;
  root.appendChild(wmWrap);

  const banner = document.createElement('div');
  banner.className = 'banner';
  banner.id = 'banner';
  banner.textContent = 'Developer tools detected — some metadata may be hidden.';
  root.appendChild(banner);

  const setBadgeVisible = (show) => {
    const el = root.getElementById('wm');
    if (!el) return;
    el.classList.toggle('hidden', !show);
  };

  const showBanner = (show) => {
    const el = root.getElementById('banner');
    if (!el) return;
    el.classList.toggle('show', !!show);
  };

  // Optional global blur (app can also add class at container level)
  const setGlobalBlur = (on) => {
    document.documentElement.classList.toggle('blur-global', !!on);
  };

  // --- DevTools detection (multiple non-invasive signals) ------------------
  let detectTimer, sizeTimer, threshold = 200; // ms threshold for timing heuristic

  // 1) Console timing trick (slow eval when DevTools open in some engines)
  const timeHeuristic = () => {
    const t0 = now();
    // eslint-disable-next-line no-debugger
    debugger; // if devtools breaks, this will inflate the delta
    const dt = now() - t0;
    return dt > threshold ? { open: true, reason: 'debugger-timing(' + Math.round(dt) + 'ms)' } : null;
  };

  // 2) Window size gaps when docked devtools consumes viewport chrome
  const sizeHeuristic = () => {
    const gapW = Math.abs(window.outerWidth - window.innerWidth);
    const gapH = Math.abs(window.outerHeight - window.innerHeight);
    if (gapW > 160 || gapH > 160) return { open: true, reason: 'viewport-gap' };
    return null;
  };

  // 3) Console open via toString on a custom object
  let consoleProbeOpen = false;
  const consoleProbe = {
    toString() {
      consoleProbeOpen = true;
      setState(true, 'console-probe');
      return ' ';
    }
  };

  const setState = (open, reason) => {
    if (STATE.open === open && !reason) return;
    STATE.open = open; STATE.reason = reason || STATE.reason;
    showBanner(open);
    setGlobalBlur(open); // default: blur sensitive media while open
    dispatch('youdai:devtools-change', { open: STATE.open, reason: STATE.reason });
  };

  const poll = () => {
    clearTimeout(detectTimer);
    const sig = timeHeuristic() || sizeHeuristic();
    if (sig) setState(true, sig.reason); else setState(false, 'poll');
    detectTimer = setTimeout(poll, 800);
  };

  const sizeWatcher = () => {
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(() => setState(!!sizeHeuristic(), 'resize'), 200);
  };

  // 4) Console probe trigger when logs are printed in open console
  const logProbe = () => {
    try { (window.console || {}).log && console.log('%c', consoleProbe); } catch (e) {}
  };

  // --- Tamper evidence -----------------------------------------------------
  // a) Detect removal of the host
  const mo = new MutationObserver(() => {
    if (!document.documentElement.contains(host)) {
      document.documentElement.appendChild(host);
      dispatch('youdai:tamper', { type: 'overlay-removed' });
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // b) Integrity check (best-effort): compute text hash if script element is accessible
  const sha256 = async (text) => {
    try {
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch { return null; }
  };

  (async () => {
    try {
      // locate current script tag
      const current = document.currentScript || Array.from(document.scripts).find(s => /dev-shield|dev\.js/.test(s.src));
      if (!current) return;
      // only check if same-origin and not cross-origin
      const sameOrigin = current.src.startsWith(location.origin) || current.src.startsWith('/') || current.src === '';
      if (!sameOrigin) return;

      // fetch text for hashing
      const res = await fetch(current.src, { cache: 'no-store' });
      const content = await res.text();
      const hash = await sha256(content);
      // stash hash in a meta for your sentry/logs (optional)
      const meta = document.createElement('meta');
      meta.name = 'youdai-devshield-hash';
      meta.content = hash || 'na';
      document.head.appendChild(meta);
    } catch (e) {
      dispatch('youdai:tamper', { type: 'integrity-check-failed', detail: String(e) });
    }
  })();

  // --- Public API ----------------------------------------------------------
  const api = {
    isOpen: () => STATE.open,
    onChange(cb) { STATE.listeners.add(cb); return () => STATE.listeners.delete(cb); },
    watermark(show) { setBadgeVisible(show !== false); },
    blurSensitive(show) { setGlobalBlur(show !== false); }
  };
  Object.defineProperty(window, 'YouDaiDevShield', { value: api, writable: false });

  // Initialize
  window.addEventListener('resize', sizeWatcher, { passive: true });
  poll();
  raf(logProbe);
  dispatch('youdai:shield-ready');
})();

/* Example app-side usage (optional):
window.addEventListener('youdai:devtools-change', (e) => {
  const { open, reason } = e.detail || {};
  // Example: hide direct video URLs or sensitive IDs while open
  const els = document.querySelectorAll('[data-sensitive]');
  els.forEach(el => el.toggleAttribute('hidden', !!open));
  // Example: lower thumbnail resolution while open
  document.body.classList.toggle('low-res', !!open);
  console.info('DevTools state:', open, reason);
});
*/
