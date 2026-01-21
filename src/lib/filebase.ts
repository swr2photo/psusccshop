// src/lib/filebase.ts
// ===================================================================
// MIGRATED TO SUPABASE - This file now proxies to supabase.ts
// All functions maintain backward compatibility with the old API
// ===================================================================

// Re-export all functions from supabase.ts
export { 
  getJson, 
  putJson, 
  listKeys, 
  deleteObject,
  // Additional exports for direct database access (optional)
  supabase,
  getSupabaseAdmin,
  getOrdersByEmail,
  getAllOrders,
  getOrderByRef,
  updateOrderByRef,
  getExpiredUnpaidOrders,
  getShopConfig,
  updateShopConfig,
  // Security functions
  logSecurityEvent,
  getSecurityAuditLogs,
  cleanupOldData,
} from './supabase';

// Type exports
export type {
  DBOrder,
  DBConfig,
  DBCart,
  DBProfile,
  DBEmailLog,
  DBUserLog,
  DBDataRequest,
} from './supabase';
