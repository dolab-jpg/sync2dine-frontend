/**
 * Cynthia website chat widget — paste via Integrations → Company Profile embed snippet.
 * data-org-id (required), data-api (API base), data-name (display name)
 */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script) return;
  var orgId = script.getAttribute('data-org-id') || 'default';
  var apiBase = (script.getAttribute('data-api') || '').replace(/\/$/, '');
  var displayName = script.getAttribute('data-name') || 'Cynthia';
  var storageKey = 'cyrus_web_session_' + orgId;

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
  var lastTs = '';
  var open = false;

  var root = document.createElement('div');
  root.id = 'cyrus-widget-root';
  root.innerHTML =
    '<style>' +
    '#cyrus-widget-root{all:initial;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
    '#cyrus-widget-root *{box-sizing:border-box}' +
    '#cyrus-fab{position:fixed;right:20px;bottom:20px;z-index:99999;background:#15803d;color:#fff;border:none;border-radius:999px;padding:14px 18px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.2)}' +
    '#cyrus-panel{position:fixed;right:20px;bottom:76px;z-index:99999;width:min(380px,calc(100vw - 32px));height:480px;background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;border:1px solid #e5e7eb}' +
    '#cyrus-panel.open{display:flex}' +
    '#cyrus-head{background:#166534;color:#fff;padding:14px 16px;font-weight:600}' +
    '#cyrus-msgs{flex:1;overflow:auto;padding:12px;background:#f8fafc}' +
    '.cyrus-bubble{max-width:85%;margin:6px 0;padding:8px 12px;border-radius:14px;font-size:13px;line-height:1.4;white-space:pre-wrap}' +
    '.cyrus-user{margin-left:auto;background:#16a34a;color:#fff}' +
    '.cyrus-bot{margin-right:auto;background:#fff;border:1px solid #e2e8f0;color:#0f172a}' +
    '#cyrus-form{display:flex;gap:6px;padding:10px;border-top:1px solid #e2e8f0;background:#fff}' +
    '#cyrus-form input{flex:1;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font-size:13px}' +
    '#cyrus-form button{border:none;background:#15803d;color:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;font-size:13px}' +
    '#cyrus-mic{background:#334155}' +
    '</style>' +
    '<button id="cyrus-fab" type="button" aria-label="Chat">Chat with ' + displayName + '</button>' +
    '<div id="cyrus-panel" role="dialog" aria-label="' + displayName + ' chat">' +
    '<div id="cyrus-head">' + displayName + ' — how can we help?</div>' +
    '<div id="cyrus-msgs"></div>' +
    '<form id="cyrus-form">' +
    '<input id="cyrus-input" type="text" placeholder="Type a message…" autocomplete="off" />' +
    '<button id="cyrus-mic" type="button" title="Speak">🎤</button>' +
    '<button type="submit">Send</button>' +
    '</form></div>';

  document.body.appendChild(root);

  var fab = root.querySelector('#cyrus-fab');
  var panel = root.querySelector('#cyrus-panel');
  var msgs = root.querySelector('#cyrus-msgs');
  var form = root.querySelector('#cyrus-form');
  var input = root.querySelector('#cyrus-input');
  var micBtn = root.querySelector('#cyrus-mic');

  function addBubble(text, role) {
    var div = document.createElement('div');
    div.className = 'cyrus-bubble ' + (role === 'user' ? 'cyrus-user' : 'cyrus-bot');
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function renderMessages(list) {
    msgs.innerHTML = '';
    (list || []).forEach(function (m) {
      addBubble(m.content, m.role === 'user' ? 'user' : 'bot');
      if (m.timestamp) lastTs = m.timestamp;
    });
  }

  async function sendText(text) {
    if (!text) return;
    addBubble(text, 'user');
    input.value = '';
    try {
      var res = await fetch(apiUrl('/api/cyrus/web'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Org-Id': orgId },
        body: JSON.stringify({ orgId: orgId, sessionId: sessionId, text: text }),
      });
      var data = await res.json();
      if (!res.ok) {
        addBubble(data.error || 'Sorry — chat is unavailable right now.', 'bot');
        return;
      }
      if (data.sessionId) {
        sessionId = data.sessionId;
        try { localStorage.setItem(storageKey, sessionId); } catch (e) { /* ignore */ }
      }
      if (data.messages) renderMessages(data.messages);
      else if (data.reply) addBubble(data.reply, 'bot');
    } catch (e) {
      addBubble('Could not reach the office chat service.', 'bot');
    }
  }

  fab.addEventListener('click', function () {
    open = !open;
    panel.classList.toggle('open', open);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    sendText((input.value || '').trim());
  });

  micBtn.addEventListener('click', function () {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      addBubble('Voice input is not supported in this browser — type your message instead.', 'bot');
      return;
    }
    var rec = new SR();
    rec.lang = 'en-GB';
    rec.interimResults = false;
    rec.onresult = function (ev) {
      var t = ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript;
      if (t) sendText(t);
    };
    rec.start();
  });

  function poll() {
    if (!open) return;
    var q = '/api/cyrus/web/poll?orgId=' + encodeURIComponent(orgId) +
      '&sessionId=' + encodeURIComponent(sessionId) +
      (lastTs ? '&after=' + encodeURIComponent(lastTs) : '');
    fetch(apiUrl(q), { headers: { 'X-Org-Id': orgId } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        (data.messages || []).forEach(function (m) {
          if (m.timestamp && m.timestamp <= lastTs) return;
          if (m.role !== 'user') addBubble(m.content, 'bot');
          if (m.timestamp) lastTs = m.timestamp;
        });
      })
      .catch(function () { /* ignore */ });
  }

  setInterval(poll, 4000);
})();
