/**
 * Ask Sync2Dine — slim chat composer (not a second nav).
 * Text box + Send; typing indicator while waiting; reply slides down into view.
 */
(function () {
  'use strict';
  if (typeof window !== 'undefined' && window.__sallyWidgetLoaded) return;

  function findScript() {
    if (document.currentScript) return document.currentScript;
    var nodes = document.querySelectorAll('script[src*="sally-widget.js"]');
    return nodes.length ? nodes[nodes.length - 1] : null;
  }

  var script = findScript();
  var apiBase = 'https://app.sync2dine.io';
  var mode = 'topbar';
  var pageHint = typeof location !== 'undefined' ? location.pathname : '/';

  if (script) {
    apiBase = (script.getAttribute('data-api') || apiBase).replace(/\/$/, '');
    mode = (script.getAttribute('data-mode') || mode).toLowerCase();
    pageHint = script.getAttribute('data-page') || pageHint;
  }

  if (typeof window !== 'undefined') window.__sallyWidgetLoaded = true;

  var storageKey = 'sally_web_session';

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
  var pending = false;

  var root = document.createElement('div');
  root.id = 'sally-widget-root';
  root.setAttribute('data-mode', mode);

  var styles =
    '#sally-widget-root{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;pointer-events:none}' +
    '#sally-widget-root *{box-sizing:border-box}' +
    '#sally-chat{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:none;flex-direction:column;align-items:center;padding:0 16px 16px;pointer-events:none}' +
    '#sally-widget-root[data-mode=topbar] #sally-chat{display:flex}' +
    '#sally-chat__panel{display:none;width:100%;max-width:720px;max-height:min(50vh,420px);overflow:hidden;flex-direction:column;gap:8px;margin:0 0 10px;padding:14px;background:#fff;border:1px solid rgba(15,61,62,.14);border-radius:16px;box-shadow:0 12px 40px rgba(15,61,62,.18);pointer-events:auto}' +
    '#sally-chat.open #sally-chat__panel{display:flex}' +
    '#sally-chat__head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;flex-shrink:0}' +
    '#sally-chat__head strong{font-size:13px;color:#0f3d3e}' +
    '#sally-chat__close{appearance:none;border:0;background:transparent;color:#64748b;font-size:18px;line-height:1;cursor:pointer;padding:4px 8px}' +
    '#sally-chat__msgs{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:8px;-webkit-overflow-scrolling:touch}' +
    '#sally-chat__composer{width:100%;max-width:720px;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid rgba(15,61,62,.2);border-radius:999px;padding:6px 6px 6px 18px;box-shadow:0 8px 28px rgba(15,61,62,.16);pointer-events:auto}' +
    '#sally-chat__composer input{flex:1;min-width:0;border:0;outline:none;background:transparent;color:#0f3d3e;font-size:15px;padding:10px 0}' +
    '#sally-chat__composer input::placeholder{color:#64748b}' +
    '#sally-chat__composer button[type=submit]{appearance:none;border:none;background:#0f3d3e;color:#fff7df;border-radius:999px;padding:11px 18px;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap}' +
    '#sally-chat__composer button[type=submit]:disabled{opacity:.55;cursor:wait}' +
    '.sally-bubble{max-width:92%;padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;' +
    'opacity:0;transform:translateY(10px);animation:sallyIn .28s ease forwards}' +
    '.sally-user{margin-left:auto;background:#0f3d3e;color:#fff7df}' +
    '.sally-bot{margin-right:auto;background:#f6efe0;border:1px solid rgba(15,61,62,.1);color:#0f3d3e}' +
    '.sally-typing{margin-right:auto;display:inline-flex;align-items:center;gap:5px;padding:12px 16px;min-height:40px}' +
    '.sally-typing span{width:7px;height:7px;border-radius:50%;background:#0f3d3e;opacity:.35;animation:sallyDot 1.1s ease-in-out infinite}' +
    '.sally-typing span:nth-child(2){animation-delay:.15s}' +
    '.sally-typing span:nth-child(3){animation-delay:.3s}' +
    '@keyframes sallyIn{to{opacity:1;transform:translateY(0)}}' +
    '@keyframes sallyDot{0%,80%,100%{transform:translateY(0);opacity:.3}40%{transform:translateY(-4px);opacity:.9}}' +
    '@media(max-width:520px){#sally-chat{padding:0 10px 12px}}';

  root.innerHTML =
    '<style>' + styles + '</style>' +
    '<div id="sally-chat" role="complementary" aria-label="Ask Sync2Dine">' +
    '<div id="sally-chat__panel">' +
    '<div id="sally-chat__head"><strong>Ask Sync2Dine</strong><button type="button" id="sally-chat__close" aria-label="Close chat">×</button></div>' +
    '<div id="sally-chat__msgs" aria-live="polite"></div></div>' +
    '<form id="sally-chat__composer" autocomplete="off">' +
    '<input id="sally-chat-input" type="text" placeholder="Ask Sync2Dine…" aria-label="Ask Sync2Dine" />' +
    '<button type="submit">Send</button></form></div>';

  function mountRoot() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', mountRoot);
      return;
    }
    document.body.appendChild(root);
    bindUi();
  }

  function bindUi() {
    var chat = root.querySelector('#sally-chat');
    var msgs = root.querySelector('#sally-chat__msgs');
    var form = root.querySelector('#sally-chat__composer');
    var input = root.querySelector('#sally-chat-input');
    var closeBtn = root.querySelector('#sally-chat__close');
    var sendBtn = form ? form.querySelector('button[type=submit]') : null;
    var panel = root.querySelector('#sally-chat__panel');
    var typingEl = null;

    function setOpen(next) {
      if (!chat) return;
      if (next) chat.classList.add('open');
      else chat.classList.remove('open');
    }

    function scrollToBottom() {
      function go() {
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
        if (panel) panel.scrollTop = panel.scrollHeight;
      }
      go();
      requestAnimationFrame(function () {
        go();
        setTimeout(go, 40);
        setTimeout(go, 120);
      });
    }

    function addBubble(text, role) {
      if (!msgs || !text) return null;
      setOpen(true);
      var div = document.createElement('div');
      div.className = 'sally-bubble ' + (role === 'user' ? 'sally-user' : 'sally-bot');
      div.textContent = text;
      msgs.appendChild(div);
      scrollToBottom();
      return div;
    }

    function showTyping() {
      hideTyping();
      if (!msgs) return;
      setOpen(true);
      typingEl = document.createElement('div');
      typingEl.className = 'sally-bubble sally-bot sally-typing';
      typingEl.setAttribute('aria-label', 'Sync2Dine is typing');
      typingEl.innerHTML = '<span></span><span></span><span></span>';
      msgs.appendChild(typingEl);
      scrollToBottom();
    }

    function hideTyping() {
      if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
      typingEl = null;
    }

    function removeBubble(el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      if (msgs && !msgs.querySelector('.sally-bubble:not(.sally-typing)')) setOpen(false);
    }

    function renderMessages(list) {
      if (!msgs) return;
      hideTyping();
      msgs.innerHTML = '';
      (list || []).forEach(function (m) {
        if (m && m.content) addBubble(m.content, m.role === 'user' ? 'user' : 'bot');
      });
      scrollToBottom();
    }

    async function sendText(text) {
      if (!text || pending) return;
      pending = true;
      if (sendBtn) sendBtn.disabled = true;
      var userBubble = addBubble(text, 'user');
      if (input) input.value = '';
      showTyping();
      try {
        var res = await fetch(apiUrl('/api/sally/web'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId, text: text, page: pageHint }),
        });
        var data = await res.json().catch(function () { return {}; });
        hideTyping();
        // No fallback replies — if not connected / error / empty, delete the turn and stay silent.
        if (!res.ok || (!data.reply && !(data.messages && data.messages.length))) {
          removeBubble(userBubble);
          return;
        }
        if (data.sessionId) {
          sessionId = data.sessionId;
          try { localStorage.setItem(storageKey, sessionId); } catch (e) { /* ignore */ }
        }
        if (data.messages && data.messages.length) renderMessages(data.messages);
        else if (data.reply) addBubble(data.reply, 'bot');
        scrollToBottom();
      } catch (e) {
        hideTyping();
        removeBubble(userBubble);
      } finally {
        pending = false;
        if (sendBtn) sendBtn.disabled = false;
      }
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        sendText((input && input.value ? input.value : '').trim());
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        hideTyping();
        setOpen(false);
      });
    }
  }

  if (document.body) mountRoot();
  else document.addEventListener('DOMContentLoaded', mountRoot);
})();
