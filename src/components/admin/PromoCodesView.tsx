'use client';

import React, { useEffect, useState } from 'react';
import { Ticket, Edit, Trash2 } from 'lucide-react';
import type { ShopConfig } from '@/lib/config';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type PromoCode = NonNullable<ShopConfig['promoCodes']>[number];

export interface PromoCodesViewProps {
  config: ShopConfig;
  saveConfig: (newConfig: ShopConfig) => Promise<void>;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  userEmail: string | null | undefined;
}

/** Convert ISO string to local datetime-local value (YYYY-MM-DDTHH:MM) */
function isoToLocalDatetime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert local datetime-local value to ISO string (Safari-safe). */
function localDatetimeToIso(localStr?: string): string {
  if (!localStr) return '';
  const d = new Date(localStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}

const gradientBtnClass =
  'rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 font-bold text-white hover:opacity-90';

const inputClass = 'rounded-xl bg-[var(--surface)]';

export const PromoCodesView = React.memo(function PromoCodesView({
  config,
  saveConfig,
  showToast,
  userEmail,
}: PromoCodesViewProps) {
  const [codes, setCodes] = useState<PromoCode[]>((config.promoCodes || []) as PromoCode[]);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  useEffect(() => {
    setCodes((config.promoCodes || []) as PromoCode[]);
  }, [config.promoCodes]);

  const createNewCode = (): PromoCode => ({
    id: `promo_${Date.now()}`,
    code: '',
    enabled: true,
    discountType: 'percent',
    discountValue: 10,
    createdBy: userEmail || 'admin',
    createdAt: new Date().toISOString(),
  });

  const handleSave = async (code: PromoCode) => {
    if (!code.code.trim()) {
      showToast('warning', 'กรุณากรอกรหัสส่วนลด');
      return;
    }
    setSaving(true);
    try {
      const existingIdx = codes.findIndex((c) => c.id === code.id);
      let newCodes: PromoCode[];
      if (existingIdx >= 0) {
        newCodes = codes.map((c) => (c.id === code.id ? code : c));
      } else {
        newCodes = [...codes, code];
      }
      await saveConfig({ ...config, promoCodes: newCodes as ShopConfig['promoCodes'] });
      setCodes(newCodes);
      setEditingCode(null);
      showToast('success', existingIdx >= 0 ? 'อัปเดตโค้ดแล้ว' : 'สร้างโค้ดแล้ว');
    } catch {
      showToast('error', 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'ลบโค้ดส่วนลด?',
      message: 'โค้ดนี้จะถูกลบถาวร',
      variant: 'warning',
      confirmText: 'ลบ',
      cancelText: 'ยกเลิก',
      destructive: true,
    });
    if (ok) {
      const newCodes = codes.filter((c) => c.id !== id);
      await saveConfig({ ...config, promoCodes: newCodes as ShopConfig['promoCodes'] });
      setCodes(newCodes);
      showToast('success', 'ลบโค้ดแล้ว');
    }
  };

  const toggleEnabled = async (id: string) => {
    const newCodes = codes.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c));
    await saveConfig({ ...config, promoCodes: newCodes as ShopConfig['promoCodes'] });
    setCodes(newCodes);
  };

  return (
    <div>
      <ConfirmDialog />

      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-[var(--foreground)]">
            <Ticket className="size-[22px]" />
            โค้ดส่วนลด
          </h2>
          <p className="text-[0.85rem] text-[var(--muted-foreground)]">จัดการรหัสส่วนลดสำหรับลูกค้า</p>
        </div>
        <Button className={gradientBtnClass} onClick={() => setEditingCode(createNewCode())}>
          + สร้างโค้ดใหม่
        </Button>
      </div>

      {codes.length === 0 ? (
        <div className="py-16 text-center text-[var(--muted-foreground)]">
          <Ticket className="mx-auto mb-4 size-12 opacity-30" />
          <p className="font-semibold">ยังไม่มีโค้ดส่วนลด</p>
          <p className="mt-1 text-[0.85rem]">สร้างโค้ดใหม่เพื่อเริ่มต้นใช้งาน</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {codes.map((code) => {
            const isExpired = code.expiresAt && new Date(code.expiresAt) < new Date();
            const isUsedUp = code.usageLimit != null && (code.usageCount || 0) >= code.usageLimit;
            return (
              <Card
                key={code.id}
                className={cn(
                  'rounded-[14px] border-[var(--border)] bg-[var(--card)]',
                  (isExpired || isUsedUp) && 'opacity-50',
                )}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <Switch
                    checked={code.enabled}
                    onCheckedChange={() => toggleEnabled(code.id)}
                    className="shrink-0 data-[state=checked]:bg-emerald-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-extrabold tracking-wider text-emerald-500">
                        {code.code}
                      </span>
                      {isExpired && (
                        <Badge
                          className="border-transparent text-[0.65rem] font-semibold"
                          style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                        >
                          หมดอายุ
                        </Badge>
                      )}
                      {isUsedUp && (
                        <Badge
                          className="border-transparent text-[0.65rem] font-semibold"
                          style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                        >
                          ใช้ครบแล้ว
                        </Badge>
                      )}
                    </div>
                    <p className="text-[0.8rem] text-[var(--muted-foreground)]">
                      {code.discountType === 'percent' ? `ลด ${code.discountValue}%` : `ลด ฿${code.discountValue}`}
                      {code.maxDiscount ? ` (สูงสุด ฿${code.maxDiscount})` : ''}
                      {code.minOrderAmount ? ` • ขั้นต่ำ ฿${code.minOrderAmount}` : ''}
                      {code.usageLimit != null ? ` • ใช้แล้ว ${code.usageCount || 0}/${code.usageLimit}` : ''}
                      {code.expiresAt ? ` • หมดอายุ ${new Date(code.expiresAt).toLocaleDateString('th-TH')}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-emerald-500 hover:text-emerald-400"
                      onClick={() => setEditingCode(code)}
                    >
                      <Edit className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-red-500 hover:text-red-400"
                      onClick={() => handleDelete(code.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!editingCode}
        onOpenChange={(open) => {
          if (!open && !saving) setEditingCode(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]">
          {editingCode && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-bold">
                  <Ticket className="size-5" />
                  {codes.some((c) => c.id === editingCode.id) ? 'แก้ไขโค้ด' : 'สร้างโค้ดใหม่'}
                </DialogTitle>
              </DialogHeader>

              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="promo-code">รหัสส่วนลด</Label>
                  <Input
                    id="promo-code"
                    className={cn(inputClass, 'font-mono text-lg font-bold tracking-wider')}
                    value={editingCode.code}
                    onChange={(e) =>
                      setEditingCode({
                        ...editingCode,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                      })
                    }
                    placeholder="เช่น FIRST20, SALE50"
                  />
                  <p className="text-xs text-[var(--muted-foreground)]">ใช้ตัวพิมพ์ใหญ่และตัวเลขเท่านั้น</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="promo-description">คำอธิบาย</Label>
                  <Input
                    id="promo-description"
                    className={inputClass}
                    value={editingCode.description || ''}
                    onChange={(e) => setEditingCode({ ...editingCode, description: e.target.value })}
                    placeholder="เช่น ลูกค้าใหม่ลด 20%"
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex gap-1">
                    {(
                      [
                        { value: 'percent' as const, label: 'ลด %' },
                        { value: 'fixed' as const, label: 'ลด ฿' },
                      ] as const
                    ).map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          'rounded-lg font-bold',
                          editingCode.discountType === opt.value
                            ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-500'
                            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]',
                        )}
                        onClick={() => setEditingCode({ ...editingCode, discountType: opt.value })}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="promo-discount-value">
                      {editingCode.discountType === 'percent' ? 'เปอร์เซ็นต์ (%)' : 'จำนวนเงิน (฿)'}
                    </Label>
                    <Input
                      id="promo-discount-value"
                      type="number"
                      className={cn(inputClass, 'rounded-[10px]')}
                      value={editingCode.discountValue || ''}
                      onChange={(e) =>
                        setEditingCode({ ...editingCode, discountValue: Number(e.target.value) || 0 })
                      }
                      min={0}
                      max={editingCode.discountType === 'percent' ? 100 : 99999}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="promo-min-order">ยอดขั้นต่ำ (฿)</Label>
                    <Input
                      id="promo-min-order"
                      type="number"
                      className={cn(inputClass, 'rounded-[10px]')}
                      value={editingCode.minOrderAmount || ''}
                      onChange={(e) =>
                        setEditingCode({
                          ...editingCode,
                          minOrderAmount: Number(e.target.value) || undefined,
                        })
                      }
                      min={0}
                    />
                  </div>
                  {editingCode.discountType === 'percent' && (
                    <div className="space-y-2">
                      <Label htmlFor="promo-max-discount">ลดสูงสุด (฿)</Label>
                      <Input
                        id="promo-max-discount"
                        type="number"
                        className={cn(inputClass, 'rounded-[10px]')}
                        value={editingCode.maxDiscount || ''}
                        onChange={(e) =>
                          setEditingCode({
                            ...editingCode,
                            maxDiscount: Number(e.target.value) || undefined,
                          })
                        }
                        min={0}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="promo-usage-limit">จำนวนครั้งที่ใช้ได้ (0 = ไม่จำกัด)</Label>
                    <Input
                      id="promo-usage-limit"
                      type="number"
                      className={cn(inputClass, 'rounded-[10px]')}
                      value={editingCode.usageLimit ?? ''}
                      onChange={(e) =>
                        setEditingCode({
                          ...editingCode,
                          usageLimit:
                            e.target.value === '' || e.target.value === '0'
                              ? null
                              : Number(e.target.value),
                        })
                      }
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="promo-expires-at">วันหมดอายุ</Label>
                    <Input
                      id="promo-expires-at"
                      type="datetime-local"
                      className={cn(inputClass, 'rounded-[10px]')}
                      value={isoToLocalDatetime(editingCode.expiresAt)}
                      onChange={(e) =>
                        setEditingCode({
                          ...editingCode,
                          expiresAt: localDatetimeToIso(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    id="promo-enabled"
                    checked={editingCode.enabled}
                    onCheckedChange={(checked) => setEditingCode({ ...editingCode, enabled: checked })}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                  <Label htmlFor="promo-enabled" className="cursor-pointer">
                    เปิดใช้งาน
                  </Label>
                </div>
              </div>

              <DialogFooter className="gap-2 border-t border-[var(--border)] pt-4">
                <Button
                  variant="ghost"
                  className="rounded-[10px] text-[var(--muted-foreground)]"
                  onClick={() => setEditingCode(null)}
                  disabled={saving}
                >
                  ยกเลิก
                </Button>
                <Button
                  className={cn(gradientBtnClass, 'rounded-[10px]')}
                  onClick={() => handleSave(editingCode)}
                  disabled={saving}
                >
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});
