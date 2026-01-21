'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Box, Typography, Paper } from '@mui/material';

interface PromptPayQRProps {
  payload: string;
  amount: number;
  size?: number;
}

/**
 * PromptPay QR Code component with Thai styling
 * Generates beautiful QR code for PromptPay payments
 */
export default function PromptPayQR({ payload, amount, size = 256 }: PromptPayQRProps) {
  if (!payload) {
    return (
      <Box sx={{ textAlign: 'center', p: 2 }}>
        <Typography color="error">ไม่สามารถสร้าง QR Code ได้</Typography>
      </Box>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        background: 'linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: size + 48,
        mx: 'auto',
      }}
    >
      {/* PromptPay Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography
          variant="h6"
          sx={{
            color: '#fff',
            fontWeight: 700,
            letterSpacing: 1,
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          พร้อมเพย์
        </Typography>
        <Box
          component="span"
          sx={{
            bgcolor: '#fff',
            color: '#1a237e',
            px: 1,
            py: 0.25,
            borderRadius: 1,
            fontSize: '0.7rem',
            fontWeight: 700,
          }}
        >
          PROMPTPAY
        </Box>
      </Box>

      {/* QR Code Container */}
      <Box
        sx={{
          bgcolor: '#fff',
          p: 2,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}
      >
        <QRCodeSVG
          value={payload}
          size={size}
          level="M"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#1a237e"
          imageSettings={{
            src: '/promptpay-logo.svg',
            height: size * 0.15,
            width: size * 0.15,
            excavate: true,
          }}
        />
      </Box>

      {/* Amount Display */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography
          variant="body2"
          sx={{ color: 'rgba(255,255,255,0.8)', mb: 0.5 }}
        >
          จำนวนเงิน
        </Typography>
        <Typography
          variant="h5"
          sx={{
            color: '#fff',
            fontWeight: 700,
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          ฿{amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
        </Typography>
      </Box>

      {/* Instructions */}
      <Typography
        variant="caption"
        sx={{
          color: 'rgba(255,255,255,0.7)',
          mt: 1.5,
          textAlign: 'center',
          lineHeight: 1.4,
        }}
      >
        สแกน QR Code ด้วยแอปธนาคาร
        <br />
        เพื่อชำระเงิน
      </Typography>
    </Paper>
  );
}
