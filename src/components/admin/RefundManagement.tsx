'use client';

import { apiFetch } from '@/lib/api-client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  Banknote,
  Package,
  RefreshCw,
  Loader2,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface RefundOrder {
  ref: string;
  status: string;
  total: number;
  date: string;
  customerName?: string;
  customerEmail?: string;
  items?: Array<{ name?: string; productName?: string; qty?: number; quantity?: number }>;
  refundStatus: string;
  refundReason: string;
  refundDetails?: string;
  refundBankName: string;
  refundBankAccount: string;
  refundAccountName: string;
  refundAmount: number;
  refundRequestedAt: string;
  refundReviewedAt?: string;
  refundReviewedBy?: string;
  refundAdminNote?: string;
}

interface Props {
  showToast: (type: 'success' | 'error' | 'warning', message: string) => void;
  selectedShopId?: string;
}

export default function RefundManagement({ showToast, selectedShopId }: Props) {
  const [refundOrders, setRefundOrders] = useState<RefundOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRef, setExpandedRef] = useState<string | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED' | 'COMPLETED'>('APPROVED');
  const [actionRef, setActionRef] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRefundOrders = useCallback(async () => {
    try {
      setLoading(true);
      const shopParam = selectedShopId ? `&shopId=${encodeURIComponent(selectedShopId)}` : '';
      const res = await apiFetch(`/api/refund?admin=true${shopParam}`);
      const data = await res.json();
      if (data.orders) {
        setRefundOrders(data.orders);
      }
    } catch {
      showToast('error', 'ไม่สามารถโหลดข้อมูลคำขอคืนเงินได้');
    } finally {
      setLoading(false);
    }
  }, [showToast, selectedShopId]);

  useEffect(() => {
    fetchRefundOrders();
  }, [fetchRefundOrders]);

  const handleAction = async () => {
    setActionLoading(true);
    try {
      const actionMap: Record<string, string> = { APPROVED: 'approve', REJECTED: 'reject', COMPLETED: 'complete' };
      const res = await apiFetch('/api/refund', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: actionRef,
          action: actionMap[actionType] || actionType.toLowerCase(),
          adminNote,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success',
          actionType === 'APPROVED' ? 'อนุมัติคำขอคืนเงินแล้ว' :
          actionType === 'REJECTED' ? 'ปฏิเสธคำขอคืนเงินแล้ว' :
          'ดำเนินการคืนเงินเรียบร้อยแล้ว'
        );
        setActionDialogOpen(false);
        setAdminNote('');
        fetchRefundOrders();
      } else {
        showToast('error', data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      showToast('error', 'ไม่สามารถดำเนินการได้');
    } finally {
      setActionLoading(false);
    }
  };

  const openActionDialog = (ref: string, type: 'APPROVED' | 'REJECTED' | 'COMPLETED') => {
    setActionRef(ref);
    setActionType(type);
    setAdminNote('');
    setActionDialogOpen(true);
  };

  const getRefundStatusInfo = (status: string) => {
    switch (status) {
      case 'REQUESTED':
        return { label: 'รอพิจารณา', color: '#f59e0b', icon: <Clock size={14} />, bg: 'rgba(245,158,11,0.15)' };
      case 'APPROVED':
        return { label: 'อนุมัติแล้ว', color: '#60a5fa', icon: <CheckCircle size={14} />, bg: 'rgba(96,165,250,0.15)' };
      case 'COMPLETED':
        return { label: 'คืนเงินแล้ว', color: '#10b981', icon: <CheckCircle size={14} />, bg: 'rgba(16,185,129,0.15)' };
      case 'REJECTED':
        return { label: 'ปฏิเสธ', color: '#ef4444', icon: <XCircle size={14} />, bg: 'rgba(239,68,68,0.15)' };
      default:
        return { label: status, color: '#94a3b8', icon: <Clock size={14} />, bg: 'rgba(148,163,184,0.15)' };
    }
  };

  const filteredOrders = refundOrders.filter((order) => {
    if (filterStatus !== 'ALL' && order.refundStatus !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        order.ref.toLowerCase().includes(q) ||
        order.customerName?.toLowerCase().includes(q) ||
        order.customerEmail?.toLowerCase().includes(q) ||
        order.refundReason?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusCounts = {
    ALL: refundOrders.length,
    REQUESTED: refundOrders.filter(o => o.refundStatus === 'REQUESTED').length,
    APPROVED: refundOrders.filter(o => o.refundStatus === 'APPROVED').length,
    COMPLETED: refundOrders.filter(o => o.refundStatus === 'COMPLETED').length,
    REJECTED: refundOrders.filter(o => o.refundStatus === 'REJECTED').length,
  };

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-[14px] bg-gradient-to-br from-violet-600 to-violet-700 shadow-[0_4px_14px_rgba(124,58,237,0.3)]">
              <RotateCcw size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[var(--foreground)]">จัดการคำขอคืนเงิน</h2>
              <p className="text-xs text-muted-foreground">ตรวจสอบและดำเนินการคำขอคืนเงินจากลูกค้า</p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={fetchRefundOrders}>
                <RefreshCw size={20} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>รีเฟรช</TooltipContent>
          </Tooltip>
        </div>

        {/* Status Filter Chips */}
        <div className="mb-5 flex flex-wrap gap-2">
          {(['ALL', 'REQUESTED', 'APPROVED', 'COMPLETED', 'REJECTED'] as const).map((status) => {
            const isActive = filterStatus === status;
            const info = status === 'ALL'
              ? { label: 'ทั้งหมด', color: '#a5b4fc', bg: 'rgba(165,180,252,0.15)' }
              : getRefundStatusInfo(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={cn(
                  'rounded-full border px-3 py-1 text-[0.78rem] font-semibold transition-colors',
                  isActive ? 'border-current' : 'border-[var(--border)] bg-[var(--surface-2)] text-muted-foreground',
                )}
                style={isActive ? { backgroundColor: info.bg, color: info.color, borderColor: `${info.color}40` } : undefined}
              >
                {info.label} ({statusCounts[status]})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2">
          <Search size={18} className="text-muted-foreground" />
          <input
            type="text"
            placeholder="ค้นหาตาม REF, ชื่อลูกค้า..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 border-none bg-transparent text-[0.85rem] text-[var(--foreground)] outline-none"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-9 animate-spin text-violet-600" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] py-16 text-center">
            <RotateCcw size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-[0.95rem] text-muted-foreground">
              {filterStatus === 'ALL' ? 'ยังไม่มีคำขอคืนเงิน' : 'ไม่พบคำขอในสถานะนี้'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredOrders.map((order) => {
              const statusInfo = getRefundStatusInfo(order.refundStatus);
              const isExpanded = expandedRef === order.ref;

              return (
                <div
                  key={order.ref}
                  className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-violet-500/30"
                >
                  <div
                    onClick={() => setExpandedRef(isExpanded ? null : order.ref)}
                    className="flex cursor-pointer items-center gap-4 p-4 hover:bg-[var(--surface-2)]"
                  >
                    <div
                      className="grid size-10 shrink-0 place-items-center rounded-xl"
                      style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
                    >
                      {statusInfo.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="text-[0.85rem] font-bold text-[var(--foreground)]">#{order.ref}</span>
                        <Badge
                          className="h-[22px] border text-[0.68rem] font-bold"
                          style={{ backgroundColor: statusInfo.bg, color: statusInfo.color, borderColor: `${statusInfo.color}30` }}
                        >
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <p className="text-[0.73rem] text-muted-foreground">
                        {order.customerName || order.customerEmail || '-'} • {order.refundReason}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[0.95rem] font-extrabold text-amber-500">
                        ฿{order.refundAmount?.toLocaleString() || '0'}
                      </p>
                      <p className="text-[0.65rem] text-muted-foreground">
                        จาก ฿{order.total?.toLocaleString() || '0'}
                      </p>
                    </div>

                    <div className="text-muted-foreground">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-[var(--border)] px-4 pb-4">
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                          <p className="mb-3 flex items-center gap-1.5 text-[0.78rem] font-bold text-indigo-300">
                            <Package size={14} /> ข้อมูลออเดอร์
                          </p>
                          <div className="flex flex-col gap-2">
                            <DetailRow label="REF" value={order.ref} />
                            <DetailRow label="สถานะออเดอร์" value={order.status} />
                            <DetailRow label="ยอดรวม" value={`฿${order.total?.toLocaleString() || '0'}`} />
                            <DetailRow label="วันที่สั่ง" value={new Date(order.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })} />
                            <DetailRow label="ลูกค้า" value={order.customerName || order.customerEmail || '-'} />
                          </div>
                          {order.items && order.items.length > 0 && (
                            <div className="mt-3">
                              <p className="mb-1 text-[0.72rem] text-muted-foreground">สินค้าที่สั่ง:</p>
                              {order.items.map((item, i) => (
                                <p key={i} className="text-[0.72rem] text-muted-foreground">
                                  • {item.name || item.productName || 'สินค้า'} x{item.qty || item.quantity || 1}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                          <p className="mb-3 flex items-center gap-1.5 text-[0.78rem] font-bold text-violet-400">
                            <RotateCcw size={14} /> ข้อมูลคำขอคืนเงิน
                          </p>
                          <div className="flex flex-col gap-2">
                            <DetailRow label="เหตุผล" value={order.refundReason} />
                            {order.refundDetails && <DetailRow label="รายละเอียด" value={order.refundDetails} />}
                            <DetailRow label="จำนวนเงินคืน" value={`฿${order.refundAmount?.toLocaleString() || '0'}`} highlight />
                            <DetailRow label="วันที่ขอ" value={new Date(order.refundRequestedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })} />
                            {order.refundReviewedAt && (
                              <DetailRow label="วันที่ตรวจสอบ" value={new Date(order.refundReviewedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })} />
                            )}
                            {order.refundAdminNote && <DetailRow label="หมายเหตุแอดมิน" value={order.refundAdminNote} />}
                          </div>
                        </div>

                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:col-span-2">
                          <p className="mb-3 flex items-center gap-1.5 text-[0.78rem] font-bold text-emerald-400">
                            <Banknote size={14} /> ข้อมูลบัญชีรับเงิน
                          </p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <DetailRow label="ธนาคาร" value={order.refundBankName} />
                            <DetailRow label="เลขบัญชี" value={order.refundBankAccount} />
                            <DetailRow label="ชื่อเจ้าของบัญชี" value={order.refundAccountName} />
                          </div>
                        </div>
                      </div>

                      {order.refundStatus === 'REQUESTED' && (
                        <div className="mt-4 flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => openActionDialog(order.ref, 'REJECTED')}
                            className="border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          >
                            <XCircle size={16} className="mr-1" />
                            ปฏิเสธ
                          </Button>
                          <Button
                            onClick={() => openActionDialog(order.ref, 'APPROVED')}
                            className="bg-gradient-to-br from-emerald-500 to-emerald-600 font-bold shadow-[0_4px_14px_rgba(16,185,129,0.3)]"
                          >
                            <CheckCircle size={16} className="mr-1" />
                            อนุมัติ
                          </Button>
                        </div>
                      )}
                      {order.refundStatus === 'APPROVED' && (
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                          <Alert className="flex-1 border-blue-500/20 bg-blue-500/10 py-2">
                            <Info className="size-4" />
                            <AlertDescription className="text-[0.75rem]">
                              อนุมัติแล้ว — กรุณาโอนเงินคืนแล้วกดยืนยัน
                            </AlertDescription>
                          </Alert>
                          <Button
                            onClick={() => openActionDialog(order.ref, 'COMPLETED')}
                            className="bg-gradient-to-br from-violet-600 to-violet-700 font-bold shadow-[0_4px_14px_rgba(124,58,237,0.3)]"
                          >
                            <Banknote size={16} className="mr-1" />
                            ยืนยันโอนเงินแล้ว
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Action Confirmation Dialog */}
        <Dialog open={actionDialogOpen} onOpenChange={(open) => !actionLoading && setActionDialogOpen(open)}>
          <DialogContent className="max-w-xs rounded-2xl border-[var(--border)] bg-[var(--card)] backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                {actionType === 'APPROVED' && <><CheckCircle size={20} className="text-emerald-500" /> อนุมัติคำขอคืนเงิน</>}
                {actionType === 'REJECTED' && <><XCircle size={20} className="text-red-500" /> ปฏิเสธคำขอคืนเงิน</>}
                {actionType === 'COMPLETED' && <><Banknote size={20} className="text-violet-500" /> ยืนยันการโอนเงินคืน</>}
              </DialogTitle>
              <DialogDescription className="text-[0.82rem]">
                {actionType === 'APPROVED' && 'คำขอคืนเงินจะถูกอนุมัติ คุณจะต้องดำเนินการโอนเงินและยืนยันในขั้นตอนถัดไป'}
                {actionType === 'REJECTED' && 'คำขอคืนเงินจะถูกปฏิเสธ ลูกค้าจะเห็นหมายเหตุที่คุณใส่'}
                {actionType === 'COMPLETED' && 'ยืนยันว่าได้โอนเงินคืนให้ลูกค้าเรียบร้อยแล้ว สถานะออเดอร์จะเปลี่ยนเป็น REFUNDED'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label className="text-[0.78rem] font-semibold">
                หมายเหตุ {actionType === 'REJECTED' ? '(แนะนำให้ระบุ)' : '(ถ้ามี)'}
              </Label>
              <Textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
                placeholder={
                  actionType === 'REJECTED' ? 'ระบุเหตุผลที่ปฏิเสธ...' :
                  actionType === 'COMPLETED' ? 'เช่น โอนแล้วเวลา 14:30' :
                  'หมายเหตุเพิ่มเติม...'
                }
                className="rounded-[10px] bg-[var(--surface-2)] text-[0.85rem]"
              />
            </div>
            <DialogFooter className="gap-2 border-t border-[var(--border)] pt-4">
              <Button variant="ghost" onClick={() => setActionDialogOpen(false)} disabled={actionLoading}>
                ยกเลิก
              </Button>
              <Button
                onClick={handleAction}
                disabled={actionLoading}
                className={cn(
                  'rounded-[10px] px-6 font-bold',
                  actionType === 'REJECTED' && 'bg-gradient-to-br from-red-500 to-red-600',
                  actionType === 'COMPLETED' && 'bg-gradient-to-br from-violet-600 to-violet-700',
                  actionType === 'APPROVED' && 'bg-gradient-to-br from-emerald-500 to-emerald-600',
                )}
              >
                {actionLoading ? (
                  <Loader2 className="size-[18px] animate-spin" />
                ) : (
                  actionType === 'APPROVED' ? 'อนุมัติ' :
                  actionType === 'REJECTED' ? 'ปฏิเสธ' :
                  'ยืนยัน'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="shrink-0 text-[0.72rem] text-muted-foreground">{label}</span>
      <span className={cn(
        'break-all text-right text-[0.72rem]',
        highlight ? 'font-bold text-amber-500' : 'font-medium text-[var(--foreground)]',
      )}>
        {value}
      </span>
    </div>
  );
}
