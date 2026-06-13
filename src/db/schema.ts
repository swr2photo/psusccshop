// src/db/schema.ts
// กำหนด schema สำหรับ Drizzle ORM — ครอบคลุม 18 ตารางที่เคยใช้งานใน Prisma

import { pgTable, uuid, text, timestamp, boolean, integer, doublePrecision, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==================== CONFIG ====================
export const config = pgTable('config', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').unique().notNull(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== ORDERS ====================
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  ref: text('ref').unique().notNull(),
  date: text('date'),
  status: text('status').default('WAITING_PAYMENT').notNull(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  emailHash: text('email_hash').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerAddress: text('customer_address').notNull(),
  customerInstagram: text('customer_instagram'),
  cart: jsonb('cart').default([]).notNull(),
  totalAmount: doublePrecision('total_amount').default(0).notNull(),
  notes: text('notes'),
  slipData: jsonb('slip_data'),
  paymentVerifiedAt: text('payment_verified_at'),
  paymentMethod: text('payment_method'),
  paymentStatus: text('payment_status').default('pending').notNull(),
  paymentVerified: boolean('payment_verified').default(false).notNull(),
  paymentGateway: text('payment_gateway'),
  shippingOption: text('shipping_option'),
  trackingNumber: text('tracking_number'),
  shippingProvider: text('shipping_provider'),
  trackingStatus: text('tracking_status'),
  trackingLastChecked: text('tracking_last_checked'),
  shippedAt: text('shipped_at'),
  receivedAt: text('received_at'),
  refundStatus: text('refund_status'),
  refundReason: text('refund_reason'),
  refundDetails: text('refund_details'),
  refundBankName: text('refund_bank_name'),
  refundBankAccount: text('refund_bank_account'),
  refundAccountName: text('refund_account_name'),
  refundAmount: doublePrecision('refund_amount'),
  refundRequestedAt: text('refund_requested_at'),
  refundReviewedAt: text('refund_reviewed_at'),
  refundReviewedBy: text('refund_reviewed_by'),
  refundAdminNote: text('refund_admin_note'),
  pickupData: jsonb('pickup_data'),
  shopId: text('shop_id'),
  shopSlug: text('shop_slug'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== CARTS ====================
export const carts = pgTable('carts', {
  id: uuid('id').defaultRandom().primaryKey(),
  emailHash: text('email_hash').unique().notNull(),
  cartData: jsonb('cart_data').default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== PROFILES ====================
export const profiles = pgTable('profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  emailHash: text('email_hash').unique().notNull(),
  name: text('name').default('').notNull(),
  phone: text('phone').default('').notNull(),
  address: text('address').default('').notNull(),
  instagram: text('instagram'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== EMAIL LOGS ====================
export const emailLogs = pgTable('email_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderRef: text('order_ref'),
  toEmail: text('to_email').notNull(),
  fromEmail: text('from_email').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  emailType: text('email_type').default('custom').notNull(),
  status: text('status').default('pending').notNull(),
  sentAt: text('sent_at'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== USER LOGS ====================
export const userLogs = pgTable('user_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  action: text('action').notNull(),
  details: text('details'),
  metadata: jsonb('metadata'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== DATA REQUESTS (PDPA) ====================
export const dataRequests = pgTable('data_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  requestType: text('request_type').notNull(),
  status: text('status').default('pending').notNull(),
  details: jsonb('details'),
  processedAt: text('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== KEY-VALUE STORE ====================
export const keyValueStore = pgTable('key_value_store', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').unique().notNull(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== SECURITY AUDIT LOG ====================
export const securityAuditLog = pgTable('security_audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventType: text('event_type').notNull(),
  userEmail: text('user_email'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== ADMIN PERMISSIONS ====================
export const adminPermissions = pgTable('admin_permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique().notNull(),
  canManageShop: boolean('can_manage_shop').default(false).notNull(),
  canManageSheet: boolean('can_manage_sheet').default(false).notNull(),
  canManageShipping: boolean('can_manage_shipping').default(false).notNull(),
  canManagePayment: boolean('can_manage_payment').default(false).notNull(),
  canManageProducts: boolean('can_manage_products').default(false).notNull(),
  canManageOrders: boolean('can_manage_orders').default(false).notNull(),
  canManagePickup: boolean('can_manage_pickup').default(false).notNull(),
  canManageTracking: boolean('can_manage_tracking').default(false).notNull(),
  canManageRefunds: boolean('can_manage_refunds').default(false).notNull(),
  canManageAnnouncement: boolean('can_manage_announcement').default(false).notNull(),
  canManageEvents: boolean('can_manage_events').default(false).notNull(),
  canManagePromoCodes: boolean('can_manage_promo_codes').default(false).notNull(),
  canManageSupport: boolean('can_manage_support').default(false).notNull(),
  canSendEmail: boolean('can_send_email').default(false).notNull(),
  canManageLiveStream: boolean('can_manage_live_stream').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== SUPPORT CHATS ====================
export const supportChats = pgTable('support_chats', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerEmail: text('customer_email').notNull(),
  customerName: text('customer_name').notNull(),
  customerAvatar: text('customer_avatar'),
  status: text('status').default('pending').notNull(),
  adminEmail: text('admin_email'),
  adminName: text('admin_name'),
  subject: text('subject'),
  shopId: text('shop_id'),
  shopName: text('shop_name'),
  rating: integer('rating'),
  ratingComment: text('rating_comment'),
  lastMessageAt: timestamp('last_message_at'),
  lastMessagePreview: text('last_message_preview'),
  unreadCount: integer('unread_count').default(0).notNull(),
  customerUnreadCount: integer('customer_unread_count').default(0).notNull(),
  adminTyping: boolean('admin_typing').default(false),
  adminTypingAt: timestamp('admin_typing_at'),
  customerTyping: boolean('customer_typing').default(false),
  customerTypingAt: timestamp('customer_typing_at'),
  closedAt: timestamp('closed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const supportMessages = pgTable('support_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').references(() => supportChats.id, { onDelete: 'cascade' }).notNull(),
  sender: text('sender').notNull(),
  senderEmail: text('sender_email'),
  senderName: text('sender_name'),
  senderAvatar: text('sender_avatar'),
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at'),
  isUnsent: boolean('is_unsent').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const supportChatsRelations = relations(supportChats, ({ many }) => ({
  messages: many(supportMessages),
}));

export const supportMessagesRelations = relations(supportMessages, ({ one }) => ({
  chat: one(supportChats, {
    fields: [supportMessages.sessionId],
    references: [supportChats.id],
  }),
}));

// ==================== SHOPS (MULTI-SHOP) ====================
export const shops = pgTable('shops', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').unique().notNull(),
  name: text('name').notNull(),
  nameEn: text('name_en'),
  description: text('description'),
  descriptionEn: text('description_en'),
  logoUrl: text('logo_url'),
  bannerUrl: text('banner_url'),
  ownerEmail: text('owner_email').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  settings: jsonb('settings').default({}).notNull(),
  paymentInfo: jsonb('payment_info').default({}).notNull(),
  products: jsonb('products').default([]).notNull(),
  config: jsonb('config').default({}).notNull(),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  socialLinks: jsonb('social_links'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const shopAdmins = pgTable('shop_admins', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopId: uuid('shop_id').references(() => shops.id, { onDelete: 'cascade' }).notNull(),
  email: text('email').notNull(),
  role: text('role').default('admin').notNull(),
  permissions: jsonb('permissions').default({}).notNull(),
  addedBy: text('added_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  shopEmailUnique: uniqueIndex('shop_admins_shop_id_email_unique').on(table.shopId, table.email),
}));

export const shopsRelations = relations(shops, ({ many }) => ({
  admins: many(shopAdmins),
}));

export const shopAdminsRelations = relations(shopAdmins, ({ one }) => ({
  shop: one(shops, {
    fields: [shopAdmins.shopId],
    references: [shops.id],
  }),
}));

// ==================== PASSKEYS (WebAuthn) ====================
export const passkeyCredentials = pgTable('passkey_credentials', {
  credentialId: text('credential_id').primaryKey(),
  userEmail: text('user_email').notNull(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').default(0).notNull(),
  deviceType: text('device_type').notNull(),
  backedUp: boolean('backed_up').default(false).notNull(),
  transports: text('transports').array(),
  friendlyName: text('friendly_name').default('My Passkey').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),
});

export const passkeyChallenges = pgTable('passkey_challenges', {
  id: uuid('id').defaultRandom().primaryKey(),
  challenge: text('challenge').notNull(),
  type: text('type').notNull(),
  userEmail: text('user_email'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== PUSH NOTIFICATIONS ====================
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  endpoint: text('endpoint').unique().notNull(),
  keysP256dh: text('keys_p256dh').notNull(),
  keysAuth: text('keys_auth').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== RATE LIMITING ====================
export const rateLimits = pgTable('rate_limits', {
  id: uuid('id').defaultRandom().primaryKey(),
  identifier: text('identifier').unique().notNull(),
  count: integer('count').default(0).notNull(),
  resetAt: timestamp('reset_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== BLOCKED IPs ====================
export const blockedIps = pgTable('blocked_ips', {
  id: uuid('id').defaultRandom().primaryKey(),
  ipAddress: text('ip_address').unique().notNull(),
  reason: text('reason').notNull(),
  blockedAt: timestamp('blocked_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

// ==================== INVENTORY ====================
export const inventory = pgTable('inventory', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: text('product_id').notNull(),
  size: text('size').default('FREE').notNull(),
  variantId: text('variant_id'),
  quantity: integer('quantity').default(0).notNull(),
  reservedQuantity: integer('reserved_quantity').default(0).notNull(),
  lowStockThreshold: integer('low_stock_threshold').default(5).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== REVIEWS ====================
export const reviews = pgTable('reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: text('product_id').notNull(),
  emailHash: text('email_hash').notNull(),
  userName: text('user_name'),
  userImage: text('user_image'),
  rating: integer('rating').notNull(),
  comment: text('comment').default('').notNull(),
  verified: boolean('verified').default(false).notNull(),
  helpfulCount: integer('helpful_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== STOCK ALERTS ====================
export const stockAlerts = pgTable('stock_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: text('product_id').notNull(),
  emailHash: text('email_hash').notNull(),
  size: text('size'),
  notified: boolean('notified').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== PAYMENT TRANSACTIONS ====================
export const paymentTransactions = pgTable('payment_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  method: text('method').notNull(),
  gateway: text('gateway'),
  amount: doublePrecision('amount').notNull(),
  currency: text('currency').default('THB').notNull(),
  status: text('status').default('pending').notNull(),
  gatewayTransactionId: text('gateway_transaction_id'),
  gatewayChargeId: text('gateway_charge_id'),
  cardLast4: text('card_last4'),
  cardBrand: text('card_brand'),
  errorMessage: text('error_message'),
  rawResponse: jsonb('raw_response'),
  verified: boolean('verified').default(false).notNull(),
  verificationMethod: text('verification_method'),
  verifiedAt: timestamp('verified_at'),
  verifiedBy: text('verified_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== TODOS (TEST/DEMO) ====================
/**
 * @deprecated This table is for testing/demo only and should NOT be used in production code.
 * Scheduled for removal in the next schema migration.
 */
export const todos = pgTable('todos', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
});
