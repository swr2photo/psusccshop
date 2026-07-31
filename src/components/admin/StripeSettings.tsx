'use client';

import { apiFetch } from '@/lib/api-client';
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CreditCard,
  Save,
  ChevronDown as ExpandMore,
  ChevronUp as ExpandLess,
  Shield as Security,
  AlertTriangle as Warning,
  CheckCircle2 as CheckCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  QrCode,
  Wifi,
  Zap,
  ArrowLeft,
  Receipt,
  Undo2,
  DollarSign,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Activity,
  Settings2,
  Loader2,
  Info,
} from 'lucide-react';
import {
  PaymentGatewayConfig,
  StripeSpecificConfig,
} from '@/lib/payment';
import { cn } from '@/lib/utils';

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

const adminCardClass =
  'gap-0 overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] py-0 text-[var(--foreground)] shadow-none transition-all duration-300';

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
    <Card
      className={cn(adminCardClass, 'hover:border-[color-mix(in_srgb,var(--section-accent)_20%,var(--glass-border))]')}
      style={{ ['--section-accent' as string]: color }}
    >
      <div
        className={cn(
          'flex cursor-pointer items-center gap-4 p-4 transition-all duration-200',
          expanded && 'border-b border-[var(--glass-border)]',
        )}
        style={{
          background: expanded
            ? `linear-gradient(135deg, ${color}08 0%, transparent 100%)`
            : 'transparent',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `${color}0A`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = expanded
            ? `linear-gradient(135deg, ${color}08 0%, transparent 100%)`
            : 'transparent';
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-white"
          style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)` }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[0.95rem] font-bold text-[var(--foreground)]">{title}</span>
            {badge}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{subtitle}</p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-[var(--text-muted)]"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? <ExpandLess size={18} /> : <ExpandMore size={18} />}
        </Button>
      </div>
      {expanded && (
        <CardContent className="flex flex-col gap-4 p-5">{children}</CardContent>
      )}
    </Card>
  );
}

// ==================== STATUS INDICATOR ====================

function StatusDot({ ok, label, tooltip }: { ok: boolean; label: string; tooltip?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex cursor-default items-center gap-2">
          <span
            className={cn(
              'size-2 rounded-full',
              ok
                ? 'animate-pulse bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
            )}
          />
          <span className="text-[0.8rem] text-[var(--text-muted)]">{label}</span>
        </div>
      </TooltipTrigger>
      {tooltip ? <TooltipContent>{tooltip}</TooltipContent> : null}
    </Tooltip>
  );
}

// ==================== ENV VARIABLE ROW ====================

function EnvVarRow({ name, isSet, masked }: { name: string; isSet: boolean; masked?: string }) {
  const [showValue, setShowValue] = useState(false);

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2',
        isSet
          ? 'border border-green-500/15 bg-green-500/[0.06]'
          : 'border border-red-500/15 bg-red-500/[0.06]',
      )}
    >
      <div
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full',
          isSet ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500',
        )}
      >
        {isSet ? <CheckCircle size={12} /> : <Warning size={12} />}
      </div>
      <span className="flex-1 font-mono text-[0.78rem] font-semibold text-[var(--foreground)]">
        {name}
      </span>
      {masked && isSet && (
        <>
          <span className="font-mono text-[0.72rem] text-[var(--text-muted)]">
            {showValue ? masked : '••••••••'}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6"
            onClick={() => setShowValue(!showValue)}
          >
            {showValue ? (
              <EyeOff size={13} className="text-[var(--text-muted)]" />
            ) : (
              <Eye size={13} className="text-[var(--text-muted)]" />
            )}
          </Button>
        </>
      )}
      {!isSet && (
        <Badge variant="destructive" className="h-5 border text-[0.65rem]">
          ยังไม่ตั้งค่า
        </Badge>
      )}
    </div>
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
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn(
        'text-[0.72rem] transition-all duration-200',
        copied
          ? 'border-green-500 text-green-500'
          : 'border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[#635BFF]',
      )}
    >
      {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
      {copied ? 'คัดลอกแล้ว!' : (label || 'คัดลอก')}
    </Button>
  );
}

// ==================== WEBHOOK EVENT ROW ====================

function WebhookEventRow({ event, description }: { event: string; description: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-[var(--surface-2)] px-3 py-1.5">
      <Zap size={13} color={STRIPE_BRAND_COLOR} />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs font-semibold text-[var(--foreground)]">{event}</p>
        <p className="text-[0.7rem] text-[var(--text-muted)]">{description}</p>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export default function StripeSettings({ config, onUpdate, onBack, onSave, saving }: StripeSettingsProps) {
  const [status, setStatus] = useState<StripeStatusData | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const stripeConfig: StripeSpecificConfig = {
    ...DEFAULT_STRIPE_CONFIG,
    ...(config?.stripeConfig || {}),
  };

  const updateStripeConfig = (updates: Partial<StripeSpecificConfig>) => {
    onUpdate({
      stripeConfig: { ...stripeConfig, ...updates },
    });
  };

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
    } catch (err: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
      const message = err instanceof Error ? err.message : 'Network error';
      setStatusError(message);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const isConnected = status?.accountVerified ?? false;
  const isTestMode = config?.testMode ?? true;

  return (
    <TooltipProvider>
      <div>
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onBack}
            className="border-[var(--glass-border)] bg-[var(--surface-2)] hover:bg-[var(--surface-2)]"
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <div
                className="flex size-10 items-center justify-center rounded-xl"
                style={{ background: STRIPE_BRAND_GRADIENT }}
              >
                <CreditCard size={22} color="#fff" />
              </div>
              <div>
                <h2 className="text-[1.2rem] font-extrabold text-[var(--foreground)]">
                  Stripe Settings
                </h2>
                <p className="text-[0.78rem] text-[var(--text-muted)]">
                  การตั้งค่าการชำระเงินผ่าน Stripe อย่างละเอียด
                </p>
              </div>
            </div>
          </div>
          <Button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-xl px-6 font-bold text-white hover:shadow-[0_6px_20px_rgba(99,91,255,0.33)]"
            style={{ background: STRIPE_BRAND_GRADIENT }}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save size={16} />
                บันทึก
              </>
            )}
          </Button>
        </div>

        <div className="flex flex-col gap-5">
          {/* ======== SECTION 1: Connection Status ======== */}
          <SectionCard
            icon={<Wifi size={18} />}
            title="สถานะการเชื่อมต่อ"
            subtitle="ตรวจสอบการเชื่อมต่อกับ Stripe API"
            accentColor={isConnected ? '#22c55e' : '#ef4444'}
            badge={
              statusLoading ? (
                <Badge variant="secondary" className="h-5 text-[0.65rem]">
                  กำลังตรวจสอบ...
                </Badge>
              ) : isConnected ? (
                <Badge className="h-5 border-0 bg-green-500 text-[0.65rem] text-white">
                  เชื่อมต่อแล้ว
                </Badge>
              ) : (
                <Badge variant="destructive" className="h-5 text-[0.65rem]">
                  ยังไม่เชื่อมต่อ
                </Badge>
              )
            }
          >
            {statusLoading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
              </div>
            ) : statusError ? (
              <Alert variant="destructive" className="rounded-[10px]">
                <Warning className="size-4" />
                <AlertDescription>{statusError}</AlertDescription>
              </Alert>
            ) : (
              <>
                {isConnected && status && (
                  <div className="rounded-xl border border-green-500/15 bg-gradient-to-br from-green-500/[0.08] to-emerald-500/[0.04] p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <CheckCircle size={20} color="#22c55e" />
                      <span className="text-[0.95rem] font-bold text-green-500">
                        Stripe เชื่อมต่อสำเร็จ
                      </span>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                      {status.accountName && (
                        <div>
                          <p className="mb-0.5 text-[0.7rem] text-[var(--text-muted)]">ชื่อบัญชี</p>
                          <p className="text-[0.85rem] font-semibold text-[var(--foreground)]">
                            {status.accountName}
                          </p>
                        </div>
                      )}
                      {status.accountEmail && (
                        <div>
                          <p className="mb-0.5 text-[0.7rem] text-[var(--text-muted)]">อีเมล</p>
                          <p className="text-[0.85rem] font-semibold text-[var(--foreground)]">
                            {status.accountEmail}
                          </p>
                        </div>
                      )}
                      {status.accountCountry && (
                        <div>
                          <p className="mb-0.5 text-[0.7rem] text-[var(--text-muted)]">ประเทศ</p>
                          <p className="text-[0.85rem] font-semibold text-[var(--foreground)]">
                            {status.accountCountry.toUpperCase()}
                          </p>
                        </div>
                      )}
                      {status.accountDefaultCurrency && (
                        <div>
                          <p className="mb-0.5 text-[0.7rem] text-[var(--text-muted)]">สกุลเงิน</p>
                          <p className="text-[0.85rem] font-semibold text-[var(--foreground)]">
                            {status.accountDefaultCurrency.toUpperCase()}
                          </p>
                        </div>
                      )}
                    </div>

                    {(status.balanceAvailable.length > 0 || status.balancePending.length > 0) && (
                      <div className="mt-4 border-t border-green-500/15 pt-3">
                        <p className="mb-2 text-[0.72rem] text-[var(--text-muted)]">ยอดเงิน</p>
                        <div className="flex gap-6">
                          {status.balanceAvailable.map((b, i) => (
                            <div key={`avl-${i}`}>
                              <p className="text-[0.7rem] text-green-500">พร้อมใช้</p>
                              <p className="text-base font-bold text-[var(--foreground)]">
                                ฿{b.amount?.toLocaleString()}
                              </p>
                            </div>
                          ))}
                          {status.balancePending.map((b, i) => (
                            <div key={`pnd-${i}`}>
                              <p className="text-[0.7rem] text-amber-500">รอดำเนินการ</p>
                              <p className="text-base font-bold text-[var(--foreground)]">
                                ฿{b.amount?.toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!isConnected && status?.verifyError && (
                  <Alert variant="destructive" className="rounded-[10px]">
                    <Warning className="size-4" />
                    <AlertTitle>ไม่สามารถเชื่อมต่อ Stripe ได้</AlertTitle>
                    <AlertDescription>{status.verifyError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-wrap gap-6">
                  <StatusDot ok={status?.hasSecretKey ?? false} label="Secret Key" tooltip="STRIPE_SECRET_KEY" />
                  <StatusDot ok={status?.hasPublishableKey ?? false} label="Publishable Key" tooltip="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" />
                  <StatusDot ok={status?.hasWebhookSecret ?? false} label="Webhook Secret" tooltip="STRIPE_WEBHOOK_SECRET" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchStatus}
                  className="self-start border-[var(--glass-border)] text-[0.78rem] text-[var(--text-muted)] hover:border-[#635BFF]"
                >
                  <RefreshCw size={14} />
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
              <Badge
                className={cn(
                  'h-5 text-[0.65rem] font-bold',
                  isTestMode
                    ? 'border-0 bg-amber-500 text-white'
                    : 'border-0 bg-green-500 text-white',
                )}
              >
                {isTestMode ? 'TEST MODE' : 'LIVE MODE'}
              </Badge>
            }
          >
            <Alert
              className="rounded-[10px] border border-[#635BFF]/13 bg-[#635BFF]/[0.04]"
            >
              <Info className="size-4 text-[#635BFF]" />
              <AlertDescription className="text-[0.8rem] text-[var(--foreground)]">
                Secret Keys ต้องเก็บใน <strong>Environment Variables</strong> เท่านั้น ห้ามเก็บในฐานข้อมูล
                สามารถดู Keys ได้ที่{' '}
                <a
                  href="https://dashboard.stripe.com/apikeys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#635BFF] underline-offset-2 hover:underline"
                >
                  Stripe Dashboard → API Keys
                </a>
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-2">
              <EnvVarRow name="STRIPE_SECRET_KEY" isSet={status?.hasSecretKey ?? false} masked={status?.maskedSecretKey} />
              <EnvVarRow name="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" isSet={status?.hasPublishableKey ?? false} masked={status?.maskedPublishableKey} />
              <EnvVarRow name="STRIPE_WEBHOOK_SECRET" isSet={status?.hasWebhookSecret ?? false} />
            </div>

            <div
              className={cn(
                'flex items-center justify-between rounded-[10px] p-3',
                isTestMode
                  ? 'border border-amber-500/15 bg-amber-500/[0.06]'
                  : 'border border-green-500/15 bg-green-500/[0.06]',
              )}
            >
              <div>
                <p className="text-[0.88rem] font-semibold text-[var(--foreground)]">
                  โหมดทดสอบ (Test Mode)
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {isTestMode
                    ? 'กำลังใช้ Test Keys — ไม่มีการเรียกเก็บเงินจริง'
                    : '⚠️ กำลังใช้ Live Keys — มีการเรียกเก็บเงินจริง'}
                </p>
              </div>
              <Switch
                checked={isTestMode}
                onCheckedChange={(checked) => onUpdate({ testMode: checked })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stripe-public-key">
                Publishable Key (เก็บในฐานข้อมูลเพื่อใช้ฝั่ง Client)
              </Label>
              <Input
                id="stripe-public-key"
                value={config?.publicKey || ''}
                onChange={(e) => onUpdate({ publicKey: e.target.value })}
                placeholder={isTestMode ? 'pk_test_...' : 'pk_live_...'}
              />
              <p className="text-xs text-[var(--text-muted)]">
                Public Key สามารถเก็บในฐานข้อมูลได้อย่างปลอดภัย เพราะเปิดเผยได้
              </p>
            </div>
          </SectionCard>

          {/* ======== SECTION 3: Payment Methods ======== */}
          <SectionCard
            icon={<CreditCard size={18} />}
            title="วิธีการชำระเงิน"
            subtitle="เลือกวิธีการชำระเงินที่ต้องการเปิดใช้งาน"
            accentColor={STRIPE_BRAND_COLOR}
          >
            <div
              className={cn(
                'rounded-xl border p-4 transition-all duration-300',
                stripeConfig.enablePromptPay
                  ? 'border-[#635BFF]/13 bg-[#635BFF]/[0.04]'
                  : 'border-[var(--glass-border)] bg-[var(--surface-2)]',
              )}
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'flex size-11 items-center justify-center rounded-xl transition-all duration-300',
                    stripeConfig.enablePromptPay
                      ? 'bg-gradient-to-br from-blue-600 to-blue-500'
                      : 'bg-[var(--surface-2)]',
                  )}
                >
                  <QrCode
                    size={22}
                    color={stripeConfig.enablePromptPay ? '#fff' : 'var(--text-muted)'}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.95rem] font-bold text-[var(--foreground)]">
                    PromptPay (พร้อมเพย์)
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    QR Code อัตโนมัติ — ยืนยันการชำระเงินทันที ไม่ต้องแนบสลิป
                  </p>
                </div>
                <Switch
                  checked={stripeConfig.enablePromptPay}
                  onCheckedChange={(checked) => updateStripeConfig({ enablePromptPay: checked })}
                  className="data-[state=checked]:bg-[#635BFF]/55"
                />
              </div>
              {stripeConfig.enablePromptPay && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className="border-0 bg-green-500/10 text-[0.72rem] text-green-500">
                    ค่าธรรมเนียม: ฟรี
                  </Badge>
                  <Badge className="border-0 bg-[#635BFF]/15 text-[0.72rem] text-[#635BFF]">
                    ยืนยันอัตโนมัติ
                  </Badge>
                  <Badge className="border-0 bg-cyan-500/10 text-[0.72rem] text-cyan-500">
                    Real-time
                  </Badge>
                </div>
              )}
            </div>

            <div
              className={cn(
                'rounded-xl border p-4 transition-all duration-300',
                stripeConfig.enableCreditCard
                  ? 'border-[#635BFF]/13 bg-[#635BFF]/[0.04]'
                  : 'border-[var(--glass-border)] bg-[var(--surface-2)]',
              )}
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'flex size-11 items-center justify-center rounded-xl transition-all duration-300',
                    stripeConfig.enableCreditCard
                      ? 'bg-gradient-to-br from-violet-500 to-purple-500'
                      : 'bg-[var(--surface-2)]',
                  )}
                >
                  <CreditCard
                    size={22}
                    color={stripeConfig.enableCreditCard ? '#fff' : 'var(--text-muted)'}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.95rem] font-bold text-[var(--foreground)]">
                    บัตรเครดิต/เดบิต
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    รองรับ Visa, Mastercard, JCB, American Express
                  </p>
                </div>
                <Switch
                  checked={stripeConfig.enableCreditCard}
                  onCheckedChange={(checked) => updateStripeConfig({ enableCreditCard: checked })}
                  className="data-[state=checked]:bg-[#635BFF]/55"
                />
              </div>
              {stripeConfig.enableCreditCard && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className="border-0 bg-amber-500/10 text-[0.72rem] text-amber-500">
                    ค่าธรรมเนียม: 3.65%
                  </Badge>
                  <Badge className="border-0 bg-green-500/10 text-[0.72rem] text-green-500">
                    3D Secure
                  </Badge>
                  <Badge className="border-0 bg-[#635BFF]/15 text-[0.72rem] text-[#635BFF]">
                    Visa, MC, JCB, Amex
                  </Badge>
                </div>
              )}
            </div>
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
              <div className="flex flex-wrap gap-4">
                <div className="min-w-[200px] flex-1 space-y-1.5">
                  <Label htmlFor="promptpay-min">ยอดขั้นต่ำ (บาท)</Label>
                  <div className="relative">
                    <Input
                      id="promptpay-min"
                      type="number"
                      value={stripeConfig.promptPayMinAmount}
                      onChange={(e) =>
                        updateStripeConfig({ promptPayMinAmount: Number(e.target.value) || 10 })
                      }
                      className="pr-8"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                      ฿
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">Stripe กำหนดขั้นต่ำ 10 บาท</p>
                </div>

                <div className="min-w-[200px] flex-1 space-y-1.5">
                  <Label htmlFor="promptpay-max">ยอดสูงสุด (บาท)</Label>
                  <div className="relative">
                    <Input
                      id="promptpay-max"
                      type="number"
                      value={stripeConfig.promptPayMaxAmount || ''}
                      onChange={(e) =>
                        updateStripeConfig({ promptPayMaxAmount: Number(e.target.value) || 0 })
                      }
                      className="pr-8"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                      ฿
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">0 = ไม่จำกัด</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="promptpay-expiration">เวลาหมดอายุ QR Code (นาที)</Label>
                <div className="relative">
                  <Clock
                    size={16}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-muted)]"
                  />
                  <Input
                    id="promptpay-expiration"
                    type="number"
                    value={stripeConfig.promptPayExpirationMinutes || 15}
                    onChange={(e) =>
                      updateStripeConfig({
                        promptPayExpirationMinutes: Number(e.target.value) || 15,
                      })
                    }
                    className="pl-9 pr-14"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                    นาที
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  ระยะเวลาก่อน QR Code หมดอายุ (ค่าเริ่มต้น: 15 นาที)
                </p>
              </div>

              <Alert className="rounded-[10px] border border-blue-600/15 bg-blue-600/[0.06]">
                <Info className="size-4 text-blue-600" />
                <AlertDescription className="text-[0.8rem] text-[var(--foreground)]">
                  💡 เมื่อลูกค้าชำระเงินผ่าน PromptPay QR Code ระบบจะยืนยันการชำระเงินอัตโนมัติทันที
                  ไม่ต้องอัปโหลดสลิป และไม่มีค่าธรรมเนียมเพิ่มเติม
                </AlertDescription>
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
                <Badge className="h-5 border-0 bg-cyan-500 text-[0.65rem] text-white">
                  {status.recentWebhookEvents >= 100 ? '100+' : status.recentWebhookEvents} events (24h)
                </Badge>
              ) : null
            }
          >
            <div className="rounded-[10px] border border-[var(--glass-border)] bg-[var(--surface-2)] p-3">
              <p className="mb-1.5 text-[0.72rem] text-[var(--text-muted)]">
                Webhook Endpoint URL — คัดลอกไปตั้งค่าใน Stripe Dashboard
              </p>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1 overflow-auto rounded-md border border-[var(--glass-border)] bg-[var(--surface)] p-2">
                  <p className="break-all font-mono text-[0.78rem] text-[var(--foreground)]">
                    {status?.webhookUrl || '/api/payment/webhook/stripe'}
                  </p>
                </div>
                <CopyButton
                  text={
                    status?.webhookUrl ||
                    `${typeof window !== 'undefined' ? window.location.origin : ''}/api/payment/webhook/stripe`
                  }
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-[0.82rem] font-semibold text-[var(--foreground)]">
                Events ที่รองรับ
              </p>
              <div className="flex flex-col gap-1.5">
                <WebhookEventRow event="payment_intent.succeeded" description="ชำระเงินสำเร็จ → อัปเดตสถานะ order เป็น PAID" />
                <WebhookEventRow event="payment_intent.payment_failed" description="ชำระเงินล้มเหลว → บันทึก error" />
                <WebhookEventRow event="payment_intent.canceled" description="ยกเลิก PaymentIntent → อัปเดตสถานะ" />
                <WebhookEventRow event="charge.refunded" description="คืนเงิน → อัปเดตสถานะ order เป็น REFUNDED" />
              </div>
            </div>

            <Alert className="rounded-[10px] border border-amber-500/15 bg-amber-500/[0.06]">
              <Warning className="size-4 text-amber-500" />
              <AlertDescription className="text-[0.78rem] text-[var(--foreground)]">
                ⚠️ ต้องเพิ่ม events ข้างต้นทั้ง 4 รายการใน Stripe Dashboard → Webhooks เพื่อให้ระบบทำงานได้สมบูรณ์
              </AlertDescription>
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
            <div className="flex items-center justify-between rounded-[10px] bg-[var(--surface-2)] p-3">
              <div>
                <p className="text-[0.88rem] font-semibold text-[var(--foreground)]">
                  เปิดใช้การคืนเงินอัตโนมัติ
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  เมื่ออนุมัติคำขอคืนเงิน ระบบจะคืนเงินผ่าน Stripe โดยอัตโนมัติ
                </p>
              </div>
              <Switch
                checked={stripeConfig.enableAutoRefund}
                onCheckedChange={(checked) => updateStripeConfig({ enableAutoRefund: checked })}
              />
            </div>

            <Alert className="rounded-[10px]">
              <Info className="size-4" />
              <AlertDescription className="text-[0.78rem]">
                การคืนเงินจะใช้เวลา 5-10 วันทำการ ขึ้นอยู่กับธนาคารของลูกค้า
                สำหรับ PromptPay จะคืนเงินเข้าบัญชีเดิมที่ชำระมา
              </AlertDescription>
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
            <div className="flex items-center justify-between rounded-[10px] bg-[var(--surface-2)] p-3">
              <div>
                <p className="text-[0.88rem] font-semibold text-[var(--foreground)]">
                  ส่งใบเสร็จทางอีเมล
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Stripe จะส่งใบเสร็จอิเล็กทรอนิกส์ไปยังอีเมลลูกค้าโดยอัตโนมัติ
                </p>
              </div>
              <Switch
                checked={stripeConfig.receiptEmailEnabled}
                onCheckedChange={(checked) => updateStripeConfig({ receiptEmailEnabled: checked })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="statement-descriptor">Statement Descriptor</Label>
              <Input
                id="statement-descriptor"
                value={stripeConfig.statementDescriptor || ''}
                onChange={(e) => {
                  const val = e.target.value.slice(0, 22);
                  updateStripeConfig({ statementDescriptor: val });
                }}
                placeholder="SCC SHOP"
                maxLength={22}
              />
              <p className="text-xs text-[var(--text-muted)]">
                ชื่อที่จะแสดงในรายการเดินบัญชีของลูกค้า (สูงสุด 22 ตัวอักษร) —{' '}
                {(stripeConfig.statementDescriptor || '').length}/22
              </p>
            </div>

            <div className="rounded-[10px] bg-[var(--surface-2)] p-3">
              <p className="mb-1 text-xs text-[var(--text-muted)]">รูปแบบ URL ใบเสร็จ</p>
              <p className="font-mono text-[0.78rem] text-[var(--foreground)]">
                https://pay.stripe.com/receipts/...
              </p>
              <p className="mt-1 text-[0.7rem] text-[var(--text-muted)]">
                ใบเสร็จจาก Stripe จะถูกบันทึกอัตโนมัติในระบบเมื่อชำระเงินสำเร็จ
              </p>
            </div>
          </SectionCard>

          {/* ======== SECTION 8: Quick Links ======== */}
          <SectionCard
            icon={<ExternalLink size={18} />}
            title="ลิงก์ด่วน"
            subtitle="ลิงก์ไปยัง Stripe Dashboard และเอกสาร"
            accentColor="#64748b"
            defaultExpanded={false}
          >
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
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
                  variant="outline"
                  asChild
                  className="h-auto flex-col items-start gap-1 rounded-[10px] border-[var(--glass-border)] p-3 text-[var(--foreground)] transition-all duration-200 hover:border-[#635BFF] hover:bg-[#635BFF]/[0.04]"
                >
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    <span className="flex items-center gap-2">
                      <span className="text-[#635BFF]">{link.icon}</span>
                      <span className="text-[0.82rem] font-semibold">{link.label}</span>
                      <ExternalLink size={12} className="text-[var(--text-muted)]" />
                    </span>
                    <span className="text-[0.7rem] text-[var(--text-muted)]">{link.desc}</span>
                  </a>
                </Button>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </TooltipProvider>
  );
}
