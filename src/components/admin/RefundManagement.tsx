'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Eye,
  ChevronDown,
  ChevronUp,
  Banknote,
  User,
  Package,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';

const ADMIN_THEME = {
  bg: '#0f172a',
  glass: 'rgba(15,23,42,0.8)',
  glassSoft: 'rgba(30,41,59,0.5)',
  border: 'rgba(148,163,184,0.1)',
  gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  text: '#e2e8f0',
  textSecondary: '#94a3b8',
  muted: '#64748b',
  accent: '#6366f1',
};

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
}

export default function RefundManagement({ showToast }: Props) {
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
      const res = await fetch('/api/refund?admin=true');
      const data = await res.json();
      if (data.orders) {
        setRefundOrders(data.orders);
      }
    } catch {
      showToast('error', 'ไม่สามารถโหลดข้อมูลคำขอคืนเงินได้');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchRefundOrders();
  }, [fetchRefundOrders]);

  const handleAction = async () => {
    setActionLoading(true);
    try {
      const actionMap: Record<string, string> = { APPROVED: 'approve', REJECTED: 'reject', COMPLETED: 'complete' };
      const res = await fetch('/api/refund', {
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
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 44,
            height: 44,
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
          }}>
            <RotateCcw size={22} color="white" />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: ADMIN_THEME.text }}>
              จัดการคำขอคืนเงิน
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: ADMIN_THEME.muted }}>
              ตรวจสอบและดำเนินการคำขอคืนเงินจากลูกค้า
            </Typography>
          </Box>
        </Box>
        <Tooltip title="รีเฟรช">
          <IconButton onClick={fetchRefundOrders} sx={{ color: ADMIN_THEME.textSecondary }}>
            <RefreshCw size={20} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Status Filter Chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
        {(['ALL', 'REQUESTED', 'APPROVED', 'COMPLETED', 'REJECTED'] as const).map((status) => {
          const isActive = filterStatus === status;
          const info = status === 'ALL'
            ? { label: 'ทั้งหมด', color: '#a5b4fc', bg: 'rgba(165,180,252,0.15)' }
            : getRefundStatusInfo(status);
          return (
            <Chip
              key={status}
              label={`${info.label} (${statusCounts[status]})`}
              onClick={() => setFilterStatus(status)}
              sx={{
                bgcolor: isActive ? info.bg : 'rgba(255,255,255,0.03)',
                color: isActive ? info.color : ADMIN_THEME.muted,
                border: `1px solid ${isActive ? `${info.color}40` : ADMIN_THEME.border}`,
                fontWeight: 600,
                fontSize: '0.78rem',
                '&:hover': { bgcolor: info.bg },
              }}
            />
          );
        })}
      </Box>

      {/* Search */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        mb: 2.5,
        borderRadius: '12px',
        bgcolor: ADMIN_THEME.glassSoft,
        border: `1px solid ${ADMIN_THEME.border}`,
      }}>
        <Search size={18} style={{ color: ADMIN_THEME.muted }} />
        <input
          type="text"
          placeholder="ค้นหาตาม REF, ชื่อลูกค้า..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: ADMIN_THEME.text,
            fontSize: '0.85rem',
          }}
        />
      </Box>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={36} sx={{ color: '#7c3aed' }} />
        </Box>
      ) : filteredOrders.length === 0 ? (
        <Box sx={{
          textAlign: 'center',
          py: 8,
          bgcolor: ADMIN_THEME.glassSoft,
          borderRadius: '16px',
          border: `1px solid ${ADMIN_THEME.border}`,
        }}>
          <RotateCcw size={48} style={{ color: ADMIN_THEME.muted, marginBottom: 16 }} />
          <Typography sx={{ color: ADMIN_THEME.textSecondary, fontSize: '0.95rem' }}>
            {filterStatus === 'ALL' ? 'ยังไม่มีคำขอคืนเงิน' : 'ไม่พบคำขอในสถานะนี้'}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {filteredOrders.map((order) => {
            const statusInfo = getRefundStatusInfo(order.refundStatus);
            const isExpanded = expandedRef === order.ref;

            return (
              <Box
                key={order.ref}
                sx={{
                  bgcolor: ADMIN_THEME.glass,
                  border: `1px solid ${ADMIN_THEME.border}`,
                  borderRadius: '16px',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                  '&:hover': { borderColor: 'rgba(124,58,237,0.3)' },
                }}
              >
                {/* Card Header */}
                <Box
                  onClick={() => setExpandedRef(isExpanded ? null : order.ref)}
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                  }}
                >
                  {/* Status Icon */}
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '12px',
                    bgcolor: statusInfo.bg,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    color: statusInfo.color,
                  }}>
                    {statusInfo.icon}
                  </Box>

                  {/* Order Info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: ADMIN_THEME.text }}>
                        #{order.ref}
                      </Typography>
                      <Chip
                        size="small"
                        label={statusInfo.label}
                        sx={{
                          height: 22,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          bgcolor: statusInfo.bg,
                          color: statusInfo.color,
                          border: `1px solid ${statusInfo.color}30`,
                        }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: '0.73rem', color: ADMIN_THEME.muted }}>
                      {order.customerName || order.customerEmail || '-'} • {order.refundReason}
                    </Typography>
                  </Box>

                  {/* Amount */}
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: '#f59e0b' }}>
                      ฿{order.refundAmount?.toLocaleString() || '0'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: ADMIN_THEME.muted }}>
                      จาก ฿{order.total?.toLocaleString() || '0'}
                    </Typography>
                  </Box>

                  {/* Expand Icon */}
                  <Box sx={{ color: ADMIN_THEME.muted }}>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </Box>
                </Box>

                {/* Expanded Details */}
                {isExpanded && (
                  <Box sx={{
                    px: 2,
                    pb: 2,
                    borderTop: `1px solid ${ADMIN_THEME.border}`,
                  }}>
                    {/* Details Grid */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 2 }}>
                      {/* Order Info */}
                      <Box sx={{
                        p: 2,
                        borderRadius: '12px',
                        bgcolor: 'rgba(255,255,255,0.02)',
                        border: `1px solid ${ADMIN_THEME.border}`,
                      }}>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#a5b4fc', mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.7 }}>
                          <Package size={14} /> ข้อมูลออเดอร์
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                          <DetailRow label="REF" value={order.ref} />
                          <DetailRow label="สถานะออเดอร์" value={order.status} />
                          <DetailRow label="ยอดรวม" value={`฿${order.total?.toLocaleString() || '0'}`} />
                          <DetailRow label="วันที่สั่ง" value={new Date(order.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })} />
                          <DetailRow label="ลูกค้า" value={order.customerName || order.customerEmail || '-'} />
                        </Box>
                        {/* Ordered Items */}
                        {order.items && order.items.length > 0 && (
                          <Box sx={{ mt: 1.5 }}>
                            <Typography sx={{ fontSize: '0.72rem', color: ADMIN_THEME.muted, mb: 0.5 }}>สินค้าที่สั่ง:</Typography>
                            {order.items.map((item, i) => (
                              <Typography key={i} sx={{ fontSize: '0.72rem', color: ADMIN_THEME.textSecondary }}>
                                • {item.name || item.productName || 'สินค้า'} x{item.qty || item.quantity || 1}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </Box>

                      {/* Refund Info */}
                      <Box sx={{
                        p: 2,
                        borderRadius: '12px',
                        bgcolor: 'rgba(124,58,237,0.04)',
                        border: `1px solid rgba(124,58,237,0.12)`,
                      }}>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#a78bfa', mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.7 }}>
                          <RotateCcw size={14} /> ข้อมูลคำขอคืนเงิน
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                          <DetailRow label="เหตุผล" value={order.refundReason} />
                          {order.refundDetails && <DetailRow label="รายละเอียด" value={order.refundDetails} />}
                          <DetailRow label="จำนวนเงินคืน" value={`฿${order.refundAmount?.toLocaleString() || '0'}`} highlight />
                          <DetailRow label="วันที่ขอ" value={new Date(order.refundRequestedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })} />
                          {order.refundReviewedAt && (
                            <DetailRow label="วันที่ตรวจสอบ" value={new Date(order.refundReviewedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })} />
                          )}
                          {order.refundAdminNote && <DetailRow label="หมายเหตุแอดมิน" value={order.refundAdminNote} />}
                        </Box>
                      </Box>

                      {/* Bank Info */}
                      <Box sx={{
                        p: 2,
                        borderRadius: '12px',
                        bgcolor: 'rgba(16,185,129,0.04)',
                        border: `1px solid rgba(16,185,129,0.12)`,
                        gridColumn: { sm: '1 / -1' },
                      }}>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399', mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.7 }}>
                          <Banknote size={14} /> ข้อมูลบัญชีรับเงิน
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1 }}>
                          <DetailRow label="ธนาคาร" value={order.refundBankName} />
                          <DetailRow label="เลขบัญชี" value={order.refundBankAccount} />
                          <DetailRow label="ชื่อเจ้าของบัญชี" value={order.refundAccountName} />
                        </Box>
                      </Box>
                    </Box>

                    {/* Action Buttons */}
                    {order.refundStatus === 'REQUESTED' && (
                      <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
                        <Button
                          onClick={() => openActionDialog(order.ref, 'REJECTED')}
                          sx={{
                            px: 2.5,
                            py: 0.8,
                            borderRadius: '10px',
                            bgcolor: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#f87171',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            textTransform: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            '&:hover': {
                              bgcolor: 'rgba(239,68,68,0.2)',
                            },
                          }}
                        >
                          <XCircle size={16} />
                          ปฏิเสธ
                        </Button>
                        <Button
                          onClick={() => openActionDialog(order.ref, 'APPROVED')}
                          sx={{
                            px: 2.5,
                            py: 0.8,
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            textTransform: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                            },
                          }}
                        >
                          <CheckCircle size={16} />
                          อนุมัติ
                        </Button>
                      </Box>
                    )}
                    {order.refundStatus === 'APPROVED' && (
                      <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
                        <Alert severity="info" sx={{ flex: 1, fontSize: '0.75rem', py: 0 }}>
                          อนุมัติแล้ว — กรุณาโอนเงินคืนแล้วกดยืนยัน
                        </Alert>
                        <Button
                          onClick={() => openActionDialog(order.ref, 'COMPLETED')}
                          sx={{
                            px: 2.5,
                            py: 0.8,
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                            color: 'white',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            textTransform: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%)',
                            },
                          }}
                        >
                          <Banknote size={16} />
                          ยืนยันโอนเงินแล้ว
                        </Button>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {/* Action Confirmation Dialog */}
      <Dialog
        open={actionDialogOpen}
        onClose={() => !actionLoading && setActionDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: ADMIN_THEME.glass,
            backgroundImage: 'none',
            borderRadius: '16px',
            border: `1px solid ${ADMIN_THEME.border}`,
            backdropFilter: 'blur(20px)',
          },
        }}
      >
        <DialogTitle sx={{
          fontWeight: 700,
          fontSize: '1rem',
          color: ADMIN_THEME.text,
          borderBottom: `1px solid ${ADMIN_THEME.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}>
          {actionType === 'APPROVED' && <><CheckCircle size={20} style={{ color: '#10b981' }} /> อนุมัติคำขอคืนเงิน</>}
          {actionType === 'REJECTED' && <><XCircle size={20} style={{ color: '#ef4444' }} /> ปฏิเสธคำขอคืนเงิน</>}
          {actionType === 'COMPLETED' && <><Banknote size={20} style={{ color: '#7c3aed' }} /> ยืนยันการโอนเงินคืน</>}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Typography sx={{ fontSize: '0.82rem', color: ADMIN_THEME.textSecondary, mb: 2 }}>
            {actionType === 'APPROVED' && 'คำขอคืนเงินจะถูกอนุมัติ คุณจะต้องดำเนินการโอนเงินและยืนยันในขั้นตอนถัดไป'}
            {actionType === 'REJECTED' && 'คำขอคืนเงินจะถูกปฏิเสธ ลูกค้าจะเห็นหมายเหตุที่คุณใส่'}
            {actionType === 'COMPLETED' && 'ยืนยันว่าได้โอนเงินคืนให้ลูกค้าเรียบร้อยแล้ว สถานะออเดอร์จะเปลี่ยนเป็น REFUNDED'}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, mb: 0.5, color: ADMIN_THEME.text }}>
            หมายเหตุ {actionType === 'REJECTED' ? '(แนะนำให้ระบุ)' : '(ถ้ามี)'}
          </Typography>
          <TextField
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            multiline
            rows={3}
            fullWidth
            placeholder={
              actionType === 'REJECTED' ? 'ระบุเหตุผลที่ปฏิเสธ...' :
              actionType === 'COMPLETED' ? 'เช่น โอนแล้วเวลา 14:30' :
              'หมายเหตุเพิ่มเติม...'
            }
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '10px',
                fontSize: '0.85rem',
                color: ADMIN_THEME.text,
                bgcolor: ADMIN_THEME.glassSoft,
                '& fieldset': { borderColor: ADMIN_THEME.border },
                '&:hover fieldset': { borderColor: 'rgba(124,58,237,0.3)' },
                '&.Mui-focused fieldset': { borderColor: '#7c3aed' },
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${ADMIN_THEME.border}` }}>
          <Button
            onClick={() => setActionDialogOpen(false)}
            disabled={actionLoading}
            sx={{ color: ADMIN_THEME.muted, textTransform: 'none', fontWeight: 600 }}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleAction}
            disabled={actionLoading}
            sx={{
              px: 3,
              borderRadius: '10px',
              background: actionType === 'REJECTED'
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                : actionType === 'COMPLETED'
                ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              textTransform: 'none',
              fontWeight: 700,
              '&:disabled': {
                background: 'rgba(100,116,139,0.2)',
                color: 'rgba(100,116,139,0.5)',
              },
            }}
          >
            {actionLoading ? (
              <CircularProgress size={18} sx={{ color: 'white' }} />
            ) : (
              actionType === 'APPROVED' ? 'อนุมัติ' :
              actionType === 'REJECTED' ? 'ปฏิเสธ' :
              'ยืนยัน'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
      <Typography sx={{ fontSize: '0.72rem', color: '#64748b', flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{
        fontSize: '0.72rem',
        fontWeight: highlight ? 700 : 500,
        color: highlight ? '#f59e0b' : '#e2e8f0',
        textAlign: 'right',
        wordBreak: 'break-all',
      }}>
        {value}
      </Typography>
    </Box>
  );
}
