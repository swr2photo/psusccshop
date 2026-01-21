'use client';

import React, { useEffect, useState } from 'react';
import { Box, Typography, Container } from '@mui/material';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Zap,
  CalendarClock,
  Store,
  LucideIcon,
} from 'lucide-react';

// ==================== SHOP STATUS TYPES ====================
export type ShopStatusType = 'OPEN' | 'COMING_SOON' | 'ORDER_ENDED' | 'TEMPORARILY_CLOSED' | 'WAITING_TO_OPEN';

export interface ShopStatusInfo {
  type: ShopStatusType;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgGradient: string;
  borderColor: string;
}

export const SHOP_STATUS_CONFIG: Record<ShopStatusType, Omit<ShopStatusInfo, 'type'>> = {
  OPEN: {
    label: 'เปิดให้บริการ',
    description: 'สั่งซื้อสินค้าได้แล้ววันนี้!',
    icon: CheckCircle,
    color: '#10b981',
    bgGradient: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
    borderColor: 'rgba(16,185,129,0.4)',
  },
  COMING_SOON: {
    label: 'เร็วๆ นี้',
    description: 'เตรียมพบกับสินค้าใหม่เร็วๆ นี้!',
    icon: Zap,
    color: '#f59e0b',
    bgGradient: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)',
    borderColor: 'rgba(245,158,11,0.4)',
  },
  ORDER_ENDED: {
    label: 'หมดเขตสั่งซื้อ',
    description: 'ระยะเวลาการสั่งซื้อสิ้นสุดแล้ว',
    icon: XCircle,
    color: '#ef4444',
    bgGradient: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
    borderColor: 'rgba(239,68,68,0.4)',
  },
  TEMPORARILY_CLOSED: {
    label: 'ปิดชั่วคราว',
    description: 'ร้านค้าปิดให้บริการชั่วคราว กรุณารอการแจ้งเปิดใหม่',
    icon: AlertTriangle,
    color: '#f97316',
    bgGradient: 'linear-gradient(135deg, rgba(249,115,22,0.15) 0%, rgba(249,115,22,0.05) 100%)',
    borderColor: 'rgba(249,115,22,0.4)',
  },
  WAITING_TO_OPEN: {
    label: 'รอเปิดให้บริการ',
    description: 'กรุณารอสักครู่ ร้านค้ากำลังจะเปิด',
    icon: CalendarClock,
    color: '#6366f1',
    bgGradient: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.05) 100%)',
    borderColor: 'rgba(99,102,241,0.4)',
  },
};

// Helper to check if a date string is valid
const isValidDate = (dateString?: string): boolean => {
  if (!dateString || dateString.trim() === '') return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
};

// Helper to check if datetime string includes time component
const hasTimeComponent = (dateString: string): boolean => {
  // Check if string contains time (T00:00 or space with time)
  return dateString.includes('T') || /\d{2}:\d{2}/.test(dateString);
};

// Helper to get the close datetime - use exact time if specified, otherwise end of day
const getCloseDateTime = (dateString: string): Date => {
  const date = new Date(dateString);
  // If no time component was specified, use end of day (23:59:59)
  if (!hasTimeComponent(dateString)) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
};

// Helper to get the open datetime - use exact time if specified, otherwise start of day
const getOpenDateTime = (dateString: string): Date => {
  const date = new Date(dateString);
  // If no time component was specified, use start of day (00:00:00)
  if (!hasTimeComponent(dateString)) {
    date.setHours(0, 0, 0, 0);
  }
  return date;
};

// Helper to determine shop status
export const getShopStatus = (isOpen: boolean, closeDate?: string, openDate?: string): ShopStatusType => {
  const now = new Date();
  
  // Check if shop is explicitly closed
  if (!isOpen) return 'TEMPORARILY_CLOSED';
  
  // Check if there's an opening date in the future (only if valid date)
  if (isValidDate(openDate)) {
    const open = getOpenDateTime(openDate!);
    if (now < open) return 'WAITING_TO_OPEN';
  }
  
  // Check if closeDate has passed - use exact time if specified
  if (isValidDate(closeDate)) {
    const close = getCloseDateTime(closeDate!);
    if (now > close) return 'ORDER_ENDED';
  }
  
  return 'OPEN';
};

// Helper to determine product status
export const getProductStatus = (product: { isActive?: boolean; startDate?: string; endDate?: string }): ShopStatusType => {
  const now = new Date();
  const start = isValidDate(product.startDate) ? getOpenDateTime(product.startDate!) : null;
  const end = isValidDate(product.endDate) ? getCloseDateTime(product.endDate!) : null;
  
  if (!product.isActive) return 'TEMPORARILY_CLOSED';
  if (start && now < start) return 'COMING_SOON';
  if (end && now > end) return 'ORDER_ENDED';
  return 'OPEN';
};

// Format countdown time
export const formatCountdown = (targetDate: Date): string => {
  // Handle invalid date
  if (!targetDate || isNaN(targetDate.getTime())) return '';
  
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();
  
  // ไม่แสดง "หมดเวลาแล้ว" - return empty string แทน
  if (diff <= 0) return '';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days} วัน ${hours} ชม.`;
  if (hours > 0) return `${hours} ชม. ${minutes} นาที`;
  return `${minutes} นาที`;
};

// ==================== SHOP STATUS CARD COMPONENT ====================
interface ShopStatusCardProps {
  status: ShopStatusType;
  countdownDate?: string;
  customMessage?: string;
  compact?: boolean;
  showWhenOpen?: boolean;
}

export default function ShopStatusCard({ 
  status, 
  countdownDate, 
  customMessage,
  compact = false,
  showWhenOpen = false,
}: ShopStatusCardProps) {
  const config = SHOP_STATUS_CONFIG[status];
  const [countdown, setCountdown] = useState<string>('');
  
  useEffect(() => {
    if (!countdownDate) return;
    const targetDate = new Date(countdownDate);
    
    const updateCountdown = () => {
      setCountdown(formatCountdown(targetDate));
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [countdownDate]);

  // Don't show anything if shop is open and showWhenOpen is false
  if (status === 'OPEN' && !showWhenOpen) return null;

  if (compact) {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.5,
          borderRadius: '12px',
          background: config.bgGradient,
          border: `1px solid ${config.borderColor}`,
        }}
      >
        <Box sx={{ color: config.color, display: 'flex', alignItems: 'center' }}>
          <config.icon size={16} />
        </Box>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: config.color }}>
          {config.label}
        </Typography>
        {countdown && (
          <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', ml: 0.5 }}>
            ({countdown})
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: '24px',
        background: config.bgGradient,
        border: `1px solid ${config.borderColor}`,
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
        p: { xs: 2.5, sm: 3 },
      }}
    >
      {/* Decorative background elements */}
      <Box
        sx={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 150,
          height: 150,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${config.color}15 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -30,
          left: -30,
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${config.color}10 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          {/* Icon */}
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(135deg, ${config.color}30 0%, ${config.color}10 100%)`,
              border: `1px solid ${config.color}40`,
              color: config.color,
              flexShrink: 0,
            }}
          >
            <config.icon size={32} />
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: { xs: '1.1rem', sm: '1.25rem' },
                fontWeight: 800,
                color: config.color,
                mb: 0.5,
              }}
            >
              {config.label}
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: '0.85rem', sm: '0.9rem' },
                color: '#94a3b8',
                lineHeight: 1.5,
              }}
            >
              {customMessage || config.description}
            </Typography>

            {/* Countdown */}
            {countdown && (
              <Box
                sx={{
                  mt: 2,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1,
                  borderRadius: '12px',
                  bgcolor: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <Clock size={16} color={config.color} />
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>
                  {(status === 'COMING_SOON' || status === 'WAITING_TO_OPEN') ? 'เปิดใน ' : ''}
                  <Box component="span" sx={{ color: config.color, fontWeight: 700 }}>
                    {countdown}
                  </Box>
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ==================== PRODUCT STATUS BADGE COMPONENT ====================
interface ProductStatusBadgeProps {
  product: { isActive?: boolean; startDate?: string; endDate?: string };
}

export function ProductStatusBadge({ product }: ProductStatusBadgeProps) {
  const status = getProductStatus(product);
  const config = SHOP_STATUS_CONFIG[status];
  
  if (status === 'OPEN') return null;
  
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 10,
        borderRadius: 'inherit',
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: config.bgGradient,
          border: `1px solid ${config.borderColor}`,
          color: config.color,
          mb: 1.5,
        }}
      >
        <config.icon size={24} />
      </Box>
      <Typography
        sx={{
          fontSize: '0.85rem',
          fontWeight: 700,
          color: config.color,
          textAlign: 'center',
          px: 2,
        }}
      >
        {config.label}
      </Typography>
      {product.startDate && status === 'COMING_SOON' && (
        <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', mt: 0.5 }}>
          เปิด {new Date(product.startDate).toLocaleDateString('th-TH')}
        </Typography>
      )}
    </Box>
  );
}

// ==================== SHOP STATUS BANNER COMPONENT ====================
interface ShopStatusBannerProps {
  isOpen: boolean;
  closeDate?: string;
  openDate?: string;
  customMessage?: string;
}

export function ShopStatusBanner({ isOpen, closeDate, openDate, customMessage }: ShopStatusBannerProps) {
  const status = getShopStatus(isOpen, closeDate, openDate);
  
  // Don't show banner if shop is open normally
  if (status === 'OPEN') return null;
  
  // Determine countdown date based on status
  const countdownDate = status === 'WAITING_TO_OPEN' || status === 'COMING_SOON' 
    ? openDate 
    : closeDate;
  
  return (
    <Container maxWidth="lg" sx={{ pt: 2, pb: 1 }}>
      <ShopStatusCard 
        status={status} 
        countdownDate={countdownDate}
        customMessage={customMessage}
      />
    </Container>
  );
}

// ==================== COMPACT STATUS CHIP ====================
interface StatusChipProps {
  status: ShopStatusType;
  countdownDate?: string;
}

export function StatusChip({ status, countdownDate }: StatusChipProps) {
  const config = SHOP_STATUS_CONFIG[status];
  const [countdown, setCountdown] = useState<string>('');
  
  useEffect(() => {
    if (!countdownDate) return;
    const targetDate = new Date(countdownDate);
    
    const updateCountdown = () => {
      setCountdown(formatCountdown(targetDate));
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [countdownDate]);

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.2,
        py: 0.4,
        borderRadius: '8px',
        background: config.bgGradient,
        border: `1px solid ${config.borderColor}`,
      }}
    >
      <Box sx={{ color: config.color, display: 'flex', alignItems: 'center' }}>
        <config.icon size={14} />
      </Box>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: config.color }}>
        {config.label}
      </Typography>
      {countdown && (
        <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>
          {countdown}
        </Typography>
      )}
    </Box>
  );
}
