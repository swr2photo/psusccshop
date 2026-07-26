import React from 'react';
import {
  Settings,
  Save,
  AlertTriangle as Warning,
  Store,
  Calendar as CalendarToday,
  User as Person,
  Users as Groups,
  CheckCircle,
  Zap as Bolt,
  Check,
  ShieldAlert as AdminPanelSettings,
  Shield,
  UserPlus as PersonAdd,
  Trash2 as Delete,
  Megaphone as Campaign,
  Package as Inventory,
  X as Close,
  RefreshCw,
  Target as Crosshair,
  CalendarDays,
  ShoppingBag as LocalMall,
  DollarSign as AttachMoney,
} from 'lucide-react';

import {
  ShopConfig,
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_NAME_VALIDATION,
  NameValidationConfig,
  AdminPermissions,
  SUPER_ADMIN_EMAIL,
} from '@/lib/config';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const glassCardClass =
  // overflow-visible so native datetime-local / select menus are not clipped
  'rounded-[20px] border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--foreground)] shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-[20px]';

const gradientBtnClass =
  'rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-500 font-bold text-white shadow-[0_4px_15px_rgba(139,92,246,0.3)] hover:opacity-90';

const inputClass = 'rounded-[10px]';

// ============== SETTINGS COMPONENTS ==============
const SettingSection = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <Card className={cn(glassCardClass, 'gap-0 py-0 shadow-none')}>
    <CardHeader className="flex flex-row items-center gap-4 border-b border-[var(--glass-border)] bg-gradient-to-br from-violet-500/5 to-blue-500/5 px-5 py-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white">
        {icon}
      </div>
      <CardTitle className="text-lg font-bold">{title}</CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-4 px-5 py-5">{children}</CardContent>
  </Card>
);

const SettingToggleRow = ({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) => (
  <div className="flex items-center justify-between py-1">
    <div>
      <p className="text-[0.95rem] font-medium text-[var(--foreground)]">{label}</p>
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

// ============== UTILITIES ==============
const extractSheetInfo = (input: string): { sheetId: string; sheetUrl: string } => {
  const value = (input || '').trim();
  if (!value) return { sheetId: '', sheetUrl: '' };
  const match = value.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const sheetId = match?.[1] || value;
  const sheetUrl = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}` : '';
  return { sheetId, sheetUrl };
};

type ToastSeverity = 'success' | 'error' | 'info' | 'warning';

interface SettingsViewProps {
  localConfig: ShopConfig;
  hasChanges: boolean;
  loading: boolean;
  lastSavedTime: Date | null;
  newAdminEmail: string;
  userEmail: string | null | undefined;
  sheetSyncing: boolean;
  isSuperAdminUser: boolean;
  onConfigChange: (newVal: ShopConfig) => void;
  onSave: () => void;
  onReset: () => void;
  onNewAdminEmailChange: (email: string) => void;
  showToast: (type: ToastSeverity, message: string) => void;
  triggerSheetSync: (action: 'sync' | 'create') => void;
  onImageUpload?: (file: File) => Promise<string | null>;
}

export const SettingsView = React.memo(function SettingsView({
  localConfig,
  hasChanges,
  loading,
  lastSavedTime,
  newAdminEmail,
  userEmail,
  sheetSyncing,
  isSuperAdminUser,
  onConfigChange,
  onSave,
  onReset,
  onNewAdminEmailChange,
  showToast,
  triggerSheetSync,
}: SettingsViewProps) {

  // Get admin permissions — isSuperAdminUser already comes from parent (server-validated)
  const hasCustomPerms = !!localConfig.adminPermissions?.[userEmail?.toLowerCase() ?? ''];
  const adminPerms = hasCustomPerms
    ? { ...DEFAULT_ADMIN_PERMISSIONS, ...localConfig.adminPermissions![userEmail?.toLowerCase() ?? ''] }
    : isSuperAdminUser
      ? Object.fromEntries(Object.keys(DEFAULT_ADMIN_PERMISSIONS).map(k => [k, true]))
      : { ...DEFAULT_ADMIN_PERMISSIONS };

  // Super admin has all permissions
  const canManageShop = isSuperAdminUser || adminPerms.canManageShop;
  const canManageSheet = isSuperAdminUser || adminPerms.canManageSheet;
  const canManageAnnouncement = isSuperAdminUser || adminPerms.canManageAnnouncement;

  return (
    <div className="flex max-w-[700px] flex-col gap-6">
      {/* Header with Save Button */}
      <div className="mb-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold text-[var(--foreground)]">
            <Settings size={24} />
            ตั้งค่าร้านค้า
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            {isSuperAdminUser ? 'จัดการการตั้งค่าทั้งหมดของร้าน' : 'จัดการประกาศและการตั้งค่าที่ได้รับอนุญาต'}
          </p>
        </div>

        <div
          className={cn(
            'flex gap-2 transition-opacity duration-200',
            hasChanges ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <Button
            variant="outline"
            onClick={onReset}
            className="rounded-[10px] border-[var(--glass-border)] text-[var(--text-muted)] hover:border-red-500 hover:text-red-500"
          >
            ยกเลิก
          </Button>
          <Button
            onClick={onSave}
            className={cn(gradientBtnClass, hasChanges && 'animate-glow-pulse')}
          >
            <Save size={18} />
            บันทึกการตั้งค่า
          </Button>
        </div>
      </div>

      {/* Unsaved Changes Warning - use opacity instead of conditional render to prevent layout shift */}
      <div
        className={cn(
          'flex items-center gap-4 overflow-hidden rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 transition-all duration-200',
          hasChanges ? 'mb-0 max-h-[100px] opacity-100' : '-mb-6 max-h-0 opacity-0',
        )}
      >
        <Warning size={24} className="shrink-0 text-amber-400" />
        <p className="text-[0.9rem] text-amber-400">
          มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก กดปุ่ม &quot;บันทึกการตั้งค่า&quot; เพื่อยืนยัน
        </p>
      </div>

      {/* Shop Status - Only for Super Admin or admins with permission */}
      {canManageShop && (
        <SettingSection icon={<Store size={20} />} title="สถานะร้านค้า">
          <SettingToggleRow
            label="เปิดรับออเดอร์"
            description={localConfig.isOpen ? 'ร้านเปิดให้บริการอยู่' : 'ปิดรับออเดอร์ชั่วคราว'}
            checked={localConfig.isOpen}
            onChange={(checked) => onConfigChange({...localConfig, isOpen: checked})}
          />
          {!localConfig.isOpen && (
            <div className="mt-2 flex flex-col gap-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <div>
                <p className="mb-2 text-[0.85rem] text-red-400">
                  <CalendarToday size={18} className="mr-2 inline align-middle" />
                  กำหนดวันเปิดร้านใหม่ (ถ้ามี)
                </p>
                <Input
                  type="datetime-local"
                  value={localConfig.openDate || ''}
                  onChange={(e) => onConfigChange({...localConfig, openDate: e.target.value})}
                  placeholder="เช่น 2025-01-20T09:00"
                  className={inputClass}
                />
              </div>
              <div>
                <p className="mb-2 text-[0.85rem] text-red-400">
                  <Warning size={18} className="mr-2 inline align-middle" />
                  ข้อความแจ้งผู้ใช้ (ไม่บังคับ)
                </p>
                <Textarea
                  placeholder="เช่น: ร้านปิดปรับปรุงถึงวันที่ 20 ม.ค."
                  value={localConfig.closedMessage || ''}
                  onChange={(e) => onConfigChange({...localConfig, closedMessage: e.target.value})}
                  rows={2}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Close Date - กำหนดวันปิดรับออเดอร์ */}
          {localConfig.isOpen && (
            <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="mb-2 text-[0.85rem] text-amber-400">
                <CalendarToday size={18} className="mr-2 inline align-middle" />
                กำหนดวันปิดรับออเดอร์ (ไม่บังคับ)
              </p>
              <Input
                type="datetime-local"
                value={localConfig.closeDate || ''}
                onChange={(e) => onConfigChange({...localConfig, closeDate: e.target.value})}
                placeholder="เช่น 2025-01-25T23:59"
                className={inputClass}
              />
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                เมื่อถึงวันนี้ ระบบจะแสดงสถานะ &quot;หมดเขตสั่งซื้อ&quot; โดยอัตโนมัติ
              </p>
            </div>
          )}
        </SettingSection>
      )}

      {/* Payment System Toggle - Only for Super Admin or admins with shop permission */}
      {canManageShop && (
        <SettingSection icon={<AttachMoney size={20} />} title="ระบบชำระเงิน">
          <SettingToggleRow
            label="เปิดรับชำระเงิน"
            description={localConfig.paymentEnabled !== false ? 'ผู้ใช้สามารถอัพโหลดสลิปได้' : 'ปิดรับชำระเงินชั่วคราว'}
            checked={localConfig.paymentEnabled !== false}
            onChange={(checked) => onConfigChange({...localConfig, paymentEnabled: checked})}
          />
          {localConfig.paymentEnabled === false && (
            <div className="mt-2 rounded-xl border border-orange-500/20 bg-orange-500/10 p-4">
              <p className="mb-3 text-[0.85rem] text-orange-400">
                <Warning size={20} className="mr-2 inline align-middle" />
                ข้อความแจ้งผู้ใช้ (ไม่บังคับ)
              </p>
              <Textarea
                placeholder="เช่น: ระบบปิดปรับปรุงถึง 18:00 น."
                value={localConfig.paymentDisabledMessage || ''}
                onChange={(e) => onConfigChange({...localConfig, paymentDisabledMessage: e.target.value})}
                rows={2}
                className={inputClass}
              />
            </div>
          )}
        </SettingSection>
      )}

      {/* Name Validation Settings */}
      {canManageShop && (
        <SettingSection icon={<Person size={20} />} title="ตั้งค่าชื่อ-นามสกุล">
          {(() => {
            const nv = { ...DEFAULT_NAME_VALIDATION, ...localConfig.nameValidation };
            const updateNV = (patch: Partial<NameValidationConfig>) => {
              onConfigChange({ ...localConfig, nameValidation: { ...nv, ...patch } });
            };
            return (
              <div className="flex flex-col gap-4">
                {/* Length settings */}
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="name-min-length">ความยาวขั้นต่ำ</Label>
                    <Input
                      id="name-min-length"
                      type="number"
                      value={nv.minLength}
                      onChange={e => updateNV({ minLength: Math.max(1, Number(e.target.value) || 1) })}
                      min={1}
                      max={200}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="name-max-length">ความยาวสูงสุด</Label>
                    <Input
                      id="name-max-length"
                      type="number"
                      value={nv.maxLength}
                      onChange={e => updateNV({ maxLength: Math.max(nv.minLength, Number(e.target.value) || 10) })}
                      min={nv.minLength}
                      max={500}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Language toggles */}
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.08] p-4">
                  <p className="mb-3 flex items-center gap-1 text-[0.85rem] font-bold text-indigo-400">
                    <Groups size={14} /> ภาษาที่อนุญาต
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'allowThai' as const, label: 'ภาษาไทย', color: '#0071e3' },
                      { key: 'allowEnglish' as const, label: 'English', color: '#10b981' },
                    ].map(lang => (
                      <button
                        key={lang.key}
                        type="button"
                        onClick={() => {
                          if (nv[lang.key] && !Object.entries(nv).some(([k, v]) => k !== lang.key && k.startsWith('allow') && k !== 'allowSpecialChars' && v === true)) return;
                          updateNV({ [lang.key]: !nv[lang.key] });
                        }}
                        className="cursor-pointer rounded-[10px] border-[1.5px] px-4 py-2 text-[0.85rem] font-semibold transition-all"
                        style={{
                          backgroundColor: nv[lang.key] ? `${lang.color}15` : 'rgba(255,255,255,0.05)',
                          color: nv[lang.key] ? lang.color : '#64748b',
                          borderColor: nv[lang.key] ? lang.color : 'transparent',
                        }}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Special characters */}
                <SettingToggleRow
                  label="อนุญาตอักษรพิเศษ"
                  description={nv.allowSpecialChars ? `ตัวอักษรที่อนุญาต: ${nv.allowedSpecialChars}` : 'ปิดใช้งาน'}
                  checked={nv.allowSpecialChars}
                  onChange={checked => updateNV({ allowSpecialChars: checked })}
                />
                {nv.allowSpecialChars && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name-special-chars">อักษรพิเศษที่อนุญาต</Label>
                    <Input
                      id="name-special-chars"
                      value={nv.allowedSpecialChars}
                      onChange={e => updateNV({ allowedSpecialChars: e.target.value })}
                      placeholder=".-'"
                      className={inputClass}
                    />
                    <p className="text-xs text-[var(--text-muted)]">
                      กรอกตัวอักษรพิเศษที่ต้องการอนุญาต เช่น . - &apos; ( )
                    </p>
                  </div>
                )}

                {/* Preview */}
                <div className="rounded-[10px] border border-emerald-500/20 bg-emerald-500/[0.08] p-3">
                  <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-emerald-500">
                    <CheckCircle size={14} /> ตัวอย่างที่ระบบจะยอมรับ:
                  </p>
                  <p className="text-[0.8rem] text-[var(--text-muted)]">
                    {[
                      nv.allowThai && 'สมชาย ใจดี',
                      nv.allowEnglish && 'John Smith',
                      (nv.allowThai && nv.allowEnglish) && 'สมชาย Smith',
                      nv.allowSpecialChars && (nv.allowThai ? `สมชาย ใจ${nv.allowedSpecialChars[0] || '.'}ดี` : `John O${nv.allowedSpecialChars[0] || "'"}Brien`),
                    ].filter(Boolean).join(' / ')}
                    {` (${nv.minLength}-${nv.maxLength} ตัว)`}
                  </p>
                </div>
              </div>
            );
          })()}
        </SettingSection>
      )}

      {/* Google Sheet - Only for Super Admin or admins with permission */}
      {canManageSheet && (
        <SettingSection icon={<Bolt size={20} />} title="Google Sheet">
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sheet-id">Sheet ID (ออเดอร์ + สรุปการผลิต)</Label>
              <Input
                id="sheet-id"
                placeholder="วาง Sheet ID หรือ URL ก็ได้"
                value={localConfig.sheetId || ''}
                onChange={(e) => {
                  const { sheetId, sheetUrl } = extractSheetInfo(e.target.value);
                  onConfigChange({ ...localConfig, sheetId, sheetUrl });
                }}
                className={inputClass}
              />
              <p className="text-xs text-[var(--text-muted)]">
                ชีตหลัก — แท็บ Orders รวมทุกออเดอร์ และแท็บสรุปตามสินค้า
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vendor-sheet-id">Vendor Sheet ID</Label>
              <Input
                id="vendor-sheet-id"
                placeholder="วาง Sheet ID หรือ URL ให้โรงงาน"
                value={localConfig.vendorSheetId || ''}
                onChange={(e) => {
                  const { sheetId, sheetUrl } = extractSheetInfo(e.target.value);
                  onConfigChange({ ...localConfig, vendorSheetId: sheetId, vendorSheetUrl: sheetUrl });
                }}
                className={inputClass}
              />
              <p className="text-xs text-[var(--text-muted)]">
                ชีตแยกสำหรับส่งให้โรงงาน (ตัดอีเมล/ลิงก์สลิปออก) — ไม่บังคับ
              </p>
            </div>

            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--surface-2)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.9rem] font-semibold text-[var(--foreground)]">
                    แยกชีตสรุปตามสินค้า
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    แต่ละสินค้าจะมีแท็บชื่อ &quot;สรุป [ชื่อสินค้า]&quot; พร้อมรายการและสรุปไซซ์แยกกัน
                  </p>
                </div>
                <Switch
                  checked={localConfig.sheetSettings?.factoryPerProduct !== false}
                  onCheckedChange={(checked) => onConfigChange({
                    ...localConfig,
                    sheetSettings: {
                      ...localConfig.sheetSettings,
                      factoryPerProduct: checked,
                    },
                  })}
                  className="shrink-0 data-[state=checked]:bg-emerald-500"
                />
              </div>

              <div className="mt-4 space-y-1.5">
                <Label htmlFor="factory-order-statuses">สถานะออเดอร์ที่นำเข้าชีตสรุป</Label>
                <Input
                  id="factory-order-statuses"
                  placeholder="PAID"
                  value={(localConfig.sheetSettings?.factoryOrderStatuses || ['PAID']).join(', ')}
                  onChange={(e) => {
                    const statuses = e.target.value
                      .split(',')
                      .map((s) => s.trim().toUpperCase())
                      .filter(Boolean);
                    onConfigChange({
                      ...localConfig,
                      sheetSettings: {
                        ...localConfig.sheetSettings,
                        factoryOrderStatuses: statuses.length ? statuses : ['PAID'],
                      },
                    });
                  }}
                  className={inputClass}
                />
                <p className="text-xs text-[var(--text-muted)]">
                  คั่นด้วยจุลภาค เช่น PAID หรือ PAID, READY
                </p>
              </div>

              {localConfig.sheetSettings?.factoryPerProduct !== false && (localConfig.products?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs text-[var(--text-muted)]">
                    แท็บสรุปที่จะสร้างเมื่อมีออเดอร์:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(localConfig.products || [])
                      .filter((p) => p.isActive !== false)
                      .map((p) => (
                        <Badge
                          key={p.id}
                          variant="secondary"
                          className="bg-indigo-500/12 text-[0.7rem] text-indigo-500"
                        >
                          {`สรุป ${p.name}`}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {localConfig.sheetUrl && (
              <div className="flex items-center gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-emerald-500">
                  <Check size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[0.9rem] font-semibold text-emerald-500">
                    เชื่อมต่อแล้ว
                  </p>
                  <a
                    href={localConfig.sheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[0.8rem] text-[var(--text-muted)] underline hover:text-[var(--text-muted)]"
                  >
                    เปิด Google Sheet
                  </a>
                </div>
              </div>
            )}

            {localConfig.vendorSheetUrl && (
              <div className="flex items-center gap-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-blue-500">
                  <Check size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[0.9rem] font-semibold text-blue-500">
                    เชื่อมต่อชีตโรงงานแล้ว
                  </p>
                  <a
                    href={localConfig.vendorSheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[0.8rem] text-[var(--text-muted)] underline hover:text-[var(--text-muted)]"
                  >
                    เปิด Vendor Sheet
                  </a>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => triggerSheetSync(localConfig.sheetId ? 'sync' : 'create')}
                disabled={sheetSyncing}
                className={cn(gradientBtnClass, 'flex-1')}
              >
                <Bolt size={18} />
                {sheetSyncing ? 'กำลังซิงก์...' : localConfig.sheetId ? 'ซิงก์ทันที' : 'สร้าง Sheet ใหม่'}
              </Button>
            </div>
          </div>
        </SettingSection>
      )}

      {/* Admin Management - Only visible to Super Admin */}
      {isSuperAdminUser && (
        <SettingSection icon={<AdminPanelSettings size={20} />} title="จัดการแอดมิน">
          <div className="mb-4">
            <div className="mb-4 flex items-center gap-2 rounded-[10px] border border-amber-400/30 bg-amber-400/10 p-3">
              <Shield size={18} className="shrink-0 text-amber-400" />
              <p className="text-[0.8rem] text-amber-400">
                เฉพาะบัญชีสูงสุดเท่านั้นที่สามารถจัดการแอดมินได้
              </p>
            </div>

            {/* Super Admin Badge */}
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-emerald-500 to-emerald-600">
                <Shield size={20} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">บัญชีสูงสุด (Super Admin)</p>
                <p className="text-[0.9rem] font-semibold text-emerald-400">
                  {SUPER_ADMIN_EMAIL}
                </p>
              </div>
            </div>

            {/* Add Admin Form */}
            <div className="mb-4 flex gap-2">
              <Input
                placeholder="กรอกอีเมลแอดมินใหม่..."
                value={newAdminEmail}
                onChange={(e) => onNewAdminEmailChange(e.target.value)}
                className={cn(inputClass, 'flex-1')}
              />
              <Button
                onClick={() => {
                  const email = newAdminEmail.trim().toLowerCase();
                  if (!email) return;
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    showToast('error', 'รูปแบบอีเมลไม่ถูกต้อง');
                    return;
                  }
                  if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
                    showToast('warning', 'ไม่สามารถเพิ่มบัญชีสูงสุดซ้ำได้');
                    return;
                  }
                  const currentAdmins = localConfig.adminEmails || [];
                  if (currentAdmins.map(e => e.toLowerCase()).includes(email)) {
                    showToast('warning', 'อีเมลนี้เป็นแอดมินอยู่แล้ว');
                    return;
                  }
                  onConfigChange({
                    ...localConfig,
                    adminEmails: [...currentAdmins, email]
                  });
                  onNewAdminEmailChange('');
                  showToast('success', `เพิ่ม ${email} เป็นแอดมินแล้ว (กรุณาบันทึกการตั้งค่า)`);
                }}
                className={cn(gradientBtnClass, 'min-w-[100px] whitespace-nowrap')}
              >
                <PersonAdd size={18} />
                เพิ่ม
              </Button>
            </div>

            {/* Admin List */}
            <p className="mb-2 text-[0.8rem] text-[var(--text-muted)]">
              รายชื่อแอดมิน ({(localConfig.adminEmails || []).length} คน)
            </p>
            <div className="flex flex-col gap-3">
              {(localConfig.adminEmails || []).length === 0 ? (
                <div className="rounded-[10px] border border-[var(--glass-border)] bg-white/[0.03] p-4 text-center">
                  <p className="text-[0.85rem] text-[var(--text-muted)]">
                    ยังไม่มีแอดมินเพิ่มเติม
                  </p>
                </div>
              ) : (
                (localConfig.adminEmails || []).map((adminEmail, idx) => {
                  const perms: AdminPermissions = localConfig.adminPermissions?.[adminEmail.toLowerCase()]
                    ? { ...DEFAULT_ADMIN_PERMISSIONS, ...localConfig.adminPermissions[adminEmail.toLowerCase()] }
                    : { ...DEFAULT_ADMIN_PERMISSIONS };

                  const togglePermission = (key: string, value: boolean) => {
                    const currentPerms = localConfig.adminPermissions ?? {};
                    onConfigChange({
                      ...localConfig,
                      adminPermissions: {
                        ...currentPerms,
                        [adminEmail.toLowerCase()]: {
                          ...perms,
                          [key]: value,
                        }
                      }
                    });
                  };

                  return (
                    <div
                      key={idx}
                      className="overflow-hidden rounded-xl border border-[var(--glass-border)] bg-white/[0.03]"
                    >
                      {/* Admin Header */}
                      <div className="flex items-center gap-3 border-b border-[var(--glass-border)] bg-violet-500/5 p-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20">
                          <Person size={18} className="text-violet-400" />
                        </div>
                        <p className="flex-1 text-[0.9rem] font-semibold text-[var(--foreground)]">
                          {adminEmail}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            const currentAdmins = localConfig.adminEmails || [];
                            const currentPerms = { ...(localConfig.adminPermissions ?? {}) };
                            delete currentPerms[adminEmail.toLowerCase()];
                            onConfigChange({
                              ...localConfig,
                              adminEmails: currentAdmins.filter((_, i) => i !== idx),
                              adminPermissions: currentPerms,
                            });
                            showToast('info', `ลบ ${adminEmail} ออกจากแอดมินแล้ว (กรุณาบันทึกการตั้งค่า)`);
                          }}
                          className="text-red-500 hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Delete size={18} />
                        </Button>
                      </div>

                      {/* Permissions */}
                      <div className="p-3">
                        <p className="mb-2 text-xs text-[var(--text-muted)]">สิทธิ์การใช้งาน:</p>

                        {/* Permission Groups */}
                        {[
                          {
                            group: 'ร้านค้า & ระบบ', groupIcon: <Store size={14} />,
                            items: [
                              { key: 'canManageShop', label: 'เปิด/ปิดร้าน', color: '#10b981' },
                              { key: 'canManageSheet', label: 'จัดการ Sheet', color: '#3b82f6' },
                              { key: 'canManageShipping', label: 'ตั้งค่าจัดส่ง', color: '#a78bfa' },
                              { key: 'canManagePayment', label: 'ตั้งค่าชำระเงิน', color: '#22d3ee' },
                            ],
                          },
                          {
                            group: 'สินค้า & ออเดอร์', groupIcon: <Inventory size={14} />,
                            items: [
                              { key: 'canManageProducts', label: 'จัดการสินค้า', color: '#ec4899' },
                              { key: 'canManageOrders', label: 'จัดการออเดอร์', color: '#8b5cf6' },
                              { key: 'canManagePickup', label: 'รับสินค้า', color: '#06b6d4' },
                              { key: 'canManageTracking', label: 'ติดตามพัสดุ', color: '#fb923c' },
                              { key: 'canManageRefunds', label: 'คืนเงิน', color: '#c084fc' },
                            ],
                          },
                          {
                            group: 'การตลาด & สื่อสาร', groupIcon: <Campaign size={14} />,
                            items: [
                              { key: 'canManageAnnouncement', label: 'ประกาศ', color: '#f59e0b' },
                              { key: 'canManageEvents', label: 'อีเวนต์/โปรโมชั่น', color: '#fbbf24' },
                              { key: 'canManagePromoCodes', label: 'โค้ดส่วนลด', color: '#34c759' },
                              { key: 'canManageSupport', label: 'แชทสนับสนุน', color: '#ec4899' },
                              { key: 'canSendEmail', label: 'ส่งอีเมล', color: '#10b981' },
                              { key: 'canManageLiveStream', label: 'ไลฟ์สด', color: '#ef4444' },
                            ],
                          },
                        ].map((group) => (
                          <div key={group.group} className="mb-3">
                            <p className="mb-1 flex items-center gap-1 text-[0.7rem] font-semibold text-[var(--text-muted)]">
                              {group.groupIcon} {group.group}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {group.items.map(perm => (
                                <button
                                  key={perm.key}
                                  type="button"
                                  onClick={() => togglePermission(perm.key, !perms[perm.key as keyof AdminPermissions])}
                                  className="cursor-pointer rounded-lg border px-3 py-1 text-xs font-medium transition-all"
                                  style={{
                                    backgroundColor: perms[perm.key as keyof AdminPermissions]
                                      ? `${perm.color}20`
                                      : 'rgba(255,255,255,0.05)',
                                    color: perms[perm.key as keyof AdminPermissions]
                                      ? perm.color
                                      : '#64748b',
                                    borderColor: perms[perm.key as keyof AdminPermissions]
                                      ? perm.color
                                      : 'transparent',
                                  }}
                                >
                                  {perm.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}

                        {/* Quick Actions */}
                        <div className="mt-2 flex gap-1 border-t border-[var(--glass-border)] pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const allPerms: AdminPermissions = {};
                              Object.keys(DEFAULT_ADMIN_PERMISSIONS).forEach(k => {
                                (allPerms as Record<string, boolean>)[k] = true;
                              });
                              const currentPerms = localConfig.adminPermissions ?? {};
                              onConfigChange({
                                ...localConfig,
                                adminPermissions: {
                                  ...currentPerms,
                                  [adminEmail.toLowerCase()]: allPerms,
                                }
                              });
                            }}
                            className="cursor-pointer rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[0.7rem] font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/20"
                          >
                            <span className="flex items-center gap-1"><Check size={12} /> เปิดทั้งหมด</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const noPerms: AdminPermissions = {};
                              Object.keys(DEFAULT_ADMIN_PERMISSIONS).forEach(k => {
                                (noPerms as Record<string, boolean>)[k] = false;
                              });
                              const currentPerms = localConfig.adminPermissions ?? {};
                              onConfigChange({
                                ...localConfig,
                                adminPermissions: {
                                  ...currentPerms,
                                  [adminEmail.toLowerCase()]: noPerms,
                                }
                              });
                            }}
                            className="cursor-pointer rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1 text-[0.7rem] font-semibold text-red-500 transition-colors hover:bg-red-500/20"
                          >
                            <span className="flex items-center gap-1"><Close size={12} /> ปิดทั้งหมด</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const currentPerms = localConfig.adminPermissions ?? {};
                              onConfigChange({
                                ...localConfig,
                                adminPermissions: {
                                  ...currentPerms,
                                  [adminEmail.toLowerCase()]: { ...DEFAULT_ADMIN_PERMISSIONS },
                                }
                              });
                            }}
                            className="cursor-pointer rounded-md border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[0.7rem] font-semibold text-indigo-500 transition-colors hover:bg-indigo-500/20"
                          >
                            <span className="flex items-center gap-1"><RefreshCw size={12} /> ค่าเริ่มต้น</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </SettingSection>
      )}

      {/* Pickup Settings - Per Product Summary */}
      {canManageShop && (
        <SettingSection icon={<LocalMall size={20} />} title="สถานะรับสินค้า">
          {(() => {
            const productsWithPickup = localConfig.products?.filter(p => p.pickup?.enabled) || [];
            const totalProducts = localConfig.products?.length || 0;

            return (
              <div className="flex flex-col gap-4">
                <div
                  className={cn(
                    'flex items-center gap-4 rounded-xl p-4',
                    productsWithPickup.length > 0
                      ? 'border border-emerald-500/30 bg-emerald-500/10'
                      : 'border border-[var(--glass-border)] bg-white/[0.03]',
                  )}
                >
                  <LocalMall
                    size={32}
                    className={productsWithPickup.length > 0 ? 'text-emerald-500' : 'text-[var(--text-muted)]'}
                  />
                  <div className="flex-1">
                    <p className="font-bold text-[var(--foreground)]">
                      {productsWithPickup.length > 0
                        ? `เปิดรับ ${productsWithPickup.length} สินค้า`
                        : 'ยังไม่มีสินค้าเปิดรับ'}
                    </p>
                    <p className="text-[0.8rem] text-[var(--text-muted)]">
                      จากทั้งหมด {totalProducts} สินค้า
                    </p>
                  </div>
                </div>

                {productsWithPickup.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {productsWithPickup.map(p => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 rounded-[10px] border border-cyan-500/15 bg-cyan-500/[0.05] p-3"
                      >
                        <CheckCircle size={18} className="shrink-0 text-emerald-500" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.85rem] font-semibold text-[var(--foreground)]">
                            {p.name}
                          </p>
                          {p.pickup?.location && (
                            <p className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                              <Crosshair size={12} /> {p.pickup.location}
                            </p>
                          )}
                          {(p.pickup?.startDate || p.pickup?.endDate) && (
                            <p className="flex items-center gap-1 text-[0.7rem] text-[var(--text-muted)]">
                              <CalendarDays size={12} /> {p.pickup?.startDate ? new Date(p.pickup.startDate).toLocaleDateString('th-TH') : '...'} - {p.pickup?.endDate ? new Date(p.pickup.endDate).toLocaleDateString('th-TH') : '...'}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Alert className="border border-indigo-500/20 bg-indigo-500/10 text-[0.8rem]">
                  <AlertDescription>
                    ไปที่แท็บ <strong>สินค้า</strong> และกดปุ่ม &quot;ตั้งค่ารับสินค้า&quot; ในแต่ละสินค้าเพื่อเปิด/ปิดการรับสินค้า
                  </AlertDescription>
                </Alert>
              </div>
            );
          })()}
        </SettingSection>
      )}

      {/* Save Status */}
      <div className={cn(glassCardClass, 'flex items-center justify-between p-4')}>
        <div className="flex items-center gap-4">
          <div
            className="size-2.5 shrink-0 rounded-full"
            style={{
              backgroundColor: hasChanges ? '#f59e0b' : '#10b981',
              boxShadow: `0 0 12px ${hasChanges ? '#f59e0b' : '#10b981'}`,
            }}
          />
          <p className="text-[0.85rem] text-[var(--text-muted)]">
            {hasChanges ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'บันทึกล่าสุด: ' + (lastSavedTime ? lastSavedTime.toLocaleString('th-TH') : '-')}
          </p>
        </div>
        <Button
          onClick={onSave}
          disabled={!hasChanges || loading}
          className={cn(gradientBtnClass, 'min-w-[120px]', !hasChanges && 'opacity-50')}
        >
          <Save size={18} />
          บันทึก
        </Button>
      </div>
    </div>
  );
});
