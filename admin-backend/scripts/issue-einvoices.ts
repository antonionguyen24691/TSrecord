import 'dotenv/config';
import { ensurePlatformSchema } from '../src/platform/schema.js';
import { issueEinvoiceForOrder, issuePendingEinvoices } from '../src/platform/einvoiceService.js';
import { one } from '../src/platform/database.js';

const args = process.argv.slice(2);
const orderFlagIndex = args.indexOf('--order');

const run = async () => {
  await ensurePlatformSchema();

  if (orderFlagIndex >= 0) {
    const orderCode = args[orderFlagIndex + 1]?.toUpperCase();
    if (!orderCode) {
      console.error('Thiếu mã đơn. Ví dụ: npm run einvoice:issue -- --order TSRABCDEF123456');
      process.exit(1);
    }
    const order = await one<{ id: string }>(
      'SELECT id FROM orders_v2 WHERE order_code = $1 AND status = $2',
      [orderCode, 'paid']
    );
    if (!order) {
      console.error(`Không tìm thấy đơn đã thanh toán: ${orderCode}`);
      process.exit(1);
    }
    const doc = await issueEinvoiceForOrder(order.id, { force: true });
    console.log(JSON.stringify({ ok: true, orderCode, invoiceNumber: doc?.invoice_number }, null, 2));
    return;
  }

  const result = await issuePendingEinvoices(100);
  console.log(JSON.stringify(result, null, 2));
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
