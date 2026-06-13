import type { StandardInvoiceData } from './types.js';

const formatMoney = (minor: number, currency: string): string => {
  if (currency === 'VND') {
    return new Intl.NumberFormat('vi-VN').format(minor) + ' đ';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(minor / 100);
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export const renderStandardInvoiceHtml = (invoice: StandardInvoiceData): string => {
  const title = invoice.seller.entityType === 'company'
    ? 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG'
    : 'HÓA ĐƠN BÁN HÀNG';

  const rows = invoice.lineItems.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td class="center">${escapeHtml(item.unit)}</td>
      <td class="right">${item.quantity}</td>
      <td class="right">${formatMoney(item.unitPriceMinor, invoice.currency)}</td>
      <td class="right">${formatMoney(item.amountMinor, invoice.currency)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    body { font-family: "Times New Roman", serif; color: #111; margin: 24px; }
    h1 { text-align: center; font-size: 22px; margin-bottom: 4px; }
    .meta { text-align: center; margin-bottom: 20px; font-size: 14px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; font-size: 14px; }
    .box { border: 1px solid #999; padding: 12px; min-height: 120px; }
    .box h3 { margin: 0 0 8px; font-size: 14px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 12px; }
    th, td { border: 1px solid #999; padding: 8px; vertical-align: top; }
    th { background: #f3f3f3; }
    .right { text-align: right; }
    .center { text-align: center; }
    .totals { margin-top: 16px; width: 360px; margin-left: auto; font-size: 14px; }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
    .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 48px; text-align: center; font-size: 14px; }
    .note { margin-top: 20px; font-size: 13px; color: #444; }
    @media print { body { margin: 0; } button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;cursor:pointer;">In / Lưu PDF</button>
  <h1>${title}</h1>
  <div class="meta">
    <div><b>Mẫu số:</b> TSrecord-01 &nbsp;|&nbsp; <b>Ký hiệu:</b> ${escapeHtml(invoice.invoiceNumber.split('-')[0] || 'HD')}</div>
    <div><b>Số hóa đơn:</b> ${escapeHtml(invoice.invoiceNumber)} &nbsp;|&nbsp; <b>Ngày:</b> ${escapeHtml(invoice.issuedAt)}</div>
    <div><b>Mã đơn hàng:</b> ${escapeHtml(invoice.orderCode)}</div>
  </div>
  <div class="grid">
    <div class="box">
      <h3>Đơn vị bán hàng</h3>
      <div><b>${escapeHtml(invoice.seller.legalName)}</b></div>
      <div>MST: ${escapeHtml(invoice.seller.taxCode || '—')}</div>
      <div>Địa chỉ: ${escapeHtml(invoice.seller.address || '—')}</div>
    </div>
    <div class="box">
      <h3>Người mua hàng</h3>
      <div><b>${escapeHtml(invoice.buyer.name)}</b></div>
      <div>MST: ${escapeHtml(invoice.buyer.taxCode || '—')}</div>
      <div>Email: ${escapeHtml(invoice.buyer.email || '—')}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Tên hàng hóa, dịch vụ</th>
        <th>ĐVT</th>
        <th>SL</th>
        <th>Đơn giá</th>
        <th>Thành tiền</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>Tổng tiền hàng:</span><b>${formatMoney(invoice.grossAmountMinor, invoice.currency)}</b></div>
    <div><span>Thuế GTGT (${invoice.vatRate ?? 0}%):</span><b>${formatMoney(invoice.taxAmountMinor, invoice.currency)}</b></div>
    <div><span>Tổng thanh toán:</span><b>${formatMoney(invoice.grossAmountMinor, invoice.currency)}</b></div>
  </div>
  <div class="note">
    Hình thức thanh toán: ${escapeHtml(invoice.paymentMethod)}.<br />
    Ghi chú: ${escapeHtml(invoice.note)}
  </div>
  <div class="sign">
    <div>
      <div><b>Người mua hàng</b></div>
      <div style="margin-top:64px;">(Ký, ghi rõ họ tên)</div>
    </div>
    <div>
      <div><b>Người bán hàng</b></div>
      <div style="margin-top:64px;">(Ký, đóng dấu)</div>
    </div>
  </div>
</body>
</html>`;
};
