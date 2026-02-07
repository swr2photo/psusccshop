'use client';

import React from 'react';
import {
  Box,
  Button,
  Dialog,
  Typography,
} from '@mui/material';
import { Ruler } from 'lucide-react';

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'];

const SIZE_MEASUREMENTS: Record<string, { chest: string; length: string }> = {
  XS: { chest: '36', length: '25' },
  S: { chest: '38', length: '26' },
  M: { chest: '40', length: '27' },
  L: { chest: '42', length: '28' },
  XL: { chest: '44', length: '29' },
  '2XL': { chest: '46', length: '30' },
  '3XL': { chest: '48', length: '31' },
  '4XL': { chest: '50', length: '32' },
  '5XL': { chest: '52', length: '33' },
  '6XL': { chest: '54', length: '34' },
  '7XL': { chest: '56', length: '35' },
  '8XL': { chest: '58', length: '36' },
  '9XL': { chest: '60', length: '37' },
  '10XL': { chest: '62', length: '38' },
};

interface SizeChartDialogProps {
  open: boolean;
  onClose: () => void;
  selectedSize?: string;
  onSelectSize?: (size: string) => void;
  longSleevePrice?: number;
}

export default function SizeChartDialog(props: SizeChartDialogProps) {
  const open = props.open;
  const onClose = props.onClose;
  const selectedSize = props.selectedSize;
  const onSelectSize = props.onSelectSize;
  const longSleevePrice = props.longSleevePrice ?? 50;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{ zIndex: 1500 }}
      PaperProps={{
        sx: {
          bgcolor: 'var(--surface)',
          color: 'var(--foreground)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.1)',
          mx: 2,
          my: 'auto',
          maxHeight: '85vh',
        },
      }}
      slotProps={{
        backdrop: {
          sx: { backdropFilter: 'blur(8px)', bgcolor: 'rgba(0,0,0,0.6)' },
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 2.5,
        py: 2,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
            display: 'grid',
            placeItems: 'center',
          }}>
            <Ruler size={20} color="white" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--foreground)' }}>ตารางไซส์</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>สัดส่วนรอบอก/ความยาว (นิ้ว)</Typography>
          </Box>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ px: 2.5, py: 2, overflow: 'auto' }}>
        {/* Info Badges */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mb: 2.5 }}>
          <Box sx={{
            px: 1.2,
            py: 0.4,
            borderRadius: '8px',
            bgcolor: 'rgba(0,113,227,0.15)',
            border: '1px solid rgba(0,113,227,0.3)',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}>
            <Ruler size={14} /> อก / ความยาว (นิ้ว)
          </Box>
          <Box sx={{
            px: 1.2,
            py: 0.4,
            borderRadius: '8px',
            bgcolor: 'rgba(245,158,11,0.15)',
            border: '1px solid rgba(245,158,11,0.3)',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#ffd60a',
          }}>
            แขนยาว +{longSleevePrice}฿
          </Box>
        </Box>

        {/* Size Cards Grid */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, 1fr)', 
          gap: 1.2,
        }}>
          {SIZE_ORDER.map((size) => {
            const measurement = SIZE_MEASUREMENTS[size];
            const isSelected = selectedSize === size;
            
            return (
              <Box
                key={size}
                onClick={() => onSelectSize?.(size)}
                sx={{
                  p: 1.8,
                  borderRadius: '14px',
                  bgcolor: isSelected ? 'rgba(0,113,227,0.2)' : 'var(--surface-2)',
                  border: isSelected 
                    ? '2px solid rgba(0,113,227,0.6)' 
                    : '1px solid var(--glass-border)',
                  cursor: onSelectSize ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  '&:hover': onSelectSize ? {
                    bgcolor: isSelected ? 'rgba(0,113,227,0.25)' : 'var(--glass-bg)',
                    borderColor: isSelected ? 'rgba(0,113,227,0.8)' : 'var(--text-muted)',
                    transform: 'translateY(-2px)',
                  } : {},
                }}
              >
                <Typography sx={{
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: isSelected ? 'var(--primary)' : 'var(--foreground)',
                  mb: 0.5,
                }}>
                  {size}
                </Typography>
                <Typography sx={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                }}>
                  {measurement.chest}" × {measurement.length}"
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={{
        px: 2.5,
        py: 2,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Button
          fullWidth
          onClick={onClose}
          sx={{
            py: 1.2,
            borderRadius: '12px',
            bgcolor: 'rgba(100,116,139,0.15)',
            border: '1px solid rgba(100,116,139,0.3)',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
            fontWeight: 600,
            textTransform: 'none',
            '&:hover': { bgcolor: 'rgba(100,116,139,0.25)' },
          }}
        >
          ปิด
        </Button>
      </Box>
    </Dialog>
  );
}
