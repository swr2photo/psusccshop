'use client';

import React from 'react';
import { Box, Typography, TextField, Switch } from '@mui/material';
import { Users, Shirt } from 'lucide-react';
import type { ShirtNameConfig } from '@/lib/config';
import { ADMIN_THEME, adminInputSx as inputSx } from '@/lib/adminTheme';

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
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
      <Box>
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 500, color: ADMIN_THEME.text }}>{label}</Typography>
        {description && (
          <Typography sx={{ fontSize: '0.75rem', color: ADMIN_THEME.muted }}>{description}</Typography>
        )}
      </Box>
      <Switch
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        sx={{
          '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' },
          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#10b981' },
        }}
      />
    </Box>
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 1.5 : 2 }}>
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <TextField
          type="number"
          label="ความยาวขั้นต่ำ"
          value={value.minLength}
          onChange={(e) => update({ minLength: Math.max(1, Number(e.target.value) || 1) })}
          inputProps={{ min: 1, max: 50 }}
          size="small"
          sx={{ flex: 1, ...inputSx }}
        />
        <TextField
          type="number"
          label="ความยาวสูงสุด"
          value={value.maxLength}
          onChange={(e) => update({ maxLength: Math.max(value.minLength, Number(e.target.value) || 7) })}
          inputProps={{ min: value.minLength, max: 50 }}
          size="small"
          sx={{ flex: 1, ...inputSx }}
        />
      </Box>

      <Box sx={{
        p: 1.5,
        borderRadius: '10px',
        bgcolor: 'rgba(99,102,241,0.08)',
        border: '1px solid rgba(99,102,241,0.2)',
      }}>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#818cf8', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Users size={14} /> ภาษาที่อนุญาต
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {[
            { key: 'allowThai' as const, label: 'ภาษาไทย', color: '#0071e3' },
            { key: 'allowEnglish' as const, label: 'English', color: '#10b981' },
          ].map((lang) => (
            <Box
              key={lang.key}
              onClick={() => {
                if (value[lang.key] && !(lang.key === 'allowThai' ? value.allowEnglish : value.allowThai)) return;
                update({ [lang.key]: !value[lang.key] });
              }}
              sx={{
                px: 1.5,
                py: 0.75,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                bgcolor: value[lang.key] ? `${lang.color}15` : ADMIN_THEME.glassSoft,
                color: value[lang.key] ? lang.color : ADMIN_THEME.muted,
                border: `1.5px solid ${value[lang.key] ? lang.color : ADMIN_THEME.border}`,
              }}
            >
              {lang.label}
            </Box>
          ))}
        </Box>
      </Box>

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
        <TextField
          label="อักษรพิเศษที่อนุญาต"
          value={value.allowedSpecialChars}
          onChange={(e) => update({ allowedSpecialChars: e.target.value })}
          placeholder=".-"
          size="small"
          fullWidth
          sx={inputSx}
        />
      )}

      <Box sx={{
        p: 1.25,
        borderRadius: '10px',
        bgcolor: 'rgba(16,185,129,0.08)',
        border: '1px solid rgba(16,185,129,0.2)',
      }}>
        <Typography sx={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Shirt size={13} /> ตัวอย่างที่ใช้ได้
        </Typography>
        <Typography sx={{ fontSize: '0.78rem', color: ADMIN_THEME.muted }}>
          {[
            value.allowEnglish && (value.autoUppercase ? 'JOHN' : 'John'),
            value.allowThai && 'สมชาย',
            value.allowSpecialChars && (value.allowEnglish ? `O${value.allowedSpecialChars[0] || '.'}BRIEN` : `สม${value.allowedSpecialChars[0] || '.'}ชาย`),
          ].filter(Boolean).join(' / ')}
          {` (${value.minLength}-${value.maxLength} ตัว)`}
        </Typography>
      </Box>
    </Box>
  );
}
