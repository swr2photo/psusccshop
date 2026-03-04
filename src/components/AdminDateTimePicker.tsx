'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';

// ==================== ADMIN DATE-TIME PICKER ====================
// Wraps shadcn Calendar with time input, popover UX, styled for admin

interface AdminDateTimePickerProps {
  value: string;                  // datetime-local format "YYYY-MM-DDTHH:MM" or ISO
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
  color?: string;                 // accent color
  icon?: React.ReactNode;
  disabled?: boolean;
  clearable?: boolean;
}

/** Convert datetime-local / ISO to Date */
function parseToDate(val: string): Date | undefined {
  if (!val) return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
}

/** Convert Date + time parts back to datetime-local format */
function toDateTimeLocal(date: Date, hours: number, minutes: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

/** Format display string */
function formatDisplay(val: string): string {
  const d = parseToDate(val);
  if (!d) return '';
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export default function AdminDateTimePicker({
  value,
  onChange,
  label,
  placeholder = 'เลือกวันที่...',
  helperText,
  color = '#0071e3',
  icon,
  disabled = false,
  clearable = true,
}: AdminDateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parseToDate(value), [value]);
  const [hours, setHours] = useState(() => parsed ? parsed.getHours() : 9);
  const [minutes, setMinutes] = useState(() => parsed ? parsed.getMinutes() : 0);

  // Sync time from value changes
  useEffect(() => {
    if (parsed) {
      setHours(parsed.getHours());
      setMinutes(parsed.getMinutes());
    }
  }, [parsed]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return;
    onChange(toDateTimeLocal(day, hours, minutes));
  };

  const handleTimeChange = (h: number, m: number) => {
    setHours(h);
    setMinutes(m);
    if (parsed) {
      onChange(toDateTimeLocal(parsed, h, m));
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Label */}
      {label && (
        <div style={{
          fontSize: '0.85rem',
          color,
          marginBottom: 6,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          {icon}
          {label}
        </div>
      )}

      {/* Trigger Input */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 12,
          border: open ? `2px solid ${color}` : '1px solid var(--glass-border)',
          background: 'var(--surface)',
          color: value ? 'var(--foreground)' : 'var(--text-muted)',
          fontSize: '0.88rem',
          fontWeight: 500,
          fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textAlign: 'left',
          transition: 'all 0.2s ease',
          opacity: disabled ? 0.5 : 1,
          boxShadow: open ? `0 0 0 3px ${color}20` : 'none',
        }}
      >
        {/* Calendar icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>

        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value ? formatDisplay(value) : placeholder}
        </span>

        {/* Clear button */}
        {clearable && value && !disabled && (
          <span
            onClick={handleClear}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface-2)',
              cursor: 'pointer',
              flexShrink: 0,
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
            }}
          >
            ✕
          </span>
        )}
      </button>

      {helperText && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
          {helperText}
        </div>
      )}

      {/* Popover Calendar */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 9999,
            background: 'var(--surface)',
            border: '1px solid var(--glass-border)',
            borderRadius: 16,
            boxShadow: '0 12px 48px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.04)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            overflow: 'hidden',
            animation: 'fadeInScale 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
            minWidth: 300,
          }}
        >
          {/* Calendar */}
          <div style={{ padding: '8px 8px 0' }}>
            <Calendar
              mode="single"
              selected={parsed}
              onSelect={handleDaySelect}
              defaultMonth={parsed || new Date()}
              className="!bg-transparent"
            />
          </div>

          {/* Time Picker Row */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>เวลา</span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginLeft: 'auto',
            }}>
              <input
                type="number"
                min={0}
                max={23}
                value={String(hours).padStart(2, '0')}
                onChange={e => {
                  const h = Math.max(0, Math.min(23, parseInt(e.target.value) || 0));
                  handleTimeChange(h, minutes);
                }}
                style={{
                  width: 44,
                  padding: '6px 4px',
                  borderRadius: 8,
                  border: '1px solid var(--glass-border)',
                  background: 'var(--surface-2)',
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)' }}>:</span>
              <input
                type="number"
                min={0}
                max={59}
                value={String(minutes).padStart(2, '0')}
                onChange={e => {
                  const m = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                  handleTimeChange(hours, m);
                }}
                style={{
                  width: 44,
                  padding: '6px 4px',
                  borderRadius: 8,
                  border: '1px solid var(--glass-border)',
                  background: 'var(--surface-2)',
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Quick Time Presets */}
          <div style={{
            padding: '0 16px 12px',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}>
            {[
              { label: '00:00', h: 0, m: 0 },
              { label: '09:00', h: 9, m: 0 },
              { label: '12:00', h: 12, m: 0 },
              { label: '18:00', h: 18, m: 0 },
              { label: '23:59', h: 23, m: 59 },
            ].map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleTimeChange(preset.h, preset.m)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  border: hours === preset.h && minutes === preset.m
                    ? `1px solid ${color}`
                    : '1px solid var(--glass-border)',
                  background: hours === preset.h && minutes === preset.m
                    ? `${color}18`
                    : 'var(--surface-2)',
                  color: hours === preset.h && minutes === preset.m
                    ? color
                    : 'var(--text-muted)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Done Button */}
          <div style={{
            padding: '0 16px 12px',
          }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 12,
                border: 'none',
                background: color,
                color: 'white',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
                boxShadow: `0 3px 10px ${color}40`,
              }}
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
