'use strict';

// ── Helpers ──────────────────────────────────────────────────────────────────

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s) => (s ? new Date(s.replace(' ', 'T') + (s.length > 10 ? 'Z' : 'T00:00:00')).toLocaleDateString() : '');
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

const PILL = {
  pending: 'warn', submitted: 'warn', requested: 'warn', open: 'ok',
  accepted: 'ok', approved: 'ok', paid: 'ok', completed: 'ok',
  rejected: 'bad', closed: 'neutral', withdrawn: 'neutral',
};
const LABEL = { accepted: 'hired', submitted: 'awaiting approval' };
const pill = (s) => `<span class="pill ${PILL[s] || 'neutral'}">${esc(LABEL[s] || s)}</span>`;

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

const store = {
  get token() { try { return localStorage.getItem('fh_token'); } catch { return null; } },
  set token(v) { try { v ? localStorage.setItem('fh_token', v) : localStorage.removeItem('fh_token'); } catch { /* storage unavailable */ } },
};
let memToken = null;
const getToken = () => store.token || memToken;
let me = null;

async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error('Network error — check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/auth/login') {
    logout(false);
    throw new Error(data.detail || 'Please log in again.');
  }
  if (!res.ok) {
    let msg = data.detail;
    if (Array.isArray(msg)) msg = msg.map((d) => `${(d.loc || []).slice(-1)[0] || 'field'}: ${d.msg}`).join('; ');
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data;
}

function formData(form) {
  const out = {};
  for (const [k, v] of new FormData(form).entries()) out[k] = typeof v === 'string' ? v.trim() : v;
  return out;
}

// Wrap a form submit: disables the button, shows errors inline.
function onSubmit(form, handler) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    const err = form.querySelector('.err');
    if (err) err.textContent = '';
    if (btn) btn.disabled = true;
    try { await handler(formData(form)); }
    catch (ex) { if (err) err.textContent = ex.message; else toast(ex.message); }
    finally { if (btn && btn.isConnected) btn.disabled = false; }
  });
}

// Click handler for [data-act] buttons within the main view.
function actions(root, map) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn || !map[btn.dataset.act]) return;
    btn.disabled = true;
    try { await map[btn.dataset.act](btn.dataset.id, btn); }
    catch (ex) { toast(ex.message); }
    finally { if (btn.isConnected) btn.disabled = false; }
  });
}

function modal(html, onReady) {
  const dlg = document.createElement('dialog');
  dlg.innerHTML = html;
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  dlg.showModal();
  onReady?.(dlg);
  return dlg;
}

function table(headers, rows, emptyMsg) {
  if (!rows.length) return `<div class="empty">${esc(emptyMsg)}</div>`;
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.join('')}</tbody></table></div>`;
}

// ── Auth screens ─────────────────────────────────────────────────────────────

function renderAuth(mode) {
  const isLogin = mode === 'login';
  $('#app').innerHTML = `
    <div class="auth">
      <h1 style="text-align:center">Freelancer Hub</h1>
      <p class="muted" style="text-align:center">Remote work for support, admin and sales freelancers.</p>
      <div class="card">
        <h2>${isLogin ? 'Log in' : 'Create your account'}</h2>
        <form id="auth-form" novalidate>
          ${isLogin ? '' : '<label>Full name<input name="name" autocomplete="name" required maxlength="100"></label>'}
          <label>Email<input name="email" type="email" autocomplete="email" required></label>
          <label>Password<input name="password" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required minlength="8"></label>
          <p class="err"></p>
          <button class="btn" type="submit" style="width:100%">${isLogin ? 'Log in' : 'Sign up'}</button>
        </form>
        <p class="muted" style="text-align:center;margin-bottom:0">
          ${isLogin ? 'New here? <a href="#/signup">Create an account</a>' : 'Already have an account? <a href="#/login">Log in</a>'}
        </p>
      </div>
    </div>`;
  onSubmit($('#auth-form'), async (d) => {
    if (!isLogin && !d.name) throw new Error('Please enter your name.');
    if (!d.email || !d.email.includes('@')) throw new Error('Please enter a valid email.');
    if (!isLogin && d.password.length < 8) throw new Error('Password must be at least 8 characters.');
    const res = await api(isLogin ? '/api/auth/login' : '/api/auth/register', { method: 'POST', body: d });
    memToken = res.token;
    store.token = res.token;
    me = res.user;
    location.hash = '#/';
    route();
  });
}

function logout(redirect = true) {
  store.token = null;
  memToken = null;
  me = null;
  if (redirect) { location.hash = '#/login'; route(); }
}

// ── Shell ────────────────────────────────────────────────────────────────────

const FREELANCER_NAV = [
  ['', 'Dashboard'], ['jobs', 'Job Board'], ['applications', 'Applications'], ['work', 'My Work'],
  ['earnings', 'Earnings'], ['training', 'Training'], ['notifications', 'Notifications'], ['profile', 'Profile'],
];
const ADMIN_NAV = [
  ['', 'Overview'], ['jobs', 'Jobs'], ['applications', 'Applications'], ['timesheets', 'Timesheets'],
  ['payouts', 'Payouts'], ['freelancers', 'Freelancers'], ['training', 'Training'], ['profile', 'Account'],
];

async function renderShell(page) {
  const nav = me.role === 'admin' ? ADMIN_NAV : FREELANCER_NAV;
  let unread = 0;
  try { unread = (await api('/api/notifications?limit=1')).unread; } catch { /* non-critical */ }
  $('#app').innerHTML = `
    <div class="layout">
      <aside class="side" id="side">
        <div class="logo"><span>Freelancer Hub</span><button class="btn ghost sm menu-btn" id="menu-btn" aria-label="Menu">☰</button></div>
        <nav>${nav.map(([p, l]) => `<a href="#/${p}" class="${p === page ? 'active' : ''}">${l}
          ${p === 'notifications' && unread ? `<span class="badge">${unread}</span>` : ''}</a>`).join('')}</nav>
        <div class="me"><div><strong>${esc(me.name)}</strong></div><div class="muted">${esc(me.email)}</div>
          <button class="btn ghost sm" id="logout" style="margin-top:8px">Log out</button></div>
      </aside>
      <main id="view"><p class="muted">Loading…</p></main>
    </div>`;
  $('#logout').addEventListener('click', () => logout());
  $('#menu-btn').addEventListener('click', () => $('#side').classList.toggle('open'));
  return $('#view');
}

// ── Freelancer views ─────────────────────────────────────────────────────────

const F = {};

F[''] = async (v) => {
  const d = await api('/api/dashboard');
  const pct = d.training.total ? Math.round((100 * d.training.completed) / d.training.total) : 100;
  const nextSteps = [];
  if (d.profile_completion < 100) nextSteps.push(`<li><a href="#/profile">Complete your profile</a> (${d.profile_completion}% done)</li>`);
  if (d.training.completed < d.training.total) nextSteps.push('<li><a href="#/training">Finish onboarding training</a></li>');
  if (!d.applications.active && !d.applications.pending) nextSteps.push('<li><a href="#/jobs">Apply to your first job</a></li>');
  if (d.applications.active) nextSteps.push('<li><a href="#/work">Log today\'s hours</a></li>');
  v.innerHTML = `
    <h1>Welcome back, ${esc(me.name.split(' ')[0])}</h1>
    <div class="grid">
      <div class="card stat"><div class="muted">Available balance</div><div class="n">${money(d.balance.available)}</div></div>
      <div class="card stat"><div class="muted">Awaiting approval</div><div class="n">${money(d.balance.pending_approval)}</div></div>
      <div class="card stat"><div class="muted">Hours (last 7 days)</div><div class="n">${d.hours_last_7_days}</div></div>
      <div class="card stat"><div class="muted">Active jobs</div><div class="n">${d.applications.active}</div>
        <div class="muted">${d.applications.pending} pending application(s)</div></div>
    </div>
    <div class="grid">
      <div class="card"><h2>Next steps</h2>${nextSteps.length ? `<ul>${nextSteps.join('')}</ul>` : '<p class="muted">You\'re all caught up.</p>'}</div>
      <div class="card"><h2>Training progress</h2>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <p class="muted">${d.training.completed} of ${d.training.total} modules complete</p></div>
    </div>`;
};

F.jobs = async (v) => {
  const cats = await api('/api/jobs/categories');
  v.innerHTML = `
    <h1>Job Board</h1>
    <div class="card row">
      <input id="q" placeholder="Search jobs, clients…" style="flex:2;min-width:180px;margin:0">
      <select id="cat" style="flex:1;min-width:150px;margin:0"><option value="">All categories</option>
        ${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
    </div>
    <div id="list"></div>`;
  let seq = 0;
  const load = async () => {
    const mine = ++seq;
    const params = new URLSearchParams({ q: $('#q').value, category: $('#cat').value });
    const jobs = await api('/api/jobs?' + params);
    if (mine !== seq) return; // a newer search is in flight
    $('#list').innerHTML = jobs.length ? jobs.map((j) => `
      <div class="card job">
        <div class="row spread"><h3>${esc(j.title)}</h3><strong>${money(j.rate)}/hr</strong></div>
        <div class="muted">${esc(j.client)} · ${esc(j.category)}${j.hours_per_week ? ` · ~${j.hours_per_week} h/week` : ''} · ${j.applicants} applicant(s)</div>
        <p>${esc(j.description)}</p>
        ${j.my_status && j.my_status !== 'withdrawn'
          ? `Your application: ${pill(j.my_status)}`
          : `<button class="btn" data-act="apply" data-id="${j.id}" data-title="${esc(j.title)}">Apply</button>`}
      </div>`).join('') : '<div class="card empty">No open jobs match your search.</div>';
  };
  let t;
  $('#q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => load().catch((e) => toast(e.message)), 250); });
  $('#cat').addEventListener('change', () => load().catch((e) => toast(e.message)));
  actions(v, {
    apply: (id, btn) => modal(`
      <h2>Apply: ${esc(btn.dataset.title)}</h2>
      <form><label>Why are you a good fit? (optional)<textarea name="cover_letter" maxlength="3000"
        placeholder="Relevant experience, availability, tools you know…"></textarea></label>
        <p class="err"></p>
        <div class="row"><button class="btn" type="submit">Submit application</button>
        <button class="btn ghost" type="button" data-close>Cancel</button></div></form>`, (dlg) => {
      onSubmit($('form', dlg), async (d) => {
        await api(`/api/jobs/${id}/apply`, { method: 'POST', body: d });
        dlg.close(); toast('Application submitted'); await load();
      });
    }),
  });
  await load();
};

F.applications = async (v) => {
  const apps = await api('/api/applications');
  v.innerHTML = `<h1>Applications</h1><div class="card">${table(
    ['Job', 'Client', 'Rate', 'Applied', 'Status', ''],
    apps.map((a) => `<tr><td>${esc(a.title)}</td><td>${esc(a.client)}</td><td>${money(a.rate)}/hr</td>
      <td>${fmtDate(a.created_at)}</td><td>${pill(a.status)}</td>
      <td>${a.status === 'pending' ? `<button class="btn ghost sm" data-act="withdraw" data-id="${a.id}">Withdraw</button>` : ''}</td></tr>`),
    'You haven\'t applied to any jobs yet.')}</div>`;
  actions(v, {
    withdraw: async (id) => {
      if (!confirm('Withdraw this application?')) return;
      await api(`/api/applications/${id}/withdraw`, { method: 'POST' });
      toast('Application withdrawn'); await F.applications(v);
    },
  });
};

F.work = async (v) => {
  const [apps, entries] = await Promise.all([api('/api/applications'), api('/api/time')]);
  const active = apps.filter((a) => a.status === 'accepted');
  v.innerHTML = `
    <h1>My Work</h1>
    <div class="card"><h2>Log time</h2>
      ${active.length ? `<form id="time-form" class="form-grid">
        <label>Job<select name="application_id" required>${active.map((a) => `<option value="${a.id}">${esc(a.title)} — ${esc(a.client)}</option>`).join('')}</select></label>
        <label>Date<input type="date" name="work_date" value="${today()}" max="${today()}" required></label>
        <label>Hours<input type="number" name="hours" min="0.25" max="24" step="0.25" required placeholder="e.g. 4.5"></label>
        <label style="grid-column:1/-1">What did you work on?<input name="note" maxlength="500"></label>
        <div><p class="err"></p><button class="btn" type="submit">Submit hours</button></div></form>`
        : '<p class="muted">You\'ll be able to log time once you\'re hired for a job. <a href="#/jobs">Browse jobs</a></p>'}
    </div>
    <div class="card"><h2>Timesheet</h2>${table(
      ['Date', 'Job', 'Hours', 'Amount', 'Note', 'Status', ''],
      entries.map((t) => `<tr><td>${fmtDate(t.work_date)}</td><td>${esc(t.title)}</td><td>${t.hours}</td>
        <td>${money(t.amount)}</td><td>${esc(t.note)}</td><td>${pill(t.status)}</td>
        <td>${t.status === 'submitted' ? `<button class="btn ghost sm" data-act="del" data-id="${t.id}">Delete</button>` : ''}</td></tr>`),
      'No time logged yet.')}</div>`;
  if (active.length) {
    onSubmit($('#time-form'), async (d) => {
      const hours = Number(d.hours);
      if (!(hours > 0 && hours <= 24)) throw new Error('Hours must be between 0 and 24.');
      await api('/api/time', { method: 'POST', body: { ...d, application_id: Number(d.application_id), hours } });
      toast('Hours submitted for approval'); await F.work(v);
    });
  }
  actions(v, {
    del: async (id) => {
      if (!confirm('Delete this time entry?')) return;
      await api(`/api/time/${id}`, { method: 'DELETE' });
      toast('Entry deleted'); await F.work(v);
    },
  });
};

F.earnings = async (v) => {
  const e = await api('/api/earnings');
  const canWithdraw = e.available >= e.min_payout;
  v.innerHTML = `
    <h1>Earnings</h1>
    <div class="grid">
      <div class="card stat"><div class="muted">Available</div><div class="n">${money(e.available)}</div></div>
      <div class="card stat"><div class="muted">Awaiting approval</div><div class="n">${money(e.pending_approval)}</div></div>
      <div class="card stat"><div class="muted">Payout requested</div><div class="n">${money(e.payout_requested)}</div></div>
      <div class="card stat"><div class="muted">Paid out (all time)</div><div class="n">${money(e.paid_out)}</div></div>
    </div>
    <div class="card"><h2>Request a payout</h2>
      <form id="payout-form" class="form-grid">
        <label>Amount (USD)<input type="number" name="amount" min="${e.min_payout}" max="${e.available}" step="0.01" value="${canWithdraw ? e.available : ''}" required ${canWithdraw ? '' : 'disabled'}></label>
        <label>Method<select name="method" ${canWithdraw ? '' : 'disabled'}><option>Bank transfer</option><option>PayPal</option><option>Wise</option><option>Payoneer</option></select></label>
        <div><p class="err">${canWithdraw ? '' : `<span class="muted">Minimum payout is ${money(e.min_payout)}.</span>`}</p>
        <button class="btn" type="submit" ${canWithdraw ? '' : 'disabled'}>Request payout</button></div>
      </form></div>
    <div class="card"><h2>Payout history</h2>${table(['Requested', 'Amount', 'Method', 'Status'],
      e.payouts.map((p) => `<tr><td>${fmtDate(p.created_at)}</td><td>${money(p.amount)}</td><td>${esc(p.method)}</td><td>${pill(p.status)}</td></tr>`),
      'No payouts yet.')}</div>`;
  onSubmit($('#payout-form'), async (d) => {
    const amount = Number(d.amount);
    if (!(amount > 0)) throw new Error('Enter an amount.');
    await api('/api/payouts', { method: 'POST', body: { amount, method: d.method } });
    toast('Payout requested'); await F.earnings(v);
  });
};

F.training = async (v) => {
  const courses = await api('/api/courses');
  const isAdmin = me.role === 'admin';
  v.innerHTML = `
    <div class="row spread"><h1>Training</h1>${isAdmin ? '<button class="btn" data-act="new">New module</button>' : ''}</div>
    ${courses.length ? courses.map((c) => `
      <div class="card"><div class="row spread"><h3>${esc(c.title)}</h3>
        ${isAdmin ? `<button class="btn danger sm" data-act="delete" data-id="${c.id}">Delete</button>` : (c.completed_at ? pill('completed') : `<span class="muted">${c.minutes} min</span>`)}</div>
        <p class="muted">${esc(c.summary)}</p>
        <details><summary>Open module</summary><p style="white-space:pre-wrap">${esc(c.content)}</p>
          ${!isAdmin && !c.completed_at ? `<button class="btn sm" data-act="done" data-id="${c.id}">Mark as complete</button>` : ''}</details>
      </div>`).join('') : '<div class="card empty">No training modules yet.</div>'}`;
  actions(v, {
    done: async (id) => { await api(`/api/courses/${id}/complete`, { method: 'POST' }); toast('Module completed'); await F.training(v); },
    delete: async (id) => {
      if (!confirm('Delete this module?')) return;
      await api(`/api/admin/courses/${id}`, { method: 'DELETE' }); toast('Module deleted'); await F.training(v);
    },
    new: () => modal(`<h2>New training module</h2><form>
        <label>Title<input name="title" required maxlength="120"></label>
        <label>Summary<input name="summary" maxlength="300"></label>
        <label>Estimated minutes<input type="number" name="minutes" value="10" min="1" max="600" required></label>
        <label>Content<textarea name="content" rows="8" maxlength="20000"></textarea></label>
        <p class="err"></p><div class="row"><button class="btn" type="submit">Create</button>
        <button class="btn ghost" type="button" data-close>Cancel</button></div></form>`, (dlg) => {
      onSubmit($('form', dlg), async (d) => {
        if (!d.title) throw new Error('Title is required.');
        await api('/api/admin/courses', { method: 'POST', body: { ...d, minutes: Number(d.minutes) } });
        dlg.close(); toast('Module created'); await F.training(v);
      });
    }),
  });
};

F.notifications = async (v) => {
  const n = await api('/api/notifications?limit=100');
  v.innerHTML = `<div class="row spread"><h1>Notifications</h1>
    ${n.unread ? '<button class="btn ghost sm" data-act="read">Mark all as read</button>' : ''}</div>
    <div class="card">${n.items.length ? n.items.map((x) => `<div class="notif ${x.is_read ? '' : 'unread'}">${esc(x.message)}
      <div class="muted" style="font-weight:400;font-size:.8rem">${fmtDate(x.created_at)}</div></div>`).join('') : '<div class="empty">No notifications.</div>'}</div>`;
  actions(v, { read: async () => { await api('/api/notifications/read', { method: 'POST' }); route(); } });
};

F.profile = async (v) => {
  me = await api('/api/auth/me');
  const isAdmin = me.role === 'admin';
  v.innerHTML = `
    <h1>${isAdmin ? 'Account' : 'Profile'}</h1>
    <div class="card"><form id="profile-form">
      <div class="form-grid">
        <label>Full name<input name="name" value="${esc(me.name)}" required maxlength="100"></label>
        ${isAdmin ? '' : `
        <label>Headline<input name="headline" value="${esc(me.headline)}" maxlength="120" placeholder="e.g. Bilingual support agent, 4 yrs"></label>
        <label>Country<input name="country" value="${esc(me.country)}" maxlength="60"></label>
        <label>Hourly rate (USD)<input type="number" name="hourly_rate" min="0" max="1000" step="0.5" value="${me.hourly_rate || ''}"></label>
        <label>Availability<select name="availability">${['available', 'limited', 'unavailable'].map((a) => `<option ${a === me.availability ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <label>Skills (comma separated)<input name="skills" value="${esc(me.skills.join(', '))}" placeholder="Zendesk, Data entry, Spanish"></label>`}
      </div>
      ${isAdmin ? '' : `<label>About you<textarea name="bio" maxlength="2000">${esc(me.bio)}</textarea></label>`}
      <p class="err"></p><button class="btn" type="submit">Save</button>
    </form></div>
    <div class="card"><h2>Change password</h2><form id="pw-form" class="form-grid">
      <label>Current password<input type="password" name="current_password" autocomplete="current-password" required></label>
      <label>New password<input type="password" name="new_password" autocomplete="new-password" minlength="8" required></label>
      <div><p class="err"></p><button class="btn" type="submit">Update password</button></div></form></div>`;
  onSubmit($('#profile-form'), async (d) => {
    if (!d.name) throw new Error('Name is required.');
    const body = { name: d.name };
    if (!isAdmin) {
      Object.assign(body, {
        headline: d.headline, country: d.country, bio: d.bio, availability: d.availability,
        hourly_rate: d.hourly_rate === '' ? 0 : Number(d.hourly_rate),
        skills: d.skills.split(',').map((s) => s.trim()).filter(Boolean),
      });
    }
    me = await api('/api/auth/me', { method: 'PUT', body });
    toast('Profile saved'); route();
  });
  onSubmit($('#pw-form'), async (d) => {
    if (d.new_password.length < 8) throw new Error('New password must be at least 8 characters.');
    await api('/api/auth/password', { method: 'PUT', body: d });
    $('#pw-form').reset(); toast('Password updated');
  });
};

// ── Admin views ──────────────────────────────────────────────────────────────

const A = {};

A[''] = async (v) => {
  const s = await api('/api/admin/stats');
  const tile = (label, n, href) => `<a class="card stat" href="${href}" style="text-decoration:none;color:inherit"><div class="muted">${label}</div><div class="n">${n}</div></a>`;
  v.innerHTML = `<h1>Overview</h1><div class="grid">
    ${tile('Freelancers', s.freelancers, '#/freelancers')}
    ${tile('Open jobs', s.open_jobs, '#/jobs')}
    ${tile('Applications to review', s.pending_applications, '#/applications')}
    ${tile('Hours to approve', s.pending_time_entries, '#/timesheets')}
    ${tile('Payouts to process', s.pending_payouts, '#/payouts')}
    ${tile('Approved billings', money(s.approved_billings), '#/timesheets')}</div>`;
};

function jobForm(j = {}) {
  return `<form><div class="form-grid">
    <label>Title<input name="title" value="${esc(j.title)}" required maxlength="120"></label>
    <label>Client<input name="client" value="${esc(j.client)}" required maxlength="120"></label>
    <label>Category<input name="category" value="${esc(j.category)}" required maxlength="60" list="cat-list"></label>
    <label>Rate (USD/hr)<input type="number" name="rate" min="0" max="1000" step="0.5" value="${j.rate ?? ''}" required></label>
    <label>Hours per week<input type="number" name="hours_per_week" min="0" max="80" value="${j.hours_per_week ?? 0}"></label></div>
    <datalist id="cat-list"><option>Customer Support</option><option>Data Entry</option><option>Sales & Lead Gen</option><option>Virtual Assistance</option><option>Content Moderation</option></datalist>
    <label>Description<textarea name="description" rows="6" maxlength="5000">${esc(j.description)}</textarea></label>
    <p class="err"></p><div class="row"><button class="btn" type="submit">Save</button>
    <button class="btn ghost" type="button" data-close>Cancel</button></div></form>`;
}

function jobBody(d) {
  if (!d.title || !d.client || !d.category) throw new Error('Title, client and category are required.');
  if (d.rate === '' || Number(d.rate) < 0) throw new Error('Enter a valid rate.');
  return { ...d, rate: Number(d.rate), hours_per_week: Number(d.hours_per_week || 0) };
}

A.jobs = async (v) => {
  const jobs = await api('/api/admin/jobs');
  v.innerHTML = `<div class="row spread"><h1>Jobs</h1><button class="btn" data-act="new">Post a job</button></div>
    <div class="card">${table(['Title', 'Client', 'Rate', 'Pending', 'Hired', 'Status', ''],
      jobs.map((j) => `<tr><td>${esc(j.title)}<div class="muted">${esc(j.category)}</div></td><td>${esc(j.client)}</td>
        <td>${money(j.rate)}/hr</td><td>${j.pending}</td><td>${j.hired}</td><td>${pill(j.status)}</td>
        <td class="row"><button class="btn ghost sm" data-act="edit" data-id="${j.id}">Edit</button>
          <button class="btn ghost sm" data-act="toggle" data-id="${j.id}">${j.status === 'open' ? 'Close' : 'Reopen'}</button>
          <button class="btn danger sm" data-act="delete" data-id="${j.id}">Delete</button></td></tr>`),
      'No jobs posted yet.')}</div>`;
  const byId = (id) => jobs.find((j) => String(j.id) === String(id));
  actions(v, {
    new: () => modal(`<h2>Post a job</h2>${jobForm()}`, (dlg) => onSubmit($('form', dlg), async (d) => {
      await api('/api/admin/jobs', { method: 'POST', body: jobBody(d) }); dlg.close(); toast('Job posted'); await A.jobs(v);
    })),
    edit: (id) => modal(`<h2>Edit job</h2>${jobForm(byId(id))}`, (dlg) => onSubmit($('form', dlg), async (d) => {
      await api(`/api/admin/jobs/${id}`, { method: 'PATCH', body: jobBody(d) }); dlg.close(); toast('Job updated'); await A.jobs(v);
    })),
    toggle: async (id) => {
      await api(`/api/admin/jobs/${id}`, { method: 'PATCH', body: { status: byId(id).status === 'open' ? 'closed' : 'open' } });
      await A.jobs(v);
    },
    delete: async (id) => {
      if (!confirm('Delete this job and all its applications?')) return;
      await api(`/api/admin/jobs/${id}`, { method: 'DELETE' }); toast('Job deleted'); await A.jobs(v);
    },
  });
};

A.applications = async (v) => {
  const apps = await api('/api/admin/applications');
  v.innerHTML = `<h1>Applications</h1><div class="card">${table(['Freelancer', 'Job', 'Cover letter', 'Applied', 'Status', ''],
    apps.map((a) => `<tr><td><strong>${esc(a.freelancer_name)}</strong><div class="muted">${esc(a.headline || a.freelancer_email)}</div>
        ${(a.skills || '').split(',').filter(Boolean).map((s) => `<span class="tag">${esc(s)}</span>`).join('')}</td>
      <td>${esc(a.title)}<div class="muted">${esc(a.client)}</div></td><td style="max-width:320px">${esc(a.cover_letter) || '<span class="muted">—</span>'}</td>
      <td>${fmtDate(a.created_at)}</td><td>${pill(a.status)}</td>
      <td>${a.status === 'pending' ? `<div class="row"><button class="btn sm" data-act="accepted" data-id="${a.id}">Hire</button>
        <button class="btn ghost sm" data-act="rejected" data-id="${a.id}">Reject</button></div>` : ''}</td></tr>`),
    'No applications yet.')}</div>`;
  const decide = (status) => async (id) => {
    await api(`/api/admin/applications/${id}/decision`, { method: 'POST', body: { status } });
    toast(status === 'accepted' ? 'Freelancer hired' : 'Application rejected'); await A.applications(v);
  };
  actions(v, { accepted: decide('accepted'), rejected: decide('rejected') });
};

A.timesheets = async (v) => {
  const rows = await api('/api/admin/time');
  v.innerHTML = `<h1>Timesheets</h1><div class="card">${table(['Date', 'Freelancer', 'Job', 'Hours', 'Amount', 'Note', 'Status', ''],
    rows.map((t) => `<tr><td>${fmtDate(t.work_date)}</td><td>${esc(t.freelancer_name)}</td><td>${esc(t.title)}</td>
      <td>${t.hours}</td><td>${money(t.amount)}</td><td>${esc(t.note)}</td><td>${pill(t.status)}</td>
      <td>${t.status === 'submitted' ? `<div class="row"><button class="btn sm" data-act="approved" data-id="${t.id}">Approve</button>
        <button class="btn ghost sm" data-act="rejected" data-id="${t.id}">Reject</button></div>` : ''}</td></tr>`),
    'No time entries yet.')}</div>`;
  const decide = (status) => async (id) => {
    await api(`/api/admin/time/${id}/decision`, { method: 'POST', body: { status } }); toast(`Entry ${status}`); await A.timesheets(v);
  };
  actions(v, { approved: decide('approved'), rejected: decide('rejected') });
};

A.payouts = async (v) => {
  const rows = await api('/api/admin/payouts');
  v.innerHTML = `<h1>Payouts</h1><div class="card">${table(['Requested', 'Freelancer', 'Amount', 'Method', 'Status', ''],
    rows.map((p) => `<tr><td>${fmtDate(p.created_at)}</td><td>${esc(p.freelancer_name)}<div class="muted">${esc(p.freelancer_email)}</div></td>
      <td>${money(p.amount)}</td><td>${esc(p.method)}</td><td>${pill(p.status)}</td>
      <td>${p.status === 'requested' ? `<div class="row"><button class="btn sm" data-act="paid" data-id="${p.id}">Mark paid</button>
        <button class="btn ghost sm" data-act="rejected" data-id="${p.id}">Decline</button></div>` : ''}</td></tr>`),
    'No payout requests yet.')}</div>`;
  const decide = (status) => async (id) => {
    await api(`/api/admin/payouts/${id}/decision`, { method: 'POST', body: { status } }); toast(`Payout ${status}`); await A.payouts(v);
  };
  actions(v, { paid: decide('paid'), rejected: decide('rejected') });
};

A.freelancers = async (v) => {
  const rows = await api('/api/admin/freelancers');
  v.innerHTML = `<h1>Freelancers</h1><div class="card">${table(['Name', 'Skills', 'Rate', 'Availability', 'Active jobs', 'Training', 'Balance', 'Joined'],
    rows.map((u) => `<tr><td><strong>${esc(u.name)}</strong><div class="muted">${esc(u.email)}</div><div class="muted">${esc(u.headline)}</div></td>
      <td>${u.skills.map((s) => `<span class="tag">${esc(s)}</span>`).join('') || '<span class="muted">—</span>'}</td>
      <td>${u.hourly_rate ? money(u.hourly_rate) + '/hr' : '—'}</td><td>${esc(u.availability)}</td><td>${u.active_jobs}</td>
      <td>${u.training.completed}/${u.training.total}</td><td>${money(u.balance.available)}</td><td>${fmtDate(u.created_at)}</td></tr>`),
    'No freelancers have signed up yet.')}</div>`;
};

A.training = F.training;
A.profile = F.profile;

// ── Router ───────────────────────────────────────────────────────────────────

let routeSeq = 0;
async function route() {
  const mine = ++routeSeq;
  const page = location.hash.replace(/^#\/?/, '').split('?')[0];
  if (!getToken()) {
    renderAuth(page === 'signup' ? 'signup' : 'login');
    return;
  }
  try {
    if (!me) me = await api('/api/auth/me');
  } catch {
    renderAuth('login');
    return;
  }
  if (page === 'login' || page === 'signup') { location.hash = '#/'; return; }
  const views = me.role === 'admin' ? A : F;
  const view = Object.prototype.hasOwnProperty.call(views, page) ? views[page] : null;
  const v = await renderShell(view ? page : '');
  if (mine !== routeSeq) return;
  try {
    await (view || views[''])(v);
  } catch (e) {
    if (mine === routeSeq && getToken()) v.innerHTML = `<div class="card"><p class="err">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Retry</button></div>`;
    else if (!getToken()) renderAuth('login');
  }
}

window.addEventListener('hashchange', route);
route();
