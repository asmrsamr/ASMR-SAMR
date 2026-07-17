(function () {
  'use strict';

  const SESSION_KEY = 'asmr_samr_admin_supabase_session_v1';
  const DEFAULT_URL = 'https://thpuomqhqghqskyegpfj.supabase.co';
  const PAGE_SIZE = 20;
  const STAFF_ROLES = new Set(['admin', 'manager', 'finance', 'marketing', 'inventory', 'production', 'support']);
  const SENSITIVE_FIELDS = new Set([
    'password', 'password_hash', 'key_hash', 'code_hash', 'raw_key', 'raw_code',
    'service_role', 'access_token', 'refresh_token', 'raw'
  ]);

  const NAV_ITEMS = [
    ['overview', 'Overview'],
    ['orders', 'Orders'],
    ['products', 'Products'],
    ['inventory', 'Inventory'],
    ['customers', 'Customers'],
    ['wishlist', 'Wishlist'],
    ['rewards', 'Rewards'],
    ['gifting', 'Gifting'],
    ['preorders', 'Pre-orders'],
    ['coupons', 'Coupons'],
    ['content', 'Content'],
    ['marketing', 'Marketing'],
    ['notifications', 'Notifications'],
    ['reports', 'Reports'],
    ['roles', 'Roles'],
    ['settings', 'Settings'],
    ['status', 'Status'],
    ['ingredients', 'Ingredients'],
    ['suppliers', 'Suppliers'],
    ['purchase-orders', 'Purchase Orders'],
    ['formulas', 'Formulas'],
    ['production', 'Production'],
    ['finance', 'Finance'],
    ['costing', 'Costing'],
    ['users', 'User Management'],
    ['campaigns', 'Campaigns'],
    ['api-keys', 'API Keys'],
    ['audit', 'Audit Log']
  ];

  const NAV_SECTIONS = [
    { label: 'Commerce', tabs: ['overview', 'orders', 'products', 'inventory', 'customers', 'wishlist', 'rewards', 'gifting', 'preorders', 'coupons'] },
    { label: 'Experience', tabs: ['content', 'marketing', 'notifications', 'reports', 'roles', 'settings', 'status'] },
    { label: 'Operations', tabs: ['ingredients', 'suppliers', 'purchase-orders', 'formulas', 'production', 'finance', 'costing'] },
    { label: 'System', tabs: ['users', 'campaigns', 'api-keys', 'audit'] }
  ];

  const LABELS = Object.fromEntries(NAV_ITEMS);
  const runtime = {
    route: 'overview',
    tab: 'overview',
    section: '',
    profile: null,
    permissions: new Set(),
    mountId: 0,
    queries: {},
    rows: {},
    totals: {},
    configs: {},
    aborters: new Map(),
    activeForm: null,
    confirmation: null,
    flashTimer: 0,
    searchTimer: 0
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function attr(value) {
    return esc(value).replaceAll('\n', '&#10;').replaceAll('\r', '');
  }

  function titleCase(value) {
    return String(value || '')
      .replaceAll('_', ' ')
      .replaceAll('-', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function clampText(value, length = 74) {
    const text = String(value == null ? '' : value);
    return text.length > length ? `${text.slice(0, length - 3)}...` : text;
  }

  function parseJson(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function formatDate(value, dateOnly = false) {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-SA', dateOnly
      ? { year: 'numeric', month: 'short', day: 'numeric' }
      : { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    ).format(date);
  }

  function formatMoney(value, currency = 'SAR') {
    const amount = Number(value) || 0;
    try {
      return new Intl.NumberFormat('en-SA', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (_) {
      return `${amount.toFixed(2)} ${currency}`;
    }
  }

  function formatNumber(value, maximumFractionDigits = 3) {
    return new Intl.NumberFormat('en-SA', { maximumFractionDigits }).format(Number(value) || 0);
  }

  function getConfig() {
    const config = window.ASMR_SAMR_CONFIG || window.ASMR_SAMR_SUPABASE || {};
    return {
      url: String(config.supabaseUrl || config.SUPABASE_URL || DEFAULT_URL).replace(/\/+$/, ''),
      anonKey: config.supabaseAnonKey || config.SUPABASE_ANON_KEY || config.anonKey || ''
    };
  }

  function getSession() {
    const own = parseJson(localStorage.getItem(SESSION_KEY), null);
    if (own && own.access_token) return own;
    const projectRef = (getConfig().url.match(/https:\/\/([^.]+)\.supabase\.co/i) || [])[1];
    if (!projectRef) return null;
    const standard = parseJson(localStorage.getItem(`sb-${projectRef}-auth-token`), null);
    if (standard && standard.access_token) return standard;
    if (standard && standard.currentSession && standard.currentSession.access_token) return standard.currentSession;
    return null;
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function decodeJwt(token) {
    try {
      const payload = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
      return JSON.parse(decodeURIComponent(atob(payload).split('').map((char) =>
        '%' + char.charCodeAt(0).toString(16).padStart(2, '0')
      ).join('')));
    } catch (_) {
      return {};
    }
  }

  function userIdFromSession(session) {
    if (session && session.user && session.user.id) return session.user.id;
    return session && session.access_token ? decodeJwt(session.access_token).sub : '';
  }

  async function refreshSessionIfNeeded(session) {
    if (!session || !session.access_token) return null;
    const claims = decodeJwt(session.access_token);
    const expiresAt = Number(session.expires_at || claims.exp || 0);
    if (!expiresAt || expiresAt * 1000 > Date.now() + 60_000) return session;
    if (!session.refresh_token) return null;
    const config = getConfig();
    const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    saveSession(payload);
    return payload;
  }

  function parseContentRange(value) {
    if (!value || !value.includes('/')) return null;
    const total = value.split('/').pop();
    return total === '*' ? null : Number(total);
  }

  async function request(path, options = {}) {
    const config = getConfig();
    let session = getSession();
    if (session) session = await refreshSessionIfNeeded(session);
    const token = options.public ? config.anonKey : session && session.access_token;
    if (!config.url || !config.anonKey) throw new Error('Supabase publishable configuration is missing.');
    if (!token) throw new Error('Authentication is required.');
    const absoluteApiPath = /^\/(auth|functions|storage)\//.test(path);
    const url = absoluteApiPath
      ? `${config.url}${path}`
      : `${config.url}/rest/v1/${path.replace(/^\/+/, '')}`;
    const headers = {
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined && !(options.body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    };
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined
        ? undefined
        : (options.body instanceof Blob || typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body)),
      signal: options.signal
    });
    const raw = await response.text();
    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch (_) {
      payload = raw;
    }
    if (!response.ok) {
      const message = payload && (payload.message || payload.error || payload.details || payload.hint);
      throw new Error(message || `Request failed (${response.status})`);
    }
    return {
      data: payload,
      count: parseContentRange(response.headers.get('content-range')),
      status: response.status,
      headers: response.headers
    };
  }

  function db(path, options) {
    return request(path, options);
  }

  async function rpc(name, args) {
    const result = await request(`rpc/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: args || {}
    });
    return result.data;
  }

  async function edge(name, body) {
    const result = await request(`/functions/v1/${encodeURIComponent(name)}`, {
      method: 'POST',
      body
    });
    return result.data;
  }

  function can(permission) {
    return Boolean(runtime.profile && (
      runtime.profile.role === 'admin' ||
      runtime.permissions.has(permission)
    ));
  }

  function canRead(config) {
    return !config.permission ||
      can(`${config.permission}.read`) ||
      can(`${config.permission}.write`);
  }

  function canWrite(config) {
    return !config.permission || can(`${config.permission}.write`);
  }

  function setBusy(active) {
    document.body.classList.toggle('admin-is-busy', Boolean(active));
  }

  function errorMessage(error) {
    return String(error && error.message ? error.message : 'The operation could not be completed.')
      .replace(/^Error:\s*/i, '')
      .trim();
  }

  function announce(message, tone = 'success') {
    const node = document.getElementById('admin-flash');
    if (!node) return;
    window.clearTimeout(runtime.flashTimer);
    node.className = `admin-flash is-visible ${tone}`;
    node.textContent = message;
    runtime.flashTimer = window.setTimeout(() => {
      node.className = 'admin-flash';
      node.textContent = '';
    }, 4200);
  }

  function loadingState(label = 'Loading current records') {
    return `<div class="admin-state admin-loading-state" role="status">
      <span class="admin-loader" aria-hidden="true"></span>
      <strong>${esc(label)}</strong>
      <small>Connected securely to the operations database.</small>
    </div>`;
  }

  function emptyState(title, detail, actionHtml = '') {
    return `<div class="admin-state admin-empty-state">
      <span class="admin-state-mark" aria-hidden="true">+</span>
      <strong>${esc(title)}</strong>
      <small>${esc(detail)}</small>
      ${actionHtml}
    </div>`;
  }

  function errorState(error, retry = 'ASMRSAMRAdmin.reload()') {
    return `<div class="admin-state admin-error-state" role="alert">
      <span class="admin-state-mark" aria-hidden="true">!</span>
      <strong>Unable to load this section</strong>
      <small>${esc(errorMessage(error))}</small>
      <button type="button" class="admin-secondary-btn" onclick="${retry}">Try again</button>
    </div>`;
  }

  function renderNav(activeTab) {
    return NAV_SECTIONS.map((section) => `
      <div class="admin-nav-section">
        <span class="admin-nav-heading">${esc(section.label)}</span>
        ${section.tabs.map((tab) => `
          <a href="#/admin${tab === 'overview' ? '' : '/' + tab}"
             class="admin-nav-link ${activeTab === tab ? 'active' : ''}"
             ${activeTab === tab ? 'aria-current="page"' : ''}>
            <span>${esc(LABELS[tab])}</span>
          </a>
        `).join('')}
      </div>
    `).join('');
  }

  function render(route = 'overview') {
    const cleanRoute = String(route || 'overview').replace(/^\/+|\/+$/g, '') || 'overview';
    const pieces = cleanRoute.split('/');
    const tab = LABELS[pieces[0]] ? pieces[0] : 'overview';
    const section = pieces.slice(1).join('/');
    runtime.route = cleanRoute;
    runtime.tab = tab;
    runtime.section = section;
    const mountId = ++runtime.mountId;
    queueMicrotask(() => mount(tab, section, mountId));

    return `
      <div class="admin-dashboard-wrapper admin-dashboard-enhanced">
        <button type="button" class="admin-sidebar-backdrop" aria-label="Close dashboard menu"
                onclick="ASMRSAMRAdmin.toggleSidebar(false)"></button>
        <aside class="admin-sidebar" id="admin-sidebar" aria-label="Admin sections">
          <div class="admin-sidebar-head">
            <a href="#/" class="admin-brand-lockup" aria-label="Return to storefront">
              <span>A S M R &amp; S A M R</span>
              <small>Admin Studio</small>
            </a>
            <button type="button" class="admin-sidebar-close" aria-label="Close dashboard menu"
                    onclick="ASMRSAMRAdmin.toggleSidebar(false)">×</button>
          </div>
          <nav class="admin-nav" aria-label="Dashboard navigation">
            ${renderNav(tab)}
          </nav>
          <div class="admin-sidebar-footer">
            <div class="admin-sidebar-identity" id="admin-sidebar-identity">
              <span>Secure workspace</span>
              <strong>Checking access</strong>
              <small>Supabase authorization</small>
            </div>
            <div class="admin-sidebar-actions">
              <button type="button" onclick="ASMRSAMRAdmin.openProfile()">Profile</button>
              <a href="#/admin/settings">Settings</a>
              <button type="button" onclick="ASMRSAMRAdmin.logout()">Logout</button>
            </div>
          </div>
        </aside>

        <main class="admin-main" aria-label="ASMR and SAMR admin dashboard">
          <div class="admin-mobile-bar">
            <button type="button" class="admin-menu-toggle" onclick="ASMRSAMRAdmin.toggleSidebar(true)"
                    aria-controls="admin-sidebar" aria-expanded="false">Menu</button>
            <span>A S M R &amp; S A M R</span>
          </div>
          <header class="admin-topbar" id="admin-page-header">
            <div>
              <span class="admin-eyebrow">Control plane</span>
              <h1>${esc(LABELS[tab])}</h1>
              <p>Loading the current business records.</p>
            </div>
          </header>
          <div id="admin-flash" class="admin-flash" role="status" aria-live="polite"></div>
          <section id="admin-live-root" aria-live="polite">${loadingState()}</section>
        </main>
        <div id="admin-modal-root"></div>
      </div>
    `;
  }

  async function mount(tab, section, mountId) {
    const root = document.getElementById('admin-live-root');
    if (!root || mountId !== runtime.mountId) return;
    if (!getConfig().anonKey) {
      renderConfigRequired(root);
      updateIdentity(null);
      return;
    }
    let session = getSession();
    if (!session) {
      renderLogin(root);
      updateHeader('Sign in', 'Use an authorized team account to enter the operations dashboard.', false);
      updateIdentity(null);
      return;
    }

    try {
      setBusy(true);
      session = await refreshSessionIfNeeded(session);
      if (!session) {
        localStorage.removeItem(SESSION_KEY);
        renderLogin(root, 'Your session expired. Sign in again.');
        return;
      }
      const userId = userIdFromSession(session);
      const profileResult = await db(
        `profiles?id=eq.${encodeURIComponent(userId)}&select=id,full_name,email,phone,role,status,membership_tier,points,last_login_at,last_activity_at,created_at,updated_at`
      );
      const profile = Array.isArray(profileResult.data) ? profileResult.data[0] : null;
      if (!profile || !STAFF_ROLES.has(profile.role) || profile.status !== 'active') {
        renderAccessDenied(root, profile);
        updateIdentity(profile);
        return;
      }
      runtime.profile = profile;
      if (profile.role === 'admin') {
        runtime.permissions = new Set(['*']);
      } else {
        const permissionResult = await db(
          `role_permissions?role_name=eq.${encodeURIComponent(profile.role)}&select=permission`
        );
        runtime.permissions = new Set((permissionResult.data || []).map((row) => row.permission));
      }
      updateIdentity(profile);
      updateHeader(LABELS[tab], pageDescription(tab, section), true);
      await dispatchPage(tab, section, root, mountId);
    } catch (error) {
      if (mountId === runtime.mountId) root.innerHTML = errorState(error);
    } finally {
      setBusy(false);
    }
  }

  function pageDescription(tab, section) {
    const descriptions = {
      overview: 'Live sales, stock, finance, customers, production, and campaign signals.',
      orders: 'Manage orders, payments, returns, refunds, and fulfilment records.',
      products: 'Manage the catalog, variants, publishing, related details, and product photography.',
      inventory: 'Adjust stock through controlled movements and review valuation and alerts.',
      customers: 'Review customer records, membership, orders, preferences, and activity.',
      wishlist: 'Review saved-product demand signals with role-based customer access.',
      rewards: 'Review balances and apply reasoned, audited point adjustments.',
      gifting: 'Manage secure gift cards and gift-ready commerce records.',
      preorders: 'Manage reservations from request through conversion or cancellation.',
      coupons: 'Create and maintain validated promotion codes.',
      content: 'Manage storefront sections, journal entries, FAQs, policies, and SEO content.',
      marketing: 'Plan campaigns, audiences, calendars, content, partners, and performance.',
      notifications: 'Manage operational and customer notifications.',
      reports: 'Build filtered operational exports and printable reports.',
      roles: 'Review roles and assign module permissions.',
      settings: 'Manage shipping, tax, operational, and security settings.',
      status: 'Verify the database connection, session, modules, and storage configuration.',
      ingredients: 'Manage perfumery materials, lots, movements, expiry, cost, and documentation.',
      suppliers: 'Maintain supplier contacts, terms, status, and purchasing references.',
      'purchase-orders': 'Manage ingredient and packaging purchase orders.',
      formulas: 'Protect formula versions, ingredients, approvals, and trial history.',
      production: 'Plan and confirm batches with transactional ingredient deductions.',
      finance: 'Operate the ledger, payments, receivables, payables, budgets, and statements.',
      costing: 'Maintain cost components and preserve historical product cost snapshots.',
      users: 'Invite and manage customers, staff, roles, rewards, status, and privacy actions.',
      campaigns: 'Manage campaign schedules, spend, conversion, revenue, and ROAS.',
      'api-keys': 'Create, rotate, revoke, and audit server API credentials securely.',
      audit: 'Review sensitive business and administrative changes.'
    };
    return descriptions[tab] || `Manage ${section || tab} records.`;
  }

  function updateHeader(title, description, showActions) {
    const header = document.getElementById('admin-page-header');
    if (!header) return;
    header.innerHTML = `
      <div>
        <span class="admin-eyebrow">Control plane</span>
        <h1>${esc(title)}</h1>
        <p>${esc(description)}</p>
      </div>
      ${showActions ? `
        <div class="admin-topbar-actions">
          <span class="admin-updated">${runtime.profile ? esc(titleCase(runtime.profile.role)) : ''}</span>
          <a href="#/" class="admin-secondary-btn">View site</a>
          <button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.reload()">Refresh</button>
          <button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.exportCurrent('csv')">Export</button>
        </div>
      ` : ''}
    `;
  }

  function updateIdentity(profile) {
    const node = document.getElementById('admin-sidebar-identity');
    if (!node) return;
    if (!profile) {
      node.innerHTML = '<span>Secure workspace</span><strong>Not signed in</strong><small>Authentication required</small>';
      return;
    }
    node.innerHTML = `
      <span>${esc(titleCase(profile.role))}</span>
      <strong>${esc(profile.full_name || profile.email || 'Team member')}</strong>
      <small>${esc(profile.email || 'Authorized account')}</small>
    `;
  }

  function renderConfigRequired(root) {
    updateHeader('Configuration required', 'Add the Supabase publishable key locally before signing in.', false);
    root.innerHTML = `
      <article class="admin-panel admin-auth-panel">
        <span class="admin-eyebrow">Secure configuration</span>
        <h2>Connect the dashboard</h2>
        <p>The project URL is configured, but the browser-safe Supabase publishable key is not available. Service-role keys must never be placed here.</p>
        <code>website/config.local.js</code>
      </article>
    `;
  }

  function renderLogin(root, message = '') {
    runtime.profile = null;
    runtime.permissions = new Set();
    root.innerHTML = `
      <article class="admin-panel admin-auth-panel">
        <span class="admin-eyebrow">Authorized access</span>
        <h2>Sign in to Admin Studio</h2>
        <p>Use an active administrator or staff account. Each module is checked again by Supabase Row Level Security.</p>
        <form class="admin-settings-form" onsubmit="ASMRSAMRAdmin.login(event)" novalidate>
          <label><span>Email</span><input name="email" type="email" autocomplete="username" required></label>
          <label><span>Password</span><input name="password" type="password" autocomplete="current-password" required minlength="8"></label>
          <p class="admin-form-error" id="admin-login-error" ${message ? '' : 'hidden'}>${esc(message)}</p>
          <button type="submit" class="admin-primary-btn">Sign in</button>
        </form>
      </article>
    `;
  }

  function renderAccessDenied(root, profile) {
    updateHeader('Access unavailable', 'This account is not authorized for the operations dashboard.', false);
    root.innerHTML = `
      <article class="admin-panel admin-auth-panel">
        <span class="admin-eyebrow">Access control</span>
        <h2>Administrator access is required</h2>
        <p>${profile
          ? `The account is currently ${esc(profile.status)} with the ${esc(profile.role)} role.`
          : 'No active dashboard profile is connected to this account.'}</p>
        <button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.logout()">Sign out</button>
      </article>
    `;
  }

  async function login(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const errorNode = document.getElementById('admin-login-error');
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = 'Enter a valid email and password.';
      }
      return;
    }
    try {
      setBusy(true);
      const config = getConfig();
      const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error_description || payload.msg || payload.message || 'Sign in failed.');
      }
      saveSession(payload);
      reload();
    } catch (error) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = errorMessage(error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      if (getSession()) await request('/auth/v1/logout', { method: 'POST' }).catch(() => null);
    } finally {
      localStorage.removeItem(SESSION_KEY);
      runtime.profile = null;
      runtime.permissions = new Set();
      reload();
    }
  }

  function toggleSidebar(force) {
    const open = typeof force === 'boolean'
      ? force
      : !document.body.classList.contains('admin-sidebar-open');
    document.body.classList.toggle('admin-sidebar-open', open);
    const button = document.querySelector('.admin-menu-toggle');
    if (button) button.setAttribute('aria-expanded', String(open));
  }

  function reload() {
    closeModal();
    const root = document.getElementById('admin-live-root');
    if (root) root.innerHTML = loadingState();
    mount(runtime.tab, runtime.section, ++runtime.mountId);
  }

  function openProfile() {
    if (!runtime.profile) return;
    openRecordModal('Admin profile', [
      ['Name', runtime.profile.full_name],
      ['Email', runtime.profile.email],
      ['Phone', runtime.profile.phone],
      ['Role', titleCase(runtime.profile.role)],
      ['Status', titleCase(runtime.profile.status)],
      ['Membership', titleCase(runtime.profile.membership_tier)],
      ['Reward points', runtime.profile.points],
      ['Last login', formatDate(runtime.profile.last_login_at)],
      ['Last activity', formatDate(runtime.profile.last_activity_at)],
      ['Created', formatDate(runtime.profile.created_at)]
    ]);
  }

  function openModal(content, label = 'Dialog') {
    const root = document.getElementById('admin-modal-root');
    if (!root) return;
    root.innerHTML = `
      <div class="admin-editor-backdrop" role="presentation" onclick="ASMRSAMRAdmin.backdropClose(event)">
        <section class="admin-product-editor admin-modal" role="dialog" aria-modal="true" aria-label="${attr(label)}">
          <button type="button" class="admin-editor-close" aria-label="Close dialog" onclick="ASMRSAMRAdmin.closeModal()">×</button>
          ${content}
        </section>
      </div>
    `;
    document.body.classList.add('admin-editor-open');
    const focusable = root.querySelector('input, select, textarea, button:not(.admin-editor-close), a');
    if (focusable) window.setTimeout(() => focusable.focus(), 0);
  }

  function closeModal() {
    const root = document.getElementById('admin-modal-root');
    if (root) root.innerHTML = '';
    document.body.classList.remove('admin-editor-open');
  }

  function backdropClose(event) {
    if (event.target.classList.contains('admin-editor-backdrop')) closeModal();
  }

  function renderValue(value, key = '') {
    if (value === null || value === undefined || value === '') {
      return '<span class="admin-null">Not set</span>';
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return esc(value.join(', '));
    if (typeof value === 'object') {
      return `<pre class="admin-json">${esc(JSON.stringify(value, null, 2))}</pre>`;
    }
    if (/(_at|_date|date)$/.test(key) && !Number.isNaN(new Date(value).getTime())) {
      return esc(formatDate(value));
    }
    return esc(value);
  }

  function openRecordModal(title, pairs) {
    openModal(`
      <span class="admin-eyebrow">Record details</span>
      <h2>${esc(title)}</h2>
      <dl class="admin-detail-grid">
        ${pairs
          .filter(([key]) => !SENSITIVE_FIELDS.has(String(key).toLowerCase()))
          .map(([label, value]) => `
            <div>
              <dt>${esc(titleCase(label))}</dt>
              <dd>${renderValue(value, label)}</dd>
            </div>
          `).join('')}
      </dl>
    `, title);
  }

  function confirmAction(options) {
    runtime.confirmation = options;
    openModal(`
      <span class="admin-eyebrow">Confirmation</span>
      <h2>${esc(options.title || 'Confirm action')}</h2>
      <p>${esc(options.message || 'This action will change the current record.')}</p>
      ${options.requireReason ? `
        <label class="admin-confirm-reason">
          <span>Reason</span>
          <textarea id="admin-confirm-reason" rows="3" required></textarea>
        </label>
      ` : ''}
      <div class="admin-editor-actions">
        <button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.closeModal()">Cancel</button>
        <button type="button" class="admin-primary-btn ${options.danger ? 'danger' : ''}"
                onclick="ASMRSAMRAdmin.runConfirmation()">${esc(options.confirmLabel || 'Confirm')}</button>
      </div>
    `, options.title || 'Confirm action');
  }

  async function runConfirmation() {
    const options = runtime.confirmation;
    if (!options || typeof options.action !== 'function') return;
    const reasonNode = document.getElementById('admin-confirm-reason');
    const reason = reasonNode ? reasonNode.value.trim() : '';
    if (options.requireReason && !reason) {
      announce('Enter a reason before continuing.', 'error');
      return;
    }
    try {
      setBusy(true);
      const result = await options.action(reason);
      closeModal();
      announce(options.success || 'Operation completed.');
      if (typeof options.after === 'function') await options.after(result);
      else await reloadCurrentPage();
    } catch (error) {
      announce(errorMessage(error), 'error');
    } finally {
      setBusy(false);
      runtime.confirmation = null;
    }
  }

  async function reloadCurrentPage() {
    const root = document.getElementById('admin-live-root');
    if (!root) return;
    root.innerHTML = loadingState();
    await dispatchPage(runtime.tab, runtime.section, root, runtime.mountId);
  }

  function queryState(key) {
    if (!runtime.queries[key]) {
      runtime.queries[key] = {
        page: 1,
        pageSize: PAGE_SIZE,
        search: '',
        filter: '',
        sort: '',
        direction: 'desc'
      };
    }
    return runtime.queries[key];
  }

  function renderCrudToolbar(config) {
    const query = queryState(config.key);
    const filter = (config.filters || [])[0];
    return `
      <div class="admin-crud-toolbar">
        <label class="admin-search-field">
          <span class="sr-only">Search ${esc(config.title)}</span>
          <input type="search" value="${attr(query.search)}" placeholder="Search"
                 oninput="ASMRSAMRAdmin.queueSearch('${attr(config.key)}', this.value)">
        </label>
        ${filter ? `
          <label class="admin-filter-field">
            <span>${esc(filter.label)}</span>
            <select onchange="ASMRSAMRAdmin.setFilter('${attr(config.key)}', this.value)">
              <option value="">All</option>
              ${filter.options.map(([value, label]) => `
                <option value="${attr(value)}"
                        ${query.filter === `${filter.key}:${value}` ? 'selected' : ''}>${esc(label)}</option>
              `).join('')}
            </select>
          </label>
        ` : ''}
        <label class="admin-filter-field">
          <span>Sort</span>
          <select onchange="ASMRSAMRAdmin.setSort('${attr(config.key)}', this.value)">
            ${(config.sortOptions || config.columns)
              .filter((column) => column.sortable !== false)
              .map((column) => `
                <option value="${attr(column.key)}" ${query.sort === column.key ? 'selected' : ''}>${esc(column.label)}</option>
              `).join('')}
          </select>
        </label>
        <button type="button" class="admin-sort-button"
                onclick="ASMRSAMRAdmin.toggleSort('${attr(config.key)}')"
                aria-label="Reverse sort order">${query.direction === 'asc' ? 'Ascending' : 'Descending'}</button>
      </div>
    `;
  }

  function renderCrudShell(config, inner) {
    const writable = canWrite(config) && !config.readOnly;
    return `
      <article class="admin-panel admin-table-panel">
        <div class="admin-panel-heading admin-table-toolbar">
          <div>
            <span class="admin-eyebrow">${esc(config.eyebrow || 'Management')}</span>
            <h2>${esc(config.title)}</h2>
            <p>${esc(config.description || '')}</p>
          </div>
          <div class="admin-toolbar-actions">
            ${config.toolbarActions || ''}
            ${writable ? `
              <button type="button" class="admin-primary-btn"
                      onclick="ASMRSAMRAdmin.openGenericForm('${attr(config.key)}')">Add</button>
            ` : ''}
            <button type="button" class="admin-secondary-btn"
                    onclick="ASMRSAMRAdmin.exportConfig('${attr(config.key)}','csv')">CSV</button>
            <button type="button" class="admin-secondary-btn"
                    onclick="ASMRSAMRAdmin.exportConfig('${attr(config.key)}','xlsx')">XLSX</button>
          </div>
        </div>
        ${renderCrudToolbar(config)}
        <div id="admin-crud-results">${inner}</div>
      </article>
    `;
  }

  function buildListPath(config, query) {
    const params = new URLSearchParams();
    params.set('select', config.select || '*');
    const search = query.search.trim().replaceAll('*', '').replaceAll(',', ' ');
    if (search && config.searchFields && config.searchFields.length) {
      params.set('or', '(' + config.searchFields
        .map((field) => `${field}.ilike.*${search}*`)
        .join(',') + ')');
    }
    Object.entries(config.fixed || {}).forEach(([key, value]) => {
      params.set(key, `eq.${value}`);
    });
    if (query.filter) {
      const splitAt = query.filter.indexOf(':');
      const key = query.filter.slice(0, splitAt);
      const value = query.filter.slice(splitAt + 1);
      if (key && value) params.set(key, `eq.${value}`);
    }
    const sort = query.sort || config.defaultSort || config.columns[0].key;
    params.set('order', `${sort}.${query.direction || config.defaultDirection || 'desc'}`);
    return `${config.table}?${params.toString()}`;
  }

  async function renderGeneric(config, root) {
    runtime.configs[config.key] = config;
    if (!canRead(config)) {
      root.innerHTML = errorState(new Error('Your role does not have permission to view this module.'));
      return;
    }
    root.innerHTML = renderCrudShell(config, loadingState(`Loading ${config.title.toLowerCase()}`));
    await loadGeneric(config);
  }

  async function loadGeneric(config) {
    const query = queryState(config.key);
    if (!query.sort) query.sort = config.defaultSort || config.columns[0].key;
    if (!query.direction) query.direction = config.defaultDirection || 'desc';
    const start = (query.page - 1) * query.pageSize;
    const end = start + query.pageSize - 1;
    const resultNode = document.getElementById('admin-crud-results');
    if (!resultNode) return;

    const previous = runtime.aborters.get(config.key);
    if (previous) previous.abort();
    const controller = new AbortController();
    runtime.aborters.set(config.key, controller);
    try {
      const result = await db(buildListPath(config, query), {
        headers: {
          Prefer: 'count=exact',
          Range: `${start}-${end}`,
          'Range-Unit': 'items'
        },
        signal: controller.signal
      });
      runtime.rows[config.key] = result.data || [];
      runtime.totals[config.key] = result.count == null ? runtime.rows[config.key].length : result.count;
      if (document.getElementById('admin-crud-results')) {
        resultNode.innerHTML = renderGenericResults(config, runtime.rows[config.key], runtime.totals[config.key]);
      }
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      resultNode.innerHTML = errorState(error, `ASMRSAMRAdmin.loadGenericByKey('${config.key}')`);
    } finally {
      if (runtime.aborters.get(config.key) === controller) runtime.aborters.delete(config.key);
    }
  }

  function renderGenericResults(config, rows, total) {
    if (!rows.length) {
      const action = canWrite(config) && !config.readOnly
        ? `<button type="button" class="admin-primary-btn"
                       onclick="ASMRSAMRAdmin.openGenericForm('${attr(config.key)}')">Add first record</button>`
        : '';
      return emptyState('No records found', 'Try another filter, or add the first authorized record.', action);
    }
    const query = queryState(config.key);
    const pages = Math.max(1, Math.ceil(total / query.pageSize));
    return `
      <div class="admin-data-table-wrap">
        <table class="admin-data-table">
          <thead>
            <tr>
              ${config.columns.map((column) => `<th scope="col">${esc(column.label)}</th>`).join('')}
              <th scope="col"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, index) => renderGenericRow(config, row, index)).join('')}
          </tbody>
        </table>
      </div>
      <div class="admin-pagination">
        <span>${formatNumber(total, 0)} records · Page ${query.page} of ${pages}</span>
        <div>
          <button type="button" class="admin-secondary-btn"
                  onclick="ASMRSAMRAdmin.setPage('${attr(config.key)}', ${query.page - 1})"
                  ${query.page <= 1 ? 'disabled' : ''}>Previous</button>
          <button type="button" class="admin-secondary-btn"
                  onclick="ASMRSAMRAdmin.setPage('${attr(config.key)}', ${query.page + 1})"
                  ${query.page >= pages ? 'disabled' : ''}>Next</button>
        </div>
      </div>
    `;
  }

  function renderGenericRow(config, row, index) {
    const writable = canWrite(config) && !config.readOnly;
    const canEditRow = writable && (!config.canEdit || config.canEdit(row));
    const canDeleteRow = writable && config.deleteMode && (!config.canDelete || config.canDelete(row));
    const customActions = config.rowActions ? config.rowActions(row, index) : '';
    return `
      <tr>
        ${config.columns.map((column) => `
          <td data-label="${attr(column.label)}">${renderColumn(column, row)}</td>
        `).join('')}
        <td data-label="Actions">
          <div class="admin-row-menu">
            <button type="button" onclick="ASMRSAMRAdmin.viewGeneric('${attr(config.key)}', ${index})">View</button>
            ${canEditRow ? `
              <button type="button" onclick="ASMRSAMRAdmin.openGenericForm('${attr(config.key)}', ${index})">Edit</button>
            ` : ''}
            ${customActions}
            ${canDeleteRow ? `
              <button type="button" class="danger"
                      onclick="ASMRSAMRAdmin.deleteGeneric('${attr(config.key)}', ${index})">${config.deleteMode === 'archive' ? 'Archive' : 'Delete'}</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  function renderColumn(column, row) {
    if (typeof column.render === 'function') return column.render(row[column.key], row);
    const value = row[column.key];
    if (column.type === 'money') return esc(formatMoney(value, row.currency || 'SAR'));
    if (column.type === 'date') return esc(formatDate(value, true));
    if (column.type === 'datetime') return esc(formatDate(value));
    if (column.type === 'number') {
      return esc(formatNumber(value, column.decimals == null ? 2 : column.decimals));
    }
    if (column.type === 'boolean') {
      return `<span class="admin-status-chip ${value ? 'confirmed' : ''}">${value ? 'Yes' : 'No'}</span>`;
    }
    if (column.type === 'status') {
      return `<span class="admin-status-chip ${esc(String(value || '').toLowerCase())}">${esc(titleCase(value || 'unknown'))}</span>`;
    }
    if (Array.isArray(value)) return esc(value.join(', '));
    if (value && typeof value === 'object') return esc(clampText(JSON.stringify(value), column.length || 48));
    return esc(clampText(value, column.length || 72)) || '<span class="admin-null">Not set</span>';
  }

  async function resolveFieldOptions(fields) {
    const resolved = fields.map((field) => ({ ...field }));
    await Promise.all(resolved.map(async (field) => {
      if (!field.lookup) return;
      const lookup = field.lookup;
      const params = new URLSearchParams();
      params.set('select', `${lookup.value},${lookup.label}`);
      Object.entries(lookup.filter || {}).forEach(([key, value]) => {
        params.set(key, `eq.${value}`);
      });
      params.set('order', `${lookup.label}.asc`);
      try {
        const result = await db(`${lookup.table}?${params.toString()}`);
        field.options = (result.data || []).map((row) => [row[lookup.value], row[lookup.label]]);
      } catch (_) {
        field.options = [];
      }
    }));
    return resolved;
  }

  function fieldInput(field, value) {
    const id = `admin-field-${field.key}`;
    const common = `id="${id}" name="${attr(field.key)}" ${field.required ? 'required' : ''} ${field.disabled ? 'disabled' : ''}`;
    if (field.type === 'textarea' || field.type === 'json') {
      const display = field.type === 'json' && value && typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : (value || '');
      return `<textarea ${common} rows="${field.rows || 4}"
                 ${field.maxlength ? `maxlength="${field.maxlength}"` : ''}>${esc(display)}</textarea>`;
    }
    if (field.type === 'select') {
      return `<select ${common}>
        ${field.required ? '<option value="">Select</option>' : '<option value="">Not set</option>'}
        ${(field.options || []).map(([optionValue, label]) => `
          <option value="${attr(optionValue)}"
                  ${String(value == null ? '' : value) === String(optionValue) ? 'selected' : ''}>${esc(label)}</option>
        `).join('')}
      </select>`;
    }
    if (field.type === 'boolean') {
      return `<input type="checkbox" ${common} value="true" ${value ? 'checked' : ''}>`;
    }
    const type = ['number', 'date', 'datetime-local', 'email', 'url', 'tel'].includes(field.type)
      ? field.type
      : 'text';
    let displayValue = value == null ? '' : value;
    if (type === 'datetime-local' && displayValue) {
      displayValue = new Date(displayValue).toISOString().slice(0, 16);
    }
    return `<input type="${type}" ${common} value="${attr(displayValue)}"
      ${field.step ? `step="${attr(field.step)}"` : ''}
      ${field.min !== undefined ? `min="${attr(field.min)}"` : ''}
      ${field.max !== undefined ? `max="${attr(field.max)}"` : ''}
      ${field.maxlength ? `maxlength="${field.maxlength}"` : ''}>`;
  }

  async function openGenericForm(key, rowIndex) {
    const config = runtime.configs[key];
    if (!config || !canWrite(config) || config.readOnly) return;
    const existing = Number.isInteger(rowIndex) ? runtime.rows[key][rowIndex] : null;
    const fields = await resolveFieldOptions(config.fields || []);
    fields.forEach((field) => {
      if (existing && field.immutable) field.disabled = true;
    });
    runtime.activeForm = { config, existing, fields };
    openModal(`
      <span class="admin-eyebrow">${existing ? 'Update record' : 'New record'}</span>
      <h2>${esc(existing ? `Edit ${config.singular || config.title}` : `Add ${config.singular || config.title}`)}</h2>
      <form id="admin-generic-form" class="admin-product-editor-form"
            onsubmit="ASMRSAMRAdmin.saveGeneric(event)" novalidate>
        <div class="admin-editor-grid">
          ${fields.filter((field) => !field.hidden).map((field) => `
            <label class="${field.wide ? 'admin-editor-wide' : ''}">
              <span>${esc(field.label)}${field.required ? ' *' : ''}</span>
              ${fieldInput(field, existing ? existing[field.key] : (field.default !== undefined ? field.default : ''))}
              ${field.help ? `<small>${esc(field.help)}</small>` : ''}
              <em class="admin-field-error" data-error-for="${attr(field.key)}"></em>
            </label>
          `).join('')}
        </div>
        <p class="admin-form-error" id="admin-form-error" hidden></p>
        <div class="admin-editor-actions">
          <button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.closeModal()">Cancel</button>
          <button type="submit" class="admin-primary-btn">${existing ? 'Save changes' : 'Create'}</button>
        </div>
      </form>
    `, existing ? `Edit ${config.title}` : `Add ${config.title}`);
  }

  function parseField(field, form) {
    const element = form.elements[field.key];
    if (!element) return undefined;
    if (field.type === 'boolean') return Boolean(element.checked);
    const raw = String(element.value || '').trim();
    if (!raw) {
      if (field.type === 'array') return [];
      return field.nullable ? null : '';
    }
    if (field.type === 'number') {
      const number = Number(raw);
      return Number.isFinite(number) ? number : NaN;
    }
    if (field.type === 'json') {
      try {
        return JSON.parse(raw);
      } catch (_) {
        return Symbol.for('invalid-json');
      }
    }
    if (field.type === 'array') return raw.split(',').map((item) => item.trim()).filter(Boolean);
    if (field.type === 'datetime-local') return new Date(raw).toISOString();
    return raw;
  }

  async function saveGeneric(event) {
    event.preventDefault();
    const active = runtime.activeForm;
    if (!active) return;
    const form = event.currentTarget;
    const payload = {};
    let valid = true;
    active.fields.forEach((field) => {
      const value = parseField(field, form);
      const errorNode = form.querySelector(`[data-error-for="${CSS.escape(field.key)}"]`);
      let message = '';
      if (field.required && (value === '' || value === null || (Array.isArray(value) && !value.length))) {
        message = 'Required';
      } else if (typeof value === 'number' && Number.isNaN(value)) {
        message = 'Enter a valid number';
      } else if (value === Symbol.for('invalid-json')) {
        message = 'Enter valid JSON';
      } else if (field.validate) {
        message = field.validate(value, payload) || '';
      }
      if (errorNode) errorNode.textContent = message;
      if (message) valid = false;
      else if (value !== undefined && !field.disabled) payload[field.key] = value;
    });
    if (!valid) return;

    const config = active.config;
    const formError = document.getElementById('admin-form-error');
    try {
      setBusy(true);
      Object.assign(payload, config.fixedPayload || {});
      if (config.beforeSave) await config.beforeSave(payload, active.existing);
      if (!active.existing && config.createdBy) payload[config.createdBy] = runtime.profile.id;
      if (config.updatedBy) payload[config.updatedBy] = runtime.profile.id;
      if (active.existing) {
        await db(`${config.table}?${recordFilter(config, active.existing)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: payload
        });
      } else {
        await db(config.table, {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: payload
        });
      }
      closeModal();
      announce(active.existing ? 'Changes saved.' : 'Record created.');
      if (document.getElementById('admin-crud-results')) await loadGeneric(config);
      else await reloadCurrentPage();
    } catch (error) {
      if (formError) {
        formError.hidden = false;
        formError.textContent = errorMessage(error);
      }
    } finally {
      setBusy(false);
    }
  }

  function recordFilter(config, row) {
    const keys = config.idFields || [config.idKey || 'id'];
    return keys.map((key) =>
      `${encodeURIComponent(key)}=eq.${encodeURIComponent(row[key])}`
    ).join('&');
  }

  function viewGeneric(key, rowIndex) {
    const config = runtime.configs[key];
    const row = runtime.rows[key] && runtime.rows[key][rowIndex];
    if (!config || !row) return;
    const labels = Object.fromEntries((config.fields || []).map((field) => [field.key, field.label]));
    const pairs = Object.entries(row)
      .filter(([field]) => !SENSITIVE_FIELDS.has(field.toLowerCase()))
      .map(([field, value]) => [labels[field] || field, value]);
    openRecordModal(config.singular || config.title, pairs);
  }

  function deleteGeneric(key, rowIndex) {
    const config = runtime.configs[key];
    const row = runtime.rows[key] && runtime.rows[key][rowIndex];
    if (!config || !row || !canWrite(config)) return;
    const archive = config.deleteMode === 'archive';
    confirmAction({
      title: archive
        ? `Archive ${config.singular || 'record'}`
        : `Delete ${config.singular || 'record'}`,
      message: archive
        ? 'The record will leave active views but remain available for history and audit.'
        : 'This record will be permanently removed when relationships and permissions allow it.',
      confirmLabel: archive ? 'Archive' : 'Delete',
      danger: true,
      action: async () => {
        const filter = recordFilter(config, row);
        if (archive) {
          const payload = { [config.archiveField || 'archived_at']: new Date().toISOString() };
          if (config.archiveStatus) payload[config.archiveStatus.field] = config.archiveStatus.value;
          await db(`${config.table}?${filter}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: payload
          });
        } else {
          await db(`${config.table}?${filter}`, {
            method: 'DELETE',
            headers: { Prefer: 'return=minimal' }
          });
        }
      },
      success: archive ? 'Record archived.' : 'Record deleted.'
    });
  }

  function queueSearch(key, value) {
    window.clearTimeout(runtime.searchTimer);
    runtime.searchTimer = window.setTimeout(() => {
      const query = queryState(key);
      query.search = value;
      query.page = 1;
      loadGenericByKey(key);
    }, 280);
  }

  function setFilter(key, value) {
    const config = runtime.configs[key];
    const filter = config && (config.filters || [])[0];
    const query = queryState(key);
    query.filter = value && filter ? `${filter.key}:${value}` : '';
    query.page = 1;
    loadGenericByKey(key);
  }

  function setSort(key, value) {
    const query = queryState(key);
    query.sort = value;
    query.page = 1;
    loadGenericByKey(key);
  }

  function toggleSort(key) {
    const query = queryState(key);
    query.direction = query.direction === 'asc' ? 'desc' : 'asc';
    loadGenericByKey(key);
  }

  function setPage(key, page) {
    if (page < 1) return;
    queryState(key).page = page;
    loadGenericByKey(key);
  }

  function loadGenericByKey(key) {
    const config = runtime.configs[key];
    if (config) loadGeneric(config);
  }

  function choices(values) {
    return values.map((value) => [value, titleCase(value)]);
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ''), window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  const ROLE_OPTIONS = choices(['customer', 'admin', 'manager', 'finance', 'marketing', 'inventory', 'production', 'support']);
  const USER_STATUS_OPTIONS = choices(['invited', 'active', 'inactive', 'suspended']);
  const PRODUCT_STATUS_OPTIONS = choices(['draft', 'published', 'unpublished', 'archived']);
  const PRODUCT_TYPE_OPTIONS = choices(['extrait', 'edp', 'edt', 'spray', 'mist', 'cream', 'wash', 'set', 'sets', 'sample', 'gift_card']);

  const CONFIGS = {
    orders: {
      key: 'orders',
      table: 'orders',
      title: 'Orders',
      singular: 'Order',
      description: 'Commerce orders with status, customer, channel, totals, and timestamps.',
      permission: 'orders',
      searchFields: ['order_no', 'customer_name', 'customer_phone'],
      defaultSort: 'created_at',
      columns: [
        { key: 'order_no', label: 'Order' },
        { key: 'customer_name', label: 'Customer' },
        { key: 'total', label: 'Total', type: 'money' },
        { key: 'status', label: 'Status', type: 'status' },
        { key: 'created_at', label: 'Created', type: 'datetime' }
      ],
      filters: [{
        key: 'status',
        label: 'Status',
        options: choices(['awaiting_confirmation', 'confirmed', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled'])
      }],
      fields: [
        { key: 'order_no', label: 'Order number', required: true, immutable: true, maxlength: 80 },
        { key: 'customer_id', label: 'Customer', nullable: true, lookup: { table: 'profiles', value: 'id', label: 'email', filter: { role: 'customer' } } },
        { key: 'customer_name', label: 'Customer name', nullable: true, maxlength: 160 },
        { key: 'customer_phone', label: 'Customer phone', type: 'tel', nullable: true, maxlength: 40 },
        { key: 'type', label: 'Order type', type: 'select', options: choices(['cart', 'buy_now', 'whatsapp', 'admin']), default: 'admin' },
        { key: 'channel', label: 'Channel', type: 'select', options: choices(['web', 'whatsapp', 'admin', 'phone', 'retail']), required: true, default: 'admin' },
        { key: 'status', label: 'Status', type: 'select', options: choices(['awaiting_confirmation', 'confirmed', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled']), required: true, default: 'awaiting_confirmation' },
        { key: 'subtotal', label: 'Subtotal', type: 'number', step: '0.01', min: 0, default: 0 },
        { key: 'vat', label: 'VAT', type: 'number', step: '0.01', min: 0, default: 0 },
        { key: 'total', label: 'Total', type: 'number', step: '0.01', min: 0, required: true },
        { key: 'currency', label: 'Currency', required: true, default: 'SAR', maxlength: 3 },
        { key: 'coupon_code', label: 'Coupon code', nullable: true },
        { key: 'note', label: 'Notes', type: 'textarea', wide: true, nullable: true, maxlength: 3000 }
      ],
      beforeSave: (payload) => {
        const subtotal = Number(payload.subtotal) || 0;
        const vat = Number(payload.vat) || 0;
        if (Math.abs((Number(payload.total) || 0) - subtotal - vat) > 0.01) {
          throw new Error('Order total must equal subtotal plus VAT.');
        }
      },
      rowActions: (_row, index) => `<button type="button" onclick="ASMRSAMRAdmin.openOrderItems(${index})">Items</button>`
    },
    products: {
      key: 'products',
      table: 'products',
      title: 'Products',
      singular: 'Product',
      description: 'Catalog identity, commerce fields, publishing, variants, and product media.',
      permission: 'products',
      select: '*,product_prices(size,price),product_images(id,public_url,fallback_url,storage_bucket,storage_path,alt_text,title,mime_type,file_size,is_primary,sort_order)',
      searchFields: ['id', 'name_en', 'brand', 'sku', 'barcode'],
      defaultSort: 'sort_order',
      defaultDirection: 'asc',
      columns: [
        {
          key: 'product_images',
          label: 'Image',
          sortable: false,
          render: (value, row) => {
            const images = Array.isArray(value) ? value : [];
            const primary = images.find((image) => image.is_primary) || images[0];
            const source = safeUrl(primary && (primary.public_url || primary.fallback_url)) ||
              safeUrl(row.image_webp || row.image_png);
            return source
              ? `<img class="admin-list-thumb" src="${attr(source)}" alt="${attr((primary && primary.alt_text) || row.name_en || 'Product')}">`
              : '<span class="admin-image-placeholder">No image</span>';
          }
        },
        { key: 'name_en', label: 'Product' },
        { key: 'brand', label: 'Identity' },
        { key: 'type', label: 'Type', type: 'status' },
        { key: 'status', label: 'Status', type: 'status' },
        { key: 'availability', label: 'Availability', type: 'status' }
      ],
      filters: [{ key: 'status', label: 'Status', options: PRODUCT_STATUS_OPTIONS }],
      fields: [
        { key: 'id', label: 'Product ID / slug', required: true, immutable: true, maxlength: 100, help: 'Lowercase identifier used in product URLs.' },
        { key: 'name_en', label: 'English name', required: true, maxlength: 180 },
        { key: 'name_ar', label: 'Arabic name', nullable: true, maxlength: 180 },
        { key: 'brand', label: 'Brand identity', type: 'select', options: [['ASMR', 'ASMR'], ['SAMR', 'SAMR'], ['ASMR & SAMR', 'ASMR & SAMR']], required: true },
        { key: 'type', label: 'Product type', type: 'select', options: PRODUCT_TYPE_OPTIONS, required: true },
        { key: 'category_id', label: 'Category', nullable: true, lookup: { table: 'product_categories', value: 'id', label: 'name_en', filter: { is_active: true } } },
        { key: 'gender_identity', label: 'Collection identity', type: 'select', options: choices(['for_her', 'for_him', 'unisex', 'duo']), required: true, default: 'unisex' },
        { key: 'concentration', label: 'Concentration', nullable: true, maxlength: 80 },
        { key: 'hero_size', label: 'Primary size', nullable: true, maxlength: 60 },
        { key: 'sku', label: 'SKU', nullable: true, maxlength: 80 },
        { key: 'barcode', label: 'Barcode', nullable: true, maxlength: 100 },
        { key: 'cost', label: 'Base cost', type: 'number', step: '0.01', min: 0, default: 0 },
        { key: 'tax_rate', label: 'Tax rate', type: 'number', step: '0.0001', min: 0, default: 0.15 },
        { key: 'discount_type', label: 'Discount type', type: 'select', options: choices(['percent', 'fixed']), nullable: true },
        { key: 'discount_value', label: 'Discount value', type: 'number', step: '0.01', min: 0, default: 0 },
        { key: 'availability', label: 'Availability', type: 'select', options: choices(['in_stock', 'low_stock', 'out_of_stock', 'preorder', 'discontinued']), required: true, default: 'in_stock' },
        { key: 'status', label: 'Product status', type: 'select', options: PRODUCT_STATUS_OPTIONS, required: true, default: 'draft' },
        { key: 'is_active', label: 'Visible to customers', type: 'boolean', default: false },
        { key: 'featured_on_home', label: 'Featured on home', type: 'boolean', default: false },
        { key: 'sort_order', label: 'Sort order', type: 'number', step: 1, min: 0, default: 0 },
        { key: 'family_en', label: 'English scent family', nullable: true, maxlength: 200 },
        { key: 'family_ar', label: 'Arabic scent family', nullable: true, maxlength: 200 },
        { key: 'desc_en', label: 'English description', type: 'textarea', wide: true, nullable: true, maxlength: 5000 },
        { key: 'desc_ar', label: 'Arabic description', type: 'textarea', wide: true, nullable: true, maxlength: 5000 },
        { key: 'scent_profile', label: 'Scent profile', type: 'textarea', wide: true, nullable: true, maxlength: 3000 },
        { key: 'ingredients_summary', label: 'Notes / ingredients summary', type: 'textarea', wide: true, nullable: true, maxlength: 3000 },
        { key: 'who_it_is_for', label: 'Who it is for', type: 'textarea', wide: true, nullable: true, maxlength: 3000 },
        { key: 'how_to_wear', label: 'How to wear', type: 'textarea', wide: true, nullable: true, maxlength: 3000 },
        { key: 'longevity', label: 'Longevity / concentration guidance', type: 'textarea', wide: true, nullable: true, maxlength: 1500 },
        { key: 'gift_ready_message', label: 'Gift-ready message', type: 'textarea', wide: true, nullable: true, maxlength: 3000 },
        { key: 'notes', label: 'Internal notes', type: 'textarea', wide: true, nullable: true, maxlength: 3000 },
        { key: 'seo_title', label: 'SEO title', nullable: true, maxlength: 180 },
        { key: 'seo_description', label: 'SEO description', type: 'textarea', wide: true, nullable: true, maxlength: 500 }
      ],
      createdBy: 'created_by',
      updatedBy: 'updated_by',
      deleteMode: 'archive',
      archiveStatus: { field: 'status', value: 'archived' },
      rowActions: (row, index) => `
        <button type="button" onclick="ASMRSAMRAdmin.openImages(${index})">Images</button>
        <button type="button" onclick="ASMRSAMRAdmin.openVariants(${index})">Variants</button>
        <button type="button" onclick="ASMRSAMRAdmin.openProductProfile(${index})">Notes &amp; pairing</button>
        <button type="button" onclick="ASMRSAMRAdmin.duplicateProduct(${index})">Duplicate</button>
        <button type="button" onclick="ASMRSAMRAdmin.toggleProductPublish(${index})">${row.status === 'published' ? 'Unpublish' : 'Publish'}</button>
      `
    },
    customers: {
      key: 'customers',
      table: 'profiles',
      title: 'Customers',
      singular: 'Customer',
      description: 'Customer status, membership, rewards, contact details, consent, and activity.',
      permission: 'customers',
      searchFields: ['full_name', 'email', 'phone'],
      fixed: { role: 'customer' },
      defaultSort: 'created_at',
      columns: [
        { key: 'full_name', label: 'Customer' },
        { key: 'email', label: 'Email' },
        { key: 'membership_tier', label: 'Tier', type: 'status' },
        { key: 'points', label: 'Points', type: 'number', decimals: 0 },
        { key: 'status', label: 'Status', type: 'status' },
        { key: 'created_at', label: 'Joined', type: 'date' }
      ],
      filters: [{ key: 'status', label: 'Status', options: USER_STATUS_OPTIONS }],
      fields: [],
      readOnly: true,
      rowActions: (row, index) => `
        <button type="button" onclick="ASMRSAMRAdmin.openUserEditor('customers', ${index})">Manage</button>
        <button type="button" onclick="ASMRSAMRAdmin.openRewardAdjustment('customers', ${index})">Points</button>
      `
    },
    wishlist: {
      key: 'wishlist',
      table: 'wishlist_items',
      title: 'Wishlist',
      singular: 'Wishlist item',
      description: 'Saved products by customer, used as a demand and campaign signal.',
      permission: 'customers',
      searchFields: ['product_id'],
      defaultSort: 'created_at',
      columns: [
        { key: 'user_id', label: 'Customer ID' },
        { key: 'product_id', label: 'Product' },
        { key: 'created_at', label: 'Saved', type: 'datetime' }
      ],
      fields: [
        { key: 'user_id', label: 'Customer', required: true, lookup: { table: 'profiles', value: 'id', label: 'email', filter: { role: 'customer' } } },
        { key: 'product_id', label: 'Product', required: true, lookup: { table: 'products', value: 'id', label: 'name_en' } }
      ],
      idFields: ['user_id', 'product_id'],
      deleteMode: 'hard'
    },
    rewards: {
      key: 'rewards',
      table: 'reward_adjustments',
      title: 'Reward Adjustments',
      singular: 'Reward adjustment',
      description: 'Immutable point adjustments with reason, actor, and timestamp.',
      permission: 'customers',
      searchFields: ['reason'],
      defaultSort: 'created_at',
      columns: [
        { key: 'user_id', label: 'Customer ID' },
        { key: 'points_delta', label: 'Points', type: 'number', decimals: 0 },
        { key: 'reason', label: 'Reason' },
        { key: 'created_by', label: 'Adjusted by' },
        { key: 'created_at', label: 'Created', type: 'datetime' }
      ],
      fields: [],
      readOnly: true
    },
    preorders: {
      key: 'preorders',
      table: 'preorders',
      title: 'Pre-orders',
      singular: 'Pre-order',
      description: 'Reservations, deposits, expiry, readiness, and order conversion.',
      permission: 'orders',
      searchFields: ['reservation_number', 'customer_name', 'customer_email', 'customer_phone', 'product_id'],
      defaultSort: 'created_at',
      columns: [
        { key: 'reservation_number', label: 'Reservation' },
        { key: 'customer_name', label: 'Customer' },
        { key: 'product_id', label: 'Product' },
        { key: 'quantity', label: 'Qty', type: 'number', decimals: 0 },
        { key: 'unit_price', label: 'Unit price', type: 'money' },
        { key: 'status', label: 'Status', type: 'status' },
        { key: 'created_at', label: 'Created', type: 'datetime' }
      ],
      filters: [{ key: 'status', label: 'Status', options: choices(['requested', 'confirmed', 'deposit_paid', 'ready', 'converted', 'cancelled', 'expired']) }],
      fields: [
        { key: 'reservation_number', label: 'Reservation number', required: true, immutable: true, maxlength: 80 },
        { key: 'customer_id', label: 'Customer', nullable: true, lookup: { table: 'profiles', value: 'id', label: 'email', filter: { role: 'customer' } } },
        { key: 'product_id', label: 'Product', required: true, lookup: { table: 'products', value: 'id', label: 'name_en' } },
        { key: 'variant_id', label: 'Variant ID', nullable: true },
        { key: 'quantity', label: 'Quantity', type: 'number', min: 1, step: 1, required: true, default: 1 },
        { key: 'unit_price', label: 'Unit price', type: 'number', min: 0, step: '0.01', required: true },
        { key: 'deposit_amount', label: 'Deposit', type: 'number', min: 0, step: '0.01', default: 0 },
        { key: 'currency', label: 'Currency', required: true, default: 'SAR', maxlength: 3 },
        { key: 'status', label: 'Status', type: 'select', options: choices(['requested', 'confirmed', 'deposit_paid', 'ready', 'converted', 'cancelled', 'expired']), required: true, default: 'requested' },
        { key: 'source', label: 'Source', required: true, default: 'admin', maxlength: 40 },
        { key: 'customer_name', label: 'Customer name', nullable: true, maxlength: 160 },
        { key: 'customer_email', label: 'Customer email', type: 'email', nullable: true, maxlength: 254 },
        { key: 'customer_phone', label: 'Customer phone', type: 'tel', nullable: true, maxlength: 40 },
        { key: 'expires_at', label: 'Expires', type: 'datetime-local', nullable: true },
        { key: 'notes', label: 'Notes', type: 'textarea', wide: true, nullable: true, maxlength: 3000 }
      ],
      createdBy: 'created_by',
      updatedBy: 'updated_by',
      deleteMode: 'archive'
    },
    coupons: {
      key: 'coupons',
      table: 'coupons',
      title: 'Coupons',
      singular: 'Coupon',
      description: 'Promotion codes, value rules, minimum totals, status, and expiry.',
      permission: 'marketing',
      searchFields: ['code'],
      defaultSort: 'created_at',
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'kind', label: 'Type', type: 'status' },
        { key: 'value', label: 'Value', type: 'number' },
        { key: 'min_total', label: 'Minimum', type: 'money' },
        { key: 'is_active', label: 'Active', type: 'boolean' },
        { key: 'expires_at', label: 'Expires', type: 'datetime' }
      ],
      filters: [{ key: 'is_active', label: 'Status', options: [['true', 'Active'], ['false', 'Inactive']] }],
      fields: [
        { key: 'code', label: 'Code', required: true, immutable: true, maxlength: 60 },
        { key: 'kind', label: 'Type', type: 'select', options: choices(['percent', 'fixed']), required: true, default: 'percent' },
        { key: 'value', label: 'Value', type: 'number', min: 0, step: '0.01', required: true },
        { key: 'min_total', label: 'Minimum order', type: 'number', min: 0, step: '0.01', default: 0 },
        { key: 'is_active', label: 'Active', type: 'boolean', default: true },
        { key: 'expires_at', label: 'Expires', type: 'datetime-local', nullable: true }
      ],
      deleteMode: 'hard'
    },
    content: {
      key: 'content',
      table: 'website_content',
      title: 'Website Content',
      singular: 'Content item',
      description: 'Homepage sections, journal, FAQs, policies, pages, SEO, and notices.',
      permission: 'content',
      searchFields: ['slug', 'title_en', 'title_ar', 'body_en'],
      defaultSort: 'updated_at',
      columns: [
        { key: 'title_en', label: 'Title' },
        { key: 'content_type', label: 'Type', type: 'status' },
        { key: 'slug', label: 'Slug' },
        { key: 'status', label: 'Status', type: 'status' },
        { key: 'updated_at', label: 'Updated', type: 'datetime' }
      ],
      filters: [{ key: 'content_type', label: 'Type', options: choices(['homepage_banner', 'website_section', 'journal', 'faq', 'policy', 'seo', 'notification', 'page']) }],
      fields: [
        { key: 'content_type', label: 'Content type', type: 'select', options: choices(['homepage_banner', 'website_section', 'journal', 'faq', 'policy', 'seo', 'notification', 'page']), required: true },
        { key: 'slug', label: 'Slug', required: true, immutable: true, maxlength: 160 },
        { key: 'title_en', label: 'English title', nullable: true, maxlength: 240 },
        { key: 'title_ar', label: 'Arabic title', nullable: true, maxlength: 240 },
        { key: 'body_en', label: 'English content', type: 'textarea', wide: true, nullable: true, rows: 8 },
        { key: 'body_ar', label: 'Arabic content', type: 'textarea', wide: true, nullable: true, rows: 8 },
        { key: 'metadata', label: 'Metadata', type: 'json', wide: true, nullable: true, default: {} },
        { key: 'status', label: 'Status', type: 'select', options: choices(['draft', 'published', 'archived']), required: true, default: 'draft' },
        { key: 'sort_order', label: 'Sort order', type: 'number', min: 0, step: 1, default: 0 },
        { key: 'published_at', label: 'Publish date', type: 'datetime-local', nullable: true }
      ],
      createdBy: 'created_by',
      updatedBy: 'updated_by',
      deleteMode: 'archive',
      archiveStatus: { field: 'status', value: 'archived' }
    },
    campaigns: {
      key: 'campaigns',
      table: 'marketing_campaigns',
      title: 'Marketing Campaigns',
      singular: 'Campaign',
      description: 'Objectives, channels, audiences, schedules, spend, orders, conversion, and revenue.',
      permission: 'marketing',
      searchFields: ['name', 'objective', 'audience'],
      defaultSort: 'start_at',
      columns: [
        { key: 'name', label: 'Campaign' },
        { key: 'channel', label: 'Channel', type: 'status' },
        { key: 'status', label: 'Status', type: 'status' },
        { key: 'budget', label: 'Budget', type: 'money' },
        { key: 'actual_spend', label: 'Spend', type: 'money' },
        { key: 'revenue', label: 'Revenue', type: 'money' },
        { key: 'start_at', label: 'Starts', type: 'datetime' }
      ],
      filters: [{ key: 'status', label: 'Status', options: choices(['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled']) }],
      fields: [
        { key: 'name', label: 'Campaign name', required: true, maxlength: 180 },
        { key: 'objective', label: 'Objective', nullable: true, maxlength: 500 },
        { key: 'channel', label: 'Channel', type: 'select', options: choices(['email', 'sms', 'push', 'social', 'influencer', 'referral', 'loyalty', 'gift', 'wishlist', 'abandoned_cart', 'multi_channel']), required: true },
        { key: 'audience', label: 'Audience', nullable: true, maxlength: 500 },
        { key: 'segment_id', label: 'Segment', nullable: true, lookup: { table: 'marketing_segments', value: 'id', label: 'name' } },
        { key: 'start_at', label: 'Start date', type: 'datetime-local', nullable: true },
        { key: 'end_at', label: 'End date', type: 'datetime-local', nullable: true },
        { key: 'budget', label: 'Budget', type: 'number', min: 0, step: '0.01', default: 0 },
        { key: 'actual_spend', label: 'Actual spend', type: 'number', min: 0, step: '0.01', default: 0 },
        { key: 'status', label: 'Status', type: 'select', options: choices(['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled']), required: true, default: 'draft' },
        { key: 'discount_type', label: 'Discount type', type: 'select', options: choices(['percent', 'fixed']), nullable: true },
        { key: 'discount_value', label: 'Discount value', type: 'number', min: 0, step: '0.01', default: 0 },
        { key: 'coupon_code', label: 'Promo code', nullable: true, maxlength: 60 },
        { key: 'revenue', label: 'Revenue', type: 'number', min: 0, step: '0.01', default: 0 },
        { key: 'orders_count', label: 'Orders', type: 'number', min: 0, step: 1, default: 0 },
        { key: 'conversions', label: 'Conversions', type: 'number', min: 0, step: 1, default: 0 },
        { key: 'owner_id', label: 'Owner', nullable: true, lookup: { table: 'profiles', value: 'id', label: 'email' } },
        { key: 'notes', label: 'Notes', type: 'textarea', wide: true, nullable: true, maxlength: 3000 }
      ],
      createdBy: 'created_by',
      deleteMode: 'hard',
      canDelete: (row) => row.status === 'draft',
      rowActions: (row) => `<button type="button" onclick="ASMRSAMRAdmin.openCampaignProducts('${attr(row.id)}')">Products</button>`
    },
    notifications: {
      key: 'notifications',
      table: 'notifications',
      title: 'Notifications',
      singular: 'Notification',
      description: 'Targeted customer or staff messages with severity and read status.',
      permission: 'notifications',
      searchFields: ['title', 'body', 'type'],
      defaultSort: 'created_at',
      columns: [
        { key: 'title', label: 'Title' },
        { key: 'type', label: 'Type' },
        { key: 'severity', label: 'Severity', type: 'status' },
        { key: 'audience_role', label: 'Audience' },
        { key: 'is_read', label: 'Read', type: 'boolean' },
        { key: 'created_at', label: 'Created', type: 'datetime' }
      ],
      filters: [{ key: 'severity', label: 'Severity', options: choices(['info', 'success', 'warning', 'critical']) }],
      fields: [
        { key: 'user_id', label: 'User', nullable: true, lookup: { table: 'profiles', value: 'id', label: 'email' } },
        { key: 'audience_role', label: 'Audience role', type: 'select', options: ROLE_OPTIONS, nullable: true },
        { key: 'type', label: 'Type', required: true, maxlength: 80 },
        { key: 'title', label: 'Title', required: true, maxlength: 200 },
        { key: 'body', label: 'Message', type: 'textarea', wide: true, nullable: true, maxlength: 3000 },
        { key: 'severity', label: 'Severity', type: 'select', options: choices(['info', 'success', 'warning', 'critical']), required: true, default: 'info' },
        { key: 'metadata', label: 'Metadata', type: 'json', wide: true, nullable: true, default: {} }
      ],
      deleteMode: 'hard'
    },
    suppliers: {
      key: 'suppliers',
      table: 'suppliers',
      title: 'Suppliers',
      singular: 'Supplier',
      description: 'Supplier contacts, product references, terms, country, and status.',
      permission: 'ingredients',
      searchFields: ['name', 'code', 'contact_name', 'email', 'phone'],
      defaultSort: 'name',
      defaultDirection: 'asc',
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Supplier' },
        { key: 'contact_name', label: 'Contact' },
        { key: 'country', label: 'Country' },
        { key: 'status', label: 'Status', type: 'status' },
        { key: 'updated_at', label: 'Updated', type: 'datetime' }
      ],
      filters: [{ key: 'status', label: 'Status', options: choices(['active', 'inactive', 'blocked', 'archived']) }],
      fields: [
        { key: 'name', label: 'Supplier name', required: true, maxlength: 180 },
        { key: 'code', label: 'Supplier code', required: true, immutable: true, maxlength: 80 },
        { key: 'contact_name', label: 'Contact name', nullable: true, maxlength: 160 },
        { key: 'email', label: 'Email', type: 'email', nullable: true, maxlength: 254 },
        { key: 'phone', label: 'Phone', type: 'tel', nullable: true, maxlength: 40 },
        { key: 'country', label: 'Country', nullable: true, maxlength: 120 },
        { key: 'address', label: 'Address', type: 'textarea', wide: true, nullable: true, maxlength: 1000 },
        { key: 'payment_terms', label: 'Payment terms', nullable: true, maxlength: 300 },
        { key: 'status', label: 'Status', type: 'select', options: choices(['active', 'inactive', 'blocked', 'archived']), required: true, default: 'active' },
        { key: 'notes', label: 'Notes', type: 'textarea', wide: true, nullable: true, maxlength: 3000 }
      ],
      createdBy: 'created_by',
      updatedBy: 'updated_by',
      deleteMode: 'archive',
      archiveStatus: { field: 'status', value: 'archived' }
    },
    ingredients: {
      key: 'ingredients',
      table: 'ingredients',
      title: 'Ingredients',
      singular: 'Ingredient',
      description: 'Perfumery materials, supplier details, stock threshold, cost, safety, and technical references.',
      permission: 'ingredients',
      searchFields: ['name', 'internal_code', 'manufacturer', 'supplier_product_code', 'country_of_origin'],
      defaultSort: 'name',
      defaultDirection: 'asc',
      columns: [
        { key: 'internal_code', label: 'Code' },
        { key: 'name', label: 'Ingredient' },
        { key: 'category', label: 'Category', type: 'status' },
        { key: 'quantity_available', label: 'Available', type: 'number', decimals: 4 },
        { key: 'unit', label: 'Unit' },
        { key: 'unit_cost', label: 'Unit cost', type: 'money' },
        { key: 'status', label: 'Status', type: 'status' }
      ],
      filters: [{ key: 'category', label: 'Category', options: choices(['aroma_chemical', 'essential_oil', 'absolute', 'solvent', 'alcohol', 'carrier', 'preservative', 'packaging_material', 'other']) }],
      fields: [
        { key: 'name', label: 'Ingredient name', required: true, maxlength: 200 },
        { key: 'internal_code', label: 'Internal code', required: true, immutable: true, maxlength: 80 },
        { key: 'category', label: 'Category', type: 'select', options: choices(['aroma_chemical', 'essential_oil', 'absolute', 'solvent', 'alcohol', 'carrier', 'preservative', 'packaging_material', 'other']), required: true },
        { key: 'manufacturer', label: 'Manufacturer', nullable: true, maxlength: 180 },
        { key: 'supplier_id', label: 'Supplier', nullable: true, lookup: { table: 'suppliers', value: 'id', label: 'name', filter: { status: 'active' } } },
        { key: 'supplier_product_code', label: 'Supplier product code', nullable: true, maxlength: 120 },
        { key: 'country_of_origin', label: 'Country of origin', nullable: true, maxlength: 120 },
        { key: 'unit', label: 'Unit', required: true, default: 'g', maxlength: 20 },
        { key: 'minimum_stock', label: 'Minimum stock', type: 'number', min: 0, step: '0.0001', default: 0 },
        { key: 'reorder_quantity', label: 'Reorder quantity', type: 'number', min: 0, step: '0.0001', default: 0 },
        { key: 'unit_cost', label: 'Unit cost', type: 'number', min: 0, step: '0.000001', default: 0 },
        { key: 'storage_location', label: 'Storage location', nullable: true, maxlength: 180 },
        { key: 'safety_information', label: 'Safety information', type: 'textarea', wide: true, nullable: true, maxlength: 5000 },
        { key: 'ifra_reference', label: 'IFRA reference', nullable: true, maxlength: 300 },
        { key: 'technical_reference', label: 'Technical document reference', nullable: true, maxlength: 300 },
        { key: 'notes', label: 'Notes', type: 'textarea', wide: true, nullable: true, maxlength: 3000 },
        { key: 'status', label: 'Status', type: 'select', options: choices(['active', 'inactive', 'quarantined', 'archived']), required: true, default: 'active' }
      ],
      createdBy: 'created_by',
      updatedBy: 'updated_by',
      deleteMode: 'archive',
      archiveStatus: { field: 'status', value: 'archived' },
      rowActions: (_row, index) => `
        <button type="button" onclick="ASMRSAMRAdmin.openIngredientAdjustment(${index})">Stock</button>
        <button type="button" onclick="ASMRSAMRAdmin.openIngredientHistory(${index})">History</button>
      `
    },
    'purchase-orders': {
      key: 'purchase-orders',
      table: 'purchase_orders',
      title: 'Purchase Orders',
      singular: 'Purchase order',
      description: 'Supplier purchasing, expected dates, tax, shipping, totals, and receipt status.',
      permission: 'purchasing',
      searchFields: ['order_number', 'notes'],
      defaultSort: 'order_date',
      columns: [
        { key: 'order_number', label: 'PO number' },
        { key: 'supplier_id', label: 'Supplier ID' },
        { key: 'status', label: 'Status', type: 'status' },
        { key: 'order_date', label: 'Order date', type: 'date' },
        { key: 'expected_date', label: 'Expected', type: 'date' },
        { key: 'total', label: 'Total', type: 'money' }
      ],
      filters: [{ key: 'status', label: 'Status', options: choices(['draft', 'submitted', 'approved', 'partially_received', 'received', 'cancelled']) }],
      fields: [
        { key: 'order_number', label: 'PO number', required: true, immutable: true, maxlength: 80 },
        { key: 'supplier_id', label: 'Supplier', required: true, lookup: { table: 'suppliers', value: 'id', label: 'name', filter: { status: 'active' } } },
        { key: 'status', label: 'Status', type: 'select', options: choices(['draft', 'submitted', 'approved', 'partially_received', 'received', 'cancelled']), required: true, default: 'draft' },
        { key: 'order_date', label: 'Order date', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
        { key: 'expected_date', label: 'Expected date', type: 'date', nullable: true },
        { key: 'currency', label: 'Currency', required: true, default: 'SAR', maxlength: 3 },
        { key: 'subtotal', label: 'Subtotal', type: 'number', min: 0, step: '0.01', default: 0 },
        { key: 'tax', label: 'Tax', type: 'number', min: 0, step: '0.01', default: 0 },
        { key: 'shipping', label: 'Shipping', type: 'number', min: 0, step: '0.01', default: 0 },
        { key: 'total', label: 'Total', type: 'number', min: 0, step: '0.01', default: 0 },
        { key: 'notes', label: 'Notes', type: 'textarea', wide: true, nullable: true, maxlength: 3000 }
      ],
      createdBy: 'created_by',
      deleteMode: 'hard',
      canDelete: (row) => row.status === 'draft',
      rowActions: (_row, index) => `<button type="button" onclick="ASMRSAMRAdmin.openPurchaseItems(${index})">Items</button>`
    },
    formulas: {
      key: 'formulas',
      table: 'formulas',
      title: 'Fragrance Formulas',
      singular: 'Formula',
      description: 'Sensitive formula identities, products, approval state, and version history.',
      permission: 'production',
      searchFields: ['code', 'name', 'description'],
      defaultSort: 'updated_at',
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Formula' },
        { key: 'product_id', label: 'Product' },
        { key: 'status', label: 'Status', type: 'status' },
        { key: 'is_sensitive', label: 'Sensitive', type: 'boolean' },
        { key: 'updated_at', label: 'Updated', type: 'datetime' }
      ],
      filters: [{ key: 'status', label: 'Status', options: choices(['draft', 'trial', 'approved', 'retired', 'archived']) }],
      fields: [
        { key: 'code', label: 'Formula code', required: true, immutable: true, maxlength: 80 },
        { key: 'name', label: 'Formula name', required: true, maxlength: 180 },
        { key: 'product_id', label: 'Product', nullable: true, lookup: { table: 'products', value: 'id', label: 'name_en' } },
        { key: 'description', label: 'Description', type: 'textarea', wide: true, nullable: true, maxlength: 3000 },
        { key: 'status', label: 'Status', type: 'select', options: choices(['draft', 'trial', 'approved', 'retired', 'archived']), required: true, default: 'draft' },
        { key: 'is_sensitive', label: 'Sensitive business information', type: 'boolean', default: true }
      ],
      createdBy: 'created_by',
      updatedBy: 'updated_by',
      deleteMode: 'archive',
      archiveStatus: { field: 'status', value: 'archived' },
      rowActions: (_row, index) => `<button type="button" onclick="ASMRSAMRAdmin.openFormulaVersions(${index})">Versions</button>`
    },
    production: {
      key: 'production',
      table: 'production_batches',
      title: 'Production Batches',
      singular: 'Production batch',
      description: 'Batch planning, maceration, yield, wastage, cost, quality control, and confirmation.',
      permission: 'production',
      searchFields: ['batch_number', 'quality_control_notes'],
      defaultSort: 'created_at',
      columns: [
        { key: 'batch_number', label: 'Batch' },
        { key: 'product_id', label: 'Product' },
        { key: 'status', label: 'Status', type: 'status' },
        { key: 'batch_size', label: 'Batch size', type: 'number', decimals: 4 },
        { key: 'production_date', label: 'Production', type: 'date' },
        { key: 'total_cost', label: 'Cost', type: 'money' },
        { key: 'cost_per_bottle', label: 'Per bottle', type: 'money' }
      ],
      filters: [{ key: 'status', label: 'Status', options: choices(['planned', 'trial', 'confirmed', 'macerating', 'quality_control', 'released', 'completed', 'cancelled', 'corrected']) }],
      fields: [
        { key: 'batch_number', label: 'Batch number', required: true, immutable: true, maxlength: 100 },
        { key: 'formula_version_id', label: 'Formula version', required: true, lookup: { table: 'formula_versions', value: 'id', label: 'id' } },
        { key: 'product_id', label: 'Product', nullable: true, lookup: { table: 'products', value: 'id', label: 'name_en' } },
        { key: 'status', label: 'Status', type: 'select', options: choices(['planned', 'trial', 'macerating', 'quality_control', 'released', 'completed']), required: true, default: 'planned' },
        { key: 'batch_size', label: 'Batch size', type: 'number', min: 0.0001, step: '0.0001', required: true },
        { key: 'unit', label: 'Unit', required: true, default: 'g', maxlength: 20 },
        { key: 'planned_bottles', label: 'Planned bottles', type: 'number', min: 1, step: 1, nullable: true },
        { key: 'production_date', label: 'Production date', type: 'date', nullable: true },
        { key: 'maceration_start_date', label: 'Maceration starts', type: 'date', nullable: true },
        { key: 'maceration_end_date', label: 'Maceration ends', type: 'date', nullable: true },
        { key: 'actual_yield', label: 'Actual yield', type: 'number', min: 0, step: '0.0001', nullable: true },
        { key: 'wastage', label: 'Wastage', type: 'number', min: 0, step: '0.0001', default: 0 },
        { key: 'packaging_cost', label: 'Packaging cost', type: 'number', min: 0, step: '0.01', default: 0 },
        { key: 'labor_cost', label: 'Labor cost', type: 'number', min: 0, step: '0.01', default: 0 },
        { key: 'operational_cost', label: 'Operational cost', type: 'number', min: 0, step: '0.01', default: 0 },
        { key: 'quality_control_notes', label: 'Quality-control notes', type: 'textarea', wide: true, nullable: true, maxlength: 5000 }
      ],
      createdBy: 'created_by',
      updatedBy: 'updated_by',
      canEdit: (row) => ['planned', 'trial', 'macerating', 'quality_control', 'released'].includes(row.status),
      rowActions: (row, index) => `
        ${['planned', 'trial'].includes(row.status) ? `<button type="button" onclick="ASMRSAMRAdmin.confirmBatch(${index})">Confirm batch</button>` : ''}
        ${['confirmed', 'macerating', 'quality_control'].includes(row.status) ? `<button type="button" class="danger" onclick="ASMRSAMRAdmin.reverseBatch(${index})">Correct / cancel</button>` : ''}
        <button type="button" onclick="ASMRSAMRAdmin.openBatchConsumption(${index})">Consumption</button>
      `
    },
    costing: {
      key: 'costing',
      table: 'product_cost_components',
      title: 'Cost Components',
      singular: 'Cost component',
      description: 'Ingredients, packaging, bottle, cap, label, box, filling, labor, shipping, marketing, fees, and tax.',
      permission: 'costing',
      searchFields: ['product_id', 'name', 'component_type'],
      defaultSort: 'updated_at',
      columns: [
        { key: 'product_id', label: 'Product' },
        { key: 'component_type', label: 'Component', type: 'status' },
        { key: 'name', label: 'Name' },
        { key: 'amount', label: 'Amount', type: 'money' },
        { key: 'allocation_method', label: 'Allocation', type: 'status' },
        { key: 'effective_from', label: 'Effective', type: 'date' }
      ],
      filters: [{ key: 'component_type', label: 'Type', options: choices(['ingredient', 'packaging', 'bottle', 'cap', 'label', 'box', 'filling', 'labor', 'shipping', 'marketing', 'payment_fee', 'tax', 'other']) }],
      fields: [
        { key: 'product_id', label: 'Product', required: true, lookup: { table: 'products', value: 'id', label: 'name_en' } },
        { key: 'variant_id', label: 'Variant ID', nullable: true },
        { key: 'component_type', label: 'Component type', type: 'select', options: choices(['ingredient', 'packaging', 'bottle', 'cap', 'label', 'box', 'filling', 'labor', 'shipping', 'marketing', 'payment_fee', 'tax', 'other']), required: true },
        { key: 'name', label: 'Cost name', required: true, maxlength: 180 },
        { key: 'amount', label: 'Amount', type: 'number', min: 0, step: '0.0001', required: true },
        { key: 'allocation_method', label: 'Allocation', type: 'select', options: choices(['per_unit', 'per_batch', 'percent_revenue']), required: true, default: 'per_unit' },
        { key: 'effective_from', label: 'Effective from', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
        { key: 'effective_to', label: 'Effective to', type: 'date', nullable: true },
        { key: 'supplier_id', label: 'Supplier', nullable: true, lookup: { table: 'suppliers', value: 'id', label: 'name' } }
      ],
      createdBy: 'created_by',
      deleteMode: 'hard',
      rowActions: (row) => `<button type="button" onclick="ASMRSAMRAdmin.snapshotCost('${attr(row.product_id)}')">Snapshot</button>`
    },
    audit: {
      key: 'audit',
      table: 'audit_logs',
      title: 'Audit Log',
      singular: 'Audit event',
      description: 'Immutable record of sensitive creates, updates, archives, reversals, and security actions.',
      permission: 'reports',
      searchFields: ['action', 'entity_type', 'entity_id'],
      defaultSort: 'created_at',
      columns: [
        { key: 'action', label: 'Action', type: 'status' },
        { key: 'entity_type', label: 'Entity' },
        { key: 'entity_id', label: 'Record' },
        { key: 'actor_id', label: 'Actor' },
        { key: 'created_at', label: 'Created', type: 'datetime' }
      ],
      filters: [],
      fields: [],
      readOnly: true
    }
  };

  const PRODUCT_TABS = [
    ['catalog', 'Catalog'],
    ['categories', 'Categories'],
    ['collections', 'Collections'],
    ['fragrance-notes', 'Fragrance Notes']
  ];

  function productSectionConfig(section) {
    if (section === 'categories') {
      return {
        key: 'product-categories', table: 'product_categories', title: 'Product Categories', singular: 'Category',
        description: 'Catalog categories, bilingual labels, storefront order, and availability.', permission: 'products',
        searchFields: ['name_en', 'name_ar', 'slug', 'description'], defaultSort: 'sort_order', defaultDirection: 'asc',
        columns: [
          { key: 'name_en', label: 'Category' }, { key: 'slug', label: 'Slug' },
          { key: 'is_active', label: 'Active', type: 'boolean' }, { key: 'sort_order', label: 'Order', type: 'number', decimals: 0 },
          { key: 'updated_at', label: 'Updated', type: 'datetime' }
        ],
        filters: [{ key: 'is_active', label: 'Status', options: [['true', 'Active'], ['false', 'Inactive']] }],
        fields: [
          { key: 'name_en', label: 'English name', required: true, maxlength: 180 },
          { key: 'name_ar', label: 'Arabic name', nullable: true, maxlength: 180 },
          { key: 'slug', label: 'Slug', required: true, immutable: true, maxlength: 160 },
          { key: 'description', label: 'Description', type: 'textarea', wide: true, nullable: true, maxlength: 3000 },
          { key: 'is_active', label: 'Active', type: 'boolean', default: true },
          { key: 'sort_order', label: 'Sort order', type: 'number', min: 0, step: 1, default: 0 }
        ],
        deleteMode: 'archive', archiveStatus: { field: 'is_active', value: false }
      };
    }
    if (section === 'collections') {
      return {
        key: 'product-collections', table: 'product_collections', title: 'Collections', singular: 'Collection',
        description: 'Curated product groupings with bilingual names and scheduled availability.', permission: 'products',
        searchFields: ['name_en', 'name_ar', 'slug', 'description'], defaultSort: 'created_at',
        columns: [
          { key: 'name_en', label: 'Collection' }, { key: 'slug', label: 'Slug' },
          { key: 'is_active', label: 'Active', type: 'boolean' }, { key: 'starts_at', label: 'Starts', type: 'datetime' },
          { key: 'ends_at', label: 'Ends', type: 'datetime' }
        ],
        filters: [{ key: 'is_active', label: 'Status', options: [['true', 'Active'], ['false', 'Inactive']] }],
        fields: [
          { key: 'name_en', label: 'English name', required: true, maxlength: 180 },
          { key: 'name_ar', label: 'Arabic name', nullable: true, maxlength: 180 },
          { key: 'slug', label: 'Slug', required: true, immutable: true, maxlength: 160 },
          { key: 'description', label: 'Description', type: 'textarea', wide: true, nullable: true, maxlength: 3000 },
          { key: 'is_active', label: 'Active', type: 'boolean', default: true },
          { key: 'starts_at', label: 'Starts', type: 'datetime-local', nullable: true },
          { key: 'ends_at', label: 'Ends', type: 'datetime-local', nullable: true }
        ],
        deleteMode: 'archive', archiveStatus: { field: 'is_active', value: false }
      };
    }
    if (section === 'fragrance-notes') {
      return {
        key: 'fragrance-notes', table: 'fragrance_notes', title: 'Fragrance Notes', singular: 'Fragrance note',
        description: 'Reusable scent notes and olfactive families used in product note pyramids.', permission: 'products',
        searchFields: ['name_en', 'name_ar', 'family', 'description'], defaultSort: 'name_en', defaultDirection: 'asc',
        columns: [
          { key: 'name_en', label: 'Note' }, { key: 'name_ar', label: 'Arabic' },
          { key: 'family', label: 'Family', type: 'status' }, { key: 'description', label: 'Description' }
        ],
        filters: [],
        fields: [
          { key: 'name_en', label: 'English name', required: true, maxlength: 180 },
          { key: 'name_ar', label: 'Arabic name', nullable: true, maxlength: 180 },
          { key: 'family', label: 'Olfactive family', nullable: true, maxlength: 120 },
          { key: 'description', label: 'Description', type: 'textarea', wide: true, nullable: true, maxlength: 3000 }
        ],
        deleteMode: 'hard'
      };
    }
    return CONFIGS.products;
  }

  async function renderProducts(section, root) {
    const current = PRODUCT_TABS.some(([key]) => key === section) ? section : 'catalog';
    root.innerHTML = `${sectionTabs('products', current, PRODUCT_TABS)}<div id="admin-submodule-root"></div>`;
    const child = document.getElementById('admin-submodule-root');
    if (child) await renderGeneric(productSectionConfig(current), child);
  }

  const ORDER_TABS = [
    ['orders', 'Orders'], ['payments', 'Payments'], ['returns', 'Returns'],
    ['refunds', 'Refunds'], ['subscriptions', 'Subscriptions']
  ];

  function orderSectionConfig(section) {
    if (section === 'payments') {
      return {
        key: 'order-payments', table: 'payments', title: 'Order Payments', singular: 'Payment',
        description: 'Payment provider references, amount, currency, and processing status.', permission: 'orders',
        searchFields: ['provider', 'charge_id', 'status'], defaultSort: 'created_at',
        columns: [
          { key: 'order_id', label: 'Order ID' }, { key: 'provider', label: 'Provider' },
          { key: 'charge_id', label: 'Charge' }, { key: 'amount', label: 'Amount', type: 'money' },
          { key: 'status', label: 'Status', type: 'status' }, { key: 'created_at', label: 'Created', type: 'datetime' }
        ],
        filters: [{ key: 'status', label: 'Status', options: choices(['initiated', 'pending', 'paid', 'failed', 'cancelled', 'refunded']) }],
        fields: [
          { key: 'order_id', label: 'Order', nullable: true, lookup: { table: 'orders', value: 'id', label: 'order_no' } },
          { key: 'provider', label: 'Provider', required: true, default: 'manual', maxlength: 80 },
          { key: 'charge_id', label: 'Provider reference', nullable: true, maxlength: 180 },
          { key: 'status', label: 'Status', type: 'select', options: choices(['initiated', 'pending', 'paid', 'failed', 'cancelled', 'refunded']), required: true, default: 'initiated' },
          { key: 'amount', label: 'Amount', type: 'number', min: 0, step: '0.01', required: true },
          { key: 'currency', label: 'Currency', required: true, default: 'SAR', maxlength: 3 }
        ],
        deleteMode: 'hard', canDelete: (row) => ['initiated', 'failed', 'cancelled'].includes(row.status)
      };
    }
    if (section === 'returns') {
      return {
        key: 'order-returns', table: 'order_returns', title: 'Returns', singular: 'Return',
        description: 'Return requests, approvals, receipt, resolution, and customer references.', permission: 'orders',
        searchFields: ['return_number', 'reason', 'notes'], defaultSort: 'created_at',
        columns: [
          { key: 'return_number', label: 'Return' }, { key: 'order_id', label: 'Order ID' },
          { key: 'status', label: 'Status', type: 'status' }, { key: 'reason', label: 'Reason' },
          { key: 'created_at', label: 'Created', type: 'datetime' }
        ],
        filters: [{ key: 'status', label: 'Status', options: choices(['requested', 'approved', 'received', 'rejected', 'completed', 'cancelled']) }],
        fields: [
          { key: 'return_number', label: 'Return number', required: true, immutable: true, maxlength: 80 },
          { key: 'order_id', label: 'Order', required: true, lookup: { table: 'orders', value: 'id', label: 'order_no' } },
          { key: 'customer_id', label: 'Customer', nullable: true, lookup: { table: 'profiles', value: 'id', label: 'email', filter: { role: 'customer' } } },
          { key: 'status', label: 'Status', type: 'select', options: choices(['requested', 'approved', 'received', 'rejected', 'completed', 'cancelled']), required: true, default: 'requested' },
          { key: 'reason', label: 'Reason', type: 'textarea', wide: true, required: true, maxlength: 3000 },
          { key: 'notes', label: 'Internal notes', type: 'textarea', wide: true, nullable: true, maxlength: 3000 }
        ],
        createdBy: 'created_by', deleteMode: 'hard', canDelete: (row) => ['requested', 'cancelled'].includes(row.status)
      };
    }
    if (section === 'refunds') {
      return {
        key: 'order-refunds', table: 'order_refunds', title: 'Refunds', singular: 'Refund',
        description: 'Controlled refund requests and payment references with approval status.', permission: 'orders',
        searchFields: ['refund_number', 'reason'], defaultSort: 'created_at',
        columns: [
          { key: 'refund_number', label: 'Refund' }, { key: 'order_id', label: 'Order ID' },
          { key: 'amount', label: 'Amount', type: 'money' }, { key: 'status', label: 'Status', type: 'status' },
          { key: 'created_at', label: 'Created', type: 'datetime' }
        ],
        filters: [{ key: 'status', label: 'Status', options: choices(['pending', 'approved', 'processed', 'failed', 'cancelled']) }],
        fields: [
          { key: 'refund_number', label: 'Refund number', required: true, immutable: true, maxlength: 80 },
          { key: 'order_id', label: 'Order', required: true, lookup: { table: 'orders', value: 'id', label: 'order_no' } },
          { key: 'return_id', label: 'Return ID', nullable: true },
          { key: 'payment_id', label: 'Payment ID', nullable: true },
          { key: 'amount', label: 'Amount', type: 'number', min: 0.01, step: '0.01', required: true },
          { key: 'currency', label: 'Currency', required: true, default: 'SAR', maxlength: 3 },
          { key: 'status', label: 'Status', type: 'select', options: choices(['pending', 'approved', 'processed', 'failed', 'cancelled']), required: true, default: 'pending' },
          { key: 'reason', label: 'Reason', type: 'textarea', wide: true, nullable: true, maxlength: 3000 }
        ],
        createdBy: 'created_by', deleteMode: 'hard', canDelete: (row) => ['pending', 'cancelled'].includes(row.status)
      };
    }
    if (section === 'subscriptions') {
      return {
        key: 'order-subscriptions', table: 'subscriptions', title: 'Subscriptions', singular: 'Subscription',
        description: 'Recurring product plans, frequency, next order, pause, and cancellation status.', permission: 'orders',
        searchFields: ['frequency', 'status', 'product_id'], defaultSort: 'next_order_at', defaultDirection: 'asc',
        columns: [
          { key: 'customer_id', label: 'Customer ID' }, { key: 'product_id', label: 'Product' },
          { key: 'frequency', label: 'Frequency' }, { key: 'status', label: 'Status', type: 'status' },
          { key: 'next_order_at', label: 'Next order', type: 'datetime' }
        ],
        filters: [{ key: 'status', label: 'Status', options: choices(['active', 'paused', 'cancelled', 'expired']) }],
        fields: [
          { key: 'customer_id', label: 'Customer', required: true, lookup: { table: 'profiles', value: 'id', label: 'email', filter: { role: 'customer' } } },
          { key: 'product_id', label: 'Product', nullable: true, lookup: { table: 'products', value: 'id', label: 'name_en' } },
          { key: 'status', label: 'Status', type: 'select', options: choices(['active', 'paused', 'cancelled', 'expired']), required: true, default: 'active' },
          { key: 'frequency', label: 'Frequency', required: true, maxlength: 80 },
          { key: 'next_order_at', label: 'Next order', type: 'datetime-local', nullable: true },
          { key: 'cancelled_at', label: 'Cancelled at', type: 'datetime-local', nullable: true }
        ],
        deleteMode: 'hard', canDelete: (row) => ['cancelled', 'expired'].includes(row.status)
      };
    }
    return CONFIGS.orders;
  }

  async function renderOrders(section, root) {
    const current = ORDER_TABS.some(([key]) => key === section) ? section : 'orders';
    root.innerHTML = `${sectionTabs('orders', current, ORDER_TABS)}<div id="admin-submodule-root"></div>`;
    const child = document.getElementById('admin-submodule-root');
    if (child) await renderGeneric(orderSectionConfig(current), child);
  }

  const CONTENT_TABS = [
    ['website', 'All Content'], ['homepage', 'Homepage'], ['sections', 'Website Sections'],
    ['journal', 'Journal'], ['faqs', 'FAQs'], ['policies', 'Policies'], ['seo', 'SEO'],
    ['requests', 'Requests'], ['reviews', 'Reviews'], ['subscribers', 'Newsletter']
  ];

  function contentTypeConfig(section, contentType, title) {
    return {
      ...CONFIGS.content,
      key: `content-${section}`,
      title,
      fixed: { content_type: contentType },
      fixedPayload: { content_type: contentType },
      fields: CONFIGS.content.fields.filter((field) => field.key !== 'content_type')
    };
  }

  function contentSectionConfig(section) {
    const typed = {
      homepage: ['homepage_banner', 'Homepage Banners'], sections: ['website_section', 'Website Sections'],
      journal: ['journal', 'Journal'], faqs: ['faq', 'Frequently Asked Questions'],
      policies: ['policy', 'Policies'], seo: ['seo', 'SEO Content']
    };
    if (typed[section]) return contentTypeConfig(section, typed[section][0], typed[section][1]);
    if (section === 'requests') {
      return {
        key: 'customer-requests', table: 'customer_requests', title: 'Customer Requests', singular: 'Request',
        description: 'Contact, consultation, personalization, engraving, and support requests.', permission: 'content',
        searchFields: ['name', 'email', 'phone', 'subject', 'message'], defaultSort: 'created_at',
        columns: [
          { key: 'request_type', label: 'Type', type: 'status' }, { key: 'name', label: 'Customer' },
          { key: 'subject', label: 'Subject' }, { key: 'status', label: 'Status', type: 'status' },
          { key: 'created_at', label: 'Created', type: 'datetime' }
        ],
        filters: [{ key: 'status', label: 'Status', options: choices(['new', 'assigned', 'in_progress', 'resolved', 'closed', 'cancelled']) }],
        fields: [
          { key: 'request_type', label: 'Request type', type: 'select', options: choices(['contact', 'consultation', 'engraving', 'personalization', 'support']), required: true },
          { key: 'customer_id', label: 'Customer', nullable: true, lookup: { table: 'profiles', value: 'id', label: 'email', filter: { role: 'customer' } } },
          { key: 'name', label: 'Name', nullable: true, maxlength: 180 }, { key: 'email', label: 'Email', type: 'email', nullable: true, maxlength: 254 },
          { key: 'phone', label: 'Phone', type: 'tel', nullable: true, maxlength: 40 }, { key: 'subject', label: 'Subject', nullable: true, maxlength: 300 },
          { key: 'message', label: 'Message', type: 'textarea', wide: true, nullable: true, maxlength: 5000 },
          { key: 'status', label: 'Status', type: 'select', options: choices(['new', 'assigned', 'in_progress', 'resolved', 'closed', 'cancelled']), required: true, default: 'new' },
          { key: 'assigned_to', label: 'Assigned to', nullable: true, lookup: { table: 'profiles', value: 'id', label: 'email' } },
          { key: 'notes', label: 'Internal notes', type: 'textarea', wide: true, nullable: true, maxlength: 3000 }
        ],
        deleteMode: 'hard', canDelete: (row) => ['new', 'cancelled'].includes(row.status)
      };
    }
    if (section === 'reviews') {
      return {
        key: 'product-reviews', table: 'product_reviews', title: 'Product Reviews', singular: 'Review',
        description: 'Customer ratings, verified-purchase status, moderation, and publication.', permission: 'content',
        searchFields: ['title', 'body', 'product_id'], defaultSort: 'created_at',
        columns: [
          { key: 'product_id', label: 'Product' }, { key: 'rating', label: 'Rating', type: 'number', decimals: 0 },
          { key: 'title', label: 'Title' }, { key: 'verified_purchase', label: 'Verified', type: 'boolean' },
          { key: 'status', label: 'Status', type: 'status' }, { key: 'created_at', label: 'Created', type: 'datetime' }
        ],
        filters: [{ key: 'status', label: 'Status', options: choices(['pending', 'published', 'rejected', 'archived']) }],
        fields: [
          { key: 'product_id', label: 'Product', required: true, lookup: { table: 'products', value: 'id', label: 'name_en' } },
          { key: 'customer_id', label: 'Customer', nullable: true, lookup: { table: 'profiles', value: 'id', label: 'email', filter: { role: 'customer' } } },
          { key: 'rating', label: 'Rating', type: 'number', min: 1, max: 5, step: 1, required: true },
          { key: 'title', label: 'Title', nullable: true, maxlength: 240 },
          { key: 'body', label: 'Review', type: 'textarea', wide: true, nullable: true, maxlength: 5000 },
          { key: 'verified_purchase', label: 'Verified purchase', type: 'boolean', default: false },
          { key: 'status', label: 'Status', type: 'select', options: choices(['pending', 'published', 'rejected', 'archived']), required: true, default: 'pending' }
        ],
        deleteMode: 'hard', canDelete: (row) => ['pending', 'rejected', 'archived'].includes(row.status)
      };
    }
    if (section === 'subscribers') {
      return {
        key: 'newsletter-subscribers', table: 'newsletter_subscribers', title: 'Newsletter Subscribers', singular: 'Subscriber',
        description: 'Consent-based newsletter addresses and signup dates.', permission: 'marketing',
        searchFields: ['email'], defaultSort: 'created_at',
        columns: [{ key: 'email', label: 'Email' }, { key: 'created_at', label: 'Subscribed', type: 'datetime' }], filters: [],
        fields: [{ key: 'email', label: 'Email', type: 'email', required: true, immutable: true, maxlength: 254 }],
        idFields: ['email'], deleteMode: 'hard'
      };
    }
    return CONFIGS.content;
  }

  async function renderContent(section, root) {
    const current = CONTENT_TABS.some(([key]) => key === section) ? section : 'website';
    root.innerHTML = `${sectionTabs('content', current, CONTENT_TABS)}<div id="admin-submodule-root"></div>`;
    const child = document.getElementById('admin-submodule-root');
    if (child) await renderGeneric(contentSectionConfig(current), child);
  }

  const MARKETING_TABS = [
    ['overview', 'Overview'], ['campaigns', 'Campaigns'], ['calendar', 'Calendar'], ['promotions', 'Promotions'],
    ['email', 'Email'], ['sms', 'SMS'], ['push', 'Push'], ['segments', 'Audience Segments'],
    ['abandoned-carts', 'Abandoned Carts'], ['wishlist', 'Wishlist'], ['loyalty', 'Loyalty'],
    ['referral', 'Referrals'], ['gift', 'Gift Campaigns'], ['partners', 'Partners'],
    ['content', 'Content Plan'], ['expenses', 'Expenses'], ['performance', 'Performance'], ['reports', 'Reports']
  ];

  function channelCampaignConfig(section, channel, title) {
    return {
      ...CONFIGS.campaigns,
      key: `marketing-${section}`,
      title,
      fixed: { channel },
      fixedPayload: { channel },
      fields: CONFIGS.campaigns.fields.filter((field) => field.key !== 'channel')
    };
  }

  function marketingSectionConfig(section) {
    const channelSections = { email: 'email', sms: 'sms', push: 'push', wishlist: 'wishlist', loyalty: 'loyalty', referral: 'referral', gift: 'gift' };
    if (channelSections[section]) return channelCampaignConfig(section, channelSections[section], `${titleCase(section)} Campaigns`);
    if (section === 'promotions') return CONFIGS.coupons;
    if (section === 'segments') {
      return {
        key: 'marketing-segments', table: 'marketing_segments', title: 'Audience Segments', singular: 'Segment',
        description: 'Reusable customer groups and transparent selection criteria.', permission: 'marketing',
        searchFields: ['name', 'description'], defaultSort: 'name', defaultDirection: 'asc',
        columns: [{ key: 'name', label: 'Segment' }, { key: 'description', label: 'Description' }, { key: 'is_active', label: 'Active', type: 'boolean' }, { key: 'updated_at', label: 'Updated', type: 'datetime' }],
        filters: [{ key: 'is_active', label: 'Status', options: [['true', 'Active'], ['false', 'Inactive']] }],
        fields: [
          { key: 'name', label: 'Segment name', required: true, maxlength: 180 },
          { key: 'description', label: 'Description', type: 'textarea', wide: true, nullable: true, maxlength: 3000 },
          { key: 'criteria', label: 'Criteria', type: 'json', wide: true, default: {}, help: 'Structured criteria only; no passwords or secrets.' },
          { key: 'is_active', label: 'Active', type: 'boolean', default: true }
        ], createdBy: 'created_by', deleteMode: 'hard'
      };
    }
    if (section === 'calendar') {
      return {
        key: 'marketing-calendar', table: 'marketing_events', title: 'Marketing Calendar', singular: 'Calendar event',
        description: 'Scheduled campaign events and measured event values.', permission: 'marketing',
        searchFields: ['event_type'], defaultSort: 'event_date', defaultDirection: 'asc',
        columns: [{ key: 'event_date', label: 'Date', type: 'date' }, { key: 'campaign_id', label: 'Campaign ID' }, { key: 'event_type', label: 'Event' }, { key: 'value', label: 'Value', type: 'number' }],
        filters: [],
        fields: [
          { key: 'campaign_id', label: 'Campaign', required: true, lookup: { table: 'marketing_campaigns', value: 'id', label: 'name' } },
          { key: 'event_type', label: 'Event type', required: true, maxlength: 120 },
          { key: 'event_date', label: 'Event date', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
          { key: 'value', label: 'Measured value', type: 'number', step: '0.0001', default: 0 },
          { key: 'metadata', label: 'Metadata', type: 'json', wide: true, default: {} }
        ], deleteMode: 'hard'
      };
    }
    if (section === 'partners') {
      return {
        key: 'marketing-partners', table: 'marketing_partners', title: 'Influencers & Partners', singular: 'Partner',
        description: 'Influencer, affiliate, retailer, and agency contacts with commission terms.', permission: 'marketing',
        searchFields: ['name', 'email', 'phone', 'social_handle'], defaultSort: 'name',
        columns: [{ key: 'name', label: 'Partner' }, { key: 'partner_type', label: 'Type', type: 'status' }, { key: 'social_handle', label: 'Social' }, { key: 'commission_rate', label: 'Commission', type: 'number' }, { key: 'status', label: 'Status', type: 'status' }],
        filters: [{ key: 'status', label: 'Status', options: choices(['active', 'inactive', 'archived']) }],
        fields: [
          { key: 'name', label: 'Name', required: true, maxlength: 180 },
          { key: 'partner_type', label: 'Partner type', type: 'select', options: choices(['influencer', 'affiliate', 'retailer', 'agency', 'other']), required: true },
          { key: 'email', label: 'Email', type: 'email', nullable: true, maxlength: 254 }, { key: 'phone', label: 'Phone', type: 'tel', nullable: true, maxlength: 40 },
          { key: 'social_handle', label: 'Social handle', nullable: true, maxlength: 180 },
          { key: 'commission_rate', label: 'Commission rate', type: 'number', min: 0, step: '0.0001', default: 0 },
          { key: 'status', label: 'Status', type: 'select', options: choices(['active', 'inactive', 'archived']), required: true, default: 'active' },
          { key: 'notes', label: 'Notes', type: 'textarea', wide: true, nullable: true, maxlength: 3000 }
        ], deleteMode: 'hard', canDelete: (row) => row.status === 'archived'
      };
    }
    if (section === 'content') {
      return {
        key: 'marketing-content', table: 'marketing_content_items', title: 'Marketing Content Plan', singular: 'Content item',
        description: 'Channel content, review status, schedule, campaign, owner, and attachment reference.', permission: 'marketing',
        searchFields: ['title', 'channel', 'content_type', 'notes'], defaultSort: 'scheduled_at', defaultDirection: 'asc',
        columns: [{ key: 'title', label: 'Content' }, { key: 'channel', label: 'Channel', type: 'status' }, { key: 'content_type', label: 'Type' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'scheduled_at', label: 'Scheduled', type: 'datetime' }],
        filters: [{ key: 'status', label: 'Status', options: choices(['idea', 'draft', 'review', 'scheduled', 'published', 'archived']) }],
        fields: [
          { key: 'title', label: 'Title', required: true, maxlength: 240 }, { key: 'channel', label: 'Channel', required: true, maxlength: 80 },
          { key: 'content_type', label: 'Content type', required: true, maxlength: 120 },
          { key: 'scheduled_at', label: 'Scheduled at', type: 'datetime-local', nullable: true },
          { key: 'status', label: 'Status', type: 'select', options: choices(['idea', 'draft', 'review', 'scheduled', 'published', 'archived']), required: true, default: 'idea' },
          { key: 'campaign_id', label: 'Campaign', nullable: true, lookup: { table: 'marketing_campaigns', value: 'id', label: 'name' } },
          { key: 'owner_id', label: 'Owner', nullable: true, lookup: { table: 'profiles', value: 'id', label: 'email' } },
          { key: 'attachment_document_id', label: 'Attachment document ID', nullable: true },
          { key: 'notes', label: 'Notes', type: 'textarea', wide: true, nullable: true, maxlength: 3000 }
        ], deleteMode: 'hard', canDelete: (row) => ['idea', 'draft', 'archived'].includes(row.status)
      };
    }
    if (section === 'abandoned-carts') {
      return {
        key: 'abandoned-carts', table: 'abandoned_carts', title: 'Abandoned Carts', singular: 'Abandoned cart',
        description: 'Customer cart value, contact references, recovery date, and campaign opportunity.', permission: 'marketing',
        searchFields: ['email', 'phone'], defaultSort: 'created_at',
        columns: [{ key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'total', label: 'Cart total', type: 'money' }, { key: 'recovered_at', label: 'Recovered', type: 'datetime' }, { key: 'created_at', label: 'Created', type: 'datetime' }],
        filters: [],
        fields: [
          { key: 'customer_id', label: 'Customer', nullable: true, lookup: { table: 'profiles', value: 'id', label: 'email', filter: { role: 'customer' } } },
          { key: 'email', label: 'Email', type: 'email', nullable: true, maxlength: 254 }, { key: 'phone', label: 'Phone', type: 'tel', nullable: true, maxlength: 40 },
          { key: 'items', label: 'Items', type: 'json', wide: true, required: true, default: [] },
          { key: 'total', label: 'Total', type: 'number', min: 0, step: '0.01', default: 0 },
          { key: 'currency', label: 'Currency', required: true, default: 'SAR', maxlength: 3 },
          { key: 'recovered_at', label: 'Recovered at', type: 'datetime-local', nullable: true }
        ], deleteMode: 'hard', canDelete: (row) => Boolean(row.recovered_at)
      };
    }
    if (section === 'expenses') {
      return {
        ...financeTransactionConfig('expenses'), key: 'marketing-expenses', title: 'Marketing Expenses',
        description: 'Posted and draft financial transactions classified as marketing expenditure.', fixed: { type: 'expense' },
        fields: [], readOnly: true
      };
    }
    if (section === 'performance') {
      return {
        key: 'campaign-performance', table: 'campaign_performance', title: 'Campaign Performance', singular: 'Campaign result',
        description: 'Database-calculated conversion rate and return on marketing spend.', permission: 'marketing',
        searchFields: ['name', 'channel'], defaultSort: 'updated_at',
        columns: [{ key: 'name', label: 'Campaign' }, { key: 'channel', label: 'Channel', type: 'status' }, { key: 'actual_spend', label: 'Spend', type: 'money' }, { key: 'revenue', label: 'Revenue', type: 'money' }, { key: 'conversion_rate', label: 'Conversion', type: 'number' }, { key: 'return_on_marketing_spend', label: 'ROAS', type: 'number' }],
        filters: [{ key: 'status', label: 'Status', options: choices(['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled']) }], fields: [], readOnly: true
      };
    }
    return CONFIGS.campaigns;
  }

  async function renderMarketingOverview(root) {
    const [campaigns, performance, abandoned] = await Promise.all([
      safeRows('marketing_campaigns?select=id,status,budget,actual_spend,revenue'),
      safeRows('campaign_performance?select=return_on_marketing_spend,conversions,revenue,actual_spend'),
      safeRows('abandoned_carts?select=id,total,recovered_at')
    ]);
    const spend = campaigns.reduce((sum, row) => sum + (Number(row.actual_spend) || 0), 0);
    const revenue = campaigns.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0);
    root.innerHTML = `
      <div class="admin-kpi-grid">
        ${kpi('Active campaigns', formatNumber(campaigns.filter((row) => row.status === 'active').length, 0), `${formatNumber(campaigns.length, 0)} total`, 'gold')}
        ${kpi('Marketing spend', formatMoney(spend), 'Recorded campaign spend', 'sand')}
        ${kpi('Attributed revenue', formatMoney(revenue), spend ? `${formatNumber(revenue / spend, 2)}x ROAS` : 'Awaiting attributed sales', 'green')}
        ${kpi('Open abandoned carts', formatNumber(abandoned.filter((row) => !row.recovered_at).length, 0), formatMoney(abandoned.filter((row) => !row.recovered_at).reduce((sum, row) => sum + (Number(row.total) || 0), 0)), 'stone')}
      </div>
      <div id="admin-marketing-overview-table"></div>`;
    const child = document.getElementById('admin-marketing-overview-table');
    if (child) await renderGeneric(marketingSectionConfig('performance'), child);
  }

  async function openCampaignProducts(campaignId) {
    const campaigns = await safeRows(`marketing_campaigns?id=eq.${encodeURIComponent(campaignId)}&select=id,name,status`);
    const campaign = campaigns[0];
    if (!campaign) return;
    runtime.marketingCampaign = campaign;
    runtime.campaignProducts = await safeRows(`marketing_campaign_products?campaign_id=eq.${encodeURIComponent(campaign.id)}&select=campaign_id,product_id,products(name_en)&order=product_id.asc`);
    const writable = can('marketing.write') && !['completed', 'cancelled'].includes(campaign.status);
    openModal(`
      <span class="admin-eyebrow">Campaign products</span><h2>${esc(campaign.name)}</h2>
      <div class="admin-panel-heading"><p>Associate launch, promotion, gifting, and audience campaigns with catalog products.</p>${writable ? '<button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.openCampaignProductForm()">Add product</button>' : ''}</div>
      ${runtime.campaignProducts.length ? `<div class="admin-activity-list">${runtime.campaignProducts.map((row, index) => `<div class="admin-status-row"><span class="admin-status-chip">Product</span><div><strong>${esc((row.products && row.products.name_en) || row.product_id)}</strong><small>${esc(row.product_id)}</small></div>${writable ? `<div class="admin-row-menu"><button type="button" class="danger" onclick="ASMRSAMRAdmin.deleteCampaignProduct(${index})">Remove</button></div>` : ''}</div>`).join('')}</div>` : emptyState('No campaign products', 'Associate the first product with this campaign.')}
      <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.closeModal()">Close</button></div>
    `, `Products for ${campaign.name}`);
  }

  async function openCampaignProductForm() {
    const products = await safeRows('products?select=id,name_en&status=eq.published&deleted_at=is.null&order=name_en.asc');
    const assigned = new Set((runtime.campaignProducts || []).map((row) => row.product_id));
    openModal(`
      <span class="admin-eyebrow">Campaign association</span><h2>${esc(runtime.marketingCampaign.name)}</h2>
      <form class="admin-settings-form" onsubmit="ASMRSAMRAdmin.saveCampaignProduct(event)">
        <label><span>Product *</span><select name="product_id" required><option value="">Select product</option>${products.filter((product) => !assigned.has(product.id)).map((product) => `<option value="${attr(product.id)}">${esc(product.name_en)}</option>`).join('')}</select></label>
        <p class="admin-form-error" id="admin-campaign-product-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.openCampaignProducts('${attr(runtime.marketingCampaign.id)}')">Cancel</button><button type="submit" class="admin-primary-btn">Add product</button></div>
      </form>
    `, 'Add campaign product');
  }

  async function saveCampaignProduct(event) {
    event.preventDefault();
    const productId = String(new FormData(event.currentTarget).get('product_id') || '');
    const errorNode = document.getElementById('admin-campaign-product-error');
    if (!productId) return;
    try {
      await db('marketing_campaign_products?on_conflict=campaign_id,product_id', {
        method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: { campaign_id: runtime.marketingCampaign.id, product_id: productId }
      });
      announce('Campaign product added.');
      await openCampaignProducts(runtime.marketingCampaign.id);
    } catch (error) { if (errorNode) { errorNode.hidden = false; errorNode.textContent = errorMessage(error); } }
  }

  function deleteCampaignProduct(index) {
    const row = runtime.campaignProducts[index];
    if (!row) return;
    confirmAction({ title: 'Remove campaign product', message: 'The product association will be removed without changing the campaign or product.', confirmLabel: 'Remove', danger: true,
      action: () => db(`marketing_campaign_products?campaign_id=eq.${encodeURIComponent(row.campaign_id)}&product_id=eq.${encodeURIComponent(row.product_id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
      success: 'Campaign product removed.' });
  }

  async function renderMarketing(section, root) {
    const current = MARKETING_TABS.some(([key]) => key === section) ? section : 'overview';
    root.innerHTML = `${sectionTabs('marketing', current, MARKETING_TABS)}<div id="admin-submodule-root"></div>`;
    const child = document.getElementById('admin-submodule-root');
    if (!child) return;
    if (current === 'overview') return renderMarketingOverview(child);
    if (current === 'reports') return renderReports(child, 'marketing');
    return renderGeneric(marketingSectionConfig(current), child);
  }

  async function dispatchPage(tab, section, root) {
    const genericMap = {
      customers: CONFIGS.customers,
      wishlist: CONFIGS.wishlist,
      rewards: CONFIGS.rewards,
      preorders: CONFIGS.preorders,
      coupons: CONFIGS.coupons,
      notifications: CONFIGS.notifications,
      suppliers: CONFIGS.suppliers,
      'purchase-orders': CONFIGS['purchase-orders'],
      formulas: CONFIGS.formulas,
      production: CONFIGS.production,
      costing: CONFIGS.costing,
      campaigns: CONFIGS.campaigns,
      audit: CONFIGS.audit
    };

    if (tab === 'overview') return renderOverview(root);
    if (tab === 'orders') return renderOrders(section || 'orders', root);
    if (tab === 'products') return renderProducts(section || 'catalog', root);
    if (tab === 'inventory') return renderInventory(root);
    if (tab === 'content') return renderContent(section || 'website', root);
    if (tab === 'marketing') return renderMarketing(section || 'overview', root);
    if (tab === 'ingredients') return renderIngredients(section || 'ingredients', root);
    if (tab === 'finance') return renderFinance(section || 'overview', root);
    if (tab === 'users') return renderUsers(root);
    if (tab === 'gifting') return renderGiftCards(root);
    if (tab === 'api-keys') return renderApiKeys(root);
    if (tab === 'roles') return renderRoles(root);
    if (tab === 'reports') return renderReports(root);
    if (tab === 'settings') return renderSettings(section || 'shipping', root);
    if (tab === 'status') return renderSystemStatus(root);
    if (genericMap[tab]) return renderGeneric(genericMap[tab], root);
    root.innerHTML = emptyState('Module unavailable', 'This route is not connected to a dashboard module.');
  }

  async function safeRows(path) {
    try {
      const result = await db(path);
      return Array.isArray(result.data) ? result.data : (result.data ? [result.data] : []);
    } catch (_) {
      return [];
    }
  }

  function kpi(label, value, helper, tone = '') {
    return `
      <article class="admin-kpi-card ${tone}">
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
        <small>${esc(helper)}</small>
      </article>
    `;
  }

  function compactList(rows, renderRow, emptyMessage) {
    if (!rows.length) return `<p class="admin-empty">${esc(emptyMessage)}</p>`;
    return `<div class="admin-activity-list">${rows.map(renderRow).join('')}</div>`;
  }

  async function renderOverview(root) {
    root.innerHTML = loadingState('Loading the business overview');
    const [
      overviewRows,
      monthly,
      recentTransactions,
      recentCustomers,
      profitability,
      campaigns,
      batches,
      productAlerts,
      ingredientAlerts,
      expiringLots
    ] = await Promise.all([
      safeRows('admin_business_overview?select=*'),
      safeRows('finance_monthly_summary?select=*&order=month.desc&limit=6'),
      safeRows('finance_transactions?select=id,transaction_number,transaction_date,type,description,amount,currency,payment_status,status&order=created_at.desc&limit=6'),
      safeRows('profiles?select=id,full_name,email,membership_tier,status,created_at&role=eq.customer&order=created_at.desc&limit=6'),
      safeRows('product_profitability?select=*&order=gross_profit.desc&limit=6'),
      safeRows('campaign_performance?select=id,name,status,revenue,actual_spend,return_on_marketing_spend,conversion_rate&order=updated_at.desc&limit=5'),
      safeRows('production_batches?select=id,batch_number,status,product_id,production_date,maceration_end_date,total_cost&order=created_at.desc&limit=5'),
      safeRows('product_inventory_summary?select=product_id,name_en,stock,low_stock_at,stock_status&stock_status=in.(low_stock,out_of_stock)&order=stock.asc&limit=8'),
      safeRows('ingredient_inventory_summary?select=id,internal_code,name,quantity_available,unit,minimum_stock,stock_status&stock_status=in.(low_stock,out_of_stock)&order=quantity_available.asc&limit=8'),
      safeRows(`ingredient_lots?select=id,lot_number,ingredient_id,expiry_date,retest_date,status&status=in.(available,released)&or=(expiry_date.lte.${new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)},retest_date.lte.${new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)})&order=expiry_date.asc&limit=8`)
    ]);
    const data = overviewRows[0] || {};
    const grossProfit = Number(data.gross_profit) || 0;
    const alerts = [
      ...productAlerts.map((row) => ({ type: 'Product stock', label: row.name_en || row.product_id, detail: `${formatNumber(row.stock)} available` })),
      ...ingredientAlerts.map((row) => ({ type: 'Ingredient stock', label: row.name, detail: `${formatNumber(row.quantity_available, 4)} ${row.unit} available` })),
      ...expiringLots.map((row) => ({ type: 'Expiry', label: row.lot_number, detail: formatDate(row.expiry_date || row.retest_date, true) }))
    ].slice(0, 10);
    const maxCash = Math.max(1, ...monthly.map((row) => Math.max(Number(row.income) || 0, Number(row.expenses) || 0)));

    root.innerHTML = `
      <div class="admin-kpi-grid">
        ${kpi('Total sales', formatMoney(data.total_sales), `${formatNumber(data.total_orders, 0)} orders`, 'gold')}
        ${kpi('Average order', formatMoney(data.average_order_value), `${formatNumber(data.pending_orders, 0)} pending`, 'sand')}
        ${kpi('Gross profit', formatMoney(grossProfit), 'Posted ledger entries', grossProfit >= 0 ? 'green' : 'danger')}
        ${kpi('Required actions', formatNumber(alerts.length, 0), `${formatNumber(data.low_stock_products, 0)} products · ${formatNumber(data.low_stock_ingredients, 0)} ingredients`, alerts.length ? 'danger' : 'green')}
      </div>
      <div class="admin-kpi-grid">
        ${kpi('Receivables', formatMoney(data.outstanding_receivables), 'Outstanding customer amounts', 'stone')}
        ${kpi('Payables', formatMoney(data.outstanding_payables), 'Outstanding supplier amounts', 'stone')}
        ${kpi('Monthly expenses', formatMoney(data.monthly_expenses), 'Current calendar month', 'sand')}
        ${kpi('Expiring ingredients', formatNumber(data.expiring_ingredients, 0), 'Within 60 days', Number(data.expiring_ingredients) ? 'danger' : 'green')}
      </div>

      <div class="admin-dashboard-grid">
        <article class="admin-panel">
          <div class="admin-panel-heading">
            <div><span class="admin-eyebrow">Cash flow</span><h2>Last six months</h2></div>
            <a href="#/admin/finance/cash-flow">Open finance</a>
          </div>
          ${monthly.length ? `
            <div class="admin-cash-chart">
              ${monthly.slice().reverse().map((row) => `
                <div class="admin-cash-row">
                  <span>${esc(formatDate(row.month, true))}</span>
                  <div>
                    <i class="income" style="width:${Math.max(2, Math.round((Number(row.income) || 0) / maxCash * 100))}%"></i>
                    <i class="expense" style="width:${Math.max(2, Math.round((Number(row.expenses) || 0) / maxCash * 100))}%"></i>
                  </div>
                  <strong>${esc(formatMoney(row.net_cash_flow, row.currency || 'SAR'))}</strong>
                </div>
              `).join('')}
            </div>
          ` : '<p class="admin-empty">No posted financial months yet.</p>'}
        </article>

        <article class="admin-panel">
          <div class="admin-panel-heading">
            <div><span class="admin-eyebrow">Attention</span><h2>Required actions</h2></div>
          </div>
          ${compactList(alerts, (alert) => `
            <div class="admin-activity-row">
              <span>!</span>
              <div><strong>${esc(alert.label)}</strong><small>${esc(alert.type)} · ${esc(alert.detail)}</small></div>
            </div>
          `, 'No low-stock or expiry alerts are currently visible.')}
        </article>

        <article class="admin-panel">
          <div class="admin-panel-heading">
            <div><span class="admin-eyebrow">Profitability</span><h2>Top products</h2></div>
            <a href="#/admin/costing">Open costing</a>
          </div>
          ${compactList(profitability, (row) => `
            <div class="admin-ranked-row">
              <span>${esc(String(row.name_en || row.product_id).slice(0, 1))}</span>
              <div><strong>${esc(row.name_en || row.product_id)}</strong><small>${esc(formatMoney(row.gross_profit))} gross · ${esc(formatNumber((Number(row.retail_margin) || 0) * 100, 1))}% margin</small></div>
            </div>
          `, 'Add cost components to calculate product profitability.')}
        </article>

        <article class="admin-panel">
          <div class="admin-panel-heading">
            <div><span class="admin-eyebrow">Production</span><h2>Current batches</h2></div>
            <a href="#/admin/production">Open production</a>
          </div>
          ${compactList(batches, (row) => `
            <div class="admin-status-row">
              <span class="status-dot ${['cancelled', 'corrected'].includes(row.status) ? 'warn' : 'ok'}"></span>
              <div><strong>${esc(row.batch_number)}</strong><small>${esc(titleCase(row.status))} · ${esc(row.product_id || 'No product')}</small></div>
            </div>
          `, 'No production batches have been recorded.')}
        </article>

        <article class="admin-panel">
          <div class="admin-panel-heading">
            <div><span class="admin-eyebrow">Finance</span><h2>Recent transactions</h2></div>
            <a href="#/admin/finance/ledger">Open ledger</a>
          </div>
          ${compactList(recentTransactions, (row) => `
            <div class="admin-activity-row">
              <span>${esc(String(row.type || 'T').slice(0, 1).toUpperCase())}</span>
              <div><strong>${esc(row.transaction_number)}</strong><small>${esc(clampText(row.description, 45))} · ${esc(formatMoney(row.amount, row.currency))}</small></div>
            </div>
          `, 'No financial transactions have been posted.')}
        </article>

        <article class="admin-panel">
          <div class="admin-panel-heading">
            <div><span class="admin-eyebrow">Customers</span><h2>Recent customers</h2></div>
            <a href="#/admin/users">Open users</a>
          </div>
          ${compactList(recentCustomers, (row) => `
            <div class="admin-activity-row">
              <span>${esc(String(row.full_name || row.email || 'C').slice(0, 1).toUpperCase())}</span>
              <div><strong>${esc(row.full_name || row.email || 'Customer')}</strong><small>${esc(titleCase(row.membership_tier))} · ${esc(titleCase(row.status))}</small></div>
            </div>
          `, 'No customer profiles are available.')}
        </article>

        <article class="admin-panel">
          <div class="admin-panel-heading">
            <div><span class="admin-eyebrow">Marketing</span><h2>Campaign performance</h2></div>
            <a href="#/admin/campaigns">Open campaigns</a>
          </div>
          ${compactList(campaigns, (row) => `
            <div class="admin-ranked-row">
              <span>${esc(formatNumber(row.return_on_marketing_spend, 1))}</span>
              <div><strong>${esc(row.name)}</strong><small>ROAS · ${esc(formatMoney(row.revenue))} revenue · ${esc(titleCase(row.status))}</small></div>
            </div>
          `, 'No campaign performance is available yet.')}
        </article>
      </div>
    `;
  }

  function productInventoryConfig() {
    return {
      key: 'product-inventory',
      table: 'product_inventory_summary',
      title: 'Product Inventory',
      singular: 'Inventory record',
      description: 'Current sellable stock, thresholds, valuation, and movement controls.',
      permission: 'inventory',
      searchFields: ['product_id', 'name_en', 'brand'],
      defaultSort: 'name_en',
      defaultDirection: 'asc',
      columns: [
        { key: 'name_en', label: 'Product' },
        { key: 'brand', label: 'Identity' },
        { key: 'stock', label: 'Stock', type: 'number', decimals: 3 },
        { key: 'low_stock_at', label: 'Low at', type: 'number', decimals: 3 },
        { key: 'inventory_value', label: 'Value', type: 'money' },
        { key: 'stock_status', label: 'Status', type: 'status' },
        { key: 'updated_at', label: 'Updated', type: 'datetime' }
      ],
      filters: [{ key: 'stock_status', label: 'Status', options: choices(['ready', 'low_stock', 'out_of_stock']) }],
      fields: [],
      readOnly: true,
      rowActions: (_row, index) => `
        ${can('inventory.write') ? `<button type="button" onclick="ASMRSAMRAdmin.openProductAdjustment(${index})">Adjust</button>` : ''}
        <button type="button" onclick="ASMRSAMRAdmin.openProductHistory(${index})">History</button>
      `
    };
  }

  async function renderInventory(root) {
    const summaryRows = await safeRows('product_inventory_summary?select=stock,inventory_value,stock_status');
    const totalStock = summaryRows.reduce((sum, row) => sum + (Number(row.stock) || 0), 0);
    const totalValue = summaryRows.reduce((sum, row) => sum + (Number(row.inventory_value) || 0), 0);
    const low = summaryRows.filter((row) => row.stock_status === 'low_stock').length;
    const out = summaryRows.filter((row) => row.stock_status === 'out_of_stock').length;
    root.innerHTML = `
      <div class="admin-kpi-grid">
        ${kpi('Sellable stock', formatNumber(totalStock), 'Units across the live catalog', 'gold')}
        ${kpi('Inventory value', formatMoney(totalValue), 'Database-calculated at product cost', 'sand')}
        ${kpi('Low stock', formatNumber(low, 0), 'At or below threshold', low ? 'danger' : 'green')}
        ${kpi('Out of stock', formatNumber(out, 0), 'Requires replenishment', out ? 'danger' : 'green')}
      </div>
      <div id="admin-submodule-root"></div>
    `;
    const child = document.getElementById('admin-submodule-root');
    if (child) await renderGeneric(productInventoryConfig(), child);
  }

  function sectionTabs(base, current, items) {
    return `
      <nav class="admin-subtabs" aria-label="${esc(titleCase(base))} sections">
        ${items.map(([key, label]) => `
          <a href="#/admin/${base}/${key}"
             class="${current === key ? 'active' : ''}"
             ${current === key ? 'aria-current="page"' : ''}>${esc(label)}</a>
        `).join('')}
      </nav>
    `;
  }

  const INGREDIENT_TABS = [
    ['ingredients', 'Ingredients'],
    ['stock-levels', 'Stock Levels'],
    ['stock-movements', 'Stock Movements'],
    ['suppliers', 'Suppliers'],
    ['purchase-orders', 'Purchase Orders'],
    ['batches-lots', 'Batches & Lots'],
    ['expiry', 'Expiry Tracking'],
    ['low-stock', 'Low Stock'],
    ['costs', 'Costs'],
    ['usage', 'Usage'],
    ['production-consumption', 'Production Consumption'],
    ['documents', 'Documents'],
    ['reports', 'Reports']
  ];

  function ingredientSectionConfig(section) {
    const configs = {
      'stock-levels': {
        key: 'ingredient-stock-levels',
        table: 'ingredient_inventory_summary',
        title: 'Ingredient Stock Levels',
        singular: 'Stock level',
        description: 'Available quantities, thresholds, value, supplier, and next expiry.',
        permission: 'ingredients',
        searchFields: ['internal_code', 'name', 'supplier_name'],
        defaultSort: 'name',
        defaultDirection: 'asc',
        columns: [
          { key: 'internal_code', label: 'Code' },
          { key: 'name', label: 'Ingredient' },
          { key: 'quantity_available', label: 'Available', type: 'number', decimals: 4 },
          { key: 'unit', label: 'Unit' },
          { key: 'stock_value', label: 'Value', type: 'money' },
          { key: 'stock_status', label: 'Status', type: 'status' },
          { key: 'next_expiry_date', label: 'Next expiry', type: 'date' }
        ],
        filters: [{ key: 'stock_status', label: 'Status', options: choices(['ready', 'low_stock', 'out_of_stock']) }],
        fields: [],
        readOnly: true,
        rowActions: (_row, index) => `${can('ingredients.write') ? `<button type="button" onclick="ASMRSAMRAdmin.openIngredientSummaryAdjustment(${index})">Adjust</button>` : ''}`
      },
      'stock-movements': {
        key: 'ingredient-stock-movements',
        table: 'ingredient_stock_movements',
        title: 'Ingredient Stock Movements',
        singular: 'Stock movement',
        description: 'Immutable additions, consumption, corrections, waste, damage, samples, trials, returns, production, and reversals.',
        permission: 'ingredients',
        searchFields: ['reason', 'reference_type', 'reference_id'],
        defaultSort: 'created_at',
        columns: [
          { key: 'ingredient_id', label: 'Ingredient ID' },
          { key: 'movement_type', label: 'Movement', type: 'status' },
          { key: 'quantity_delta', label: 'Change', type: 'number', decimals: 4 },
          { key: 'resulting_quantity', label: 'Result', type: 'number', decimals: 4 },
          { key: 'reason', label: 'Reason' },
          { key: 'created_at', label: 'Created', type: 'datetime' }
        ],
        filters: [{ key: 'movement_type', label: 'Type', options: choices(['initial', 'purchase', 'consume', 'correction', 'waste', 'damage', 'sample', 'trial', 'return', 'transfer', 'production', 'reversal']) }],
        fields: [],
        readOnly: true
      },
      'batches-lots': {
        key: 'ingredient-lots',
        table: 'ingredient_lots',
        title: 'Ingredient Batches & Lots',
        singular: 'Ingredient lot',
        description: 'Supplier lots, purchase, receipt, expiry, retest, quantity, cost, location, and release status.',
        permission: 'ingredients',
        searchFields: ['lot_number', 'notes'],
        defaultSort: 'created_at',
        columns: [
          { key: 'lot_number', label: 'Lot' },
          { key: 'ingredient_id', label: 'Ingredient ID' },
          { key: 'quantity_available', label: 'Available', type: 'number', decimals: 4 },
          { key: 'unit_cost', label: 'Unit cost', type: 'money' },
          { key: 'expiry_date', label: 'Expiry', type: 'date' },
          { key: 'status', label: 'Status', type: 'status' }
        ],
        filters: [{ key: 'status', label: 'Status', options: choices(['available', 'quarantined', 'released', 'expired', 'consumed', 'returned', 'archived']) }],
        fields: [
          { key: 'ingredient_id', label: 'Ingredient', required: true, lookup: { table: 'ingredients', value: 'id', label: 'name', filter: { status: 'active' } } },
          { key: 'supplier_id', label: 'Supplier', nullable: true, lookup: { table: 'suppliers', value: 'id', label: 'name' } },
          { key: 'lot_number', label: 'Lot number', required: true, immutable: true, maxlength: 120 },
          { key: 'purchase_date', label: 'Purchase date', type: 'date', nullable: true },
          { key: 'received_date', label: 'Received date', type: 'date', nullable: true },
          { key: 'expiry_date', label: 'Expiry date', type: 'date', nullable: true },
          { key: 'retest_date', label: 'Retest date', type: 'date', nullable: true },
          { key: 'quantity_received', label: 'Quantity received', type: 'number', min: 0, step: '0.0001', default: 0 },
          { key: 'quantity_available', label: 'Quantity available', type: 'number', min: 0, step: '0.0001', default: 0 },
          { key: 'unit_cost', label: 'Unit cost', type: 'number', min: 0, step: '0.000001', default: 0 },
          { key: 'location_id', label: 'Location', nullable: true, lookup: { table: 'inventory_locations', value: 'id', label: 'name', filter: { is_active: true } } },
          { key: 'status', label: 'Status', type: 'select', options: choices(['available', 'quarantined', 'released', 'expired', 'consumed', 'returned', 'archived']), required: true, default: 'available' },
          { key: 'notes', label: 'Notes', type: 'textarea', wide: true, nullable: true, maxlength: 3000 }
        ],
        createdBy: 'created_by',
        updatedBy: 'updated_by',
        deleteMode: 'archive',
        archiveStatus: { field: 'status', value: 'archived' }
      },
      expiry: {
        key: 'ingredient-expiry',
        table: 'ingredient_lots',
        title: 'Expiry Tracking',
        singular: 'Ingredient lot',
        description: 'Available and released lots ordered by expiry or retest date.',
        permission: 'ingredients',
        searchFields: ['lot_number'],
        defaultSort: 'expiry_date',
        defaultDirection: 'asc',
        columns: [
          { key: 'lot_number', label: 'Lot' },
          { key: 'ingredient_id', label: 'Ingredient ID' },
          { key: 'expiry_date', label: 'Expiry', type: 'date' },
          { key: 'retest_date', label: 'Retest', type: 'date' },
          { key: 'quantity_available', label: 'Available', type: 'number', decimals: 4 },
          { key: 'status', label: 'Status', type: 'status' }
        ],
        filters: [{ key: 'status', label: 'Status', options: choices(['available', 'released', 'quarantined', 'expired']) }],
        fields: [],
        readOnly: true
      },
      'low-stock': {
        key: 'ingredient-low-stock',
        table: 'ingredient_inventory_summary',
        title: 'Low Ingredient Stock',
        singular: 'Stock alert',
        description: 'Materials at or below their configured reorder threshold.',
        permission: 'ingredients',
        fixed: { stock_status: 'low_stock' },
        searchFields: ['internal_code', 'name', 'supplier_name'],
        defaultSort: 'quantity_available',
        defaultDirection: 'asc',
        columns: [
          { key: 'internal_code', label: 'Code' },
          { key: 'name', label: 'Ingredient' },
          { key: 'quantity_available', label: 'Available', type: 'number', decimals: 4 },
          { key: 'minimum_stock', label: 'Minimum', type: 'number', decimals: 4 },
          { key: 'reorder_quantity', label: 'Reorder', type: 'number', decimals: 4 },
          { key: 'supplier_name', label: 'Supplier' },
          { key: 'stock_status', label: 'Status', type: 'status' }
        ],
        fields: [],
        readOnly: true
      },
      costs: {
        key: 'ingredient-costs',
        table: 'ingredient_cost_trends',
        title: 'Ingredient Cost Trends',
        singular: 'Cost period',
        description: 'Database-calculated monthly movement quantity, average unit cost, and value.',
        permission: 'ingredients',
        searchFields: ['internal_code', 'name'],
        defaultSort: 'month',
        columns: [
          { key: 'month', label: 'Month', type: 'date' },
          { key: 'internal_code', label: 'Code' },
          { key: 'name', label: 'Ingredient' },
          { key: 'average_unit_cost', label: 'Avg unit cost', type: 'money' },
          { key: 'quantity_moved', label: 'Moved', type: 'number', decimals: 4 },
          { key: 'movement_value', label: 'Value', type: 'money' }
        ],
        fields: [],
        readOnly: true
      },
      usage: {
        key: 'ingredient-usage',
        table: 'production_consumptions',
        title: 'Ingredient Usage',
        singular: 'Consumption record',
        description: 'Actual ingredient consumption and historical cost by production batch.',
        permission: 'production',
        searchFields: ['ingredient_id', 'production_batch_id'],
        defaultSort: 'created_at',
        columns: [
          { key: 'production_batch_id', label: 'Batch ID' },
          { key: 'ingredient_id', label: 'Ingredient ID' },
          { key: 'planned_quantity', label: 'Planned', type: 'number', decimals: 6 },
          { key: 'actual_quantity', label: 'Actual', type: 'number', decimals: 6 },
          { key: 'unit_cost', label: 'Unit cost', type: 'money' },
          { key: 'total_cost', label: 'Total', type: 'money' },
          { key: 'created_at', label: 'Created', type: 'datetime' }
        ],
        fields: [],
        readOnly: true
      },
      'production-consumption': null,
      documents: {
        key: 'ingredient-documents',
        table: 'documents',
        title: 'Ingredient Documents',
        singular: 'Document',
        description: 'IFRA, safety, technical, certificate, invoice, and supporting document records.',
        permission: 'ingredients',
        searchFields: ['title', 'entity_type', 'entity_id', 'document_type'],
        defaultSort: 'created_at',
        columns: [
          { key: 'title', label: 'Document' },
          { key: 'document_type', label: 'Type', type: 'status' },
          { key: 'entity_type', label: 'Entity' },
          { key: 'entity_id', label: 'Record' },
          { key: 'expires_at', label: 'Expires', type: 'date' },
          { key: 'created_at', label: 'Uploaded', type: 'datetime' }
        ],
        fields: [],
        readOnly: true,
        toolbarActions: can('ingredients.write') ? '<button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.openDocumentUpload()">Upload</button>' : '',
        rowActions: (_row, index) => `
          <button type="button" onclick="ASMRSAMRAdmin.previewDocument(${index})">Preview</button>
          ${can('ingredients.write') ? `<button type="button" onclick="ASMRSAMRAdmin.replaceDocument(${index})">Replace</button><button type="button" class="danger" onclick="ASMRSAMRAdmin.deleteDocument(${index})">Delete</button>` : ''}
        `
      }
    };
    configs['production-consumption'] = configs.usage;
    return configs[section] || null;
  }

  async function renderIngredients(section, root) {
    if (!INGREDIENT_TABS.some(([key]) => key === section)) section = 'ingredients';
    root.innerHTML = `
      ${sectionTabs('ingredients', section, INGREDIENT_TABS)}
      <div id="admin-submodule-root"></div>
    `;
    const child = document.getElementById('admin-submodule-root');
    if (!child) return;
    if (section === 'ingredients') return renderGeneric(CONFIGS.ingredients, child);
    if (section === 'suppliers') return renderGeneric(CONFIGS.suppliers, child);
    if (section === 'purchase-orders') return renderGeneric(CONFIGS['purchase-orders'], child);
    if (section === 'reports') return renderReports(child, 'ingredients');
    const config = ingredientSectionConfig(section);
    if (config) return renderGeneric(config, child);
    child.innerHTML = emptyState('Section unavailable', 'This ingredient section is not configured.');
  }

  const FINANCE_TABS = [
    ['overview', 'Overview'],
    ['ledger', 'Ledger'],
    ['income', 'Income'],
    ['expenses', 'Expenses'],
    ['payments', 'Payments'],
    ['receivables', 'Receivables'],
    ['payables', 'Payables'],
    ['supplier-payments', 'Supplier Payments'],
    ['customer-payments', 'Customer Payments'],
    ['refunds', 'Refunds'],
    ['taxes', 'Taxes'],
    ['cogs', 'Cost of Goods Sold'],
    ['product-costs', 'Product Costs'],
    ['ingredient-costs', 'Ingredient Costs'],
    ['packaging-costs', 'Packaging Costs'],
    ['shipping-costs', 'Shipping Costs'],
    ['marketing-costs', 'Marketing Costs'],
    ['operating-expenses', 'Operating Expenses'],
    ['budgets', 'Budgets'],
    ['cash-flow', 'Cash Flow'],
    ['profit-loss', 'Profit & Loss'],
    ['reports', 'Reports'],
    ['financial-settings', 'Financial Settings']
  ];

  function financeTransactionConfig(section) {
    const types = {
      income: 'income',
      expenses: 'expense',
      payments: 'payment',
      receivables: 'receivable',
      payables: 'payable',
      'supplier-payments': 'supplier_payment',
      'customer-payments': 'customer_payment',
      refunds: 'refund',
      taxes: 'tax',
      cogs: 'cogs',
      'operating-expenses': 'expense'
    };
    const fixedType = types[section] || '';
    return {
      key: `finance-${section}`,
      table: 'finance_transactions',
      title: section === 'ledger' ? 'Financial Ledger' : titleCase(section),
      singular: 'Transaction',
      description: 'Audited transaction headers with server-validated posting and reversal.',
      permission: 'finance',
      searchFields: ['transaction_number', 'description', 'invoice_reference', 'payment_method'],
      fixed: fixedType ? { type: fixedType } : {},
      fixedPayload: fixedType ? { type: fixedType } : {},
      defaultSort: 'transaction_date',
      columns: [
        { key: 'transaction_number', label: 'Transaction' },
        { key: 'transaction_date', label: 'Date', type: 'date' },
        { key: 'type', label: 'Type', type: 'status' },
        { key: 'description', label: 'Description' },
        { key: 'amount', label: 'Amount', type: 'money' },
        { key: 'payment_status', label: 'Payment', type: 'status' },
        { key: 'status', label: 'Ledger', type: 'status' }
      ],
      filters: [{ key: 'status', label: 'Ledger status', options: choices(['draft', 'posted', 'reversed', 'cancelled']) }],
      fields: [
        { key: 'transaction_number', label: 'Transaction number', required: true, immutable: true, maxlength: 100 },
        { key: 'transaction_date', label: 'Date', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
        { key: 'type', label: 'Type', type: 'select', options: choices(['income', 'expense', 'payment', 'receivable', 'payable', 'supplier_payment', 'customer_payment', 'refund', 'tax', 'cogs', 'adjustment']), required: !fixedType, hidden: Boolean(fixedType) },
        { key: 'category_id', label: 'Category', nullable: true, lookup: { table: 'finance_categories', value: 'id', label: 'name', filter: { is_active: true } } },
        { key: 'description', label: 'Description', required: true, maxlength: 500 },
        { key: 'amount', label: 'Amount', type: 'number', min: 0, step: '0.01', required: true },
        { key: 'currency', label: 'Currency', required: true, default: 'SAR', maxlength: 3 },
        { key: 'tax_amount', label: 'Tax amount', type: 'number', min: 0, step: '0.01', default: 0 },
        { key: 'payment_method', label: 'Payment method', nullable: true, maxlength: 100 },
        { key: 'payment_status', label: 'Payment status', type: 'select', options: choices(['unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded']), required: true, default: 'unpaid' },
        { key: 'status', label: 'Ledger status', type: 'select', options: [['draft', 'Draft']], required: true, default: 'draft', help: 'Post from the row action after balanced debit and credit lines are entered.' },
        { key: 'due_date', label: 'Due date', type: 'date', nullable: true },
        { key: 'paid_date', label: 'Paid date', type: 'date', nullable: true },
        { key: 'customer_id', label: 'Customer', nullable: true, lookup: { table: 'profiles', value: 'id', label: 'email', filter: { role: 'customer' } } },
        { key: 'supplier_id', label: 'Supplier', nullable: true, lookup: { table: 'suppliers', value: 'id', label: 'name' } },
        { key: 'order_id', label: 'Order ID', nullable: true },
        { key: 'purchase_order_id', label: 'Purchase order ID', nullable: true },
        { key: 'invoice_reference', label: 'Invoice reference', nullable: true, maxlength: 160 },
        { key: 'receipt_document_id', label: 'Receipt document ID', nullable: true },
        { key: 'notes', label: 'Notes', type: 'textarea', wide: true, nullable: true, maxlength: 3000 }
      ],
      createdBy: 'created_by',
      updatedBy: 'updated_by',
      deleteMode: 'hard',
      canEdit: (row) => row.status === 'draft',
      canDelete: (row) => row.status === 'draft',
      rowActions: (row, index) => `
        <button type="button" onclick="ASMRSAMRAdmin.openLedgerLines('${attr(`finance-${section}`)}', ${index})">Lines</button>
        ${row.status === 'draft' && can('finance.post') ? `<button type="button" onclick="ASMRSAMRAdmin.postTransaction('${attr(`finance-${section}`)}', ${index})">Post</button>` : ''}
        ${row.status === 'posted' && can('finance.post') ? `<button type="button" class="danger" onclick="ASMRSAMRAdmin.reverseTransaction('${attr(`finance-${section}`)}', ${index})">Reverse</button>` : ''}
        ${row.status === 'posted' && ['unpaid', 'partially_paid', 'overdue'].includes(row.payment_status) ? `<button type="button" onclick="ASMRSAMRAdmin.openPaymentStatus('${attr(`finance-${section}`)}', ${index})">Payment</button>` : ''}
      `
    };
  }

  function budgetConfig() {
    return {
      key: 'finance-budgets',
      table: 'budgets',
      title: 'Budgets',
      singular: 'Budget',
      description: 'Category budgets by period with currency and audit ownership.',
      permission: 'finance',
      searchFields: ['name', 'notes'],
      defaultSort: 'period_start',
      columns: [
        { key: 'name', label: 'Budget' },
        { key: 'period_start', label: 'Starts', type: 'date' },
        { key: 'period_end', label: 'Ends', type: 'date' },
        { key: 'amount', label: 'Amount', type: 'money' },
        { key: 'currency', label: 'Currency' },
        { key: 'updated_at', label: 'Updated', type: 'datetime' }
      ],
      fields: [
        { key: 'name', label: 'Budget name', required: true, maxlength: 180 },
        { key: 'category_id', label: 'Category', nullable: true, lookup: { table: 'finance_categories', value: 'id', label: 'name', filter: { is_active: true } } },
        { key: 'period_start', label: 'Period start', type: 'date', required: true },
        { key: 'period_end', label: 'Period end', type: 'date', required: true },
        { key: 'amount', label: 'Amount', type: 'number', min: 0, step: '0.01', required: true },
        { key: 'currency', label: 'Currency', required: true, default: 'SAR', maxlength: 3 },
        { key: 'notes', label: 'Notes', type: 'textarea', wide: true, nullable: true, maxlength: 3000 }
      ],
      createdBy: 'created_by',
      deleteMode: 'hard'
    };
  }

  function financeSummaryConfig(section) {
    if (section === 'product-costs') {
      return {
        key: 'finance-product-costs',
        table: 'product_profitability',
        title: 'Product Profitability',
        singular: 'Product cost',
        description: 'Database-calculated selling price, total cost, gross profit, margin, break-even, and recommended price.',
        permission: 'finance',
        searchFields: ['product_id', 'name_en', 'variant_name'],
        defaultSort: 'gross_profit',
        columns: [
          { key: 'name_en', label: 'Product' },
          { key: 'variant_name', label: 'Variant' },
          { key: 'selling_price', label: 'Price', type: 'money' },
          { key: 'total_cost', label: 'Total cost', type: 'money' },
          { key: 'gross_profit', label: 'Gross profit', type: 'money' },
          { key: 'retail_margin', label: 'Margin', render: (value) => esc(`${formatNumber((Number(value) || 0) * 100, 1)}%`) },
          { key: 'recommended_price', label: 'Recommended', type: 'money' }
        ],
        fields: [],
        readOnly: true
      };
    }
    if (section === 'ingredient-costs') {
      return ingredientSectionConfig('costs');
    }
    if (['cash-flow', 'profit-loss'].includes(section)) {
      return {
        key: `finance-${section}`,
        table: 'finance_monthly_summary',
        title: section === 'cash-flow' ? 'Monthly Cash Flow' : 'Profit & Loss Summary',
        singular: 'Monthly summary',
        description: 'Posted-ledger totals calculated by the database.',
        permission: 'finance',
        searchFields: ['currency'],
        defaultSort: 'month',
        columns: [
          { key: 'month', label: 'Month', type: 'date' },
          { key: 'income', label: 'Income', type: 'money' },
          { key: 'expenses', label: 'Expenses', type: 'money' },
          { key: 'receivables', label: 'Receivables', type: 'money' },
          { key: 'payables', label: 'Payables', type: 'money' },
          { key: 'net_cash_flow', label: section === 'cash-flow' ? 'Net cash flow' : 'Net result', type: 'money' }
        ],
        fields: [],
        readOnly: true
      };
    }
    return null;
  }

  function costSectionConfig(section) {
    const componentTypes = {
      'packaging-costs': 'packaging',
      'shipping-costs': 'shipping',
      'marketing-costs': 'marketing'
    };
    const type = componentTypes[section];
    if (!type) return null;
    return {
      ...CONFIGS.costing,
      key: `finance-${section}`,
      title: titleCase(section),
      fixed: { component_type: type },
      fixedPayload: { component_type: type },
      fields: CONFIGS.costing.fields.map((field) =>
        field.key === 'component_type' ? { ...field, hidden: true, required: false } : { ...field }
      )
    };
  }

  async function renderFinanceOverview(root) {
    const [monthly, overviewRows, recent] = await Promise.all([
      safeRows('finance_monthly_summary?select=*&order=month.desc&limit=12'),
      safeRows('admin_business_overview?select=*'),
      safeRows('finance_transactions?select=id,transaction_number,transaction_date,type,description,amount,currency,payment_status,status&order=created_at.desc&limit=8')
    ]);
    const data = overviewRows[0] || {};
    const income = monthly.reduce((sum, row) => sum + (Number(row.income) || 0), 0);
    const expenses = monthly.reduce((sum, row) => sum + (Number(row.expenses) || 0), 0);
    root.innerHTML = `
      <div class="admin-kpi-grid">
        ${kpi('Posted income', formatMoney(income), 'Visible months', 'gold')}
        ${kpi('Posted expenses', formatMoney(expenses), 'Visible months', 'sand')}
        ${kpi('Gross profit', formatMoney(data.gross_profit), 'Income less cost of goods', Number(data.gross_profit) >= 0 ? 'green' : 'danger')}
        ${kpi('Net cash flow', formatMoney(income - expenses), 'Income less posted expenses', income >= expenses ? 'green' : 'danger')}
      </div>
      <div class="admin-kpi-grid">
        ${kpi('Receivables', formatMoney(data.outstanding_receivables), 'Outstanding customer amounts', 'stone')}
        ${kpi('Payables', formatMoney(data.outstanding_payables), 'Outstanding supplier amounts', 'stone')}
        ${kpi('Monthly expenses', formatMoney(data.monthly_expenses), 'Current calendar month', 'sand')}
        ${kpi('Inventory value', formatMoney((await safeRows('product_inventory_summary?select=inventory_value')).reduce((sum, row) => sum + (Number(row.inventory_value) || 0), 0)), 'Product stock at current cost', 'gold')}
      </div>
      <article class="admin-panel">
        <div class="admin-panel-heading"><div><span class="admin-eyebrow">Ledger</span><h2>Recent transactions</h2></div><a href="#/admin/finance/ledger">Open ledger</a></div>
        ${compactList(recent, (row) => `
          <div class="admin-activity-row">
            <span>${esc(String(row.type || 'T').slice(0, 1).toUpperCase())}</span>
            <div><strong>${esc(row.transaction_number)}</strong><small>${esc(clampText(row.description, 60))} · ${esc(formatMoney(row.amount, row.currency))} · ${esc(titleCase(row.status))}</small></div>
          </div>
        `, 'No ledger transactions have been created.')}
      </article>
    `;
  }

  async function renderFinancialSettings(root) {
    const [accounts, categories] = await Promise.all([
      safeRows('finance_accounts?select=*&order=code.asc'),
      safeRows('finance_categories?select=*&order=kind.asc,name.asc')
    ]);
    root.innerHTML = `
      <div class="admin-dashboard-grid">
        <article class="admin-panel">
          <div class="admin-panel-heading"><div><span class="admin-eyebrow">Chart of accounts</span><h2>Accounts</h2></div><button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.openFinanceAccount()">Add</button></div>
          ${compactList(accounts, (row) => `
            <div class="admin-status-row">
              <span class="status-dot ${row.is_active ? 'ok' : 'warn'}"></span>
              <div><strong>${esc(row.code)} · ${esc(row.name)}</strong><small>${esc(titleCase(row.account_type))} · ${esc(row.currency)}</small></div>
            </div>
          `, 'No finance accounts are configured.')}
        </article>
        <article class="admin-panel">
          <div class="admin-panel-heading"><div><span class="admin-eyebrow">Classification</span><h2>Categories</h2></div><button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.openFinanceCategory()">Add</button></div>
          ${compactList(categories, (row) => `
            <div class="admin-status-row">
              <span class="status-dot ${row.is_active ? 'ok' : 'warn'}"></span>
              <div><strong>${esc(row.name)}</strong><small>${esc(titleCase(row.kind))}</small></div>
            </div>
          `, 'No finance categories are configured.')}
        </article>
      </div>
    `;
  }

  async function renderFinance(section, root) {
    if (!FINANCE_TABS.some(([key]) => key === section)) section = 'overview';
    root.innerHTML = `
      ${sectionTabs('finance', section, FINANCE_TABS)}
      <div id="admin-submodule-root"></div>
    `;
    const child = document.getElementById('admin-submodule-root');
    if (!child) return;
    if (section === 'overview') return renderFinanceOverview(child);
    if (section === 'reports') return renderReports(child, 'finance');
    if (section === 'financial-settings') return renderFinancialSettings(child);
    if (section === 'budgets') return renderGeneric(budgetConfig(), child);
    const summary = financeSummaryConfig(section);
    if (summary) return renderGeneric(summary, child);
    const costs = costSectionConfig(section);
    if (costs) return renderGeneric(costs, child);
    return renderGeneric(financeTransactionConfig(section), child);
  }

  function financeAccountConfig() {
    return {
      key: 'finance-accounts',
      table: 'finance_accounts',
      title: 'Finance Accounts',
      singular: 'Finance account',
      description: 'Chart-of-account records.',
      permission: 'finance',
      columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }],
      fields: [
        { key: 'code', label: 'Account code', required: true, immutable: true, maxlength: 40 },
        { key: 'name', label: 'Account name', required: true, maxlength: 180 },
        { key: 'account_type', label: 'Account type', type: 'select', options: choices(['asset', 'liability', 'equity', 'income', 'expense', 'cogs']), required: true },
        { key: 'currency', label: 'Currency', required: true, default: 'SAR', maxlength: 3 },
        { key: 'is_active', label: 'Active', type: 'boolean', default: true }
      ],
      deleteMode: 'hard'
    };
  }

  function financeCategoryConfig() {
    return {
      key: 'finance-categories',
      table: 'finance_categories',
      title: 'Finance Categories',
      singular: 'Finance category',
      description: 'Income, expense, asset, liability, cost, tax, and refund categories.',
      permission: 'finance',
      columns: [{ key: 'name', label: 'Name' }, { key: 'kind', label: 'Kind' }],
      fields: [
        { key: 'name', label: 'Category name', required: true, maxlength: 180 },
        { key: 'kind', label: 'Kind', type: 'select', options: choices(['income', 'expense', 'asset', 'liability', 'cogs', 'tax', 'refund']), required: true },
        { key: 'parent_id', label: 'Parent category ID', nullable: true },
        { key: 'is_active', label: 'Active', type: 'boolean', default: true }
      ],
      deleteMode: 'hard'
    };
  }

  function openFinanceAccount() {
    const config = financeAccountConfig();
    runtime.configs[config.key] = config;
    openGenericForm(config.key);
  }

  function openFinanceCategory() {
    const config = financeCategoryConfig();
    runtime.configs[config.key] = config;
    openGenericForm(config.key);
  }

  const SETTINGS_TABS = [
    ['shipping', 'Shipping'],
    ['taxes', 'Taxes'],
    ['locations', 'Locations'],
    ['security', 'API Keys']
  ];

  function settingsConfig(section) {
    if (section === 'shipping') {
      return {
        key: 'settings-shipping',
        table: 'shipping_methods',
        title: 'Shipping Methods',
        singular: 'Shipping method',
        description: 'Delivery price, free-shipping threshold, regions, timing, and availability.',
        permission: 'settings',
        searchFields: ['name', 'code'],
        defaultSort: 'name',
        defaultDirection: 'asc',
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Method' },
          { key: 'price', label: 'Price', type: 'money' },
          { key: 'free_over', label: 'Free over', type: 'money' },
          { key: 'regions', label: 'Regions' },
          { key: 'is_active', label: 'Active', type: 'boolean' }
        ],
        filters: [{ key: 'is_active', label: 'Status', options: [['true', 'Active'], ['false', 'Inactive']] }],
        fields: [
          { key: 'name', label: 'Method name', required: true, maxlength: 160 },
          { key: 'code', label: 'Method code', required: true, immutable: true, maxlength: 80 },
          { key: 'price', label: 'Price', type: 'number', min: 0, step: '0.01', default: 0 },
          { key: 'free_over', label: 'Free over', type: 'number', min: 0, step: '0.01', nullable: true },
          { key: 'regions', label: 'Regions', type: 'array', nullable: true, help: 'Comma-separated regions.' },
          { key: 'estimated_days_min', label: 'Minimum days', type: 'number', min: 0, step: 1, nullable: true },
          { key: 'estimated_days_max', label: 'Maximum days', type: 'number', min: 0, step: 1, nullable: true },
          { key: 'is_active', label: 'Active', type: 'boolean', default: true }
        ],
        deleteMode: 'hard'
      };
    }
    if (section === 'taxes') {
      return {
        key: 'settings-taxes',
        table: 'tax_rates',
        title: 'Tax Rates',
        singular: 'Tax rate',
        description: 'Country and region tax rates with effective date ranges.',
        permission: 'settings',
        searchFields: ['name', 'country', 'region'],
        defaultSort: 'effective_from',
        columns: [
          { key: 'name', label: 'Tax' },
          { key: 'country', label: 'Country' },
          { key: 'region', label: 'Region' },
          { key: 'rate', label: 'Rate', render: (value) => esc(`${formatNumber((Number(value) || 0) * 100, 2)}%`) },
          { key: 'effective_from', label: 'Effective', type: 'date' },
          { key: 'is_active', label: 'Active', type: 'boolean' }
        ],
        filters: [{ key: 'is_active', label: 'Status', options: [['true', 'Active'], ['false', 'Inactive']] }],
        fields: [
          { key: 'name', label: 'Tax name', required: true, maxlength: 160 },
          { key: 'country', label: 'Country', required: true, default: 'Saudi Arabia', maxlength: 120 },
          { key: 'region', label: 'Region', nullable: true, maxlength: 120 },
          { key: 'rate', label: 'Rate as decimal', type: 'number', min: 0, step: '0.0001', required: true, default: 0.15, help: 'For 15%, enter 0.15.' },
          { key: 'is_active', label: 'Active', type: 'boolean', default: true },
          { key: 'effective_from', label: 'Effective from', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
          { key: 'effective_to', label: 'Effective to', type: 'date', nullable: true }
        ],
        deleteMode: 'hard'
      };
    }
    return {
      key: 'settings-locations',
      table: 'inventory_locations',
      title: 'Inventory Locations',
      singular: 'Inventory location',
      description: 'Warehouses, production spaces, counters, and default stock location.',
      permission: 'inventory',
      searchFields: ['name', 'code', 'address'],
      defaultSort: 'name',
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Location' },
        { key: 'address', label: 'Address' },
        { key: 'is_default', label: 'Default', type: 'boolean' },
        { key: 'is_active', label: 'Active', type: 'boolean' }
      ],
      fields: [
        { key: 'name', label: 'Location name', required: true, maxlength: 180 },
        { key: 'code', label: 'Location code', required: true, immutable: true, maxlength: 80 },
        { key: 'address', label: 'Address', type: 'textarea', wide: true, nullable: true, maxlength: 1000 },
        { key: 'is_active', label: 'Active', type: 'boolean', default: true },
        { key: 'is_default', label: 'Default location', type: 'boolean', default: false }
      ],
      deleteMode: 'hard'
    };
  }

  async function renderSettings(section, root) {
    if (!SETTINGS_TABS.some(([key]) => key === section)) section = 'shipping';
    root.innerHTML = `
      ${sectionTabs('settings', section, SETTINGS_TABS)}
      <div id="admin-submodule-root"></div>
    `;
    const child = document.getElementById('admin-submodule-root');
    if (!child) return;
    if (section === 'security') return renderApiKeys(child);
    return renderGeneric(settingsConfig(section), child);
  }

  const PERMISSIONS = [
    'dashboard.read',
    'products.read', 'products.write',
    'inventory.read', 'inventory.write',
    'ingredients.read', 'ingredients.write',
    'purchasing.read', 'purchasing.write',
    'production.read', 'production.write',
    'orders.read', 'orders.write',
    'customers.read', 'customers.write',
    'marketing.read', 'marketing.write',
    'content.read', 'content.write',
    'notifications.read', 'notifications.write',
    'finance.read', 'finance.write', 'finance.post',
    'costing.read', 'costing.write',
    'reports.read', 'exports.run',
    'settings.read', 'settings.write',
    'roles.read', 'roles.write'
  ];

  async function renderRoles(root) {
    root.innerHTML = loadingState('Loading roles and permissions');
    if (runtime.profile.role !== 'admin') {
      root.innerHTML = errorState(new Error('Only administrators can manage roles and permissions.'));
      return;
    }
    const [roles, permissions] = await Promise.all([
      safeRows('app_roles?select=*&order=name.asc'),
      safeRows('role_permissions?select=role_name,permission')
    ]);
    const assigned = new Set(permissions.map((row) => `${row.role_name}:${row.permission}`));
    root.innerHTML = `
      <article class="admin-panel">
        <div class="admin-panel-heading">
          <div><span class="admin-eyebrow">Role-based access</span><h2>Permissions matrix</h2><p>Authorization is enforced by Row Level Security; these controls update the database matrix.</p></div>
        </div>
        <div class="admin-role-matrix-wrap">
          <table class="admin-role-matrix">
            <thead><tr><th scope="col">Permission</th>${roles.map((role) => `<th scope="col">${esc(role.label)}</th>`).join('')}</tr></thead>
            <tbody>
              ${PERMISSIONS.map((permission) => `
                <tr>
                  <th scope="row">${esc(permission)}</th>
                  ${roles.map((role) => {
                    const implicit = role.name === 'admin';
                    const checked = implicit || assigned.has(`${role.name}:${permission}`);
                    return `<td><input type="checkbox" aria-label="${attr(permission)} for ${attr(role.label)}"
                      ${checked ? 'checked' : ''} ${implicit ? 'disabled' : ''}
                      onchange="ASMRSAMRAdmin.toggleRolePermission('${attr(role.name)}','${attr(permission)}',this.checked)"></td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </article>
    `;
  }

  async function toggleRolePermission(role, permission, checked) {
    if (runtime.profile.role !== 'admin' || role === 'admin') return;
    try {
      setBusy(true);
      if (checked) {
        await db('role_permissions?on_conflict=role_name,permission', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: { role_name: role, permission }
        });
      } else {
        await db(`role_permissions?role_name=eq.${encodeURIComponent(role)}&permission=eq.${encodeURIComponent(permission)}`, {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' }
        });
      }
      announce('Role permission updated.');
    } catch (error) {
      announce(errorMessage(error), 'error');
      await reloadCurrentPage();
    } finally {
      setBusy(false);
    }
  }

  async function renderSystemStatus(root) {
    root.innerHTML = loadingState('Verifying database modules and storage');
    const tables = [
      'products', 'orders', 'profiles', 'product_inventory', 'ingredients', 'suppliers',
      'formulas', 'production_batches', 'finance_transactions', 'marketing_campaigns',
      'website_content', 'api_keys', 'audit_logs'
    ];
    const checks = await Promise.all(tables.map(async (table) => {
      try {
        await db(`${table}?select=*&limit=1`);
        return { table, ok: true, detail: 'Reachable with current role' };
      } catch (error) {
        return { table, ok: false, detail: errorMessage(error) };
      }
    }));
    let storage = [];
    try {
      const response = await request('/storage/v1/bucket', { method: 'GET' });
      storage = response.data || [];
    } catch (_) {
      storage = [];
    }
    root.innerHTML = `
      <div class="admin-status-large">
        <article class="admin-panel admin-status-card">
          <span class="status-dot ok"></span>
          <div><span class="admin-eyebrow">Authentication</span><h2>Active session</h2><p>${esc(runtime.profile.email || runtime.profile.id)} · ${esc(titleCase(runtime.profile.role))}</p></div>
        </article>
        <article class="admin-panel admin-status-card">
          <span class="status-dot ${storage.length ? 'ok' : 'warn'}"></span>
          <div><span class="admin-eyebrow">Storage</span><h2>${storage.length ? `${storage.length} buckets` : 'Restricted response'}</h2><p>${storage.length ? esc(storage.map((bucket) => bucket.name || bucket.id).join(', ')) : 'Bucket operations remain protected by Storage policies.'}</p></div>
        </article>
      </div>
      <article class="admin-panel">
        <div class="admin-panel-heading"><div><span class="admin-eyebrow">Database</span><h2>Module health</h2><p>Each check uses the signed-in role, so a restricted module is reported honestly.</p></div></div>
        <div class="admin-status-list">
          ${checks.map((check) => `
            <div class="admin-status-row">
              <span class="status-dot ${check.ok ? 'ok' : 'warn'}"></span>
              <div><strong>${esc(titleCase(check.table))}</strong><small>${esc(check.detail)}</small></div>
            </div>
          `).join('')}
        </div>
      </article>
    `;
  }

  function storageObjectPath(bucket, path) {
    return `/storage/v1/object/${encodeURIComponent(bucket)}/${String(path).split('/').map(encodeURIComponent).join('/')}`;
  }

  function uploadStorageFile(bucket, path, file, onProgress) {
    return new Promise(async (resolve, reject) => {
      const config = getConfig();
      const session = await refreshSessionIfNeeded(getSession());
      if (!session || !session.access_token) {
        reject(new Error('Authentication is required.'));
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${config.url}${storageObjectPath(bucket, path)}`);
      xhr.setRequestHeader('apikey', config.anonKey);
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) onProgress(Math.round(event.loaded / event.total * 100));
      });
      xhr.addEventListener('load', () => {
        let payload = {};
        try { payload = JSON.parse(xhr.responseText || '{}'); } catch (_) {}
        if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
        else reject(new Error(payload.message || payload.error || `Upload failed (${xhr.status})`));
      });
      xhr.addEventListener('error', () => reject(new Error('The file upload was interrupted.')));
      xhr.send(file);
    });
  }

  function imageDimensions(file) {
    return new Promise((resolve) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
        URL.revokeObjectURL(url);
      };
      image.onerror = () => {
        resolve({ width: null, height: null });
        URL.revokeObjectURL(url);
      };
      image.src = url;
    });
  }

  function cleanFileName(name) {
    const pieces = String(name || 'image').toLowerCase().split('.');
    const extension = pieces.length > 1 ? pieces.pop().replace(/[^a-z0-9]/g, '') : 'webp';
    const base = pieces.join('-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'image';
    return `${base}.${extension}`;
  }

  async function openDocumentUpload(index) {
    const rows = runtime.rows['ingredient-documents'] || [];
    const documentRow = Number.isInteger(index) ? rows[index] : null;
    runtime.documentEditIndex = Number.isInteger(index) ? index : -1;
    const ingredients = await safeRows('ingredients?select=id,name,internal_code&archived_at=is.null&order=name.asc');
    openModal(`
      <span class="admin-eyebrow">Technical documentation</span>
      <h2>${documentRow ? 'Replace ingredient document' : 'Upload ingredient document'}</h2>
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.saveDocumentUpload(event)" novalidate>
        <div class="admin-editor-grid">
          <label><span>Ingredient *</span><select name="entity_id" required><option value="">Select ingredient</option>${ingredients.map((ingredient) => `<option value="${attr(ingredient.id)}" ${documentRow && documentRow.entity_id === ingredient.id ? 'selected' : ''}>${esc(ingredient.internal_code)} · ${esc(ingredient.name)}</option>`).join('')}</select></label>
          <label><span>Document type *</span><select name="document_type" required>${choices(['ifra', 'sds', 'technical_data', 'certificate', 'invoice', 'allergen', 'other']).map(([value, label]) => `<option value="${value}" ${documentRow && documentRow.document_type === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
          <label><span>Title *</span><input name="title" required maxlength="240" value="${attr(documentRow ? documentRow.title : '')}"></label>
          <label><span>Expires / retest</span><input name="expires_at" type="date" value="${attr(documentRow ? documentRow.expires_at || '' : '')}"></label>
          <label class="admin-editor-wide"><span>${documentRow ? 'Replacement file *' : 'Document file *'}</span><input name="document" type="file" accept="application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required><small>PDF, JPEG, PNG, DOCX, or XLSX · maximum 15 MB.</small></label>
        </div>
        <div class="admin-upload-progress" id="admin-document-progress" aria-live="polite"></div>
        <p class="admin-form-error" id="admin-document-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.closeModal()">Cancel</button><button type="submit" class="admin-primary-btn">${documentRow ? 'Replace document' : 'Upload document'}</button></div>
      </form>
    `, documentRow ? 'Replace ingredient document' : 'Upload ingredient document');
  }

  function replaceDocument(index) {
    return openDocumentUpload(index);
  }

  async function saveDocumentUpload(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = form.elements.document.files && form.elements.document.files[0];
    const existing = runtime.documentEditIndex >= 0 ? (runtime.rows['ingredient-documents'] || [])[runtime.documentEditIndex] : null;
    const allowed = new Set([
      'application/pdf', 'image/jpeg', 'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]);
    const errorNode = document.getElementById('admin-document-error');
    if (!file || !allowed.has(file.type) || file.size > 15 * 1024 * 1024) {
      if (errorNode) { errorNode.hidden = false; errorNode.textContent = 'Choose a supported PDF, image, DOCX, or XLSX file under 15 MB.'; }
      return;
    }
    const entityId = String(data.get('entity_id') || '').trim();
    const documentType = String(data.get('document_type') || '').trim();
    const title = String(data.get('title') || '').trim();
    if (!entityId || !documentType || !title) return;
    const path = `ingredients/${entityId}/${crypto.randomUUID()}-${cleanFileName(file.name)}`;
    const progress = document.getElementById('admin-document-progress');
    try {
      setBusy(true);
      await uploadStorageFile('admin-documents', path, file, (percent) => {
        if (progress) progress.innerHTML = `<span>Uploading ${esc(file.name)} · ${percent}%</span><i style="width:${percent}%"></i>`;
      });
      const payload = {
        entity_type: 'ingredient', entity_id: entityId, document_type: documentType, title,
        storage_bucket: 'admin-documents', storage_path: path, mime_type: file.type,
        file_size: file.size, expires_at: String(data.get('expires_at') || '') || null,
        uploaded_by: runtime.profile.id
      };
      if (existing) {
        await db(`documents?id=eq.${encodeURIComponent(existing.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: payload });
        if (existing.storage_bucket === 'admin-documents' && existing.storage_path) {
          await request(storageObjectPath(existing.storage_bucket, existing.storage_path), { method: 'DELETE' }).catch(() => null);
        }
      } else {
        await db('documents', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: payload });
      }
      closeModal();
      announce(existing ? 'Ingredient document replaced.' : 'Ingredient document uploaded.');
      await reloadCurrentPage();
    } catch (error) {
      await request(storageObjectPath('admin-documents', path), { method: 'DELETE' }).catch(() => null);
      if (errorNode) { errorNode.hidden = false; errorNode.textContent = errorMessage(error); }
    } finally {
      setBusy(false);
    }
  }

  async function previewDocument(index) {
    const documentRow = (runtime.rows['ingredient-documents'] || [])[index];
    if (!documentRow) return;
    try {
      const result = await request(`/storage/v1/object/sign/${encodeURIComponent(documentRow.storage_bucket)}/${String(documentRow.storage_path).split('/').map(encodeURIComponent).join('/')}`, {
        method: 'POST', body: { expiresIn: 120 }
      });
      const signed = result.data && (result.data.signedURL || result.data.signedUrl || result.data.signed_url);
      if (!signed) throw new Error('A signed preview URL could not be created.');
      const url = signed.startsWith('http') ? signed : `${getConfig().url}${signed}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      announce(errorMessage(error), 'error');
    }
  }

  function deleteDocument(index) {
    const documentRow = (runtime.rows['ingredient-documents'] || [])[index];
    if (!documentRow) return;
    confirmAction({
      title: 'Delete ingredient document',
      message: 'The private storage object and its document record will be permanently removed.',
      confirmLabel: 'Delete document', danger: true,
      action: async () => {
        if (documentRow.storage_bucket && documentRow.storage_path) {
          await request(storageObjectPath(documentRow.storage_bucket, documentRow.storage_path), { method: 'DELETE' });
        }
        await db(`documents?id=eq.${encodeURIComponent(documentRow.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      },
      success: 'Ingredient document deleted.'
    });
  }

  async function openImages(index) {
    const product = runtime.rows.products && runtime.rows.products[index];
    if (!product) return;
    runtime.mediaProduct = product;
    const images = await safeRows(`product_images?product_id=eq.${encodeURIComponent(product.id)}&select=*&order=sort_order.asc,created_at.asc`);
    runtime.mediaRows = images;
    const writable = can('products.write');
    openModal(`
      <span class="admin-eyebrow">Product media</span>
      <h2>${esc(product.name_en)}</h2>
      <p>Upload clear product photography, select the primary image, reorder it, and maintain useful alternative text.</p>
      ${writable ? `
        <form class="admin-media-upload" onsubmit="ASMRSAMRAdmin.uploadProductImages(event)">
          <label>
            <span>Upload images</span>
            <input type="file" name="images" accept="image/jpeg,image/png,image/webp,image/avif" multiple required>
            <small>JPEG, PNG, WebP, or AVIF · maximum 8 MB each.</small>
          </label>
          <button type="submit" class="admin-primary-btn">Upload</button>
          <div class="admin-upload-progress" id="admin-upload-progress" aria-live="polite"></div>
        </form>
      ` : ''}
      <div class="admin-media-grid">
        ${images.length ? images.map((image, imageIndex) => {
          const source = safeUrl(image.public_url || image.fallback_url);
          return `
            <article class="admin-media-item ${image.is_primary ? 'is-primary' : ''}">
              <div class="admin-media-preview">
                ${source ? `<img src="${attr(source)}" alt="${attr(image.alt_text)}">` : '<span>Preview unavailable</span>'}
              </div>
              <strong>${esc(image.title || image.alt_text)}</strong>
              <small>${image.is_primary ? 'Primary image' : `Position ${imageIndex + 1}`} · ${esc(image.mime_type || 'Legacy asset')}</small>
              ${writable ? `
                <div class="admin-row-menu">
                  ${image.is_primary ? '' : `<button type="button" onclick="ASMRSAMRAdmin.setPrimaryImage(${imageIndex})">Primary</button>`}
                  <button type="button" onclick="ASMRSAMRAdmin.moveImage(${imageIndex},-1)" ${imageIndex === 0 ? 'disabled' : ''}>Up</button>
                  <button type="button" onclick="ASMRSAMRAdmin.moveImage(${imageIndex},1)" ${imageIndex === images.length - 1 ? 'disabled' : ''}>Down</button>
                  <button type="button" onclick="ASMRSAMRAdmin.editImageMetadata(${imageIndex})">Edit</button>
                  <label class="admin-inline-file">Replace<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onchange="ASMRSAMRAdmin.replaceProductImage(${imageIndex},this.files[0])"></label>
                  <button type="button" class="danger" onclick="ASMRSAMRAdmin.deleteProductImage(${imageIndex})">Delete</button>
                </div>
              ` : ''}
            </article>
          `;
        }).join('') : emptyState('No product photos', 'Upload the first optimized product image. Existing legacy image URLs remain preserved.')}
      </div>
    `, `Images for ${product.name_en}`);
  }

  async function uploadProductImages(event) {
    event.preventDefault();
    const files = Array.from(event.currentTarget.elements.images.files || []);
    const progress = document.getElementById('admin-upload-progress');
    if (!runtime.mediaProduct || !files.length) return;
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
    const invalid = files.find((file) => !allowed.has(file.type) || file.size > 8 * 1024 * 1024);
    if (invalid) {
      announce(`${invalid.name} is not a supported image under 8 MB.`, 'error');
      return;
    }
    try {
      setBusy(true);
      let position = runtime.mediaRows.length;
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const path = `${runtime.mediaProduct.id}/${crypto.randomUUID()}-${cleanFileName(file.name)}`;
        await uploadStorageFile('product-images', path, file, (percent) => {
          if (progress) progress.innerHTML = `<span>Uploading ${esc(file.name)} · ${percent}%</span><i style="width:${percent}%"></i>`;
        });
        const dimensions = await imageDimensions(file);
        const config = getConfig();
        await db('product_images', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: {
            product_id: runtime.mediaProduct.id,
            storage_bucket: 'product-images',
            storage_path: path,
            public_url: `${config.url}/storage/v1/object/public/product-images/${path.split('/').map(encodeURIComponent).join('/')}`,
            alt_text: runtime.mediaProduct.name_en,
            title: file.name.replace(/\.[^.]+$/, ''),
            mime_type: file.type,
            file_size: file.size,
            width: dimensions.width,
            height: dimensions.height,
            is_primary: runtime.mediaRows.length === 0 && index === 0,
            sort_order: position,
            created_by: runtime.profile.id
          }
        });
        position += 1;
      }
      announce(files.length === 1 ? 'Product image uploaded.' : `${files.length} product images uploaded.`);
      await openImages(runtime.rows.products.findIndex((row) => row.id === runtime.mediaProduct.id));
    } catch (error) {
      announce(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function setPrimaryImage(index) {
    const image = runtime.mediaRows[index];
    if (!image || !runtime.mediaProduct) return;
    try {
      setBusy(true);
      await db(`product_images?product_id=eq.${encodeURIComponent(runtime.mediaProduct.id)}&is_primary=eq.true`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: { is_primary: false }
      });
      await db(`product_images?id=eq.${encodeURIComponent(image.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: { is_primary: true }
      });
      announce('Primary product image updated.');
      await openImages(runtime.rows.products.findIndex((row) => row.id === runtime.mediaProduct.id));
    } catch (error) {
      announce(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function moveImage(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= runtime.mediaRows.length) return;
    const current = runtime.mediaRows[index];
    const target = runtime.mediaRows[targetIndex];
    try {
      setBusy(true);
      await Promise.all([
        db(`product_images?id=eq.${encodeURIComponent(current.id)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: { sort_order: target.sort_order }
        }),
        db(`product_images?id=eq.${encodeURIComponent(target.id)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: { sort_order: current.sort_order }
        })
      ]);
      await openImages(runtime.rows.products.findIndex((row) => row.id === runtime.mediaProduct.id));
    } catch (error) {
      announce(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  function editImageMetadata(index) {
    const image = runtime.mediaRows[index];
    if (!image) return;
    runtime.mediaEditIndex = index;
    openModal(`
      <span class="admin-eyebrow">Image metadata</span>
      <h2>Edit product image</h2>
      <form class="admin-settings-form" onsubmit="ASMRSAMRAdmin.saveImageMetadata(event)">
        <label><span>Alternative text *</span><input name="alt_text" value="${attr(image.alt_text)}" required maxlength="300"></label>
        <label><span>Title</span><input name="title" value="${attr(image.title || '')}" maxlength="200"></label>
        <div class="admin-editor-actions">
          <button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.openImages(${runtime.rows.products.findIndex((row) => row.id === runtime.mediaProduct.id)})">Cancel</button>
          <button type="submit" class="admin-primary-btn">Save metadata</button>
        </div>
      </form>
    `, 'Edit image metadata');
  }

  async function saveImageMetadata(event) {
    event.preventDefault();
    const image = runtime.mediaRows[runtime.mediaEditIndex];
    if (!image) return;
    const data = new FormData(event.currentTarget);
    try {
      await db(`product_images?id=eq.${encodeURIComponent(image.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: {
          alt_text: String(data.get('alt_text') || '').trim(),
          title: String(data.get('title') || '').trim() || null
        }
      });
      announce('Image metadata saved.');
      await openImages(runtime.rows.products.findIndex((row) => row.id === runtime.mediaProduct.id));
    } catch (error) {
      announce(errorMessage(error), 'error');
    }
  }

  async function replaceProductImage(index, file) {
    const image = runtime.mediaRows[index];
    if (!image || !file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      announce('Choose a supported image under 8 MB.', 'error');
      return;
    }
    try {
      setBusy(true);
      const path = `${runtime.mediaProduct.id}/${crypto.randomUUID()}-${cleanFileName(file.name)}`;
      await uploadStorageFile('product-images', path, file);
      const dimensions = await imageDimensions(file);
      const config = getConfig();
      await db(`product_images?id=eq.${encodeURIComponent(image.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: {
          storage_bucket: 'product-images',
          storage_path: path,
          public_url: `${config.url}/storage/v1/object/public/product-images/${path.split('/').map(encodeURIComponent).join('/')}`,
          fallback_url: null,
          mime_type: file.type,
          file_size: file.size,
          width: dimensions.width,
          height: dimensions.height
        }
      });
      if (image.storage_bucket === 'product-images' && image.storage_path && !image.storage_path.startsWith('legacy-assets/')) {
        await request(storageObjectPath(image.storage_bucket, image.storage_path), { method: 'DELETE' }).catch(() => null);
      }
      announce('Product image replaced.');
      await openImages(runtime.rows.products.findIndex((row) => row.id === runtime.mediaProduct.id));
    } catch (error) {
      announce(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  function deleteProductImage(index) {
    const image = runtime.mediaRows[index];
    if (!image) return;
    confirmAction({
      title: 'Delete product image',
      message: 'The image record and its managed storage object will be removed. Legacy fallback assets are left intact.',
      confirmLabel: 'Delete image',
      danger: true,
      action: async () => {
        if (image.storage_bucket === 'product-images' && image.storage_path && !image.storage_path.startsWith('legacy-assets/')) {
          await request(storageObjectPath(image.storage_bucket, image.storage_path), { method: 'DELETE' });
        }
        await db(`product_images?id=eq.${encodeURIComponent(image.id)}`, {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' }
        });
        if (image.is_primary) {
          const replacement = runtime.mediaRows.find((row) => row.id !== image.id);
          if (replacement) {
            await db(`product_images?id=eq.${encodeURIComponent(replacement.id)}`, {
              method: 'PATCH',
              headers: { Prefer: 'return=minimal' },
              body: { is_primary: true }
            });
          }
        }
      },
      success: 'Product image deleted.'
    });
  }

  async function openVariants(index) {
    const product = runtime.rows.products && runtime.rows.products[index];
    if (!product) return;
    runtime.variantProduct = product;
    runtime.variantRows = await safeRows(`product_variants?product_id=eq.${encodeURIComponent(product.id)}&select=*&archived_at=is.null&order=sort_order.asc,created_at.asc`);
    const writable = can('products.write');
    openModal(`
      <span class="admin-eyebrow">Sizes and variants</span>
      <h2>${esc(product.name_en)}</h2>
      <div class="admin-panel-heading">
        <p>Maintain size, concentration, SKU, barcode, price, cost, tax, stock threshold, and default selection.</p>
        ${writable ? '<button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.openVariantForm()">Add variant</button>' : ''}
      </div>
      <div class="admin-data-table-wrap">
        ${runtime.variantRows.length ? `
          <table class="admin-data-table">
            <thead><tr><th>Name</th><th>Size</th><th>Price</th><th>SKU</th><th>Stock</th><th>Default</th><th></th></tr></thead>
            <tbody>
              ${runtime.variantRows.map((row, rowIndex) => `
                <tr>
                  <td data-label="Name">${esc(row.name)}</td>
                  <td data-label="Size">${esc(row.size || 'Not set')}</td>
                  <td data-label="Price">${esc(formatMoney(row.price))}</td>
                  <td data-label="SKU">${esc(row.sku || 'Not set')}</td>
                  <td data-label="Stock">${esc(formatNumber(row.stock))}</td>
                  <td data-label="Default">${row.is_default ? 'Yes' : 'No'}</td>
                  <td data-label="Actions"><div class="admin-row-menu">
                    ${writable ? `
                      <button type="button" onclick="ASMRSAMRAdmin.openVariantForm(${rowIndex})">Edit</button>
                      ${row.is_default ? '' : `<button type="button" onclick="ASMRSAMRAdmin.setDefaultVariant(${rowIndex})">Default</button>`}
                      <button type="button" class="danger" onclick="ASMRSAMRAdmin.archiveVariant(${rowIndex})">Archive</button>
                    ` : ''}
                  </div></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : emptyState('No variants', 'Add the first size or concentration variant.')}
      </div>
    `, `Variants for ${product.name_en}`);
  }

  function openVariantForm(index) {
    const row = Number.isInteger(index) ? runtime.variantRows[index] : null;
    runtime.variantEditIndex = Number.isInteger(index) ? index : -1;
    openModal(`
      <span class="admin-eyebrow">${row ? 'Edit variant' : 'New variant'}</span>
      <h2>${esc(runtime.variantProduct.name_en)}</h2>
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.saveVariant(event)">
        <div class="admin-editor-grid">
          <label><span>Name *</span><input name="name" value="${attr(row && row.name)}" required maxlength="160"></label>
          <label><span>Size</span><input name="size" value="${attr(row && row.size)}" maxlength="60"></label>
          <label><span>Concentration</span><input name="concentration" value="${attr(row && row.concentration)}" maxlength="80"></label>
          <label><span>SKU</span><input name="sku" value="${attr(row && row.sku)}" maxlength="80"></label>
          <label><span>Barcode</span><input name="barcode" value="${attr(row && row.barcode)}" maxlength="100"></label>
          <label><span>Price *</span><input name="price" type="number" min="0" step="0.01" value="${attr(row && row.price)}" required></label>
          <label><span>Cost</span><input name="cost" type="number" min="0" step="0.01" value="${attr(row ? row.cost : 0)}"></label>
          <label><span>Tax rate</span><input name="tax_rate" type="number" min="0" step="0.0001" value="${attr(row ? row.tax_rate : 0.15)}"></label>
          <label><span>Low-stock threshold</span><input name="low_stock_at" type="number" min="0" step="0.001" value="${attr(row ? row.low_stock_at : 0)}"></label>
          <label><span>Sort order</span><input name="sort_order" type="number" min="0" step="1" value="${attr(row ? row.sort_order : runtime.variantRows.length)}"></label>
          <label><span>Active</span><input name="is_active" type="checkbox" ${!row || row.is_active ? 'checked' : ''}></label>
          <label><span>Default</span><input name="is_default" type="checkbox" ${row && row.is_default ? 'checked' : ''}></label>
        </div>
        <p class="admin-form-error" id="admin-variant-error" hidden></p>
        <div class="admin-editor-actions">
          <button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.openVariants(${runtime.rows.products.findIndex((item) => item.id === runtime.variantProduct.id)})">Cancel</button>
          <button type="submit" class="admin-primary-btn">Save variant</button>
        </div>
      </form>
    `, row ? 'Edit variant' : 'Add variant');
  }

  async function saveVariant(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const row = runtime.variantEditIndex >= 0 ? runtime.variantRows[runtime.variantEditIndex] : null;
    const payload = {
      product_id: runtime.variantProduct.id,
      name: String(data.get('name') || '').trim(),
      size: String(data.get('size') || '').trim() || null,
      concentration: String(data.get('concentration') || '').trim() || null,
      sku: String(data.get('sku') || '').trim() || null,
      barcode: String(data.get('barcode') || '').trim() || null,
      price: Number(data.get('price')) || 0,
      cost: Number(data.get('cost')) || 0,
      tax_rate: Number(data.get('tax_rate')) || 0,
      low_stock_at: Number(data.get('low_stock_at')) || 0,
      sort_order: Number(data.get('sort_order')) || 0,
      is_active: form.elements.is_active.checked,
      is_default: form.elements.is_default.checked
    };
    const errorNode = document.getElementById('admin-variant-error');
    if (!payload.name) return;
    try {
      setBusy(true);
      if (payload.is_default) {
        await db(`product_variants?product_id=eq.${encodeURIComponent(runtime.variantProduct.id)}&is_default=eq.true`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: { is_default: false }
        });
      }
      if (row) {
        await db(`product_variants?id=eq.${encodeURIComponent(row.id)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: payload
        });
      } else {
        await db('product_variants', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: payload
        });
      }
      if (payload.size) {
        await db('product_prices?on_conflict=product_id,size', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: { product_id: runtime.variantProduct.id, size: payload.size, price: payload.price }
        });
      }
      announce('Product variant saved.');
      await openVariants(runtime.rows.products.findIndex((item) => item.id === runtime.variantProduct.id));
    } catch (error) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = errorMessage(error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function setDefaultVariant(index) {
    const row = runtime.variantRows[index];
    if (!row) return;
    try {
      await db(`product_variants?product_id=eq.${encodeURIComponent(runtime.variantProduct.id)}&is_default=eq.true`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: { is_default: false }
      });
      await db(`product_variants?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: { is_default: true }
      });
      await openVariants(runtime.rows.products.findIndex((item) => item.id === runtime.variantProduct.id));
    } catch (error) {
      announce(errorMessage(error), 'error');
    }
  }

  function archiveVariant(index) {
    const row = runtime.variantRows[index];
    if (!row) return;
    confirmAction({
      title: 'Archive product variant',
      message: 'The variant will no longer be available for new purchases. Historical references remain intact.',
      confirmLabel: 'Archive',
      danger: true,
      action: async () => db(`product_variants?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: { archived_at: new Date().toISOString(), is_active: false, is_default: false }
      }),
      success: 'Variant archived.'
    });
  }

  async function openProductProfile(index) {
    const product = runtime.rows.products && runtime.rows.products[index];
    if (!product) return;
    runtime.profileProduct = product;
    await showProductProfile();
  }

  async function showProductProfile() {
    const product = runtime.profileProduct;
    if (!product) return;
    const [notes, related, memberships] = await Promise.all([
      safeRows(`product_fragrance_notes?product_id=eq.${encodeURIComponent(product.id)}&select=product_id,note_id,phase,sort_order,fragrance_notes(id,name_en,name_ar,family)&order=phase.asc,sort_order.asc`),
      safeRows(`related_products?product_id=eq.${encodeURIComponent(product.id)}&select=product_id,related_product_id,relation_type,sort_order,products!related_products_related_product_id_fkey(id,name_en)&order=sort_order.asc`),
      safeRows(`product_collection_items?product_id=eq.${encodeURIComponent(product.id)}&select=product_id,collection_id,sort_order,product_collections(id,name_en)&order=sort_order.asc`)
    ]);
    runtime.profileNotes = notes;
    runtime.profileRelated = related;
    runtime.profileCollections = memberships;
    const writable = can('products.write');
    openModal(`
      <span class="admin-eyebrow">Scent architecture</span>
      <h2>${esc(product.name_en)}</h2>
      <p>Manage the structured note pyramid, best-paired products, and collection membership. Narrative profile fields remain in the main product editor.</p>
      <div class="admin-profile-management-grid">
        <section class="admin-inline-panel">
          <div class="admin-panel-heading"><div><h3>Fragrance notes</h3></div>${writable ? '<button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.openProductNoteForm()">Add note</button>' : ''}</div>
          ${notes.length ? `<div class="admin-activity-list">${notes.map((row, rowIndex) => {
            const note = row.fragrance_notes || {};
            return `<div class="admin-status-row"><span class="admin-status-chip ${attr(row.phase)}">${esc(titleCase(row.phase))}</span><div><strong>${esc(note.name_en || row.note_id)}</strong><small>${esc(note.family || 'Family not set')} · Position ${esc(formatNumber(row.sort_order, 0))}</small></div>${writable ? `<div class="admin-row-menu"><button type="button" onclick="ASMRSAMRAdmin.openProductNoteForm(${rowIndex})">Edit</button><button type="button" class="danger" onclick="ASMRSAMRAdmin.deleteProductNote(${rowIndex})">Delete</button></div>` : ''}</div>`;
          }).join('')}</div>` : '<p class="admin-empty">No structured fragrance notes yet.</p>'}
        </section>
        <section class="admin-inline-panel">
          <div class="admin-panel-heading"><div><h3>Best paired with</h3></div>${writable ? '<button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.openRelatedProductForm()">Add pairing</button>' : ''}</div>
          ${related.length ? `<div class="admin-activity-list">${related.map((row, rowIndex) => `<div class="admin-status-row"><span class="admin-status-chip">${esc(titleCase(row.relation_type))}</span><div><strong>${esc((row.products && row.products.name_en) || row.related_product_id)}</strong><small>Position ${esc(formatNumber(row.sort_order, 0))}</small></div>${writable ? `<div class="admin-row-menu"><button type="button" onclick="ASMRSAMRAdmin.openRelatedProductForm(${rowIndex})">Edit</button><button type="button" class="danger" onclick="ASMRSAMRAdmin.deleteRelatedProduct(${rowIndex})">Delete</button></div>` : ''}</div>`).join('')}</div>` : '<p class="admin-empty">No related products yet.</p>'}
        </section>
        <section class="admin-inline-panel">
          <div class="admin-panel-heading"><div><h3>Collections</h3></div>${writable ? '<button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.openCollectionMembershipForm()">Add collection</button>' : ''}</div>
          ${memberships.length ? `<div class="admin-activity-list">${memberships.map((row, rowIndex) => `<div class="admin-status-row"><span class="admin-status-chip">Collection</span><div><strong>${esc((row.product_collections && row.product_collections.name_en) || row.collection_id)}</strong><small>Position ${esc(formatNumber(row.sort_order, 0))}</small></div>${writable ? `<div class="admin-row-menu"><button type="button" onclick="ASMRSAMRAdmin.openCollectionMembershipForm(${rowIndex})">Edit</button><button type="button" class="danger" onclick="ASMRSAMRAdmin.deleteCollectionMembership(${rowIndex})">Delete</button></div>` : ''}</div>`).join('')}</div>` : '<p class="admin-empty">This product is not assigned to a collection.</p>'}
        </section>
      </div>
      <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.closeModal()">Close</button></div>
    `, `Scent profile for ${product.name_en}`);
  }

  async function openProductNoteForm(index) {
    const row = Number.isInteger(index) ? runtime.profileNotes[index] : null;
    runtime.productNoteIndex = Number.isInteger(index) ? index : -1;
    const notes = await safeRows('fragrance_notes?select=id,name_en,family&order=name_en.asc');
    openModal(`
      <span class="admin-eyebrow">Note pyramid</span><h2>${esc(runtime.profileProduct.name_en)}</h2>
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.saveProductNote(event)">
        <div class="admin-editor-grid">
          <label><span>Fragrance note *</span><select name="note_id" required><option value="">Select note</option>${notes.map((note) => `<option value="${attr(note.id)}" ${row && row.note_id === note.id ? 'selected' : ''}>${esc(note.name_en)}${note.family ? ` · ${esc(note.family)}` : ''}</option>`).join('')}</select></label>
          <label><span>Phase *</span><select name="phase" required>${choices(['top', 'heart', 'base', 'profile']).map(([value, label]) => `<option value="${value}" ${row && row.phase === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
          <label><span>Sort order</span><input name="sort_order" type="number" min="0" step="1" value="${attr(row ? row.sort_order : runtime.profileNotes.length)}"></label>
        </div>
        <p class="admin-form-error" id="admin-product-note-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.showProductProfile()">Cancel</button><button type="submit" class="admin-primary-btn">Save note</button></div>
      </form>
    `, row ? 'Edit fragrance note' : 'Add fragrance note');
  }

  async function saveProductNote(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const existing = runtime.productNoteIndex >= 0 ? runtime.profileNotes[runtime.productNoteIndex] : null;
    const payload = { product_id: runtime.profileProduct.id, note_id: String(data.get('note_id') || ''), phase: String(data.get('phase') || ''), sort_order: Number(data.get('sort_order')) || 0 };
    const errorNode = document.getElementById('admin-product-note-error');
    if (!payload.note_id || !payload.phase) return;
    try {
      if (existing) {
        await db(`product_fragrance_notes?product_id=eq.${encodeURIComponent(existing.product_id)}&note_id=eq.${encodeURIComponent(existing.note_id)}&phase=eq.${encodeURIComponent(existing.phase)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      }
      await db('product_fragrance_notes', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: payload });
      announce('Fragrance note saved.');
      await showProductProfile();
    } catch (error) {
      if (errorNode) { errorNode.hidden = false; errorNode.textContent = errorMessage(error); }
    }
  }

  function deleteProductNote(index) {
    const row = runtime.profileNotes[index];
    if (!row) return;
    confirmAction({ title: 'Delete fragrance note', message: 'This note will be removed from the product pyramid.', confirmLabel: 'Delete note', danger: true,
      action: () => db(`product_fragrance_notes?product_id=eq.${encodeURIComponent(row.product_id)}&note_id=eq.${encodeURIComponent(row.note_id)}&phase=eq.${encodeURIComponent(row.phase)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
      success: 'Fragrance note removed.' });
  }

  async function openRelatedProductForm(index) {
    const row = Number.isInteger(index) ? runtime.profileRelated[index] : null;
    runtime.relatedProductIndex = Number.isInteger(index) ? index : -1;
    const products = await safeRows(`products?id=neq.${encodeURIComponent(runtime.profileProduct.id)}&select=id,name_en&deleted_at=is.null&order=name_en.asc`);
    openModal(`
      <span class="admin-eyebrow">Product relationship</span><h2>${esc(runtime.profileProduct.name_en)}</h2>
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.saveRelatedProduct(event)">
        <div class="admin-editor-grid">
          <label><span>Related product *</span><select name="related_product_id" required><option value="">Select product</option>${products.map((product) => `<option value="${attr(product.id)}" ${row && row.related_product_id === product.id ? 'selected' : ''}>${esc(product.name_en)}</option>`).join('')}</select></label>
          <label><span>Relationship *</span><select name="relation_type" required>${choices(['paired_with', 'alternative', 'accessory', 'layering']).map(([value, label]) => `<option value="${value}" ${row && row.relation_type === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
          <label><span>Sort order</span><input name="sort_order" type="number" min="0" step="1" value="${attr(row ? row.sort_order : runtime.profileRelated.length)}"></label>
        </div>
        <p class="admin-form-error" id="admin-related-product-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.showProductProfile()">Cancel</button><button type="submit" class="admin-primary-btn">Save pairing</button></div>
      </form>
    `, row ? 'Edit related product' : 'Add related product');
  }

  async function saveRelatedProduct(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const existing = runtime.relatedProductIndex >= 0 ? runtime.profileRelated[runtime.relatedProductIndex] : null;
    const payload = { product_id: runtime.profileProduct.id, related_product_id: String(data.get('related_product_id') || ''), relation_type: String(data.get('relation_type') || ''), sort_order: Number(data.get('sort_order')) || 0 };
    const errorNode = document.getElementById('admin-related-product-error');
    try {
      if (existing) {
        await db(`related_products?product_id=eq.${encodeURIComponent(existing.product_id)}&related_product_id=eq.${encodeURIComponent(existing.related_product_id)}&relation_type=eq.${encodeURIComponent(existing.relation_type)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      }
      await db('related_products', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: payload });
      announce('Related product saved.');
      await showProductProfile();
    } catch (error) { if (errorNode) { errorNode.hidden = false; errorNode.textContent = errorMessage(error); } }
  }

  function deleteRelatedProduct(index) {
    const row = runtime.profileRelated[index];
    if (!row) return;
    confirmAction({ title: 'Delete product relationship', message: 'The pairing will be removed without changing either product.', confirmLabel: 'Delete pairing', danger: true,
      action: () => db(`related_products?product_id=eq.${encodeURIComponent(row.product_id)}&related_product_id=eq.${encodeURIComponent(row.related_product_id)}&relation_type=eq.${encodeURIComponent(row.relation_type)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
      success: 'Product relationship removed.' });
  }

  async function openCollectionMembershipForm(index) {
    const row = Number.isInteger(index) ? runtime.profileCollections[index] : null;
    runtime.collectionMembershipIndex = Number.isInteger(index) ? index : -1;
    const collections = await safeRows('product_collections?select=id,name_en&is_active=eq.true&archived_at=is.null&order=name_en.asc');
    openModal(`
      <span class="admin-eyebrow">Collection membership</span><h2>${esc(runtime.profileProduct.name_en)}</h2>
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.saveCollectionMembership(event)">
        <div class="admin-editor-grid"><label><span>Collection *</span><select name="collection_id" required><option value="">Select collection</option>${collections.map((collection) => `<option value="${attr(collection.id)}" ${row && row.collection_id === collection.id ? 'selected' : ''}>${esc(collection.name_en)}</option>`).join('')}</select></label><label><span>Sort order</span><input name="sort_order" type="number" min="0" step="1" value="${attr(row ? row.sort_order : runtime.profileCollections.length)}"></label></div>
        <p class="admin-form-error" id="admin-collection-membership-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.showProductProfile()">Cancel</button><button type="submit" class="admin-primary-btn">Save collection</button></div>
      </form>
    `, row ? 'Edit collection membership' : 'Add collection membership');
  }

  async function saveCollectionMembership(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const existing = runtime.collectionMembershipIndex >= 0 ? runtime.profileCollections[runtime.collectionMembershipIndex] : null;
    const payload = { product_id: runtime.profileProduct.id, collection_id: String(data.get('collection_id') || ''), sort_order: Number(data.get('sort_order')) || 0 };
    const errorNode = document.getElementById('admin-collection-membership-error');
    try {
      if (existing && existing.collection_id !== payload.collection_id) {
        await db(`product_collection_items?product_id=eq.${encodeURIComponent(existing.product_id)}&collection_id=eq.${encodeURIComponent(existing.collection_id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      }
      await db('product_collection_items?on_conflict=collection_id,product_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: payload });
      announce('Collection membership saved.');
      await showProductProfile();
    } catch (error) { if (errorNode) { errorNode.hidden = false; errorNode.textContent = errorMessage(error); } }
  }

  function deleteCollectionMembership(index) {
    const row = runtime.profileCollections[index];
    if (!row) return;
    confirmAction({ title: 'Remove from collection', message: 'The product will be removed from this collection only.', confirmLabel: 'Remove', danger: true,
      action: () => db(`product_collection_items?product_id=eq.${encodeURIComponent(row.product_id)}&collection_id=eq.${encodeURIComponent(row.collection_id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
      success: 'Product removed from collection.' });
  }

  async function duplicateProduct(index) {
    const product = runtime.rows.products[index];
    if (!product || !can('products.write')) return;
    const id = `${product.id}-copy-${Date.now().toString().slice(-6)}`;
    const allowed = [
      'brand', 'name_en', 'name_ar', 'type', 'family_en', 'family_ar', 'desc_en', 'desc_ar',
      'badge_en', 'badge_ar', 'hero_size', 'image_webp', 'image_png', 'category_id',
      'gender_identity', 'concentration', 'cost', 'tax_rate', 'availability',
      'notes', 'ingredients_summary', 'scent_profile', 'who_it_is_for', 'how_to_wear',
      'longevity', 'gift_ready_message', 'seo_title', 'seo_description', 'sort_order'
    ];
    const copy = { id, status: 'draft', is_active: false, featured_on_home: false, created_by: runtime.profile.id };
    allowed.forEach((key) => {
      if (product[key] !== undefined) copy[key] = product[key];
    });
    copy.name_en = `${product.name_en} Copy`;
    copy.sku = null;
    copy.barcode = null;
    try {
      setBusy(true);
      await db('products', { method: 'POST', headers: { Prefer: 'return=representation' }, body: copy });
      const prices = Array.isArray(product.product_prices) ? product.product_prices : [];
      if (prices.length) {
        await db('product_prices', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: prices.map((price) => ({ product_id: id, size: price.size, price: price.price }))
        });
      }
      const variants = await safeRows(`product_variants?product_id=eq.${encodeURIComponent(product.id)}&select=*&archived_at=is.null`);
      if (variants.length) {
        await db('product_variants', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: variants.map((variant) => ({
            product_id: id,
            name: variant.name,
            size: variant.size,
            concentration: variant.concentration,
            price: variant.price,
            cost: variant.cost,
            tax_rate: variant.tax_rate,
            stock: 0,
            low_stock_at: variant.low_stock_at,
            is_default: variant.is_default,
            is_active: false,
            sort_order: variant.sort_order
          }))
        });
      }
      announce('Draft product duplicate created. Add unique SKU, barcode, and photos before publishing.');
      await loadGeneric(CONFIGS.products);
    } catch (error) {
      announce(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function toggleProductPublish(index) {
    const product = runtime.rows.products[index];
    if (!product || !can('products.write')) return;
    const publishing = product.status !== 'published';
    try {
      await db(`products?id=eq.${encodeURIComponent(product.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: {
          status: publishing ? 'published' : 'unpublished',
          is_active: publishing,
          published_at: publishing ? new Date().toISOString() : null,
          updated_by: runtime.profile.id
        }
      });
      announce(publishing ? 'Product published.' : 'Product unpublished.');
      await loadGeneric(CONFIGS.products);
    } catch (error) {
      announce(errorMessage(error), 'error');
    }
  }

  async function openProductAdjustment(index) {
    const row = runtime.rows['product-inventory'] && runtime.rows['product-inventory'][index];
    if (!row || !can('inventory.write')) return;
    const [variants, locations] = await Promise.all([
      safeRows(`product_variants?product_id=eq.${encodeURIComponent(row.product_id)}&select=id,name,size&is_active=eq.true&archived_at=is.null&order=sort_order.asc`),
      safeRows('inventory_locations?select=id,name,code,is_default&is_active=eq.true&order=name.asc')
    ]);
    runtime.stockProduct = row;
    openModal(`
      <span class="admin-eyebrow">Controlled stock movement</span>
      <h2>${esc(row.name_en)}</h2>
      <p>Current stock: <strong>${esc(formatNumber(row.stock))}</strong>. Direct stock edits are blocked; this action records the reason, actor, result, and location.</p>
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.saveProductAdjustment(event)">
        <div class="admin-editor-grid">
          <label><span>Movement type *</span><select name="movement_type" required>
            ${choices(['add', 'purchase', 'returned', 'remove', 'damaged', 'expired', 'lost', 'sampled', 'reserved', 'released', 'adjustment', 'transfer']).map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join('')}
          </select></label>
          <label><span>Quantity *</span><input name="quantity" type="number" step="1" required min="1"></label>
          <label><span>Variant</span><select name="variant_id"><option value="">Base product</option>
            ${variants.map((variant) => `<option value="${attr(variant.id)}">${esc(variant.name)} ${esc(variant.size || '')}</option>`).join('')}
          </select></label>
          <label><span>Location</span><select name="location_id"><option value="">Default location</option>
            ${locations.map((location) => `<option value="${attr(location.id)}">${esc(location.name)}${location.is_default ? ' · Default' : ''}</option>`).join('')}
          </select></label>
          <label><span>Transfer from</span><select name="from_location_id"><option value="">Select when transferring</option>
            ${locations.map((location) => `<option value="${attr(location.id)}">${esc(location.name)}</option>`).join('')}
          </select></label>
          <label><span>Transfer to</span><select name="to_location_id"><option value="">Select when transferring</option>
            ${locations.map((location) => `<option value="${attr(location.id)}">${esc(location.name)}</option>`).join('')}
          </select></label>
          <label class="admin-editor-wide"><span>Reason *</span><textarea name="reason" rows="3" required maxlength="500"></textarea></label>
          ${runtime.profile.role === 'admin' ? `<label class="admin-editor-wide"><span>Administrator override</span><input type="checkbox" name="allow_negative"> Allow negative stock only when the physical count requires it</label>` : ''}
        </div>
        <p class="admin-form-error" id="admin-stock-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.closeModal()">Cancel</button><button type="submit" class="admin-primary-btn">Record movement</button></div>
      </form>
    `, 'Adjust product stock');
  }

  async function saveProductAdjustment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const type = String(data.get('movement_type'));
    const rawQuantity = Math.abs(Math.trunc(Number(data.get('quantity')) || 0));
    const negativeTypes = new Set(['remove', 'damaged', 'expired', 'lost', 'sampled', 'reserved']);
    const positiveTypes = new Set(['add', 'purchase', 'returned', 'released']);
    let quantity = rawQuantity;
    if (negativeTypes.has(type)) quantity = -rawQuantity;
    if (type === 'adjustment') quantity = Math.trunc(Number(data.get('quantity')) || 0);
    const fromLocation = String(data.get('from_location_id') || '');
    const toLocation = String(data.get('to_location_id') || '');
    const location = String(data.get('location_id') || '');
    const errorNode = document.getElementById('admin-stock-error');
    if (!quantity || !String(data.get('reason') || '').trim()) return;
    if (type === 'transfer' && (!fromLocation || !toLocation || fromLocation === toLocation)) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = 'A transfer requires two different locations.';
      }
      return;
    }
    try {
      setBusy(true);
      await rpc('adjust_product_stock', {
        p_product_id: runtime.stockProduct.product_id,
        p_quantity_delta: positiveTypes.has(type) ? Math.abs(quantity) : quantity,
        p_movement_type: type,
        p_reason: String(data.get('reason')).trim(),
        p_variant_id: String(data.get('variant_id') || '') || null,
        p_from_location_id: type === 'transfer' ? fromLocation : (quantity < 0 ? location || null : null),
        p_to_location_id: type === 'transfer' ? toLocation : (quantity > 0 ? location || null : null),
        p_allow_negative: Boolean(form.elements.allow_negative && form.elements.allow_negative.checked)
      });
      closeModal();
      announce('Product stock movement recorded.');
      await reloadCurrentPage();
    } catch (error) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = errorMessage(error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function openProductHistory(index) {
    const row = runtime.rows['product-inventory'] && runtime.rows['product-inventory'][index];
    if (!row) return;
    const movements = await safeRows(`product_stock_movements?product_id=eq.${encodeURIComponent(row.product_id)}&select=*&order=created_at.desc&limit=200`);
    openModal(`
      <span class="admin-eyebrow">Movement history</span>
      <h2>${esc(row.name_en)}</h2>
      <div class="admin-data-table-wrap">
        ${movements.length ? `
          <table class="admin-data-table">
            <thead><tr><th>Date</th><th>Type</th><th>Change</th><th>Result</th><th>Reason</th><th>Actor</th></tr></thead>
            <tbody>${movements.map((movement) => `
              <tr>
                <td data-label="Date">${esc(formatDate(movement.created_at))}</td>
                <td data-label="Type">${esc(titleCase(movement.movement_type))}</td>
                <td data-label="Change">${esc(formatNumber(movement.quantity_delta))}</td>
                <td data-label="Result">${esc(formatNumber(movement.resulting_stock))}</td>
                <td data-label="Reason">${esc(movement.reason)}</td>
                <td data-label="Actor">${esc(movement.created_by || 'System')}</td>
              </tr>
            `).join('')}</tbody>
          </table>
        ` : emptyState('No movement history', 'No stock movement has been recorded for this product.')}
      </div>
    `, 'Product stock history');
  }

  function ingredientFromRows(key, index) {
    const row = runtime.rows[key] && runtime.rows[key][index];
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      internal_code: row.internal_code,
      quantity_available: row.quantity_available,
      unit: row.unit
    };
  }

  function openIngredientAdjustment(index) {
    return prepareIngredientAdjustment(ingredientFromRows('ingredients', index));
  }

  function openIngredientSummaryAdjustment(index) {
    return prepareIngredientAdjustment(ingredientFromRows('ingredient-stock-levels', index));
  }

  async function prepareIngredientAdjustment(ingredient) {
    if (!ingredient || !can('ingredients.write')) return;
    const [lots, locations] = await Promise.all([
      safeRows(`ingredient_lots?ingredient_id=eq.${encodeURIComponent(ingredient.id)}&select=id,lot_number,quantity_available,status&status=in.(available,released,quarantined)&order=created_at.desc`),
      safeRows('inventory_locations?select=id,name,code,is_default&is_active=eq.true&order=name.asc')
    ]);
    runtime.stockIngredient = ingredient;
    openModal(`
      <span class="admin-eyebrow">Controlled ingredient movement</span>
      <h2>${esc(ingredient.name)}</h2>
      <p>Current stock: <strong>${esc(formatNumber(ingredient.quantity_available, 4))} ${esc(ingredient.unit)}</strong>. Every change creates an immutable movement record.</p>
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.saveIngredientAdjustment(event)">
        <div class="admin-editor-grid">
          <label><span>Movement type *</span><select name="movement_type" required>
            ${choices(['purchase', 'return', 'correction', 'consume', 'waste', 'damage', 'sample', 'trial', 'transfer']).map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join('')}
          </select></label>
          <label><span>Quantity *</span><input name="quantity" type="number" min="0.0001" step="0.0001" required></label>
          <label><span>Lot</span><select name="lot_id"><option value="">No lot</option>
            ${lots.map((lot) => `<option value="${attr(lot.id)}">${esc(lot.lot_number)} · ${esc(formatNumber(lot.quantity_available, 4))}</option>`).join('')}
          </select></label>
          <label><span>Location</span><select name="location_id"><option value="">Not assigned</option>
            ${locations.map((location) => `<option value="${attr(location.id)}">${esc(location.name)}</option>`).join('')}
          </select></label>
          <label><span>Reference type</span><input name="reference_type" maxlength="80"></label>
          <label><span>Reference ID</span><input name="reference_id" maxlength="160"></label>
          <label class="admin-editor-wide"><span>Reason *</span><textarea name="reason" rows="3" required maxlength="500"></textarea></label>
          ${runtime.profile.role === 'admin' ? `<label class="admin-editor-wide"><span>Administrator override</span><input type="checkbox" name="allow_negative"> Permit negative stock only for a documented physical correction</label>` : ''}
        </div>
        <p class="admin-form-error" id="admin-ingredient-stock-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.closeModal()">Cancel</button><button type="submit" class="admin-primary-btn">Record movement</button></div>
      </form>
    `, 'Adjust ingredient stock');
  }

  async function saveIngredientAdjustment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const type = String(data.get('movement_type'));
    const negative = new Set(['consume', 'waste', 'damage', 'sample', 'trial', 'transfer']);
    let quantity = Math.abs(Number(data.get('quantity')) || 0);
    if (negative.has(type)) quantity *= -1;
    const errorNode = document.getElementById('admin-ingredient-stock-error');
    if (!quantity || !String(data.get('reason') || '').trim()) return;
    try {
      setBusy(true);
      await rpc('adjust_ingredient_stock', {
        p_ingredient_id: runtime.stockIngredient.id,
        p_quantity_delta: quantity,
        p_movement_type: type,
        p_reason: String(data.get('reason')).trim(),
        p_lot_id: String(data.get('lot_id') || '') || null,
        p_location_id: String(data.get('location_id') || '') || null,
        p_reference_type: String(data.get('reference_type') || '').trim() || null,
        p_reference_id: String(data.get('reference_id') || '').trim() || null,
        p_allow_negative: Boolean(form.elements.allow_negative && form.elements.allow_negative.checked)
      });
      closeModal();
      announce('Ingredient stock movement recorded.');
      await reloadCurrentPage();
    } catch (error) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = errorMessage(error);
      }
    } finally {
      setBusy(false);
    }
  }

  function openIngredientHistory(index) {
    const ingredient = ingredientFromRows('ingredients', index);
    return showIngredientHistory(ingredient);
  }

  async function showIngredientHistory(ingredient) {
    if (!ingredient) return;
    const rows = await safeRows(`ingredient_stock_movements?ingredient_id=eq.${encodeURIComponent(ingredient.id)}&select=*&order=created_at.desc&limit=250`);
    openModal(`
      <span class="admin-eyebrow">Movement history</span>
      <h2>${esc(ingredient.name)}</h2>
      <div class="admin-data-table-wrap">
        ${rows.length ? `
          <table class="admin-data-table"><thead><tr><th>Date</th><th>Type</th><th>Change</th><th>Result</th><th>Cost</th><th>Reason</th></tr></thead>
          <tbody>${rows.map((row) => `
            <tr><td data-label="Date">${esc(formatDate(row.created_at))}</td><td data-label="Type">${esc(titleCase(row.movement_type))}</td><td data-label="Change">${esc(formatNumber(row.quantity_delta, 4))}</td><td data-label="Result">${esc(formatNumber(row.resulting_quantity, 4))}</td><td data-label="Cost">${esc(formatMoney(row.unit_cost))}</td><td data-label="Reason">${esc(row.reason)}</td></tr>
          `).join('')}</tbody></table>
        ` : emptyState('No ingredient movements', 'No stock movements have been recorded for this ingredient.')}
      </div>
    `, 'Ingredient stock history');
  }

  async function openOrderItems(index) {
    const order = runtime.rows.orders && runtime.rows.orders[index];
    if (!order) return;
    runtime.order = order;
    runtime.orderItems = await safeRows(`order_items?order_id=eq.${encodeURIComponent(order.id)}&select=*&order=id.asc`);
    const writable = can('orders.write') && !['delivered', 'cancelled'].includes(order.status);
    const lineValue = runtime.orderItems.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unit_price) || 0), 0);
    openModal(`
      <span class="admin-eyebrow">Order details</span>
      <h2>${esc(order.order_no)}</h2>
      <div class="admin-panel-heading">
        <p>Line items are recalculated in the database with Saudi VAT after every authorized change.</p>
        ${writable ? '<button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.openOrderItemForm()">Add item</button>' : ''}
      </div>
      <div class="admin-kpi-grid admin-kpi-grid-compact">
        ${kpi('Subtotal', formatMoney(order.subtotal), `${runtime.orderItems.length} lines`, 'sand')}
        ${kpi('VAT', formatMoney(order.vat), '15% standard rate', 'stone')}
        ${kpi('Total', formatMoney(order.total), `${formatMoney(lineValue)} item value`, 'gold')}
      </div>
      <div class="admin-data-table-wrap">
        ${runtime.orderItems.length ? `
          <table class="admin-data-table">
            <thead><tr><th>Product</th><th>Size</th><th>Qty</th><th>Unit price</th><th>Line total</th><th></th></tr></thead>
            <tbody>${runtime.orderItems.map((item, itemIndex) => `
              <tr>
                <td data-label="Product">${esc(item.name_en || item.product_id || 'Custom item')}</td>
                <td data-label="Size">${esc(item.size || 'Not set')}</td>
                <td data-label="Qty">${esc(formatNumber(item.qty, 0))}</td>
                <td data-label="Unit price">${esc(formatMoney(item.unit_price))}</td>
                <td data-label="Line total">${esc(formatMoney((Number(item.qty) || 0) * (Number(item.unit_price) || 0)))}</td>
                <td data-label="Actions"><div class="admin-row-menu">${writable ? `<button type="button" onclick="ASMRSAMRAdmin.openOrderItemForm(${itemIndex})">Edit</button><button type="button" class="danger" onclick="ASMRSAMRAdmin.deleteOrderItem(${itemIndex})">Delete</button>` : ''}</div></td>
              </tr>`).join('')}</tbody>
          </table>
        ` : emptyState('No order items', 'Add the products included in this order.')}
      </div>
      <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.closeModal()">Close</button></div>
    `, `Items for ${order.order_no}`);
  }

  async function openOrderItemForm(index) {
    const item = Number.isInteger(index) ? runtime.orderItems[index] : null;
    runtime.orderItemIndex = Number.isInteger(index) ? index : -1;
    const products = await safeRows('products?select=id,name_en&deleted_at=is.null&order=name_en.asc');
    openModal(`
      <span class="admin-eyebrow">${item ? 'Update line' : 'New line'}</span>
      <h2>${esc(runtime.order.order_no)}</h2>
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.saveOrderItem(event)" novalidate>
        <div class="admin-editor-grid">
          <label><span>Product</span><select name="product_id"><option value="">Custom item</option>${products.map((product) => `<option value="${attr(product.id)}" ${item && item.product_id === product.id ? 'selected' : ''}>${esc(product.name_en)}</option>`).join('')}</select></label>
          <label><span>Display name</span><input name="name_en" maxlength="180" value="${attr(item ? item.name_en || '' : '')}"></label>
          <label><span>Size</span><input name="size" maxlength="80" value="${attr(item ? item.size || '' : '')}"></label>
          <label><span>Quantity *</span><input name="qty" type="number" min="1" max="100" step="1" required value="${attr(item ? item.qty : 1)}"></label>
          <label><span>Unit price *</span><input name="unit_price" type="number" min="0" step="0.01" required value="${attr(item ? item.unit_price : 0)}"></label>
        </div>
        <p class="admin-form-error" id="admin-order-item-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.openOrderItems(${runtime.rows.orders.findIndex((row) => row.id === runtime.order.id)})">Cancel</button><button type="submit" class="admin-primary-btn">Save item</button></div>
      </form>
    `, item ? 'Edit order item' : 'Add order item');
  }

  async function saveOrderItem(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const existing = runtime.orderItemIndex >= 0 ? runtime.orderItems[runtime.orderItemIndex] : null;
    const productId = String(data.get('product_id') || '').trim();
    const products = productId ? await safeRows(`products?id=eq.${encodeURIComponent(productId)}&select=id,name_en`) : [];
    const payload = {
      order_id: runtime.order.id,
      product_id: productId || null,
      name_en: String(data.get('name_en') || '').trim() || (products[0] && products[0].name_en) || null,
      size: String(data.get('size') || '').trim() || null,
      qty: Number(data.get('qty')),
      unit_price: Number(data.get('unit_price'))
    };
    const errorNode = document.getElementById('admin-order-item-error');
    if (!Number.isInteger(payload.qty) || payload.qty < 1 || payload.qty > 100 || !Number.isFinite(payload.unit_price) || payload.unit_price < 0) {
      if (errorNode) { errorNode.hidden = false; errorNode.textContent = 'Enter a quantity from 1 to 100 and a valid non-negative unit price.'; }
      return;
    }
    try {
      setBusy(true);
      if (existing) {
        await db(`order_items?id=eq.${encodeURIComponent(existing.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: payload });
      } else {
        await db('order_items', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: payload });
      }
      await rpc('recalculate_order_totals', { p_order_id: runtime.order.id });
      announce('Order item saved and totals recalculated.');
      await loadGeneric(CONFIGS.orders);
      await openOrderItems(runtime.rows.orders.findIndex((row) => row.id === runtime.order.id));
    } catch (error) {
      if (errorNode) { errorNode.hidden = false; errorNode.textContent = errorMessage(error); }
    } finally {
      setBusy(false);
    }
  }

  function deleteOrderItem(index) {
    const item = runtime.orderItems[index];
    if (!item) return;
    confirmAction({
      title: 'Delete order item',
      message: 'The line will be removed and the order totals will be recalculated in the database.',
      confirmLabel: 'Delete item', danger: true,
      action: async () => {
        await db(`order_items?id=eq.${encodeURIComponent(item.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        await rpc('recalculate_order_totals', { p_order_id: runtime.order.id });
      },
      success: 'Order item deleted and totals recalculated.'
    });
  }

  async function openPurchaseItems(index) {
    const order = runtime.rows['purchase-orders'] && runtime.rows['purchase-orders'][index];
    if (!order) return;
    runtime.purchaseOrder = order;
    runtime.purchaseItems = await safeRows(`purchase_order_items?purchase_order_id=eq.${encodeURIComponent(order.id)}&select=*&order=id.asc`);
    const editable = can('purchasing.write') && ['draft', 'submitted', 'approved', 'partially_received'].includes(order.status);
    openModal(`
      <span class="admin-eyebrow">Purchase order lines</span>
      <h2>${esc(order.order_number)}</h2>
      <div class="admin-panel-heading">
        <p>Line quantities, received amount, cost, and tax determine the purchase-order total.</p>
        ${editable ? '<button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.openPurchaseItemForm()">Add item</button>' : ''}
      </div>
      <div class="admin-data-table-wrap">
        ${runtime.purchaseItems.length ? `
          <table class="admin-data-table"><thead><tr><th>Description</th><th>Quantity</th><th>Received</th><th>Unit cost</th><th>Tax</th><th></th></tr></thead>
          <tbody>${runtime.purchaseItems.map((item, itemIndex) => `
            <tr>
              <td data-label="Description">${esc(item.description || item.ingredient_id || 'Item')}</td>
              <td data-label="Quantity">${esc(formatNumber(item.quantity, 4))} ${esc(item.unit)}</td>
              <td data-label="Received">${esc(formatNumber(item.received_quantity, 4))}</td>
              <td data-label="Unit cost">${esc(formatMoney(item.unit_cost))}</td>
              <td data-label="Tax">${esc(`${formatNumber((Number(item.tax_rate) || 0) * 100, 2)}%`)}</td>
              <td data-label="Actions"><div class="admin-row-menu">${editable ? `<button type="button" onclick="ASMRSAMRAdmin.openPurchaseItemForm(${itemIndex})">Edit</button><button type="button" class="danger" onclick="ASMRSAMRAdmin.deletePurchaseItem(${itemIndex})">Delete</button>` : ''}</div></td>
            </tr>
          `).join('')}</tbody></table>
        ` : emptyState('No purchase items', 'Add ingredients or packaging materials to this purchase order.')}
      </div>
      <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.closeModal()">Close</button></div>
    `, `Items for ${order.order_number}`);
  }

  async function openPurchaseItemForm(index) {
    const item = Number.isInteger(index) ? runtime.purchaseItems[index] : null;
    const ingredients = await safeRows('ingredients?select=id,name,internal_code,unit&status=eq.active&archived_at=is.null&order=name.asc');
    runtime.purchaseItemIndex = Number.isInteger(index) ? index : -1;
    openModal(`
      <span class="admin-eyebrow">${item ? 'Edit purchase item' : 'New purchase item'}</span>
      <h2>${esc(runtime.purchaseOrder.order_number)}</h2>
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.savePurchaseItem(event)">
        <div class="admin-editor-grid">
          <label><span>Ingredient</span><select name="ingredient_id"><option value="">Other item</option>
            ${ingredients.map((ingredient) => `<option value="${attr(ingredient.id)}" ${item && item.ingredient_id === ingredient.id ? 'selected' : ''}>${esc(ingredient.internal_code)} · ${esc(ingredient.name)}</option>`).join('')}
          </select></label>
          <label><span>Description</span><input name="description" value="${attr(item && item.description)}" maxlength="300"></label>
          <label><span>Quantity *</span><input name="quantity" type="number" min="0.0001" step="0.0001" value="${attr(item && item.quantity)}" required></label>
          <label><span>Unit *</span><input name="unit" value="${attr(item ? item.unit : 'g')}" required maxlength="20"></label>
          <label><span>Unit cost *</span><input name="unit_cost" type="number" min="0" step="0.000001" value="${attr(item ? item.unit_cost : 0)}" required></label>
          <label><span>Tax rate</span><input name="tax_rate" type="number" min="0" step="0.0001" value="${attr(item ? item.tax_rate : 0.15)}"></label>
          <label><span>Received quantity</span><input name="received_quantity" type="number" min="0" step="0.0001" value="${attr(item ? item.received_quantity : 0)}"></label>
        </div>
        <p class="admin-form-error" id="admin-po-item-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.openPurchaseItems(${runtime.rows['purchase-orders'].findIndex((row) => row.id === runtime.purchaseOrder.id)})">Cancel</button><button type="submit" class="admin-primary-btn">Save item</button></div>
      </form>
    `, item ? 'Edit purchase item' : 'Add purchase item');
  }

  async function updatePurchaseOrderTotals() {
    const items = await safeRows(`purchase_order_items?purchase_order_id=eq.${encodeURIComponent(runtime.purchaseOrder.id)}&select=quantity,unit_cost,tax_rate`);
    const subtotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_cost), 0);
    const tax = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_cost) * Number(item.tax_rate || 0), 0);
    const shipping = Number(runtime.purchaseOrder.shipping) || 0;
    await db(`purchase_orders?id=eq.${encodeURIComponent(runtime.purchaseOrder.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: { subtotal: Number(subtotal.toFixed(2)), tax: Number(tax.toFixed(2)), total: Number((subtotal + tax + shipping).toFixed(2)) }
    });
  }

  async function savePurchaseItem(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const existing = runtime.purchaseItemIndex >= 0 ? runtime.purchaseItems[runtime.purchaseItemIndex] : null;
    const quantity = Number(data.get('quantity'));
    const received = Number(data.get('received_quantity')) || 0;
    const payload = {
      purchase_order_id: runtime.purchaseOrder.id,
      ingredient_id: String(data.get('ingredient_id') || '') || null,
      description: String(data.get('description') || '').trim() || null,
      quantity,
      unit: String(data.get('unit') || '').trim(),
      unit_cost: Number(data.get('unit_cost')) || 0,
      tax_rate: Number(data.get('tax_rate')) || 0,
      received_quantity: received
    };
    const errorNode = document.getElementById('admin-po-item-error');
    if (!quantity || received > quantity || (!payload.ingredient_id && !payload.description)) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = 'Provide an ingredient or description, and keep received quantity within the ordered quantity.';
      }
      return;
    }
    try {
      if (existing) {
        await db(`purchase_order_items?id=eq.${existing.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: payload });
      } else {
        await db('purchase_order_items', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: payload });
      }
      await updatePurchaseOrderTotals();
      announce('Purchase-order item saved.');
      await openPurchaseItems(runtime.rows['purchase-orders'].findIndex((row) => row.id === runtime.purchaseOrder.id));
    } catch (error) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = errorMessage(error);
      }
    }
  }

  function deletePurchaseItem(index) {
    const item = runtime.purchaseItems[index];
    if (!item) return;
    confirmAction({
      title: 'Delete purchase-order item',
      message: 'The draft line will be removed and order totals recalculated.',
      confirmLabel: 'Delete item',
      danger: true,
      action: async () => {
        await db(`purchase_order_items?id=eq.${item.id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        await updatePurchaseOrderTotals();
      },
      success: 'Purchase-order item deleted.'
    });
  }

  async function openFormulaVersions(index) {
    const formula = runtime.rows.formulas && runtime.rows.formulas[index];
    if (!formula) return;
    runtime.formula = formula;
    runtime.formulaVersions = await safeRows(`formula_versions?formula_id=eq.${encodeURIComponent(formula.id)}&select=*&order=version_number.desc`);
    const writable = can('production.write');
    openModal(`
      <span class="admin-eyebrow">Sensitive formula history</span>
      <h2>${esc(formula.code)} · ${esc(formula.name)}</h2>
      <div class="admin-panel-heading"><p>Versions preserve their batch reference, concentration, percentage, approval, and change notes.</p>${writable ? '<button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.openFormulaVersionForm()">Add version</button>' : ''}</div>
      <div class="admin-data-table-wrap">
        ${runtime.formulaVersions.length ? `
          <table class="admin-data-table"><thead><tr><th>Version</th><th>Batch size</th><th>Concentration</th><th>Percentage</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>${runtime.formulaVersions.map((version, versionIndex) => `
            <tr>
              <td data-label="Version">v${version.version_number}</td>
              <td data-label="Batch size">${esc(formatNumber(version.reference_batch_size, 4))} ${esc(version.unit)}</td>
              <td data-label="Concentration">${esc(version.concentration || 'Not set')}</td>
              <td data-label="Percentage">${esc(`${formatNumber(version.total_percentage, 4)}%`)}</td>
              <td data-label="Status"><span class="admin-status-chip ${esc(version.status)}">${esc(titleCase(version.status))}</span></td>
              <td data-label="Created">${esc(formatDate(version.created_at))}</td>
              <td data-label="Actions"><div class="admin-row-menu">
                <button type="button" onclick="ASMRSAMRAdmin.openFormulaItems(${versionIndex})">Ingredients</button>
                ${writable && ['draft', 'trial'].includes(version.status) ? `<button type="button" onclick="ASMRSAMRAdmin.approveFormulaVersion(${versionIndex})">Approve</button>` : ''}
              </div></td>
            </tr>
          `).join('')}</tbody></table>
        ` : emptyState('No formula versions', 'Create the first controlled version before planning production.')}
      </div>
    `, `Formula versions for ${formula.code}`);
  }

  function openFormulaVersionForm() {
    const nextVersion = Math.max(0, ...runtime.formulaVersions.map((row) => Number(row.version_number) || 0)) + 1;
    openModal(`
      <span class="admin-eyebrow">New controlled version</span>
      <h2>${esc(runtime.formula.name)}</h2>
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.saveFormulaVersion(event)">
        <div class="admin-editor-grid">
          <label><span>Version number *</span><input name="version_number" type="number" min="1" step="1" value="${nextVersion}" required></label>
          <label><span>Reference batch size *</span><input name="reference_batch_size" type="number" min="0.0001" step="0.0001" required></label>
          <label><span>Unit *</span><input name="unit" value="g" required maxlength="20"></label>
          <label><span>Concentration</span><input name="concentration" maxlength="80"></label>
          <label><span>Total percentage *</span><input name="total_percentage" type="number" min="0.0001" max="100" step="0.0001" value="100" required></label>
          <label><span>Status</span><select name="status"><option value="draft">Draft</option><option value="trial">Trial</option></select></label>
          <label class="admin-editor-wide"><span>Change notes</span><textarea name="change_notes" rows="4" maxlength="3000"></textarea></label>
        </div>
        <p class="admin-form-error" id="admin-formula-version-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.openFormulaVersions(${runtime.rows.formulas.findIndex((row) => row.id === runtime.formula.id)})">Cancel</button><button type="submit" class="admin-primary-btn">Create version</button></div>
      </form>
    `, 'Add formula version');
  }

  async function saveFormulaVersion(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      formula_id: runtime.formula.id,
      version_number: Number(data.get('version_number')),
      reference_batch_size: Number(data.get('reference_batch_size')),
      unit: String(data.get('unit') || '').trim(),
      concentration: String(data.get('concentration') || '').trim() || null,
      total_percentage: Number(data.get('total_percentage')),
      status: String(data.get('status') || 'draft'),
      change_notes: String(data.get('change_notes') || '').trim() || null,
      created_by: runtime.profile.id
    };
    const errorNode = document.getElementById('admin-formula-version-error');
    try {
      await db('formula_versions', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: payload });
      announce('Formula version created.');
      await openFormulaVersions(runtime.rows.formulas.findIndex((row) => row.id === runtime.formula.id));
    } catch (error) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = errorMessage(error);
      }
    }
  }

  async function openFormulaItems(versionIndex) {
    const version = runtime.formulaVersions[versionIndex];
    if (!version) return;
    runtime.formulaVersion = version;
    runtime.formulaItems = await safeRows(`formula_items?formula_version_id=eq.${encodeURIComponent(version.id)}&select=*,ingredients(name,internal_code,unit)&order=sort_order.asc,id.asc`);
    const total = runtime.formulaItems.reduce((sum, row) => sum + (Number(row.percentage) || 0), 0);
    const writable = can('production.write') && ['draft', 'trial'].includes(version.status);
    openModal(`
      <span class="admin-eyebrow">Formula ingredients</span>
      <h2>${esc(runtime.formula.name)} · v${version.version_number}</h2>
      <div class="admin-kpi-grid admin-kpi-grid-compact">
        ${kpi('Formula total', `${formatNumber(total, 4)}%`, `Target ${formatNumber(version.total_percentage, 4)}%`, Math.abs(total - Number(version.total_percentage)) < 0.0001 ? 'green' : 'danger')}
        ${kpi('Ingredients', formatNumber(runtime.formulaItems.length, 0), 'Unique material lines', 'sand')}
      </div>
      <div class="admin-panel-heading"><p>Quantities scale transactionally from this reference version when a production batch is confirmed.</p>${writable ? '<button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.openFormulaItemForm()">Add ingredient</button>' : ''}</div>
      <div class="admin-data-table-wrap">
        ${runtime.formulaItems.length ? `
          <table class="admin-data-table"><thead><tr><th>Ingredient</th><th>Percentage</th><th>Quantity / batch</th><th>Order</th><th></th></tr></thead>
          <tbody>${runtime.formulaItems.map((item, itemIndex) => `
            <tr>
              <td data-label="Ingredient">${esc(item.ingredients ? `${item.ingredients.internal_code} · ${item.ingredients.name}` : item.ingredient_id)}</td>
              <td data-label="Percentage">${esc(`${formatNumber(item.percentage, 6)}%`)}</td>
              <td data-label="Quantity">${esc(formatNumber(item.quantity_per_batch, 6))} ${esc(version.unit)}</td>
              <td data-label="Order">${item.sort_order}</td>
              <td data-label="Actions"><div class="admin-row-menu">${writable ? `<button type="button" onclick="ASMRSAMRAdmin.openFormulaItemForm(${itemIndex})">Edit</button><button type="button" class="danger" onclick="ASMRSAMRAdmin.deleteFormulaItem(${itemIndex})">Delete</button>` : ''}</div></td>
            </tr>
          `).join('')}</tbody></table>
        ` : emptyState('No formula ingredients', 'Add exact ingredient percentages and quantities for this version.')}
      </div>
    `, 'Formula ingredients');
  }

  async function openFormulaItemForm(index) {
    const item = Number.isInteger(index) ? runtime.formulaItems[index] : null;
    const ingredients = await safeRows('ingredients?select=id,name,internal_code,unit&status=eq.active&archived_at=is.null&order=name.asc');
    runtime.formulaItemIndex = Number.isInteger(index) ? index : -1;
    openModal(`
      <span class="admin-eyebrow">${item ? 'Edit formula line' : 'Add formula line'}</span>
      <h2>${esc(runtime.formula.name)} · v${runtime.formulaVersion.version_number}</h2>
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.saveFormulaItem(event)">
        <div class="admin-editor-grid">
          <label class="admin-editor-wide"><span>Ingredient *</span><select name="ingredient_id" required>
            <option value="">Select ingredient</option>
            ${ingredients.map((ingredient) => `<option value="${attr(ingredient.id)}" ${item && item.ingredient_id === ingredient.id ? 'selected' : ''}>${esc(ingredient.internal_code)} · ${esc(ingredient.name)}</option>`).join('')}
          </select></label>
          <label><span>Percentage *</span><input name="percentage" type="number" min="0.000001" max="100" step="0.000001" value="${attr(item && item.percentage)}" required></label>
          <label><span>Quantity per reference batch *</span><input name="quantity_per_batch" type="number" min="0.000001" step="0.000001" value="${attr(item && item.quantity_per_batch)}" required></label>
          <label><span>Sort order</span><input name="sort_order" type="number" min="0" step="1" value="${attr(item ? item.sort_order : runtime.formulaItems.length)}"></label>
          <label class="admin-editor-wide"><span>Notes</span><textarea name="notes" rows="3" maxlength="1000">${esc(item && item.notes)}</textarea></label>
        </div>
        <p class="admin-form-error" id="admin-formula-item-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.openFormulaItems(${runtime.formulaVersions.findIndex((row) => row.id === runtime.formulaVersion.id)})">Cancel</button><button type="submit" class="admin-primary-btn">Save ingredient</button></div>
      </form>
    `, item ? 'Edit formula ingredient' : 'Add formula ingredient');
  }

  async function saveFormulaItem(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const existing = runtime.formulaItemIndex >= 0 ? runtime.formulaItems[runtime.formulaItemIndex] : null;
    const payload = {
      formula_version_id: runtime.formulaVersion.id,
      ingredient_id: String(data.get('ingredient_id')),
      percentage: Number(data.get('percentage')),
      quantity_per_batch: Number(data.get('quantity_per_batch')),
      sort_order: Number(data.get('sort_order')) || 0,
      notes: String(data.get('notes') || '').trim() || null
    };
    const errorNode = document.getElementById('admin-formula-item-error');
    try {
      if (existing) {
        await db(`formula_items?id=eq.${existing.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: payload });
      } else {
        await db('formula_items', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: payload });
      }
      announce('Formula ingredient saved.');
      await openFormulaItems(runtime.formulaVersions.findIndex((row) => row.id === runtime.formulaVersion.id));
    } catch (error) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = errorMessage(error);
      }
    }
  }

  function deleteFormulaItem(index) {
    const item = runtime.formulaItems[index];
    if (!item) return;
    confirmAction({
      title: 'Delete formula ingredient',
      message: 'This line will be removed from the draft or trial formula version.',
      confirmLabel: 'Delete line',
      danger: true,
      action: () => db(`formula_items?id=eq.${item.id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
      success: 'Formula ingredient deleted.'
    });
  }

  function approveFormulaVersion(index) {
    const version = runtime.formulaVersions[index];
    if (!version) return;
    confirmAction({
      title: 'Approve formula version',
      message: 'Approval locks the version for production and makes it the formula current version. Percentages are validated in the database.',
      confirmLabel: 'Approve version',
      action: () => rpc('approve_formula_version', { p_version_id: version.id }),
      success: 'Formula version approved.'
    });
  }

  function confirmBatch(index) {
    const batch = runtime.rows.production && runtime.rows.production[index];
    if (!batch) return;
    runtime.batchAction = batch;
    openModal(`
      <span class="admin-eyebrow">Confirm production</span>
      <h2>${esc(batch.batch_number)}</h2>
      <p>Confirmation deducts every formula ingredient transactionally, records consumption and stock movements, and calculates actual batch and bottle cost.</p>
      <form class="admin-settings-form" onsubmit="ASMRSAMRAdmin.runBatchConfirmation(event)">
        ${runtime.profile.role === 'admin' ? `<label><span>Negative stock override</span><input type="checkbox" name="allow_negative"> Allow only after checking physical stock and formula quantities</label>` : ''}
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.closeModal()">Cancel</button><button type="submit" class="admin-primary-btn">Confirm and deduct</button></div>
      </form>
    `, 'Confirm production batch');
  }

  async function runBatchConfirmation(event) {
    event.preventDefault();
    try {
      setBusy(true);
      await rpc('confirm_production_batch', {
        p_batch_id: runtime.batchAction.id,
        p_allow_negative: Boolean(event.currentTarget.elements.allow_negative && event.currentTarget.elements.allow_negative.checked)
      });
      closeModal();
      announce('Production batch confirmed and ingredient stock deducted.');
      await loadGeneric(CONFIGS.production);
    } catch (error) {
      announce(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  function reverseBatch(index) {
    const batch = runtime.rows.production && runtime.rows.production[index];
    if (!batch) return;
    confirmAction({
      title: 'Correct or cancel production batch',
      message: 'Consumed ingredient quantities will be restored through reversal movements. The original history remains intact.',
      confirmLabel: 'Reverse batch',
      danger: true,
      requireReason: true,
      action: (reason) => rpc('reverse_production_batch', { p_batch_id: batch.id, p_reason: reason }),
      success: 'Production batch reversed and inventory restored.'
    });
  }

  async function openBatchConsumption(index) {
    const batch = runtime.rows.production && runtime.rows.production[index];
    if (!batch) return;
    const rows = await safeRows(`production_consumptions?production_batch_id=eq.${encodeURIComponent(batch.id)}&select=*,ingredients(name,internal_code,unit)&order=created_at.asc`);
    openModal(`
      <span class="admin-eyebrow">Production consumption</span><h2>${esc(batch.batch_number)}</h2>
      <div class="admin-data-table-wrap">${rows.length ? `
        <table class="admin-data-table"><thead><tr><th>Ingredient</th><th>Planned</th><th>Actual</th><th>Unit cost</th><th>Total</th></tr></thead>
        <tbody>${rows.map((row) => `<tr><td data-label="Ingredient">${esc(row.ingredients ? `${row.ingredients.internal_code} · ${row.ingredients.name}` : row.ingredient_id)}</td><td data-label="Planned">${esc(formatNumber(row.planned_quantity, 6))}</td><td data-label="Actual">${esc(formatNumber(row.actual_quantity, 6))}</td><td data-label="Unit cost">${esc(formatMoney(row.unit_cost))}</td><td data-label="Total">${esc(formatMoney(row.total_cost))}</td></tr>`).join('')}</tbody></table>
      ` : emptyState('No consumption records', 'Consumption appears after a production batch is confirmed.')}</div>
    `, 'Production consumption');
  }

  async function openLedgerLines(key, index) {
    const transaction = runtime.rows[key] && runtime.rows[key][index];
    if (!transaction) return;
    runtime.financeKey = key;
    runtime.financeTransaction = transaction;
    const [lines, accounts] = await Promise.all([
      safeRows(`finance_transaction_lines?transaction_id=eq.${encodeURIComponent(transaction.id)}&select=*&order=id.asc`),
      safeRows('finance_accounts?select=id,code,name,account_type,currency&is_active=eq.true&order=code.asc')
    ]);
    runtime.financeLines = lines;
    runtime.financeAccounts = accounts;
    const debit = lines.filter((line) => line.direction === 'debit').reduce((sum, line) => sum + Number(line.amount), 0);
    const credit = lines.filter((line) => line.direction === 'credit').reduce((sum, line) => sum + Number(line.amount), 0);
    const editable = transaction.status === 'draft' && can('finance.write');
    openModal(`
      <span class="admin-eyebrow">Double-entry ledger</span>
      <h2>${esc(transaction.transaction_number)}</h2>
      <div class="admin-kpi-grid admin-kpi-grid-compact">
        ${kpi('Transaction amount', formatMoney(transaction.amount, transaction.currency), 'Header amount', 'gold')}
        ${kpi('Debits', formatMoney(debit, transaction.currency), 'Ledger lines', debit === Number(transaction.amount) ? 'green' : 'danger')}
        ${kpi('Credits', formatMoney(credit, transaction.currency), 'Ledger lines', credit === Number(transaction.amount) ? 'green' : 'danger')}
        ${kpi('Balance', formatMoney(debit - credit, transaction.currency), debit === credit && debit > 0 ? 'Ready to post' : 'Not balanced', debit === credit && debit > 0 ? 'green' : 'danger')}
      </div>
      <div class="admin-panel-heading"><p>Posting is allowed only when non-zero debits equal credits and both equal the transaction amount.</p>${editable ? '<button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.openLedgerLineForm()">Add line</button>' : ''}</div>
      <div class="admin-data-table-wrap">
        ${lines.length ? `
          <table class="admin-data-table"><thead><tr><th>Account</th><th>Direction</th><th>Amount</th><th>Description</th><th></th></tr></thead>
          <tbody>${lines.map((line, lineIndex) => {
            const account = accounts.find((candidate) => candidate.id === line.account_id);
            return `<tr><td data-label="Account">${esc(account ? `${account.code} · ${account.name}` : line.account_id)}</td><td data-label="Direction">${esc(titleCase(line.direction))}</td><td data-label="Amount">${esc(formatMoney(line.amount, transaction.currency))}</td><td data-label="Description">${esc(line.description || transaction.description)}</td><td data-label="Actions"><div class="admin-row-menu">${editable ? `<button type="button" onclick="ASMRSAMRAdmin.openLedgerLineForm(${lineIndex})">Edit</button><button type="button" class="danger" onclick="ASMRSAMRAdmin.deleteLedgerLine(${lineIndex})">Delete</button>` : ''}</div></td></tr>`;
          }).join('')}</tbody></table>
        ` : emptyState('No ledger lines', 'Add at least one debit and one credit line before posting.')}
      </div>
    `, `Ledger lines for ${transaction.transaction_number}`);
  }

  function openLedgerLineForm(index) {
    const line = Number.isInteger(index) ? runtime.financeLines[index] : null;
    runtime.financeLineIndex = Number.isInteger(index) ? index : -1;
    openModal(`
      <span class="admin-eyebrow">${line ? 'Edit ledger line' : 'New ledger line'}</span>
      <h2>${esc(runtime.financeTransaction.transaction_number)}</h2>
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.saveLedgerLine(event)">
        <div class="admin-editor-grid">
          <label class="admin-editor-wide"><span>Account *</span><select name="account_id" required><option value="">Select account</option>
            ${runtime.financeAccounts.map((account) => `<option value="${attr(account.id)}" ${line && line.account_id === account.id ? 'selected' : ''}>${esc(account.code)} · ${esc(account.name)} · ${esc(titleCase(account.account_type))}</option>`).join('')}
          </select></label>
          <label><span>Direction *</span><select name="direction" required><option value="debit" ${line && line.direction === 'debit' ? 'selected' : ''}>Debit</option><option value="credit" ${line && line.direction === 'credit' ? 'selected' : ''}>Credit</option></select></label>
          <label><span>Amount *</span><input name="amount" type="number" min="0.01" step="0.01" value="${attr(line && line.amount)}" required></label>
          <label class="admin-editor-wide"><span>Description</span><input name="description" value="${attr(line && line.description)}" maxlength="300"></label>
        </div>
        <p class="admin-form-error" id="admin-ledger-line-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.openLedgerLines('${attr(runtime.financeKey)}', ${runtime.rows[runtime.financeKey].findIndex((row) => row.id === runtime.financeTransaction.id)})">Cancel</button><button type="submit" class="admin-primary-btn">Save line</button></div>
      </form>
    `, line ? 'Edit ledger line' : 'Add ledger line');
  }

  async function saveLedgerLine(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const existing = runtime.financeLineIndex >= 0 ? runtime.financeLines[runtime.financeLineIndex] : null;
    const payload = {
      transaction_id: runtime.financeTransaction.id,
      account_id: String(data.get('account_id')),
      direction: String(data.get('direction')),
      amount: Number(data.get('amount')),
      description: String(data.get('description') || '').trim() || null
    };
    const errorNode = document.getElementById('admin-ledger-line-error');
    try {
      if (existing) {
        await db(`finance_transaction_lines?id=eq.${existing.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: payload });
      } else {
        await db('finance_transaction_lines', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: payload });
      }
      announce('Ledger line saved.');
      await openLedgerLines(runtime.financeKey, runtime.rows[runtime.financeKey].findIndex((row) => row.id === runtime.financeTransaction.id));
    } catch (error) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = errorMessage(error);
      }
    }
  }

  function deleteLedgerLine(index) {
    const line = runtime.financeLines[index];
    if (!line) return;
    confirmAction({
      title: 'Delete draft ledger line',
      message: 'The unposted debit or credit line will be removed.',
      confirmLabel: 'Delete line',
      danger: true,
      action: () => db(`finance_transaction_lines?id=eq.${line.id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
      success: 'Ledger line deleted.'
    });
  }

  function postTransaction(key, index) {
    const transaction = runtime.rows[key] && runtime.rows[key][index];
    if (!transaction) return;
    confirmAction({
      title: 'Post financial transaction',
      message: 'The database will verify that debits equal credits and the transaction amount. Posted entries become immutable.',
      confirmLabel: 'Post transaction',
      action: () => rpc('post_finance_transaction', { p_transaction_id: transaction.id }),
      success: 'Financial transaction posted.'
    });
  }

  function reverseTransaction(key, index) {
    const transaction = runtime.rows[key] && runtime.rows[key][index];
    if (!transaction) return;
    confirmAction({
      title: 'Reverse posted transaction',
      message: 'An equal and opposite posted entry will be created. The original remains in the audit trail.',
      confirmLabel: 'Create reversal',
      danger: true,
      requireReason: true,
      action: (reason) => rpc('reverse_finance_transaction', { p_transaction_id: transaction.id, p_reason: reason }),
      success: 'Reversal transaction created.'
    });
  }

  function openPaymentStatus(key, index) {
    const transaction = runtime.rows[key] && runtime.rows[key][index];
    if (!transaction) return;
    runtime.paymentTransaction = transaction;
    openModal(`
      <span class="admin-eyebrow">Payment status</span>
      <h2>${esc(transaction.transaction_number)}</h2>
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.savePaymentStatus(event)">
        <div class="admin-editor-grid">
          <label><span>Status *</span><select name="payment_status" required>
            ${choices(['unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded']).map(([value, label]) => `<option value="${value}" ${transaction.payment_status === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}
          </select></label>
          <label><span>Paid date</span><input name="paid_date" type="date" value="${attr(transaction.paid_date || new Date().toISOString().slice(0, 10))}"></label>
          <label><span>Payment method</span><input name="payment_method" value="${attr(transaction.payment_method || '')}" maxlength="100"></label>
          <label class="admin-editor-wide"><span>Reason / note *</span><textarea name="reason" rows="3" required maxlength="500"></textarea></label>
        </div>
        <p class="admin-form-error" id="admin-payment-status-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.closeModal()">Cancel</button><button type="submit" class="admin-primary-btn">Update payment</button></div>
      </form>
    `, 'Update payment status');
  }

  async function savePaymentStatus(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const errorNode = document.getElementById('admin-payment-status-error');
    try {
      await rpc('set_finance_payment_status', {
        p_transaction_id: runtime.paymentTransaction.id,
        p_payment_status: String(data.get('payment_status')),
        p_paid_date: String(data.get('paid_date') || '') || null,
        p_payment_method: String(data.get('payment_method') || '').trim() || null,
        p_reason: String(data.get('reason') || '').trim()
      });
      closeModal();
      announce('Payment status updated with an audit record.');
      await reloadCurrentPage();
    } catch (error) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = errorMessage(error);
      }
    }
  }

  async function snapshotCost(productId) {
    try {
      await rpc('snapshot_product_cost', {
        p_product_id: productId,
        p_variant_id: null,
        p_selling_price: null,
        p_target_margin: 0.65
      });
      announce('Historical product cost snapshot saved.');
    } catch (error) {
      announce(errorMessage(error), 'error');
    }
  }

  function usersConfig() {
    return {
      key: 'users',
      table: 'profiles',
      title: 'User Management',
      singular: 'User',
      description: 'Customers and staff with status, role, membership, rewards, privacy, and activity.',
      permission: 'customers',
      searchFields: ['full_name', 'email', 'phone'],
      defaultSort: 'created_at',
      columns: [
        { key: 'full_name', label: 'User' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role', type: 'status' },
        { key: 'status', label: 'Status', type: 'status' },
        { key: 'membership_tier', label: 'Tier', type: 'status' },
        { key: 'points', label: 'Points', type: 'number', decimals: 0 },
        { key: 'last_activity_at', label: 'Last activity', type: 'datetime' },
        { key: 'created_at', label: 'Created', type: 'date' }
      ],
      filters: [{ key: 'role', label: 'Role', options: ROLE_OPTIONS }],
      fields: [],
      readOnly: true,
      rowActions: (_row, index) => `
        ${runtime.profile.role === 'admin' ? `<button type="button" onclick="ASMRSAMRAdmin.openUserEditor('users', ${index})">Manage</button>` : ''}
        <button type="button" onclick="ASMRSAMRAdmin.openUserRelations('users', ${index})">History</button>
        ${can('customers.write') ? `<button type="button" onclick="ASMRSAMRAdmin.openRewardAdjustment('users', ${index})">Points</button>` : ''}
      `
    };
  }

  async function renderUsers(root) {
    const rows = await safeRows('profiles?select=role,status,points');
    const customers = rows.filter((row) => row.role === 'customer').length;
    const staff = rows.filter((row) => row.role !== 'customer').length;
    const suspended = rows.filter((row) => ['suspended', 'inactive'].includes(row.status)).length;
    const points = rows.reduce((sum, row) => sum + (Number(row.points) || 0), 0);
    root.innerHTML = `
      <div class="admin-kpi-grid">
        ${kpi('Customers', formatNumber(customers, 0), 'Customer accounts', 'gold')}
        ${kpi('Staff', formatNumber(staff, 0), 'Authorized business accounts', 'sand')}
        ${kpi('Inactive / suspended', formatNumber(suspended, 0), 'Accounts without active access', suspended ? 'danger' : 'green')}
        ${kpi('Reward points', formatNumber(points, 0), 'Current customer balances', 'stone')}
      </div>
      ${runtime.profile.role === 'admin' ? `
        <div class="admin-page-command"><button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.openInviteUser()">Invite user</button></div>
      ` : ''}
      <div id="admin-submodule-root"></div>
    `;
    const child = document.getElementById('admin-submodule-root');
    if (child) await renderGeneric(usersConfig(), child);
  }

  function openInviteUser() {
    if (runtime.profile.role !== 'admin') return;
    openModal(`
      <span class="admin-eyebrow">Secure invitation</span>
      <h2>Invite a user</h2>
      <p>No password is created or shown in the dashboard. Supabase sends the invitation through the configured email service.</p>
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.saveInviteUser(event)">
        <div class="admin-editor-grid">
          <label><span>Full name</span><input name="full_name" maxlength="160"></label>
          <label><span>Email *</span><input name="email" type="email" required maxlength="254"></label>
          <label><span>Phone</span><input name="phone" type="tel" maxlength="40"></label>
          <label><span>Role *</span><select name="role" required>${ROLE_OPTIONS.map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join('')}</select></label>
        </div>
        <p class="admin-form-error" id="admin-user-invite-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.closeModal()">Cancel</button><button type="submit" class="admin-primary-btn">Send invitation</button></div>
      </form>
    `, 'Invite user');
  }

  async function saveInviteUser(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const errorNode = document.getElementById('admin-user-invite-error');
    try {
      setBusy(true);
      await edge('admin-users', {
        action: 'invite',
        full_name: String(data.get('full_name') || '').trim(),
        email: String(data.get('email') || '').trim(),
        phone: String(data.get('phone') || '').trim(),
        role: String(data.get('role') || 'customer')
      });
      closeModal();
      announce('User invitation sent.');
      await reloadCurrentPage();
    } catch (error) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = errorMessage(error);
      }
    } finally {
      setBusy(false);
    }
  }

  function userFromKey(key, index) {
    return runtime.rows[key] && runtime.rows[key][index];
  }

  function openUserEditor(key, index) {
    const user = userFromKey(key, index);
    if (!user || runtime.profile.role !== 'admin') return;
    runtime.userKey = key;
    runtime.userRecord = user;
    openModal(`
      <span class="admin-eyebrow">Account management</span>
      <h2>${esc(user.full_name || user.email || 'User')}</h2>
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.saveUserEditor(event)">
        <div class="admin-editor-grid">
          <label><span>Full name</span><input name="full_name" value="${attr(user.full_name)}" maxlength="160"></label>
          <label><span>Email</span><input name="email" type="email" value="${attr(user.email)}" maxlength="254"></label>
          <label><span>Phone</span><input name="phone" type="tel" value="${attr(user.phone)}" maxlength="40"></label>
          <label><span>Role</span><select name="role">${ROLE_OPTIONS.map(([value, label]) => `<option value="${value}" ${user.role === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
          <label><span>Status</span><select name="status">${USER_STATUS_OPTIONS.map(([value, label]) => `<option value="${value}" ${user.status === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
          <label><span>Membership tier</span><select name="membership_tier">${choices(['ivory', 'amber', 'signature']).map(([value, label]) => `<option value="${value}" ${user.membership_tier === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
          <label class="admin-editor-wide"><span>Tags</span><input name="tags" value="${attr((user.tags || []).join(', '))}"><small>Comma-separated operational tags.</small></label>
          <label class="admin-editor-wide"><span>Notes</span><textarea name="notes" rows="4" maxlength="3000">${esc(user.notes)}</textarea></label>
        </div>
        <p class="admin-form-error" id="admin-user-editor-error" hidden></p>
        <div class="admin-editor-actions">
          <button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.sendPasswordReset()">Send password reset</button>
          ${user.id !== runtime.profile.id ? `
            <button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.changeUserState('${user.status === 'active' ? 'suspend' : 'activate'}')">${user.status === 'active' ? 'Suspend' : 'Activate'}</button>
            <button type="button" class="admin-secondary-btn danger" onclick="ASMRSAMRAdmin.anonymizeUser()">Anonymize</button>
          ` : ''}
          <button type="submit" class="admin-primary-btn">Save account</button>
        </div>
      </form>
    `, 'Manage user');
  }

  async function saveUserEditor(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const errorNode = document.getElementById('admin-user-editor-error');
    try {
      await edge('admin-users', {
        action: 'update',
        id: runtime.userRecord.id,
        full_name: String(data.get('full_name') || '').trim(),
        email: String(data.get('email') || '').trim(),
        phone: String(data.get('phone') || '').trim(),
        role: String(data.get('role')),
        status: String(data.get('status')),
        membership_tier: String(data.get('membership_tier')),
        tags: String(data.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean),
        notes: String(data.get('notes') || '').trim()
      });
      closeModal();
      announce('User account updated.');
      await reloadCurrentPage();
    } catch (error) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = errorMessage(error);
      }
    }
  }

  function changeUserState(action) {
    const user = runtime.userRecord;
    if (!user) return;
    confirmAction({
      title: action === 'activate' ? 'Activate user' : 'Suspend user',
      message: action === 'activate'
        ? 'The account will be allowed to authenticate again according to its role.'
        : 'The account will be blocked from authentication until an administrator activates it.',
      confirmLabel: action === 'activate' ? 'Activate' : 'Suspend',
      danger: action !== 'activate',
      action: () => edge('admin-users', { action, id: user.id }),
      success: action === 'activate' ? 'User activated.' : 'User suspended.'
    });
  }

  function sendPasswordReset() {
    const user = runtime.userRecord;
    if (!user) return;
    confirmAction({
      title: 'Send password-reset email',
      message: 'Supabase will send a one-time recovery link to the user email. No password is exposed to administrators.',
      confirmLabel: 'Send reset link',
      action: () => edge('admin-users', { action: 'password_reset', id: user.id }),
      success: 'Password-reset email requested.'
    });
  }

  function anonymizeUser() {
    const user = runtime.userRecord;
    if (!user) return;
    confirmAction({
      title: 'Anonymize user',
      message: 'Personally identifying profile and address data will be removed and authentication access soft-deleted. Order and ledger history stays intact for lawful business records.',
      confirmLabel: 'Anonymize account',
      danger: true,
      requireReason: true,
      action: (reason) => edge('admin-users', { action: 'anonymize', id: user.id, reason }),
      success: 'User account anonymized.'
    });
  }

  async function openUserRelations(key, index) {
    const user = userFromKey(key, index);
    if (!user) return;
    const [orders, addresses, wishlist, activity, rewards, requests, payments] = await Promise.all([
      safeRows(`orders?customer_id=eq.${encodeURIComponent(user.id)}&select=id,order_no,status,total,created_at&order=created_at.desc&limit=50`),
      safeRows(`user_addresses?user_id=eq.${encodeURIComponent(user.id)}&select=*&order=is_default.desc,created_at.desc`),
      safeRows(`wishlist_items?user_id=eq.${encodeURIComponent(user.id)}&select=product_id,created_at&order=created_at.desc`),
      safeRows(`user_activity?user_id=eq.${encodeURIComponent(user.id)}&select=*&order=created_at.desc&limit=100`),
      safeRows(`reward_adjustments?user_id=eq.${encodeURIComponent(user.id)}&select=*&order=created_at.desc&limit=100`),
      safeRows(`customer_requests?customer_id=eq.${encodeURIComponent(user.id)}&select=*&order=created_at.desc&limit=50`),
      safeRows(`finance_transactions?customer_id=eq.${encodeURIComponent(user.id)}&select=transaction_number,type,amount,currency,payment_status,status,transaction_date&order=transaction_date.desc&limit=50`)
    ]);
    openModal(`
      <span class="admin-eyebrow">Customer history</span>
      <h2>${esc(user.full_name || user.email || 'User')}</h2>
      <div class="admin-kpi-grid admin-kpi-grid-compact">
        ${kpi('Orders', formatNumber(orders.length, 0), formatMoney(orders.reduce((sum, row) => sum + (Number(row.total) || 0), 0)), 'gold')}
        ${kpi('Wishlist', formatNumber(wishlist.length, 0), 'Saved products', 'sand')}
        ${kpi('Reward changes', formatNumber(rewards.length, 0), `${formatNumber(user.points, 0)} current points`, 'stone')}
        ${kpi('Requests', formatNumber(requests.length, 0), 'Consultations and support', 'green')}
      </div>
      <div class="admin-dashboard-grid">
        <article class="admin-panel"><div class="admin-panel-heading"><div><h2>Orders</h2></div></div>${compactList(orders, (row) => `<div class="admin-status-row"><span class="status-dot ok"></span><div><strong>${esc(row.order_no || row.id)}</strong><small>${esc(titleCase(row.status))} · ${esc(formatMoney(row.total))} · ${esc(formatDate(row.created_at))}</small></div></div>`, 'No orders.')}</article>
        <article class="admin-panel"><div class="admin-panel-heading"><div><h2>Addresses</h2></div></div>${compactList(addresses, (row) => `<div class="admin-status-row"><span class="status-dot ${row.is_default ? 'ok' : 'warn'}"></span><div><strong>${esc(row.label || row.city || 'Address')}</strong><small>${esc([row.street, row.district, row.city].filter(Boolean).join(', '))}</small></div></div>`, 'No addresses.')}</article>
        <article class="admin-panel"><div class="admin-panel-heading"><div><h2>Activity</h2></div></div>${compactList(activity, (row) => `<div class="admin-activity-row"><span>·</span><div><strong>${esc(titleCase(row.event_type))}</strong><small>${esc(row.description || '')} · ${esc(formatDate(row.created_at))}</small></div></div>`, 'No activity events.')}</article>
        <article class="admin-panel"><div class="admin-panel-heading"><div><h2>Payments</h2></div></div>${compactList(payments, (row) => `<div class="admin-status-row"><span class="status-dot ${row.payment_status === 'paid' ? 'ok' : 'warn'}"></span><div><strong>${esc(row.transaction_number)}</strong><small>${esc(formatMoney(row.amount, row.currency))} · ${esc(titleCase(row.payment_status))}</small></div></div>`, 'No linked financial records.')}</article>
      </div>
    `, 'User history');
  }

  function openRewardAdjustment(key, index) {
    const user = userFromKey(key, index);
    if (!user || !can('customers.write')) return;
    runtime.rewardUser = user;
    openModal(`
      <span class="admin-eyebrow">Audited reward adjustment</span>
      <h2>${esc(user.full_name || user.email || 'Customer')}</h2>
      <p>Current balance: <strong>${esc(formatNumber(user.points, 0))} points</strong>.</p>
      <form class="admin-settings-form" onsubmit="ASMRSAMRAdmin.saveRewardAdjustment(event)">
        <label><span>Point change *</span><input name="points_delta" type="number" step="1" required><small>Use a negative value to subtract points.</small></label>
        <label><span>Reason *</span><textarea name="reason" rows="3" required maxlength="500"></textarea></label>
        <p class="admin-form-error" id="admin-reward-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.closeModal()">Cancel</button><button type="submit" class="admin-primary-btn">Adjust points</button></div>
      </form>
    `, 'Adjust reward points');
  }

  async function saveRewardAdjustment(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const errorNode = document.getElementById('admin-reward-error');
    try {
      await rpc('adjust_reward_points', {
        p_user_id: runtime.rewardUser.id,
        p_points_delta: Number(data.get('points_delta')),
        p_reason: String(data.get('reason') || '').trim()
      });
      closeModal();
      announce('Reward points adjusted with a reasoned audit entry.');
      await reloadCurrentPage();
    } catch (error) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = errorMessage(error);
      }
    }
  }

  async function renderGiftCards(root) {
    runtime.giftQuery = runtime.giftQuery || { search: '', status: '', page: 1, pageSize: 20 };
    root.innerHTML = loadingState('Loading secure gift cards');
    if (!can('finance.read') && !can('finance.write')) {
      root.innerHTML = errorState(new Error('Your role does not have finance permission.'));
      return;
    }
    try {
      const payload = await edge('admin-gift-cards', {
        action: 'list',
        search: runtime.giftQuery.search,
        status: runtime.giftQuery.status,
        page: runtime.giftQuery.page,
        page_size: runtime.giftQuery.pageSize
      });
      runtime.giftRows = payload.data || [];
      runtime.giftTotal = payload.total || 0;
      const pages = Math.max(1, Math.ceil(runtime.giftTotal / runtime.giftQuery.pageSize));
      root.innerHTML = `
        <article class="admin-panel admin-table-panel">
          <div class="admin-panel-heading admin-table-toolbar">
            <div><span class="admin-eyebrow">Secure gifting</span><h2>Gift Cards</h2><p>Raw codes are hashed and shown only once at creation. The dashboard displays a masked code afterward.</p></div>
            <div class="admin-toolbar-actions">${can('finance.write') ? '<button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.openGiftCardForm()">Create gift card</button>' : ''}<button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.exportGiftCards()">Export</button></div>
          </div>
          <div class="admin-crud-toolbar">
            <label class="admin-search-field"><span class="sr-only">Search gift cards</span><input type="search" value="${attr(runtime.giftQuery.search)}" placeholder="Search recipient or last four" oninput="ASMRSAMRAdmin.queueGiftSearch(this.value)"></label>
            <label class="admin-filter-field"><span>Status</span><select onchange="ASMRSAMRAdmin.setGiftStatus(this.value)"><option value="">All</option>${choices(['active', 'redeemed', 'expired', 'revoked']).map(([value, label]) => `<option value="${value}" ${runtime.giftQuery.status === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
          </div>
          <div class="admin-data-table-wrap">
            ${runtime.giftRows.length ? `
              <table class="admin-data-table"><thead><tr><th>Code</th><th>Recipient</th><th>Initial</th><th>Balance</th><th>Status</th><th>Expires</th><th>Created</th><th></th></tr></thead>
              <tbody>${runtime.giftRows.map((card, index) => `
                <tr>
                  <td data-label="Code"><code>${esc(card.masked_code)}</code></td>
                  <td data-label="Recipient">${esc(card.recipient_email || 'Not assigned')}</td>
                  <td data-label="Initial">${esc(formatMoney(card.initial_balance, card.currency))}</td>
                  <td data-label="Balance">${esc(formatMoney(card.current_balance, card.currency))}</td>
                  <td data-label="Status"><span class="admin-status-chip ${esc(card.status)}">${esc(titleCase(card.status))}</span></td>
                  <td data-label="Expires">${esc(formatDate(card.expires_at, true))}</td>
                  <td data-label="Created">${esc(formatDate(card.created_at))}</td>
                  <td data-label="Actions"><div class="admin-row-menu">
                    <button type="button" onclick="ASMRSAMRAdmin.openGiftActivity(${index})">Activity</button>
                    ${can('finance.write') && card.status !== 'revoked' ? `<button type="button" onclick="ASMRSAMRAdmin.openGiftCardForm(${index})">Edit</button><button type="button" class="danger" onclick="ASMRSAMRAdmin.revokeGiftCard(${index})">Revoke</button>` : ''}
                    ${can('finance.write') && card.status === 'revoked' ? `<button type="button" class="danger" onclick="ASMRSAMRAdmin.deleteGiftCard(${index})">Delete</button>` : ''}
                  </div></td>
                </tr>
              `).join('')}</tbody></table>
            ` : emptyState('No gift cards found', 'Create the first secure gift card or change the active filters.')}
          </div>
          <div class="admin-pagination"><span>${formatNumber(runtime.giftTotal, 0)} records · Page ${runtime.giftQuery.page} of ${pages}</span><div><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.setGiftPage(${runtime.giftQuery.page - 1})" ${runtime.giftQuery.page <= 1 ? 'disabled' : ''}>Previous</button><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.setGiftPage(${runtime.giftQuery.page + 1})" ${runtime.giftQuery.page >= pages ? 'disabled' : ''}>Next</button></div></div>
        </article>
      `;
    } catch (error) {
      root.innerHTML = errorState(error);
    }
  }

  function queueGiftSearch(value) {
    window.clearTimeout(runtime.searchTimer);
    runtime.searchTimer = window.setTimeout(() => {
      runtime.giftQuery.search = value;
      runtime.giftQuery.page = 1;
      reloadCurrentPage();
    }, 280);
  }

  function setGiftStatus(value) {
    runtime.giftQuery.status = value;
    runtime.giftQuery.page = 1;
    reloadCurrentPage();
  }

  function setGiftPage(page) {
    if (page < 1) return;
    runtime.giftQuery.page = page;
    reloadCurrentPage();
  }

  async function openGiftCardForm(index) {
    const card = Number.isInteger(index) ? runtime.giftRows[index] : null;
    runtime.giftEdit = card;
    const customers = card ? [] : await safeRows('profiles?select=id,full_name,email&role=eq.customer&status=eq.active&order=created_at.desc&limit=500');
    openModal(`
      <span class="admin-eyebrow">${card ? 'Edit gift card' : 'Secure code creation'}</span>
      <h2>${card ? esc(card.masked_code) : 'Create gift card'}</h2>
      ${card ? '' : '<p>The generated code will appear once after creation. Only its SHA-256 hash and last four characters are stored.</p>'}
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.saveGiftCard(event)">
        <div class="admin-editor-grid">
          ${card ? '' : `
            <label><span>Initial balance *</span><input name="initial_balance" type="number" min="1" step="0.01" required></label>
            <label><span>Currency *</span><input name="currency" value="SAR" maxlength="3" required></label>
            <label class="admin-editor-wide"><span>Purchaser</span><select name="purchaser_id"><option value="">Not assigned</option>${customers.map((user) => `<option value="${attr(user.id)}">${esc(user.full_name || user.email)}</option>`).join('')}</select></label>
          `}
          <label><span>Recipient email</span><input name="recipient_email" type="email" value="${attr(card && card.recipient_email)}" maxlength="254"></label>
          <label><span>Expires</span><input name="expires_at" type="datetime-local" value="${attr(card && card.expires_at ? new Date(card.expires_at).toISOString().slice(0, 16) : '')}"></label>
          ${card ? `<label><span>Status</span><select name="status">${choices(['active', 'redeemed', 'expired']).map(([value, label]) => `<option value="${value}" ${card.status === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>` : ''}
        </div>
        <p class="admin-form-error" id="admin-gift-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.closeModal()">Cancel</button><button type="submit" class="admin-primary-btn">${card ? 'Save gift card' : 'Create gift card'}</button></div>
      </form>
    `, card ? 'Edit gift card' : 'Create gift card');
  }

  async function saveGiftCard(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const errorNode = document.getElementById('admin-gift-error');
    try {
      setBusy(true);
      const payload = runtime.giftEdit
        ? await edge('admin-gift-cards', {
            action: 'update',
            id: runtime.giftEdit.id,
            recipient_email: String(data.get('recipient_email') || '').trim(),
            expires_at: String(data.get('expires_at') || '') || null,
            status: String(data.get('status'))
          })
        : await edge('admin-gift-cards', {
            action: 'create',
            initial_balance: Number(data.get('initial_balance')),
            currency: String(data.get('currency') || 'SAR').toUpperCase(),
            purchaser_id: String(data.get('purchaser_id') || '') || null,
            recipient_email: String(data.get('recipient_email') || '').trim(),
            expires_at: String(data.get('expires_at') || '') || null
          });
      if (payload.raw_code) {
        showOneTimeSecret('Gift card created', payload.raw_code, payload.notice);
      } else {
        closeModal();
        announce('Gift card updated.');
        await reloadCurrentPage();
      }
    } catch (error) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = errorMessage(error);
      }
    } finally {
      setBusy(false);
    }
  }

  function revokeGiftCard(index) {
    const card = runtime.giftRows[index];
    if (!card) return;
    confirmAction({
      title: 'Revoke gift card',
      message: 'The code will stop being valid immediately. Existing transaction history remains.',
      confirmLabel: 'Revoke',
      danger: true,
      action: () => edge('admin-gift-cards', { action: 'revoke', id: card.id }),
      success: 'Gift card revoked.'
    });
  }

  function deleteGiftCard(index) {
    const card = runtime.giftRows[index];
    if (!card) return;
    confirmAction({
      title: 'Delete revoked gift card',
      message: 'Only an unused, revoked gift card can be removed. Audit history is preserved.',
      confirmLabel: 'Delete',
      danger: true,
      action: () => edge('admin-gift-cards', { action: 'delete', id: card.id }),
      success: 'Revoked gift card deleted.'
    });
  }

  async function openGiftActivity(index) {
    const card = runtime.giftRows[index];
    if (!card) return;
    const rows = await safeRows(`audit_logs?entity_type=eq.gift_cards&entity_id=eq.${encodeURIComponent(card.id)}&select=action,actor_id,metadata,created_at&order=created_at.desc&limit=100`);
    openModal(`
      <span class="admin-eyebrow">Gift-card activity</span><h2>${esc(card.masked_code)}</h2>
      ${compactList(rows, (row) => `<div class="admin-activity-row"><span>·</span><div><strong>${esc(titleCase(row.action))}</strong><small>${esc(formatDate(row.created_at))} · ${esc(row.actor_id || 'System')}</small></div></div>`, 'No activity records are visible.')}
    `, 'Gift-card activity');
  }

  function showOneTimeSecret(title, secret, notice) {
    runtime.oneTimeSecret = secret;
    openModal(`
      <span class="admin-eyebrow">Shown once</span>
      <h2>${esc(title)}</h2>
      <p>${esc(notice || 'Copy this value now. It cannot be retrieved later.')}</p>
      <div class="admin-secret-once"><code id="admin-one-time-secret">${esc(secret)}</code><button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.copyOneTimeSecret()">Copy</button></div>
      <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.finishOneTimeSecret()">I have stored it securely</button></div>
    `, title);
  }

  async function copyOneTimeSecret() {
    if (!runtime.oneTimeSecret) return;
    await navigator.clipboard.writeText(runtime.oneTimeSecret);
    announce('Secret copied. It will not be shown again after this dialog closes.');
  }

  async function finishOneTimeSecret() {
    runtime.oneTimeSecret = null;
    closeModal();
    await reloadCurrentPage();
  }

  async function renderApiKeys(root) {
    runtime.apiQuery = runtime.apiQuery || { search: '', status: '', page: 1, pageSize: 20 };
    root.innerHTML = loadingState('Loading redacted API keys');
    if (runtime.profile.role !== 'admin') {
      root.innerHTML = errorState(new Error('Only active administrators can manage API keys.'));
      return;
    }
    try {
      const payload = await edge('admin-api-keys', {
        action: 'list',
        search: runtime.apiQuery.search,
        status: runtime.apiQuery.status,
        page: runtime.apiQuery.page,
        page_size: runtime.apiQuery.pageSize
      });
      runtime.apiRows = payload.data || [];
      runtime.apiTotal = payload.total || 0;
      const pages = Math.max(1, Math.ceil(runtime.apiTotal / runtime.apiQuery.pageSize));
      root.innerHTML = `
        <article class="admin-panel admin-table-panel">
          <div class="admin-panel-heading admin-table-toolbar">
            <div><span class="admin-eyebrow">Server credentials</span><h2>API Keys</h2><p>Only secure hashes are stored. Raw keys are available exactly once after creation or rotation.</p></div>
            <button type="button" class="admin-primary-btn" onclick="ASMRSAMRAdmin.openApiKeyForm()">Create API key</button>
          </div>
          <div class="admin-crud-toolbar">
            <label class="admin-search-field"><span class="sr-only">Search API keys</span><input type="search" value="${attr(runtime.apiQuery.search)}" placeholder="Search key name" oninput="ASMRSAMRAdmin.queueApiSearch(this.value)"></label>
            <label class="admin-filter-field"><span>Status</span><select onchange="ASMRSAMRAdmin.setApiStatus(this.value)"><option value="">All</option>${choices(['active', 'inactive', 'revoked', 'expired']).map(([value, label]) => `<option value="${value}" ${runtime.apiQuery.status === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
          </div>
          <div class="admin-data-table-wrap">
            ${runtime.apiRows.length ? `
              <table class="admin-data-table"><thead><tr><th>Name</th><th>Key</th><th>Status</th><th>Permissions</th><th>Services</th><th>Owner</th><th>Last used</th><th>Created</th><th></th></tr></thead>
              <tbody>${runtime.apiRows.map((key, index) => `
                <tr>
                  <td data-label="Name">${esc(key.name)}</td>
                  <td data-label="Key"><code>${esc(key.masked_key)}</code></td>
                  <td data-label="Status"><span class="admin-status-chip ${esc(key.effective_status)}">${esc(titleCase(key.effective_status))}</span></td>
                  <td data-label="Permissions">${esc((key.permissions || []).join(', '))}</td>
                  <td data-label="Services">${esc((key.allowed_services || []).join(', '))}</td>
                  <td data-label="Owner">${esc(key.owner ? key.owner.full_name || key.owner.email : key.owner_id)}</td>
                  <td data-label="Last used">${esc(formatDate(key.last_used_at))}</td>
                  <td data-label="Created">${esc(formatDate(key.created_at))}</td>
                  <td data-label="Actions"><div class="admin-row-menu">
                    <button type="button" onclick="ASMRSAMRAdmin.openApiActivity(${index})">Activity</button>
                    ${key.effective_status !== 'revoked' ? `<button type="button" onclick="ASMRSAMRAdmin.openApiKeyForm(${index})">Edit</button><button type="button" onclick="ASMRSAMRAdmin.rotateApiKey(${index})">Rotate</button><button type="button" class="danger" onclick="ASMRSAMRAdmin.revokeApiKey(${index})">Revoke</button>` : `<button type="button" class="danger" onclick="ASMRSAMRAdmin.deleteApiKey(${index})">Delete</button>`}
                  </div></td>
                </tr>
              `).join('')}</tbody></table>
            ` : emptyState('No API keys found', 'Create a scoped server credential or change the filters.')}
          </div>
          <div class="admin-pagination"><span>${formatNumber(runtime.apiTotal, 0)} records · Page ${runtime.apiQuery.page} of ${pages}</span><div><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.setApiPage(${runtime.apiQuery.page - 1})" ${runtime.apiQuery.page <= 1 ? 'disabled' : ''}>Previous</button><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.setApiPage(${runtime.apiQuery.page + 1})" ${runtime.apiQuery.page >= pages ? 'disabled' : ''}>Next</button></div></div>
        </article>
      `;
    } catch (error) {
      root.innerHTML = errorState(error);
    }
  }

  const API_PERMISSION_OPTIONS = [
    'catalog.read', 'catalog.write', 'orders.read', 'orders.write',
    'inventory.read', 'inventory.write', 'customers.read',
    'campaigns.read', 'reports.read', 'webhooks.send'
  ];
  const API_SERVICE_OPTIONS = ['catalog', 'orders', 'inventory', 'customers', 'marketing', 'reports', 'webhooks'];

  function queueApiSearch(value) {
    window.clearTimeout(runtime.searchTimer);
    runtime.searchTimer = window.setTimeout(() => {
      runtime.apiQuery.search = value;
      runtime.apiQuery.page = 1;
      reloadCurrentPage();
    }, 280);
  }

  function setApiStatus(value) {
    runtime.apiQuery.status = value;
    runtime.apiQuery.page = 1;
    reloadCurrentPage();
  }

  function setApiPage(page) {
    if (page < 1) return;
    runtime.apiQuery.page = page;
    reloadCurrentPage();
  }

  function openApiKeyForm(index) {
    const key = Number.isInteger(index) ? runtime.apiRows[index] : null;
    runtime.apiEdit = key;
    openModal(`
      <span class="admin-eyebrow">${key ? 'Edit scoped credential' : 'Create scoped credential'}</span>
      <h2>${key ? esc(key.name) : 'New API key'}</h2>
      <form class="admin-product-editor-form" onsubmit="ASMRSAMRAdmin.saveApiKey(event)">
        <div class="admin-editor-grid">
          <label class="admin-editor-wide"><span>Key name *</span><input name="name" value="${attr(key && key.name)}" required maxlength="120"></label>
          <fieldset class="admin-check-fieldset admin-editor-wide"><legend>Permissions *</legend>
            ${API_PERMISSION_OPTIONS.map((permission) => `<label><input type="checkbox" name="permissions" value="${attr(permission)}" ${key && (key.permissions || []).includes(permission) ? 'checked' : ''}> ${esc(permission)}</label>`).join('')}
          </fieldset>
          <fieldset class="admin-check-fieldset admin-editor-wide"><legend>Allowed services *</legend>
            ${API_SERVICE_OPTIONS.map((service) => `<label><input type="checkbox" name="allowed_services" value="${attr(service)}" ${key && (key.allowed_services || []).includes(service) ? 'checked' : ''}> ${esc(service)}</label>`).join('')}
          </fieldset>
          <label><span>Expiration</span><input name="expires_at" type="datetime-local" value="${attr(key && key.expires_at ? new Date(key.expires_at).toISOString().slice(0, 16) : '')}"></label>
          ${key ? `<label><span>Status</span><select name="status"><option value="active" ${key.status === 'active' ? 'selected' : ''}>Active</option><option value="inactive" ${key.status === 'inactive' ? 'selected' : ''}>Inactive</option></select></label>` : ''}
        </div>
        <p class="admin-form-error" id="admin-api-key-error" hidden></p>
        <div class="admin-editor-actions"><button type="button" class="admin-secondary-btn" onclick="ASMRSAMRAdmin.closeModal()">Cancel</button><button type="submit" class="admin-primary-btn">${key ? 'Save key' : 'Create key'}</button></div>
      </form>
    `, key ? 'Edit API key' : 'Create API key');
  }

  async function saveApiKey(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const permissions = data.getAll('permissions').map(String);
    const allowedServices = data.getAll('allowed_services').map(String);
    const errorNode = document.getElementById('admin-api-key-error');
    if (!permissions.length || !allowedServices.length) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = 'Select at least one permission and one allowed service.';
      }
      return;
    }
    try {
      setBusy(true);
      const payload = await edge('admin-api-keys', {
        action: runtime.apiEdit ? 'update' : 'create',
        id: runtime.apiEdit ? runtime.apiEdit.id : undefined,
        name: String(data.get('name') || '').trim(),
        permissions,
        allowed_services: allowedServices,
        expires_at: String(data.get('expires_at') || '') || null,
        status: runtime.apiEdit ? String(data.get('status')) : undefined
      });
      if (payload.raw_key) {
        showOneTimeSecret('API key created', payload.raw_key, payload.notice);
      } else {
        closeModal();
        announce('API key updated.');
        await reloadCurrentPage();
      }
    } catch (error) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = errorMessage(error);
      }
    } finally {
      setBusy(false);
    }
  }

  function rotateApiKey(index) {
    const key = runtime.apiRows[index];
    if (!key) return;
    confirmAction({
      title: 'Rotate API key',
      message: 'The current credential will stop working immediately. The replacement key will be shown exactly once.',
      confirmLabel: 'Rotate key',
      danger: true,
      action: () => edge('admin-api-keys', { action: 'rotate', id: key.id }),
      after: async (payload) => {
        await reloadCurrentPage();
        showOneTimeSecret('API key rotated', payload.raw_key, payload.notice);
      },
      success: 'API key rotated.'
    });
  }

  function revokeApiKey(index) {
    const key = runtime.apiRows[index];
    if (!key) return;
    confirmAction({
      title: 'Revoke API key',
      message: 'The key will stop working immediately and can no longer be edited or rotated.',
      confirmLabel: 'Revoke key',
      danger: true,
      action: () => edge('admin-api-keys', { action: 'revoke', id: key.id }),
      success: 'API key revoked.'
    });
  }

  function deleteApiKey(index) {
    const key = runtime.apiRows[index];
    if (!key) return;
    confirmAction({
      title: 'Delete revoked API key',
      message: 'The redacted key record will be removed. Its security activity log remains available.',
      confirmLabel: 'Delete key',
      danger: true,
      action: () => edge('admin-api-keys', { action: 'delete', id: key.id }),
      success: 'Revoked API key deleted.'
    });
  }

  async function openApiActivity(index) {
    const key = runtime.apiRows[index];
    if (!key) return;
    try {
      const payload = await edge('admin-api-keys', { action: 'activity', id: key.id, page: 1, page_size: 100 });
      const rows = payload.data || [];
      openModal(`
        <span class="admin-eyebrow">Credential activity</span><h2>${esc(key.name)}</h2>
        ${compactList(rows, (row) => `<div class="admin-activity-row"><span>·</span><div><strong>${esc(titleCase(row.action))}</strong><small>${esc(formatDate(row.created_at))} · ${esc(row.service || 'Dashboard')} · ${esc(row.actor_id || 'Key verification')}</small></div></div>`, 'No API-key activity is available.')}
      `, 'API-key activity');
    } catch (error) {
      announce(errorMessage(error), 'error');
    }
  }

  const REPORT_DEFINITIONS = {
    products: () => CONFIGS.products,
    inventory: () => productInventoryConfig(),
    'product-movements': () => ({
      key: 'report-product-movements', table: 'product_stock_movements', title: 'Product Stock Movements', permission: 'inventory',
      columns: [
        { key: 'created_at', label: 'Date', type: 'datetime' }, { key: 'product_id', label: 'Product ID' },
        { key: 'movement_type', label: 'Movement' }, { key: 'quantity_delta', label: 'Change', type: 'number' },
        { key: 'resulting_stock', label: 'Result', type: 'number' }, { key: 'unit_cost', label: 'Unit Cost', type: 'money' },
        { key: 'reason', label: 'Reason' }, { key: 'reference_type', label: 'Reference Type' },
        { key: 'reference_id', label: 'Reference ID' }, { key: 'created_by', label: 'Created By' }
      ], searchFields: ['product_id', 'reason', 'reference_id'], defaultSort: 'created_at', fields: [], readOnly: true
    }),
    ingredients: () => CONFIGS.ingredients,
    'ingredient-levels': () => ingredientSectionConfig('stock-levels'),
    'ingredient-movements': () => ingredientSectionConfig('stock-movements'),
    'ingredient-costs': () => ingredientSectionConfig('costs'),
    suppliers: () => CONFIGS.suppliers,
    'purchase-orders': () => CONFIGS['purchase-orders'],
    production: () => CONFIGS.production,
    formulas: () => CONFIGS.formulas,
    'formula-costs': () => financeSummaryConfig('product-costs'),
    orders: () => CONFIGS.orders,
    returns: () => orderSectionConfig('returns'),
    refunds: () => orderSectionConfig('refunds'),
    'order-payments': () => orderSectionConfig('payments'),
    customers: () => usersConfig(),
    users: () => usersConfig(),
    ledger: () => financeTransactionConfig('ledger'),
    income: () => financeTransactionConfig('income'),
    expenses: () => financeTransactionConfig('expenses'),
    payments: () => financeTransactionConfig('payments'),
    'profit-loss': () => financeSummaryConfig('profit-loss'),
    'cash-flow': () => financeSummaryConfig('cash-flow'),
    campaigns: () => CONFIGS.campaigns,
    'campaign-performance': () => marketingSectionConfig('performance'),
    'marketing-segments': () => marketingSectionConfig('segments'),
    'marketing-content': () => marketingSectionConfig('content'),
    'website-content': () => CONFIGS.content,
    reviews: () => contentSectionConfig('reviews'),
    newsletter: () => contentSectionConfig('subscribers'),
    audit: () => CONFIGS.audit
  };

  async function renderReports(root, focus = '') {
    const groups = [
      ['Commerce', ['products', 'inventory', 'product-movements', 'orders', 'order-payments', 'returns', 'refunds', 'customers', 'users']],
      ['Materials & Production', ['ingredients', 'ingredient-levels', 'ingredient-movements', 'ingredient-costs', 'suppliers', 'purchase-orders', 'formulas', 'production', 'formula-costs']],
      ['Finance', ['ledger', 'income', 'expenses', 'payments', 'profit-loss', 'cash-flow']],
      ['Marketing, Content & Governance', ['campaigns', 'campaign-performance', 'marketing-segments', 'marketing-content', 'website-content', 'reviews', 'newsletter', 'audit']]
    ];
    root.innerHTML = `
      <div class="admin-report-grid">
        ${groups.map(([label, keys]) => `
          <article class="admin-panel">
            <div class="admin-panel-heading"><div><span class="admin-eyebrow">${esc(label)}</span><h2>Exports</h2></div></div>
            <div class="admin-report-list">
              ${keys.map((key) => {
                const config = REPORT_DEFINITIONS[key]();
                const highlighted = focus && (config.permission === focus || key.includes(focus));
                return `
                  <div class="admin-report-row ${highlighted ? 'is-highlighted' : ''}">
                    <div><strong>${esc(config.title)}</strong><small>Active dashboard permissions and Row Level Security apply.</small></div>
                    <div class="admin-row-menu">
                      <button type="button" onclick="ASMRSAMRAdmin.exportReport('${key}','csv')">CSV</button>
                      <button type="button" onclick="ASMRSAMRAdmin.exportReport('${key}','xlsx')">XLSX</button>
                      <button type="button" onclick="ASMRSAMRAdmin.exportReport('${key}','pdf')">PDF</button>
                      <button type="button" onclick="ASMRSAMRAdmin.exportReport('${key}','print')">Print</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function activeConfig() {
    if (runtime.tab === 'inventory') return productInventoryConfig();
    if (runtime.tab === 'products') return productSectionConfig(runtime.section || 'catalog');
    if (runtime.tab === 'orders') return orderSectionConfig(runtime.section || 'orders');
    if (runtime.tab === 'content') return contentSectionConfig(runtime.section || 'website');
    if (runtime.tab === 'marketing') return marketingSectionConfig(runtime.section || 'campaigns');
    if (runtime.tab === 'ingredients') {
      if (runtime.section === 'ingredients' || !runtime.section) return CONFIGS.ingredients;
      if (runtime.section === 'suppliers') return CONFIGS.suppliers;
      if (runtime.section === 'purchase-orders') return CONFIGS['purchase-orders'];
      return ingredientSectionConfig(runtime.section);
    }
    if (runtime.tab === 'finance') {
      if (runtime.section === 'budgets') return budgetConfig();
      return financeSummaryConfig(runtime.section) || costSectionConfig(runtime.section) || financeTransactionConfig(runtime.section || 'ledger');
    }
    if (runtime.tab === 'users') return usersConfig();
    return CONFIGS[runtime.tab] || null;
  }

  async function fetchAllForConfig(config) {
    if (!config || !canRead(config)) throw new Error('You do not have permission to export this module.');
    if (!can('exports.run') && runtime.profile.role !== 'admin') {
      throw new Error('Your role does not include export permission.');
    }
    const query = { ...queryState(config.key), page: 1, pageSize: 1000 };
    const rows = [];
    for (let start = 0; start < 10000; start += 1000) {
      const result = await db(buildListPath(config, query), {
        headers: { Range: `${start}-${start + 999}`, 'Range-Unit': 'items' }
      });
      const page = result.data || [];
      rows.push(...page);
      if (page.length < 1000) break;
    }
    return rows;
  }

  function exportColumns(config) {
    return (config.exportColumns || config.columns || [])
      .filter((column) => !SENSITIVE_FIELDS.has(column.key.toLowerCase()))
      .filter((column) => !['product_images'].includes(column.key));
  }

  function exportTable(config, rows) {
    const columns = exportColumns(config);
    return {
      headers: columns.map((column) => column.label),
      rows: rows.map((row) => columns.map((column) => {
        const value = row[column.key];
        if (value == null) return '';
        if (column.type === 'date') return formatDate(value, true);
        if (column.type === 'datetime') return formatDate(value);
        if (column.type === 'money') return Number(value) || 0;
        if (column.type === 'number') return Number(value) || 0;
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (Array.isArray(value)) return value.join(', ');
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      }))
    };
  }

  function csvCell(value) {
    const text = String(value == null ? '' : value);
    return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
  }

  function buildCsv(table) {
    return '\ufeff' + [table.headers, ...table.rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  }

  function xmlEscape(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
  }

  function xlsxColumnName(index) {
    let value = index + 1;
    let name = '';
    while (value > 0) {
      const remainder = (value - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      value = Math.floor((value - 1) / 26);
    }
    return name;
  }

  function little16(value) {
    return new Uint8Array([value & 255, (value >>> 8) & 255]);
  }

  function little32(value) {
    return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
  }

  function joinBytes(parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    parts.forEach((part) => {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
      table[index] = value >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function zipStored(files) {
    const encoder = new TextEncoder();
    const locals = [];
    const centrals = [];
    let offset = 0;
    files.forEach(([name, content]) => {
      const nameBytes = encoder.encode(name);
      const data = typeof content === 'string' ? encoder.encode(content) : content;
      const crc = crc32(data);
      const local = joinBytes([
        little32(0x04034b50), little16(20), little16(0), little16(0), little16(0), little16(0),
        little32(crc), little32(data.length), little32(data.length), little16(nameBytes.length), little16(0),
        nameBytes, data
      ]);
      locals.push(local);
      centrals.push(joinBytes([
        little32(0x02014b50), little16(20), little16(20), little16(0), little16(0), little16(0), little16(0),
        little32(crc), little32(data.length), little32(data.length), little16(nameBytes.length), little16(0),
        little16(0), little16(0), little16(0), little32(0), little32(offset), nameBytes
      ]));
      offset += local.length;
    });
    const central = joinBytes(centrals);
    return joinBytes([
      ...locals,
      central,
      little32(0x06054b50), little16(0), little16(0), little16(files.length), little16(files.length),
      little32(central.length), little32(offset), little16(0)
    ]);
  }

  function buildXlsx(table, sheetName) {
    const allRows = [table.headers, ...table.rows];
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheetData>${allRows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
          const reference = `${xlsxColumnName(columnIndex)}${rowIndex + 1}`;
          if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${reference}" s="${rowIndex === 0 ? 1 : 2}"><v>${value}</v></c>`;
          return `<c r="${reference}" t="inlineStr" s="${rowIndex === 0 ? 1 : 0}"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
        }).join('')}</row>`).join('')}</sheetData>
      </worksheet>`;
    const files = [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(String(sheetName).slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>'],
      ['xl/worksheets/sheet1.xml', sheet]
    ];
    return zipStored(files);
  }

  function pdfText(value) {
    return String(value == null ? '' : value)
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '?')
      .replaceAll('\\', '\\\\')
      .replaceAll('(', '\\(')
      .replaceAll(')', '\\)');
  }

  function buildPdf(table, title) {
    const columns = table.headers.length;
    const widths = table.headers.map((header, index) => {
      const max = Math.max(header.length, ...table.rows.slice(0, 250).map((row) => String(row[index] == null ? '' : row[index]).length));
      return Math.max(8, Math.min(max, Math.floor(105 / Math.max(1, columns))));
    });
    const lines = [
      title,
      `Generated ${formatDate(new Date().toISOString())}`,
      '',
      table.headers.map((value, index) => pdfText(value).slice(0, widths[index]).padEnd(widths[index])).join(' | '),
      widths.map((width) => '-'.repeat(width)).join('-+-'),
      ...table.rows.slice(0, 1000).map((row) => row.map((value, index) =>
        pdfText(value).slice(0, widths[index]).padEnd(widths[index])
      ).join(' | '))
    ];
    const perPage = 48;
    const pages = [];
    for (let start = 0; start < lines.length; start += perPage) pages.push(lines.slice(start, start + perPage));
    const objects = new Map();
    objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
    const pageIds = pages.map((_, index) => 4 + index * 2);
    objects.set(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
    objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
    pages.forEach((pageLines, index) => {
      const pageId = 4 + index * 2;
      const contentId = pageId + 1;
      const content = `BT /F1 7 Tf 32 810 Td 10 TL ${pageLines.map((line, lineIndex) =>
        `${lineIndex ? 'T* ' : ''}(${pdfText(line)}) Tj`
      ).join('\n')} ET`;
      objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
      objects.set(contentId, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });
    const encoder = new TextEncoder();
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    const count = Math.max(...objects.keys());
    for (let id = 1; id <= count; id += 1) {
      offsets[id] = encoder.encode(pdf).length;
      pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
    }
    const xref = encoder.encode(pdf).length;
    pdf += `xref\n0 ${count + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= count; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return encoder.encode(pdf);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printTable(table, title) {
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) throw new Error('Allow pop-ups to open the printable report.');
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{font-family:Arial,sans-serif;color:#2f2924;margin:28px}h1{font-family:Georgia,serif;font-weight:400}p{color:#766d63}
      table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #d8cec0;padding:6px;text-align:left;vertical-align:top}
      th{background:#f2eadf}@media print{body{margin:10mm}}
    </style></head><body><h1>${esc(title)}</h1><p>Generated ${esc(formatDate(new Date().toISOString()))}</p>
      <table><thead><tr>${table.headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead>
      <tbody>${table.rows.map((row) => `<tr>${row.map((value) => `<td>${esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <script>window.addEventListener('load',function(){window.print();});<\/script></body></html>`);
    popup.document.close();
  }

  async function recordExport(config, format, count) {
    try {
      await db('data_exports', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: {
          module: config.key,
          format,
          filters: queryState(config.key),
          row_count: count,
          created_by: runtime.profile.id
        }
      });
    } catch (_) {
      // Export audit failure must not expose data or silently elevate permissions.
    }
  }

  async function performExport(config, format, providedRows) {
    try {
      setBusy(true);
      const rows = providedRows || await fetchAllForConfig(config);
      const table = exportTable(config, rows);
      const slug = String(config.key || config.title).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
      const date = new Date().toISOString().slice(0, 10);
      if (format === 'csv') {
        downloadBlob(new Blob([buildCsv(table)], { type: 'text/csv;charset=utf-8' }), `${slug}-${date}.csv`);
      } else if (format === 'xlsx') {
        downloadBlob(new Blob([buildXlsx(table, config.title)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${slug}-${date}.xlsx`);
      } else if (format === 'pdf') {
        downloadBlob(new Blob([buildPdf(table, config.title)], { type: 'application/pdf' }), `${slug}-${date}.pdf`);
      } else if (format === 'print') {
        printTable(table, config.title);
      } else {
        throw new Error('Unsupported export format.');
      }
      await recordExport(config, format, rows.length);
      announce(`${config.title} exported as ${format.toUpperCase()}.`);
    } catch (error) {
      announce(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  function exportConfig(key, format) {
    const config = runtime.configs[key];
    if (config) return performExport(config, format);
  }

  function exportCurrent(format = 'csv') {
    const config = activeConfig();
    if (!config) {
      announce('Open a data table before using the quick export action.', 'error');
      return;
    }
    performExport(config, format);
  }

  function exportReport(key, format) {
    const factory = REPORT_DEFINITIONS[key];
    if (!factory) return;
    const config = factory();
    runtime.configs[config.key] = config;
    performExport(config, format);
  }

  async function exportGiftCards() {
    try {
      const rows = [];
      for (let page = 1; page <= 100; page += 1) {
        const payload = await edge('admin-gift-cards', {
          action: 'list',
          search: runtime.giftQuery.search,
          status: runtime.giftQuery.status,
          page,
          page_size: 100
        });
        rows.push(...(payload.data || []));
        if ((payload.data || []).length < 100) break;
      }
      const config = {
        key: 'gift-cards',
        title: 'Gift Cards',
        columns: [
          { key: 'masked_code', label: 'Masked Code' }, { key: 'recipient_email', label: 'Recipient Email' },
          { key: 'initial_balance', label: 'Initial Balance', type: 'money' }, { key: 'current_balance', label: 'Current Balance', type: 'money' },
          { key: 'currency', label: 'Currency' }, { key: 'status', label: 'Status' },
          { key: 'expires_at', label: 'Expires', type: 'datetime' }, { key: 'created_at', label: 'Created', type: 'datetime' }
        ]
      };
      await performExport(config, 'xlsx', rows);
    } catch (error) {
      announce(errorMessage(error), 'error');
    }
  }

  window.ASMRSAMRAdmin = {
    render,
    mount,
    reload,
    reloadCurrentPage,
    login,
    logout,
    toggleSidebar,
    openProfile,
    closeModal,
    backdropClose,
    runConfirmation,
    openGenericForm,
    saveGeneric,
    viewGeneric,
    deleteGeneric,
    queueSearch,
    setFilter,
    setSort,
    toggleSort,
    setPage,
    loadGenericByKey,
    openFinanceAccount,
    openFinanceCategory,
    toggleRolePermission,
    openImages,
    uploadProductImages,
    setPrimaryImage,
    moveImage,
    editImageMetadata,
    saveImageMetadata,
    replaceProductImage,
    deleteProductImage,
    openVariants,
    openVariantForm,
    saveVariant,
    setDefaultVariant,
    archiveVariant,
    openProductProfile,
    showProductProfile,
    openProductNoteForm,
    saveProductNote,
    deleteProductNote,
    openRelatedProductForm,
    saveRelatedProduct,
    deleteRelatedProduct,
    openCollectionMembershipForm,
    saveCollectionMembership,
    deleteCollectionMembership,
    duplicateProduct,
    toggleProductPublish,
    openProductAdjustment,
    saveProductAdjustment,
    openProductHistory,
    openIngredientAdjustment,
    openIngredientSummaryAdjustment,
    saveIngredientAdjustment,
    openIngredientHistory,
    openOrderItems,
    openOrderItemForm,
    saveOrderItem,
    deleteOrderItem,
    openPurchaseItems,
    openPurchaseItemForm,
    savePurchaseItem,
    deletePurchaseItem,
    openFormulaVersions,
    openFormulaVersionForm,
    saveFormulaVersion,
    openFormulaItems,
    openFormulaItemForm,
    saveFormulaItem,
    deleteFormulaItem,
    approveFormulaVersion,
    confirmBatch,
    runBatchConfirmation,
    reverseBatch,
    openBatchConsumption,
    openLedgerLines,
    openLedgerLineForm,
    saveLedgerLine,
    deleteLedgerLine,
    postTransaction,
    reverseTransaction,
    openPaymentStatus,
    savePaymentStatus,
    snapshotCost,
    openInviteUser,
    saveInviteUser,
    openUserEditor,
    saveUserEditor,
    changeUserState,
    sendPasswordReset,
    anonymizeUser,
    openUserRelations,
    openRewardAdjustment,
    saveRewardAdjustment,
    queueGiftSearch,
    setGiftStatus,
    setGiftPage,
    openGiftCardForm,
    saveGiftCard,
    revokeGiftCard,
    deleteGiftCard,
    openGiftActivity,
    copyOneTimeSecret,
    finishOneTimeSecret,
    queueApiSearch,
    setApiStatus,
    setApiPage,
    openApiKeyForm,
    saveApiKey,
    rotateApiKey,
    revokeApiKey,
    deleteApiKey,
    openApiActivity,
    openDocumentUpload,
    replaceDocument,
    saveDocumentUpload,
    previewDocument,
    deleteDocument,
    openCampaignProducts,
    openCampaignProductForm,
    saveCampaignProduct,
    deleteCampaignProduct,
    exportCurrent,
    exportConfig,
    exportReport,
    exportGiftCards
  };
})();
