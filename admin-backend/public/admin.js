// ── TSrecord Admin SPA ───────────────────────────────────────
const API = '';
let token = localStorage.getItem('admin_token') || '';
let currentView = 'dashboard';

const $ = (id) => document.getElementById(id);
const app = document.getElementById('app');

const api = async (path, opts = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  if (res.status === 401 && path !== '/api/admin/login') { token = ''; localStorage.removeItem('admin_token'); renderLogin(); return null; }
  return res;
};

const jsonApi = async (path, opts) => {
  const res = await api(path, opts);
  if (!res) return null;
  return res.json();
};

const formatVND = (amount) => new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
const formatDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const badge = (text, color) => `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}">${text}</span>`;
const statusBadge = (s) => ({
  active: badge('Active', 'bg-emerald-100 text-emerald-700'),
  expired: badge('Expired', 'bg-amber-100 text-amber-700'),
  cancelled: badge('Cancelled', 'bg-slate-100 text-slate-600'),
  completed: badge('Completed', 'bg-emerald-100 text-emerald-700'),
  pending: badge('Pending', 'bg-amber-100 text-amber-700'),
  failed: badge('Failed', 'bg-red-100 text-red-700'),
  refunded: badge('Refunded', 'bg-purple-100 text-purple-700'),
})[s] || badge(s, 'bg-slate-100 text-slate-600');

// ── Navigation ───────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'users', label: 'Người dùng', icon: '👥' },
  { id: 'payments', label: 'Thanh toán', icon: '💳' },
  { id: 'promo', label: 'Mã code', icon: '🎟️' },
  { id: 'config', label: 'Cấu hình', icon: '⚙️' },
  { id: 'revenue', label: 'Doanh thu HKD', icon: '📈' },
];

const renderNav = () => NAV_ITEMS.map(n =>
  `<button onclick="navigate('${n.id}')" class="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all ${currentView === n.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}">${n.icon} ${n.label}</button>`
).join('');

window.navigate = (view) => { currentView = view; renderApp(); };

// ── Login ────────────────────────────────────────────────────
const renderLogin = () => {
  app.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div class="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl fade-in">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 text-white text-2xl font-black mb-4">TS</div>
          <h1 class="text-2xl font-black text-slate-900">TSrecord Admin</h1>
          <p class="text-sm text-slate-500 mt-1">Đăng nhập để quản trị hệ thống</p>
        </div>
        <form id="login-form" class="space-y-4">
          <input id="login-user" type="text" placeholder="Username" class="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <input id="login-pass" type="password" placeholder="Password" class="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <div id="login-error" class="text-red-500 text-sm hidden"></div>
          <button type="submit" class="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors">Đăng nhập</button>
        </form>
      </div>
    </div>`;
  $('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await jsonApi('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: $('login-user').value, password: $('login-pass').value }),
    });
    if (res?.token) { token = res.token; localStorage.setItem('admin_token', token); renderApp(); }
    else { $('login-error').textContent = res?.error || 'Sai thông tin đăng nhập.'; $('login-error').classList.remove('hidden'); }
  };
};

// ── Main Layout ──────────────────────────────────────────────
const renderApp = () => {
  if (!token) { renderLogin(); return; }
  app.innerHTML = `
    <div class="flex min-h-screen">
      <aside class="w-64 bg-white border-r border-slate-200 p-4 flex flex-col gap-1 shrink-0">
        <div class="flex items-center gap-3 px-4 py-4 mb-4">
          <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm font-black">TS</div>
          <div><div class="text-sm font-black">TSrecord</div><div class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Admin Panel</div></div>
        </div>
        ${renderNav()}
        <div class="mt-auto pt-4 border-t border-slate-100">
          <button onclick="window.logout()" class="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50">🚪 Đăng xuất</button>
        </div>
      </aside>
      <main id="main-content" class="flex-1 p-6 lg:p-8 overflow-auto"></main>
    </div>`;
  renderView();
};

window.logout = () => { token = ''; localStorage.removeItem('admin_token'); renderLogin(); };

const renderView = async () => {
  const main = $('main-content');
  if (!main) return;
  main.innerHTML = '<div class="flex items-center justify-center h-64 text-slate-400">Đang tải...</div>';
  try {
    const views = { dashboard: renderDashboard, users: renderUsers, payments: renderPayments, promo: renderPromo, config: renderConfig, revenue: renderRevenue };
    await (views[currentView] || renderDashboard)(main);
  } catch (err) { main.innerHTML = `<div class="text-red-500 p-8">Lỗi: ${err.message}</div>`; }
};

// ── Dashboard ────────────────────────────────────────────────
const renderDashboard = async (el) => {
  const data = await jsonApi('/api/stats/dashboard');
  if (!data) return;
  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-black mb-6">Dashboard</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        ${statCard('Người dùng', data.totalUsers, '👥', 'bg-blue-50 text-blue-700')}
        ${statCard('Subscriptions', data.activeSubscriptions, '✅', 'bg-emerald-50 text-emerald-700')}
        ${statCard('Doanh thu tháng', formatVND(data.monthlyRevenue), '💰', 'bg-amber-50 text-amber-700')}
        ${statCard('Lượt dùng hôm nay', data.todayUsage, '📊', 'bg-purple-50 text-purple-700')}
      </div>
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div class="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 class="text-sm font-bold text-slate-900 mb-4">Phân bổ gói</h3>
          <div class="space-y-3">${(data.planDistribution || []).map(p =>
            `<div class="flex items-center justify-between"><span class="text-sm text-slate-600">${p.plan}</span><span class="text-sm font-bold">${p.count}</span></div>`
          ).join('') || '<p class="text-sm text-slate-400">Chưa có dữ liệu</p>'}</div>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 class="text-sm font-bold text-slate-900 mb-4">Lượt dùng 30 ngày (theo loại)</h3>
          <div class="space-y-3">${(data.usageByType || []).map(u =>
            `<div class="flex items-center justify-between"><span class="text-sm text-slate-600">${u.action}</span><span class="text-sm font-bold">${u.count}</span></div>`
          ).join('') || '<p class="text-sm text-slate-400">Chưa có dữ liệu</p>'}</div>
        </div>
      </div>
      <div class="mt-6 bg-white rounded-2xl border border-slate-200 p-6">
        <h3 class="text-sm font-bold text-slate-900 mb-4">Giao dịch gần đây</h3>
        ${renderPaymentTable(data.recentPayments || [])}
      </div>
    </div>`;
};

const statCard = (label, value, icon, colorClass) => `
  <div class="rounded-2xl border border-slate-200 bg-white p-5">
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">${label}</span>
      <span class="text-2xl">${icon}</span>
    </div>
    <div class="text-2xl font-black ${colorClass.split(' ')[1] || ''}">${value}</div>
  </div>`;

const renderPaymentTable = (payments) => payments.length === 0
  ? '<p class="text-sm text-slate-400">Chưa có giao dịch.</p>'
  : `<div class="overflow-auto"><table class="w-full text-sm">
    <thead><tr class="border-b border-slate-100 text-left text-xs text-slate-400 uppercase">
      <th class="pb-3 pr-4">Thời gian</th><th class="pb-3 pr-4">Khách</th><th class="pb-3 pr-4">Gói</th><th class="pb-3 pr-4">Số tiền</th><th class="pb-3 pr-4">PT</th><th class="pb-3">Trạng thái</th>
    </tr></thead>
    <tbody>${payments.map(p => `<tr class="border-b border-slate-50">
      <td class="py-3 pr-4 text-slate-500">${formatDate(p.created_at)}</td>
      <td class="py-3 pr-4 font-medium">${p.display_name || p.email || p.device_id || '—'}</td>
      <td class="py-3 pr-4">${p.plan || '—'}</td>
      <td class="py-3 pr-4 font-bold">${formatVND(p.amount)}</td>
      <td class="py-3 pr-4">${p.method}</td>
      <td class="py-3">${statusBadge(p.status)}</td>
    </tr>`).join('')}</tbody></table></div>`;

// ── Users ────────────────────────────────────────────────────
const renderUsers = async (el) => {
  const data = await jsonApi('/api/users?page=1');
  if (!data) return;
  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-black">Người dùng (${data.total})</h2>
        <input id="user-search" type="text" placeholder="Tìm kiếm..." class="px-4 py-2 rounded-xl border border-slate-200 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-slate-100 text-left text-xs text-slate-400 uppercase bg-slate-50">
            <th class="p-4">ID</th><th class="p-4">Device / Email</th><th class="p-4">Tên</th><th class="p-4">Gói</th><th class="p-4">Lượt dùng</th><th class="p-4">Ngày tạo</th>
          </tr></thead>
          <tbody>${data.users.map(u => `<tr class="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onclick="viewUser(${u.id})">
            <td class="p-4 text-slate-400">#${u.id}</td>
            <td class="p-4 font-mono text-xs">${u.email || u.device_id || '—'}</td>
            <td class="p-4 font-medium">${u.display_name || '—'}</td>
            <td class="p-4">${u.active_plan ? statusBadge(u.sub_status) + ' ' + u.active_plan : '<span class="text-slate-400">Free</span>'}</td>
            <td class="p-4">${u.usage_count}</td>
            <td class="p-4 text-slate-500">${formatDate(u.created_at)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
  $('user-search').oninput = debounce(async (e) => {
    const res = await jsonApi(`/api/users?search=${encodeURIComponent(e.target.value)}`);
    if (res) { el.querySelector('tbody').innerHTML = res.users.map(u => `<tr class="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onclick="viewUser(${u.id})">
      <td class="p-4 text-slate-400">#${u.id}</td><td class="p-4 font-mono text-xs">${u.email || u.device_id || '—'}</td><td class="p-4 font-medium">${u.display_name || '—'}</td>
      <td class="p-4">${u.active_plan ? statusBadge(u.sub_status) + ' ' + u.active_plan : '<span class="text-slate-400">Free</span>'}</td><td class="p-4">${u.usage_count}</td><td class="p-4 text-slate-500">${formatDate(u.created_at)}</td>
    </tr>`).join(''); }
  }, 300);
};

window.viewUser = async (id) => {
  const data = await jsonApi(`/api/users/${id}`);
  if (!data) return;
  const u = data.user;
  const main = $('main-content');
  main.innerHTML = `
    <div class="fade-in">
      <button onclick="navigate('users')" class="text-sm text-emerald-600 font-semibold mb-4 inline-block">← Quay lại</button>
      <div class="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h2 class="text-xl font-black mb-2">${u.display_name || 'User #' + u.id}</h2>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div><span class="text-slate-400">Device ID:</span> <span class="font-mono">${u.device_id || '—'}</span></div>
          <div><span class="text-slate-400">Email:</span> ${u.email || '—'}</div>
          <div><span class="text-slate-400">Ngày tạo:</span> ${formatDate(u.created_at)}</div>
          <div><span class="text-slate-400">Hoạt động cuối:</span> ${formatDate(u.last_active_at)}</div>
        </div>
        <div class="flex gap-3 mt-4">
          <button onclick="grantSub(${u.id}, 'monthly')" class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">Cấp gói tháng</button>
          <button onclick="grantSub(${u.id}, 'lifetime')" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">Cấp lifetime</button>
          <button onclick="cancelSub(${u.id})" class="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50">Hủy subscription</button>
        </div>
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h3 class="text-sm font-bold mb-3">Subscriptions</h3>
        ${data.subscriptions.map(s => `<div class="flex items-center gap-4 py-2 border-b border-slate-50 text-sm">
          ${statusBadge(s.status)} <span class="font-semibold">${s.plan}</span> <span class="text-slate-400">${formatDate(s.started_at)} → ${s.expires_at ? formatDate(s.expires_at) : 'Trọn đời'}</span>
        </div>`).join('') || '<p class="text-sm text-slate-400">Chưa có.</p>'}
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 class="text-sm font-bold mb-3">Thanh toán</h3>
        ${renderPaymentTable(data.payments)}
      </div>
    </div>`;
};

window.grantSub = async (userId, plan) => {
  if (!confirm(`Cấp gói ${plan} cho user #${userId}?`)) return;
  await jsonApi(`/api/users/${userId}/grant`, { method: 'POST', body: JSON.stringify({ plan }) });
  window.viewUser(userId);
};

window.cancelSub = async (userId) => {
  if (!confirm('Hủy subscription?')) return;
  await api(`/api/users/${userId}/subscription`, { method: 'DELETE' });
  window.viewUser(userId);
};

// ── Payments ─────────────────────────────────────────────────
const renderPayments = async (el) => {
  const data = await jsonApi('/api/payments?page=1');
  if (!data) return;
  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-black">Thanh toán (${data.total})</h2>
        <a href="/api/payments/export?year=${new Date().getFullYear()}" target="_blank" class="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50">📥 Export CSV</a>
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 p-6">
        ${renderPaymentTable(data.payments)}
      </div>
    </div>`;
};

// ── Promo Codes ──────────────────────────────────────────────
const renderPromo = async (el) => {
  const codes = await jsonApi('/api/promo-codes');
  if (!codes) return;
  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-black">Mã code (${codes.length})</h2>
        <button onclick="showAddPromo()" class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">+ Tạo mã mới</button>
      </div>
      <div id="promo-form-area"></div>
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-slate-100 text-left text-xs text-slate-400 uppercase bg-slate-50">
            <th class="p-4">Mã</th><th class="p-4">Gói</th><th class="p-4">Thời hạn</th><th class="p-4">Đã dùng</th><th class="p-4">Trạng thái</th><th class="p-4">Hết hạn</th><th class="p-4"></th>
          </tr></thead>
          <tbody>${codes.map(c => `<tr class="border-b border-slate-50">
            <td class="p-4 font-mono font-bold text-emerald-700">${c.code}</td>
            <td class="p-4">${c.plan}</td>
            <td class="p-4">${c.plan === 'monthly' ? (c.duration_months || 1) + ' tháng' : 'Trọn đời'}</td>
            <td class="p-4">${c.used_count}/${c.max_uses}</td>
            <td class="p-4">${c.is_active ? badge('Active', 'bg-emerald-100 text-emerald-700') : badge('Disabled', 'bg-slate-100 text-slate-500')}</td>
            <td class="p-4 text-slate-500">${c.expires_at ? formatDate(c.expires_at) : '—'}</td>
            <td class="p-4">
              <button onclick="togglePromo(${c.id}, ${c.is_active ? 0 : 1})" class="text-xs text-slate-500 hover:text-slate-900 mr-2">${c.is_active ? 'Tắt' : 'Bật'}</button>
              <button onclick="deletePromo(${c.id})" class="text-xs text-red-500 hover:text-red-700">Xóa</button>
            </td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
};

window.showAddPromo = () => {
  $('promo-form-area').innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 p-6 mb-6 fade-in">
      <h3 class="text-sm font-bold mb-4">Tạo mã code mới</h3>
      <div class="grid grid-cols-2 gap-4">
        <input id="pc-code" type="text" placeholder="Mã code (VD: TSRECORD2024)" class="px-4 py-2 rounded-xl border border-slate-200 text-sm" />
        <select id="pc-plan" class="px-4 py-2 rounded-xl border border-slate-200 text-sm"><option value="lifetime">Lifetime</option><option value="monthly">Monthly</option></select>
        <input id="pc-months" type="number" placeholder="Số tháng (monthly)" class="px-4 py-2 rounded-xl border border-slate-200 text-sm" value="1" />
        <input id="pc-max" type="number" placeholder="Lượt dùng tối đa" class="px-4 py-2 rounded-xl border border-slate-200 text-sm" value="1" />
        <input id="pc-desc" type="text" placeholder="Mô tả" class="px-4 py-2 rounded-xl border border-slate-200 text-sm col-span-2" />
      </div>
      <div class="flex gap-3 mt-4">
        <button onclick="createPromo()" class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold">Tạo</button>
        <button onclick="$('promo-form-area').innerHTML=''" class="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold">Hủy</button>
      </div>
    </div>`;
};

window.createPromo = async () => {
  await jsonApi('/api/promo-codes', { method: 'POST', body: JSON.stringify({
    code: $('pc-code').value, plan: $('pc-plan').value,
    durationMonths: parseInt($('pc-months').value, 10) || 1,
    maxUses: parseInt($('pc-max').value, 10) || 1,
    description: $('pc-desc').value,
  })});
  renderView();
};

window.togglePromo = async (id, active) => {
  await jsonApi(`/api/promo-codes/${id}`, { method: 'PUT', body: JSON.stringify({ isActive: active }) });
  renderView();
};

window.deletePromo = async (id) => {
  if (!confirm('Xóa mã code này?')) return;
  await api(`/api/promo-codes/${id}`, { method: 'DELETE' });
  renderView();
};

// ── Config ───────────────────────────────────────────────────
const renderConfig = async (el) => {
  const configs = await jsonApi('/api/config');
  if (!configs) return;

  const groups = {
    'Thanh toán SePay': configs.filter(c => c.key.startsWith('sepay_')),
    'Giá gói dịch vụ': configs.filter(c => c.key.includes('price')),
    'Thông tin HKD (Hộ Kinh Doanh)': configs.filter(c => c.key.startsWith('hkd_')),
    'Hóa đơn': configs.filter(c => c.key.startsWith('invoice_')),
    'Webhook': configs.filter(c => c.key.startsWith('webhook_')),
  };

  el.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-black">Cấu hình hệ thống</h2>
        <button onclick="saveConfig()" class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">💾 Lưu thay đổi</button>
      </div>
      ${Object.entries(groups).map(([title, items]) => items.length === 0 ? '' : `
        <div class="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
          <h3 class="text-sm font-bold text-slate-900 mb-4">${title}</h3>
          <div class="space-y-3">${items.map(c => `
            <div class="flex items-start gap-4">
              <div class="w-56 shrink-0">
                <label class="text-xs font-semibold text-slate-600">${c.key}</label>
                <p class="text-[11px] text-slate-400">${c.description || ''}</p>
              </div>
              <input data-config-key="${c.key}" value="${escapeHtml(c.value)}" class="config-input flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          `).join('')}</div>
        </div>
      `).join('')}
    </div>`;
};

window.saveConfig = async () => {
  const inputs = document.querySelectorAll('.config-input');
  const updates = Array.from(inputs).map(input => ({ key: input.dataset.configKey, value: input.value }));
  const res = await jsonApi('/api/config', { method: 'PUT', body: JSON.stringify(updates) });
  if (res?.ok) alert('Đã lưu cấu hình!');
};

// ── Revenue HKD ──────────────────────────────────────────────
const renderRevenue = async (el) => {
  const year = new Date().getFullYear();
  const data = await jsonApi(`/api/stats/revenue?year=${year}`);
  if (!data) return;
  const yt = data.yearTotal || {};
  el.innerHTML = `
    <div class="fade-in">
      <h2 class="text-2xl font-black mb-6">Doanh thu HKD — ${year}</h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        ${statCard('Tổng doanh thu', formatVND(yt.revenue || 0), '💰', 'bg-emerald-50 text-emerald-700')}
        ${statCard('Tổng giao dịch', yt.transactions || 0, '📄', 'bg-blue-50 text-blue-700')}
        ${statCard('Thuế ước tính (1.5%)', formatVND(yt.tax || 0), '🏛️', 'bg-amber-50 text-amber-700')}
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-bold">Chi tiết theo tháng</h3>
          <a href="/api/payments/export?year=${year}" target="_blank" class="text-sm text-emerald-600 font-semibold">📥 Export CSV năm ${year}</a>
        </div>
        <table class="w-full text-sm">
          <thead><tr class="border-b border-slate-100 text-left text-xs text-slate-400 uppercase">
            <th class="pb-3">Tháng</th><th class="pb-3">Doanh thu</th><th class="pb-3">Giao dịch</th><th class="pb-3">Gói tháng</th><th class="pb-3">Gói lifetime</th><th class="pb-3">Thuế (1.5%)</th>
          </tr></thead>
          <tbody>${(data.months || []).map(m => `<tr class="border-b border-slate-50">
            <td class="py-3 font-semibold">T${m.month}/${m.year}</td>
            <td class="py-3 font-bold text-emerald-700">${formatVND(m.total_revenue)}</td>
            <td class="py-3">${m.total_transactions}</td>
            <td class="py-3">${formatVND(m.monthly_plan_revenue)}</td>
            <td class="py-3">${formatVND(m.lifetime_plan_revenue)}</td>
            <td class="py-3 text-amber-600">${formatVND(m.tax_amount)}</td>
          </tr>`).join('') || '<tr><td colspan="6" class="py-8 text-center text-slate-400">Chưa có dữ liệu doanh thu</td></tr>'}</tbody>
        </table>
      </div>
      <div class="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm">
        <h3 class="font-bold text-amber-800 mb-2">📋 Ghi chú thuế HKD</h3>
        <ul class="list-disc ml-5 text-amber-700 space-y-1">
          <li>Thuế suất HKD dịch vụ CNTT: <b>1% VAT + 0.5% TNCN = 1.5% doanh thu</b> (Thông tư 40/2021/TT-BTC)</li>
          <li>Ngưỡng doanh thu chịu thuế: <b>100 triệu VND/năm</b>. Dưới ngưỡng này không phải nộp thuế.</li>
          <li>Kỳ kê khai: <b>Hàng quý</b> (nếu doanh thu > 50 triệu/quý) hoặc <b>hàng năm</b>.</li>
          <li>Sử dụng nút Export CSV để tải báo cáo doanh thu nộp cơ quan thuế.</li>
        </ul>
      </div>
    </div>`;
};

// ── Utilities ────────────────────────────────────────────────
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const escapeHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Boot ─────────────────────────────────────────────────────
if (token) renderApp(); else renderLogin();
