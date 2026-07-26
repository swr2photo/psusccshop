// scratch/benchmark.ts
// Performance Benchmark Suite for PSUSCC Shop Core Functions

import { performance } from 'node:perf_hooks';
import { normalizeEmail, isSuperAdminEmail, isAdminEmail } from '../src/lib/auth';
import { checkRateLimit, RATE_LIMITS } from '../src/lib/rate-limit';
import { env } from '../src/lib/env';

function runBenchmark(name: string, fn: () => void, iterations = 100_000) {
  // Warmup
  for (let i = 0; i < 1_000; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  const totalMs = end - start;
  const avgUs = (totalMs / iterations) * 1000; // microseconds per op
  const opsPerSec = Math.round((iterations / totalMs) * 1000);

  console.log(`\n⚡ [Benchmark] ${name}`);
  console.log(`   - Total Time (${iterations.toLocaleString()} ops): ${totalMs.toFixed(2)} ms`);
  console.log(`   - Average Latency per Operation: ${avgUs.toFixed(4)} μs (${(avgUs / 1000).toFixed(6)} ms)`);
  console.log(`   - Throughput: ${opsPerSec.toLocaleString()} ops/sec`);
  return { name, totalMs, avgUs, opsPerSec };
}

async function main() {
  console.log('=============== 🚀 SYSTEM PERFORMANCE BENCHMARK ===============');
  console.log(`Runtime: Node.js ${process.version} | Platform: ${process.platform} (${process.arch})`);

  // 1. Email Normalization Benchmark
  runBenchmark('Email Normalization (normalizeEmail)', () => {
    normalizeEmail('   USER.Test_123@PSUSCC.CLUB   ');
  }, 500_000);

  // 2. Super Admin Authorization Check
  runBenchmark('Super Admin Email Check (isSuperAdminEmail)', () => {
    isSuperAdminEmail('superadmin@psuscc.club');
  }, 500_000);

  // 3. Static Admin Check
  runBenchmark('Static Admin Email Lookup (isAdminEmail)', () => {
    isAdminEmail('admin@psuscc.club');
  }, 500_000);

  // 4. Rate Limiting Check Speed
  runBenchmark('In-Memory Rate Limit Check (checkRateLimit)', () => {
    checkRateLimit('192.168.1.100', RATE_LIMITS.api);
  }, 100_000);

  // 5. Env Variable Access Speed
  runBenchmark('Environment Variable Read (env.NODE_ENV)', () => {
    const _ = env.NODE_ENV;
  }, 1_000_000);

  console.log('\n=================================================================');
}

main();
