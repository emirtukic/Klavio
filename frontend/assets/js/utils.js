function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('bs-BA');
}
function formatDateTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('bs-BA');
}
function statusBadge(status) {
  const map = {
    active: 'badge-active', inactive: 'badge-inactive', suspended: 'badge-suspended',
    paid: 'badge-paid', pending: 'badge-pending', overdue: 'badge-overdue',
    scheduled: 'bg-info text-white', cancelled: 'bg-secondary text-white', completed: 'bg-success text-white',
    win: 'bg-success text-white', loss: 'bg-danger text-white', draw: 'bg-warning text-dark',
    confirmed: 'bg-success text-white', home: 'bg-primary text-white', away: 'bg-secondary text-white',
    league: 'bg-primary text-white', cup: 'bg-warning text-dark', friendly: 'bg-info text-white',
    neutral: 'bg-secondary text-white'
  };
  const labels = {
    active: 'Aktivan', inactive: 'Neaktivan', suspended: 'Suspendiran',
    paid: 'Plaćeno', pending: 'Na čekanju', overdue: 'Zakašnjelo',
    scheduled: 'Zakazano', cancelled: 'Otkazano', completed: 'Završeno',
    win: 'Pobjeda', loss: 'Poraz', draw: 'Remi',
    confirmed: 'Potvrđeno', home: 'Domaćin', away: 'Gost',
    league: 'Liga', cup: 'Kup', friendly: 'Prijateljska', neutral: 'Neutralno'
  };
  const cls = map[status] || 'bg-secondary text-white';
  const label = labels[status] || status;
  return `<span class="badge ${cls}">${label}</span>`;
}
function showToast(message, type = 'success') {
  let c = document.querySelector('.toast-container');
  if (!c) {
    c = document.createElement('div');
    c.className = 'toast-container position-fixed p-3';
    c.style.cssText = 'bottom:1rem;right:1rem;z-index:9999;min-width:260px;';
    document.body.appendChild(c);
  }
  const colors = { success:'#22c55e', error:'#ef4444', warning:'#f59e0b', info:'#3b82f6' };
  const icons  = { success:'check-circle-fill', error:'x-circle-fill', warning:'exclamation-triangle-fill', info:'info-circle-fill' };
  const bg     = colors[type] || colors.info;
  const icon   = icons[type]  || icons.info;
  const id = 'toast-' + Date.now();
  c.insertAdjacentHTML('beforeend', `
    <div id="${id}" class="toast border-0 shadow-sm" role="alert" style="border-radius:12px;overflow:hidden;min-width:260px;">
      <div class="d-flex align-items-center gap-2 px-3 py-2" style="background:${bg};">
        <i class="bi bi-${icon} text-white" style="font-size:1.05rem;flex-shrink:0;"></i>
        <div class="toast-body text-white fw-500 p-0 flex-grow-1" style="font-size:0.875rem;">${message}</div>
        <button type="button" class="btn-close btn-close-white ms-auto flex-shrink-0" style="font-size:0.7rem;" data-bs-dismiss="toast"></button>
      </div>
    </div>`);
  const el = document.getElementById(id);
  new bootstrap.Toast(el, { delay: 3500 }).show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}
function setUserInfo(user) {
  const roleLabels = { super_admin: 'SUPER ADMIN', admin: 'ADMIN', coach: 'TRENER', member: 'ČLAN' };

  const n = document.getElementById('userName');
  if (n) {
    n.textContent = user.name;
    n.style.cssText = 'cursor:pointer;border-bottom:1px dashed #94a3b8;' + (n.style.cssText || '');
    n.title = 'Postavke profila';

    // Avatar circle - insert just before the name element
    let av = document.getElementById('topbar-avatar');
    if (!av) {
      av = document.createElement('div');
      av.id = 'topbar-avatar';
      av.style.cssText = 'width:30px;height:30px;border-radius:50%;overflow:hidden;flex-shrink:0;cursor:pointer;border:2px solid rgba(0,0,0,0.08);';
      av.title = 'Postavke profila';
      av.onclick = () => window.location.href = '/pages/settings/index.html';
      n.insertAdjacentElement('beforebegin', av);
    }
    const clubLogo = (typeof getClub === 'function' && getClub()) ? getClub().logo_url : null;
    renderAvatarEl(av, user.avatar_url || clubLogo, user.name);
  }

  const displayRole = (user.role === 'super_admin' && user.club_id) ? 'admin' : user.role;
  const r = document.getElementById('userRole');
  if (r) r.textContent = roleLabels[displayRole] || displayRole.replace(/_/g,' ').toUpperCase();

  _initNotificationBell();
}

function _initNotificationBell() {
  if (document.getElementById('notif-bell')) return;
  const roleEl = document.getElementById('userRole');
  if (!roleEl) return;

  const bell = document.createElement('button');
  bell.id = 'notif-bell';
  bell.title = 'Obavijesti';
  bell.style.cssText = 'background:none;border:none;padding:0 2px;position:relative;color:#64748b;font-size:1.15rem;line-height:1;cursor:pointer;flex-shrink:0;display:flex;align-items:center;';
  bell.onclick = () => window.location.href = '/pages/notifications/index.html';
  bell.innerHTML = `
    <i class="bi bi-bell" id="notif-bell-icon"></i>
    <span id="notif-badge" style="display:none;position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:0.55rem;font-weight:700;min-width:16px;height:16px;border-radius:8px;padding:0 3px;line-height:16px;text-align:center;"></span>`;
  roleEl.insertAdjacentElement('beforebegin', bell);

  async function refreshBell() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch('/api/notifications/unread', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) return;
      const data = await res.json();
      const count = data.count || 0;
      const badge = document.getElementById('notif-badge');
      const icon  = document.getElementById('notif-bell-icon');
      if (!badge) return;
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'block';
        icon.className = 'bi bi-bell-fill';
        document.getElementById('notif-bell').style.color = '#ef4444';
      } else {
        badge.style.display = 'none';
        icon.className = 'bi bi-bell';
        document.getElementById('notif-bell').style.color = '#64748b';
      }
    } catch (_) {}
  }

  refreshBell();
  setInterval(refreshBell, 60000);
}

function renderAvatarEl(el, url, name) {
  if (url) {
    el.style.background = '';
    el.innerHTML = `<img src="${url}?t=${Date.now()}" style="width:100%;height:100%;object-fit:cover;" alt="">`;
  } else {
    const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    el.style.background = 'var(--club-accent,#3b82f6)';
    el.innerHTML = `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#fff;font-size:0.65rem;font-weight:700">${initials}</span>`;
  }
}
function _injectConfirmModal() {
  if (document.getElementById('__confirmModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal fade" id="__confirmModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content" style="border-radius:14px;overflow:hidden;">
          <div class="modal-header border-0 pb-1">
            <h5 class="modal-title fw-bold" id="__confirmTitle">Potvrda</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body pt-1 pb-2 text-muted" id="__confirmBody" style="font-size:0.92rem;"></div>
          <div class="modal-footer border-0 pt-1 gap-2">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Odustani</button>
            <button type="button" class="btn btn-sm" id="__confirmOkBtn">Potvrdi</button>
          </div>
        </div>
      </div>
    </div>`);
}

function confirmAction(message, onConfirm, { title = 'Potvrda', btnLabel = 'Potvrdi', btnClass = 'btn-primary' } = {}) {
  _injectConfirmModal();
  document.getElementById('__confirmTitle').textContent = title;
  document.getElementById('__confirmBody').textContent  = message;
  const oldBtn = document.getElementById('__confirmOkBtn');
  const btn = oldBtn.cloneNode(true);
  btn.textContent = btnLabel;
  btn.className = 'btn btn-sm ' + btnClass;
  oldBtn.replaceWith(btn);
  btn.addEventListener('click', () => {
    bootstrap.Modal.getInstance(document.getElementById('__confirmModal')).hide();
    onConfirm();
  });
  bootstrap.Modal.getOrCreateInstance(document.getElementById('__confirmModal')).show();
}

function confirmDelete(onConfirm, message = 'Jeste li sigurni? Ova radnja je nepovratna.') {
  confirmAction(message, onConfirm, { title: 'Obriši', btnLabel: 'Obriši', btnClass: 'btn-danger' });
}

/* ══ Live Match Widget ═══════════════════════════════════════════════
   Call initLiveWidget() from any dashboard page.
   Polls /api/live-match/active every 12s; on find, opens SSE stream.
════════════════════════════════════════════════════════════════════ */
(function () {
  const POLL_MS   = 12000;
  const EVT_ICONS = {
    goal:'⚽', own_goal:'🔴', yellow_card:'🟨', red_card:'🟥',
    substitution:'🔄', penalty:'🎯', missed_penalty:'❌',
    half_time:'⏸', full_time:'🏁', var:'📺'
  };
  let _widget = null, _matchId = null, _sseReader = null, _pollTimer = null, _clockTimer = null;

  function _ensureWidget() {
    if (_widget) return;
    const html = `
      <div id="liveMatchBar" style="
        position:fixed;top:56px;left:var(--sidebar-w,240px);right:0;z-index:600;
        background:#0f172a;border-bottom:2px solid rgba(239,68,68,0.4);
        padding:0;max-height:0;overflow:hidden;
        transition:max-height 0.35s cubic-bezier(0.4,0,0.2,1);pointer-events:none;">
        <div style="padding:8px 20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
          <!-- Badge + clock -->
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            <span style="display:flex;align-items:center;gap:5px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#f87171;font-size:0.68rem;font-weight:800;letter-spacing:0.1em;padding:2px 9px;border-radius:20px;text-transform:uppercase;">
              <span id="_lwDot" style="width:6px;height:6px;background:#ef4444;border-radius:50%;display:inline-block;animation:livePulse 1.4s ease-in-out infinite;"></span>
              LIVE
            </span>
            <span id="_lwClock" style="color:#f87171;font-size:0.85rem;font-weight:700;font-variant-numeric:tabular-nums;min-width:30px;"></span>
          </div>
          <!-- Score -->
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <span id="_lwTeam1" style="color:rgba(255,255,255,0.85);font-size:0.85rem;font-weight:600;"></span>
            <span id="_lwScore" style="color:#fff;font-size:1.15rem;font-weight:900;letter-spacing:-0.02em;background:rgba(255,255,255,0.08);padding:1px 10px;border-radius:8px;"></span>
            <span id="_lwTeam2" style="color:rgba(255,255,255,0.55);font-size:0.85rem;font-weight:600;"></span>
          </div>
          <!-- Last event -->
          <div id="_lwLastEvt" style="color:rgba(255,255,255,0.6);font-size:0.8rem;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
          <!-- Link -->
          <a id="_lwLink" href="/pages/matches/live.html" style="color:#60a5fa;font-size:0.78rem;font-weight:600;text-decoration:none;flex-shrink:0;white-space:nowrap;">
            Upravljaj <i class="bi bi-arrow-right"></i>
          </a>
          <button onclick="_lwDismiss()" style="background:none;border:none;color:rgba(255,255,255,0.3);cursor:pointer;padding:2px 6px;font-size:0.9rem;flex-shrink:0;" title="Zatvori">✕</button>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('afterbegin', html);
    _widget = document.getElementById('liveMatchBar');
  }

  function _show(match) {
    _ensureWidget();
    const club = typeof getClub === 'function' ? getClub() : null;
    const myTeam = club ? club.name : 'Naš tim';
    document.getElementById('_lwTeam1').textContent = myTeam;
    document.getElementById('_lwTeam2').textContent = match.opponent;
    document.getElementById('_lwScore').textContent = match.goals_for + ':' + match.goals_against;
    const link = document.getElementById('_lwLink');
    if (link) link.href = '/pages/matches/live.html?id=' + match.id;
    _widget.style.maxHeight = '60px';
    _widget.style.pointerEvents = 'auto';
    _updateClock(match);
    _updateLastEvent(match);
    _startClock(match);
  }

  function _hide() {
    if (_widget) { _widget.style.maxHeight = '0'; _widget.style.pointerEvents = 'none'; }
    _stopClock();
  }

  window._lwDismiss = function() { _hide(); _stopPoll(); closeSseWidget(); _matchId = null; };

  function _updateScore(gf, ga) {
    const el = document.getElementById('_lwScore');
    if (el) el.textContent = gf + ':' + ga;
  }

  function _updateLastEvent(match) {
    const el = document.getElementById('_lwLastEvt');
    if (!el) return;
    const type = match.last_event_type;
    if (!type || ['half_time','full_time'].includes(type)) { el.textContent = ''; return; }
    const icon   = EVT_ICONS[type] || '•';
    const name   = match.last_event_player || '';
    const minute = match.last_event_minute != null ? match.last_event_minute + "'" : '';
    const opp    = match.last_event_opponent ? '(protivnik) ' : '';
    el.textContent = icon + ' ' + minute + ' ' + opp + name;
  }

  function _updateLastEventFromEvt(event) {
    const el = document.getElementById('_lwLastEvt');
    if (!el || !event) return;
    if (['half_time','full_time'].includes(event.event_type)) { el.textContent = ''; return; }
    const icon   = EVT_ICONS[event.event_type] || '•';
    const name   = event.member_name_cache || '';
    const minute = event.minute != null ? event.minute + "'" : '';
    const opp    = event.is_opponent ? '(protivnik) ' : '';
    el.textContent = icon + ' ' + minute + ' ' + opp + name;
  }

  function _startClock(match) {
    _stopClock();
    _clockTimer = setInterval(() => _updateClock(match), 1000);
    _updateClock(match);
  }
  function _stopClock() { if (_clockTimer) { clearInterval(_clockTimer); _clockTimer = null; } }

  function _updateClock(match) {
    const el = document.getElementById('_lwClock');
    if (!el) return;
    const status = match.status;
    if (status === 'paused')   { el.textContent = "HT"; return; }
    if (status === 'finished') { el.textContent = "FT"; return; }
    if (!match.started_at)     { el.textContent = "0'"; return; }
    const mins = Math.max(0, Math.floor((Date.now() - new Date(match.started_at).getTime()) / 60000));
    el.textContent = mins + "'";
  }

  // SSE for widget
  function openSseWidget(matchId) {
    closeSseWidget();
    const token = typeof getToken === 'function' ? getToken() : null;
    if (!token) return;
    fetch('/api/live-match/' + matchId + '/stream', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => {
      if (!r.ok) return;
      _sseReader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let activeMatch = null;
      function read() {
        _sseReader.read().then(({ done, value }) => {
          if (done) return;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n'); buf = lines.pop();
          lines.forEach(line => {
            if (!line.startsWith('data: ')) return;
            try {
              const d = JSON.parse(line.slice(6));
              if (d.type === 'init' || d.type === 'started') {
                activeMatch = d.match;
                _show(activeMatch);
              } else if (d.type === 'event' && activeMatch) {
                activeMatch.goals_for     = d.score_for;
                activeMatch.goals_against = d.score_against;
                _updateScore(d.score_for, d.score_against);
                _updateLastEventFromEvt(d.event);
              } else if (d.type === 'event_deleted' && activeMatch) {
                activeMatch.goals_for     = d.score_for;
                activeMatch.goals_against = d.score_against;
                _updateScore(d.score_for, d.score_against);
              } else if (d.type === 'paused' && activeMatch) {
                activeMatch.status = 'paused';
                document.getElementById('_lwClock').textContent = "HT";
              } else if (d.type === 'resumed' && activeMatch) {
                activeMatch.status = 'live';
              } else if (d.type === 'ended') {
                closeSseWidget();
                _stopPoll();
                setTimeout(_hide, 6000);
                const cl = document.getElementById('_lwClock');
                if (cl) cl.textContent = 'FT';
              }
            } catch (_) {}
          });
          read();
        }).catch(() => {});
      }
      read();
    }).catch(() => {});
  }

  function closeSseWidget() {
    if (_sseReader) { try { _sseReader.cancel(); } catch (_) {} _sseReader = null; }
  }

  function _stopPoll() { if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; } }

  async function _poll() {
    try {
      const rows = await apiGet('/live-match/active');
      if (!rows || !rows.length) {
        if (_matchId) { _hide(); closeSseWidget(); _matchId = null; }
        return;
      }
      const m = rows[0];
      if (m.id !== _matchId) {
        _matchId = m.id;
        _show(m);
        openSseWidget(m.id);
      }
    } catch (_) {}
  }

  window.initLiveWidget = function () {
    _ensureWidget();
    _poll();
    _pollTimer = setInterval(_poll, POLL_MS);
  };
})();
