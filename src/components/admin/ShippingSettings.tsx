'use client';

import { apiFetch } from '@/lib/api-client';
import { useState, useEffect } from 'react';
import {
  Truck as LocalShipping,
  Plus as Add,
  Trash2 as Delete,
  Save,
  ChevronDown as ExpandMore,
  ChevronUp as ExpandLess,
  ExternalLink as OpenInNew,
  Settings,
  Package as Inventory,
  X,
  Info,
  CircleAlert,
  CircleCheck,
} from 'lucide-react';
import {
  ShippingConfig,
  ShippingOption,
  ShippingProvider,
  SHIPPING_PROVIDERS,
  DEFAULT_SHIPPING_CONFIG,
} from '@/lib/shipping';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ShippingSettingsProps {
  onSave?: () => void;
}

const glassCardClass =
  'rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]';

const gradientBtnClass =
  'rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-500 font-bold text-white shadow-[0_4px_15px_rgba(139,92,246,0.3)] hover:opacity-90';

const inputClass = 'rounded-[10px]';

export default function ShippingSettings({ onSave }: ShippingSettingsProps) {
  const [config, setConfig] = useState<ShippingConfig>(DEFAULT_SHIPPING_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ShippingOption | null>(null);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/shipping/options');
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
      } else {
        setError('Failed to load shipping config');
      }
    } catch (err) {
      setError('Failed to load shipping config');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      setError(null);

      const res = await apiFetch('/api/shipping/options', {
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
        const errorMsg = data.details
          ? `${data.error}: ${data.details}`
          : (data.error || 'Failed to save');
        setError(errorMsg);
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

  const updateOption = (optionId: string, updates: Partial<ShippingOption>) => {
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

  const addOption = (option: ShippingOption) => {
    setConfig(prev => ({
      ...prev,
      options: [...prev.options, option],
    }));
    setAddDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <LocalShipping size={28} className="text-indigo-500" />
          <h2 className="text-xl font-bold text-[var(--foreground)]">
            ตั้งค่าการจัดส่ง
          </h2>
        </div>
        <Button
          className={gradientBtnClass}
          onClick={saveConfig}
          disabled={saving}
        >
          <Save />
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="relative mb-4 pr-10">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute top-2 right-2"
            onClick={() => setError(null)}
          >
            <X className="size-4" />
          </Button>
        </Alert>
      )}

      {success && (
        <Alert className="relative mb-4 border-emerald-500/30 bg-emerald-500/10 pr-10 text-emerald-700 dark:text-emerald-400">
          <CircleCheck />
          <AlertDescription>{success}</AlertDescription>
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute top-2 right-2"
            onClick={() => setSuccess(null)}
          >
            <X className="size-4" />
          </Button>
        </Alert>
      )}

      {/* General Settings */}
      <Card className={cn(glassCardClass, 'mb-6')}>
        <CardContent className="pt-6">
          <p className="mb-4 flex items-center gap-2 text-base font-bold text-[var(--foreground)]">
            <Settings size={20} />
            ตั้งค่าทั่วไป
          </p>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[var(--foreground)]">แสดงตัวเลือกการจัดส่ง</p>
                <p className="text-xs text-muted-foreground">
                  ให้ลูกค้าเลือกวิธีจัดส่งเอง
                </p>
              </div>
              <Switch
                checked={config.showOptions}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, showOptions: checked }))}
                className="data-[state=checked]:bg-indigo-500"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-[var(--foreground)]">เปิดให้รับหน้าร้าน</p>
                <p className="text-xs text-muted-foreground">
                  ลูกค้าสามารถมารับสินค้าได้
                </p>
              </div>
              <Switch
                checked={config.allowPickup}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, allowPickup: checked }))}
                className="data-[state=checked]:bg-indigo-500"
              />
            </div>

            {config.allowPickup && (
              <div className="space-y-4 pl-4">
                <div className="space-y-2">
                  <Label htmlFor="pickupLocation">สถานที่รับสินค้า</Label>
                  <Input
                    id="pickupLocation"
                    className={inputClass}
                    value={config.pickupLocation || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, pickupLocation: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickupInstructions">คำแนะนำ</Label>
                  <Textarea
                    id="pickupInstructions"
                    className={inputClass}
                    value={config.pickupInstructions || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, pickupInstructions: e.target.value }))}
                    rows={2}
                    placeholder="เช่น: รับได้วันจันทร์-ศุกร์ 10:00-16:00 น."
                  />
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="globalFreeShippingMinimum">ส่งฟรีขั้นต่ำ (บาท)</Label>
              <div className="relative">
                <Input
                  id="globalFreeShippingMinimum"
                  className={cn(inputClass, 'pr-8')}
                  type="number"
                  value={config.globalFreeShippingMinimum || ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    globalFreeShippingMinimum: e.target.value ? parseInt(e.target.value) : undefined,
                  }))}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                  ฿
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                ยอดสั่งซื้อขั้นต่ำที่ส่งฟรี (เว้นว่างไม่มี)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Track123 API Info */}
      <Card className="mb-6 rounded-xl border border-blue-700/30 bg-blue-900/10">
        <CardContent className="pt-6">
          <p className="mb-4 flex items-center gap-2 text-base font-bold text-violet-400">
            <OpenInNew size={20} />
            Track123 API (ระบบติดตามพัสดุ)
          </p>

          <p className="mb-4 text-sm text-[var(--text-muted)]">
            ระบบใช้ Track123 API สำหรับติดตามพัสดุจากทุกขนส่ง รองรับการติดตามแบบ batch และ webhook
          </p>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Thailand Post</Badge>
              <Badge variant="secondary">Kerry Express</Badge>
              <Badge variant="secondary">J&T Express</Badge>
              <Badge variant="secondary">Flash Express</Badge>
              <Badge className="border-0 bg-blue-700/20 text-violet-400">+1700 carriers</Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-blue-700/50 text-violet-400 hover:border-indigo-500 hover:bg-indigo-500/10"
                asChild
              >
                <a href="https://member.track123.com/api" target="_blank" rel="noopener noreferrer">
                  <OpenInNew />
                  ดู API Key
                </a>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-[var(--text-muted)] hover:border-indigo-500"
                asChild
              >
                <a href="https://docs.track123.com/reference/request" target="_blank" rel="noopener noreferrer">
                  <OpenInNew />
                  API Docs
                </a>
              </Button>
            </div>

            <Alert className="border-blue-500/20 bg-blue-500/10">
              <Info />
              <AlertDescription className="text-xs">
                ตั้งค่า <code className="rounded bg-black/20 px-1 py-0.5">TRACK123_API_KEY</code> ใน .env.local เพื่อเปิดใช้งานการติดตามพัสดุอัตโนมัติ
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Options */}
      <Card className={glassCardClass}>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="flex items-center gap-2 text-base font-bold text-[var(--foreground)]">
              <Inventory size={20} />
              ตัวเลือกการจัดส่ง
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-indigo-500 text-indigo-500 hover:border-violet-600 hover:bg-indigo-500/10"
              onClick={() => setAddDialogOpen(true)}
            >
              <Add />
              เพิ่ม
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {config.options.map((option) => (
              <ShippingOptionCard
                key={option.id}
                option={option}
                expanded={expandedOption === option.id}
                onToggleExpand={() => setExpandedOption(expandedOption === option.id ? null : option.id)}
                onToggleEnabled={() => toggleOptionEnabled(option.id)}
                onUpdate={(updates) => updateOption(option.id, updates)}
                onDelete={() => deleteOption(option.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Option Dialog */}
      <AddShippingOptionDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={addOption}
      />
    </div>
  );
}

// Shipping Option Card Component
function ShippingOptionCard({
  option,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onUpdate,
  onDelete,
}: {
  option: ShippingOption;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onUpdate: (updates: Partial<ShippingOption>) => void;
  onDelete: () => void;
}) {
  const providerInfo = SHIPPING_PROVIDERS[option.provider];

  return (
    <Card
      className={cn(
        'rounded-[10px] transition-all duration-200',
        option.enabled
          ? 'border-indigo-500/30 bg-indigo-500/10'
          : 'border-[var(--border)] bg-[var(--card)]/50',
      )}
    >
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-center gap-4">
          <Switch
            checked={option.enabled}
            onCheckedChange={onToggleEnabled}
            className="data-[state=checked]:bg-indigo-500"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-[var(--foreground)]">{option.name}</p>
              <Badge variant="secondary" className="h-5 text-[0.7rem]">
                {providerInfo?.nameThai || option.provider}
              </Badge>
            </div>
            {option.description && (
              <p className="text-xs text-muted-foreground">{option.description}</p>
            )}
          </div>

          <p className="min-w-[60px] text-right font-bold text-cyan-400">
            {option.baseFee === 0 ? 'ฟรี' : `฿${option.baseFee}`}
          </p>

          <Button variant="ghost" size="icon-sm" onClick={onToggleExpand}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </Button>
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label>ชื่อ</Label>
                <Input
                  className={inputClass}
                  value={option.name}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>คำอธิบาย</Label>
                <Input
                  className={inputClass}
                  value={option.description || ''}
                  onChange={(e) => onUpdate({ description: e.target.value })}
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label>ค่าส่ง (บาท)</Label>
                  <Input
                    className={inputClass}
                    type="number"
                    value={option.baseFee}
                    onChange={(e) => onUpdate({ baseFee: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>ค่าส่งเพิ่ม/ชิ้น</Label>
                  <Input
                    className={inputClass}
                    type="number"
                    value={option.perItemFee || ''}
                    onChange={(e) => onUpdate({ perItemFee: e.target.value ? parseInt(e.target.value) : undefined })}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label>จัดส่ง (วันต่ำสุด)</Label>
                  <Input
                    className={inputClass}
                    type="number"
                    value={option.estimatedDays?.min || ''}
                    onChange={(e) => onUpdate({
                      estimatedDays: {
                        ...option.estimatedDays,
                        min: parseInt(e.target.value) || 1,
                        max: option.estimatedDays?.max || 3,
                      },
                    })}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>จัดส่ง (วันสูงสุด)</Label>
                  <Input
                    className={inputClass}
                    type="number"
                    value={option.estimatedDays?.max || ''}
                    onChange={(e) => onUpdate({
                      estimatedDays: {
                        min: option.estimatedDays?.min || 1,
                        max: parseInt(e.target.value) || 3,
                      },
                    })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>ส่งฟรีขั้นต่ำ (บาท)</Label>
                <Input
                  className={inputClass}
                  type="number"
                  value={option.freeShippingMinimum || ''}
                  onChange={(e) => onUpdate({ freeShippingMinimum: e.target.value ? parseInt(e.target.value) : undefined })}
                />
                <p className="text-xs text-muted-foreground">ยอดสั่งซื้อขั้นต่ำที่ส่งฟรี</p>
              </div>

              {option.provider !== 'pickup' && option.provider !== 'custom' && (
                <div className="space-y-2">
                  <Label>URL ติดตามพัสดุ (ใช้ {'{tracking}'} แทนเลขพัสดุ)</Label>
                  <div className="relative">
                    <Input
                      className={cn(inputClass, option.trackingUrlTemplate ? 'pr-10' : undefined)}
                      value={option.trackingUrlTemplate || ''}
                      onChange={(e) => onUpdate({ trackingUrlTemplate: e.target.value })}
                      placeholder="https://track.example.com/?track={tracking}"
                    />
                    {option.trackingUrlTemplate && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="absolute top-1/2 right-1 -translate-y-1/2"
                              onClick={() => window.open(option.trackingUrlTemplate?.replace('{tracking}', 'TEST123'), '_blank')}
                            >
                              <OpenInNew className="size-[18px]" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>เปิดตัวอย่าง</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive text-destructive hover:bg-destructive/10"
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

// Add Shipping Option Dialog
function AddShippingOptionDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (option: ShippingOption) => void;
}) {
  const [provider, setProvider] = useState<ShippingProvider>('thailand_post');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseFee, setBaseFee] = useState(0);

  const handleAdd = () => {
    const providerInfo = SHIPPING_PROVIDERS[provider];
    const newOption: ShippingOption = {
      id: `${provider}_${Date.now()}`,
      provider,
      name: name || providerInfo.nameThai,
      description,
      baseFee,
      enabled: true,
      trackingUrlTemplate: providerInfo.trackingUrlTemplate,
    };
    onAdd(newOption);
    // Reset form
    setProvider('thailand_post');
    setName('');
    setDescription('');
    setBaseFee(0);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>เพิ่มตัวเลือกการจัดส่ง</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>ผู้ให้บริการ</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as ShippingProvider)}>
              <SelectTrigger className={cn(inputClass, 'w-full')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SHIPPING_PROVIDERS).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.nameThai} ({info.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>ชื่อ</Label>
            <Input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={SHIPPING_PROVIDERS[provider]?.nameThai}
            />
          </div>

          <div className="space-y-2">
            <Label>คำอธิบาย</Label>
            <Input
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="เช่น: 1-3 วันทำการ"
            />
          </div>

          <div className="space-y-2">
            <Label>ค่าส่ง (บาท)</Label>
            <div className="relative">
              <Input
                className={cn(inputClass, 'pr-8')}
                type="number"
                value={baseFee}
                onChange={(e) => setBaseFee(parseInt(e.target.value) || 0)}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                ฿
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            className="bg-blue-800 hover:bg-violet-600"
            onClick={handleAdd}
          >
            เพิ่ม
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
