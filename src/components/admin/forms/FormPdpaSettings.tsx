'use client';

// Admin PDPA configuration panel for forms: notice details, retention, consent checkboxes, and presets.

import React from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  DEFAULT_FORM_PDPA,
  getFormAccess,
  getFormPdpa,
  type FormAccess,
  type FormPdpaConfig,
  type FormQuestion,
} from '@/lib/forms';

const RETENTION_PRESETS: Array<{ label: string; days: number | null }> = [
  { label: '90 วัน', days: 90 },
  { label: '180 วัน', days: 180 },
  { label: '1 ปี (365 วัน)', days: 365 },
  { label: '2 ปี (730 วัน)', days: 730 },
  { label: 'จนกว่าจะขอลบ', days: null },
];

const PDPA_TEMPLATES: Array<{ id: string; label: string; patch: Partial<FormPdpaConfig> }> = [
  {
    id: 'survey',
    label: 'สำรวจความคิดเห็นทั่วไป',
    patch: {
      purpose: 'เพื่อสำรวจความคิดเห็น วิเคราะห์ผลรวม และนำไปปรับปรุงกิจกรรมหรือบริการของชุมนุม',
      retentionDays: 365,
      requireConsent: true,
      allowWithdrawConsent: true,
    },
  },
  {
    id: 'event',
    label: 'ลงทะเบียนกิจกรรม / โครงการ',
    patch: {
      purpose: 'เพื่อตรวจสอบสิทธิ์ ยืนยันการเข้าร่วม ประสานงาน และจัดทำเอกสารหรือเกียรติบัตรสำหรับผู้เข้าร่วมกิจกรรม',
      retentionDays: 180,
      requireConsent: true,
      allowWithdrawConsent: true,
    },
  },
  {
    id: 'anonymous',
    label: 'ฟอร์มไม่ระบุตัวตน',
    patch: {
      purpose: 'เพื่อรวบรวมความคิดเห็นและผลโหวตโดยไม่เชื่อมโยงตัวตนผู้ตอบ',
      dataCollected: 'คำตอบที่ท่านระบุในแบบฟอร์ม (ไม่เก็บชื่อและอีเมล)',
      retentionDays: 365,
      requireConsent: true,
      allowWithdrawConsent: true,
    },
  },
];

function suggestDataCollected(access?: FormAccess, questions?: FormQuestion[]): string {
  const mode = getFormAccess({ access }).mode;
  const parts: string[] = mode === 'public' ? [] : ['ชื่อ-นามสกุล', 'อีเมลบัญชีผู้ใช้'];
  const qHints = (questions || [])
    .map((q) => q.title.trim())
    .filter((t) => /ชื่อ|อีเมล|email|เบอร์|โทร|phone|รหัส|คณะ|สาขา|ชั้นปี|ที่อยู่|line|ig|instagram|แพ้|อาหาร/i.test(t))
    .slice(0, 5);
  if (qHints.length > 0) {
    parts.push(`คำตอบในแบบฟอร์ม (เช่น ${qHints.join(', ')})`);
  } else {
    parts.push('คำตอบที่ท่านระบุในแบบฟอร์ม');
  }
  return parts.join(' และ ');
}

export default function FormPdpaSettings({
  pdpa: raw,
  access,
  questions,
  onChange,
}: {
  pdpa?: FormPdpaConfig;
  access?: FormAccess;
  questions?: FormQuestion[];
  onChange: (next: FormPdpaConfig) => void;
}) {
  const pdpa = raw ?? getFormPdpa(undefined);
  const update = (patch: Partial<FormPdpaConfig>) => onChange({ ...pdpa, ...patch });

  const isCustomRetention =
    pdpa.retentionDays !== null && !RETENTION_PRESETS.some((p) => p.days === pdpa.retentionDays);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/35 px-3.5 py-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <p className="text-[0.88rem] font-bold text-foreground">การแจ้งและเก็บความยินยอม PDPA</p>
            <p className="text-[0.75rem] text-muted-foreground">
              แสดงรายละเอียดตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคลฯ พร้อมบันทึกหลักฐานการยินยอมและวันหมดอายุข้อมูลต่อคำตอบ
            </p>
          </div>
        </div>
        <Switch
          checked={pdpa.enabled}
          onCheckedChange={(v) => onChange({ ...DEFAULT_FORM_PDPA, ...pdpa, enabled: Boolean(v) })}
          aria-label="เปิดใช้งาน PDPA สำหรับฟอร์ม"
        />
      </div>

      {pdpa.enabled && (
        <div className="flex flex-col gap-4">
          {/* Display mode */}
          <div>
            <Label className="mb-1.5 block text-[0.78rem]">รูปแบบการแสดงประกาศ PDPA ก่อนกรอกฟอร์ม</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ['popup', 'แสดงแบบหน้าต่าง Popup (แนะนำ)', 'เปิดหน้าต่างชี้แจงวัตถุประสงค์และกดยินยอมก่อนเข้าทำแบบฟอร์ม'],
                ['inline', 'แสดงเป็นกล่องด้านบนหน้าฟอร์ม', 'แสดงประกาศและช่องยินยอมบนหน้าฟอร์มก่อนคำถามข้อแรก'],
              ] as const).map(([mode, label, hint]) => {
                const active = (pdpa.displayMode || 'popup') === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => update({ displayMode: mode })}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left transition-colors',
                      active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted/50',
                    )}
                  >
                    <span className="block text-[0.8rem] font-bold text-foreground">{label}</span>
                    <span className="block text-[0.72rem] text-muted-foreground">{hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick templates */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 text-[0.75rem] font-semibold text-muted-foreground">
              <Sparkles size={13} /> เทมเพลตด่วน:
            </span>
            {PDPA_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => update(tpl.patch)}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-[0.73rem] font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                {tpl.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-[0.78rem]">ผู้ควบคุมข้อมูล / หน่วยงานผู้จัดเก็บ</Label>
              <Input
                value={pdpa.controllerName}
                maxLength={200}
                onChange={(e) => update({ controllerName: e.target.value })}
                placeholder="เช่น ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ ม.อ."
              />
            </div>
            <div>
              <Label className="mb-1 block text-[0.78rem]">เวอร์ชันนโยบาย</Label>
              <Input
                value={pdpa.version}
                maxLength={30}
                onChange={(e) => update({ version: e.target.value })}
                placeholder="1.0"
              />
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-[0.78rem]">วัตถุประสงค์ในการเก็บรวบรวมและใช้ข้อมูล</Label>
            <Textarea
              value={pdpa.purpose}
              maxLength={2500}
              rows={4}
              onChange={(e) => update({ purpose: e.target.value })}
              placeholder="อธิบายว่าจะนำข้อมูลจากแบบฟอร์มนี้ไปใช้ทำอะไรบ้าง"
            />
          </div>

          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <Label className="text-[0.78rem]">รายการข้อมูลส่วนบุคคลที่จัดเก็บ</Label>
              <button
                type="button"
                onClick={() => update({ dataCollected: suggestDataCollected(access, questions) })}
                className="text-[0.72rem] font-semibold text-primary hover:underline"
              >
                เติมอัตโนมัติจากคำถามและการเข้าถึง
              </button>
            </div>
            <Textarea
              value={pdpa.dataCollected}
              maxLength={800}
              rows={2}
              onChange={(e) => update({ dataCollected: e.target.value })}
              placeholder="เช่น ชื่อ-นามสกุล อีเมล และคำตอบในแบบฟอร์ม"
            />
          </div>

          {/* Retention */}
          <div>
            <Label className="mb-1.5 block text-[0.78rem]">ระยะเวลาเก็บรักษาข้อมูล (ลบอัตโนมัติเมื่อครบกำหนด)</Label>
            <div className="flex flex-wrap gap-1.5">
              {RETENTION_PRESETS.map((p) => {
                const active = pdpa.retentionDays === p.days && !isCustomRetention;
                return (
                  <button
                    key={String(p.days)}
                    type="button"
                    onClick={() => update({ retentionDays: p.days })}
                    className={cn(
                      'rounded-lg border px-2.5 py-1.5 text-[0.78rem] font-semibold transition-colors',
                      active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={isCustomRetention ? String(pdpa.retentionDays) : ''}
                  placeholder="กำหนดวัน"
                  aria-label="กำหนดระยะเวลาเก็บรักษา (วัน)"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    update({ retentionDays: n > 0 ? Math.min(3650, Math.round(n)) : null });
                  }}
                  className="h-8 w-24 text-[0.8rem]"
                />
                <span className="text-[0.75rem] text-muted-foreground">วัน</span>
              </div>
            </div>
            <Input
              value={pdpa.retentionNote || ''}
              maxLength={200}
              onChange={(e) => update({ retentionNote: e.target.value })}
              placeholder="หมายเหตุระยะเวลาเพิ่มเติม (ไม่บังคับ) เช่น หลังจบโครงการ 30 วัน"
              className="mt-2 h-9 text-[0.82rem]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-[0.78rem]">อีเมล / ช่องทางติดต่อ DPO</Label>
              <Input
                value={pdpa.contactEmail}
                maxLength={200}
                onChange={(e) => update({ contactEmail: e.target.value })}
                placeholder="psuscc@psuscc.club"
              />
            </div>
            <div>
              <Label className="mb-1 block text-[0.78rem]">ลิงก์นโยบายความเป็นส่วนตัว</Label>
              <Input
                value={pdpa.privacyPolicyUrl}
                maxLength={300}
                onChange={(e) => update({ privacyPolicyUrl: e.target.value })}
                placeholder="/privacy"
              />
            </div>
          </div>

          {/* Consent checkboxes configuration */}
          <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-muted/25 p-3.5">
            <label className="flex cursor-pointer items-center justify-between gap-3 text-[0.84rem]">
              <span>
                <span className="font-semibold">บังคับให้กดยินยอมก่อนส่งคำตอบ</span>
                <span className="block text-[0.72rem] text-muted-foreground">ผู้ตอบต้องติ๊กยินยอมจึงจะกดส่งฟอร์มได้</span>
              </span>
              <Switch checked={pdpa.requireConsent} onCheckedChange={(v) => update({ requireConsent: Boolean(v) })} />
            </label>

            {pdpa.requireConsent && (
              <div>
                <Label className="mb-1 block text-[0.75rem] text-muted-foreground">ข้อความช่องกดยินยอมหลัก</Label>
                <Textarea
                  value={pdpa.consentText}
                  maxLength={500}
                  rows={2}
                  onChange={(e) => update({ consentText: e.target.value })}
                  className="bg-card text-[0.83rem]"
                />
              </div>
            )}

            <label className="mt-1 flex cursor-pointer items-center justify-between gap-3 border-t border-border/70 pt-2.5 text-[0.84rem]">
              <span>
                <span className="font-semibold">เพิ่มช่องยินยอมรับข่าวสาร/กิจกรรมเพิ่มเติม (ไม่บังคับ)</span>
                <span className="block text-[0.72rem] text-muted-foreground">แยกเก็บความยินยอมด้านการประชาสัมพันธ์ออกจากวัตถุประสงค์หลัก</span>
              </span>
              <Switch
                checked={pdpa.marketingConsentEnabled}
                onCheckedChange={(v) => update({ marketingConsentEnabled: Boolean(v) })}
              />
            </label>

            {pdpa.marketingConsentEnabled && (
              <div>
                <Label className="mb-1 block text-[0.75rem] text-muted-foreground">ข้อความช่องยินยอมข่าวสารเพิ่มเติม</Label>
                <Input
                  value={pdpa.marketingConsentText}
                  maxLength={400}
                  onChange={(e) => update({ marketingConsentText: e.target.value })}
                  className="bg-card text-[0.83rem]"
                />
              </div>
            )}

            <label className="mt-1 flex cursor-pointer items-center justify-between gap-3 border-t border-border/70 pt-2.5 text-[0.84rem]">
              <span>
                <span className="font-semibold">อนุญาตให้ผู้ตอบถอนความยินยอมและลบคำตอบเองได้</span>
                <span className="block text-[0.72rem] text-muted-foreground">แสดงปุ่มถอนความยินยอมหลังส่งคำตอบ (ตามสิทธิ์ PDPA)</span>
              </span>
              <Switch
                checked={pdpa.allowWithdrawConsent}
                onCheckedChange={(v) => update({ allowWithdrawConsent: Boolean(v) })}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
