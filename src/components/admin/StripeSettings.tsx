'use client';

import { apiFetch } from '@/lib/api-client';
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  TextField,
  Button,
  IconButton,
  Chip,
  Stack,
  Alert,
  Divider,
  Tooltip,
  Collapse,
  InputAdornment,
  Skeleton,
  LinearProgress,
} from '@mui/material';
import {
  CreditCard,
  Save,
  ChevronDown as ExpandMore,
  ChevronUp as ExpandLess,
  Shield as Security,
  AlertTriangle as Warning,
  Info,
  CheckCircle2 as CheckCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  QrCode,
  Wifi,
  WifiOff,
  Zap,
  ArrowLeft,
  Globe,
  Mail,
  Receipt,
  Undo2,
  DollarSign,
  Clock,
  Eye,
  EyeOff,
  Link,
  FileText,
  Activity,
  Settings2,
} from 'lucide-react';
import {
  PaymentGatewayConfig,
  StripeSpecificConfig,
  PAYMENT_METHODS,
} from '@/lib/payment';
import {
  ADMIN_THEME,
  adminCardSx,
  adminInputSxCompact as inputSx,
} from '@/lib/adminTheme';

// ==================== TYPES ====================

interface StripeStatusData {
  hasSecretKey: boolean;
  hasPublishableKey: boolean;
  hasWebhookSecret: boolean;
  isTestMode: boolean;
  isLiveMode: boolean;
  maskedPublishableKey: string;
  maskedSecretKey: string;
  accountVerified: boolean;
  accountName: string;
  accountCountry: string;
  accountDefaultCurrency: string;
  accountEmail: string;
  capabilities: Record<string, string>;
  verifyError: string;
  balanceAvailable: { amount: number; currency: string }[];
  balancePending: { amount: number; currency: string }[];
  recentWebhookEvents: number;
  webhookUrl: string;
  supportedWebhookEvents: string[];
}

interface StripeSettingsProps {
  config?: PaymentGatewayConfig;
  onUpdate: (updates: Partial<PaymentGatewayConfig>) => void;
  onBack: () => void;
  onSave: () => void;
  saving?: boolean;
}

// ==================== CONSTANTS ====================

const STRIPE_BRAND_COLOR = '#635BFF';
const STRIPE_BRAND_GRADIENT = 'linear-gradient(135deg, #635BFF 0%, #8B5CF6 50%, #A855F7 100%)';

const DEFAULT_STRIPE_CONFIG: StripeSpecificConfig = {
  enablePromptPay: true,
  enableCreditCard: false,
  promptPayMinAmount: 10,
  promptPayMaxAmount: 0,
  statementDescriptor: '',
  enableAutoRefund: false,
  receiptEmailEnabled: true,
  currency: 'thb',
  promptPayExpirationMinutes: 15,
};

// ==================== SECTION CARD ====================

function SectionCard({
  icon,
  title,
  subtitle,
  children,
  defaultExpanded = true,
  accentColor,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  accentColor?: string;
  badge?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const color = accentColor || STRIPE_BRAND_COLOR;

  return (
    <Card sx={{
      ...adminCardSx,
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      '&:hover': { borderColor: `${color}33` },
    }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          cursor: 'pointer',
          borderBottom: expanded ? `1px solid ${ADMIN_THEME.border}` : 'none',
          background: expanded ? `linear-gradient(135deg, ${color}08 0%, transparent 100%)` : 'transparent',
          transition: 'all 0.2s',
          '&:hover': { background: `${color}0A` },
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{
          width: 36,
          height: 36,
          borderRadius: '10px',
          background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          flexShrink: 0,
        }}>
          {icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground)' }}>
              {title}
            </Typography>
            {badge}
          </Box>
          {subtitle && (
            <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <IconButton size="small" sx={{ color: 'var(--text-muted)' }}>
          {expanded ? <ExpandLess size={18} /> : <ExpandMore size={18} />}
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {children}
        </Box>
      </Collapse>
    </Card>
  );
}

// ==================== STATUS INDICATOR ====================

function StatusDot({ ok, label, tooltip }: { ok: boolean; label: string; tooltip?: string }) {
  return (
    <Tooltip title={tooltip || ''}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: ok ? '#22c55e' : '#ef4444',
          boxShadow: ok ? '0 0 8px rgba(34,197,94,0.5)' : '0 0 8px rgba(239,68,68,0.5)',
          animation: ok ? 'pulse 2s infinite' : 'none',
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.5 },
          },
        }} />
        <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</Typography>
      </Box>
    </Tooltip>
  );
}

// ==================== ENV VARIABLE ROW ====================

function EnvVarRow({ name, isSet, masked }: { name: string; isSet: boolean; masked?: string }) {
  const [showValue, setShowValue] = useState(false);
  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      py: 1,
      px: 1.5,
      borderRadius: '8px',
      bgcolor: isSet ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
      border: `1px solid ${isSet ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
    }}>
      <Box sx={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: isSet ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
        color: isSet ? '#22c55e' : '#ef4444',
        flexShrink: 0,
      }}>
        {isSet ? <CheckCircle size={12} /> : <Warning size={12} />}
      </Box>
      <Typography sx={{
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: '0.78rem',
        fontWeight: 600,
        color: 'var(--foreground)',
        flex: 1,
      }}>
        {name}
      </Typography>
      {masked && isSet && (
        <>
          <Typography sx={{
            fontFamily: 'monospace',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
          }}>
            {showValue ? masked : '••••••••'}
          </Typography>
          <IconButton size="small" onClick={() => setShowValue(!showValue)} sx={{ p: 0.25 }}>
            {showValue ? <EyeOff size={13} color="var(--text-muted)" /> : <Eye size={13} color="var(--text-muted)" />}
          </IconButton>
        </>
      )}
      {!isSet && (
        <Chip label="ยังไม่ตั้งค่า" size="small" color="error" variant="outlined"
          sx={{ fontSize: '0.65rem', height: 20 }} />
      )}
    </Box>
  );
}

// ==================== COPY BUTTON ====================

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={copied ? <CheckCircle size={14} /> : <Copy size={14} />}
      onClick={handleCopy}
      sx={{
        fontSize: '0.72rem',
        textTransform: 'none',
        borderColor: copied ? '#22c55e' : ADMIN_THEME.border,
        color: copied ? '#22c55e' : 'var(--text-muted)',
        '&:hover': { borderColor: STRIPE_BRAND_COLOR },
        transition: 'all 0.2s',
      }}
    >
      {copied ? 'คัดลอกแล้ว!' : (label || 'คัดลอก')}
    </Button>
  );
}

// ==================== WEBHOOK EVENT ROW ====================

function WebhookEventRow({ event, description }: { event: string; description: string }) {
  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      py: 0.75,
      px: 1.5,
      borderRadius: '6px',
      bgcolor: ADMIN_THEME.glassSoft,
    }}>
      <Zap size={13} color={STRIPE_BRAND_COLOR} />
      <Box sx={{ flex: 1 }}>
        <Typography sx={{
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--foreground)',
        }}>
          {event}
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {description}
        </Typography>
      </Box>
    </Box>
  );
}

// ==================== MAIN COMPONENT ====================

export default function StripeSettings({ config, onUpdate, onBack, onSave, saving }: StripeSettingsProps) {
  const [status, setStatus] = useState<StripeStatusData | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Initialize stripe-specific config
  const stripeConfig: StripeSpecificConfig = {
    ...DEFAULT_STRIPE_CONFIG,
    ...(config?.stripeConfig || {}),
  };

  const updateStripeConfig = (updates: Partial<StripeSpecificConfig>) => {
    onUpdate({
      stripeConfig: { ...stripeConfig, ...updates },
    });
  };

  // ==================== FETCH STATUS ====================

  const fetchStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      setStatusError(null);
      const res = await apiFetch('/api/admin/stripe-status');
      const data = await res.json();
      if (data.success) {
        setStatus(data.data);
      } else {
        setStatusError(data.error || 'Failed to fetch status');
      }
    } catch (err: any) {
      setStatusError(err?.message || 'Network error');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ==================== RENDER ====================

  const isConnected = status?.accountVerified ?? false;
  const isTestMode = config?.testMode ?? true;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton
          onClick={onBack}
          sx={{
            bgcolor: ADMIN_THEME.glassSoft,
            border: `1px solid ${ADMIN_THEME.border}`,
            '&:hover': { bgcolor: ADMIN_THEME.cardHover },
          }}
        >
          <ArrowLeft size={20} />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: STRIPE_BRAND_GRADIENT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <CreditCard size={22} color="#fff" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--foreground)' }}>
                Stripe Settings
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                การตั้งค่าการชำระเงินผ่าน Stripe อย่างละเอียด
              </Typography>
            </Box>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<Save size={16} />}
          onClick={onSave}
          disabled={saving}
          sx={{
            background: STRIPE_BRAND_GRADIENT,
            color: '#fff',
            borderRadius: '12px',
            fontWeight: 700,
            textTransform: 'none',
            px: 3,
            '&:hover': { boxShadow: `0 6px 20px ${STRIPE_BRAND_COLOR}55` },
          }}
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </Box>

      <Stack spacing={2.5}>
        {/* ======== SECTION 1: Connection Status ======== */}
        <SectionCard
          icon={<Wifi size={18} />}
          title="สถานะการเชื่อมต่อ"
          subtitle="ตรวจสอบการเชื่อมต่อกับ Stripe API"
          accentColor={isConnected ? '#22c55e' : '#ef4444'}
          badge={
            statusLoading ? (
              <Chip label="กำลังตรวจสอบ..." size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
            ) : isConnected ? (
              <Chip label="เชื่อมต่อแล้ว" size="small" color="success" sx={{ fontSize: '0.65rem', height: 20 }} />
            ) : (
              <Chip label="ยังไม่เชื่อมต่อ" size="small" color="error" sx={{ fontSize: '0.65rem', height: 20 }} />
            )
          }
        >
          {statusLoading ? (
            <Stack spacing={1.5}>
              <Skeleton variant="rounded" height={40} sx={{ borderRadius: '8px' }} />
              <Skeleton variant="rounded" height={40} sx={{ borderRadius: '8px' }} />
              <Skeleton variant="rounded" height={40} sx={{ borderRadius: '8px' }} />
            </Stack>
          ) : statusError ? (
            <Alert severity="error" sx={{ borderRadius: '10px' }}>{statusError}</Alert>
          ) : (
            <>
              {/* Account info */}
              {isConnected && status && (
                <Box sx={{
                  p: 2,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.04) 100%)',
                  border: '1px solid rgba(34,197,94,0.15)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <CheckCircle size={20} color="#22c55e" />
                    <Typography sx={{ fontWeight: 700, color: '#22c55e', fontSize: '0.95rem' }}>
                      Stripe เชื่อมต่อสำเร็จ
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5 }}>
                    {status.accountName && (
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mb: 0.25 }}>ชื่อบัญชี</Typography>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>{status.accountName}</Typography>
                      </Box>
                    )}
                    {status.accountEmail && (
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mb: 0.25 }}>อีเมล</Typography>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>{status.accountEmail}</Typography>
                      </Box>
                    )}
                    {status.accountCountry && (
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mb: 0.25 }}>ประเทศ</Typography>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>{status.accountCountry.toUpperCase()}</Typography>
                      </Box>
                    )}
                    {status.accountDefaultCurrency && (
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mb: 0.25 }}>สกุลเงิน</Typography>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>{status.accountDefaultCurrency.toUpperCase()}</Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Balance */}
                  {(status.balanceAvailable.length > 0 || status.balancePending.length > 0) && (
                    <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid rgba(34,197,94,0.15)' }}>
                      <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', mb: 1 }}>ยอดเงิน</Typography>
                      <Box sx={{ display: 'flex', gap: 3 }}>
                        {status.balanceAvailable.map((b, i) => (
                          <Box key={`avl-${i}`}>
                            <Typography sx={{ fontSize: '0.7rem', color: '#22c55e' }}>พร้อมใช้</Typography>
                            <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)' }}>
                              ฿{b.amount.toLocaleString()}
                            </Typography>
                          </Box>
                        ))}
                        {status.balancePending.map((b, i) => (
                          <Box key={`pnd-${i}`}>
                            <Typography sx={{ fontSize: '0.7rem', color: '#f59e0b' }}>รอดำเนินการ</Typography>
                            <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)' }}>
                              ฿{b.amount.toLocaleString()}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              {/* Error display */}
              {!isConnected && status?.verifyError && (
                <Alert severity="error" sx={{ borderRadius: '10px' }}>
                  <Typography variant="body2" fontWeight={600}>ไม่สามารถเชื่อมต่อ Stripe ได้</Typography>
                  <Typography variant="caption">{status.verifyError}</Typography>
                </Alert>
              )}

              {/* Status dots */}
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <StatusDot ok={status?.hasSecretKey ?? false} label="Secret Key" tooltip="STRIPE_SECRET_KEY" />
                <StatusDot ok={status?.hasPublishableKey ?? false} label="Publishable Key" tooltip="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" />
                <StatusDot ok={status?.hasWebhookSecret ?? false} label="Webhook Secret" tooltip="STRIPE_WEBHOOK_SECRET" />
              </Box>

              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshCw size={14} />}
                onClick={fetchStatus}
                sx={{
                  alignSelf: 'flex-start',
                  textTransform: 'none',
                  borderColor: ADMIN_THEME.border,
                  color: 'var(--text-muted)',
                  fontSize: '0.78rem',
                  '&:hover': { borderColor: STRIPE_BRAND_COLOR },
                }}
              >
                ตรวจสอบอีกครั้ง
              </Button>
            </>
          )}
        </SectionCard>

        {/* ======== SECTION 2: API Keys ======== */}
        <SectionCard
          icon={<Security size={18} />}
          title="API Keys"
          subtitle="Environment Variables สำหรับ Stripe"
          accentColor="#f59e0b"
          badge={
            <Chip
              label={isTestMode ? 'TEST MODE' : 'LIVE MODE'}
              size="small"
              color={isTestMode ? 'warning' : 'success'}
              sx={{ fontSize: '0.65rem', height: 20, fontWeight: 700 }}
            />
          }
        >
          <Alert severity="info" sx={{ borderRadius: '10px', bgcolor: `${STRIPE_BRAND_COLOR}0A`, border: `1px solid ${STRIPE_BRAND_COLOR}22` }}>
            <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
              Secret Keys ต้องเก็บใน <strong>Environment Variables</strong> เท่านั้น ห้ามเก็บในฐานข้อมูล
              สามารถดู Keys ได้ที่{' '}
              <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" style={{ color: STRIPE_BRAND_COLOR }}>
                Stripe Dashboard → API Keys
              </a>
            </Typography>
          </Alert>

          <Stack spacing={1}>
            <EnvVarRow name="STRIPE_SECRET_KEY" isSet={status?.hasSecretKey ?? false} masked={status?.maskedSecretKey} />
            <EnvVarRow name="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" isSet={status?.hasPublishableKey ?? false} masked={status?.maskedPublishableKey} />
            <EnvVarRow name="STRIPE_WEBHOOK_SECRET" isSet={status?.hasWebhookSecret ?? false} />
          </Stack>

          {/* Test/Live Mode Toggle */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1.5,
            borderRadius: '10px',
            bgcolor: isTestMode ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)',
            border: `1px solid ${isTestMode ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)'}`,
          }}>
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--foreground)' }}>
                โหมดทดสอบ (Test Mode)
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isTestMode ? 'กำลังใช้ Test Keys — ไม่มีการเรียกเก็บเงินจริง' : '⚠️ กำลังใช้ Live Keys — มีการเรียกเก็บเงินจริง'}
              </Typography>
            </Box>
            <Switch
              checked={isTestMode}
              onChange={(e) => onUpdate({ testMode: e.target.checked })}
              color="warning"
            />
          </Box>

          {/* Public Key in DB */}
          <TextField
            label="Publishable Key (เก็บในฐานข้อมูลเพื่อใช้ฝั่ง Client)"
            value={config?.publicKey || ''}
            onChange={(e) => onUpdate({ publicKey: e.target.value })}
            fullWidth
            size="small"
            sx={inputSx}
            placeholder={isTestMode ? 'pk_test_...' : 'pk_live_...'}
            helperText="Public Key สามารถเก็บในฐานข้อมูลได้อย่างปลอดภัย เพราะเปิดเผยได้"
          />
        </SectionCard>

        {/* ======== SECTION 3: Payment Methods ======== */}
        <SectionCard
          icon={<CreditCard size={18} />}
          title="วิธีการชำระเงิน"
          subtitle="เลือกวิธีการชำระเงินที่ต้องการเปิดใช้งาน"
          accentColor={STRIPE_BRAND_COLOR}
        >
          {/* PromptPay */}
          <Box sx={{
            p: 2,
            borderRadius: '12px',
            bgcolor: stripeConfig.enablePromptPay ? `${STRIPE_BRAND_COLOR}0A` : ADMIN_THEME.glassSoft,
            border: `1px solid ${stripeConfig.enablePromptPay ? `${STRIPE_BRAND_COLOR}22` : ADMIN_THEME.border}`,
            transition: 'all 0.3s',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                background: stripeConfig.enablePromptPay ? 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)' : ADMIN_THEME.glassSoft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s',
              }}>
                <QrCode size={22} color={stripeConfig.enablePromptPay ? '#fff' : 'var(--text-muted)'} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground)' }}>
                  PromptPay (พร้อมเพย์)
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  QR Code อัตโนมัติ — ยืนยันการชำระเงินทันที ไม่ต้องแนบสลิป
                </Typography>
              </Box>
              <Switch
                checked={stripeConfig.enablePromptPay}
                onChange={(e) => updateStripeConfig({ enablePromptPay: e.target.checked })}
                color="primary"
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: STRIPE_BRAND_COLOR },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: `${STRIPE_BRAND_COLOR}88` },
                }}
              />
            </Box>
            {stripeConfig.enablePromptPay && (
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1.5 }}>
                <Chip label="ค่าธรรมเนียม: ฟรี" size="small" sx={{ bgcolor: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '0.72rem' }} />
                <Chip label="ยืนยันอัตโนมัติ" size="small" sx={{ bgcolor: `${STRIPE_BRAND_COLOR}15`, color: STRIPE_BRAND_COLOR, fontSize: '0.72rem' }} />
                <Chip label="Real-time" size="small" sx={{ bgcolor: 'rgba(6,182,212,0.1)', color: '#06b6d4', fontSize: '0.72rem' }} />
              </Box>
            )}
          </Box>

          {/* Credit Card */}
          <Box sx={{
            p: 2,
            borderRadius: '12px',
            bgcolor: stripeConfig.enableCreditCard ? `${STRIPE_BRAND_COLOR}0A` : ADMIN_THEME.glassSoft,
            border: `1px solid ${stripeConfig.enableCreditCard ? `${STRIPE_BRAND_COLOR}22` : ADMIN_THEME.border}`,
            transition: 'all 0.3s',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                background: stripeConfig.enableCreditCard ? 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)' : ADMIN_THEME.glassSoft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s',
              }}>
                <CreditCard size={22} color={stripeConfig.enableCreditCard ? '#fff' : 'var(--text-muted)'} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground)' }}>
                  บัตรเครดิต/เดบิต
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  รองรับ Visa, Mastercard, JCB, American Express
                </Typography>
              </Box>
              <Switch
                checked={stripeConfig.enableCreditCard}
                onChange={(e) => updateStripeConfig({ enableCreditCard: e.target.checked })}
                color="primary"
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: STRIPE_BRAND_COLOR },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: `${STRIPE_BRAND_COLOR}88` },
                }}
              />
            </Box>
            {stripeConfig.enableCreditCard && (
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1.5 }}>
                <Chip label="ค่าธรรมเนียม: 3.65%" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: '0.72rem' }} />
                <Chip label="3D Secure" size="small" sx={{ bgcolor: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '0.72rem' }} />
                <Chip label="Visa, MC, JCB, Amex" size="small" sx={{ bgcolor: `${STRIPE_BRAND_COLOR}15`, color: STRIPE_BRAND_COLOR, fontSize: '0.72rem' }} />
              </Box>
            )}
          </Box>
        </SectionCard>

        {/* ======== SECTION 4: PromptPay Settings ======== */}
        {stripeConfig.enablePromptPay && (
          <SectionCard
            icon={<QrCode size={18} />}
            title="ตั้งค่า PromptPay"
            subtitle="กำหนดรายละเอียดสำหรับ PromptPay QR Code"
            accentColor="#2563eb"
            defaultExpanded={true}
          >
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="ยอดขั้นต่ำ (บาท)"
                type="number"
                value={stripeConfig.promptPayMinAmount}
                onChange={(e) => updateStripeConfig({ promptPayMinAmount: Number(e.target.value) || 10 })}
                sx={{ ...inputSx, flex: '1 1 200px' }}
                size="small"
                InputProps={{
                  endAdornment: <InputAdornment position="end">฿</InputAdornment>,
                }}
                helperText="Stripe กำหนดขั้นต่ำ 10 บาท"
              />
              <TextField
                label="ยอดสูงสุด (บาท)"
                type="number"
                value={stripeConfig.promptPayMaxAmount || ''}
                onChange={(e) => updateStripeConfig({ promptPayMaxAmount: Number(e.target.value) || 0 })}
                sx={{ ...inputSx, flex: '1 1 200px' }}
                size="small"
                InputProps={{
                  endAdornment: <InputAdornment position="end">฿</InputAdornment>,
                }}
                helperText="0 = ไม่จำกัด"
              />
            </Box>

            <TextField
              label="เวลาหมดอายุ QR Code (นาที)"
              type="number"
              value={stripeConfig.promptPayExpirationMinutes || 15}
              onChange={(e) => updateStripeConfig({ promptPayExpirationMinutes: Number(e.target.value) || 15 })}
              fullWidth
              sx={inputSx}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Clock size={16} />
                  </InputAdornment>
                ),
                endAdornment: <InputAdornment position="end">นาที</InputAdornment>,
              }}
              helperText="ระยะเวลาก่อน QR Code หมดอายุ (ค่าเริ่มต้น: 15 นาที)"
            />

            <Alert severity="info" sx={{ borderRadius: '10px', bgcolor: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)' }}>
              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                💡 เมื่อลูกค้าชำระเงินผ่าน PromptPay QR Code ระบบจะยืนยันการชำระเงินอัตโนมัติทันที
                ไม่ต้องอัปโหลดสลิป และไม่มีค่าธรรมเนียมเพิ่มเติม
              </Typography>
            </Alert>
          </SectionCard>
        )}

        {/* ======== SECTION 5: Webhook ======== */}
        <SectionCard
          icon={<Zap size={18} />}
          title="Webhook"
          subtitle="การรับแจ้งเตือนจาก Stripe"
          accentColor="#06b6d4"
          badge={
            status?.recentWebhookEvents ? (
              <Chip
                label={`${status.recentWebhookEvents >= 100 ? '100+' : status.recentWebhookEvents} events (24h)`}
                size="small"
                color="info"
                sx={{ fontSize: '0.65rem', height: 20 }}
              />
            ) : null
          }
        >
          {/* Webhook URL */}
          <Box sx={{
            p: 1.5,
            borderRadius: '10px',
            bgcolor: ADMIN_THEME.glassSoft,
            border: `1px solid ${ADMIN_THEME.border}`,
          }}>
            <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', mb: 0.75 }}>
              Webhook Endpoint URL — คัดลอกไปตั้งค่าใน Stripe Dashboard
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{
                flex: 1,
                p: 1,
                borderRadius: '6px',
                bgcolor: 'var(--surface)',
                border: `1px solid ${ADMIN_THEME.border}`,
                overflow: 'auto',
              }}>
                <Typography sx={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.78rem',
                  color: 'var(--foreground)',
                  wordBreak: 'break-all',
                }}>
                  {status?.webhookUrl || '/api/payment/webhook/stripe'}
                </Typography>
              </Box>
              <CopyButton text={status?.webhookUrl || `${typeof window !== 'undefined' ? window.location.origin : ''}/api/payment/webhook/stripe`} />
            </Box>
          </Box>

          {/* Supported Events */}
          <Box>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', mb: 1 }}>
              Events ที่รองรับ
            </Typography>
            <Stack spacing={0.75}>
              <WebhookEventRow event="payment_intent.succeeded" description="ชำระเงินสำเร็จ → อัปเดตสถานะ order เป็น PAID" />
              <WebhookEventRow event="payment_intent.payment_failed" description="ชำระเงินล้มเหลว → บันทึก error" />
              <WebhookEventRow event="payment_intent.canceled" description="ยกเลิก PaymentIntent → อัปเดตสถานะ" />
              <WebhookEventRow event="charge.refunded" description="คืนเงิน → อัปเดตสถานะ order เป็น REFUNDED" />
            </Stack>
          </Box>

          <Alert severity="warning" sx={{ borderRadius: '10px', bgcolor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
              ⚠️ ต้องเพิ่ม events ข้างต้นทั้ง 4 รายการใน Stripe Dashboard → Webhooks เพื่อให้ระบบทำงานได้สมบูรณ์
            </Typography>
          </Alert>
        </SectionCard>

        {/* ======== SECTION 6: Refund Settings ======== */}
        <SectionCard
          icon={<Undo2 size={18} />}
          title="การคืนเงิน"
          subtitle="ตั้งค่าการคืนเงินผ่าน Stripe"
          accentColor="#8b5cf6"
          defaultExpanded={false}
        >
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1.5,
            borderRadius: '10px',
            bgcolor: ADMIN_THEME.glassSoft,
          }}>
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--foreground)' }}>
                เปิดใช้การคืนเงินอัตโนมัติ
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                เมื่ออนุมัติคำขอคืนเงิน ระบบจะคืนเงินผ่าน Stripe โดยอัตโนมัติ
              </Typography>
            </Box>
            <Switch
              checked={stripeConfig.enableAutoRefund}
              onChange={(e) => updateStripeConfig({ enableAutoRefund: e.target.checked })}
              color="secondary"
            />
          </Box>

          <Alert severity="info" sx={{ borderRadius: '10px' }}>
            <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
              การคืนเงินจะใช้เวลา 5-10 วันทำการ ขึ้นอยู่กับธนาคารของลูกค้า
              สำหรับ PromptPay จะคืนเงินเข้าบัญชีเดิมที่ชำระมา
            </Typography>
          </Alert>
        </SectionCard>

        {/* ======== SECTION 7: Receipt & Invoice ======== */}
        <SectionCard
          icon={<Receipt size={18} />}
          title="ใบเสร็จ & ใบแจ้งหนี้"
          subtitle="ตั้งค่าใบเสร็จรับเงินจาก Stripe"
          accentColor="#10b981"
          defaultExpanded={false}
        >
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1.5,
            borderRadius: '10px',
            bgcolor: ADMIN_THEME.glassSoft,
          }}>
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--foreground)' }}>
                ส่งใบเสร็จทางอีเมล
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Stripe จะส่งใบเสร็จอิเล็กทรอนิกส์ไปยังอีเมลลูกค้าโดยอัตโนมัติ
              </Typography>
            </Box>
            <Switch
              checked={stripeConfig.receiptEmailEnabled}
              onChange={(e) => updateStripeConfig({ receiptEmailEnabled: e.target.checked })}
              color="success"
            />
          </Box>

          <TextField
            label="Statement Descriptor"
            value={stripeConfig.statementDescriptor || ''}
            onChange={(e) => {
              const val = e.target.value.slice(0, 22);
              updateStripeConfig({ statementDescriptor: val });
            }}
            fullWidth
            size="small"
            sx={inputSx}
            placeholder="SCC SHOP"
            helperText={`ชื่อที่จะแสดงในรายการเดินบัญชีของลูกค้า (สูงสุด 22 ตัวอักษร) — ${(stripeConfig.statementDescriptor || '').length}/22`}
            inputProps={{ maxLength: 22 }}
          />

          <Box sx={{
            p: 1.5,
            borderRadius: '10px',
            bgcolor: ADMIN_THEME.glassSoft,
          }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', mb: 0.5 }}>
              รูปแบบ URL ใบเสร็จ
            </Typography>
            <Typography sx={{
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              color: 'var(--foreground)',
            }}>
              https://pay.stripe.com/receipts/...
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mt: 0.5 }}>
              ใบเสร็จจาก Stripe จะถูกบันทึกอัตโนมัติในระบบเมื่อชำระเงินสำเร็จ
            </Typography>
          </Box>
        </SectionCard>

        {/* ======== SECTION 8: Quick Links ======== */}
        <SectionCard
          icon={<ExternalLink size={18} />}
          title="ลิงก์ด่วน"
          subtitle="ลิงก์ไปยัง Stripe Dashboard และเอกสาร"
          accentColor="#64748b"
          defaultExpanded={false}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1.5 }}>
            {[
              { icon: <Activity size={16} />, label: 'Stripe Dashboard', url: 'https://dashboard.stripe.com', desc: 'จัดการทุกอย่าง' },
              { icon: <DollarSign size={16} />, label: 'Payments', url: 'https://dashboard.stripe.com/payments', desc: 'ดูรายการชำระเงิน' },
              { icon: <Security size={16} />, label: 'API Keys', url: 'https://dashboard.stripe.com/apikeys', desc: 'จัดการ API Keys' },
              { icon: <Zap size={16} />, label: 'Webhooks', url: 'https://dashboard.stripe.com/webhooks', desc: 'จัดการ Webhooks' },
              { icon: <FileText size={16} />, label: 'API Docs', url: 'https://stripe.com/docs/api', desc: 'เอกสาร API' },
              { icon: <Settings2 size={16} />, label: 'Test Mode', url: 'https://dashboard.stripe.com/test/payments', desc: 'ดูข้อมูลทดสอบ' },
            ].map((link) => (
              <Button
                key={link.label}
                variant="outlined"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 0.5,
                  p: 1.5,
                  borderRadius: '10px',
                  textTransform: 'none',
                  borderColor: ADMIN_THEME.border,
                  color: 'var(--foreground)',
                  '&:hover': {
                    borderColor: STRIPE_BRAND_COLOR,
                    bgcolor: `${STRIPE_BRAND_COLOR}08`,
                  },
                  transition: 'all 0.2s',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color: STRIPE_BRAND_COLOR }}>{link.icon}</Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{link.label}</Typography>
                  <ExternalLink size={12} color="var(--text-muted)" />
                </Box>
                <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{link.desc}</Typography>
              </Button>
            ))}
          </Box>
        </SectionCard>
      </Stack>
    </Box>
  );
}
