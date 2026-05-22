/* ── Storage helpers ── */
function saveAuth(token, user, club, selection) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  if (club) localStorage.setItem('club', JSON.stringify(club)); else localStorage.removeItem('club');
  if (selection) localStorage.setItem('selection', JSON.stringify(selection)); else localStorage.removeItem('selection');
}
function getToken()     { return localStorage.getItem('token'); }
function getUser()      { const u = localStorage.getItem('user');      return u ? JSON.parse(u) : null; }
function getClub()      { const c = localStorage.getItem('club');      return c ? JSON.parse(c) : null; }
function getSelection() { const s = localStorage.getItem('selection'); return s ? JSON.parse(s) : null; }
function isSuperAdminInClub() { return !!localStorage.getItem('sa_token'); }

/* ── Auth ── */
function logout() {
  ['token','user','club','selection','sa_token'].forEach(k => localStorage.removeItem(k));
  window.location.href = '/';
}
function redirectToDashboard(role) {
  const paths = { super_admin:'/pages/dashboard/super-admin.html', admin:'/pages/dashboard/admin.html', coach:'/pages/dashboard/coach.html', member:'/pages/dashboard/member.html' };
  window.location.href = paths[role] || '/';
}
function requireAuth() {
  const token = getToken(), user = getUser();
  if (!token || !user) { window.location.href = '/'; return null; }
  return user;
}
function requireRole(...roles) {
  const user = requireAuth();
  if (!user) return null;
  if (user.role === 'super_admin') return user;
  if (!roles.includes(user.role)) { window.location.href = '/'; return null; }
  return user;
}

/* ── Super-admin club access ── */
async function switchToClub(clubId) {
  try {
    const res = await fetch(`/api/clubs/${clubId}/access`, { method:'POST', headers:{ 'Authorization':'Bearer '+getToken(), 'Content-Type':'application/json' } });
    if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    const data = await res.json();
    localStorage.setItem('sa_token', getToken());
    saveAuth(data.token, data.user, data.club);
    window.location.href = '/pages/dashboard/admin.html';
  } catch(err) {
    if (typeof showToast === 'function') showToast('Greška: ' + err.message, 'error');
  }
}
function exitClub() {
  const saToken = localStorage.getItem('sa_token');
  if (!saToken) return;
  localStorage.removeItem('sa_token');
  localStorage.removeItem('club');
  localStorage.removeItem('selection');
  localStorage.setItem('token', saToken);
  try {
    const p = JSON.parse(atob(saToken.split('.')[1]));
    localStorage.setItem('user', JSON.stringify({ id:p.id, name:p.name, email:p.email, role:p.role, club_id:null }));
  } catch(e) {}
  window.location.href = '/pages/dashboard/super-admin.html';
}

/* ── Sidebar builder ── */
const NAV = {
  superAdmin: [
    { href:'/pages/dashboard/super-admin.html',       icon:'speedometer2',   label:'Nadzorna ploča' },
    { section:'Platforma' },
    { href:'/pages/clubs/list.html',                  icon:'building',       label:'Klubovi' },
    { href:'/pages/subscriptions/index.html',         icon:'credit-card',    label:'Pretplate' },
    { href:'/pages/platform-invoices/index.html',     icon:'receipt',        label:'Fakture' },
    { section:'Analitika' },
    { href:'/pages/platform-analytics/index.html',   icon:'graph-up-arrow',  label:'Analitika platforme' },
    { href:'/pages/platform-analytics/forms.html',   icon:'file-earmark-bar-graph', label:'Analitika obrazaca' },
    { section:'Komunikacija' },
    { href:'/pages/platform-messages/index.html',     icon:'chat-dots',      label:'Poruke' },
    { href:'/pages/system-notifications/index.html',  icon:'megaphone',      label:'Sistemske obavijesti' },
    { href:'/pages/support-tickets/index.html',       icon:'headset',        label:'Support ticketi' },
    { section:'Monitoring' },
    { href:'/pages/platform-activity/index.html',     icon:'journal-text',   label:'Log aktivnosti' },
    { section:'Račun' },
    { href:'/pages/settings/index.html',              icon:'gear',           label:'Postavke' },
  ],
  admin: [
    { href:'/pages/dashboard/admin.html',     icon:'speedometer2',   label:'Nadzorna ploča' },
    { section:'Upravljanje' },
    { href:'/pages/selections/list.html',     icon:'layers',         label:'Selekcije' },
    { href:'/pages/members/list.html',        icon:'people',         label:'Članovi' },
    { href:'/pages/fees/list.html',           icon:'cash-coin',      label:'Članarine' },
    { href:'/pages/finances/index.html',      icon:'wallet2',        label:'Finansije',        plan:'pro' },
    { href:'/pages/training/schedule.html',   icon:'calendar3',      label:'Treninzi' },
    { href:'/pages/matches/list.html',        icon:'trophy',         label:'Utakmice' },
    { href:'/pages/matches/live.html',        icon:'broadcast',      label:'Live utakmica', highlight: true },
    { href:'/pages/calendar/index.html',      icon:'calendar2-week', label:'Kalendar' },
    { section:'Analitika' },
    { href:'/pages/statistics/index.html',    icon:'graph-up',       label:'Statistike',       plan:'pro' },
    { href:'/pages/reports/index.html',       icon:'bar-chart-line', label:'Izvještaji',        plan:'pro' },
    { href:'/pages/documents/index.html',   icon:'file-earmark-text', label:'Obrazci',          plan:'pro' },
    { section:'Komunikacija' },
    { href:'/pages/notifications/index.html', icon:'bell',           label:'Obavijesti' },
    { href:'/pages/messages/index.html',      icon:'chat-dots',      label:'Poruke od Klavio' },
    { href:'/pages/announcements/list.html',  icon:'megaphone',      label:'Oglasna tabla' },
    { section:'Klub', collapsible: true },
    { href:'/pages/coaches/list.html',        icon:'person-badge',   label:'Treneri' },
    { href:'/pages/appointments/list.html',   icon:'calendar-check', label:'Termini' },
    { href:'/pages/sponsors/list.html',       icon:'briefcase',      label:'Sponzori',         plan:'klub' },
    { href:'/pages/equipment/list.html',      icon:'box-seam',       label:'Oprema',           plan:'klub' },
    { href:'/pages/gallery/index.html',       icon:'images',         label:'Galerija',          plan:'pro' },
    { href:'/pages/development/index.html',   icon:'person-lines-fill', label:'Razvoj igrača', plan:'pro' },
    { href:'/pages/activity-log/index.html',  icon:'journal-text',   label:'Log aktivnosti',   plan:'pro' },
    { section:'Račun' },
    { href:'/pages/my-subscription/index.html', icon:'credit-card',  label:'Pretplata' },
    { href:'/pages/my-invoices/index.html',     icon:'receipt',      label:'Moje fakture' },
    { href:'/pages/support/index.html',         icon:'headset',      label:'Podrška' },
    { href:'/pages/settings/index.html',        icon:'gear',         label:'Postavke' },
  ],
  coach: [
    { href:'/pages/dashboard/coach.html',      icon:'speedometer2',      label:'Nadzorna ploča' },
    { section:'Upravljanje' },
    { href:'/pages/calendar/index.html',       icon:'calendar2-week',    label:'Kalendar' },
    { href:'/pages/training/schedule.html',    icon:'calendar3',         label:'Treninzi' },
    { href:'/pages/matches/list.html',         icon:'trophy',            label:'Utakmice' },
    { href:'/pages/matches/live.html',         icon:'broadcast',         label:'Live utakmica', highlight: true },
    { href:'/pages/members/list.html',         icon:'people',            label:'Igrači' },
    { href:'/pages/lineup/index.html',         icon:'grid-3x3-gap',      label:'Postava' },
    { href:'/pages/statistics/index.html',     icon:'graph-up',          label:'Statistike' },
    { href:'/pages/development/index.html',    icon:'person-lines-fill', label:'Razvoj igrača' },
    { section:'Ostalo' },
    { href:'/pages/appointments/list.html',    icon:'calendar-check',    label:'Termini' },
    { href:'/pages/announcements/list.html',   icon:'megaphone',         label:'Oglasna tabla' },
    { href:'/pages/gallery/index.html',        icon:'images',            label:'Galerija' },
    { href:'/pages/equipment/list.html',       icon:'box-seam',          label:'Oprema' },
    { section:'Račun' },
    { href:'/pages/settings/index.html',       icon:'gear',              label:'Postavke' },
  ],
  member: [
    { href:'/pages/dashboard/member.html',     icon:'speedometer2',   label:'Nadzorna ploča' },
    { section:'Moji podaci' },
    { href:'/pages/calendar/index.html',       icon:'calendar2-week', label:'Kalendar' },
    { href:'/pages/training/schedule.html',    icon:'calendar3',      label:'Treninzi' },
    { href:'/pages/matches/list.html',         icon:'trophy',         label:'Utakmice' },
    { href:'/pages/matches/live.html',         icon:'broadcast',      label:'Live utakmica', highlight: true },
    { href:'/pages/appointments/list.html',    icon:'calendar-check', label:'Termini' },
    { href:'/pages/statistics/index.html',     icon:'graph-up',       label:'Moje statistike' },
    { href:'/pages/announcements/list.html',   icon:'megaphone',      label:'Oglasna tabla' },
    { section:'Račun' },
    { href:'/pages/settings/index.html',       icon:'gear',           label:'Postavke' },
  ],
};

function buildSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  const user = getUser();
  if (!user) return;
  const club = getClub();

  const sel = getSelection();
  const clubSub = club
    ? `<div style="font-size:0.7rem;opacity:0.5;font-weight:400;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${club.name}</div>`
    : '';
  const selSub = sel
    ? `<div style="font-size:0.65rem;opacity:0.4;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sel.name}</div>`
    : '';

  // Pick nav config
  let items;
  if (user.role === 'super_admin' && !user.club_id) items = NAV.superAdmin;
  else if (user.role === 'super_admin' || user.role === 'admin') items = NAV.admin;
  else if (user.role === 'coach') items = NAV.coach;
  else items = NAV.member;

  // Determine active path - match section folder, not just exact file
  const path = window.location.pathname;
  const hasExactMatch = items.some(i => i.href === path);
  function isActive(href) {
    if (path === href) return true;
    if (href.includes('/dashboard/')) return false;
    const hrefFolder = href.replace(/\/[^/]+$/, '');
    const pathFolder = path.replace(/\/[^/]+$/, '');
    if (hrefFolder !== pathFolder) return false;
    // If current page is directly in the nav, don't also activate sibling links
    if (hasExactMatch) return false;
    return true;
  }

  // Subscription plan hierarchy
  const planLevel = { starter: 1, pro: 2, klub: 3 };
  const clubPlan  = (club && club.plan) ? club.plan : 'starter';
  const clubLevel = planLevel[clubPlan] || 1;
  const isSuperAdmin = user.role === 'super_admin';
  function planAllowed(requiredPlan) {
    if (!requiredPlan) return true;
    if (isSuperAdmin && !user.club_id) return true; // bypass only in pure SA mode, not inside a club
    return clubLevel >= (planLevel[requiredPlan] || 99);
  }
  const PLAN_LABEL = { pro: 'Pro', klub: 'Klub' };

  // Build nav HTML
  let navHtml = '';
  let inUl = false;
  let hasCollapsible = false;
  let inCollapsible = false;

  for (const item of items) {
    if (item.section) {
      if (inUl) { navHtml += '</ul>'; inUl = false; }
      if (inCollapsible) { navHtml += '</ul></div>'; inCollapsible = false; }
      if (item.collapsible) {
        hasCollapsible = true;
        navHtml += `
          <div class="sidebar-section sidebar-collapse-toggle" onclick="toggleSidebarSection(this)" style="cursor:pointer;user-select:none;">
            ${item.section} <i class="bi bi-chevron-down float-end" style="font-size:0.65rem;transition:transform 0.2s"></i>
          </div>
          <div class="sidebar-collapsible" style="overflow:hidden;max-height:0;transition:max-height 0.25s ease">
            <ul class="nav flex-column">`;
        inCollapsible = true; inUl = false;
      } else {
        navHtml += `<div class="sidebar-section">${item.section}</div>`;
      }
      continue;
    }
    if (item.href) {
      if (!inUl && !inCollapsible) { navHtml += '<ul class="nav flex-column">'; inUl = true; }
      const active = isActive(item.href) ? ' active' : '';
      if (planAllowed(item.plan)) {
        const hlStyle = item.highlight ? ' style="color:#f87171!important;font-weight:700;"' : '';
        const liveDot = item.highlight ? ' <span style="display:inline-block;width:6px;height:6px;background:#ef4444;border-radius:50%;margin-left:4px;vertical-align:middle;animation:livePulse 1.4s ease-in-out infinite;"></span>' : '';
        navHtml += `<li class="nav-item"><a class="nav-link${active}"${hlStyle} href="${item.href}"><i class="bi bi-${item.icon}"></i> ${item.label}${liveDot}</a></li>`;
      } else {
        const badge = PLAN_LABEL[item.plan] || item.plan;
        navHtml += `<li class="nav-item">
          <a class="nav-link" href="mailto:klavio.app@gmail.com" style="opacity:0.45;cursor:pointer;" title="Dostupno u ${badge} planu - za nadogradnju pišite na klavio.app@gmail.com">
            <i class="bi bi-${item.icon}"></i> ${item.label}
            <span style="margin-left:auto;font-size:0.58rem;font-weight:700;background:rgba(255,255,255,0.12);padding:1px 6px;border-radius:10px;flex-shrink:0">${badge}</span>
          </a></li>`;
      }
      if (inCollapsible && active) hasCollapsible = false;
    }
  }
  if (inUl) navHtml += '</ul>';
  if (inCollapsible) navHtml += '</ul></div>';

  const isSA = user.role === 'super_admin' && !user.club_id;

  let brandHtml;
  if (isSA) {
    brandHtml = `<img src="/assets/img/klavio-icon.png" alt="Klavio" style="width:100%;height:auto;display:block;">`;
  } else if (club && club.logo_url) {
    brandHtml = `
      <img src="${club.logo_url}?t=${Date.now()}" style="width:36px;height:36px;border-radius:8px;object-fit:contain;flex-shrink:0;" alt="">
      <div style="overflow:hidden;"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${club.name}</div>${selSub}</div>`;
  } else {
    brandHtml = `
      <div style="width:36px;height:36px;border-radius:8px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="bi bi-building" style="font-size:1.1rem;"></i></div>
      <div style="overflow:hidden;"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${club ? club.name : 'Klavio'}</div>${selSub}</div>`;
  }

  const klavioWatermark = isSA ? '' : `
    <div style="padding:8px 16px;text-align:center;">
      <img src="/assets/img/klavio-icon.png" alt="Klavio" style="height:52px;opacity:0.55;">
    </div>`;

  sidebar.innerHTML = `
    <div class="sidebar-brand${isSA ? ' sidebar-brand-sa' : ''}" style="gap:10px;">${brandHtml}</div>
    <nav class="sidebar-nav">${navHtml}</nav>
    ${klavioWatermark}
    <div class="sidebar-footer">
      <div style="display:flex;gap:14px;justify-content:center;padding:10px 0 12px;">
        <a href="https://www.instagram.com/klavio_app/" target="_blank" rel="noopener" title="Instagram" style="color:var(--text-muted,#94a3b8);font-size:1.1rem;text-decoration:none;transition:color .15s;" onmouseover="this.style.color='#e1306c'" onmouseout="this.style.color='var(--text-muted,#94a3b8)'"><i class="bi bi-instagram"></i></a>
        <a href="https://www.facebook.com/people/Klavio/61590365125679/" target="_blank" rel="noopener" title="Facebook" style="color:var(--text-muted,#94a3b8);font-size:1.1rem;text-decoration:none;transition:color .15s;" onmouseover="this.style.color='#1877f2'" onmouseout="this.style.color='var(--text-muted,#94a3b8)'"><i class="bi bi-facebook"></i></a>
      </div>
      <a class="nav-link" href="#" onclick="logout()"><i class="bi bi-box-arrow-left me-2"></i> Odjava</a>
    </div>`;

  // Auto-expand collapsible section if an active link is inside it
  const collapsible = sidebar.querySelector('.sidebar-collapsible');
  if (collapsible) {
    const hasActiveInside = collapsible.querySelector('.nav-link.active');
    if (hasActiveInside) expandSection(collapsible);
  }
}

function toggleSidebarSection(toggle) {
  const collapsible = toggle.nextElementSibling;
  if (!collapsible) return;
  const isOpen = collapsible.style.maxHeight !== '0px' && collapsible.style.maxHeight !== '';
  const icon = toggle.querySelector('i.bi-chevron-down, i.bi-chevron-up');
  if (isOpen) {
    collapsible.style.maxHeight = '0';
    if (icon) { icon.classList.replace('bi-chevron-up','bi-chevron-down'); }
  } else {
    expandSection(collapsible);
    if (icon) { icon.classList.replace('bi-chevron-down','bi-chevron-up'); }
  }
}

function expandSection(collapsible) {
  collapsible.style.maxHeight = collapsible.scrollHeight + 'px';
  const toggle = collapsible.previousElementSibling;
  const icon = toggle && toggle.querySelector('i');
  if (icon) { icon.classList.replace('bi-chevron-down','bi-chevron-up'); }
}

/* ── Branding (CSS vars only - no topbar badge) ── */
function applyBranding() {
  const club = getClub();
  if (!club) return;
  const root = document.documentElement;
  if (club.primary_color) {
    root.style.setProperty('--club-sidebar', club.primary_color);
    root.style.setProperty('--club-accent',  club.primary_color);
  }
}

/* ── Super admin club banner ── */
function renderSuperAdminBanner() {
  if (!isSuperAdminInClub()) return;
  const club = getClub();
  const banner = document.createElement('div');
  banner.id = 'sa-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#dc2626;color:#fff;padding:6px 16px;display:flex;align-items:center;justify-content:space-between;font-size:0.82rem;font-weight:600;';
  banner.innerHTML = `
    <span><i class="bi bi-shield-fill-check me-2"></i>Super Admin - pristupate klubu: <strong>${club ? club.name : ''}</strong></span>
    <button onclick="exitClub()" style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);color:#fff;border-radius:6px;padding:2px 12px;cursor:pointer;font-size:0.8rem;">
      <i class="bi bi-arrow-left me-1"></i>Izlaz iz kluba
    </button>`;
  document.body.prepend(banner);
  const h = '34px';
  const mc = document.querySelector('.main-content');
  if (mc) mc.style.marginTop = h;
  const sb = document.querySelector('.sidebar');
  if (sb) { sb.style.top = h; sb.style.height = `calc(100vh - ${h})`; }
}

/* ── Mobile sidebar ── */
function initMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || !document.querySelector('.main-content')) return;

  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  const topbar = document.querySelector('.topbar');
  if (topbar) {
    const btn = document.createElement('button');
    btn.className = 'sidebar-toggle';
    btn.innerHTML = '<i class="bi bi-list"></i>';
    btn.setAttribute('aria-label', 'Otvori meni');
    topbar.prepend(btn);
    btn.addEventListener('click', () => { sidebar.classList.toggle('sidebar-open'); overlay.classList.toggle('active'); });
  }

  overlay.addEventListener('click', close);
  // Event delegation - works even after sidebar is rebuilt
  sidebar.addEventListener('click', e => {
    if (e.target.closest('.nav-link') && window.innerWidth <= 768) close();
  });

  function close() { sidebar.classList.remove('sidebar-open'); overlay.classList.remove('active'); }
}

/* ── Password change modal ── */
function injectPasswordModal() {
  if (document.getElementById('changePasswordModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal fade" id="changePasswordModal" tabindex="-1">
      <div class="modal-dialog modal-sm">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-key me-2"></i>Promjena lozinke</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div id="cpAlert" class="alert alert-danger d-none py-2 small"></div>
            <div class="mb-3"><label class="form-label">Trenutna lozinka</label><input type="password" class="form-control" id="cpCurrent" placeholder="••••••••"></div>
            <div class="mb-3"><label class="form-label">Nova lozinka</label><input type="password" class="form-control" id="cpNew" placeholder="••••••••"></div>
            <div class="mb-1"><label class="form-label">Ponovi novu lozinku</label><input type="password" class="form-control" id="cpConfirm" placeholder="••••••••"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Odustani</button>
            <button type="button" class="btn btn-primary" id="cpSaveBtn" onclick="submitPasswordChange()">
              <span id="cpSpinner" class="spinner-border spinner-border-sm d-none me-1"></span>Spremi
            </button>
          </div>
        </div>
      </div>
    </div>`);
}
async function submitPasswordChange() {
  const current = document.getElementById('cpCurrent').value;
  const newPass  = document.getElementById('cpNew').value;
  const confirm  = document.getElementById('cpConfirm').value;
  const alertEl  = document.getElementById('cpAlert');
  alertEl.classList.add('d-none');
  if (!current || !newPass || !confirm) { alertEl.textContent='Popunite sva polja.'; alertEl.classList.remove('d-none'); return; }
  if (newPass.length < 6) { alertEl.textContent='Lozinka mora imati najmanje 6 znakova.'; alertEl.classList.remove('d-none'); return; }
  if (newPass !== confirm) { alertEl.textContent='Lozinke se ne podudaraju.'; alertEl.classList.remove('d-none'); return; }
  const spinner = document.getElementById('cpSpinner'), btn = document.getElementById('cpSaveBtn');
  spinner.classList.remove('d-none'); btn.disabled = true;
  try {
    const res = await fetch('/api/auth/change-password', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getToken()}, body:JSON.stringify({currentPassword:current,newPassword:newPass}) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message||'Greška');
    bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
    ['cpCurrent','cpNew','cpConfirm'].forEach(id => document.getElementById(id).value='');
    if (typeof showToast==='function') showToast('Lozinka uspješno promijenjena','success');
  } catch(err) { alertEl.textContent=err.message; alertEl.classList.remove('d-none'); }
  finally { spinner.classList.add('d-none'); btn.disabled=false; }
}
function openPasswordModal() {
  injectPasswordModal();
  ['cpCurrent','cpNew','cpConfirm'].forEach(id => document.getElementById(id).value='');
  document.getElementById('cpAlert').classList.add('d-none');
  new bootstrap.Modal(document.getElementById('changePasswordModal')).show();
}

/* ── Topbar avatar refresh (call after upload/profile update) ── */
function refreshTopbarAvatar(avatarUrl) {
  const stored = getUser();
  if (stored) { stored.avatar_url = avatarUrl; localStorage.setItem('user', JSON.stringify(stored)); }
  const av = document.getElementById('topbar-avatar');
  if (av && typeof renderAvatarEl === 'function') renderAvatarEl(av, avatarUrl, stored ? stored.name : '');
}

/* ── Dark mode ── */
function applyTheme() {
  const t = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', t);
}
function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const btn = document.getElementById('dark-mode-toggle');
  if (btn) {
    btn.innerHTML = next === 'dark'
      ? '<i class="bi bi-sun" style="font-size:1rem"></i>'
      : '<i class="bi bi-moon" style="font-size:1rem"></i>';
    btn.title = next === 'dark' ? 'Prebaci na svijetlu temu' : 'Prebaci na tamnu temu';
  }
}
function injectDarkModeToggle() {
  const topbar = document.querySelector('.topbar');
  if (!topbar || document.getElementById('dark-mode-toggle')) return;
  const btn = document.createElement('button');
  btn.id = 'dark-mode-toggle';
  btn.className = 'dark-mode-btn';
  btn.setAttribute('aria-label', 'Promjena teme');
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.innerHTML = isDark
    ? '<i class="bi bi-sun" style="font-size:1rem"></i>'
    : '<i class="bi bi-moon" style="font-size:1rem"></i>';
  btn.title = isDark ? 'Prebaci na svijetlu temu' : 'Prebaci na tamnu temu';
  btn.onclick = toggleDarkMode;
  const rightSection = topbar.querySelector('.d-flex');
  if (rightSection) rightSection.prepend(btn);
}

/* ── Notification bell (topbar) ── */
async function initNotificationBell() {
  const topbar = document.querySelector('.topbar');
  if (!topbar || !getToken()) return;
  let bell = document.getElementById('notif-bell');
  if (!bell) {
    bell = document.createElement('div');
    bell.id = 'notif-bell';
    bell.style.cssText = 'position:relative;cursor:pointer;';
    bell.title = 'Obavijesti';
    bell.onclick = () => window.location.href = '/pages/notifications/index.html';
    bell.innerHTML = '<i class="bi bi-bell fs-5" style="color:var(--topbar-text,#64748b)"></i><span id="notif-count" class="badge bg-danger position-absolute" style="font-size:0.6rem;top:-4px;right:-6px;min-width:16px;height:16px;padding:0 3px;display:none;align-items:center;justify-content:center;"></span>';
    const userInfo = topbar.querySelector('.d-flex');
    if (userInfo) userInfo.prepend(bell);
  }
  try {
    const res = await fetch('/api/notifications/unread', { headers: { Authorization: 'Bearer ' + getToken() } });
    if (!res.ok) return;
    const { count } = await res.json();
    const badge = document.getElementById('notif-count');
    if (badge) {
      if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.style.display = 'flex'; }
      else badge.style.display = 'none';
    }
  } catch (_) {}
}

/* ── Sidebar badges ── */
async function updateSidebarBadges() {
  const user = getUser();
  if (!user || !getToken()) return;
  try {
    if (user.role === 'super_admin' && !user.club_id) {
      const [tickets, msgs] = await Promise.all([
        apiGet('/support-tickets').catch(() => []),
        apiGet('/platform-messaging').catch(() => [])
      ]);
      const openTickets = tickets.filter(t => t.status === 'open').length;
      if (openTickets) _addSidebarBadge('/pages/support-tickets/index.html', openTickets, '#ef4444');
      const adminReplied = msgs.filter(m => m.last_reply_role === 'admin').length;
      if (adminReplied) _addSidebarBadge('/pages/platform-messages/index.html', adminReplied, '#f59e0b');
    } else {
      const [tickets, notifData, msgs] = await Promise.all([
        apiGet('/support-tickets/mine').catch(() => []),
        apiGet('/notifications/unread').catch(() => ({ count: 0 })),
        apiGet('/platform-messaging/mine').catch(() => [])
      ]);
      const pending = tickets.filter(t => t.status === 'in_progress').length;
      if (pending) _addSidebarBadge('/pages/support/index.html', pending, '#ef4444');
      const unread = notifData.count || notifData.unread || 0;
      if (unread) _addSidebarBadge('/pages/notifications/index.html', unread, '#8b5cf6');
      const newMsgs = msgs.filter(m => m.last_reply_role === 'super_admin' || (!m.reply_count && m.type === 'direct')).length;
      if (newMsgs) _addSidebarBadge('/pages/messages/index.html', newMsgs, '#3b82f6');
    }
  } catch (_) {}
}

function _addSidebarBadge(href, count, color) {
  const link = document.querySelector(`.sidebar .nav-link[href="${href}"]`);
  if (!link || !count) return;
  link.style.display = 'flex';
  link.style.justifyContent = 'space-between';
  link.style.alignItems = 'center';
  const b = document.createElement('span');
  b.textContent = count > 99 ? '99+' : count;
  b.style.cssText = `background:${color};color:#fff;border-radius:9px;font-size:0.62rem;font-weight:700;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;padding:0 5px;margin-left:auto;flex-shrink:0;`;
  link.appendChild(b);
}

/* ── Global search ── */
function initGlobalSearch() {
  const topbar = document.querySelector('.topbar');
  if (!topbar || !getToken()) return;

  // Inject search button
  const btn = document.createElement('button');
  btn.id = 'global-search-btn';
  btn.className = 'dark-mode-btn';
  btn.title = 'Pretraži (Ctrl+K)';
  btn.setAttribute('aria-label', 'Globalna pretraga');
  btn.innerHTML = '<i class="bi bi-search" style="font-size:1rem"></i>';
  btn.onclick = openSearchModal;
  const rightSection = topbar.querySelector('.d-flex');
  if (rightSection) rightSection.prepend(btn);

  // Inject modal HTML
  if (!document.getElementById('globalSearchModal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="globalSearchModal" style="display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.55);backdrop-filter:blur(3px);" onclick="e => { if(e.target===this) closeSearchModal(); }">
        <div style="max-width:600px;margin:80px auto 0;background:var(--card-bg,#fff);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden;">
          <div style="display:flex;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border-color,#e2e8f0);gap:10px;">
            <i class="bi bi-search" style="color:#94a3b8;font-size:1.1rem;flex-shrink:0;"></i>
            <input id="globalSearchInput" type="text" placeholder="Pretraži članove, utakmice, trenere, objave…"
              style="flex:1;border:none;outline:none;font-size:1rem;background:transparent;color:inherit;"
              oninput="debounceSearch(this.value)" onkeydown="searchKeyNav(event)">
            <button onclick="closeSearchModal()" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:1.2rem;line-height:1;padding:0 2px;">&times;</button>
          </div>
          <div id="globalSearchResults" style="max-height:420px;overflow-y:auto;padding:8px 0;">
            <div style="padding:24px;text-align:center;color:#94a3b8;font-size:0.9rem;">Počnite kucati za pretragu…</div>
          </div>
        </div>
      </div>`);
  }

  // Ctrl+K shortcut
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearchModal(); }
    if (e.key === 'Escape') closeSearchModal();
  });

  // Close on backdrop click
  document.getElementById('globalSearchModal').addEventListener('click', function(e) {
    if (e.target === this) closeSearchModal();
  });
}

function openSearchModal() {
  const modal = document.getElementById('globalSearchModal');
  if (!modal) return;
  modal.style.display = 'block';
  setTimeout(() => document.getElementById('globalSearchInput').focus(), 50);
}
function closeSearchModal() {
  const modal = document.getElementById('globalSearchModal');
  if (modal) { modal.style.display = 'none'; }
}

let _searchTimer = null;
function debounceSearch(val) {
  clearTimeout(_searchTimer);
  if (val.trim().length < 2) {
    document.getElementById('globalSearchResults').innerHTML = '<div style="padding:24px;text-align:center;color:#94a3b8;font-size:0.9rem;">Počnite kucati za pretragu…</div>';
    return;
  }
  document.getElementById('globalSearchResults').innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;"><div class="spinner-border spinner-border-sm"></div></div>';
  _searchTimer = setTimeout(() => runSearch(val.trim()), 280);
}

const _FORMS_LIST = [
  { modalId: 'm-fsks-1', name: 'Spisak igrača i službenih osoba', badge: 'FSKS', desc: 'Popunjava se za svaku utakmicu' },
];

async function runSearch(q) {
  try {
    const data = await apiGet('/search?q=' + encodeURIComponent(q));
    const ql = q.toLowerCase();
    data.forms = _FORMS_LIST.filter(f =>
      f.name.toLowerCase().includes(ql) || f.badge.toLowerCase().includes(ql) || f.desc.toLowerCase().includes(ql)
    );
    renderSearchResults(data, q);
  } catch (err) {
    document.getElementById('globalSearchResults').innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:0.85rem;">Greška pri pretrazi: ' + (err.message || '') + '</div>';
  }
}

function renderSearchResults(data, q) {
  const el = document.getElementById('globalSearchResults');
  const total = (data.members||[]).length + (data.matches||[]).length + (data.coaches||[]).length + (data.announcements||[]).length + (data.forms||[]).length;
  if (total === 0) { el.innerHTML = '<div style="padding:24px;text-align:center;color:#94a3b8;font-size:0.9rem;">Nema rezultata za „' + q + '"</div>'; return; }

  const hl = (str) => {
    if (!str) return '';
    return String(str).replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi'), '<mark style="background:#fef08a;border-radius:2px;padding:0 2px;">$1</mark>');
  };

  let html = '';

  if ((data.members||[]).length) {
    html += `<div style="padding:6px 16px 2px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;">Članovi</div>`;
    data.members.forEach(m => {
      const statusCls = { active:'#22c55e', inactive:'#94a3b8', suspended:'#ef4444' }[m.status] || '#94a3b8';
      html += `<a href="/pages/members/detail.html?id=${m.id}" onclick="closeSearchModal()" style="display:flex;align-items:center;gap:10px;padding:9px 16px;text-decoration:none;color:inherit;" class="search-result-row">
        <i class="bi bi-person-circle" style="color:#3b82f6;font-size:1.2rem;flex-shrink:0;"></i>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.9rem;">${hl(m.name)}</div>
          <div style="font-size:0.75rem;color:#94a3b8;">${m.position||''} ${m.selection_name ? '· '+m.selection_name : ''}</div>
        </div>
        <span style="font-size:0.7rem;font-weight:600;color:${statusCls};flex-shrink:0;">${m.status||''}</span>
      </a>`;
    });
  }

  if ((data.matches||[]).length) {
    html += `<div style="padding:6px 16px 2px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-top:4px;">Utakmice</div>`;
    data.matches.forEach(m => {
      const score = m.result !== 'pending' ? `${m.goals_for}:${m.goals_against}` : 'vs';
      const dateStr = m.match_date ? new Date(m.match_date).toLocaleDateString('bs-BA') : '';
      html += `<a href="/pages/matches/detail.html?id=${m.id}" onclick="closeSearchModal()" style="display:flex;align-items:center;gap:10px;padding:9px 16px;text-decoration:none;color:inherit;" class="search-result-row">
        <i class="bi bi-trophy" style="color:#f59e0b;font-size:1.1rem;flex-shrink:0;"></i>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.9rem;">${hl(m.opponent)} <span style="font-weight:400;font-size:0.85rem;color:#94a3b8;">${score}</span></div>
          <div style="font-size:0.75rem;color:#94a3b8;">${dateStr} ${m.selection_name ? '· '+m.selection_name : ''}</div>
        </div>
      </a>`;
    });
  }

  if ((data.coaches||[]).length) {
    html += `<div style="padding:6px 16px 2px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-top:4px;">Treneri</div>`;
    data.coaches.forEach(c => {
      html += `<a href="/pages/coaches/list.html" onclick="closeSearchModal()" style="display:flex;align-items:center;gap:10px;padding:9px 16px;text-decoration:none;color:inherit;" class="search-result-row">
        <i class="bi bi-person-badge" style="color:#8b5cf6;font-size:1.1rem;flex-shrink:0;"></i>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.9rem;">${hl(c.name)}</div>
          <div style="font-size:0.75rem;color:#94a3b8;">${c.email||''}</div>
        </div>
      </a>`;
    });
  }

  if ((data.announcements||[]).length) {
    html += `<div style="padding:6px 16px 2px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-top:4px;">Oglasi</div>`;
    data.announcements.forEach(a => {
      const dateStr = a.created_at ? new Date(a.created_at).toLocaleDateString('bs-BA') : '';
      html += `<a href="/pages/announcements/list.html" onclick="closeSearchModal()" style="display:flex;align-items:center;gap:10px;padding:9px 16px;text-decoration:none;color:inherit;" class="search-result-row">
        <i class="bi bi-megaphone" style="color:#ec4899;font-size:1.1rem;flex-shrink:0;"></i>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.9rem;">${hl(a.title)}</div>
          <div style="font-size:0.75rem;color:#94a3b8;">${dateStr}</div>
        </div>
      </a>`;
    });
  }

  if ((data.forms||[]).length) {
    html += `<div style="padding:6px 16px 2px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-top:4px;">Obrazci</div>`;
    data.forms.forEach(f => {
      const isOnDocs = window.location.pathname.includes('/documents/');
      const onclick = isOnDocs
        ? `closeSearchModal(); setTimeout(() => { const m = document.getElementById('${f.modalId}'); if(m) new bootstrap.Modal(m).show(); }, 100);`
        : `closeSearchModal(); window.location.href='/pages/documents/index.html?open=${f.modalId}';`;
      html += `<a href="javascript:void(0)" onclick="${onclick}" style="display:flex;align-items:center;gap:10px;padding:9px 16px;text-decoration:none;color:inherit;cursor:pointer;" class="search-result-row">
        <i class="bi bi-file-earmark-text" style="color:#22c55e;font-size:1.1rem;flex-shrink:0;"></i>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.9rem;display:flex;align-items:center;gap:6px;">
            <span style="font-size:0.6rem;font-weight:700;background:#dbeafe;color:#1d4ed8;padding:1px 6px;border-radius:3px;">${f.badge}</span>
            ${hl(f.name)}
          </div>
          <div style="font-size:0.75rem;color:#94a3b8;">${f.desc}</div>
        </div>
        <i class="bi bi-arrow-right" style="color:#94a3b8;font-size:0.8rem;flex-shrink:0;"></i>
      </a>`;
    });
  }

  html += `<style>.search-result-row:hover{background:var(--hover-bg,#f8fafc);}</style>`;
  el.innerHTML = html;
}

function searchKeyNav(e) {
  if (e.key === 'Enter') {
    const first = document.querySelector('#globalSearchResults .search-result-row');
    if (first) first.click();
  }
}

/* ── PWA ── */
function initPWA() {
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.json';
    document.head.appendChild(link);
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

/* ── Access block overlay (club inactive / subscription expired) ── */
function showAccessBlock(data) {
  if (isSuperAdminInClub()) return;
  if (document.getElementById('_accessBlock')) return;

  const isInactive = data.code === 'CLUB_INACTIVE';

  function fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    return `${dt.getDate()}.${dt.getMonth() + 1}.${dt.getFullYear()}.`;
  }

  const icon      = isInactive ? 'building-x' : 'calendar-x';
  const iconColor = isInactive ? '#ef4444' : '#f97316';
  const title     = isInactive ? 'Klub je deaktiviran' : 'Pretplata je istekla';
  const msg       = isInactive
    ? 'Vaš klub je deaktiviran od strane administratora platforme. Molimo kontaktirajte Klavio.'
    : 'Pretplata vašeg kluba je istekla. Molimo obnovite je kako biste nastavili koristiti platformu.';

  const expiredRow = (!isInactive && data.expired_at) ? `
    <div style="background:#1e293b;border-radius:12px;padding:14px 28px;margin-bottom:24px;display:inline-block;">
      <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Pretplata istekla</div>
      <div style="font-size:1.15rem;font-weight:700;color:#f97316;margin-top:4px;">${fmtDate(data.expired_at)}</div>
    </div>` : '';

  const club = getClub();
  const contactSubject = encodeURIComponent(isInactive ? 'Deaktiviran klub' : 'Obnova pretplate');
  const contactBody    = encodeURIComponent(isInactive
    ? `Naziv kluba: ${club ? club.name : ''}\n\nMolimo vas da aktivirate naš klub na Klavio platformi.`
    : `Naziv kluba: ${club ? club.name : ''}\n\nMolimo vas da nam pomognete s obnovom pretplate.`);

  const el = document.createElement('div');
  el.id = '_accessBlock';
  el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(5,10,20,0.97);display:flex;align-items:center;justify-content:center;padding:24px;cursor:pointer;';

  el.innerHTML = `
    <div id="_accessBlockCard" style="max-width:520px;width:100%;text-align:center;cursor:default;">
      <img src="/assets/img/klavio-icon.png" alt="Klavio" style="height:56px;margin-bottom:32px;opacity:0.9;">
      <div style="background:#0f172a;border:1px solid #1e293b;border-radius:24px;padding:52px 48px;">
        <div style="width:80px;height:80px;border-radius:50%;background:${iconColor}18;border:1.5px solid ${iconColor}40;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;">
          <i class="bi bi-${icon}" style="font-size:2rem;color:${iconColor};"></i>
        </div>
        <h2 style="margin:0 0 14px;font-size:1.7rem;font-weight:800;color:#f1f5f9;letter-spacing:-0.3px;">${title}</h2>
        <p style="margin:0 0 24px;font-size:0.95rem;color:#64748b;line-height:1.7;">${msg}</p>
        ${expiredRow}
        <a href="mailto:klavio.app@gmail.com?subject=${contactSubject}&body=${contactBody}"
           onclick="event.stopPropagation();"
           style="display:inline-flex;align-items:center;gap:8px;background:#2563eb;color:#fff;font-size:0.95rem;font-weight:600;padding:14px 32px;border-radius:12px;text-decoration:none;">
          <i class="bi bi-envelope"></i> Kontaktirajte Klavio
        </a>
        <p style="margin:20px 0 0;font-size:0.78rem;color:#334155;">Kliknite bilo gdje za odjavu</p>
      </div>
    </div>`;

  // clicking anywhere on the overlay logs out;
  // the contact button uses stopPropagation so it just opens the mail client
  el.addEventListener('click', logout);

  document.body.appendChild(el);
}

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();            // apply dark/light mode before render
  buildSidebar();          // must be first - renders the nav
  applyBranding();         // CSS vars + topbar badge
  renderSuperAdminBanner();
  initMobileSidebar();     // after buildSidebar so the DOM exists
  injectPasswordModal();
  injectDarkModeToggle();  // dark mode button in topbar
  initPWA();
  if (getUser()) { initNotificationBell(); updateSidebarBadges(); initGlobalSearch(); }

  const userNameEl = document.getElementById('userName');
  if (userNameEl) {
    userNameEl.style.cursor = 'pointer';
    userNameEl.title = 'Postavke profila';
    userNameEl.addEventListener('click', () => { window.location.href = '/pages/settings/index.html'; });
  }
});
