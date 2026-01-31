import { trackShipmentWithFallback } from '../src/lib/shipping';

async function main() {
  const trackingNumber = 'EG123456789TH'; // Example
  console.log('Testing tracking for:', trackingNumber);
  
  try {
    const result = await trackShipmentWithFallback('thailand_post', trackingNumber);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
