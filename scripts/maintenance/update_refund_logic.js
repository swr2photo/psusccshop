const fs = require('fs');
const path = 'src/components/OrderHistoryDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

const target1 = `const paymentVerifiedDate = order.paymentVerifiedAt ? new Date(order.paymentVerifiedAt) : null;`;
const target2 = `const isWithin5Days = paymentVerifiedDate ? (new Date().getTime() - paymentVerifiedDate.getTime()) <= 5 * 24 * 60 * 60 * 1000 : false;`;

const replacement = `const orderDateStr = order.receiptIssuedAt || order.paymentVerifiedAt || order.date;
              const referenceDate = orderDateStr ? new Date(orderDateStr) : null;
              const isWithin5Days = referenceDate ? (new Date().getTime() - referenceDate.getTime()) <= 5 * 24 * 60 * 60 * 1000 : false;`;

content = content.replace(target1 + '\n              ' + target2, replacement);
// In case of different line endings/spacing
if (!content.includes(replacement)) {
    content = content.replace(target1 + '\r\n              ' + target2, replacement);
}
if (!content.includes(replacement)) {
    content = content.replace(target1 + ' ' + target2, replacement);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed refund logic in OrderHistoryDrawer.tsx');
