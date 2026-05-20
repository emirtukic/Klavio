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

    // Avatar circle — insert just before the name element
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
