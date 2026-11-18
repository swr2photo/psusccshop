'use client';

// Respondent PDPA notice & consent capture — supports formal pre-form modal popup or inline card.

import React, { useState } from 'react';
import { AlertCircle, Check, ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatRetentionLabel, type FormPdpaConfig } from '@/lib/forms';

interface Props {
  pdpa: FormPdpaConfig;
  formTitle?: string;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  marketingAccepted: boolean;
  onMarketingAcceptedChange: (accepted: boolean) => void;
  disabled?: boolean;
  missing?: boolean;
  /** Number of questions waiting to unlock once PDPA consent is given */
  lockedQuestionCount?: number;
}

function ConsentCheckboxRow({
  checked,
  onToggle,
  label,
  required,
  disabled,
  invalid,
  hint,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'group flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-[0.86rem] leading-6 transition-colors outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50',
        checked
          ? 'border-primary bg-primary/8 text-foreground'
          : invalid
            ? 'border-destructive/70 bg-destructive/5 text-foreground'
            : 'border-border bg-background/60 hover:border-primary/50',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-1 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/45 group-hover:border-primary/70',
        )}
      >
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium break-words">
          {label}
          {required ? (
            <span className="ml-1 text-destructive" aria-label="จำเป็นต้องยินยอม">*</span>
          ) : (
            <span className="ml-1.5 text-[0.75rem] font-normal text-muted-foreground">(ไม่บังคับ)</span>
          )}
        </span>
        {hint && <span className="mt-0.5 block text-[0.74rem] text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );
}

function PdpaDetailsBlock({ pdpa }: { pdpa: FormPdpaConfig }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-border bg-muted/35 p-3.5">
        <p className="mb-1 text-[0.8rem] font-bold text-foreground">1. วัตถุประสงค์ในการเก็บรวบรวมและใช้ข้อมูล</p>
        <p className="text-[0.82rem] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
          {pdpa.purpose}
        </p>
      </div>

      <dl className="grid gap-2.5 rounded-xl border border-border/80 bg-muted/20 p-3.5 text-[0.81rem] leading-relaxed">
        <div>
          <dt className="font-bold text-foreground">2. ข้อมูลส่วนบุคคลที่จัดเก็บ</dt>
          <dd className="mt-0.5 whitespace-pre-wrap break-words text-muted-foreground">{pdpa.dataCollected}</dd>
        </div>
        <div>
          <dt className="font-bold text-foreground">3. ผู้ควบคุมข้อมูลส่วนบุคคล</dt>
          <dd className="mt-0.5 break-words text-muted-foreground">{pdpa.controllerName}</dd>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <dt className="font-bold text-foreground">4. ระยะเวลาการเก็บรักษา</dt>
            <dd className="mt-0.5 text-muted-foreground">{formatRetentionLabel(pdpa.retentionDays, pdpa.retentionNote)}</dd>
          </div>
          <div>
            <dt className="font-bold text-foreground">5. ติดต่อขอใช้สิทธิ์ / DPO</dt>
            <dd className="mt-0.5 break-words text-muted-foreground">{pdpa.contactEmail}</dd>
          </div>
        </div>
        <div className="border-t border-border/70 pt-2">
          <p className="text-[0.76rem] leading-relaxed text-muted-foreground">
            ท่านมีสิทธิ์ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ในการขอเข้าถึง ขอรับสำเนา ขอแก้ไข ขอถอนความยินยอม หรือขอลบข้อมูลส่วนบุคคลของท่านได้ตามที่กฎหมายกำหนด
          </p>
          {pdpa.privacyPolicyUrl && (
            <a
              href={pdpa.privacyPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[0.78rem] font-semibold text-primary underline-offset-4 hover:underline"
            >
              ศึกษานโยบายความเป็นส่วนตัวฉบับเต็ม <ExternalLink size={12} />
            </a>
          )}
        </div>
      </dl>
    </div>
  );
}

export default function FormPdpaConsentBox({
  pdpa,
  formTitle,
  accepted,
  onAcceptedChange,
  marketingAccepted,
  onMarketingAcceptedChange,
  disabled,
  missing,
  lockedQuestionCount,
}: Props) {
  const isPopup = pdpa.displayMode !== 'inline';
  const [modalOpen, setModalOpen] = useState(() => isPopup && !accepted);
  const [noticeAcknowledged, setNoticeAcknowledged] = useState(false);
  const [draftAccepted, setDraftAccepted] = useState(accepted);
  const [draftMarketing, setDraftMarketing] = useState(marketingAccepted);

  if (!pdpa.enabled) return null;
  const flagged = Boolean(missing && pdpa.requireConsent && !accepted);
  const locked = Boolean(pdpa.requireConsent && !accepted);

  if (isPopup) {
    const openModal = () => {
      setDraftAccepted(accepted);
      setDraftMarketing(marketingAccepted);
      setModalOpen(true);
    };

    const confirmPopup = () => {
      if (pdpa.requireConsent && !draftAccepted) return;
      onAcceptedChange(true);
      if (pdpa.marketingConsentEnabled) onMarketingAcceptedChange(draftMarketing);
      setNoticeAcknowledged(true);
      setModalOpen(false);
    };

    return (
      <>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent
            className="max-h-[90dvh] flex flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-xl"
            onInteractOutside={(e) => {
              if (locked) e.preventDefault();
            }}
          >
            <DialogHeader className="border-b border-border px-5 pt-5 pb-3.5 text-left">
              <DialogTitle className="flex items-center gap-2 text-[1.02rem] font-bold">
                <ShieldCheck size={18} className="shrink-0 text-primary" />
                ประกาศชี้แจงวัตถุประสงค์และการคุ้มครองข้อมูลส่วนบุคคล (PDPA)
              </DialogTitle>
              <DialogDescription className="text-[0.8rem] text-muted-foreground">
                {formTitle ? `${formTitle} · ` : ''}ฉบับที่ {pdpa.version}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4">
              <PdpaDetailsBlock pdpa={pdpa} />

              <div className="flex flex-col gap-2">
                {pdpa.requireConsent ? (
                  <ConsentCheckboxRow
                    checked={draftAccepted}
                    onToggle={() => setDraftAccepted((v) => !v)}
                    label={pdpa.consentText}
                    required
                    disabled={disabled}
                    hint={pdpa.allowWithdrawConsent ? 'ท่านสามารถถอนความยินยอมและขอลบข้อมูลได้ภายหลัง' : undefined}
                  />
                ) : (
                  <p className="text-[0.8rem] leading-relaxed text-muted-foreground">
                    การกดดำเนินการต่อถือว่าท่านได้รับทราบวัตถุประสงค์และรายละเอียดการคุ้มครองข้อมูลส่วนบุคคลข้างต้นแล้ว
                  </p>
                )}

                {pdpa.marketingConsentEnabled && (
                  <ConsentCheckboxRow
                    checked={draftMarketing}
                    onToggle={() => setDraftMarketing((v) => !v)}
                    label={pdpa.marketingConsentText}
                    disabled={disabled}
                  />
                )}
              </div>
            </div>

            <DialogFooter className="border-t border-border bg-muted/20 px-5 py-3.5 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="rounded-xl"
              >
                {accepted || (!pdpa.requireConsent && noticeAcknowledged) ? 'ปิด' : 'ปิดหน้าต่างนี้'}
              </Button>
              <Button
                type="button"
                disabled={disabled || (pdpa.requireConsent && !draftAccepted)}
                onClick={confirmPopup}
                className="rounded-xl font-bold"
              >
                {accepted ? 'บันทึกการตั้งค่าความยินยอม' : 'รับทราบและเข้าสู่แบบฟอร์ม'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <section
          id="pdpa-consent"
          tabIndex={-1}
          className={cn(
            'scroll-mt-28 rounded-2xl border bg-card transition-all outline-none',
            flagged ? 'border-destructive/70 ring-4 ring-destructive/10' : 'border-border',
          )}
        >
          {locked ? (
            <div className="p-5 sm:p-6">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-[0.98rem] font-bold text-foreground">
                  <ShieldCheck size={18} className="shrink-0 text-primary" />
                  ประกาศชี้แจงวัตถุประสงค์และข้อตกลง PDPA
                </h3>
                <span className="text-[0.72rem] font-medium text-muted-foreground">เวอร์ชัน {pdpa.version}</span>
              </div>
              <p className="mb-3 text-[0.84rem] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {pdpa.purpose}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={openModal} className="rounded-xl font-bold">
                  <FileText size={15} /> อ่านรายละเอียดและกดยินยอมเพื่อเริ่มทำแบบฟอร์ม
                </Button>
                <span className="text-[0.78rem] text-muted-foreground">
                  {lockedQuestionCount ? `คำถาม ${lockedQuestionCount} ข้อจะเปิดหลังจากยืนยันความยินยอม` : 'ต้องกดยินยอมก่อนกรอกแบบฟอร์ม'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <p className="flex items-center gap-2 text-[0.82rem] font-medium text-foreground">
                <ShieldCheck size={16} className="shrink-0 text-primary" />
                <span>
                  รับทราบวัตถุประสงค์และให้ความยินยอม PDPA (เวอร์ชัน {pdpa.version}) แล้ว
                </span>
              </p>
              <Button type="button" variant="outline" size="sm" onClick={openModal} className="h-8 rounded-lg text-[0.76rem]">
                ดูรายละเอียดประกาศ PDPA
              </Button>
            </div>
          )}
        </section>
      </>
    );
  }

  return (
    <section
      id="pdpa-consent"
      tabIndex={-1}
      className={cn(
        'scroll-mt-28 rounded-2xl border bg-card p-5 transition-all outline-none sm:p-6',
        flagged ? 'border-destructive/70 ring-4 ring-destructive/10' : 'border-border',
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[0.98rem] font-bold text-foreground">
          <ShieldCheck size={18} className="shrink-0 text-primary" />
          การคุ้มครองข้อมูลส่วนบุคคล (PDPA)
        </h3>
        <span className="text-[0.72rem] font-medium text-muted-foreground">
          เวอร์ชัน {pdpa.version}
        </span>
      </div>

      <div className="mb-4">
        <PdpaDetailsBlock pdpa={pdpa} />
      </div>

      <div className="flex flex-col gap-2.5">
        {pdpa.requireConsent ? (
          <ConsentCheckboxRow
            checked={accepted}
            onToggle={() => onAcceptedChange(!accepted)}
            label={pdpa.consentText}
            required
            disabled={disabled}
            invalid={flagged}
            hint={pdpa.allowWithdrawConsent ? 'ท่านสามารถถอนความยินยอมและขอลบข้อมูลได้ภายหลัง' : undefined}
          />
        ) : (
          <p className="text-[0.8rem] leading-relaxed text-muted-foreground">
            การส่งคำตอบถือว่าท่านได้รับทราบรายละเอียดการเก็บรวบรวมและใช้ข้อมูลส่วนบุคคลข้างต้นแล้ว
          </p>
        )}

        {pdpa.marketingConsentEnabled && (
          <ConsentCheckboxRow
            checked={marketingAccepted}
            onToggle={() => onMarketingAcceptedChange(!marketingAccepted)}
            label={pdpa.marketingConsentText}
            disabled={disabled}
          />
        )}
      </div>

      {locked && !flagged && (
        <p className="mt-3 text-[0.8rem] text-muted-foreground">
          กรุณากดยืนยันความยินยอมด้านบนเพื่อเปิดคำถาม{lockedQuestionCount ? ` (${lockedQuestionCount} ข้อ)` : ''} และเริ่มกรอกแบบฟอร์ม
        </p>
      )}

      {flagged && (
        <p className="mt-3 flex items-center gap-1.5 text-[0.8rem] font-semibold text-destructive">
          <AlertCircle size={14} /> กรุณากดยืนยันความยินยอม PDPA ก่อนส่งคำตอบ
        </p>
      )}
    </section>
  );
}
