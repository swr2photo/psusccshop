'use client';

import { apiFetch } from '@/lib/api-client';
import { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus as Add,
  Trash2 as Delete,
  Save,
  ChevronDown as ExpandMore,
  ChevronUp as ExpandLess,
  Wallet as Payment,
  DollarSign as AttachMoney,
  Shield as Security,
  Info,
  X,
} from 'lucide-react';
import {
  PaymentConfig,
  PaymentOption,
  PaymentMethod,
  PaymentGateway,
  PaymentGatewayConfig,
  PAYMENT_METHODS,
  PAYMENT_GATEWAYS,
  DEFAULT_PAYMENT_CONFIG,
} from '@/lib/payment';
import StripeSettings from '@/components/admin/StripeSettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const glassCardClass =
  'rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--foreground)] shadow-sm';

const gradientBtnClass =
  'rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-500 font-bold text-white shadow-[0_4px_15px_rgba(139,92,246,0.3)] hover:opacity-90';

const inputClass = 'rounded-[10px]';

interface PaymentSettingsProps {
  onSave?: () => void;
}

export default function PaymentSettings({ onSave }: PaymentSettingsProps) {
  const [config, setConfig] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [gatewayDialogOpen, setGatewayDialogOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(null);
  const [showStripeSettings, setShowStripeSettings] = useState(false);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/payment/config');
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
      } else {
        setError('Failed to load payment config');
      }
    } catch (err) {
      setError('Failed to load payment config');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      setError(null);

      const res = await apiFetch('/api/payment/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('บันทึกการตั้งค่าสำเร็จ');
        setTimeout(() => setSuccess(null), 3000);
        onSave?.();
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch (err) {
      setError('Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const toggleOptionEnabled = (optionId: string) => {
    setConfig(prev => ({
      ...prev,
      options: prev.options.map(opt =>
        opt.id === optionId ? { ...opt, enabled: !opt.enabled } : opt
      ),
    }));
  };

  const updateOption = (optionId: string, updates: Partial<PaymentOption>) => {
    setConfig(prev => ({
      ...prev,
      options: prev.options.map(opt =>
        opt.id === optionId ? { ...opt, ...updates } : opt
      ),
    }));
  };

  const deleteOption = (optionId: string) => {
    if (!confirm('ต้องการลบตัวเลือกนี้?')) return;
    setConfig(prev => ({
      ...prev,
      options: prev.options.filter(opt => opt.id !== optionId),
    }));
  };

  const addOption = (option: PaymentOption) => {
    setConfig(prev => ({
      ...prev,
      options: [...prev.options, option],
    }));
    setAddDialogOpen(false);
  };

  const updateGateway = (gateway: PaymentGateway, updates: Partial<PaymentGatewayConfig>) => {
    setConfig(prev => {
      const existingIndex = prev.gateways.findIndex(g => g.gateway === gateway);
      if (existingIndex >= 0) {
        const newGateways = [...prev.gateways];
        newGateways[existingIndex] = { ...newGateways[existingIndex], ...updates };
        return { ...prev, gateways: newGateways };
      } else {
        return {
          ...prev,
          gateways: [
            ...prev.gateways,
            {
              gateway,
              enabled: false,
              testMode: true,
              supportedMethods: [],
              ...updates,
            },
          ],
        };
      }
    });
  };

  const getGatewayConfig = (gateway: PaymentGateway): PaymentGatewayConfig | undefined => {
    return config.gateways.find(g => g.gateway === gateway);
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-[var(--text-muted)]">กำลังโหลด...</p>
      </div>
    );
  }

  // Show Stripe-specific settings panel
  if (showStripeSettings) {
    return (
      <StripeSettings
        config={getGatewayConfig('stripe')}
        onUpdate={(updates) => updateGateway('stripe', updates)}
        onBack={() => setShowStripeSettings(false)}
        onSave={saveConfig}
        saving={saving}
      />
    );
  }

  return (
    <TooltipProvider>
      <div>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CreditCard size={28} className="text-indigo-500" />
            <h2 className="text-xl font-bold text-[var(--foreground)]">
              ตั้งค่าการชำระเงิน
            </h2>
          </div>
          <Button
            onClick={saveConfig}
            disabled={saving}
            className={gradientBtnClass}
          >
            <Save />
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="relative mb-4 pr-10">
            <AlertDescription>{error}</AlertDescription>
            <button
              type="button"
              onClick={() => setError(null)}
              className="absolute top-3 right-3 rounded-sm opacity-70 transition-opacity hover:opacity-100"
              aria-label="ปิด"
            >
              <X className="size-4" />
            </button>
          </Alert>
        )}

        {success && (
          <Alert className="relative mb-4 border-emerald-500/30 bg-emerald-500/10 pr-10 text-emerald-600">
            <AlertDescription>{success}</AlertDescription>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className="absolute top-3 right-3 rounded-sm opacity-70 transition-opacity hover:opacity-100"
              aria-label="ปิด"
            >
              <X className="size-4" />
            </button>
          </Alert>
        )}

        {/* Info Alert */}
        <Alert className="mb-6 border-blue-500/30 bg-blue-500/10">
          <Info className="text-blue-500" />
          <AlertDescription className="text-sm text-[var(--foreground)]">
            การชำระเงินผ่านบัตรเครดิตต้องตั้งค่า Payment Gateway ก่อน โดย Secret Key จะเก็บใน Environment Variables เท่านั้น
          </AlertDescription>
        </Alert>

        {/* Payment Gateways */}
        <Card className={cn(glassCardClass, 'mb-6 gap-0 py-0')}>
          <CardContent className="px-5 py-5">
            <p className="mb-4 flex items-center gap-2 text-base font-bold text-[var(--foreground)]">
              <Security size={20} />
              Payment Gateways
            </p>

            <div className="flex flex-col gap-3">
              {Object.entries(PAYMENT_GATEWAYS).map(([key, info]) => {
                const gateway = key as PaymentGateway;
                const gatewayConfig = getGatewayConfig(gateway);

                return (
                  <Card
                    key={key}
                    className={cn(
                      'gap-0 rounded-[10px] py-0 shadow-none transition-colors',
                      gatewayConfig?.enabled
                        ? 'border-emerald-500/30 bg-emerald-500/10'
                        : 'border-[var(--glass-border)] bg-[var(--surface-2)]'
                    )}
                  >
                    <div className="flex items-center gap-4 p-4">
                      <Switch
                        checked={gatewayConfig?.enabled || false}
                        onCheckedChange={(checked) => updateGateway(gateway, { enabled: checked })}
                        size="sm"
                        className="data-[state=checked]:bg-emerald-500"
                      />

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-[var(--foreground)]">{info.name}</p>
                          {gatewayConfig?.testMode && (
                            <Badge className="h-[18px] bg-amber-500/20 px-1.5 text-[0.65rem] text-amber-500">
                              TEST MODE
                            </Badge>
                          )}
                          {gatewayConfig?.enabled && !gatewayConfig?.testMode && (
                            <Badge className="h-[18px] bg-emerald-500/20 px-1.5 text-[0.65rem] text-emerald-500">
                              LIVE
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">
                          รองรับ: {info.supportedMethods.map(m => PAYMENT_METHODS[m]?.nameThai).join(', ')}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-indigo-500 hover:text-indigo-400"
                        onClick={() => {
                          if (gateway === 'stripe') {
                            setShowStripeSettings(true);
                          } else {
                            setEditingGateway(gateway);
                            setGatewayDialogOpen(true);
                          }
                        }}
                      >
                        ตั้งค่า
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Payment Options */}
        <Card className={cn(glassCardClass, 'mb-6 gap-0 py-0')}>
          <CardContent className="px-5 py-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="flex items-center gap-2 text-base font-bold text-[var(--foreground)]">
                <Payment size={20} />
                ตัวเลือกการชำระเงิน
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-indigo-500 text-indigo-500 hover:bg-indigo-500/10 hover:text-indigo-400"
                onClick={() => setAddDialogOpen(true)}
              >
                <Add />
                เพิ่ม
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {config.options.map((option) => (
                <PaymentOptionCard
                  key={option.id}
                  option={option}
                  expanded={expandedOption === option.id}
                  onToggleExpand={() => setExpandedOption(expandedOption === option.id ? null : option.id)}
                  onToggleEnabled={() => toggleOptionEnabled(option.id)}
                  onUpdate={(updates) => updateOption(option.id, updates)}
                  onDelete={() => deleteOption(option.id)}
                  gatewayEnabled={option.gateway ? getGatewayConfig(option.gateway)?.enabled : true}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* COD Settings */}
        <Card className={cn(glassCardClass, 'gap-0 py-0')}>
          <CardContent className="px-5 py-5">
            <p className="mb-4 flex items-center gap-2 text-base font-bold text-[var(--foreground)]">
              <AttachMoney size={20} />
              เก็บเงินปลายทาง (COD)
            </p>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--foreground)]">เปิดใช้ COD</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    ลูกค้าสามารถชำระเงินเมื่อรับสินค้าได้
                  </p>
                </div>
                <Switch
                  checked={config.enableCOD}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enableCOD: checked }))}
                />
              </div>

              {config.enableCOD && (
                <div className="space-y-2">
                  <Label htmlFor="cod-fee">ค่าธรรมเนียม COD (บาท)</Label>
                  <div className="relative">
                    <Input
                      id="cod-fee"
                      type="number"
                      value={config.codFee || 0}
                      onChange={(e) => setConfig(prev => ({ ...prev, codFee: parseInt(e.target.value) || 0 }))}
                      className={cn(inputClass, 'pr-8')}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                      ฿
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Add Payment Option Dialog */}
        <AddPaymentOptionDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          onAdd={addOption}
          enabledGateways={config.gateways.filter(g => g.enabled).map(g => g.gateway)}
        />

        {/* Gateway Config Dialog (for non-Stripe gateways) */}
        {editingGateway && (
          <GatewayConfigDialog
            open={gatewayDialogOpen}
            onClose={() => {
              setGatewayDialogOpen(false);
              setEditingGateway(null);
            }}
            gateway={editingGateway}
            config={getGatewayConfig(editingGateway)}
            onUpdate={(updates) => updateGateway(editingGateway, updates)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

// Payment Option Card Component
function PaymentOptionCard({
  option,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onUpdate,
  onDelete,
  gatewayEnabled,
}: {
  option: PaymentOption;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onUpdate: (updates: Partial<PaymentOption>) => void;
  onDelete: () => void;
  gatewayEnabled?: boolean;
}) {
  const methodInfo = PAYMENT_METHODS[option.method];
  const needsGateway = methodInfo?.requiresGateway;
  const canEnable = !needsGateway || gatewayEnabled;

  return (
    <Card
      className={cn(
        'gap-0 rounded-[10px] py-0 shadow-none transition-all',
        option.enabled
          ? 'border-indigo-500/30 bg-indigo-500/10'
          : 'border-[var(--glass-border)] bg-[var(--surface-2)]',
        !canEnable && 'opacity-60'
      )}
    >
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-center gap-4">
          {!canEnable ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Switch
                    checked={option.enabled}
                    onCheckedChange={onToggleEnabled}
                    size="sm"
                    disabled
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>ต้องเปิด Payment Gateway ก่อน</TooltipContent>
            </Tooltip>
          ) : (
            <Switch
              checked={option.enabled}
              onCheckedChange={onToggleEnabled}
              size="sm"
            />
          )}

          <span className="text-2xl">{methodInfo?.icon}</span>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-[var(--foreground)]">{option.nameThai || option.name}</p>
              {option.gateway && (
                <Badge variant="secondary" className="h-5 text-[0.7rem]">
                  {PAYMENT_GATEWAYS[option.gateway]?.name}
                </Badge>
              )}
              {!canEnable && (
                <Badge className="h-[18px] bg-amber-500/20 px-1.5 text-[0.65rem] text-amber-500">
                  ต้องเปิด Gateway
                </Badge>
              )}
            </div>
            {option.description && (
              <p className="text-xs text-[var(--text-muted)]">{option.description}</p>
            )}
          </div>

          {(option.feeType && option.feeAmount) && (
            <p className="text-sm text-orange-400">
              +{option.feeType === 'percentage' ? `${option.feeAmount}%` : `฿${option.feeAmount}`}
            </p>
          )}

          <Button variant="ghost" size="icon-sm" onClick={onToggleExpand}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </Button>
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="mt-4 pt-4">
            <Separator className="mb-4" />
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor={`name-thai-${option.id}`}>ชื่อแสดง (ไทย)</Label>
                <Input
                  id={`name-thai-${option.id}`}
                  value={option.nameThai || ''}
                  onChange={(e) => onUpdate({ nameThai: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`desc-${option.id}`}>คำอธิบาย</Label>
                <Textarea
                  id={`desc-${option.id}`}
                  value={option.description || ''}
                  onChange={(e) => onUpdate({ description: e.target.value })}
                  className={inputClass}
                  rows={2}
                />
              </div>

              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[120px] space-y-2">
                  <Label>ประเภทค่าธรรมเนียม</Label>
                  <Select
                    value={option.feeType || 'none'}
                    onValueChange={(v) =>
                      onUpdate({
                        feeType: v === 'none' ? undefined : (v as 'fixed' | 'percentage'),
                      })
                    }
                  >
                    <SelectTrigger className={cn(inputClass, 'w-full min-w-[120px]')}>
                      <SelectValue placeholder="ไม่มี" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ไม่มี</SelectItem>
                      <SelectItem value="fixed">คงที่</SelectItem>
                      <SelectItem value="percentage">เปอร์เซ็นต์</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {option.feeType && (
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor={`fee-${option.id}`}>ค่าธรรมเนียม</Label>
                    <div className="relative">
                      <Input
                        id={`fee-${option.id}`}
                        type="number"
                        value={option.feeAmount || ''}
                        onChange={(e) => onUpdate({ feeAmount: parseFloat(e.target.value) || undefined })}
                        className={cn(inputClass, 'pr-8')}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                        {option.feeType === 'percentage' ? '%' : '฿'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor={`min-${option.id}`}>ยอดขั้นต่ำ (บาท)</Label>
                  <Input
                    id={`min-${option.id}`}
                    type="number"
                    value={option.minOrderAmount || ''}
                    onChange={(e) =>
                      onUpdate({ minOrderAmount: e.target.value ? parseInt(e.target.value) : undefined })
                    }
                    className={inputClass}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor={`max-${option.id}`}>ยอดสูงสุด (บาท)</Label>
                  <Input
                    id={`max-${option.id}`}
                    type="number"
                    value={option.maxOrderAmount || ''}
                    onChange={(e) =>
                      onUpdate({ maxOrderAmount: e.target.value ? parseInt(e.target.value) : undefined })
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`sort-${option.id}`}>ลำดับการแสดง</Label>
                <Input
                  id={`sort-${option.id}`}
                  type="number"
                  value={option.sortOrder || 0}
                  onChange={(e) => onUpdate({ sortOrder: parseInt(e.target.value) || 0 })}
                  className={inputClass}
                />
                <p className="text-xs text-[var(--text-muted)]">ตัวเลขน้อย = แสดงก่อน</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-500/50 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                  onClick={onDelete}
                >
                  <Delete />
                  ลบ
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// Add Payment Option Dialog
function AddPaymentOptionDialog({
  open,
  onClose,
  onAdd,
  enabledGateways,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (option: PaymentOption) => void;
  enabledGateways: PaymentGateway[];
}) {
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [gateway, setGateway] = useState<PaymentGateway | ''>('');
  const [name, setName] = useState('');

  const methodInfo = PAYMENT_METHODS[method];
  const availableGateways = methodInfo?.supportedGateways.filter(g => enabledGateways.includes(g)) || [];

  useEffect(() => {
    if (methodInfo?.requiresGateway && availableGateways.length > 0) {
      setGateway(availableGateways[0]);
    } else {
      setGateway('');
    }
  }, [method]);

  const handleAdd = () => {
    const newOption: PaymentOption = {
      id: `${method}_${gateway || 'default'}_${Date.now()}`,
      method,
      gateway: gateway || undefined,
      name: name || methodInfo?.name || method,
      nameThai: name || methodInfo?.nameThai,
      enabled: true,
      sortOrder: 99,
    };
    onAdd(newOption);
    // Reset form
    setMethod('bank_transfer');
    setGateway('');
    setName('');
  };

  const canAdd = !methodInfo?.requiresGateway || (gateway && enabledGateways.includes(gateway));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>เพิ่มตัวเลือกการชำระเงิน</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>วิธีการชำระเงิน</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className={cn(inputClass, 'w-full')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHODS).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.icon} {info.nameThai}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {methodInfo?.requiresGateway && (
            <>
              <div className="space-y-2">
                <Label>Payment Gateway</Label>
                {availableGateways.length === 0 ? (
                  <Select disabled>
                    <SelectTrigger className={cn(inputClass, 'w-full')}>
                      <SelectValue placeholder="ไม่มี Gateway ที่เปิดใช้งาน" />
                    </SelectTrigger>
                  </Select>
                ) : (
                  <Select
                    value={gateway}
                    onValueChange={(v) => setGateway(v as PaymentGateway)}
                  >
                    <SelectTrigger className={cn(inputClass, 'w-full')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableGateways.map((g) => (
                        <SelectItem key={g} value={g}>
                          {PAYMENT_GATEWAYS[g].name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {availableGateways.length === 0 && (
                <Alert className="border-amber-500/30 bg-amber-500/10">
                  <AlertDescription className="text-amber-600">
                    ต้องเปิดใช้ Payment Gateway ที่รองรับวิธีนี้ก่อน
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="add-option-name">ชื่อแสดง (ไม่บังคับ)</Label>
            <Input
              id="add-option-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={methodInfo?.nameThai}
              className={inputClass}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!canAdd}
            className={gradientBtnClass}
          >
            เพิ่ม
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Gateway Config Dialog (for non-Stripe gateways)
function GatewayConfigDialog({
  open,
  onClose,
  gateway,
  config,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  gateway: PaymentGateway;
  config?: PaymentGatewayConfig;
  onUpdate: (updates: Partial<PaymentGatewayConfig>) => void;
}) {
  const gatewayInfo = PAYMENT_GATEWAYS[gateway];

  const getEnvVarName = (gateway: PaymentGateway, type: 'secret' | 'public' | 'webhook') => {
    const prefix = gateway.toUpperCase().replace('2C2P', 'TWOCTWOP');
    switch (type) {
      case 'secret': return `${prefix}_SECRET_KEY`;
      case 'public': return `${prefix}_PUBLIC_KEY` || `NEXT_PUBLIC_${prefix}_PUBLIC_KEY`;
      case 'webhook': return `${prefix}_WEBHOOK_SECRET`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ตั้งค่า {gatewayInfo.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <Alert className="border-blue-500/30 bg-blue-500/10">
            <AlertDescription>
              <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">
                Secret Keys ต้องเก็บใน Environment Variables:
              </p>
              <pre className="overflow-auto rounded-md bg-[var(--glass-bg)] p-2 text-xs text-[var(--text-muted)]">
                {getEnvVarName(gateway, 'secret')}=sk_...{'\n'}
                {getEnvVarName(gateway, 'public')}=pk_...{'\n'}
                {getEnvVarName(gateway, 'webhook')}=whsec_...
              </pre>
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--foreground)]">โหมดทดสอบ</p>
              <p className="text-xs text-[var(--text-muted)]">ใช้ Test API Keys</p>
            </div>
            <Switch
              checked={config?.testMode ?? true}
              onCheckedChange={(checked) => onUpdate({ testMode: checked })}
              className="data-[state=checked]:bg-amber-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gateway-public-key">Public Key (แสดงได้)</Label>
            <Input
              id="gateway-public-key"
              value={config?.publicKey || ''}
              onChange={(e) => onUpdate({ publicKey: e.target.value })}
              placeholder="pk_test_..."
              className={inputClass}
            />
            <p className="text-xs text-[var(--text-muted)]">Public Key สามารถเก็บในฐานข้อมูลได้</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gateway-webhook">Webhook Endpoint</Label>
            <Input
              id="gateway-webhook"
              value={config?.webhookEndpoint || `/api/payment/webhook/${gateway}`}
              className={inputClass}
              disabled
            />
            <p className="text-xs text-[var(--text-muted)]">URL สำหรับรับ webhook จาก payment gateway</p>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">รองรับวิธีการชำระเงิน:</p>
            <div className="flex flex-wrap gap-2">
              {gatewayInfo.supportedMethods.map(method => (
                <Badge
                  key={method}
                  variant="secondary"
                  className="bg-indigo-500/20 text-[var(--foreground)]"
                >
                  {PAYMENT_METHODS[method]?.icon} {PAYMENT_METHODS[method]?.nameThai}
                </Badge>
              ))}
            </div>
          </div>

          <Button variant="outline" className="border-indigo-500 text-indigo-500 hover:bg-indigo-500/10" asChild>
            <a href={gatewayInfo.docUrl} target="_blank" rel="noopener noreferrer">
              เอกสาร API
            </a>
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            ปิด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
