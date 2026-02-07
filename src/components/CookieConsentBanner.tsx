'use client';

import { useEffect, useState } from 'react';
import { X, Cookie, Shield, Check, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { Box, Typography, Button, IconButton, Collapse, Switch, Slide } from '@mui/material';
import { useNotification, COOKIE_CATEGORIES, CookieCategory } from './NotificationContext';
import Link from 'next/link';

export default function CookieConsentBanner() {
  const { showConsentBanner, acceptAll, acceptEssential, updateConsent } = useNotification();
  const [showDetails, setShowDetails] = useState(false);
  const [customConsent, setCustomConsent] = useState({
    essential: true,
    functional: true,
    analytics: false,
    marketing: false,
  });

  if (!showConsentBanner) return null;

  const handleSaveCustom = () => {
    updateConsent(customConsent);
  };

  const toggleCategory = (category: CookieCategory) => {
    if (category === 'essential') return; // Cannot disable essential
    setCustomConsent((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  return (
    <Slide direction="up" in={showConsentBanner} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          p: { xs: 2, sm: 3 },
          pb: { xs: 'max(16px, env(safe-area-inset-bottom))', sm: 3 },
        }}
      >
        <Box
          sx={{
            maxWidth: 520,
            mx: 'auto',
            borderRadius: '24px',
            bgcolor: 'var(--glass-strong)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.4), 0 4px 20px rgba(0,113,227, 0.1)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 2.5,
              pb: 2,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #0077ED 0%, #0071e3 100%)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 16px rgba(0,113,227, 0.3)',
              }}
            >
              <Cookie size={24} color="white" />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography
                sx={{
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: 'var(--foreground)',
                  mb: 0.5,
                }}
              >
                เราใช้คุกกี้
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                }}
              >
                เพื่อมอบประสบการณ์ที่ดีที่สุดในการใช้งาน เราจะเก็บข้อมูลการใช้งานและตะกร้าสินค้าของคุณ
              </Typography>
            </Box>
          </Box>

          {/* Expand/Collapse Details */}
          <Box sx={{ px: 2.5, pb: 2 }}>
            <Button
              fullWidth
              onClick={() => setShowDetails(!showDetails)}
              endIcon={showDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              startIcon={<Settings2 size={16} />}
              sx={{
                py: 1,
                borderRadius: '12px',
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-muted)',
                textTransform: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.08)',
                },
              }}
            >
              ตั้งค่าคุกกี้
            </Button>
          </Box>

          {/* Cookie Settings */}
          <Collapse in={showDetails}>
            <Box
              sx={{
                px: 2.5,
                pb: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              {(Object.keys(COOKIE_CATEGORIES) as CookieCategory[]).map((category) => {
                const info = COOKIE_CATEGORIES[category];
                const isEnabled = customConsent[category];
                const isRequired = info.required;

                return (
                  <Box
                    key={category}
                    sx={{
                      p: 2,
                      borderRadius: '14px',
                      bgcolor: isEnabled ? 'rgba(0,113,227, 0.1)' : 'rgba(29,29,31, 0.5)',
                      border: `1px solid ${isEnabled ? 'rgba(0,113,227, 0.3)' : 'rgba(255, 255, 255, 0.05)'}`,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography
                            sx={{
                              fontSize: '0.9rem',
                              fontWeight: 700,
                              color: 'var(--foreground)',
                            }}
                          >
                            {info.name}
                          </Typography>
                          {isRequired && (
                            <Box
                              sx={{
                                px: 1,
                                py: 0.2,
                                borderRadius: '6px',
                                bgcolor: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                              }}
                            >
                              <Typography
                                sx={{
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  color: '#30d158',
                                }}
                              >
                                จำเป็น
                              </Typography>
                            </Box>
                          )}
                        </Box>
                        <Typography
                          sx={{
                            fontSize: '0.75rem',
                            color: '#86868b',
                            lineHeight: 1.4,
                          }}
                        >
                          {info.description}
                        </Typography>
                      </Box>
                      <Switch
                        checked={isEnabled}
                        disabled={isRequired}
                        onChange={() => toggleCategory(category)}
                        sx={{
                          '& .MuiSwitch-switchBase': {
                            '&.Mui-checked': {
                              color: '#0077ED',
                              '& + .MuiSwitch-track': {
                                bgcolor: 'rgba(0,113,227, 0.5)',
                              },
                            },
                            '&.Mui-disabled': {
                              color: '#34c759',
                              '& + .MuiSwitch-track': {
                                bgcolor: 'rgba(16, 185, 129, 0.5)',
                                opacity: 1,
                              },
                            },
                          },
                          '& .MuiSwitch-track': {
                            bgcolor: 'rgba(255, 255, 255, 0.1)',
                          },
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Collapse>

          {/* Action Buttons */}
          <Box
            sx={{
              p: 2.5,
              pt: 0,
              display: 'flex',
              gap: 1.5,
              flexDirection: { xs: 'column', sm: 'row' },
            }}
          >
            {showDetails ? (
              <>
                <Button
                  fullWidth
                  onClick={acceptEssential}
                  sx={{
                    py: 1.5,
                    borderRadius: '14px',
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-muted)',
                    textTransform: 'none',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  เฉพาะที่จำเป็น
                </Button>
                <Button
                  fullWidth
                  onClick={handleSaveCustom}
                  startIcon={<Check size={18} />}
                  sx={{
                    py: 1.5,
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #0077ED 0%, #0071e3 100%)',
                    color: 'white',
                    textTransform: 'none',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 16px rgba(0,113,227, 0.3)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #bf5af2 0%, #1d4ed8 100%)',
                    },
                  }}
                >
                  บันทึกการตั้งค่า
                </Button>
              </>
            ) : (
              <>
                <Button
                  fullWidth
                  onClick={acceptEssential}
                  sx={{
                    py: 1.5,
                    borderRadius: '14px',
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-muted)',
                    textTransform: 'none',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  ปฏิเสธ
                </Button>
                <Button
                  fullWidth
                  onClick={acceptAll}
                  startIcon={<Check size={18} />}
                  sx={{
                    py: 1.5,
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #34c759 0%, #34c759 100%)',
                    color: 'white',
                    textTransform: 'none',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #34c759 0%, #047857 100%)',
                    },
                  }}
                >
                  ยอมรับทั้งหมด
                </Button>
              </>
            )}
          </Box>

          {/* Privacy Link */}
          <Box
            sx={{
              px: 2.5,
              pb: 2,
              pt: 0,
              textAlign: 'center',
            }}
          >
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: '#86868b',
              }}
            >
              อ่านเพิ่มเติม:{' '}
              <Link
                href="/privacy"
                style={{
                  color: '#bf5af2',
                  textDecoration: 'none',
                }}
              >
                นโยบายความเป็นส่วนตัว
              </Link>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Slide>
  );
}
