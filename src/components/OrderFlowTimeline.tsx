/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  Package,
  Truck,
  Sparkles,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Info,
  FileText,
  QrCode,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OrderFlowTimelineProps {
  order: {
    ref: string;
    status: string;
    createdAt?: string;
    created_at?: string;
    date?: string;
    verifiedAt?: string;
    paymentVerified?: boolean;
    paymentVerifiedAt?: string;
    payment_verified_at?: string;
    trackingNumber?: string;
    tracking_number?: string;
    shippingProvider?: string;
    shipping_provider?: string;
    shippingMethod?: string;
    shipping_method?: string;
    shippingOption?: string;
    shipping_option?: string;
    customerName?: string;
    name?: string;
    customerEmail?: string;
    email?: string;
    totalAmount?: number;
    total_amount?: number;
    amount?: number;
    cart?: any[];
    items?: any[];
    notes?: string;
  };
  lang?: 'th' | 'en';
}

export default function OrderFlowTimeline({ order, lang = 'th' }: OrderFlowTimelineProps) {
  const currentStatus = (order.status || 'PENDING').toUpperCase();
  const isCancelled = currentStatus === 'CANCELLED';
  const isExpired = currentStatus === 'EXPIRED';
  const isPaid =
    currentStatus === 'PAID' ||
    currentStatus === 'READY' ||
    currentStatus === 'SHIPPED' ||
    currentStatus === 'COMPLETED' ||
    order.paymentVerified === true;

  const trackingNo = order.trackingNumber || order.tracking_number || '';
  const provider = order.shippingProvider || order.shipping_provider || 'EMS / Thai Post';
  const shippingOpt = order.shippingOption || order.shipping_option || '';
  const isDelivery = shippingOpt.toLowerCase().includes('ship') || shippingOpt.toLowerCase().includes('delivery') || trackingNo !== '';

  const orderDateStr = order.createdAt || order.created_at || order.date;
  const orderDateFormatted = orderDateStr ? new Date(orderDateStr).toLocaleString(lang === 'en' ? 'en-US' : 'th-TH') : '-';
  const verifyDateStr = order.paymentVerifiedAt || order.payment_verified_at || order.verifiedAt;
  const verifyDateFormatted = verifyDateStr ? new Date(verifyDateStr).toLocaleString(lang === 'en' ? 'en-US' : 'th-TH') : null;

  // Determine current active step index (0 = Order, 1 = Payment, 2 = Fulfillment, 3 = Complete)
  let activeStepIndex = 0;
  if (currentStatus === 'COMPLETED') activeStepIndex = 3;
  else if (currentStatus === 'READY' || currentStatus === 'SHIPPED') activeStepIndex = 2;
  else if (isPaid) activeStepIndex = 1;

  // Currently selected step for detail modal/drawer view
  const [selectedStep, setSelectedStep] = useState<number | 'cancelled' | 'expired' | null>(
    isCancelled ? 'cancelled' : isExpired ? 'expired' : activeStepIndex
  );

  const steps = [
    {
      id: 0,
      title: lang === 'en' ? 'Order Placed' : 'สร้างคำสั่งซื้อ',
      subtitle: lang === 'en' ? 'Pending Payment' : 'รอชำระเงิน',
      icon: Clock,
      color: '#f59e0b',
      bgColor: 'bg-amber-500/10 border-amber-500/30 text-amber-500',
      activeBg: 'bg-amber-500 text-white shadow-amber-500/25',
      done: true,
      details: {
        title: lang === 'en' ? 'Order Reference Details' : 'รายละเอียดการสั่งซื้อ',
        info: [
          { label: lang === 'en' ? 'Order Ref' : 'หมายเลขอ้างอิง', value: `#${order.ref}` },
          { label: lang === 'en' ? 'Created At' : 'วันที่ทำรายการ', value: orderDateFormatted },
          { label: lang === 'en' ? 'Customer' : 'ชื่อผู้สั่งซื้อ', value: order.customerName || order.name || '-' },
          { label: lang === 'en' ? 'Total Items' : 'จำนวนสินค้า', value: `${(order.cart || order.items || []).length} รายการ` },
        ],
      },
    },
    {
      id: 1,
      title: lang === 'en' ? 'Payment Confirmed' : 'ชำระเงินแล้ว',
      subtitle: isPaid ? (verifyDateFormatted ? verifyDateFormatted : (lang === 'en' ? 'Verified' : 'ยืนยันแล้ว')) : (lang === 'en' ? 'Awaiting Payment' : 'รอยืนยันยอดเงิน'),
      icon: CheckCircle2,
      color: '#10b981',
      bgColor: isPaid ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-muted border-border text-muted-foreground',
      activeBg: 'bg-emerald-500 text-white shadow-emerald-500/25',
      done: isPaid,
      details: {
        title: lang === 'en' ? 'Payment Status Details' : 'รายละเอียดการชำระเงิน',
        info: [
          { label: lang === 'en' ? 'Payment Status' : 'สถานะชำระเงิน', value: isPaid ? (lang === 'en' ? 'PAID & VERIFIED' : 'ชำระเงินและตรวจสอบแล้ว') : (lang === 'en' ? 'UNPAID' : 'ยังไม่ได้ชำระเงิน') },
          { label: lang === 'en' ? 'Verified Time' : 'เวลาที่ยืนยัน', value: verifyDateFormatted || (isPaid ? 'สำเร็จ' : 'รอชำระเงิน') },
          { label: lang === 'en' ? 'Total Amount' : 'ยอดชำระ', value: `฿${Number(order.totalAmount ?? order.total_amount ?? order.amount ?? 0).toLocaleString()}` },
        ],
        action: isPaid ? {
          label: lang === 'en' ? 'View E-Receipt' : 'ดูใบเสร็จรับเงิน (E-Receipt)',
          href: `/receipt/${encodeURIComponent(order.ref)}`,
          icon: FileText,
        } : (!isCancelled && !isExpired ? {
          label: lang === 'en' ? 'Pay Now' : 'ชำระเงินทันที',
          href: `/payment/${encodeURIComponent(order.ref)}`,
          icon: QrCode,
        } : undefined),
      },
    },
    {
      id: 2,
      title: isDelivery ? (lang === 'en' ? 'Shipped' : 'จัดส่งแล้ว') : (lang === 'en' ? 'Ready for Pickup' : 'พร้อมรับสินค้า'),
      subtitle: isDelivery ? (trackingNo ? `Tracking: ${trackingNo}` : (lang === 'en' ? 'In Transit' : 'กำลังจัดส่ง')) : (lang === 'en' ? 'At SCC Computer Club' : 'รับ ณ ห้องชุมนุม'),
      icon: isDelivery ? Truck : Package,
      color: '#3b82f6',
      bgColor: (currentStatus === 'READY' || currentStatus === 'SHIPPED' || currentStatus === 'COMPLETED')
        ? 'bg-blue-500/10 border-blue-500/30 text-blue-500'
        : 'bg-muted border-border text-muted-foreground',
      activeBg: 'bg-blue-500 text-white shadow-blue-500/25',
      done: currentStatus === 'READY' || currentStatus === 'SHIPPED' || currentStatus === 'COMPLETED',
      details: {
        title: isDelivery ? (lang === 'en' ? 'Shipping Details' : 'ข้อมูลการจัดส่งพัสดุ') : (lang === 'en' ? 'Pickup Location Details' : 'สถานที่รับสินค้า'),
        info: isDelivery
          ? [
              { label: lang === 'en' ? 'Carrier' : 'ผู้ให้บริการจัดส่ง', value: provider },
              { label: lang === 'en' ? 'Tracking Number' : 'เลขพัสดุ', value: trackingNo || (lang === 'en' ? 'Preparing tracking' : 'กำลังเตรียมจัดส่ง') },
              { label: lang === 'en' ? 'Shipping Method' : 'รูปแบบจัดส่ง', value: shippingOpt || 'พัสดุลงทะเบียน / EMS' },
            ]
          : [
              { label: lang === 'en' ? 'Location' : 'สถานที่', value: 'ห้องชุมนุมคอมพิวเตอร์ (SCC Computer Club)' },
              { label: lang === 'en' ? 'Address' : 'ที่ตั้ง', value: 'ชั้น 2 อาคารศูนย์คอมพิวเตอร์ มหาวิทยาลัยสงขลานครินทร์' },
              { label: lang === 'en' ? 'Pickup Hours' : 'เวลาทำการ', value: 'จันทร์ - ศุกร์ 09:00 - 17:00 น.' },
            ],
      },
    },
    {
      id: 3,
      title: lang === 'en' ? 'Completed' : 'สำเร็จเรียบร้อย',
      subtitle: lang === 'en' ? 'Item Delivered/Picked Up' : 'ได้รับสินค้าเรียบร้อย',
      icon: Sparkles,
      color: '#8b5cf6',
      bgColor: currentStatus === 'COMPLETED' ? 'bg-purple-500/10 border-purple-500/30 text-purple-500' : 'bg-muted border-border text-muted-foreground',
      activeBg: 'bg-purple-500 text-white shadow-purple-500/25',
      done: currentStatus === 'COMPLETED',
      details: {
        title: lang === 'en' ? 'Completion Status' : 'คำสั่งซื้อสำเร็จเรียบร้อย',
        info: [
          { label: lang === 'en' ? 'Status' : 'สถานะปลายทาง', value: lang === 'en' ? 'Completed' : 'ได้รับสินค้าสมบูรณ์' },
          { label: lang === 'en' ? 'Support' : 'ติดต่อสอบถาม', value: 'SCC Support' },
        ],
      },
    },
  ];

  return (
    <div className="w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-5 backdrop-blur-xl shadow-lg transition-all">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
            <Sparkles className="size-4 text-indigo-500" />
            {lang === 'en' ? 'Order Process Status' : 'สถานะการดำเนินการ (Order Flow)'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {lang === 'en' ? 'Click on any step to view detail status' : 'กดที่ขั้นตอนต่างๆ เพื่อดูรายละเอียดเชิงลึก'}
          </p>
        </div>
        {isCancelled && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-500 border border-red-500/20">
            <XCircle className="size-3.5" />
            {lang === 'en' ? 'CANCELLED' : 'ยกเลิกคำสั่งซื้อ'}
          </span>
        )}
        {isExpired && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-500 border border-amber-500/20">
            <AlertTriangle className="size-3.5" />
            {lang === 'en' ? 'EXPIRED' : 'หมดเวลาชำระเงิน'}
          </span>
        )}
      </div>

      {/* Special Banner for Cancelled or Expired Orders */}
      {(isCancelled || isExpired) && (
        <div className={cn(
          "mb-5 rounded-xl border p-4 flex items-start gap-3 transition-all",
          isCancelled ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-amber-500/10 border-amber-500/20 text-amber-500"
        )}>
          {isCancelled ? <XCircle className="size-5 shrink-0 mt-0.5" /> : <AlertTriangle className="size-5 shrink-0 mt-0.5" />}
          <div>
            <h4 className="text-sm font-bold">
              {isCancelled
                ? (lang === 'en' ? 'This order has been cancelled' : 'คำสั่งซื้อนี้ถูกยกเลิกแล้ว')
                : (lang === 'en' ? 'Payment window expired' : 'คำสั่งซื้อนี้หมดเวลาชำระเงินแล้ว')}
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isCancelled
                ? (lang === 'en' ? 'Payment is disabled for cancelled orders. Please contact support or place a new order.' : 'ไม่สามารถชำระเงินได้เนื่องจากคำสั่งซื้อยกเลิกแล้ว กรุณาติดต่อทีมงานหรือทำรายการสั่งซื้อใหม่')
                : (lang === 'en' ? 'The payment window for this order has ended.' : 'ระยะเวลาการชำระเงินตามกำหนดสิ้นสุดแล้ว')}
            </p>
          </div>
        </div>
      )}

      {/* Stepper Flow Nodes */}
      <div className="relative mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {steps.map((step, idx) => {
          const IconComponent = step.icon;
          const isCurrentActive = activeStepIndex === step.id && !isCancelled && !isExpired;
          const isSelected = selectedStep === step.id;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setSelectedStep(step.id)}
              className={cn(
                'group relative flex flex-col items-center rounded-xl border p-3 text-center transition-all duration-200 cursor-pointer hover:scale-[1.02]',
                isSelected ? 'ring-2 ring-indigo-500 border-indigo-500/50 bg-indigo-500/5' : 'border-border/60 bg-card/40 hover:bg-card/80',
              )}
            >
              {/* Connector line for desktop */}
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    'hidden sm:block absolute top-6 -right-4 z-0 h-[2px] w-8 transition-colors',
                    step.done && steps[idx + 1].done ? 'bg-emerald-500' : 'bg-border/60'
                  )}
                />
              )}

              {/* Step Badge/Icon */}
              <div
                className={cn(
                  'relative z-10 flex size-10 items-center justify-center rounded-full border text-sm font-bold transition-all duration-300',
                  isCurrentActive ? `${step.activeBg} animate-pulse` : step.bgColor
                )}
              >
                <IconComponent className="size-5" />
              </div>

              <span className="mt-2 text-xs font-bold text-foreground group-hover:text-indigo-500 transition-colors">
                {step.title}
              </span>
              <span className="text-[0.68rem] text-muted-foreground truncate max-w-full">
                {step.subtitle}
              </span>

              {isCurrentActive && (
                <span className="mt-1 inline-flex items-center rounded-full bg-indigo-500/10 px-2 py-0.5 text-[0.65rem] font-bold text-indigo-500">
                  {lang === 'en' ? 'Active' : 'ปัจจุบัน'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Step Detail Panel */}
      {selectedStep !== null && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 transition-all">
          {(() => {
            if (selectedStep === 'cancelled') {
              return (
                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-red-500">
                    <XCircle className="size-4" />
                    {lang === 'en' ? 'Cancellation Info' : 'ข้อมูลการยกเลิกออเดอร์'}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {order.notes || (lang === 'en' ? 'Order was cancelled by customer or store admin.' : 'คำสั่งซื้อถูกยกเลิกโดยผู้สั่งซื้อหรือแอดมินระบบ')}
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/support"
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-500 hover:underline"
                    >
                      <Info className="size-3.5" />
                      {lang === 'en' ? 'Contact Support' : 'สอบถามศูนย์ช่วยเหลือ'}
                    </Link>
                  </div>
                </div>
              );
            }
            if (selectedStep === 'expired') {
              return (
                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-amber-500">
                    <AlertTriangle className="size-4" />
                    {lang === 'en' ? 'Expiration Info' : 'ข้อมูลการหมดอายุ'}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {lang === 'en' ? 'The payment window for this order has expired.' : 'คำสั่งซื้อนี้หมดเวลาชำระเงินตามที่ระบบกำหนด'}
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/"
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-500 hover:underline"
                    >
                      <ChevronRight className="size-3.5" />
                      {lang === 'en' ? 'Order New Items' : 'ทำรายการสั่งซื้อใหม่'}
                    </Link>
                  </div>
                </div>
              );
            }

            const stepInfo = steps.find((s) => s.id === selectedStep);
            if (!stepInfo) return null;

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Info className="size-4 text-indigo-500" />
                    {stepInfo.details.title}
                  </h4>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {stepInfo.done ? (lang === 'en' ? '✓ Completed' : '✓ เสร็จสิ้น') : (lang === 'en' ? 'Pending' : 'รอดำเนินการ')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {stepInfo.details.info.map((item, i) => (
                    <div key={i} className="flex justify-between sm:justify-start sm:gap-2 rounded-lg bg-card/60 p-2 border border-border/30">
                      <span className="font-medium text-muted-foreground">{item.label}:</span>
                      <span className="font-bold text-foreground truncate">{item.value}</span>
                    </div>
                  ))}
                </div>

                {stepInfo.details.action && (
                  <div className="pt-1">
                    <Link
                      href={stepInfo.details.action.href}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:bg-indigo-600 transition-all"
                    >
                      {React.createElement(stepInfo.details.action.icon, { className: 'size-3.5' })}
                      {stepInfo.details.action.label}
                    </Link>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
