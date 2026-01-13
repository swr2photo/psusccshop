// --- PromptPay Helpers ---
function crc16(s: string) {
  let crc = 0xFFFF;
  for (let i = 0; i < s.length; i++) {
    let x = ((crc >> 8) ^ s.charCodeAt(i)) & 0xFF;
    x ^= x >> 4;
    crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(id: string, val: string) {
  return id + String(val.length).padStart(2, '0') + val;
}

export function generatePromptPayQR(amount: number) {
  const ppID = process.env.PROMPTPAY_ID || '';
  if (!ppID) return '';
  
  const amountStr = amount.toFixed(2);
  let target = '';

  // Logic แยกประเภท ID (E-Wallet vs ID Card vs Mobile)
  if (ppID.startsWith('00466')) target = ppID; 
  else if (ppID.length >= 13) target = ppID;   
  else target = '0066' + ppID.replace(/^0/, '');

  const payload = [
    '000201', '010211',
    tlv('29', tlv('00', 'A000000677010111') + tlv(ppID.startsWith('00466') ? '03' : (ppID.length >= 13 ? '02' : '01'), target)),
    '5303764', tlv('54', amountStr), '5802TH', '6304'
  ].join('');

  return `https://quickchart.io/qr?size=300&text=${encodeURIComponent(payload + crc16(payload))}`;
}

// --- Pricing Logic (ต้องตรงกับหน้าเว็บ) ---
export function calculateOrderTotal(items: any[]) {
  if (!Array.isArray(items)) return 0;
  let total = 0;
  
  // ตารางราคา
  const PRICES: any = {
    JERSEY: { 'S': 339, 'M': 339, 'L': 339, 'XL': 339, '2XL': 349, '3XL': 349, '4XL': 369, '5XL': 369 },
    CREW:   { 'S': 249, 'M': 249, 'L': 249, 'XL': 249, '2XL': 279, '3XL': 279, '4XL': 289, '5XL': 289 }
  };

  items.forEach((item) => {
    let p = 0;
    const name = String(item.name || '').toUpperCase();
    const size = item.size || 'S';
    
    if (name.includes('JERSEY')) { 
      p = PRICES.JERSEY[size] || 339;
      // แขนยาว +50
      if ((item.sleeve || '').toUpperCase() === 'LONG' || name.includes('LONG')) p += 50; 
    }
    else if (name.includes('CREW')) { 
      p = PRICES.CREW[size] || 249; 
    }
    else { 
      p = Number(item.price || 0); 
    }
    
    total += p * Number(item.qty || 1);
  });
  return total;
}