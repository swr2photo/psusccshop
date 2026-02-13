#!/usr/bin/env npx tsx
// scripts/import-slipok-urls.ts
// Script สำหรับ import slip URLs จาก SlipOK log

import { createClient } from '@supabase/supabase-js';

// ข้อมูลจาก SlipOK log (copy จาก dashboard)
// Format: id, transactionDate, slipDate, amount, receiver, receiverAccount, senderName, senderBank, senderAccount, receiverName, receiverBank, qr1, qr2, imageUrl, transRef
//
// ⚠️  PII REMOVED — paste actual SlipOK tab-separated data below before running
// Example format (tab-separated):
// 12345678\t<date>\t<date>\t340\tPSUSCC\tPSUSCC\t<account>\t<name>\tkbank\t<masked>\t<sender>\t<masked>\t<receiver>\t\t\t<imageUrl>\t<transRef>
//
const SLIPOK_DATA_FILE = process.env.SLIPOK_DATA_FILE || '';
import { existsSync, readFileSync } from 'fs';

let SLIPOK_DATA: string;
if (SLIPOK_DATA_FILE && existsSync(SLIPOK_DATA_FILE)) {
  SLIPOK_DATA = readFileSync(SLIPOK_DATA_FILE, 'utf-8').trim();
  console.log(`📄 Loaded SlipOK data from file: ${SLIPOK_DATA_FILE}`);
} else {
  console.error('❌ Set SLIPOK_DATA_FILE env var pointing to a TSV file with SlipOK data.');
  console.error('   Example: SLIPOK_DATA_FILE=./slipok-data.tsv npx tsx scripts/import-slipok-urls.ts');
  process.exit(1);
}

interface ParsedSlipOKLog {
  id: string;
  transactionDate: string;
  slipDate: string;
  amount: number;
  receiver: string;
  receiverAccountId: string;
  receiverAccountName: string;
  senderBank: string;
  senderAccount: string;
  senderName: string;
  receiverBankAccount: string;
  receiverName: string;
  qr1: string;
  qr2: string;
  imageUrl: string;
  transRef: string;
}

function parseSlipOKLog(data: string): ParsedSlipOKLog[] {
  const lines = data.split('\n').filter(l => l.trim());
  return lines.map(line => {
    const parts = line.split('\t');
    return {
      id: parts[0],
      transactionDate: parts[1],
      slipDate: parts[2],
      amount: parseFloat(parts[3]) || 0,
      receiver: parts[4],
      receiverAccountId: parts[5],
      receiverAccountName: parts[6],
      senderBank: parts[7] || parts[8], // อาจสลับกัน
      senderAccount: parts[9],
      senderName: parts[10],
      receiverBankAccount: parts[11],
      receiverName: parts[12],
      qr1: parts[13],
      qr2: parts[14],
      imageUrl: parts[15],
      transRef: parts[16],
    };
  });
}

async function main() {
  // Load env
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE env vars');
    console.log('Usage: source .env.local && npx tsx scripts/import-slipok-urls.ts');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('🔍 Parsing SlipOK data...');
  const slipokLogs = parseSlipOKLog(SLIPOK_DATA);
  console.log(`Found ${slipokLogs.length} entries\n`);

  // แสดงข้อมูลที่ parse ได้
  for (const log of slipokLogs) {
    console.log(`📝 ID: ${log.id}`);
    console.log(`   Amount: ${log.amount} THB`);
    console.log(`   Sender: ${log.senderName}`);
    console.log(`   TransRef: ${log.transRef}`);
    console.log(`   Image: ${log.imageUrl}`);
    console.log('');
  }

  // ดึง orders ที่เป็น PAID
  console.log('📦 Fetching PAID orders...');
  const { data: orders, error } = await supabase
    .from('orders')
    .select('ref, status, total_amount, slip_data, created_at, customer_name')
    .eq('status', 'PAID')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    process.exit(1);
  }

  console.log(`Found ${orders?.length || 0} PAID orders\n`);

  // แสดง orders
  for (const order of orders || []) {
    const slip = order.slip_data;
    const hasImage = slip && (slip.imageUrl || slip.base64);
    console.log(`📦 Order: ${order.ref}`);
    console.log(`   Amount: ${order.total_amount} THB`);
    console.log(`   Customer: ${order.customer_name}`);
    console.log(`   Has slip image: ${hasImage ? '✅' : '❌'}`);
    if (slip?.slipData?.transRef) {
      console.log(`   TransRef in DB: ${slip.slipData.transRef}`);
    }
    console.log('');
  }

  // พยายาม match โดยใช้ amount (เพราะ transRef อาจไม่ได้เก็บไว้)
  console.log('\n🔗 Attempting to match by amount...\n');

  const updates: { orderRef: string; imageUrl: string; slipData: any }[] = [];
  const usedSlipOKIds = new Set<string>();

  for (const order of orders || []) {
    const slip = order.slip_data;
    
    // ถ้ามี imageUrl อยู่แล้ว skip
    if (slip?.imageUrl) {
      console.log(`⏭️  ${order.ref} - already has imageUrl`);
      continue;
    }

    // หา match จาก SlipOK log โดยใช้ amount
    const matchingLog = slipokLogs.find(log => 
      !usedSlipOKIds.has(log.id) && 
      Math.abs(log.amount - order.total_amount) < 1
    );

    if (matchingLog) {
      usedSlipOKIds.add(matchingLog.id);
      updates.push({
        orderRef: order.ref,
        imageUrl: matchingLog.imageUrl,
        slipData: {
          transRef: matchingLog.transRef,
          amount: matchingLog.amount,
          senderName: matchingLog.senderName,
          senderBank: matchingLog.senderBank,
          receiverName: matchingLog.receiverName,
        },
      });
      console.log(`✅ Matched: ${order.ref} (${order.total_amount} THB) -> ${matchingLog.imageUrl}`);
    } else {
      console.log(`❌ No match: ${order.ref} (${order.total_amount} THB)`);
    }
  }

  // Confirm before updating
  if (updates.length === 0) {
    console.log('\n✨ No updates needed!');
    return;
  }

  console.log(`\n📊 Summary: ${updates.length} orders to update`);
  console.log('Updates:');
  for (const u of updates) {
    console.log(`  - ${u.orderRef}: ${u.imageUrl}`);
  }

  // Check if running in auto mode
  const autoMode = process.argv.includes('--auto');
  
  if (!autoMode) {
    console.log('\n⚠️  Run with --auto flag to apply updates');
    console.log('   Example: npx tsx scripts/import-slipok-urls.ts --auto');
    return;
  }

  console.log('\n🚀 Applying updates...\n');

  for (const update of updates) {
    // ดึง order ปัจจุบัน
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('ref, slip_data')
      .eq('ref', update.orderRef)
      .single();

    if (fetchError || !order) {
      console.log(`❌ Failed to fetch ${update.orderRef}: ${fetchError?.message}`);
      continue;
    }

    // Update slip_data
    const updatedSlipData = {
      ...order.slip_data,
      imageUrl: update.imageUrl,
      slipData: {
        ...order.slip_data?.slipData,
        ...update.slipData,
      },
      importedFromSlipOK: true,
      importedAt: new Date().toISOString(),
    };

    // ลบ base64 ถ้ามี
    if (updatedSlipData.base64) {
      delete updatedSlipData.base64;
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ slip_data: updatedSlipData })
      .eq('ref', update.orderRef);

    if (updateError) {
      console.log(`❌ Failed to update ${update.orderRef}: ${updateError.message}`);
    } else {
      console.log(`✅ Updated: ${update.orderRef}`);
    }
  }

  console.log('\n✨ Done!');
}

main().catch(console.error);
