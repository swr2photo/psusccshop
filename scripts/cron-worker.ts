// scripts/cron-worker.ts
// Standalone cron worker for Railway deployment
// Run with: npx tsx scripts/cron-worker.ts

import cron from 'node-cron';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` 
  : 'http://localhost:3000';

const CRON_SECRET = process.env.CRON_SECRET || 'psusccshop-cron-2026';

console.log('🚀 Cron Worker Starting...');
console.log(`📍 App URL: ${APP_URL}`);

interface CronJob {
  name: string;
  schedule: string;
  endpoint: string;
  description: string;
}

const cronJobs: CronJob[] = [
  {
    name: 'cancel-expired',
    schedule: '*/30 * * * *', // ทุก 30 นาที (เร็วกว่า Vercel)
    endpoint: '/api/cron/cancel-expired',
    description: 'ยกเลิกออเดอร์ที่ยังไม่ชำระเงินเกิน 24 ชม.',
  },
  {
    name: 'cleanup',
    schedule: '0 */6 * * *', // ทุก 6 ชั่วโมง (เร็วกว่า Vercel)
    endpoint: '/api/cron/cleanup',
    description: 'ลบข้อมูลเก่า, auto-rotate API keys',
  },
];

async function runCronJob(job: CronJob): Promise<void> {
  const startTime = Date.now();
  console.log(`\n⏰ [${new Date().toISOString()}] Running: ${job.name}`);
  console.log(`   📝 ${job.description}`);
  
  try {
    const response = await fetch(`${APP_URL}${job.endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Railway-Cron-Worker/1.0',
      },
    });
    
    const data = await response.json();
    const duration = Date.now() - startTime;
    
    if (response.ok) {
      console.log(`   ✅ Success in ${duration}ms`);
      console.log(`   📊 Result:`, JSON.stringify(data, null, 2).split('\n').map(l => `      ${l}`).join('\n'));
    } else {
      console.error(`   ❌ Failed (${response.status}) in ${duration}ms`);
      console.error(`   📊 Error:`, data);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`   ❌ Error in ${duration}ms:`, error);
  }
}

// Register all cron jobs
cronJobs.forEach(job => {
  console.log(`📅 Registering: ${job.name} (${job.schedule})`);
  
  cron.schedule(job.schedule, () => {
    runCronJob(job).catch(console.error);
  }, {
    timezone: 'Asia/Bangkok',
  });
});

console.log('\n✅ Cron Worker Ready!');
console.log('📋 Registered Jobs:');
cronJobs.forEach(job => {
  console.log(`   - ${job.name}: ${job.schedule} → ${job.endpoint}`);
});

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n🛑 Cron Worker Shutting Down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Cron Worker Terminated');
  process.exit(0);
});

// Health check endpoint (optional, for Railway)
if (process.env.CRON_HEALTH_PORT) {
  const http = require('http');
  const port = parseInt(process.env.CRON_HEALTH_PORT);
  
  http.createServer((req: any, res: any) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      jobs: cronJobs.map(j => ({ name: j.name, schedule: j.schedule })),
      uptime: process.uptime(),
    }));
  }).listen(port, () => {
    console.log(`\n🏥 Health check: http://localhost:${port}`);
  });
}
