'use client';

// "Who can answer" settings: sign-in required (optionally by email domain / invite list) or public & anonymous.

import React, { useState } from 'react';
import { AtSign, Globe, Info, Lock, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getFormAccess, normalizeDomain, normalizeEmail, type FormAccess } from '@/lib/forms';

const DOMAIN_SUGGESTIONS = ['psu.ac.th', 'email.psu.ac.th', 'gmail.com'];

export default function FormAccessSettings({ access: raw, onChange }: { access?: FormAccess; onChange: (a: FormAccess) => void }) {
  const access = getFormAccess({ access: raw });
  const [domainDraft, setDomainDraft] = useState('');
  const [emailsDraft, setEmailsDraft] = useState(access.allowedEmails.join('\n'));
  const [domainError, setDomainError] = useState('');

  const addDomain = (value: string) => {
    const d = normalizeDomain(value);
    if (!d) { setDomainError('รูปแบบโดเมนไม่ถูกต้อง เช่น psu.ac.th'); return; }
    setDomainError('');
    if (!access.allowedDomains.includes(d)) onChange({ ...access, allowedDomains: [...access.allowedDomains, d] });
    setDomainDraft('');
  };

  const parsedEmails = emailsDraft.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
  const invalidEmails = parsedEmails.filter((e) => !normalizeEmail(e));

  const commitEmails = (text: string) => {
    setEmailsDraft(text);
    const valid = Array.from(new Set(text.split(/[\s,;]+/).map(normalizeEmail).filter(Boolean)));
    onChange({ ...access, allowedEmails: valid });
  };

  const restricted = access.allowedDomains.length > 0 || access.allowedEmails.length > 0;

  return (
    <div>
      <p className="mb-2 text-[0.8rem] font-semibold">ใครตอบได้บ้าง</p>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        {([
          ['login', Lock, 'ต้องเข้าสู่ระบบ', 'ตอบได้ 1 ครั้งต่อบัญชี เห็นชื่อ/อีเมลผู้ตอบ'],
          ['public', Globe, 'ไม่ต้องเข้าสู่ระบบ', 'ใครก็ตอบได้ ไม่เก็บชื่อหรืออีเมล'],
        ] as const).map(([mode, Icon, label, hint]) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange({ ...access, mode })}
            className={cn('flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors', access.mode === mode ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60')}
          >
            <Icon size={16} className={cn('mt-0.5 shrink-0', access.mode === mode ? 'text-primary' : 'text-muted-foreground')} />
            <span>
              <span className="block text-[0.85rem] font-bold">{label}</span>
              <span className="block text-[0.72rem] text-muted-foreground">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      {access.mode === 'public' ? (
        <p className="flex items-start gap-1.5 rounded-xl bg-warning/10 px-3 py-2.5 text-[0.75rem] text-warning">
          <Info size={14} className="mt-0.5 shrink-0" />
          จำกัด 1 คำตอบต่อเบราว์เซอร์ (ผ่านคุกกี้) — คนที่ล้างคุกกี้หรือเปลี่ยนเครื่องตอบซ้ำได้ ไม่เหมาะกับโหวตที่ต้องการผลแม่นยำ
        </p>
      ) : (
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[0.8rem] font-semibold"><AtSign size={14} /> จำกัดโดเมนอีเมล <span className="font-normal text-muted-foreground">(ว่าง = ทุกบัญชี)</span></p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {access.allowedDomains.map((d) => (
              <span key={d} className="inline-flex items-center gap-1 rounded-full bg-primary/12 py-1 pr-1 pl-2.5 text-[0.78rem] font-semibold text-primary">
                @{d}
                <button type="button" aria-label={`ลบ @${d}`} onClick={() => onChange({ ...access, allowedDomains: access.allowedDomains.filter((x) => x !== d) })} className="grid size-5 place-items-center rounded-full hover:bg-primary/20">
                  <X size={12} />
                </button>
              </span>
            ))}
            {DOMAIN_SUGGESTIONS.filter((d) => !access.allowedDomains.includes(d)).map((d) => (
              <button key={d} type="button" onClick={() => addDomain(d)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-[0.75rem] text-muted-foreground hover:border-primary/50 hover:text-primary">
                <Plus size={11} /> @{d}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={domainDraft}
              onChange={(e) => { setDomainDraft(e.target.value); setDomainError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (domainDraft.trim()) addDomain(domainDraft); } }}
              placeholder="พิมพ์โดเมนอื่น เช่น @eng.psu.ac.th"
              aria-label="เพิ่มโดเมนอีเมล"
              aria-invalid={domainError ? true : undefined}
              className="h-9 bg-card"
            />
            <Button type="button" variant="outline" className="h-9" disabled={!domainDraft.trim()} onClick={() => addDomain(domainDraft)}>เพิ่ม</Button>
          </div>
          {domainError && <p className="mt-1 text-[0.72rem] text-destructive">{domainError}</p>}
          <p className="mt-1 text-[0.7rem] text-muted-foreground">โดเมนย่อยผ่านด้วย เช่น @psu.ac.th รับ @email.psu.ac.th</p>

          <p className="mt-4 mb-1.5 text-[0.8rem] font-semibold">อีเมลที่อนุญาตเพิ่มเติม <span className="font-normal text-muted-foreground">(ไม่บังคับ · บรรทัดละ 1 อีเมล)</span></p>
          <Textarea
            value={emailsDraft}
            onChange={(e) => commitEmails(e.target.value)}
            rows={3}
            placeholder={'เช่น\nadvisor@gmail.com\nstaff@psu.ac.th'}
            aria-label="อีเมลที่อนุญาต"
            className="bg-card font-mono text-[0.8rem]"
          />
          <p className={cn('mt-1 text-[0.7rem]', invalidEmails.length ? 'text-destructive' : 'text-muted-foreground')}>
            {invalidEmails.length
              ? `อีเมลไม่ถูกต้อง ${invalidEmails.length} รายการ จะไม่ถูกบันทึก: ${invalidEmails.slice(0, 3).join(', ')}`
              : `${access.allowedEmails.length} อีเมล · รายชื่อนี้ไม่แสดงให้ผู้ตอบเห็น`}
          </p>

          <p className="mt-3 rounded-lg bg-card px-3 py-2 text-[0.75rem] text-muted-foreground">
            {restricted
              ? `ตอบได้เฉพาะ ${[...access.allowedDomains.map((d) => `@${d}`), ...(access.allowedEmails.length ? [`อีเมลในรายชื่อ ${access.allowedEmails.length} คน`] : [])].join(' หรือ ')}`
              : 'ทุกบัญชีที่เข้าสู่ระบบตอบได้'}
          </p>
        </div>
      )}
    </div>
  );
}
