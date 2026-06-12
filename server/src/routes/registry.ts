/** AUTO-GENERATED — run: node server/scripts/generate-registry.mjs */
export type RouteEntry = {
  pattern: string;
  module: string;
};

export const API_ROUTES: RouteEntry[] = [
  {
    "pattern": "/support-chat/:sessionId/message/:messageId",
    "module": "@/app/api/support-chat/[sessionId]/message/[messageId]/route"
  },
  {
    "pattern": "/payment/stripe/promptpay",
    "module": "@/app/api/payment/stripe/promptpay/route"
  },
  {
    "pattern": "/payment/webhook/omise",
    "module": "@/app/api/payment/webhook/omise/route"
  },
  {
    "pattern": "/payment/webhook/stripe",
    "module": "@/app/api/payment/webhook/stripe/route"
  },
  {
    "pattern": "/support-chat/settings/public",
    "module": "@/app/api/support-chat/settings/public/route"
  },
  {
    "pattern": "/shops/:shopId/admins",
    "module": "@/app/api/shops/[shopId]/admins/route"
  },
  {
    "pattern": "/shops/:shopId/config",
    "module": "@/app/api/shops/[shopId]/config/route"
  },
  {
    "pattern": "/shops/:shopId/orders",
    "module": "@/app/api/shops/[shopId]/orders/route"
  },
  {
    "pattern": "/shops/:shopId/products",
    "module": "@/app/api/shops/[shopId]/products/route"
  },
  {
    "pattern": "/shops/:shopId/public",
    "module": "@/app/api/shops/[shopId]/public/route"
  },
  {
    "pattern": "/support-chat/:sessionId/accept",
    "module": "@/app/api/support-chat/[sessionId]/accept/route"
  },
  {
    "pattern": "/support-chat/:sessionId/close",
    "module": "@/app/api/support-chat/[sessionId]/close/route"
  },
  {
    "pattern": "/support-chat/:sessionId/message",
    "module": "@/app/api/support-chat/[sessionId]/message/route"
  },
  {
    "pattern": "/support-chat/:sessionId/rate",
    "module": "@/app/api/support-chat/[sessionId]/rate/route"
  },
  {
    "pattern": "/support-chat/:sessionId/read",
    "module": "@/app/api/support-chat/[sessionId]/read/route"
  },
  {
    "pattern": "/support-chat/:sessionId/typing",
    "module": "@/app/api/support-chat/[sessionId]/typing/route"
  },
  {
    "pattern": "/admin/api-keys",
    "module": "@/app/api/admin/api-keys/route"
  },
  {
    "pattern": "/admin/bootstrap",
    "module": "@/app/api/admin/bootstrap/route"
  },
  {
    "pattern": "/admin/config",
    "module": "@/app/api/admin/config/route"
  },
  {
    "pattern": "/admin/data",
    "module": "@/app/api/admin/data/route"
  },
  {
    "pattern": "/admin/email",
    "module": "@/app/api/admin/email/route"
  },
  {
    "pattern": "/admin/orders",
    "module": "@/app/api/admin/orders/route"
  },
  {
    "pattern": "/admin/orders-list",
    "module": "@/app/api/admin/orders-list/route"
  },
  {
    "pattern": "/admin/permissions",
    "module": "@/app/api/admin/permissions/route"
  },
  {
    "pattern": "/admin/security",
    "module": "@/app/api/admin/security/route"
  },
  {
    "pattern": "/admin/sheet",
    "module": "@/app/api/admin/sheet/route"
  },
  {
    "pattern": "/admin/slip-import",
    "module": "@/app/api/admin/slip-import/route"
  },
  {
    "pattern": "/admin/status",
    "module": "@/app/api/admin/status/route"
  },
  {
    "pattern": "/admin/support-chat",
    "module": "@/app/api/admin/support-chat/route"
  },
  {
    "pattern": "/admin/toggle-shop",
    "module": "@/app/api/admin/toggle-shop/route"
  },
  {
    "pattern": "/admin/user-logs",
    "module": "@/app/api/admin/user-logs/route"
  },
  {
    "pattern": "/cron/cancel-expired",
    "module": "@/app/api/cron/cancel-expired/route"
  },
  {
    "pattern": "/cron/cleanup",
    "module": "@/app/api/cron/cleanup/route"
  },
  {
    "pattern": "/cron/update-tracking",
    "module": "@/app/api/cron/update-tracking/route"
  },
  {
    "pattern": "/payment/config",
    "module": "@/app/api/payment/config/route"
  },
  {
    "pattern": "/payment/create-charge",
    "module": "@/app/api/payment/create-charge/route"
  },
  {
    "pattern": "/payment/verify",
    "module": "@/app/api/payment/verify/route"
  },
  {
    "pattern": "/pickup/enable",
    "module": "@/app/api/pickup/enable/route"
  },
  {
    "pattern": "/privacy/data-request",
    "module": "@/app/api/privacy/data-request/route"
  },
  {
    "pattern": "/shipping/options",
    "module": "@/app/api/shipping/options/route"
  },
  {
    "pattern": "/shipping/track",
    "module": "@/app/api/shipping/track/route"
  },
  {
    "pattern": "/shops/catalog",
    "module": "@/app/api/shops/catalog/route"
  },
  {
    "pattern": "/support-chat/settings",
    "module": "@/app/api/support-chat/settings/route"
  },
  {
    "pattern": "/image/:id",
    "module": "@/app/api/image/[id]/route"
  },
  {
    "pattern": "/shops/:shopId",
    "module": "@/app/api/shops/[shopId]/route"
  },
  {
    "pattern": "/slip/:ref",
    "module": "@/app/api/slip/[ref]/route"
  },
  {
    "pattern": "/support-chat/:sessionId",
    "module": "@/app/api/support-chat/[sessionId]/route"
  },
  {
    "pattern": "/auto-email",
    "module": "@/app/api/auto-email/route"
  },
  {
    "pattern": "/cart",
    "module": "@/app/api/cart/route"
  },
  {
    "pattern": "/chatbot",
    "module": "@/app/api/chatbot/route"
  },
  {
    "pattern": "/config",
    "module": "@/app/api/config/route"
  },
  {
    "pattern": "/cron",
    "module": "@/app/api/cron/route"
  },
  {
    "pattern": "/gas",
    "module": "@/app/api/gas/route"
  },
  {
    "pattern": "/inventory",
    "module": "@/app/api/inventory/route"
  },
  {
    "pattern": "/invoice",
    "module": "@/app/api/invoice/route"
  },
  {
    "pattern": "/live",
    "module": "@/app/api/live/route"
  },
  {
    "pattern": "/migrate-refund",
    "module": "@/app/api/migrate-refund/route"
  },
  {
    "pattern": "/orders",
    "module": "@/app/api/orders/route"
  },
  {
    "pattern": "/payment-info",
    "module": "@/app/api/payment-info/route"
  },
  {
    "pattern": "/pickup",
    "module": "@/app/api/pickup/route"
  },
  {
    "pattern": "/profile",
    "module": "@/app/api/profile/route"
  },
  {
    "pattern": "/promo",
    "module": "@/app/api/promo/route"
  },
  {
    "pattern": "/push-subscription",
    "module": "@/app/api/push-subscription/route"
  },
  {
    "pattern": "/refund",
    "module": "@/app/api/refund/route"
  },
  {
    "pattern": "/reviews",
    "module": "@/app/api/reviews/route"
  },
  {
    "pattern": "/shops",
    "module": "@/app/api/shops/route"
  },
  {
    "pattern": "/stock-alert",
    "module": "@/app/api/stock-alert/route"
  },
  {
    "pattern": "/support-chat",
    "module": "@/app/api/support-chat/route"
  },
  {
    "pattern": "/upload",
    "module": "@/app/api/upload/route"
  }
];
