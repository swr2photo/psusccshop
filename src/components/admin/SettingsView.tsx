import React from 'react';
import {
  Box,
  Typography,
  Switch,
  TextField,
  Button,
  Chip,
  FormControlLabel,
  Alert,
  IconButton,
} from '@mui/material';
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

import {
  ADMIN_THEME,
  adminGlassCardSx as glassCardSx,
  adminInputSx as inputSx,
  adminGradientButtonSx as gradientButtonSx,
} from '@/lib/adminTheme';

// ============== SETTINGS COMPONENTS ==============
const SettingSection = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <Box sx={{
    ...glassCardSx,
    overflow: 'hidden',
  }}>
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      p: 2.5,
      borderBottom: `1px solid ${ADMIN_THEME.border}`,
      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)',
    }}>
      <Box sx={{
        width: 40,
        height: 40,
        borderRadius: '12px',
        background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
      }}>
        {icon}
      </Box>
      <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>
        {title}
      </Typography>
    </Box>
    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {children}
    </Box>
  </Box>
);

const SettingToggleRow = ({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) => (
  <Box sx={{ 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    py: 0.5,
  }}>
    <Box>
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--foreground)' }}>{label}</Typography>
      {description && (
        <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{description}</Typography>
      )}
    </Box>
    <Switch
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      sx={{
        '& .MuiSwitch-switchBase.Mui-checked': {
          color: '#10b981',
        },
        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
          backgroundColor: '#10b981',
        },
      }}
    />
  </Box>
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 700 }}>
      {/* Header with Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Settings size={24} />
            ตั้งค่าร้านค้า
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {isSuperAdminUser ? 'จัดการการตั้งค่าทั้งหมดของร้าน' : 'จัดการประกาศและการตั้งค่าที่ได้รับอนุญาต'}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, opacity: hasChanges ? 1 : 0, pointerEvents: hasChanges ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
          <Button
            variant="outlined"
            onClick={onReset}
            sx={{
              borderColor: ADMIN_THEME.border,
              color: ADMIN_THEME.muted,
              borderRadius: '10px',
              textTransform: 'none',
              '&:hover': { borderColor: '#ef4444', color: '#ef4444' },
            }}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            onClick={onSave}
            startIcon={<Save />}
            sx={{
              background: ADMIN_THEME.gradient,
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
              animation: hasChanges ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%, 100%': { boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)' },
                '50%': { boxShadow: '0 4px 25px rgba(139, 92, 246, 0.5)' },
              },
            }}
          >
            บันทึกการตั้งค่า
          </Button>
        </Box>
      </Box>

      {/* Unsaved Changes Warning - use opacity instead of conditional render to prevent layout shift */}
      <Box sx={{
        p: 2,
        borderRadius: '12px',
        bgcolor: 'rgba(251, 191, 36, 0.1)',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        opacity: hasChanges ? 1 : 0,
        maxHeight: hasChanges ? 100 : 0,
        overflow: 'hidden',
        transition: 'opacity 0.2s, max-height 0.2s',
        mb: hasChanges ? 0 : -3,
      }}>
        <Warning size={24} color="#fbbf24" />
        <Typography sx={{ fontSize: '0.9rem', color: '#fbbf24' }}>
          มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก กดปุ่ม "บันทึกการตั้งค่า" เพื่อยืนยัน
        </Typography>
      </Box>

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
            <Box sx={{ 
              mt: 1, 
              p: 2, 
              borderRadius: '12px', 
              bgcolor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              <Box>
                <Typography sx={{ fontSize: '0.85rem', color: '#f87171', mb: 1 }}>
                  <CalendarToday size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                  กำหนดวันเปิดร้านใหม่ (ถ้ามี)
                </Typography>
                <TextField
                  type="datetime-local"
                  value={localConfig.openDate || ''}
                  onChange={(e) => onConfigChange({...localConfig, openDate: e.target.value})}
                  placeholder="เช่น 2025-01-20T09:00"
                  fullWidth
                  sx={{
                    ...inputSx,
                    '& .MuiOutlinedInput-root': {
                      ...inputSx['& .MuiOutlinedInput-root'],
                      borderRadius: '10px',
                    },
                  }}
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.85rem', color: '#f87171', mb: 1 }}>
                  <Warning size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                  ข้อความแจ้งผู้ใช้ (ไม่บังคับ)
                </Typography>
                <TextField
                  placeholder="เช่น: ร้านปิดปรับปรุงถึงวันที่ 20 ม.ค."
                  value={localConfig.closedMessage || ''}
                  onChange={(e) => onConfigChange({...localConfig, closedMessage: e.target.value})}
                  fullWidth
                  multiline
                  rows={2}
                  sx={{
                    ...inputSx,
                    '& .MuiOutlinedInput-root': {
                      ...inputSx['& .MuiOutlinedInput-root'],
                      borderRadius: '10px',
                    },
                  }}
                />
              </Box>
            </Box>
          )}
          
          {/* Close Date - กำหนดวันปิดรับออเดอร์ */}
          {localConfig.isOpen && (
            <Box sx={{ 
              mt: 1, 
              p: 2, 
              borderRadius: '12px', 
              bgcolor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
            }}>
              <Typography sx={{ fontSize: '0.85rem', color: '#fbbf24', mb: 1 }}>
                <CalendarToday size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                กำหนดวันปิดรับออเดอร์ (ไม่บังคับ)
              </Typography>
              <TextField
                type="datetime-local"
                value={localConfig.closeDate || ''}
                onChange={(e) => onConfigChange({...localConfig, closeDate: e.target.value})}
                placeholder="เช่น 2025-01-25T23:59"
                fullWidth
                sx={{
                  ...inputSx,
                  '& .MuiOutlinedInput-root': {
                    ...inputSx['& .MuiOutlinedInput-root'],
                    borderRadius: '10px',
                  },
                }}
              />
              <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', mt: 1 }}>
                เมื่อถึงวันนี้ ระบบจะแสดงสถานะ "หมดเขตสั่งซื้อ" โดยอัตโนมัติ
              </Typography>
            </Box>
          )}
        </SettingSection>
      )}

      {/* Payment System Toggle - Only for Super Admin or admins with shop permission */}
      {canManageShop && (
        <SettingSection icon={<AttachMoney size={20} />} title="ระบบชำระเงิน">
          {/* Mapped AttachMoney icon to Store for simple reuse, or we can use local label */}
          <SettingToggleRow
            label="เปิดรับชำระเงิน"
            description={localConfig.paymentEnabled !== false ? 'ผู้ใช้สามารถอัพโหลดสลิปได้' : 'ปิดรับชำระเงินชั่วคราว'}
            checked={localConfig.paymentEnabled !== false}
            onChange={(checked) => onConfigChange({...localConfig, paymentEnabled: checked})}
          />
          {localConfig.paymentEnabled === false && (
            <Box sx={{ 
              mt: 1, 
              p: 2, 
              borderRadius: '12px', 
              bgcolor: 'rgba(249, 115, 22, 0.1)',
              border: '1px solid rgba(249, 115, 22, 0.2)',
            }}>
              <Typography sx={{ fontSize: '0.85rem', color: '#fb923c', mb: 1.5 }}>
                <Warning size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                ข้อความแจ้งผู้ใช้ (ไม่บังคับ)
              </Typography>
              <TextField
                placeholder="เช่น: ระบบปิดปรับปรุงถึง 18:00 น."
                value={localConfig.paymentDisabledMessage || ''}
                onChange={(e) => onConfigChange({...localConfig, paymentDisabledMessage: e.target.value})}
                fullWidth
                multiline
                rows={2}
                sx={{
                  ...inputSx,
                  '& .MuiOutlinedInput-root': {
                    ...inputSx['& .MuiOutlinedInput-root'],
                    borderRadius: '10px',
                  },
                }}
              />
            </Box>
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
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Length settings */}
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField
                    type="number"
                    label="ความยาวขั้นต่ำ"
                    value={nv.minLength}
                    onChange={e => updateNV({ minLength: Math.max(1, Number(e.target.value) || 1) })}
                    inputProps={{ min: 1, max: 200 }}
                    size="small"
                    sx={{
                      flex: 1,
                      ...inputSx,
                      '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], borderRadius: '10px' },
                    }}
                  />
                  <TextField
                    type="number"
                    label="ความยาวสูงสุด"
                    value={nv.maxLength}
                    onChange={e => updateNV({ maxLength: Math.max(nv.minLength, Number(e.target.value) || 10) })}
                    inputProps={{ min: nv.minLength, max: 500 }}
                    size="small"
                    sx={{
                      flex: 1,
                      ...inputSx,
                      '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], borderRadius: '10px' },
                    }}
                  />
                </Box>

                {/* Language toggles */}
                <Box sx={{
                  p: 2,
                  borderRadius: '12px',
                  bgcolor: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.2)',
                }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#818cf8', mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Groups size={14} /> ภาษาที่อนุญาต
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {[
                      { key: 'allowThai' as const, label: 'ภาษาไทย', color: '#0071e3' },
                      { key: 'allowEnglish' as const, label: 'English', color: '#10b981' },
                    ].map(lang => (
                      <Box
                        key={lang.key}
                        onClick={() => {
                          // Don't allow disabling all languages
                          if (nv[lang.key] && !Object.entries(nv).some(([k, v]) => k !== lang.key && k.startsWith('allow') && k !== 'allowSpecialChars' && v === true)) return;
                          updateNV({ [lang.key]: !nv[lang.key] });
                        }}
                        sx={{
                          px: 2,
                          py: 1,
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          bgcolor: nv[lang.key] ? `${lang.color}15` : 'rgba(255,255,255,0.05)',
                          color: nv[lang.key] ? lang.color : '#64748b',
                          border: `1.5px solid ${nv[lang.key] ? lang.color : 'transparent'}`,
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: nv[lang.key] ? `${lang.color}25` : 'rgba(255,255,255,0.1)',
                          },
                        }}
                      >
                        {lang.label}
                      </Box>
                    ))}
                  </Box>
                </Box>

                {/* Special characters */}
                <SettingToggleRow
                  label="อนุญาตอักษรพิเศษ"
                  description={nv.allowSpecialChars ? `ตัวอักษรที่อนุญาต: ${nv.allowedSpecialChars}` : 'ปิดใช้งาน'}
                  checked={nv.allowSpecialChars}
                  onChange={checked => updateNV({ allowSpecialChars: checked })}
                />
                {nv.allowSpecialChars && (
                  <TextField
                    label="อักษรพิเศษที่อนุญาต"
                    value={nv.allowedSpecialChars}
                    onChange={e => updateNV({ allowedSpecialChars: e.target.value })}
                    placeholder=".-'"
                    helperText="กรอกตัวอักษรพิเศษที่ต้องการอนุญาต เช่น . - ' ( )"
                    size="small"
                    sx={{
                      ...inputSx,
                      '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], borderRadius: '10px' },
                    }}
                  />
                )}

                {/* Preview */}
                <Box sx={{
                  p: 1.5,
                  borderRadius: '10px',
                  bgcolor: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CheckCircle size={14} /> ตัวอย่างที่ระบบจะยอมรับ:
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {[
                      nv.allowThai && 'สมชาย ใจดี',
                      nv.allowEnglish && 'John Smith',
                      (nv.allowThai && nv.allowEnglish) && 'สมชาย Smith',
                      nv.allowSpecialChars && (nv.allowThai ? `สมชาย ใจ${nv.allowedSpecialChars[0] || '.'}ดี` : `John O${nv.allowedSpecialChars[0] || "'"}Brien`),
                    ].filter(Boolean).join(' / ')}
                    {` (${nv.minLength}-${nv.maxLength} ตัว)`}
                  </Typography>
                </Box>
              </Box>
            );
          })()}
        </SettingSection>
      )}

      {/* Google Sheet - Only for Super Admin or admins with permission */}
      {canManageSheet && (
        <SettingSection icon={<Bolt size={20} />} title="Google Sheet">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Sheet ID (ออเดอร์ + สรุปการผลิต)"
              placeholder="วาง Sheet ID หรือ URL ก็ได้"
              value={localConfig.sheetId || ''}
              onChange={(e) => {
                const { sheetId, sheetUrl } = extractSheetInfo(e.target.value);
                onConfigChange({ ...localConfig, sheetId, sheetUrl });
              }}
              fullWidth
              sx={{
                ...inputSx,
                '& .MuiOutlinedInput-root': {
                  ...inputSx['& .MuiOutlinedInput-root'],
                  borderRadius: '10px',
                },
              }}
              helperText="ชีตหลัก — แท็บ Orders รวมทุกออเดอร์ และแท็บสรุปตามสินค้า"
            />

            <TextField
              label="Vendor Sheet ID"
              placeholder="วาง Sheet ID หรือ URL ให้โรงงาน"
              value={localConfig.vendorSheetId || ''}
              onChange={(e) => {
                const { sheetId, sheetUrl } = extractSheetInfo(e.target.value);
                onConfigChange({ ...localConfig, vendorSheetId: sheetId, vendorSheetUrl: sheetUrl });
              }}
              fullWidth
              sx={{
                ...inputSx,
                '& .MuiOutlinedInput-root': {
                  ...inputSx['& .MuiOutlinedInput-root'],
                  borderRadius: '10px',
                },
              }}
              helperText="ชีตแยกสำหรับส่งให้โรงงาน (ตัดอีเมล/ลิงก์สลิปออก) — ไม่บังคับ"
            />

            <Box sx={{
              p: 2,
              borderRadius: '12px',
              bgcolor: 'var(--surface-2)',
              border: `1px solid ${ADMIN_THEME.border}`,
            }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.sheetSettings?.factoryPerProduct !== false}
                    onChange={(e) => onConfigChange({
                      ...localConfig,
                      sheetSettings: {
                        ...localConfig.sheetSettings,
                        factoryPerProduct: e.target.checked,
                      },
                    })}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#10b981' },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>
                      แยกชีตสรุปตามสินค้า
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      แต่ละสินค้าจะมีแท็บชื่อ &quot;สรุป [ชื่อสินค้า]&quot; พร้อมรายการและสรุปไซซ์แยกกัน
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', ml: 0, mr: 0 }}
              />

              <TextField
                label="สถานะออเดอร์ที่นำเข้าชีตสรุป"
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
                fullWidth
                size="small"
                sx={{ mt: 1.5, ...inputSx }}
                helperText="คั่นด้วยจุลภาค เช่น PAID หรือ PAID, READY"
              />

              {localConfig.sheetSettings?.factoryPerProduct !== false && (localConfig.products?.length ?? 0) > 0 && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', mb: 0.75 }}>
                    แท็บสรุปที่จะสร้างเมื่อมีออเดอร์:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(localConfig.products || [])
                      .filter((p) => p.isActive !== false)
                      .map((p) => (
                        <Chip
                          key={p.id}
                          label={`สรุป ${p.name}`}
                          size="small"
                          sx={{ fontSize: '0.7rem', bgcolor: 'rgba(99,102,241,0.12)', color: '#6366f1' }}
                        />
                      ))}
                  </Box>
                </Box>
              )}
            </Box>
            
            {localConfig.sheetUrl && (
              <Box sx={{
                p: 2,
                borderRadius: '12px',
                bgcolor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}>
                <Box sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  bgcolor: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Check size={20} color="#fff" />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#10b981' }}>
                    เชื่อมต่อแล้ว
                  </Typography>
                  <Typography 
                    component="a"
                    href={localConfig.sheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ 
                      fontSize: '0.8rem', 
                      color: 'var(--text-muted)',
                      textDecoration: 'underline',
                      '&:hover': { color: 'var(--text-muted)' },
                    }}
                  >
                    เปิด Google Sheet
                  </Typography>
                </Box>
              </Box>
            )}

            {localConfig.vendorSheetUrl && (
              <Box sx={{
                p: 2,
                borderRadius: '12px',
                bgcolor: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}>
                <Box sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  bgcolor: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Check size={20} color="#fff" />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#3b82f6' }}>
                    เชื่อมต่อชีตโรงงานแล้ว
                  </Typography>
                  <Typography 
                    component="a"
                    href={localConfig.vendorSheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ 
                      fontSize: '0.8rem', 
                      color: 'var(--text-muted)',
                      textDecoration: 'underline',
                      '&:hover': { color: 'var(--text-muted)' },
                    }}
                  >
                    เปิด Vendor Sheet
                  </Typography>
                </Box>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                onClick={() => triggerSheetSync(localConfig.sheetId ? 'sync' : 'create')}
                disabled={sheetSyncing}
                sx={{ ...gradientButtonSx, flex: 1, gap: 1 }}
              >
                <Bolt size={18} />
                {sheetSyncing ? 'กำลังซิงก์...' : localConfig.sheetId ? 'ซิงก์ทันที' : 'สร้าง Sheet ใหม่'}
              </Button>
            </Box>
          </Box>
        </SettingSection>
      )}

      {/* Admin Management - Only visible to Super Admin */}
      {isSuperAdminUser && (
        <SettingSection icon={<AdminPanelSettings size={20} />} title="จัดการแอดมิน">
          <Box sx={{ mb: 2 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1, 
              mb: 1.5,
              p: 1.5,
              borderRadius: '10px',
              bgcolor: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
            }}>
              <Shield size={18} color="#fbbf24" />
              <Typography sx={{ fontSize: '0.8rem', color: '#fbbf24' }}>
                เฉพาะบัญชีสูงสุดเท่านั้นที่สามารถจัดการแอดมินได้
              </Typography>
            </Box>
            
            {/* Super Admin Badge */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1.5, 
              p: 2,
              borderRadius: '12px',
              bgcolor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              mb: 2,
            }}>
              <Box sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Shield size={20} color="#fff" />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>บัญชีสูงสุด (Super Admin)</Typography>
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#34d399' }}>
                  {SUPER_ADMIN_EMAIL}
                </Typography>
              </Box>
            </Box>

            {/* Add Admin Form */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                placeholder="กรอกอีเมลแอดมินใหม่..."
                value={newAdminEmail}
                onChange={(e) => onNewAdminEmailChange(e.target.value)}
                fullWidth
                size="small"
                sx={{
                  ...inputSx,
                  '& .MuiOutlinedInput-root': {
                    ...inputSx['& .MuiOutlinedInput-root'],
                    borderRadius: '10px',
                  },
                }}
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
                sx={{
                  ...gradientButtonSx,
                  minWidth: 100,
                  whiteSpace: 'nowrap',
                }}
              >
                <PersonAdd size={18} style={{ marginRight: 4 }} />
                เพิ่ม
              </Button>
            </Box>

            {/* Admin List */}
            <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', mb: 1 }}>
              รายชื่อแอดมิน ({(localConfig.adminEmails || []).length} คน)
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {(localConfig.adminEmails || []).length === 0 ? (
                <Box sx={{
                  p: 2,
                  borderRadius: '10px',
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${ADMIN_THEME.border}`,
                  textAlign: 'center',
                }}>
                  <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    ยังไม่มีแอดมินเพิ่มเติม
                  </Typography>
                </Box>
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
                    <Box
                      key={idx}
                      sx={{
                        borderRadius: '12px',
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: `1px solid ${ADMIN_THEME.border}`,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Admin Header */}
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        borderBottom: `1px solid ${ADMIN_THEME.border}`,
                        bgcolor: 'rgba(139, 92, 246, 0.05)',
                      }}>
                        <Box sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '8px',
                          bgcolor: 'rgba(139, 92, 246, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Person size={18} color="#a78bfa" />
                        </Box>
                        <Typography sx={{ flex: 1, fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                          {adminEmail}
                        </Typography>
                        <IconButton
                          size="small"
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
                          sx={{
                            color: '#ef4444',
                            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' },
                          }}
                        >
                          <Delete size={18} />
                        </IconButton>
                      </Box>
                      
                      {/* Permissions */}
                      <Box sx={{ p: 1.5 }}>
                        <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', mb: 1 }}>สิทธิ์การใช้งาน:</Typography>
                        
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
                          <Box key={group.group} sx={{ mb: 1.5 }}>
                            <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mb: 0.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {group.groupIcon} {group.group}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {group.items.map(perm => (
                                <Box
                                  key={perm.key}
                                  onClick={() => togglePermission(perm.key, !perms[perm.key as keyof AdminPermissions])}
                                  sx={{
                                    px: 1.5,
                                    py: 0.5,
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    bgcolor: perms[perm.key as keyof AdminPermissions] 
                                      ? `${perm.color}20` 
                                      : 'rgba(255,255,255,0.05)',
                                    color: perms[perm.key as keyof AdminPermissions] 
                                      ? perm.color 
                                      : '#64748b',
                                    border: `1px solid ${perms[perm.key as keyof AdminPermissions] 
                                      ? perm.color 
                                      : 'transparent'}`,
                                    transition: 'all 0.2s ease',
                                    '&:hover': { 
                                      bgcolor: perms[perm.key as keyof AdminPermissions] 
                                        ? `${perm.color}30` 
                                        : 'rgba(255,255,255,0.1)',
                                    },
                                  }}
                                >
                                  {perm.label}
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        ))}

                        {/* Quick Actions */}
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, pt: 1, borderTop: `1px solid ${ADMIN_THEME.border}` }}>
                          <Box
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
                            sx={{
                              px: 1.5,
                              py: 0.4,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              bgcolor: 'rgba(16,185,129,0.1)',
                              color: '#10b981',
                              border: '1px solid rgba(16,185,129,0.3)',
                              '&:hover': { bgcolor: 'rgba(16,185,129,0.2)' },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Check size={12} /> เปิดทั้งหมด</Box>
                          </Box>
                          <Box
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
                            sx={{
                              px: 1.5,
                              py: 0.4,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              bgcolor: 'rgba(239,68,68,0.1)',
                              color: '#ef4444',
                              border: '1px solid rgba(239,68,68,0.3)',
                              '&:hover': { bgcolor: 'rgba(239,68,68,0.2)' },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Close size={12} /> ปิดทั้งหมด</Box>
                          </Box>
                          <Box
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
                            sx={{
                              px: 1.5,
                              py: 0.4,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              bgcolor: 'rgba(99,102,241,0.1)',
                              color: '#6366f1',
                              border: '1px solid rgba(99,102,241,0.3)',
                              '&:hover': { bgcolor: 'rgba(99,102,241,0.2)' },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><RefreshCw size={12} /> ค่าเริ่มต้น</Box>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  );
                })
              )}
            </Box>
          </Box>
        </SettingSection>
      )}

      {/* Pickup Settings - Per Product Summary */}
      {canManageShop && (
        <SettingSection icon={<LocalMall size={20} />} title="สถานะรับสินค้า">
          {/* Summary of products with pickup enabled */}
          {(() => {
            const productsWithPickup = localConfig.products?.filter(p => p.pickup?.enabled) || [];
            const totalProducts = localConfig.products?.length || 0;
            
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2,
                  p: 2,
                  borderRadius: '12px',
                  bgcolor: productsWithPickup.length > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${productsWithPickup.length > 0 ? 'rgba(16,185,129,0.3)' : ADMIN_THEME.border}`,
                }}>
                  <LocalMall size={32} color={productsWithPickup.length > 0 ? '#10b981' : ADMIN_THEME.muted} />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 700, color: ADMIN_THEME.text }}>
                      {productsWithPickup.length > 0 
                        ? `เปิดรับ ${productsWithPickup.length} สินค้า` 
                        : 'ยังไม่มีสินค้าเปิดรับ'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: ADMIN_THEME.muted }}>
                      จากทั้งหมด {totalProducts} สินค้า
                    </Typography>
                  </Box>
                </Box>

                {productsWithPickup.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {productsWithPickup.map(p => (
                      <Box 
                        key={p.id}
                        sx={{
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: 'rgba(6,182,212,0.05)',
                          border: `1px solid rgba(6,182,212,0.15)`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                        }}
                      >
                        <CheckCircle size={18} color="#10b981" />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ 
                            fontWeight: 600, 
                            color: ADMIN_THEME.text,
                            fontSize: '0.85rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {p.name}
                          </Typography>
                          {p.pickup?.location && (
                            <Typography sx={{ fontSize: '0.75rem', color: ADMIN_THEME.muted, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Crosshair size={12} /> {p.pickup.location}
                            </Typography>
                          )}
                          {(p.pickup?.startDate || p.pickup?.endDate) && (
                            <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CalendarDays size={12} /> {p.pickup?.startDate ? new Date(p.pickup.startDate).toLocaleDateString('th-TH') : '...'} - {p.pickup?.endDate ? new Date(p.pickup.endDate).toLocaleDateString('th-TH') : '...'}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}

                <Alert 
                  severity="info" 
                  sx={{ 
                    bgcolor: 'rgba(99,102,241,0.1)', 
                    border: '1px solid rgba(99,102,241,0.2)',
                    '& .MuiAlert-icon': { color: '#6366f1' },
                    fontSize: '0.8rem',
                  }}
                >
                  ไปที่แท็บ <strong>สินค้า</strong> และกดปุ่ม "ตั้งค่ารับสินค้า" ในแต่ละสินค้าเพื่อเปิด/ปิดการรับสินค้า
                </Alert>
              </Box>
            );
          })()}
        </SettingSection>
      )}

      {/* Save Status */}
      <Box sx={{ 
        ...glassCardSx,
        p: 2,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: hasChanges ? '#f59e0b' : '#10b981',
            boxShadow: `0 0 12px ${hasChanges ? '#f59e0b' : '#10b981'}`,
          }} />
          <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {hasChanges ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'บันทึกล่าสุด: ' + (lastSavedTime ? lastSavedTime.toLocaleString('th-TH') : '-')}
          </Typography>
        </Box>
        <Button
          onClick={onSave}
          disabled={!hasChanges || loading}
          sx={{
            ...gradientButtonSx,
            minWidth: 120,
            opacity: hasChanges ? 1 : 0.5,
          }}
        >
          <Save size={18} style={{ marginRight: 8 }} />
          บันทึก
        </Button>
      </Box>
    </Box>
  );
});
