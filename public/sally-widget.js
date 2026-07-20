/**
 * Ask Sync2Dine website chat widget (Sally sales brain).
 * data-api, data-mode ("fab" | "hero" | "topbar"), data-page, data-mount
 *
 * Embed (main site top bar):
 *   <script src="https://app.sync2dine.io/sally-widget.js"
 *     data-api="https://app.sync2dine.io" data-mode="topbar" data-page="marketing" async></script>
 */
(function () {
  'use strict';
  if (typeof window !== 'undefined' && window.__sallyWidgetLoaded) return;
  if (typeof window !== 'undefined') window.__sallyWidgetLoaded = true;
  var script = document.currentScript;
  if (!script) return;
  var apiBase = (script.getAttribute('data-api') || '').replace(/\/$/, '');
  var mode = (script.getAttribute('data-mode') || 'fab').toLowerCase();
  var mountSel = script.getAttribute('data-mount') || '';
  var pageHint = script.getAttribute('data-page') || (typeof location !== 'undefined' ? location.pathname : '/');
  var storageKey = 'sally_web_session';
  var ICON = (apiBase || '') + '/brand/brand-icon.svg';
  var SITE = 'https://sync2dine.io';

  function apiUrl(path) {
    return (apiBase || '') + path;
  }

  function getSessionId() {
    try {
      var existing = localStorage.getItem(storageKey);
      if (existing) return existing;
      var id = 'web_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(storageKey, id);
      return id;
    } catch (e) {
      return 'web_' + Date.now();
    }
  }

  var sessionId = getSessionId();
  var open = mode === 'hero';
  var pending = false;

  var root = document.createElement('div');
  root.id = 'sally-widget-root';
  root.setAttribute('data-mode', mode);

  var styles =
    '#sally-widget-root{all:initial;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
    '#sally-widget-root *{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
    '#sally-fab{position:fixed;right:20px;bottom:20px;z-index:99999;background:#0f3d3e;color:#fff;border:none;border-radius:999px;padding:14px 18px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 8px 24px rgba(15,61,62,.35)}' +
    '#sally-panel{position:fixed;right:20px;bottom:76px;z-index:99999;width:min(400px,calc(100vw - 32px));height:520px;background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;border:1px solid #d1e7e4}' +
    '#sally-panel.open{display:flex}' +
    '#sally-widget-root[data-mode=hero] #sally-fab{display:none}' +
    '#sally-widget-root[data-mode=hero] #sally-panel{position:relative;right:auto;bottom:auto;width:100%;max-width:720px;height:auto;min-height:420px;margin:0 auto;display:flex;box-shadow:0 12px 40px -12px rgba(15,61,62,.25);border-radius:20px}' +
    '#sally-topbar{position:fixed;top:0;left:0;right:0;z-index:100000;display:none;align-items:center;justify-content:space-between;gap:12px;padding:8px 16px;min-height:52px;background:#0f3d3e;color:#fff7df;box-shadow:0 4px 18px rgba(11,34,35,.28);font-size:14px}' +
    '#sally-widget-root[data-mode=topbar] #sally-topbar{display:flex}' +
    '#sally-widget-root[data-mode=topbar] #sally-fab{display:none}' +
    '#sally-widget-root[data-mode=topbar] #sally-panel{top:60px;bottom:auto;right:16px;height:min(520px,calc(100vh - 80px))}' +
    'body.sally-topbar-pad{padding-top:52px !important}' +
    'html.sally-topbar-pad{scroll-padding-top:52px}' +
    '#sally-topbar__brand{display:flex;align-items:center;gap:10px;min-width:0;text-decoration:none;color:#fff7df}' +
    '#sally-topbar__brand img{width:28px;height:28px;flex-shrink:0;border-radius:8px}' +
    '#sally-topbar__brand strong{font-size:14px;font-weight:700;white-space:nowrap}' +
    '#sally-topbar__brand span{font-size:11px;opacity:.85;display:block}' +
    '#sally-topbar__actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;justify-content:flex-end}' +
    '#sally-topbar__actions a,#sally-topbar__actions button{appearance:none;border:1px solid rgba(232,194,106,.45);background:transparent;color:#fff7df;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer;text-decoration:none;line-height:1}' +
    '#sally-topbar__actions a.sally-primary,#sally-topbar__actions button.sally-primary{background:#e8c26a;border-color:#e8c26a;color:#0f3d3e}' +
    '#sally-head{background:#0f3d3e;color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}' +
    '#sally-head img{width:28px;height:28px;border-radius:8px}' +
    '#sally-head strong{display:block;font-size:15px}' +
    '#sally-head span{font-size:12px;opacity:.85}' +
    '#sally-msgs{flex:1;overflow:auto;padding:12px;background:#f6efe0;min-height:200px}' +
    '.sally-bubble{max-width:85%;margin:6px 0;padding:8px 12px;border-radius:14px;font-size:13px;line-height:1.45;white-space:pre-wrap}' +
    '.sally-user{margin-left:auto;background:#0f3d3e;color:#fff}' +
    '.sally-bot{margin-right:auto;background:#fff;border:1px solid #e2e8f0;color:#0f172a}' +
    '#sally-form{display:flex;gap:6px;padding:10px;border-top:1px solid #e2e8f0;background:#fff}' +
    '#sally-form input{flex:1;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;font-size:14px}' +
    '#sally-form button{border:none;background:#0f3d3e;color:#fff;border-radius:10px;padding:10px 14px;cursor:pointer;font-size:13px;font-weight:600}' +
    '#sally-cta{display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px;background:#fff;border-top:1px solid #f1f5f9}' +
    '#sally-cta a{font-size:12px;font-weight:600;color:#0f3d3e;text-decoration:none;padding:8px 10px;border-radius:10px;border:1px solid #d1e7e4}' +
    '#sally-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 10px;background:#f6efe0}' +
    '#sally-chips button{border:1px solid #d1e7e4;background:#fff;border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer;color:#0f3d3e}' +
    '@media(max-width:640px){#sally-topbar__brand span{display:none}#sally-topbar__actions a.sally-hide-sm{display:none}}';

  root.innerHTML =
    '<style>' + styles + '</style>' +
    '<div id="sally-topbar" role="banner">' +
    '<a id="sally-topbar__brand" href="' + SITE + '/">' +
    '<img src="' + ICON + '" alt="" width="28" height="28"/>' +
    '<div><strong>Sync2Dine</strong><span>Venue audio · ask us anything</span></div></a>' +
    '<div id="sally-topbar__actions">' +
    '<button type="button" id="sally-topbar-chat" class="sally-primary">Ask Sync2Dine</button>' +
    '<a href="tel:+442037453233">Call 020 3745 3233</a>' +
    '<a class="sally-hide-sm" href="' + SITE + '/inquiry/">Get started</a>' +
    '</div></div>' +
    '<button id="sally-fab" type="button" aria-label="Ask Sync2Dine">Ask Sync2Dine</button>' +
    '<div id="sally-panel" role="dialog" aria-label="Ask Sync2Dine">' +
    '<div id="sally-head"><img src="' + ICON + '" alt=""/><div><strong>Ask Sync2Dine</strong><span>Atmosphere audio · Call 020 3745 3233 · 24/7</span></div></div>' +
    '<div id="sally-msgs"></div>' +
    '<div id="sally-chips">' +
    '<button type="button" data-q="How much is Atmosphere?">How much is Atmosphere?</button>' +
    '<button type="button" data-q="What\'s included with venue audio?">What\'s included?</button>' +
    '<button type="button" data-q="Call me now">Call me now</button>' +
    '<button type="button" data-q="Tell me about Judie phone AI">Judie phone AI</button>' +
    '</div>' +
    '<div id="sally-cta">' +
    '<a href="tel:+442037453233">Call 020 3745 3233 · 24/7</a>' +
    '<a id="sally-start" href="' + SITE + '/inquiry/">Enquire / get started</a>' +
    '</div>' +
    '<form id="sally-form">' +
    '<input id="sally-input" type="text" placeholder="Ask about Atmosphere audio, pricing, or getting set up…" autocomplete="off" />' +
    '<button type="submit">Send</button>' +
    '</form></div>';

  var mount = mountSel ? document.querySelector(mountSel) : null;
  if (mount) mount.appendChild(root);
  else document.body.appendChild(root);

  if (mode === 'topbar') {
    document.documentElement.classList.add('sally-topbar-pad');
    document.body.classList.add('sally-topbar-pad');
  }

  var fab = root.querySelector('#sally-fab');
  var panel = root.querySelector('#sally-panel');
  var msgs = root.querySelector('#sally-msgs');
  var form = root.querySelector('#sally-form');
  var input = root.querySelector('#sally-input');
  var startLink = root.querySelector('#sally-start');
  var chips = root.querySelector('#sally-chips');
  var topbarChat = root.querySelector('#sally-topbar-chat');

  if (mode === 'hero') panel.classList.add('open');

  function setOpen(next) {
    open = !!next;
    panel.classList.toggle('open', open);
  }

  function addBubble(text, role) {
    var div = document.createElement('div');
    div.className = 'sally-bubble ' + (role === 'user' ? 'sally-user' : 'sally-bot');
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function renderMessages(list) {
    msgs.innerHTML = '';
    (list || []).forEach(function (m) {
      addBubble(m.content, m.role === 'user' ? 'user' : 'bot');
    });
  }

  async function sendText(text) {
    if (!text || pending) return;
    pending = true;
    addBubble(text, 'user');
    input.value = '';
    if (chips) chips.style.display = 'none';
    try {
      var res = await fetch(apiUrl('/api/sally/web'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId, text: text, page: pageHint }),
      });
      var data = await res.json();
      if (!res.ok) {
        addBubble(data.error || 'Sorry — chat is unavailable. Call 020 3745 3233 anytime.', 'bot');
        return;
      }
      if (data.sessionId) {
        sessionId = data.sessionId;
        try { localStorage.setItem(storageKey, sessionId); } catch (e) { /* ignore */ }
      }
      if (data.checkoutHandoff && data.checkoutHandoff.startPath && startLink) {
        // Keep main-site enquiry as primary CTA while app storefront is login-gated.
        startLink.href = SITE + '/inquiry/';
      }
      if (data.messages) renderMessages(data.messages);
      else if (data.reply) addBubble(data.reply, 'bot');
    } catch (e) {
      addBubble('Could not reach Sync2Dine — call 020 3745 3233 (24/7).', 'bot');
    } finally {
      pending = false;
    }
  }

  fab.addEventListener('click', function () {
    setOpen(!open);
  });
  if (topbarChat) {
    topbarChat.addEventListener('click', function () {
      setOpen(!open);
      if (open && input) input.focus();
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    sendText((input.value || '').trim());
  });

  chips.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('button[data-q]') : null;
    if (!btn) return;
    var q = btn.getAttribute('data-q') || '';
    if (q === 'Call me now') {
      window.location.href = 'tel:+442037453233';
    }
    setOpen(true);
    sendText(q);
  });
})();
