import React from 'react';
import {
  Store,
  User as Person,
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
  ChevronDown,
  ExternalLink,
  Loader2,
  Save,
  Undo2,
  FileSpreadsheet,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '@/components/ui/date-picker';
import { Kbd, STATUS_LABEL_TH } from '@/components/admin/admin-ui';
import { cn } from '@/lib/utils';

// ============== LAYOUT PRIMITIVES ==============
function SettingSection({
  id,
  icon,
  title,
  description,
  action,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5 md:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{title}</h2>
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action}
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

/** One setting: label + help on the left, control on the right (or below when `stacked`). */
function SettingRow({
  label,
  description,
  htmlFor,
  children,
  stacked,
  inline,
  className,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  children?: React.ReactNode;
  stacked?: boolean;
  /** Keep label and control on one line even on phones (for switches) */
  inline?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3.5 md:px-5',
        stacked ? 'flex-col' : inline ? 'flex-row items-center justify-between' : 'flex-col sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className={cn('min-w-0', inline ? 'flex-1' : 'sm:max-w-[60%]')}>
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className={cn('min-w-0', inline ? 'shrink-0' : !stacked && 'sm:shrink-0')}>{children}</div> : null}
    </div>
  );
}

function ClearableDateTime({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <DateTimePicker
        id={id}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        className="min-w-0 flex-1 sm:w-[240px] sm:flex-none"
      />
      {value ? (
        <Button variant="ghost" size="icon-sm" onClick={() => onChange('')} aria-label="ล้างวันที่">
          <Close />
        </Button>
      ) : null}
    </div>
  );
}

function Notice({
  tone = 'muted',
  icon,
  children,
}: {
  tone?: 'muted' | 'success' | 'warning';
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-xs [&_svg]:mt-px [&_svg]:size-4 [&_svg]:shrink-0',
        tone === 'success' && 'bg-success/10 text-success dark:text-success',
        tone === 'warning' && 'bg-warning/12 text-warning dark:text-warning',
        tone === 'muted' && 'bg-muted text-muted-foreground',
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// ============== CONSTANTS / UTILITIES ==============
const PERMISSION_GROUPS: { group: string; icon: React.ReactNode; items: { key: keyof AdminPermissions; label: string }[] }[] = [
  {
    group: 'ร้านค้า & ระบบ',
    icon: <Store />,
    items: [
      { key: 'canManageShop', label: 'เปิด/ปิดร้าน' },
      { key: 'canManageSheet', label: 'จัดการ Sheet' },
      { key: 'canManageShipping', label: 'ตั้งค่าจัดส่ง' },
      { key: 'canManagePayment', label: 'ตั้งค่าชำระเงิน' },
    ],
  },
  {
    group: 'สินค้า & ออเดอร์',
    icon: <Inventory />,
    items: [
      { key: 'canManageProducts', label: 'จัดการสินค้า' },
      { key: 'canManageOrders', label: 'จัดการออเดอร์' },
      { key: 'canManagePickup', label: 'รับสินค้า' },
      { key: 'canManageTracking', label: 'ติดตามพัสดุ' },
      { key: 'canManageRefunds', label: 'คืนเงิน' },
    ],
  },
  {
    group: 'การตลาด & สื่อสาร',
    icon: <Campaign />,
    items: [
      { key: 'canManageAnnouncement', label: 'ประกาศ' },
      { key: 'canManageEvents', label: 'อีเวนต์/โปรโมชั่น' },
      { key: 'canManagePromoCodes', label: 'โค้ดส่วนลด' },
      { key: 'canManageSupport', label: 'แชทสนับสนุน' },
      { key: 'canSendEmail', label: 'ส่งอีเมล' },
      { key: 'canManageLiveStream', label: 'ไลฟ์สด' },
    ],
  },
];
const PERMISSION_KEYS = Object.keys(DEFAULT_ADMIN_PERMISSIONS) as (keyof AdminPermissions)[];

/** Statuses an order can be in when it should appear on the factory summary sheet */
const SHEET_STATUS_OPTIONS = ['WAITING_PAYMENT', 'PENDING', 'PAID', 'READY', 'SHIPPED', 'COMPLETED'];

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
  const [expandedAdmins, setExpandedAdmins] = React.useState<Set<string>>(new Set());

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

  // Ctrl/⌘+S saves; warn before leaving the page with unsaved changes
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (hasChanges && !loading) onSave();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasChanges) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [hasChanges, loading, onSave]);

  const set = (patch: Partial<ShopConfig>) => onConfigChange({ ...localConfig, ...patch });

  const sections = [
    { id: 'st-shop', label: 'สถานะร้านค้า', show: canManageShop },
    { id: 'st-payment', label: 'ระบบชำระเงิน', show: canManageShop },
    { id: 'st-names', label: 'ชื่อ-นามสกุลลูกค้า', show: canManageShop },
    { id: 'st-sheet', label: 'Google Sheet', show: canManageSheet },
    { id: 'st-admins', label: 'แอดมิน', show: isSuperAdminUser },
    { id: 'st-pickup', label: 'รับสินค้าหน้าร้าน', show: canManageShop },
  ].filter((s) => s.show);

  // Scroll the window directly, leaving room for the 56px sticky top bar.
  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' });
  };

  // ---------- admin helpers ----------
  const permsFor = (email: string): AdminPermissions =>
    localConfig.adminPermissions?.[email.toLowerCase()]
      ? { ...DEFAULT_ADMIN_PERMISSIONS, ...localConfig.adminPermissions[email.toLowerCase()] }
      : { ...DEFAULT_ADMIN_PERMISSIONS };

  const setPermsFor = (email: string, perms: AdminPermissions) =>
    set({ adminPermissions: { ...(localConfig.adminPermissions ?? {}), [email.toLowerCase()]: perms } });

  const addAdmin = () => {
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
    set({ adminEmails: [...currentAdmins, email] });
    onNewAdminEmailChange('');
    setExpandedAdmins((prev) => new Set(prev).add(email));
    showToast('success', `เพิ่ม ${email} เป็นแอดมินแล้ว (กรุณาบันทึกการตั้งค่า)`);
  };

  const removeAdmin = (adminEmail: string, idx: number) => {
    const currentAdmins = localConfig.adminEmails || [];
    const currentPerms = { ...(localConfig.adminPermissions ?? {}) };
    delete currentPerms[adminEmail.toLowerCase()];
    set({ adminEmails: currentAdmins.filter((_, i) => i !== idx), adminPermissions: currentPerms });
    showToast('info', `ลบ ${adminEmail} ออกจากแอดมินแล้ว (กรุณาบันทึกการตั้งค่า)`);
  };

  const nv = { ...DEFAULT_NAME_VALIDATION, ...localConfig.nameValidation };
  const updateNV = (patch: Partial<NameValidationConfig>) => set({ nameValidation: { ...nv, ...patch } });

  const sheetStatuses = localConfig.sheetSettings?.factoryOrderStatuses || ['PAID'];
  const statusChoices = [...SHEET_STATUS_OPTIONS, ...sheetStatuses.filter((s) => !SHEET_STATUS_OPTIONS.includes(s))];
  const toggleSheetStatus = (status: string) => {
    const next = sheetStatuses.includes(status) ? sheetStatuses.filter((s) => s !== status) : [...sheetStatuses, status];
    if (next.length === 0) {
      showToast('warning', 'ต้องเลือกอย่างน้อย 1 สถานะ');
      return;
    }
    set({ sheetSettings: { ...localConfig.sheetSettings, factoryOrderStatuses: next } });
  };

  const productsWithPickup = localConfig.products?.filter(p => p.pickup?.enabled) || [];
  const adminEmails = localConfig.adminEmails || [];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8">
      {/* ─── Section nav ─── */}
      <nav aria-label="หมวดการตั้งค่า" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] md:-mx-6 md:px-6 lg:mx-0 lg:flex-col lg:gap-0.5 lg:px-0 [&::-webkit-scrollbar]:hidden">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jumpTo(s.id)}
              className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:rounded-md lg:border-0 lg:px-2.5 lg:text-left lg:text-sm"
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-4 hidden items-center gap-2 px-2.5 text-xs text-muted-foreground lg:flex">
          <span className={cn('size-1.5 shrink-0 rounded-full', hasChanges ? 'bg-warning' : 'bg-success')} />
          {hasChanges
            ? 'ยังไม่ได้บันทึก'
            : lastSavedTime
              ? `บันทึกล่าสุด ${lastSavedTime.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
              : 'บันทึกแล้ว'}
        </p>
      </nav>

      <div className={cn('flex min-w-0 max-w-3xl flex-col gap-5', hasChanges && 'pb-24')}>
        {/* ─── Shop status ─── */}
        {canManageShop && (
          <SettingSection
            id="st-shop"
            icon={<Store />}
            title="สถานะร้านค้า"
            description="เปิด/ปิดการรับออเดอร์ และตั้งเวลาเปิด-ปิดล่วงหน้า"
            action={
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold',
                  localConfig.isOpen
                    ? 'bg-success/12 text-success dark:text-success'
                    : 'bg-destructive/12 text-destructive dark:text-destructive',
                )}
              >
                <span className={cn('size-1.5 rounded-full', localConfig.isOpen ? 'bg-success' : 'bg-destructive')} />
                {localConfig.isOpen ? 'เปิดอยู่' : 'ปิดอยู่'}
              </span>
            }
          >
            <SettingRow
              label="เปิดรับออเดอร์"
              description={localConfig.isOpen ? 'ลูกค้าสั่งซื้อได้ตามปกติ' : 'ปิดรับออเดอร์ชั่วคราว ลูกค้าจะยังดูสินค้าได้'}
              htmlFor="st-is-open"
              inline
            >
              <Switch id="st-is-open" checked={localConfig.isOpen} onCheckedChange={(checked) => set({ isOpen: checked })} />
            </SettingRow>
            {localConfig.isOpen ? (
              <SettingRow
                label="ปิดรับออเดอร์อัตโนมัติ"
                description='เมื่อถึงเวลานี้ หน้าร้านจะแสดง "หมดเขตสั่งซื้อ" (ไม่บังคับ)'
              >
                <ClearableDateTime
                  id="st-close-date"
                  value={localConfig.closeDate}
                  onChange={(v) => set({ closeDate: v })}
                  placeholder="ไม่กำหนด"
                />
              </SettingRow>
            ) : (
              <>
                <SettingRow label="วันเปิดร้านอีกครั้ง" description="แสดงให้ลูกค้าเห็น (ไม่บังคับ)">
                  <ClearableDateTime
                    id="st-open-date"
                    value={localConfig.openDate}
                    onChange={(v) => set({ openDate: v })}
                    placeholder="ไม่กำหนด"
                  />
                </SettingRow>
                <SettingRow label="ข้อความแจ้งลูกค้า" description="แสดงบนหน้าร้านขณะปิด (ไม่บังคับ)" htmlFor="st-closed-msg" stacked>
                  <Textarea
                    id="st-closed-msg"
                    placeholder="เช่น ร้านปิดปรับปรุงถึงวันที่ 20 ม.ค."
                    value={localConfig.closedMessage || ''}
                    onChange={(e) => set({ closedMessage: e.target.value })}
                    rows={2}
                  />
                </SettingRow>
              </>
            )}
          </SettingSection>
        )}

        {/* ─── Payment ─── */}
        {canManageShop && (
          <SettingSection id="st-payment" icon={<AttachMoney />} title="ระบบชำระเงิน" description="ปิดการอัปโหลดสลิปชั่วคราวได้โดยไม่ต้องปิดร้าน">
            <SettingRow
              label="เปิดรับชำระเงิน"
              description={localConfig.paymentEnabled !== false ? 'ลูกค้าอัปโหลดสลิปได้' : 'ปิดรับชำระเงินชั่วคราว'}
              htmlFor="st-payment-enabled"
              inline
            >
              <Switch
                id="st-payment-enabled"
                checked={localConfig.paymentEnabled !== false}
                onCheckedChange={(checked) => set({ paymentEnabled: checked })}
              />
            </SettingRow>
            {localConfig.paymentEnabled === false && (
              <SettingRow label="ข้อความแจ้งลูกค้า" description="ไม่บังคับ" htmlFor="st-payment-msg" stacked>
                <Textarea
                  id="st-payment-msg"
                  placeholder="เช่น ระบบปิดปรับปรุงถึง 18:00 น."
                  value={localConfig.paymentDisabledMessage || ''}
                  onChange={(e) => set({ paymentDisabledMessage: e.target.value })}
                  rows={2}
                />
              </SettingRow>
            )}
          </SettingSection>
        )}

        {/* ─── Name validation ─── */}
        {canManageShop && (
          <SettingSection id="st-names" icon={<Person />} title="ชื่อ-นามสกุลลูกค้า" description="กฎตรวจสอบชื่อที่ลูกค้ากรอกตอนสั่งซื้อ">
            <SettingRow label="ความยาว (ตัวอักษร)" description="ขั้นต่ำ – สูงสุด">
              <div className="flex items-center gap-2">
                <Input
                  id="name-min-length"
                  type="number"
                  aria-label="ความยาวขั้นต่ำ"
                  value={nv.minLength}
                  onChange={e => updateNV({ minLength: Math.max(1, Number(e.target.value) || 1) })}
                  min={1}
                  max={200}
                  className="h-9 w-20"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  id="name-max-length"
                  type="number"
                  aria-label="ความยาวสูงสุด"
                  value={nv.maxLength}
                  onChange={e => updateNV({ maxLength: Math.max(nv.minLength, Number(e.target.value) || 10) })}
                  min={nv.minLength}
                  max={500}
                  className="h-9 w-20"
                />
              </div>
            </SettingRow>
            <SettingRow label="ภาษาที่อนุญาต" description="ต้องเลือกอย่างน้อย 1 ภาษา">
              <div className="flex items-center gap-4">
                {([
                  { key: 'allowThai', label: 'ภาษาไทย' },
                  { key: 'allowEnglish', label: 'English' },
                ] as const).map((lang) => {
                  const other = lang.key === 'allowThai' ? 'allowEnglish' : 'allowThai';
                  const isLast = nv[lang.key] && !nv[other];
                  return (
                    <label key={lang.key} className={cn('flex items-center gap-2 text-sm', isLast ? 'cursor-not-allowed' : 'cursor-pointer')}>
                      <Checkbox
                        checked={nv[lang.key]}
                        disabled={isLast}
                        onCheckedChange={(checked) => updateNV({ [lang.key]: checked === true })}
                      />
                      {lang.label}
                    </label>
                  );
                })}
              </div>
            </SettingRow>
            <SettingRow
              label="อนุญาตอักษรพิเศษ"
              description={nv.allowSpecialChars ? 'เช่น จุด ขีด หรือ apostrophe ในชื่อ' : 'ปิดใช้งาน'}
              htmlFor="name-special-toggle"
            >
              <div className="flex items-center gap-3">
                {nv.allowSpecialChars ? (
                  <Input
                    id="name-special-chars"
                    aria-label="อักษรพิเศษที่อนุญาต"
                    value={nv.allowedSpecialChars}
                    onChange={e => updateNV({ allowedSpecialChars: e.target.value })}
                    placeholder=".-'"
                    className="h-9 w-28 font-mono"
                  />
                ) : null}
                <Switch
                  id="name-special-toggle"
                  checked={nv.allowSpecialChars}
                  onCheckedChange={checked => updateNV({ allowSpecialChars: checked })}
                />
              </div>
            </SettingRow>
            <div className="px-4 py-3 md:px-5">
              <Notice tone="success" icon={<Check />}>
                <span className="font-medium">ตัวอย่างที่ระบบยอมรับ: </span>
                {[
                  nv.allowThai && 'สมชาย ใจดี',
                  nv.allowEnglish && 'John Smith',
                  (nv.allowThai && nv.allowEnglish) && 'สมชาย Smith',
                  nv.allowSpecialChars && (nv.allowThai ? `สมชาย ใจ${nv.allowedSpecialChars[0] || '.'}ดี` : `John O${nv.allowedSpecialChars[0] || "'"}Brien`),
                ].filter(Boolean).join(' / ')}
                {` (${nv.minLength}–${nv.maxLength} ตัว)`}
              </Notice>
            </div>
          </SettingSection>
        )}

        {/* ─── Google Sheet ─── */}
        {canManageSheet && (
          <SettingSection
            id="st-sheet"
            icon={<FileSpreadsheet />}
            title="Google Sheet"
            description="ซิงก์ออเดอร์และสรุปการผลิตไปยังชีต"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => triggerSheetSync(localConfig.sheetId ? 'sync' : 'create')}
                disabled={sheetSyncing}
                className="shrink-0"
              >
                {sheetSyncing ? <Loader2 className="animate-spin" /> : <Bolt />}
                {sheetSyncing ? 'กำลังซิงก์…' : localConfig.sheetId ? 'ซิงก์ตอนนี้' : 'สร้างชีตใหม่'}
              </Button>
            }
          >
            <SettingRow
              label="ชีตหลัก"
              description="แท็บ Orders รวมทุกออเดอร์ และแท็บสรุปตามสินค้า — วาง Sheet ID หรือ URL ก็ได้"
              htmlFor="sheet-id"
              stacked
            >
              <div className="flex items-center gap-2">
                <Input
                  id="sheet-id"
                  placeholder="Sheet ID หรือ URL"
                  value={localConfig.sheetId || ''}
                  onChange={(e) => {
                    const { sheetId, sheetUrl } = extractSheetInfo(e.target.value);
                    set({ sheetId, sheetUrl });
                  }}
                  className="h-9 font-mono text-xs"
                />
                {localConfig.sheetUrl ? (
                  <Button variant="outline" size="sm" asChild className="shrink-0">
                    <a href={localConfig.sheetUrl} target="_blank" rel="noreferrer">
                      <ExternalLink /> เปิด
                    </a>
                  </Button>
                ) : null}
              </div>
            </SettingRow>
            <SettingRow
              label="ชีตสำหรับโรงงาน"
              description="ชีตแยกที่ตัดอีเมลและลิงก์สลิปออก (ไม่บังคับ)"
              htmlFor="vendor-sheet-id"
              stacked
            >
              <div className="flex items-center gap-2">
                <Input
                  id="vendor-sheet-id"
                  placeholder="Sheet ID หรือ URL"
                  value={localConfig.vendorSheetId || ''}
                  onChange={(e) => {
                    const { sheetId, sheetUrl } = extractSheetInfo(e.target.value);
                    set({ vendorSheetId: sheetId, vendorSheetUrl: sheetUrl });
                  }}
                  className="h-9 font-mono text-xs"
                />
                {localConfig.vendorSheetUrl ? (
                  <Button variant="outline" size="sm" asChild className="shrink-0">
                    <a href={localConfig.vendorSheetUrl} target="_blank" rel="noreferrer">
                      <ExternalLink /> เปิด
                    </a>
                  </Button>
                ) : null}
              </div>
            </SettingRow>
            <SettingRow
              label="แยกแท็บสรุปตามสินค้า"
              description='แต่ละสินค้าจะมีแท็บ "สรุป [ชื่อสินค้า]" พร้อมสรุปไซส์แยกกัน'
              htmlFor="sheet-per-product"
              inline
            >
              <Switch
                id="sheet-per-product"
                checked={localConfig.sheetSettings?.factoryPerProduct !== false}
                onCheckedChange={(checked) => set({ sheetSettings: { ...localConfig.sheetSettings, factoryPerProduct: checked } })}
              />
            </SettingRow>
            <SettingRow label="สถานะที่นำเข้าชีตสรุป" description="นับเฉพาะออเดอร์ในสถานะที่เลือก" stacked>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="สถานะที่นำเข้าชีตสรุป">
                {statusChoices.map((status) => {
                  const on = sheetStatuses.includes(status);
                  return (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSheetStatus(status)}
                      className={cn(
                        'inline-flex h-8 !min-h-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                        on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {on ? <Check className="size-3.5" /> : null}
                      {STATUS_LABEL_TH[status] || status}
                    </button>
                  );
                })}
              </div>
            </SettingRow>
            {localConfig.sheetSettings?.factoryPerProduct !== false && (localConfig.products?.length ?? 0) > 0 && (
              <div className="px-4 py-3 md:px-5">
                <Notice icon={<FileSpreadsheet />}>
                  <span className="font-medium">แท็บสรุปที่จะสร้าง: </span>
                  {(localConfig.products || [])
                    .filter((p) => p.isActive !== false)
                    .map((p) => `สรุป ${p.name}`)
                    .join(', ') || '—'}
                </Notice>
              </div>
            )}
          </SettingSection>
        )}

        {/* ─── Admins ─── */}
        {isSuperAdminUser && (
          <SettingSection
            id="st-admins"
            icon={<AdminPanelSettings />}
            title="แอดมิน"
            description={`เพิ่มแอดมินและกำหนดสิทธิ์ — ${adminEmails.length} คน`}
          >
            <div className="flex flex-col gap-3 px-4 py-3.5 md:px-5">
              <Notice icon={<Shield />}>
                {/* SUPER_ADMIN_EMAIL is a server-only env var (empty in the browser), so it is not displayed here */}
                บัญชีสูงสุด (Super Admin) มีสิทธิ์ทั้งหมดเสมอ และเป็นบัญชีเดียวที่จัดการแอดมินได้
              </Notice>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addAdmin();
                }}
              >
                <Input
                  type="email"
                  placeholder="อีเมลแอดมินใหม่"
                  aria-label="อีเมลแอดมินใหม่"
                  value={newAdminEmail}
                  onChange={(e) => onNewAdminEmailChange(e.target.value)}
                  className="h-9 flex-1"
                />
                <Button type="submit" disabled={!newAdminEmail.trim()}>
                  <PersonAdd /> เพิ่ม
                </Button>
              </form>
            </div>

            {adminEmails.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground md:px-5">ยังไม่มีแอดมินเพิ่มเติม</p>
            ) : (
              adminEmails.map((adminEmail, idx) => {
                const perms = permsFor(adminEmail);
                const enabledCount = PERMISSION_KEYS.filter((k) => perms[k]).length;
                const open = expandedAdmins.has(adminEmail);
                const toggleOpen = () =>
                  setExpandedAdmins((prev) => {
                    const next = new Set(prev);
                    if (next.has(adminEmail)) next.delete(adminEmail);
                    else next.add(adminEmail);
                    return next;
                  });
                const setAll = (value: boolean | 'default') => {
                  if (value === 'default') return setPermsFor(adminEmail, { ...DEFAULT_ADMIN_PERMISSIONS });
                  const all: AdminPermissions = {};
                  PERMISSION_KEYS.forEach((k) => {
                    all[k] = value;
                  });
                  setPermsFor(adminEmail, all);
                };
                return (
                  <div key={adminEmail}>
                    <div className="flex items-center gap-2 px-4 py-2.5 md:px-5">
                      <button
                        type="button"
                        onClick={toggleOpen}
                        aria-expanded={open}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground">
                          {adminEmail[0]}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{adminEmail}</span>
                          <span className="block text-xs text-muted-foreground">
                            สิทธิ์ {enabledCount}/{PERMISSION_KEYS.length}
                          </span>
                        </span>
                        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeAdmin(adminEmail, idx)}
                        aria-label={`ลบ ${adminEmail}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Delete />
                      </Button>
                    </div>
                    {open ? (
                      <div className="border-t border-dashed border-border bg-muted/30 px-4 py-3 md:px-5">
                        <div className="grid gap-4 sm:grid-cols-3">
                          {PERMISSION_GROUPS.map((group) => (
                            <div key={group.group}>
                              <p className="mb-1.5 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground [&_svg]:size-3.5">
                                {group.icon} {group.group}
                              </p>
                              <div className="flex flex-col gap-1.5">
                                {group.items.map((perm) => (
                                  <label key={perm.key} className="flex cursor-pointer items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={!!perms[perm.key]}
                                      onCheckedChange={(checked) => setPermsFor(adminEmail, { ...perms, [perm.key]: checked === true })}
                                    />
                                    {perm.label}
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                          <Button variant="outline" size="sm" onClick={() => setAll(true)}>
                            <Check /> เปิดทั้งหมด
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setAll(false)}>
                            <Close /> ปิดทั้งหมด
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setAll('default')}>
                            <RefreshCw /> ค่าเริ่มต้น
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </SettingSection>
        )}

        {/* ─── Pickup summary ─── */}
        {canManageShop && (
          <SettingSection
            id="st-pickup"
            icon={<LocalMall />}
            title="รับสินค้าหน้าร้าน"
            description={`เปิดรับ ${productsWithPickup.length} จาก ${localConfig.products?.length || 0} สินค้า — ตั้งค่าได้ที่เมนู ⋯ ของแต่ละสินค้าในหน้าจัดการสินค้า`}
          >
            {productsWithPickup.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground md:px-5">ยังไม่มีสินค้าที่เปิดรับหน้าร้าน</p>
            ) : (
              productsWithPickup.map((p) => (
                <div key={p.id} className="flex items-start gap-3 px-4 py-3 md:px-5">
                  <Check className="mt-0.5 size-4 shrink-0 text-success dark:text-success" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {p.pickup?.location && (
                        <span className="inline-flex items-center gap-1">
                          <Crosshair className="size-3" /> {p.pickup.location}
                        </span>
                      )}
                      {(p.pickup?.startDate || p.pickup?.endDate) && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3" />
                          {p.pickup?.startDate ? new Date(p.pickup.startDate).toLocaleDateString('th-TH') : '…'} –{' '}
                          {p.pickup?.endDate ? new Date(p.pickup.endDate).toLocaleDateString('th-TH') : '…'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </SettingSection>
        )}
      </div>

      {/* ─── Floating save bar ─── */}
      {hasChanges ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-3 md:bottom-6">
          <div
            role="status"
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-popover py-1.5 pr-1.5 pl-4 text-sm shadow-lg"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-warning" />
            <span className="font-medium whitespace-nowrap">มีการแก้ไขที่ยังไม่บันทึก</span>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={onReset} disabled={loading}>
              <Undo2 /> <span className="hidden sm:inline">ยกเลิก</span>
            </Button>
            <Button size="sm" className="rounded-full" onClick={onSave} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Save />}
              บันทึก
              <Kbd className="ml-1 hidden border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground md:inline-flex">Ctrl S</Kbd>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
});
