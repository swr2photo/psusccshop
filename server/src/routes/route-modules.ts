/** AUTO-GENERATED — static imports for Cloudflare Workers bundling */
import type { NextRequest } from 'next/server';

type RouteHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response> | Response;

type RouteModule = Partial<
  Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS', RouteHandler>
>;

import * as __route_0 from '@/app/api/support-chat/[sessionId]/message/[messageId]/route';
import * as __route_1 from '@/app/api/payment/stripe/promptpay/route';
import * as __route_2 from '@/app/api/payment/webhook/omise/route';
import * as __route_3 from '@/app/api/payment/webhook/stripe/route';
import * as __route_4 from '@/app/api/support-chat/settings/public/route';
import * as __route_5 from '@/app/api/shops/[shopId]/admins/route';
import * as __route_6 from '@/app/api/shops/[shopId]/config/route';
import * as __route_7 from '@/app/api/shops/[shopId]/orders/route';
import * as __route_8 from '@/app/api/shops/[shopId]/products/route';
import * as __route_9 from '@/app/api/shops/[shopId]/public/route';
import * as __route_10 from '@/app/api/support-chat/[sessionId]/accept/route';
import * as __route_11 from '@/app/api/support-chat/[sessionId]/close/route';
import * as __route_12 from '@/app/api/support-chat/[sessionId]/message/route';
import * as __route_13 from '@/app/api/support-chat/[sessionId]/rate/route';
import * as __route_14 from '@/app/api/support-chat/[sessionId]/read/route';
import * as __route_15 from '@/app/api/support-chat/[sessionId]/typing/route';
import * as __route_16 from '@/app/api/admin/api-keys/route';
import * as __route_17 from '@/app/api/admin/bootstrap/route';
import * as __route_18 from '@/app/api/admin/config/route';
import * as __route_19 from '@/app/api/admin/data/route';
import * as __route_20 from '@/app/api/admin/email/route';
import * as __route_21 from '@/app/api/admin/orders/route';
import * as __route_22 from '@/app/api/admin/orders-list/route';
import * as __route_23 from '@/app/api/admin/permissions/route';
import * as __route_24 from '@/app/api/admin/security/route';
import * as __route_25 from '@/app/api/admin/sheet/route';
import * as __route_26 from '@/app/api/admin/slip-import/route';
import * as __route_27 from '@/app/api/admin/status/route';
import * as __route_28 from '@/app/api/admin/support-chat/route';
import * as __route_29 from '@/app/api/admin/toggle-shop/route';
import * as __route_30 from '@/app/api/admin/user-logs/route';
import * as __route_31 from '@/app/api/cron/cancel-expired/route';
import * as __route_32 from '@/app/api/cron/cleanup/route';
import * as __route_33 from '@/app/api/cron/update-tracking/route';
import * as __route_34 from '@/app/api/payment/config/route';
import * as __route_35 from '@/app/api/payment/create-charge/route';
import * as __route_36 from '@/app/api/payment/verify/route';
import * as __route_37 from '@/app/api/pickup/enable/route';
import * as __route_38 from '@/app/api/privacy/data-request/route';
import * as __route_39 from '@/app/api/shipping/options/route';
import * as __route_40 from '@/app/api/shipping/track/route';
import * as __route_41 from '@/app/api/shops/catalog/route';
import * as __route_42 from '@/app/api/support-chat/settings/route';
import * as __route_43 from '@/app/api/image/[id]/route';
import * as __route_44 from '@/app/api/shops/[shopId]/route';
import * as __route_45 from '@/app/api/slip/[ref]/route';
import * as __route_46 from '@/app/api/support-chat/[sessionId]/route';
import * as __route_47 from '@/app/api/auto-email/route';
import * as __route_48 from '@/app/api/cart/route';
import * as __route_49 from '@/app/api/chatbot/route';
import * as __route_50 from '@/app/api/config/route';
import * as __route_51 from '@/app/api/cron/route';
import * as __route_52 from '@/app/api/gas/route';
import * as __route_53 from '@/app/api/inventory/route';
import * as __route_54 from '@/app/api/invoice/route';
import * as __route_55 from '@/app/api/live/route';
import * as __route_56 from '@/app/api/migrate-refund/route';
import * as __route_57 from '@/app/api/orders/route';
import * as __route_58 from '@/app/api/payment-info/route';
import * as __route_59 from '@/app/api/pickup/route';
import * as __route_60 from '@/app/api/profile/route';
import * as __route_61 from '@/app/api/promo/route';
import * as __route_62 from '@/app/api/push-subscription/route';
import * as __route_63 from '@/app/api/refund/route';
import * as __route_64 from '@/app/api/reviews/route';
import * as __route_65 from '@/app/api/shops/route';
import * as __route_66 from '@/app/api/stock-alert/route';
import * as __route_67 from '@/app/api/support-chat/route';
import * as __route_68 from '@/app/api/upload/route';

export const ROUTE_MODULES: Record<string, RouteModule> = {
  '@/app/api/support-chat/[sessionId]/message/[messageId]/route': __route_0 as RouteModule,
  '@/app/api/payment/stripe/promptpay/route': __route_1 as RouteModule,
  '@/app/api/payment/webhook/omise/route': __route_2 as RouteModule,
  '@/app/api/payment/webhook/stripe/route': __route_3 as RouteModule,
  '@/app/api/support-chat/settings/public/route': __route_4 as RouteModule,
  '@/app/api/shops/[shopId]/admins/route': __route_5 as RouteModule,
  '@/app/api/shops/[shopId]/config/route': __route_6 as RouteModule,
  '@/app/api/shops/[shopId]/orders/route': __route_7 as RouteModule,
  '@/app/api/shops/[shopId]/products/route': __route_8 as RouteModule,
  '@/app/api/shops/[shopId]/public/route': __route_9 as RouteModule,
  '@/app/api/support-chat/[sessionId]/accept/route': __route_10 as RouteModule,
  '@/app/api/support-chat/[sessionId]/close/route': __route_11 as RouteModule,
  '@/app/api/support-chat/[sessionId]/message/route': __route_12 as RouteModule,
  '@/app/api/support-chat/[sessionId]/rate/route': __route_13 as RouteModule,
  '@/app/api/support-chat/[sessionId]/read/route': __route_14 as RouteModule,
  '@/app/api/support-chat/[sessionId]/typing/route': __route_15 as RouteModule,
  '@/app/api/admin/api-keys/route': __route_16 as RouteModule,
  '@/app/api/admin/bootstrap/route': __route_17 as RouteModule,
  '@/app/api/admin/config/route': __route_18 as RouteModule,
  '@/app/api/admin/data/route': __route_19 as RouteModule,
  '@/app/api/admin/email/route': __route_20 as RouteModule,
  '@/app/api/admin/orders/route': __route_21 as RouteModule,
  '@/app/api/admin/orders-list/route': __route_22 as RouteModule,
  '@/app/api/admin/permissions/route': __route_23 as RouteModule,
  '@/app/api/admin/security/route': __route_24 as RouteModule,
  '@/app/api/admin/sheet/route': __route_25 as RouteModule,
  '@/app/api/admin/slip-import/route': __route_26 as RouteModule,
  '@/app/api/admin/status/route': __route_27 as RouteModule,
  '@/app/api/admin/support-chat/route': __route_28 as RouteModule,
  '@/app/api/admin/toggle-shop/route': __route_29 as RouteModule,
  '@/app/api/admin/user-logs/route': __route_30 as RouteModule,
  '@/app/api/cron/cancel-expired/route': __route_31 as RouteModule,
  '@/app/api/cron/cleanup/route': __route_32 as RouteModule,
  '@/app/api/cron/update-tracking/route': __route_33 as RouteModule,
  '@/app/api/payment/config/route': __route_34 as RouteModule,
  '@/app/api/payment/create-charge/route': __route_35 as RouteModule,
  '@/app/api/payment/verify/route': __route_36 as RouteModule,
  '@/app/api/pickup/enable/route': __route_37 as RouteModule,
  '@/app/api/privacy/data-request/route': __route_38 as RouteModule,
  '@/app/api/shipping/options/route': __route_39 as RouteModule,
  '@/app/api/shipping/track/route': __route_40 as RouteModule,
  '@/app/api/shops/catalog/route': __route_41 as RouteModule,
  '@/app/api/support-chat/settings/route': __route_42 as RouteModule,
  '@/app/api/image/[id]/route': __route_43 as RouteModule,
  '@/app/api/shops/[shopId]/route': __route_44 as RouteModule,
  '@/app/api/slip/[ref]/route': __route_45 as RouteModule,
  '@/app/api/support-chat/[sessionId]/route': __route_46 as RouteModule,
  '@/app/api/auto-email/route': __route_47 as RouteModule,
  '@/app/api/cart/route': __route_48 as RouteModule,
  '@/app/api/chatbot/route': __route_49 as RouteModule,
  '@/app/api/config/route': __route_50 as RouteModule,
  '@/app/api/cron/route': __route_51 as RouteModule,
  '@/app/api/gas/route': __route_52 as RouteModule,
  '@/app/api/inventory/route': __route_53 as RouteModule,
  '@/app/api/invoice/route': __route_54 as RouteModule,
  '@/app/api/live/route': __route_55 as RouteModule,
  '@/app/api/migrate-refund/route': __route_56 as RouteModule,
  '@/app/api/orders/route': __route_57 as RouteModule,
  '@/app/api/payment-info/route': __route_58 as RouteModule,
  '@/app/api/pickup/route': __route_59 as RouteModule,
  '@/app/api/profile/route': __route_60 as RouteModule,
  '@/app/api/promo/route': __route_61 as RouteModule,
  '@/app/api/push-subscription/route': __route_62 as RouteModule,
  '@/app/api/refund/route': __route_63 as RouteModule,
  '@/app/api/reviews/route': __route_64 as RouteModule,
  '@/app/api/shops/route': __route_65 as RouteModule,
  '@/app/api/stock-alert/route': __route_66 as RouteModule,
  '@/app/api/support-chat/route': __route_67 as RouteModule,
  '@/app/api/upload/route': __route_68 as RouteModule,
};
