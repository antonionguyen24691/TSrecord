// ── TSrecord Admin SPA ───────────────────────────────────────
const API = '';
let token = localStorage.getItem('admin_token') || '';
let v2AdminKey = localStorage.getItem('v2_admin_key') || '';
let currentView = 'dashboard';
let cmsState = { pages: [], articles: [] };

const $ = (id) => document.getElementById(id);
const getApp = () => document.getElementById('app');

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

const v2Api = async (path, opts = {}) => {
  if (!v2AdminKey) return null;
  const headers = {
    'Content-Type': 'application/json',
    'X-Admin-Api-Key': v2AdminKey,
    ...(opts.headers || {}),
  };
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `API lỗi ${res.status}`);
  }
  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res.text();
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
  { id: 'apikeys', label: 'API Keys', icon: '🔑' },
  { id: 'content', label: 'Nội dung website', icon: '📝' },
  { id: 'revenue', label: 'Doanh thu HKD', icon: '📈' },
  { id: 'einvoices', label: 'Hóa đơn', icon: '🧾' },
];

const renderNav = () => NAV_ITEMS.map(n =>
  `<button onclick="navigate('${n.id}')" class="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all ${currentView === n.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}">${n.icon} ${n.label}</button>`
).join('');

window.navigate = (view) => { currentView = view; renderApp(); };

// ── Login ────────────────────────────────────────────────────
const renderLogin = () => {
  const app = getApp();
  if (!app) return;
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
  const app = getApp();
  if (!app) return;
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
    const views = { dashboard: renderDashboard, users: renderUsers, payments: renderPayments, promo: renderPromo, config: renderConfig, apikeys: renderApiKeys, content: renderCms, revenue: renderRevenue, einvoices: renderEinvoices };
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
  
  const activeSub = data.subscriptions.find(s => s.status === 'active');
  const usageText = activeSub 
    ? (activeSub.requests_limit !== null
        ? `${activeSub.requests_used} / ${activeSub.requests_limit} requests (đã dùng ${Math.round(activeSub.seconds_used || 0)} giây)` 
        : `Không giới hạn (đã dùng ${Math.round(activeSub.seconds_used || 0)} giây)`)
    : '—';
  const adsText = activeSub 
    ? (activeSub.ads_enabled ? 'Đang bật quảng cáo' : 'Đã tắt quảng cáo') 
    : 'Đang bật quảng cáo (Free)';
  const ownKeyText = activeSub
    ? (activeSub.own_key_purchased ? 'Đã mua' : 'Chưa mua')
    : 'Chưa mua';

  main.innerHTML = `
    <div class="fade-in">
      <button onclick="navigate('users')" class="text-sm text-emerald-600 font-semibold mb-4 inline-block">← Quay lại</button>
      <div class="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h2 class="text-xl font-black mb-2">${u.display_name || 'User #' + u.id}</h2>
        <div class="grid grid-cols-2 gap-4 text-sm mb-4">
          <div><span class="text-slate-400">Device ID:</span> <span class="font-mono">${u.device_id || '—'}</span></div>
          <div><span class="text-slate-400">Email:</span> ${u.email || '—'}</div>
          <div><span class="text-slate-400">Ngày tạo:</span> ${formatDate(u.created_at)}</div>
          <div><span class="text-slate-400">Hoạt động cuối:</span> ${formatDate(u.last_active_at)}</div>
          <div><span class="text-slate-400">Gói hiện tại:</span> <span class="font-bold text-emerald-700">${activeSub ? activeSub.plan : 'Free'}</span></div>
          <div><span class="text-slate-400">Lượt dùng:</span> ${usageText}</div>
          <div><span class="text-slate-400">Trạng thái Ads:</span> ${adsText}</div>
          <div><span class="text-slate-400">Bản quyền Tự điền Key:</span> ${ownKeyText}</div>
        </div>
        <div class="mt-4 p-4 border border-slate-100 rounded-xl bg-slate-50">
          <h4 class="text-xs font-bold text-slate-700 mb-2">CẤP GÓI DỊCH VỤ THỦ CÔNG</h4>
          <div class="flex flex-wrap gap-3 items-center">
            <select id="grant-plan" class="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
              <option value="monthly_20">Gói Standard (20 requests/tháng)</option>
              <option value="monthly_50">Gói Advanced (50 requests/tháng)</option>
              <option value="monthly_100">Gói Professional (100 requests/tháng)</option>
              <option value="own_key_ads">Tự điền Key - Có quảng cáo (199k)</option>
              <option value="own_key_no_ads">Tự điền Key - Tắt quảng cáo (248k)</option>
              <option value="disable_ads">Tắt quảng cáo riêng lẻ (49k)</option>
              <option value="promo">Promo Code Trial</option>
              <option value="monthly">Gói Tháng cũ (Legacy)</option>
              <option value="lifetime">Trọn đời cũ (Legacy)</option>
            </select>
            <input id="grant-months" type="number" placeholder="Số tháng" min="1" value="1" class="w-20 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white" />
            <button onclick="submitGrantSub(${u.id})" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold">Cấp gói</button>
            <button onclick="cancelSub(${u.id})" class="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50">Hủy active sub</button>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h3 class="text-sm font-bold mb-3">Subscriptions</h3>
        ${data.subscriptions.map(s => `<div class="flex items-center gap-4 py-2 border-b border-slate-50 text-sm">
          ${statusBadge(s.status)} <span class="font-semibold">${s.plan}</span> 
          <span class="text-slate-400">
            ${formatDate(s.started_at)} → ${s.expires_at ? formatDate(s.expires_at) : 'Trọn đời'}
            | Requests: ${s.requests_limit !== null ? `${s.requests_used}/${s.requests_limit}` : 'Không hạn chế'}
            | Ads: ${s.ads_enabled ? 'Bật' : 'Tắt'}
            | OwnKey: ${s.own_key_purchased ? 'Có' : 'Không'}
          </span>
        </div>`).join('') || '<p class="text-sm text-slate-400">Chưa có.</p>'}
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 class="text-sm font-bold mb-3">Thanh toán</h3>
        ${renderPaymentTable(data.payments)}
      </div>
    </div>`;
};

window.submitGrantSub = async (userId) => {
  const plan = $('grant-plan').value;
  const durationMonths = parseInt($('grant-months').value, 10) || 1;
  if (!confirm(`Cấp gói ${plan} (${durationMonths} tháng) cho user #${userId}?`)) return;
  await jsonApi(`/api/users/${userId}/grant`, {
    method: 'POST',
    body: JSON.stringify({ plan, durationMonths }),
  });
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
    'Thanh toán Stripe': configs.filter(c => c.key.startsWith('stripe_')),
    'Giá gói dịch vụ': configs.filter(c => c.key.includes('price')),
    'Chiết khấu kỳ hạn': configs.filter(c => c.key.startsWith('discount_')),
    'Google AdMob & Custom Banner': configs.filter(c => c.key.startsWith('admob_') || c.key.startsWith('custom_banner_')),
    'API Key hệ thống (AI)': configs.filter(c => c.key.startsWith('admin_')),
    'Google Drive hệ thống': configs.filter(c => c.key.startsWith('system_google_')),
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

// ── API Keys: pool nhiều key mỗi provider (Postgres v2) ───────
const PROVIDER_LABELS = {
  gemini: 'Google Gemini',
  groq: 'Groq Whisper',
  openai: 'OpenAI Whisper',
  assemblyai: 'AssemblyAI',
};
const KEY_STATUS_BADGE = {
  ok: badge('OK', 'bg-emerald-100 text-emerald-700'),
  cooldown: badge('Tạm nghỉ', 'bg-amber-100 text-amber-700'),
  disabled: badge('Vô hiệu', 'bg-rose-100 text-rose-700'),
};

const renderApiKeys = async (el) => {
  el.innerHTML = `
    <div class="fade-in space-y-6">
      <div>
        <h2 class="text-2xl font-black">API Keys (pool nhiều key)</h2>
        <p class="text-sm text-slate-500 mt-1">Mỗi provider gắn được nhiều key. Hệ thống xoay vòng và tự chuyển key khi 1 key hết quota / lỗi. Key chỉ hiện 4 ký tự cuối.</p>
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 class="text-sm font-bold mb-3">Kết nối API v2 (PostgreSQL)</h3>
        <p class="text-xs text-slate-500 mb-3">Nhập <code class="bg-slate-100 px-1 rounded">ADMIN_API_KEY</code> từ <code class="bg-slate-100 px-1 rounded">.env</code> backend.</p>
        <div class="flex flex-wrap gap-3">
          <input id="v2-admin-key" type="password" value="${escapeHtml(v2AdminKey)}" placeholder="ADMIN_API_KEY" class="flex-1 min-w-[240px] px-4 py-2 rounded-xl border border-slate-200 text-sm" />
          <button onclick="saveV2AdminKeyAndReload()" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold">Lưu key</button>
          <button onclick="loadProviderKeysPanel()" class="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold">Tải lại</button>
        </div>
      </div>
      <div id="provider-keys-panel" class="text-sm text-slate-500">Nhập API key và bấm "Tải lại"...</div>
    </div>`;
  if (v2AdminKey) await loadProviderKeysPanel();
};

window.saveV2AdminKeyAndReload = () => {
  v2AdminKey = $('v2-admin-key').value.trim();
  localStorage.setItem('v2_admin_key', v2AdminKey);
  loadProviderKeysPanel();
};

window.loadProviderKeysPanel = async () => {
  const panel = $('provider-keys-panel');
  if (!panel) return;
  if (!v2AdminKey) {
    panel.innerHTML = '<div class="text-amber-700">Chưa có ADMIN_API_KEY.</div>';
    return;
  }
  panel.innerHTML = '<div class="text-slate-400">Đang tải pool key...</div>';
  try {
    const data = await v2Api('/api/v2/admin/provider-keys');
    const providers = data.providers || Object.keys(data.groups || {});
    panel.innerHTML = providers.map((p) => {
      const g = data.groups[p] || { max: 10, count: 0, keys: [] };
      const full = g.count >= g.max;
      return `
        <div class="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-sm font-bold text-slate-900">${PROVIDER_LABELS[p] || p}</h3>
              <p class="text-[11px] text-slate-400">${g.count}/${g.max} key · xoay vòng + tự failover</p>
            </div>
            <button onclick="expandProviderLimit('${p}', ${g.max})" class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold hover:bg-slate-50">＋ Mở rộng giới hạn</button>
          </div>
          <div class="space-y-2 mb-4">
            ${g.keys.length === 0 ? '<p class="text-xs text-slate-400">Chưa có key nào — đang dùng key ENV (nếu có).</p>' : g.keys.map((k) => `
              <div class="flex items-center gap-3 border border-slate-100 rounded-xl px-3 py-2">
                <code class="text-xs text-slate-700">${escapeHtml(k.maskedKey)}</code>
                ${KEY_STATUS_BADGE[k.status] || ''}
                <span class="text-[11px] text-slate-400">${escapeHtml(k.label || '')}</span>
                <span class="text-[11px] text-slate-400 ml-auto">dùng ${k.useCount} · lỗi ${k.failCount}</span>
                <label class="flex items-center gap-1 text-[11px] text-slate-500"><input type="checkbox" ${k.enabled ? 'checked' : ''} onchange="toggleProviderKey('${k.id}', this.checked)" /> bật</label>
                ${k.status !== 'ok' ? `<button onclick="resetProviderKey('${k.id}')" class="text-[11px] text-emerald-700 font-semibold">reset</button>` : ''}
                <button onclick="deleteProviderKey('${k.id}')" class="text-[11px] text-rose-600 font-semibold">xóa</button>
              </div>`).join('')}
          </div>
          <div class="flex flex-wrap gap-2">
            <input id="newkey-${p}" type="password" placeholder="Dán API key ${PROVIDER_LABELS[p] || p}" ${full ? 'disabled' : ''} class="flex-1 min-w-[220px] px-3 py-2 rounded-xl border border-slate-200 text-sm disabled:bg-slate-50" />
            <input id="newlabel-${p}" placeholder="Nhãn (tuỳ chọn)" ${full ? 'disabled' : ''} class="w-40 px-3 py-2 rounded-xl border border-slate-200 text-sm disabled:bg-slate-50" />
            <button onclick="addProviderKey('${p}')" ${full ? 'disabled' : ''} class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">Thêm key</button>
          </div>
          ${full ? '<p class="text-[11px] text-amber-700 mt-2">Đã đạt giới hạn — mở rộng để thêm.</p>' : ''}
        </div>`;
    }).join('');
  } catch (err) {
    panel.innerHTML = `<div class="text-rose-600 bg-rose-50 rounded-xl p-4">${escapeHtml(err.message || 'Lỗi tải pool key.')}</div>`;
  }
};

window.addProviderKey = async (provider) => {
  const key = $(`newkey-${provider}`)?.value.trim();
  const label = $(`newlabel-${provider}`)?.value.trim();
  if (!key) { alert('Chưa nhập key.'); return; }
  try {
    await v2Api('/api/v2/admin/provider-keys', { method: 'POST', body: JSON.stringify({ provider, key, label }) });
    await loadProviderKeysPanel();
  } catch (err) { alert(err.message || 'Không thêm được key.'); }
};

window.toggleProviderKey = async (id, enabled) => {
  try {
    await v2Api(`/api/v2/admin/provider-keys/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) });
    await loadProviderKeysPanel();
  } catch (err) { alert(err.message); }
};

window.resetProviderKey = async (id) => {
  try {
    await v2Api(`/api/v2/admin/provider-keys/${id}`, { method: 'PATCH', body: JSON.stringify({ resetStatus: true }) });
    await loadProviderKeysPanel();
  } catch (err) { alert(err.message); }
};

window.deleteProviderKey = async (id) => {
  if (!confirm('Xóa key này?')) return;
  try {
    await v2Api(`/api/v2/admin/provider-keys/${id}`, { method: 'DELETE' });
    await loadProviderKeysPanel();
  } catch (err) { alert(err.message); }
};

window.expandProviderLimit = async (provider, currentMax) => {
  const input = prompt(`Giới hạn số key cho ${PROVIDER_LABELS[provider] || provider} (hiện ${currentMax}):`, String(currentMax + 5));
  if (input === null) return;
  const maxKeys = Number(input);
  if (!Number.isFinite(maxKeys) || maxKeys < 1) { alert('Số không hợp lệ.'); return; }
  try {
    await v2Api('/api/v2/admin/provider-keys/limit', { method: 'POST', body: JSON.stringify({ provider, maxKeys }) });
    await loadProviderKeysPanel();
  } catch (err) { alert(err.message); }
};

// ── Website CMS ──────────────────────────────────────────────
const cmsField = (label, id, value = '', extra = '') => `
  <label class="block">
    <span class="block text-xs font-bold text-slate-600 mb-1.5">${label}</span>
    <input id="${id}" value="${escapeHtml(value)}" ${extra}
      class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
  </label>`;

const cmsTextarea = (label, id, value, rows = 10) => `
  <label class="block">
    <span class="block text-xs font-bold text-slate-600 mb-1.5">${label}</span>
    <textarea id="${id}" rows="${rows}"
      class="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-mono text-xs leading-6 focus:outline-none focus:ring-2 focus:ring-emerald-500">${escapeHtml(value)}</textarea>
  </label>`;

const cmsLocaleSelect = (id, value = 'vi') => `
  <label class="block">
    <span class="block text-xs font-bold text-slate-600 mb-1.5">Ngôn ngữ</span>
    <select id="${id}" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
      ${[
        ['vi', 'Tiếng Việt'],
        ['en', 'English'],
        ['zh', '中文'],
        ['ko', '한국어'],
      ].map(([code, label]) => `<option value="${code}" ${value === code ? 'selected' : ''}>${label}</option>`).join('')}
    </select>
  </label>`;

const renderCms = async (el) => {
  const data = await jsonApi('/api/cms/admin/content');
  if (!data?.pages || !data?.articles) {
    el.innerHTML = '<div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">CMS chưa kết nối được. Kiểm tra DATABASE_URL của backend.</div>';
    return;
  }
  cmsState = data;
  el.innerHTML = `
    <div class="fade-in">
      <div class="flex flex-wrap items-end justify-between gap-4 mb-7">
        <div>
          <span class="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Website CMS</span>
          <h2 class="text-3xl font-black mt-1">Nội dung công khai</h2>
          <p class="text-sm text-slate-500 mt-2">Chỉnh trang giới thiệu, liên hệ, chính sách và bài viết mà không cần build lại frontend.</p>
        </div>
        <button onclick="editCmsArticle()" class="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">+ Bài viết mới</button>
      </div>

      <div id="cms-editor" class="mb-6"></div>

      <section class="mb-8">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-black text-slate-900">Trang thông tin</h3>
          <span class="text-xs text-slate-400">${data.pages.length} trang</span>
        </div>
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          ${data.pages.map((page, index) => `
            <article class="bg-white border border-slate-200 rounded-2xl p-5">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <div class="text-[11px] font-bold uppercase tracking-wider text-emerald-700">${escapeHtml(page.locale || 'vi')} · /${escapeHtml(page.slug)}</div>
                  <h4 class="font-black text-lg mt-1">${escapeHtml(page.title)}</h4>
                  <p class="text-sm text-slate-500 mt-2 line-clamp-2">${escapeHtml(page.description)}</p>
                </div>
                ${statusBadge(page.status)}
              </div>
              <button onclick="editCmsPage(${index})" class="mt-4 text-sm font-bold text-emerald-700 hover:text-emerald-900">Chỉnh sửa trang →</button>
            </article>
          `).join('')}
        </div>
      </section>

      <section>
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-black text-slate-900">Bài viết</h3>
          <span class="text-xs text-slate-400">${data.articles.length} bài</span>
        </div>
        <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          ${data.articles.map((article, index) => `
            <article class="flex flex-col lg:flex-row lg:items-center gap-4 p-5 border-b border-slate-100 last:border-0">
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span>${escapeHtml(article.category)}</span>
                  <span>·</span>
                  <span>${escapeHtml(article.locale || 'vi')}</span>
                  <span>·</span>
                  <span>/${escapeHtml(article.slug)}</span>
                  ${article.featured ? '<span class="text-emerald-700">· Nổi bật</span>' : ''}
                </div>
                <h4 class="font-black mt-1">${escapeHtml(article.title)}</h4>
                <p class="text-sm text-slate-500 mt-1">${escapeHtml(article.description)}</p>
              </div>
              <div class="flex items-center gap-3">
                ${statusBadge(article.status)}
                <button onclick="editCmsArticle(${index})" class="text-sm font-bold text-emerald-700">Sửa</button>
                <button onclick="deleteCmsArticle('${article.id}')" class="text-sm font-bold text-red-500">Xóa</button>
              </div>
            </article>
          `).join('') || '<p class="p-6 text-sm text-slate-400">Chưa có bài viết.</p>'}
        </div>
      </section>
    </div>`;
};

window.editCmsPage = (index) => {
  const page = cmsState.pages[index];
  const editor = $('cms-editor');
  editor.innerHTML = `
    <div class="bg-white border border-emerald-200 rounded-2xl p-6 shadow-sm">
      <div class="flex items-center justify-between mb-5">
        <div><span class="text-xs font-bold text-emerald-700">CHỈNH TRANG</span><h3 class="text-xl font-black">${escapeHtml(page.title)}</h3></div>
        <button onclick="$('cms-editor').innerHTML=''" class="text-sm font-bold text-slate-400">Đóng</button>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        ${cmsField('Slug', 'cms-page-slug', page.slug, 'readonly')}
        ${cmsLocaleSelect('cms-page-locale', page.locale || 'vi')}
        ${cmsField('Nhãn đầu trang', 'cms-page-eyebrow', page.eyebrow)}
        ${cmsField('Tiêu đề', 'cms-page-title', page.title)}
        <label class="block"><span class="block text-xs font-bold text-slate-600 mb-1.5">Trạng thái</span>
          <select id="cms-page-status" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
            <option value="published" ${page.status === 'published' ? 'selected' : ''}>Đã xuất bản</option>
            <option value="draft" ${page.status === 'draft' ? 'selected' : ''}>Bản nháp</option>
          </select>
        </label>
        <div class="lg:col-span-2">${cmsTextarea('Mô tả SEO', 'cms-page-description', page.description, 3)}</div>
        <div class="lg:col-span-2">${cmsTextarea('Nội dung JSON', 'cms-page-content', JSON.stringify(page.content, null, 2), 14)}</div>
        <div class="lg:col-span-2">${cmsTextarea('Metadata JSON', 'cms-page-metadata', JSON.stringify(page.metadata || {}, null, 2), 5)}</div>
      </div>
      <div id="cms-form-error" class="hidden mt-4 text-sm text-red-600"></div>
      <button onclick="saveCmsPage()" class="mt-5 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">Lưu và cập nhật website</button>
    </div>`;
  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.saveCmsPage = async () => {
  try {
    const slug = $('cms-page-slug').value;
    const response = await api(`/api/cms/admin/pages/${slug}`, {
      method: 'PUT',
      body: JSON.stringify({
        locale: $('cms-page-locale').value,
        title: $('cms-page-title').value,
        description: $('cms-page-description').value,
        eyebrow: $('cms-page-eyebrow').value,
        status: $('cms-page-status').value,
        content: JSON.parse($('cms-page-content').value),
        metadata: JSON.parse($('cms-page-metadata').value || '{}'),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Không thể lưu trang.');
    renderView();
  } catch (error) {
    const target = $('cms-form-error');
    target.textContent = error.message;
    target.classList.remove('hidden');
  }
};

window.editCmsArticle = (index) => {
  const article = Number.isInteger(index) ? cmsState.articles[index] : null;
  const editor = $('cms-editor');
  editor.innerHTML = `
    <div class="bg-white border border-emerald-200 rounded-2xl p-6 shadow-sm">
      <div class="flex items-center justify-between mb-5">
        <div><span class="text-xs font-bold text-emerald-700">${article ? 'CHỈNH BÀI VIẾT' : 'BÀI VIẾT MỚI'}</span><h3 class="text-xl font-black">${escapeHtml(article?.title || 'Tạo nội dung mới')}</h3></div>
        <button onclick="$('cms-editor').innerHTML=''" class="text-sm font-bold text-slate-400">Đóng</button>
      </div>
      <input id="cms-article-id" type="hidden" value="${article?.id || ''}" />
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        ${cmsField('Slug', 'cms-article-slug', article?.slug || '')}
        ${cmsLocaleSelect('cms-article-locale', article?.locale || 'vi')}
        ${cmsField('Chuyên mục', 'cms-article-category', article?.category || 'Kiến thức')}
        ${cmsField('Tiêu đề', 'cms-article-title', article?.title || '')}
        ${cmsField('Số phút đọc', 'cms-article-minutes', article?.reading_minutes || 5, 'type="number" min="1"')}
        <label class="block"><span class="block text-xs font-bold text-slate-600 mb-1.5">Trạng thái</span>
          <select id="cms-article-status" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
            <option value="draft" ${article?.status !== 'published' ? 'selected' : ''}>Bản nháp</option>
            <option value="published" ${article?.status === 'published' ? 'selected' : ''}>Đã xuất bản</option>
          </select>
        </label>
        <label class="flex items-center gap-3 pt-6 text-sm font-bold text-slate-700">
          <input id="cms-article-featured" type="checkbox" class="w-4 h-4" ${article?.featured ? 'checked' : ''} />
          Hiển thị nổi bật trên trang chủ
        </label>
        <div class="lg:col-span-2">${cmsTextarea('Mô tả SEO', 'cms-article-description', article?.description || '', 3)}</div>
        <div class="lg:col-span-2">${cmsTextarea('Nội dung JSON', 'cms-article-content', JSON.stringify(article?.content || [{ heading: 'Tiêu đề phần', paragraphs: ['Nội dung đoạn văn.'] }], null, 2), 16)}</div>
      </div>
      <div id="cms-form-error" class="hidden mt-4 text-sm text-red-600"></div>
      <button onclick="saveCmsArticle()" class="mt-5 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">Lưu bài viết</button>
    </div>`;
  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.saveCmsArticle = async () => {
  try {
    const id = $('cms-article-id').value;
    const payload = {
      locale: $('cms-article-locale').value,
      slug: $('cms-article-slug').value.trim(),
      title: $('cms-article-title').value.trim(),
      description: $('cms-article-description').value.trim(),
      category: $('cms-article-category').value.trim(),
      readingMinutes: Number($('cms-article-minutes').value) || 5,
      status: $('cms-article-status').value,
      featured: $('cms-article-featured').checked,
      content: JSON.parse($('cms-article-content').value),
    };
    const response = await api(id ? `/api/cms/admin/articles/${id}` : '/api/cms/admin/articles', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Không thể lưu bài viết.');
    renderView();
  } catch (error) {
    const target = $('cms-form-error');
    target.textContent = error.message;
    target.classList.remove('hidden');
  }
};

window.deleteCmsArticle = async (id) => {
  if (!confirm('Xóa bài viết này khỏi CMS?')) return;
  const response = await api(`/api/cms/admin/articles/${id}`, { method: 'DELETE' });
  if (response?.ok) renderView();
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

// ── E-Invoices (v2 API) ──────────────────────────────────────
const renderEinvoices = async (el) => {
  el.innerHTML = `
    <div class="fade-in space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-black">Hóa đơn điện tử</h2>
          <p class="text-sm text-slate-500 mt-1">Sinh hóa đơn thông thường (HTML) hoặc chuẩn bị ô API Viettel/MISA.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="issueAllPendingEinvoices()" class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">▶ Phát hành tất cả đơn chưa có HĐ</button>
          <span class="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600" title="File: admin-backend/scripts/run-backend.bat">📂 Backend .bat</span>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 class="text-sm font-bold mb-3">Kết nối API v2 (PostgreSQL)</h3>
        <p class="text-xs text-slate-500 mb-3">Nhập <code class="bg-slate-100 px-1 rounded">ADMIN_API_KEY</code> từ file <code class="bg-slate-100 px-1 rounded">.env</code> backend. Lưu trên trình duyệt này.</p>
        <div class="flex flex-wrap gap-3">
          <input id="v2-admin-key" type="password" value="${escapeHtml(v2AdminKey)}" placeholder="ADMIN_API_KEY" class="flex-1 min-w-[240px] px-4 py-2 rounded-xl border border-slate-200 text-sm" />
          <button onclick="saveV2AdminKey()" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold">Lưu key</button>
          <button onclick="loadEinvoicePanel()" class="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold">Tải lại</button>
        </div>
        <p class="text-xs text-amber-700 mt-3">Chạy backend local: double-click <b>admin-backend/scripts/run-backend.bat</b> (giống mở .exe). Mở admin: <a class="text-emerald-700 font-semibold" href="/" target="_blank">http://localhost:4000</a></p>
      </div>

      <div id="einvoice-panel" class="text-sm text-slate-500">Nhập API key và bấm "Tải lại"...</div>
    </div>`;
  if (v2AdminKey) await loadEinvoicePanel();
};

window.saveV2AdminKey = () => {
  v2AdminKey = $('v2-admin-key').value.trim();
  localStorage.setItem('v2_admin_key', v2AdminKey);
  loadEinvoicePanel();
};

window.loadEinvoicePanel = async () => {
  const panel = $('einvoice-panel');
  if (!panel) return;
  if (!v2AdminKey) {
    panel.innerHTML = '<div class="text-amber-700">Chưa có ADMIN_API_KEY.</div>';
    return;
  }
  panel.innerHTML = '<div class="text-slate-400">Đang tải dữ liệu hóa đơn...</div>';
  try {
    const [config, invoices, pending] = await Promise.all([
      v2Api('/api/v2/admin/einvoice/providers'),
      v2Api('/api/v2/admin/einvoices?limit=100'),
      v2Api('/api/v2/admin/einvoices/pending?limit=50'),
    ]);
    const org = config.organization;
    panel.innerHTML = `
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div class="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 class="text-sm font-bold mb-4">Hồ sơ xuất hóa đơn</h3>
          <form id="org-einvoice-form" class="space-y-3">
            <input id="ei-legal-name" value="${escapeHtml(org?.legal_name || '')}" placeholder="Tên HKD / công ty *" class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            <input id="ei-tax-code" value="${escapeHtml(org?.tax_code || '')}" placeholder="Mã số thuế" class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            <input id="ei-address" value="${escapeHtml(org?.address || '')}" placeholder="Địa chỉ" class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            <select id="ei-entity-type" class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
              <option value="household_business" ${org?.entity_type === 'household_business' ? 'selected' : ''}>Hộ kinh doanh</option>
              <option value="company" ${org?.entity_type === 'company' ? 'selected' : ''}>Công ty</option>
            </select>
            <input id="ei-vat-rate" type="number" step="0.01" value="${org?.vat_rate ?? ''}" placeholder="Thuế GTGT (%)" class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            <select id="ei-provider" class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
              ${(config.providers || []).map((p) => `<option value="${p.id}" ${config.activeProvider === p.id ? 'selected' : ''}>${escapeHtml(p.label)}</option>`).join('')}
            </select>
            <label class="flex items-center gap-2 text-sm"><input id="ei-enabled" type="checkbox" ${config.einvoiceEnabled ? 'checked' : ''} /> Bật provider API (Viettel/MISA)</label>
            <button type="button" onclick="saveOrgEinvoice()" class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold">Lưu hồ sơ</button>
          </form>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 class="text-sm font-bold mb-4">Ô cấu hình API provider</h3>
          <div class="space-y-4">${(config.providers || []).filter((p) => p.fields?.length).map((p) => `
            <div class="border border-slate-100 rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <div class="font-semibold">${escapeHtml(p.label)}</div>
                ${p.ready ? badge('Sẵn sàng', 'bg-emerald-100 text-emerald-700') : badge('Chưa đủ ô', 'bg-amber-100 text-amber-700')}
              </div>
              <p class="text-xs text-slate-500 mb-3">${escapeHtml(p.description)}</p>
              ${p.fields.map((f) => `
                <label class="block text-xs text-slate-500 mb-1">${escapeHtml(f.label)}</label>
                <input data-provider="${p.id}" data-field="${f.key}" value="${escapeHtml(p.values?.[f.key] || '')}" placeholder="${escapeHtml(f.placeholder || '')}" type="${f.secret ? 'password' : 'text'}" class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm mb-2" />`).join('')}
              <button onclick="saveProviderConfig('${p.id}')" class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold">Lưu ${escapeHtml(p.id)}</button>
            </div>`).join('') || '<p class="text-slate-400">Chọn Viettel hoặc MISA để hiện ô cấu hình.</p>'}
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-bold">Đơn đã thanh toán — chưa có hóa đơn (${pending.length})</h3>
        </div>
        <table class="w-full text-sm">
          <thead><tr class="border-b border-slate-100 text-left text-xs text-slate-400 uppercase">
            <th class="pb-3">Mã đơn</th><th class="pb-3">Gói</th><th class="pb-3">Số tiền</th><th class="pb-3">Email</th><th class="pb-3"></th>
          </tr></thead>
          <tbody>${pending.map((o) => `<tr class="border-b border-slate-50">
            <td class="py-3 font-mono font-bold">${o.order_code}</td>
            <td class="py-3">${o.plan_code}</td>
            <td class="py-3">${formatVND(Number(o.amount_minor))}</td>
            <td class="py-3 text-slate-500">${escapeHtml(o.email || '—')}</td>
            <td class="py-3"><button onclick="issueEinvoice('${o.order_code}')" class="text-xs font-bold text-emerald-700 hover:underline">Phát hành</button></td>
          </tr>`).join('') || '<tr><td colspan="5" class="py-6 text-center text-slate-400">Không còn đơn chờ xuất HĐ</td></tr>'}</tbody>
        </table>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="p-4 border-b border-slate-100 font-bold text-sm">Hóa đơn đã phát hành (${invoices.length})</div>
        <table class="w-full text-sm">
          <thead><tr class="border-b border-slate-100 text-left text-xs text-slate-400 uppercase bg-slate-50">
            <th class="p-4">Số HĐ</th><th class="p-4">Đơn hàng</th><th class="p-4">Provider</th><th class="p-4">Trạng thái</th><th class="p-4">Ngày</th><th class="p-4"></th>
          </tr></thead>
          <tbody>${invoices.map((d) => `<tr class="border-b border-slate-50">
            <td class="p-4 font-mono">${escapeHtml(d.invoice_number || '—')}</td>
            <td class="p-4 font-mono">${d.order_code}</td>
            <td class="p-4">${d.provider}</td>
            <td class="p-4">${statusBadge(d.status)}</td>
            <td class="p-4 text-slate-500">${formatDate(d.issued_at || d.created_at)}</td>
            <td class="p-4">
              <a href="/api/v2/admin/einvoices/${d.id}/view" target="_blank" onclick="return openEinvoiceView(event, '${d.id}')" class="text-xs font-bold text-emerald-700 hover:underline">Xem / In</a>
            </td>
          </tr>`).join('') || '<tr><td colspan="6" class="p-8 text-center text-slate-400">Chưa có hóa đơn</td></tr>'}</tbody>
        </table>
      </div>`;
  } catch (err) {
    panel.innerHTML = `<div class="text-red-600">Lỗi: ${escapeHtml(err.message)}</div>`;
  }
};

window.openEinvoiceView = (event, id) => {
  event.preventDefault();
  const w = window.open('about:blank', '_blank');
  if (!w) return false;
  fetch(`/api/v2/admin/einvoices/${id}/view`, { headers: { 'X-Admin-Api-Key': v2AdminKey } })
    .then((res) => res.text())
    .then((html) => { w.document.open(); w.document.write(html); w.document.close(); })
    .catch((err) => { w.document.body.textContent = err.message; });
  return false;
};

window.saveOrgEinvoice = async () => {
  const body = {
    legalName: $('ei-legal-name').value.trim(),
    entityType: $('ei-entity-type').value,
    taxCode: $('ei-tax-code').value.trim(),
    address: $('ei-address').value.trim(),
    vatRate: $('ei-vat-rate').value ? Number($('ei-vat-rate').value) : null,
    einvoiceProvider: $('ei-provider').value,
    einvoiceEnabled: $('ei-enabled').checked,
    accountingBasis: 'configured',
  };
  if (!body.legalName) { alert('Nhập tên HKD/công ty.'); return; }
  await v2Api('/api/v2/admin/organization', { method: 'PUT', body: JSON.stringify(body) });
  await v2Api('/api/v2/admin/organization/einvoice-settings', {
    method: 'PUT',
    body: JSON.stringify({ einvoiceProvider: body.einvoiceProvider, einvoiceEnabled: body.einvoiceEnabled }),
  });
  loadEinvoicePanel();
};

window.saveProviderConfig = async (providerId) => {
  const inputs = document.querySelectorAll(`[data-provider="${providerId}"]`);
  const providerValues = {};
  inputs.forEach((input) => { providerValues[input.dataset.field] = input.value; });
  await v2Api('/api/v2/admin/organization/einvoice-settings', {
    method: 'PUT',
    body: JSON.stringify({ providerId, providerValues }),
  });
  alert(`Đã lưu cấu hình ${providerId}.`);
  loadEinvoicePanel();
};

window.issueEinvoice = async (orderCode) => {
  if (!confirm(`Phát hành hóa đơn cho ${orderCode}?`)) return;
  await v2Api(`/api/v2/admin/orders/${orderCode}/einvoice`, { method: 'POST', body: '{}' });
  loadEinvoicePanel();
};

window.issueAllPendingEinvoices = async () => {
  if (!v2AdminKey) { alert('Nhập ADMIN_API_KEY trước.'); return; }
  if (!confirm('Phát hành hóa đơn cho tất cả đơn đã thanh toán chưa có HĐ?')) return;
  const result = await v2Api('/api/v2/admin/einvoices/issue-pending', { method: 'POST', body: JSON.stringify({ limit: 100 }) });
  alert(`Xong: ${result.issued} thành công, ${result.failed} lỗi / ${result.scanned} đơn quét.`);
  loadEinvoicePanel();
};

// ── Utilities ────────────────────────────────────────────────
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const escapeHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Boot ─────────────────────────────────────────────────────
const bootAdmin = () => {
  try {
    if (token) renderApp();
    else renderLogin();
  } catch (error) {
    const app = getApp();
    if (app) {
      app.innerHTML = `<div style="padding:24px;font-family:sans-serif;color:#b91c1c;">
        <h2>Không tải được Admin</h2>
        <p>${error instanceof Error ? error.message : String(error)}</p>
        <p style="margin-top:12px;color:#64748b;">Thử Ctrl+F5 hoặc mở DevTools (F12) → Console.</p>
      </div>`;
    }
    console.error('[TSrecord Admin]', error);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootAdmin);
} else {
  bootAdmin();
}
