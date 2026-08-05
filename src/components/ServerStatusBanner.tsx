'use client';

import React from 'react';
import { Box, Typography, Button, Collapse } from '@mui/material';
import { TriangleAlert, RefreshCw } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export interface ServerStatusBannerProps {
  show?: boolean;
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ServerStatusBanner({
  show = false,
  message,
  onRetry,
  isRetrying = false,
}: ServerStatusBannerProps) {
  const { lang } = useTranslation();

  const defaultMessage =
    lang === 'en'
      ? 'Server is temporarily experiencing connection issues. Automatic background updates active.'
      : 'เซิร์ฟเวอร์มีปัญหาชั่วคราว ระบบได้สลับเข้าสู่โหมดอัปเดตอัตโนมัติ';

  const displayMessage = message || defaultMessage;

  return (
    <Collapse in={show} mountOnEnter unmountOnExit>
      <Box
        sx={{
          width: '100%',
          px: { xs: 2, sm: 3 },
          py: 1,
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(239, 68, 68, 0.12) 100%)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          color: '#d97706',
          fontSize: '0.875rem',
          fontWeight: 500,
          transition: 'all 0.3s ease',
        }}
      >
        <TriangleAlert size={18} style={{ flexShrink: 0, color: '#f59e0b' }} />
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            fontSize: { xs: '0.8125rem', sm: '0.875rem' },
            color: 'var(--text-main, #374151)',
            flex: { xs: 1, sm: 'none' },
          }}
        >
          {displayMessage}
        </Typography>

        {onRetry && (
          <Button
            size="small"
            onClick={onRetry}
            disabled={isRetrying}
            startIcon={
              <RefreshCw
                size={14}
                style={{
                  animation: isRetrying ? 'spin 1s linear infinite' : 'none',
                }}
              />
            }
            sx={{
              ml: { xs: 0, sm: 1 },
              py: 0.25,
              px: 1.25,
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: '6px',
              color: '#d97706',
              borderColor: 'rgba(245, 158, 11, 0.4)',
              '&:hover': {
                borderColor: '#d97706',
                background: 'rgba(245, 158, 11, 0.1)',
              },
            }}
            variant="outlined"
          >
            {isRetrying
              ? lang === 'en'
                ? 'Connecting...'
                : 'กำลังลองใหม่...'
              : lang === 'en'
              ? 'Retry'
              : 'ลองใหม่'}
          </Button>
        )}
      </Box>
    </Collapse>
  );
}

export default ServerStatusBanner;
