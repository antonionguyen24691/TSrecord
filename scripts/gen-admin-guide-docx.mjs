// Sinh file .docx "Hướng dẫn cấu hình & vận hành admin TSrecord".
// Chạy: node scripts/gen-admin-guide-docx.mjs
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} from 'docx';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const GREEN = '0C6759';
const INK = '10231E';
const LIGHT = 'EAF4F0';

const children = [];

const H1 = (t) => children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 140 }, children: [new TextRun({ text: t, color: GREEN, bold: true })] }));
const H2 = (t) => children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 }, children: [new TextRun({ text: t, color: INK, bold: true })] }));
const H3 = (t) => children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 80 }, children: [new TextRun({ text: t, color: INK, bold: true })] }));
const P = (t, opts = {}) => children.push(new Paragraph({ spacing: { after: 100 }, children: typeof t === 'string' ? [new TextRun({ text: t, ...opts })] : t }));
const code = (t) => new TextRun({ text: t, font: 'Consolas', size: 19 });
const b = (t) => new TextRun({ text: t, bold: true });
const t = (t) => new TextRun({ text: t });
const bullet = (t, lvl = 0) => children.push(new Paragraph({ bullet: { level: lvl }, spacing: { after: 50 }, children: typeof t === 'string' ? [new TextRun(t)] : t }));
const num = (t, ref) => children.push(new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 50 }, children: typeof t === 'string' ? [new TextRun(t)] : t }));
const spacer = () => children.push(new Paragraph({ children: [] }));

const cell = (text, { bold = false, header = false, w } = {}) => new TableCell({
  width: w ? { size: w, type: WidthType.PERCENTAGE } : undefined,
  shading: header ? { type: ShadingType.CLEAR, fill: GREEN, color: 'auto' } : undefined,
  margins: { top: 60, bottom: 60, left: 90, right: 90 },
  children: [new Paragraph({ children: [new TextRun({ text, bold: bold || header, color: header ? 'FFFFFF' : '000000', size: 19 })] })],
});

const table = (headers, rows, widths) => {
  const border = { style: BorderStyle.SINGLE, size: 2, color: 'CFE0DA' };
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, { header: true, w: widths?.[i] })) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(String(c), { w: widths?.[i] })) })),
    ],
  }));
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
};

const callout = (title, body) => {
  const border = { style: BorderStyle.SINGLE, size: 4, color: GREEN };
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [new TableRow({ children: [new TableCell({
      shading: { type: ShadingType.CLEAR, fill: LIGHT, color: 'auto' },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      children: [
        new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: title, bold: true, color: GREEN })] }),
        ...body.map((line) => new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: line })] })),
      ],
    })] })],
  }));
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
};

// ───────────────────────── BÌA ─────────────────────────
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 60 }, children: [new TextRun({ text: 'TSrecord', bold: true, size: 56, color: GREEN })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'HƯỚNG DẪN CẤU HÌNH & VẬN HÀNH ADMIN', bold: true, size: 32, color: INK })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Luồng thanh toán · Quản lý API key (tối ưu chi phí) · Phát hành cập nhật', size: 22, color: '526760' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: 'Phiên bản tài liệu 1.0 · Cập nhật 14/06/2026 · App v1.4.6', size: 20, italics: true, color: '526760' })] }));
children.push(new Paragraph({ pageBreakBefore: true, children: [] }));

// ───────────────────────── 0. TÓM TẮT ĐÁNH GIÁ ─────────────────────────
H1('0. Tóm tắt đánh giá luồng admin');
P([b('Kết luận nhanh: '), t('Luồng admin đã '), b('chạy được và đủ dùng cho vận hành cơ bản'), t(' (quản lý người dùng, gói, thanh toán SePay/Stripe, pool API key có xoay vòng + tự failover, CMS, hóa đơn). Tuy nhiên còn một số điểm cần hoàn thiện trước khi mở rộng quy mô, đặc biệt là '), b('chiến lược ưu tiên key miễn phí để giảm chi phí'), t(' và '), b('luồng phát hành bản cập nhật cho app.')]);

H3('Đã ổn');
bullet('Pool nhiều key/provider (Gemini, Groq, OpenAI, AssemblyAI) với che key, đếm lượt dùng/lỗi, bật/tắt, giới hạn số key.');
bullet('Tự động failover: key lỗi do quota/auth bị cooldown/disable, request tự nhảy sang key kế tiếp ngay trong cùng một lần gọi.');
bullet('Key ENV cũ được giữ làm fallback cuối nên không gãy khi pool trống.');
bullet('Thanh toán SePay (QR chuyển khoản + webhook) và Stripe (checkout + webhook) đều có xác thực webhook.');
bullet('Phân tách rõ frontend / website / backend; production chạy PostgreSQL trên Vercel, đọc cấu hình nhạy cảm từ biến môi trường.');

H3('Cần nâng cấp / hoàn thiện (chi tiết ở Mục 4 và Mục 9)');
bullet([b('Ưu tiên key free chưa làm được với cơ chế hiện tại: '), t('thứ tự chọn key đang sắp theo "ít dùng gần nhất" (last_used_at) trước, nên không thể ép dùng hết key free rồi mới tới key trả phí. Cần thêm khái niệm "hạng" (tier/priority).')]);
bullet([b('Chưa có cổng kiểm tra phiên bản / bắt buộc cập nhật cho app: '), t('app Capacitor đóng gói tĩnh, không tự cập nhật phần web khi chưa lên store.')]);
bullet('Chưa có cảnh báo khi cả pool key sắp cạn/đồng loạt cooldown (chỉ thấy qua đếm lỗi).');
bullet('Admin UI chưa có nơi nhập key ENV nhạy cảm ở chế độ Postgres (phải sửa biến môi trường Vercel).');
spacer();

// ───────────────────────── 1. KIẾN TRÚC ─────────────────────────
H1('1. Kiến trúc & các cấu phần');
table(
  ['Cấu phần', 'Công nghệ', 'Triển khai', 'Vai trò'],
  [
    ['Website + Ứng dụng web', 'React 19, Vite 6', 'Vercel (tsrecord.vn, /app)', 'Trang giới thiệu + app phiên âm chạy trên trình duyệt'],
    ['App di động', 'Capacitor 8 (Android/iOS)', 'Play Store / App Store', 'Đóng gói web vào WebView native, dùng quyền micro'],
    ['Backend dịch vụ', 'Express + PostgreSQL', 'Vercel (api.tsrecord.vn)', 'Proxy AI, license, thanh toán, webhook, CMS, admin'],
    ['Admin Dashboard', 'SPA tĩnh (public/admin.js)', 'Phục vụ bởi backend', 'Quản trị key, gói, người dùng, hóa đơn, nội dung'],
  ],
  [22, 22, 28, 28]
);
callout('Hai chế độ backend (rất quan trọng để biết cấu hình đặt ở đâu)', [
  '• PostgreSQL (production / Vercel): bật khi có biến môi trường DATABASE_URL. Đây là chế độ chuẩn cho production.',
  '• SQLite (local / Fly.io – legacy, đang retire): khi không có DATABASE_URL.',
  'Ở chế độ Postgres, các cấu hình nhạy cảm (key AI dạng ENV, SePay/Stripe, AdMob, giá) được đọc từ BIẾN MÔI TRƯỜNG, không phải từ bảng system_config. Pool API key thì luôn nằm trong DB (bảng provider_keys_v2).',
]);

// ───────────────────────── 2. TRUY CẬP ADMIN ─────────────────────────
H1('2. Truy cập & xác thực admin');
H3('2.1 Đăng nhập dashboard (v1 – JWT)');
bullet([code('POST /api/admin/login'), t(' với username + password (lưu bcrypt trong bảng admin_users).')]);
bullet([t('Trả về JWT (hết hạn 24h), lưu ở '), code('localStorage.admin_token'), t('. Mọi API v1 cần header '), code('Authorization: Bearer <token>'), t('.')]);
bullet([t('Đổi mật khẩu: '), code('PUT /api/admin/password'), t('. Reset khẩn cấp: '), code('npx tsx scripts/reset-admin-password.ts'), t('.')]);
H3('2.2 API quản trị nền tảng v2 (Postgres – API key)');
bullet([t('Mọi endpoint '), code('/api/v2/admin/*'), t(' yêu cầu header '), code('X-Admin-Api-Key: <ADMIN_API_KEY>'), t('.')]);
bullet([t('Trong dashboard, nhập ADMIN_API_KEY vào panel "API Keys"; key được lưu '), code('localStorage.v2_admin_key'), t('.')]);
callout('Bảo mật', [
  '• ADMIN_API_KEY là chìa khóa toàn quyền nền tảng — đặt chuỗi ngẫu nhiên dài, chỉ lưu trong ENV Vercel, không commit, đổi định kỳ.',
  '• JWT_SECRET và DEVICE_AUTH_SECRET cũng phải là chuỗi mạnh, khác nhau, không lộ.',
]);

// ───────────────────────── 3. CÁC MÀN HÌNH ADMIN ─────────────────────────
H1('3. Các màn hình trong Admin Dashboard');
table(
  ['Tab', 'Chức năng chính'],
  [
    ['Dashboard', 'KPI: số user, gói đang hoạt động, doanh thu tháng, lượt dùng trong ngày'],
    ['Người dùng', 'Tìm kiếm, xem chi tiết; cấp gói thủ công / hủy gói đang hoạt động'],
    ['Thanh toán', 'Danh sách giao dịch, xuất CSV theo năm'],
    ['Mã code', 'Tạo / bật-tắt / xóa promo code'],
    ['Cấu hình', 'Sửa system_config (chủ yếu cho chế độ SQLite) theo nhóm'],
    ['API Keys', 'Quản lý pool key theo provider: thêm/xóa/bật-tắt/reset, mở rộng giới hạn (Postgres)'],
    ['Nội dung website', 'CMS: sửa trang (giới thiệu, điều khoản…) và bài viết, đa ngôn ngữ'],
    ['Doanh thu HKD', 'Bóc tách doanh thu tháng/năm, tính thuế, xuất CSV'],
    ['Hóa đơn', 'Phát hành hóa đơn điện tử (Viettel/MISA/nội bộ), cấu hình thông tin tổ chức'],
  ],
  [26, 74]
);

// ───────────────────────── 4. QUẢN LÝ API KEY ─────────────────────────
H1('4. Quản lý API key — Trọng tâm & tối ưu chi phí');
P([b('Đây là phần quan trọng nhất.'), t(' Mục tiêu: phục vụ được nhiều người dùng nhưng giảm tối đa chi phí gọi AI, bằng cách '), b('ưu tiên dùng hết hạn mức miễn phí (free tier) trước khi đụng tới key trả phí.')]);

H2('4.1 Cơ chế pool hiện tại');
bullet([b('Mỗi provider có nhiều key'), t(' (mặc định tối đa 10, mở rộng được tới 1000).')]);
bullet([b('Chọn key: '), t('lấy các key đang bật và "ok" hoặc cooldown đã hết hạn, sắp theo '), code('last_used_at ASC, sort_order ASC'), t(' (ít dùng gần nhất trước → xoay vòng đều).')]);
bullet([b('Failover trong 1 request: '), t('thử lần lượt từng key tới khi thành công; key lỗi bị đánh dấu rồi nhảy key kế.')]);
bullet([b('Phân loại lỗi → xử lý key:')]);
table(
  ['Lỗi upstream', 'Xử lý key', 'Ý nghĩa'],
  [
    ['401 / 403', 'disable (tắt hẳn)', 'Key sai / hết hạn / bị cấm'],
    ['429 (kèm quota/exhausted/billing)', 'cooldown 6 giờ', 'Hết hạn mức (thường là free tier cạn trong ngày)'],
    ['429 (rate thường)', 'cooldown 60 giây', 'Gọi quá nhanh, nghỉ ngắn rồi dùng lại'],
    ['quota / invalid key (text)', 'cooldown 6 giờ', 'Hết quota hoặc key hỏng'],
    ['5xx', 'cooldown 30 giây', 'Lỗi tạm thời phía nhà cung cấp'],
  ],
  [34, 26, 40]
);
P([b('Mô hình STT Gemini'), t(' đã ưu tiên model rẻ trước: thử '), code('gemini-2.5-flash-lite'), t(' → model bạn chỉ định → '), code('gemini-2.5-flash'), t('. Đây là tối ưu chi phí có sẵn ở tầng model.')]);

H2('4.2 Thêm / quản lý key qua dashboard');
table(
  ['Thao tác', 'Endpoint', 'Tham số'],
  [
    ['Liệt kê (gom theo provider)', 'GET /api/v2/admin/provider-keys', '—'],
    ['Thêm key', 'POST /api/v2/admin/provider-keys', '{ provider, key, label }'],
    ['Sửa (bật/tắt, nhãn, reset)', 'PATCH /api/v2/admin/provider-keys/:id', '{ enabled, label, resetStatus }'],
    ['Xóa key', 'DELETE /api/v2/admin/provider-keys/:id', '—'],
    ['Đặt giới hạn số key', 'POST /api/v2/admin/provider-keys/limit', '{ provider, maxKeys }'],
  ],
  [30, 44, 26]
);
P([t('Provider hợp lệ: '), code('gemini'), t(', '), code('groq'), t(', '), code('openai'), t(', '), code('assemblyai'), t('. Mỗi key hiển thị: 4 ký tự cuối, trạng thái (ok/cooldown/disabled), nhãn, số lần dùng, số lần lỗi.')]);

H2('4.3 Chiến lược ưu tiên key FREE để giảm chi phí');
callout('Hạn chế hiện tại cần biết', [
  'Thứ tự chọn key đang ưu tiên "ít dùng gần nhất" (last_used_at) TRƯỚC sort_order. Vì vậy nếu trộn key free và key trả phí trong cùng provider, hệ thống vẫn xoay vòng đều cả hai → KHÔNG đảm bảo dùng hết free trước. Cột sort_order hiện chỉ là tiêu chí phụ.',
]);
H3('Cách làm tốt nhất hôm nay (không cần sửa code)');
num('Tạo key free trên các nền tảng có hạn mức miễn phí: Gemini (Google AI Studio – free tier rộng), Groq (free tier nhanh). Đây là 2 nguồn nên khai thác trước.', 'n1');
num('Nạp THẬT NHIỀU key free vào pool của từng provider free (mở rộng giới hạn nếu cần). Mỗi key free có hạn mức riêng theo ngày → càng nhiều key free, tổng hạn mức free càng lớn, càng ít phải đụng key trả phí.', 'n1');
num('Để dành provider trả phí (OpenAI Whisper, AssemblyAI) làm phương án dự phòng: chỉ thêm key của chúng khi thực sự cần chất lượng/độ ổn định cao; nếu muốn "free trước" tuyệt đối thì tạm chưa thêm key trả phí, hoặc tắt (enabled = false) và chỉ bật khi free cạn.', 'n1');
num('Phía app/web nên chọn provider theo thứ tự rẻ trước (Gemini free → Groq → mới tới trả phí). Đây là quyết định ở tầng client khi gọi /proxy/transcribe.', 'n1');
num('Theo dõi cột "fail_count" và trạng thái cooldown trên dashboard: nếu nhiều key free cùng cooldown 6h nghĩa là free đã cạn trong ngày — đó là lúc bật key trả phí.', 'n1');

callout('✅ ĐÃ TRIỂN KHAI (v1.4.6+)', [
  'Hệ thống đã thêm "hạng" (tier) cho mỗi key: 0 = FREE, 1 = trả phí. Thứ tự chọn key đổi thành tier ASC, last_used_at ASC, sort_order ASC — luôn vắt hết key FREE rồi mới sang key trả phí, trong cùng hạng vẫn xoay vòng đều.',
  'Trên dashboard tab "API Keys": có nhãn FREE/Trả phí, đếm số key free/paid mỗi provider, nút đổi hạng nhanh, và ô chọn hạng khi thêm key. Hãy nạp nhiều key FREE và đặt key OpenAI/AssemblyAI ở hạng Trả phí (dự phòng).',
]);
H3('Nâng cấp đề xuất tiếp theo (xem ROADMAP)');
bullet([b('Thêm thứ tự ưu tiên provider ở server: '), t('ví dụ gemini → groq → openai → assemblyai, để khi client không chỉ định, backend tự chọn provider rẻ nhất còn hạn mức.')]);
bullet([b('Cảnh báo cạn pool: '), t('khi tỉ lệ key cooldown/disabled vượt ngưỡng, gửi cảnh báo (webhook/email) để admin nạp thêm key.')]);
bullet([b('Theo dõi chi phí: '), t('ghi nhận lượt dùng theo từng key + provider để biết provider nào đang tốn tiền.')]);
callout('Khuyến nghị nhanh để giảm chi phí ngay', [
  '1) Ưu tiên Gemini (flash-lite) + Groq cho phiên âm — đây là combo rẻ/miễn phí và đủ tốt.',
  '2) Nạp nhiều key free; chỉ bật key OpenAI/AssemblyAI khi free cạn.',
  '3) Đặt lịch nhắc tạo thêm key free mỗi khi thấy cooldown 6h xuất hiện nhiều.',
]);

// ───────────────────────── 5. CẤU HÌNH HỆ THỐNG ─────────────────────────
H1('5. Cấu hình hệ thống (ENV / system_config)');
P([t('Ở '), b('production (Postgres) các giá trị nhạy cảm đọc từ BIẾN MÔI TRƯỜNG'), t(' (Vercel → Project Settings → Environment Variables). Bảng '), code('system_config'), t(' chủ yếu dùng cho chế độ SQLite legacy.')]);

H3('5.1 Hạ tầng & bảo mật');
table(['Biến ENV', 'Mô tả'], [
  ['DATABASE_URL', 'Chuỗi kết nối PostgreSQL (bật chế độ Postgres)'],
  ['ADMIN_API_KEY', 'Khóa truy cập API admin v2'],
  ['JWT_SECRET', 'Bí mật ký JWT đăng nhập admin'],
  ['DEVICE_AUTH_SECRET', 'Bí mật ký token thiết bị (app)'],
  ['CORS_ALLOWED_ORIGINS', 'Danh sách origin được phép gọi API'],
  ['SENTRY_DSN', 'Giám sát lỗi (tùy chọn)'],
  ['PUBLIC_APP_URL', 'URL app dùng cho redirect Stripe'],
], [38, 62]);

H3('5.2 Key AI (fallback ENV — pool DB là chính)');
table(['Biến ENV', 'Provider'], [
  ['ADMIN_GEMINI_API_KEY', 'Gemini (fallback)'],
  ['ADMIN_GROQ_API_KEY', 'Groq (fallback)'],
  ['ADMIN_OPENAI_API_KEY', 'OpenAI (fallback)'],
  ['ADMIN_ASSEMBLYAI_API_KEY', 'AssemblyAI (fallback)'],
], [55, 45]);
P([t('Các key ENV này chỉ được dùng làm '), b('phương án cuối'), t(' khi pool DB trống. Khuyến nghị: quản lý key qua pool (tab API Keys) để có xoay vòng + failover; ENV chỉ để dự phòng.')]);

H3('5.3 Google Drive hệ thống & quảng cáo');
table(['Khóa', 'Mô tả'], [
  ['SYSTEM_GOOGLE_CLIENT_ID / SYSTEM_GOOGLE_API_KEY', 'Tích hợp Google Drive hệ thống'],
  ['ADMOB_APP_ID / ADMOB_BANNER_ID / ADMOB_REWARDED_ID', 'Quảng cáo Google AdMob (app)'],
  ['CUSTOM_BANNER_HTML / CUSTOM_BANNER_ENABLED', 'Banner quảng cáo tự đặt thay AdMob'],
], [50, 50]);

// ───────────────────────── 6. THANH TOÁN ─────────────────────────
H1('6. Luồng thanh toán đầy đủ');

H2('6.1 Gói dịch vụ & giá');
table(['Mã gói', 'Quyền lợi', 'Giá mặc định (VND)'], [
  ['monthly_20', '20 lượt/tháng, tắt quảng cáo, dùng key hệ thống', '39.000'],
  ['monthly_50', '50 lượt/tháng, tắt quảng cáo', '59.000'],
  ['monthly_100', '100 lượt/tháng, tắt quảng cáo', '99.000'],
  ['own_key_ads', 'Dùng key riêng, còn quảng cáo (trọn đời)', '199.000'],
  ['own_key_no_ads', 'Dùng key riêng, tắt quảng cáo (trọn đời)', '248.000'],
  ['disable_ads', 'Tắt quảng cáo (add-on)', '49.000'],
  ['promo', 'Gói khuyến mãi (kích hoạt bằng mã)', '—'],
  ['lifetime', 'Trọn đời, tắt quảng cáo (legacy)', '999.000'],
], [22, 52, 26]);
P([t('Chiết khấu theo kỳ hạn: '), code('discount_3m'), t(' (3%), '), code('discount_6m'), t(' (5%), '), code('discount_12m'), t(' (8%). Tỉ giá quy đổi Stripe: ~25.000 VND = 1 USD.')]);

H2('6.2 SePay (chuyển khoản ngân hàng + QR)');
num('App gọi POST /api/v2/orders → backend tạo đơn mã dạng TSR + 12 ký tự hex.', 'sep');
num('Backend trả về URL QR: https://qr.sepay.vn/img?acc=...&bank=...&amount=...&des=<mã đơn>. Nội dung chuyển khoản chính là MÃ ĐƠN.', 'sep');
num('Người dùng chuyển khoản → SePay gọi webhook POST /api/v2/webhooks/sepay.', 'sep');
num('Webhook được xác thực bằng SEPAY_WEBHOOK_API_KEY (header Authorization: Apikey/Bearer) hoặc HMAC SEPAY_WEBHOOK_HMAC_SECRET (header x-sepay-signature).', 'sep');
num('Backend khớp mã đơn → fulfillOrder(): đổi đơn sang "paid", tạo entitlement (gói, hạn dùng, lượt, tắt quảng cáo), ghi sổ doanh thu, lên lịch xuất hóa đơn.', 'sep');
table(['Cấu hình SePay (ENV)', 'Mô tả'], [
  ['SEPAY_WEBHOOK_API_KEY', 'Khóa xác thực webhook (cách 1)'],
  ['SEPAY_WEBHOOK_HMAC_SECRET', 'Bí mật HMAC xác thực webhook (cách 2)'],
  ['SEPAY_BANK_ACCOUNT / SEPAY_BANK_CODE', 'Số tài khoản & mã ngân hàng nhận tiền'],
  ['SEPAY_ACCOUNT_NAME', 'Tên chủ tài khoản'],
], [45, 55]);

H2('6.3 Stripe (thẻ quốc tế)');
num('Tạo phiên thanh toán qua POST /api/v2/orders (provider=stripe) hoặc /api/client/payments/create-stripe-session; trả về checkoutUrl.', 'str');
num('Stripe gọi webhook POST /api/v2/webhooks/stripe, sự kiện checkout.session.completed.', 'str');
num('Xác thực chữ ký bằng STRIPE_WEBHOOK_SECRET (header stripe-signature); cần STRIPE_SECRET_KEY để khởi tạo Stripe.', 'str');
num('payment_status = paid → fulfillOrder() kích hoạt gói như SePay.', 'str');
callout('Bắt buộc khi bật thanh toán', [
  '• SePay: cấu hình đúng số TK + đăng ký webhook trỏ về /api/v2/webhooks/sepay kèm khóa xác thực.',
  '• Stripe: đặt STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET (lấy từ Stripe Dashboard → Webhooks), và PUBLIC_APP_URL để redirect.',
  '• Test webhook ở chế độ thử trước khi mở bán thật.',
]);

H2('6.4 Promo code, hoàn tiền & hóa đơn điện tử');
bullet([b('Promo: '), t('app gọi POST /api/v2/promo/redeem {deviceKey, code}; kiểm tra is_active, max_uses, hạn dùng → cấp entitlement theo plan_code. Admin tạo mã ở tab "Mã code".')]);
bullet([b('Hoàn tiền: '), t('Stripe tự động (POST /api/v2/admin/orders/:code/refund) → đổi đơn "refunded", thu hồi entitlement, ghi sổ âm. SePay phải hoàn thủ công.')]);
bullet([b('Hóa đơn điện tử: '), t('tự lên lịch sau khi đơn thanh toán. Nhà cung cấp: internal (HTML nội bộ), Viettel S-Invoice, MISA meInvoice, hoặc manual. Cấu hình thông tin tổ chức (tên, MST, địa chỉ, VAT) ở tab "Hóa đơn".')]);
table(['Nhà cung cấp HĐĐT', 'Biến ENV cần có'], [
  ['Viettel', 'VIETTEL_EINVOICE_API_URL / USERNAME / PASSWORD'],
  ['MISA', 'MISA_EINVOICE_API_URL / APP_ID / TAX_CODE / ACCESS_TOKEN'],
  ['Internal / Manual', 'Không cần (xuất nội bộ / thủ công)'],
], [30, 70]);

// ───────────────────────── 7. ĐIỀU KIỆN ĐẨY RA ─────────────────────────
H1('7. Cấu hình cần có để admin "đẩy ra" (go-live)');
P('Danh sách tối thiểu để hệ thống chạy thật và admin vận hành được:');
num('Backend: DATABASE_URL, ADMIN_API_KEY, JWT_SECRET, DEVICE_AUTH_SECRET, CORS_ALLOWED_ORIGINS, PUBLIC_APP_URL.', 'golive');
num('AI: nạp ít nhất vài key free (Gemini, Groq) vào pool ở tab API Keys; đặt giới hạn đủ lớn.', 'golive');
num('Thanh toán: bật & cấu hình SePay và/hoặc Stripe kèm khóa webhook; đăng ký webhook trên cổng tương ứng.', 'golive');
num('Giá & gói: kiểm tra lại giá từng gói, chiết khấu kỳ hạn.', 'golive');
num('Quảng cáo (nếu dùng): AdMob IDs hoặc custom banner.', 'golive');
num('Hóa đơn (nếu xuất HĐĐT): thông tin tổ chức + nhà cung cấp + ENV tương ứng.', 'golive');
num('Nội dung: kiểm tra trang Giới thiệu/Điều khoản/Bảo mật + trang Tải ứng dụng (/tai-app).', 'golive');
num('Tài khoản admin: đổi mật khẩu mặc định; lưu ADMIN_API_KEY an toàn.', 'golive');

// ───────────────────────── 8. LUỒNG CẬP NHẬT ─────────────────────────
H1('8. Luồng phát hành bản cập nhật (web & app)');

H2('8.1 Web / ứng dụng web');
bullet([b('Cập nhật tức thì.'), t(' Đẩy code lên Vercel (build & deploy). Người dùng web nhận bản mới ngay khi tải lại trang. Không qua store.')]);
bullet([t('Nhớ cập nhật '), code('public/sitemap.xml'), t(' và biến '), code('VITE_APP_VERSION'), t(' khi phát hành.')]);

H2('8.2 App di động (Capacitor)');
callout('Điểm mấu chốt về kiến trúc', [
  'App đang đóng gói web TĨNH (capacitor.config.ts: webDir = "dist", KHÔNG trỏ server.url từ xa). Nghĩa là sửa code web KHÔNG tự tới app đã cài — phải build lại app và phát hành qua store. Hiện CHƯA có cơ chế OTA/live-update và CHƯA có màn hình bắt buộc cập nhật.',
]);
H3('Quy trình phát hành app');
num('Sửa code → npm run build (ra dist/).', 'rel');
num('Đồng bộ vào native: npx cap sync android (và cap sync ios trên macOS).', 'rel');
num('Tăng versionCode + versionName trong android/app/build.gradle (và bản iOS tương ứng).', 'rel');
num('Android: gradlew bundleRelease (AAB đã ký) → upload Play Console. iOS: Xcode Archive → App Store Connect / TestFlight.', 'rel');
num('Chờ store duyệt → người dùng cập nhật qua store. Đảm bảo VITE_BACKEND_URL trỏ backend production khi build.', 'rel');

H3('Khuyến nghị hoàn thiện luồng cập nhật');
callout('✅ ĐÃ TRIỂN KHAI: cổng kiểm tra phiên bản (server-driven)', [
  'Endpoint công khai GET /api/client/app-version?platform=&version= trả {minVersion, latestVersion, forceUpdate, notes, updateUrl, updateRequired, updateAvailable}.',
  'App (native) gọi lúc khởi động: nếu updateRequired -> hiện overlay BẮT BUỘC cập nhật (không bỏ qua được) + nút mở updateUrl. Web không bị chặn.',
  'Admin chỉnh tại tab "Phiên bản app" (minVersion / latestVersion / bật forceUpdate / URL Android-iOS / changelog) — lưu vào bảng app_release_config_v2, KHÔNG cần sửa ENV.',
  'Chỉ bật forceUpdate khi bản mới đã có trên store/URL.',
]);
bullet([b('Cân nhắc OTA/live-update '), t('(Capacitor live updates / @capgo/capacitor-updater) để vá phần web không cần chờ store duyệt — rất hữu ích cho sửa lỗi gấp.')]);
bullet([b('Quản lý changelog trong admin '), t('(qua system_config hoặc CMS) để cập nhật nội dung "Có gì mới" mà không cần build lại.')]);

// ───────────────────────── 9. ROADMAP ─────────────────────────
H1('9. Việc nên nâng cấp (ưu tiên)');
table(['Ưu tiên', 'Hạng mục', 'Lợi ích'],
[
  ['✅ Xong', 'Tier free/paid cho pool key + ưu tiên free trước', 'Giảm chi phí AI rõ rệt (đã triển khai)'],
  ['Cao', 'Thứ tự provider rẻ-trước ở server', 'Tự chọn nguồn rẻ nhất còn hạn mức'],
  ['✅ Xong', 'Endpoint version-check + màn hình bắt buộc cập nhật', 'Kiểm soát phiên bản (đã triển khai)'],
  ['Vừa', 'Cảnh báo khi pool key sắp cạn', 'Tránh gián đoạn dịch vụ'],
  ['Vừa', 'OTA/live-update cho app', 'Cập nhật web không chờ store'],
  ['Vừa', 'Theo dõi chi phí theo key/provider', 'Tối ưu ngân sách'],
  ['Thấp', 'Panel nhập ENV nhạy cảm an toàn trong admin', 'Đỡ phải sửa ENV Vercel thủ công'],
], [14, 50, 36]);

spacer();
P([new TextRun({ text: '— Hết —', italics: true, color: '526760' })]);

// ───────────────────────── XUẤT FILE ─────────────────────────
const doc = new Document({
  creator: 'TSrecord',
  title: 'Hướng dẫn cấu hình & vận hành admin TSrecord',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22, color: '1A1A1A' } } },
  },
  numbering: {
    config: ['n1', 'sep', 'str', 'golive', 'rel'].map((ref) => ({
      reference: ref,
      levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }],
    })),
  },
  sections: [{
    properties: { page: { margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 } } },
    children,
  }],
});

const outPath = resolve(process.cwd(), 'docs', 'HUONG-DAN-CAU-HINH-ADMIN-TSrecord.docx');
mkdirSync(dirname(outPath), { recursive: true });
const buffer = await Packer.toBuffer(doc);
writeFileSync(outPath, buffer);
console.log('Đã tạo:', outPath, `(${buffer.length} bytes, ${children.length} blocks)`);
