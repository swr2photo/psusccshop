'use client';

import React from 'react';
import { Users, Shirt } from 'lucide-react';
import type { ShirtNameConfig } from '@/lib/config';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-[0.9rem] font-medium text-[var(--foreground)]">{label}</p>
        {description && (
          <p className="text-xs text-[var(--text-muted)]">{description}</p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-emerald-500"
      />
    </div>
  );
}

interface ShirtNameConfigFieldsProps {
  value: ShirtNameConfig;
  onChange: (next: ShirtNameConfig) => void;
  compact?: boolean;
}

export default function ShirtNameConfigFields({ value, onChange, compact }: ShirtNameConfigFieldsProps) {
  const update = (patch: Partial<ShirtNameConfig>) => onChange({ ...value, ...patch });

  return (
    <div className={cn('flex flex-col', compact ? 'gap-3' : 'gap-4')}>
      <div className="flex gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="shirt-min-length">ความยาวขั้นต่ำ</Label>
          <Input
            id="shirt-min-length"
            type="number"
            value={value.minLength}
            onChange={(e) => update({ minLength: Math.max(1, Number(e.target.value) || 1) })}
            min={1}
            max={50}
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="shirt-max-length">ความยาวสูงสุด</Label>
          <Input
            id="shirt-max-length"
            type="number"
            value={value.maxLength}
            onChange={(e) => update({ maxLength: Math.max(value.minLength, Number(e.target.value) || 7) })}
            min={value.minLength}
            max={50}
          />
        </div>
      </div>

      <div className="rounded-[10px] border border-indigo-500/20 bg-indigo-500/[0.08] p-3">
        <p className="mb-2 flex items-center gap-1 text-[0.8rem] font-bold text-indigo-400">
          <Users size={14} /> ภาษาที่อนุญาต
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'allowThai' as const, label: 'ภาษาไทย', color: '#0071e3' },
            { key: 'allowEnglish' as const, label: 'English', color: '#10b981' },
          ].map((lang) => (
            <button
              key={lang.key}
              type="button"
              onClick={() => {
                if (value[lang.key] && !(lang.key === 'allowThai' ? value.allowEnglish : value.allowThai)) return;
                update({ [lang.key]: !value[lang.key] });
              }}
              className="cursor-pointer rounded-lg border-[1.5px] px-3 py-1.5 text-[0.8rem] font-semibold transition-all"
              style={{
                backgroundColor: value[lang.key] ? `${lang.color}15` : 'var(--surface-2)',
                color: value[lang.key] ? lang.color : 'var(--text-muted)',
                borderColor: value[lang.key] ? lang.color : 'var(--glass-border)',
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <ToggleRow
        label="แปลงเป็นตัวพิมพ์ใหญ่อัตโนมัติ"
        description={value.autoUppercase ? 'john → JOHN' : 'ปิดใช้งาน'}
        checked={value.autoUppercase}
        onChange={(checked) => update({ autoUppercase: checked })}
      />

      <ToggleRow
        label="อนุญาตอักษรพิเศษ"
        description={value.allowSpecialChars ? `ตัวอักษรที่อนุญาต: ${value.allowedSpecialChars}` : 'ปิดใช้งาน'}
        checked={value.allowSpecialChars}
        onChange={(checked) => update({ allowSpecialChars: checked })}
      />

      {value.allowSpecialChars && (
        <div className="space-y-1.5">
          <Label htmlFor="shirt-special-chars">อักษรพิเศษที่อนุญาต</Label>
          <Input
            id="shirt-special-chars"
            value={value.allowedSpecialChars}
            onChange={(e) => update({ allowedSpecialChars: e.target.value })}
            placeholder=".-"
          />
        </div>
      )}

      <div className="rounded-[10px] border border-emerald-500/20 bg-emerald-500/[0.08] p-2.5">
        <p className="mb-1 flex items-center gap-1 text-[0.72rem] font-semibold text-emerald-500">
          <Shirt size={13} /> ตัวอย่างที่ใช้ได้
        </p>
        <p className="text-[0.78rem] text-[var(--text-muted)]">
          {[
            value.allowEnglish && (value.autoUppercase ? 'JOHN' : 'John'),
            value.allowThai && 'สมชาย',
            value.allowSpecialChars && (value.allowEnglish ? `O${value.allowedSpecialChars[0] || '.'}BRIEN` : `สม${value.allowedSpecialChars[0] || '.'}ชาย`),
          ].filter(Boolean).join(' / ')}
          {` (${value.minLength}-${value.maxLength} ตัว)`}
        </p>
      </div>
    </div>
  );
}
