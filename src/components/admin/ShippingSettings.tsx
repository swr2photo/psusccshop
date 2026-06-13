'use client';

import { apiFetch } from '@/lib/api-client';
import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  TextField,
  Button,
  IconButton,
  Chip,
  Stack,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Tooltip,
  Collapse,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Truck as LocalShipping,
  Plus as Add,
  Trash2 as Delete,
  Pencil as Edit,
  Save,
  ChevronDown as ExpandMore,
  ChevronUp as ExpandLess,
  Copy as ContentCopy,
  ExternalLink as OpenInNew,
  Settings,
  Package as Inventory,
  Store,
} from 'lucide-react';
import {
  ShippingConfig,
  ShippingOption,
  ShippingProvider,
  SHIPPING_PROVIDERS,
  DEFAULT_SHIPPING_CONFIG,
} from '@/lib/shipping';
import { ADMIN_THEME, adminCardSx, adminDialogPaperSx, adminInputSxCompact as inputSx } from '@/lib/adminTheme';

interface ShippingSettingsProps {
  onSave?: () => void;
}

export default function ShippingSettings({ onSave }: ShippingSettingsProps) {
  const [config, setConfig] = useState<ShippingConfig>(DEFAULT_SHIPPING_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ShippingOption | null>(null);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/shipping/options');
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
      } else {
        setError('Failed to load shipping config');
      }
    } catch (err) {
      setError('Failed to load shipping config');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      setError(null);
      
      const res = await apiFetch('/api/shipping/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      
      const data = await res.json();
      if (data.success) {
        setSuccess('บันทึกการตั้งค่าสำเร็จ');
        setTimeout(() => setSuccess(null), 3000);
        onSave?.();
      } else {
        const errorMsg = data.details 
          ? `${data.error}: ${data.details}` 
          : (data.error || 'Failed to save');
        setError(errorMsg);
      }
    } catch (err) {
      setError('Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const toggleOptionEnabled = (optionId: string) => {
    setConfig(prev => ({
      ...prev,
      options: prev.options.map(opt =>
        opt.id === optionId ? { ...opt, enabled: !opt.enabled } : opt
      ),
    }));
  };

  const updateOption = (optionId: string, updates: Partial<ShippingOption>) => {
    setConfig(prev => ({
      ...prev,
      options: prev.options.map(opt =>
        opt.id === optionId ? { ...opt, ...updates } : opt
      ),
    }));
  };

  const deleteOption = (optionId: string) => {
    if (!confirm('ต้องการลบตัวเลือกนี้?')) return;
    setConfig(prev => ({
      ...prev,
      options: prev.options.filter(opt => opt.id !== optionId),
    }));
  };

  const addOption = (option: ShippingOption) => {
    setConfig(prev => ({
      ...prev,
      options: [...prev.options, option],
    }));
    setAddDialogOpen(false);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="textSecondary">กำลังโหลด...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LocalShipping size={28} color={ADMIN_THEME.primary} />
          <Typography variant="h5" fontWeight="bold">
            ตั้งค่าการจัดส่ง
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={saveConfig}
          disabled={saving}
          sx={{
            bgcolor: ADMIN_THEME.primary,
            '&:hover': { bgcolor: ADMIN_THEME.accent },
          }}
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* General Settings */}
      <Card sx={{ 
        mb: 3, 
        bgcolor: ADMIN_THEME.glass,
        border: `1px solid ${ADMIN_THEME.border}`,
        borderRadius: '12px',
      }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Settings size={20} />
            ตั้งค่าทั่วไป
          </Typography>
          
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography>แสดงตัวเลือกการจัดส่ง</Typography>
                <Typography variant="caption" color="textSecondary">
                  ให้ลูกค้าเลือกวิธีจัดส่งเอง
                </Typography>
              </Box>
              <Switch
                checked={config.showOptions}
                onChange={(e) => setConfig(prev => ({ ...prev, showOptions: e.target.checked }))}
                color="secondary"
              />
            </Box>

            <Divider sx={{ borderColor: ADMIN_THEME.border }} />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography>เปิดให้รับหน้าร้าน</Typography>
                <Typography variant="caption" color="textSecondary">
                  ลูกค้าสามารถมารับสินค้าได้
                </Typography>
              </Box>
              <Switch
                checked={config.allowPickup}
                onChange={(e) => setConfig(prev => ({ ...prev, allowPickup: e.target.checked }))}
                color="secondary"
              />
            </Box>

            {config.allowPickup && (
              <Box sx={{ pl: 2 }}>
                <TextField
                  label="สถานที่รับสินค้า"
                  value={config.pickupLocation || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, pickupLocation: e.target.value }))}
                  fullWidth
                  sx={inputSx}
                  size="small"
                />
                <TextField
                  label="คำแนะนำ"
                  value={config.pickupInstructions || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, pickupInstructions: e.target.value }))}
                  fullWidth
                  multiline
                  rows={2}
                  sx={{ ...inputSx, mt: 2 }}
                  size="small"
                  placeholder="เช่น: รับได้วันจันทร์-ศุกร์ 10:00-16:00 น."
                />
              </Box>
            )}

            <Divider sx={{ borderColor: ADMIN_THEME.border }} />

            <TextField
              label="ส่งฟรีขั้นต่ำ (บาท)"
              type="number"
              value={config.globalFreeShippingMinimum || ''}
              onChange={(e) => setConfig(prev => ({ 
                ...prev, 
                globalFreeShippingMinimum: e.target.value ? parseInt(e.target.value) : undefined 
              }))}
              fullWidth
              sx={inputSx}
              size="small"
              helperText="ยอดสั่งซื้อขั้นต่ำที่ส่งฟรี (เว้นว่างไม่มี)"
              InputProps={{
                endAdornment: <InputAdornment position="end">฿</InputAdornment>,
              }}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Track123 API Info */}
      <Card sx={{ 
        mb: 3, 
        bgcolor: 'rgba(30, 64, 175, 0.1)', 
        border: '1px solid rgba(30, 64, 175, 0.3)',
        borderRadius: '12px',
      }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#a78bfa' }}>
            <OpenInNew size={20} />
            Track123 API (ระบบติดตามพัสดุ)
          </Typography>
          
          <Typography variant="body2" sx={{ mb: 2, color: 'var(--text-muted)' }}>
            ระบบใช้ Track123 API สำหรับติดตามพัสดุจากทุกขนส่ง รองรับการติดตามแบบ batch และ webhook
          </Typography>
          
          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip 
                label="Thailand Post" 
                size="small"
                sx={{ bgcolor: ADMIN_THEME.glassSoft }}
              />
              <Chip 
                label="Kerry Express" 
                size="small"
                sx={{ bgcolor: ADMIN_THEME.glassSoft }}
              />
              <Chip 
                label="J&T Express" 
                size="small"
                sx={{ bgcolor: ADMIN_THEME.glassSoft }}
              />
              <Chip 
                label="Flash Express" 
                size="small"
                sx={{ bgcolor: ADMIN_THEME.glassSoft }}
              />
              <Chip 
                label="+1700 carriers" 
                size="small"
                sx={{ bgcolor: 'rgba(30, 64, 175, 0.2)', color: '#a78bfa' }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenInNew />}
                href="https://member.track123.com/api"
                target="_blank"
                sx={{
                  borderColor: 'rgba(30, 64, 175, 0.5)',
                  color: '#a78bfa',
                  '&:hover': { borderColor: ADMIN_THEME.primary, bgcolor: 'rgba(99,102,241,0.1)' },
                }}
              >
                ดู API Key
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenInNew />}
                href="https://docs.track123.com/reference/request"
                target="_blank"
                sx={{
                  borderColor: ADMIN_THEME.border,
                  color: 'var(--text-muted)',
                  '&:hover': { borderColor: ADMIN_THEME.primary },
                }}
              >
                API Docs
              </Button>
            </Box>
            
            <Alert severity="info" sx={{ bgcolor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <Typography variant="caption">
                ตั้งค่า <code>TRACK123_API_KEY</code> ใน .env.local เพื่อเปิดใช้งานการติดตามพัสดุอัตโนมัติ
              </Typography>
            </Alert>
          </Stack>
        </CardContent>
      </Card>

      {/* Shipping Options */}
      <Card sx={{ 
        bgcolor: ADMIN_THEME.glass,
        border: `1px solid ${ADMIN_THEME.border}`,
        borderRadius: '12px',
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Inventory size={20} />
              ตัวเลือกการจัดส่ง
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={() => setAddDialogOpen(true)}
              sx={{
                borderColor: ADMIN_THEME.primary,
                color: ADMIN_THEME.primary,
                '&:hover': { borderColor: '#7c3aed', bgcolor: 'rgba(30, 64, 175, 0.1)' },
              }}
            >
              เพิ่ม
            </Button>
          </Box>

          <Stack spacing={1}>
            {config.options.map((option) => (
              <ShippingOptionCard
                key={option.id}
                option={option}
                expanded={expandedOption === option.id}
                onToggleExpand={() => setExpandedOption(expandedOption === option.id ? null : option.id)}
                onToggleEnabled={() => toggleOptionEnabled(option.id)}
                onUpdate={(updates) => updateOption(option.id, updates)}
                onDelete={() => deleteOption(option.id)}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Add Option Dialog */}
      <AddShippingOptionDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={addOption}
      />
    </Box>
  );
}

// Shipping Option Card Component
function ShippingOptionCard({
  option,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onUpdate,
  onDelete,
}: {
  option: ShippingOption;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onUpdate: (updates: Partial<ShippingOption>) => void;
  onDelete: () => void;
}) {
  const providerInfo = SHIPPING_PROVIDERS[option.provider];

  return (
    <Card sx={{
      bgcolor: option.enabled ? 'rgba(99,102,241,0.1)' : ADMIN_THEME.glassSoft,
      border: `1px solid ${option.enabled ? 'rgba(99,102,241,0.3)' : ADMIN_THEME.border}`,
      borderRadius: '10px',
      transition: 'all 0.2s',
    }}>
      <Box sx={{ p: 2 }}>
        {/* Header Row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Switch
            checked={option.enabled}
            onChange={onToggleEnabled}
            color="secondary"
            size="small"
          />
          
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography fontWeight="bold">{option.name}</Typography>
              <Chip 
                label={providerInfo?.nameThai || option.provider} 
                size="small" 
                sx={{ 
                  bgcolor: ADMIN_THEME.glassSoft,
                  fontSize: '0.7rem',
                  height: '20px',
                }}
              />
            </Box>
            {option.description && (
              <Typography variant="caption" color="textSecondary">
                {option.description}
              </Typography>
            )}
          </Box>

          <Typography fontWeight="bold" sx={{ color: '#22d3ee', minWidth: '60px', textAlign: 'right' }}>
            {option.baseFee === 0 ? 'ฟรี' : `฿${option.baseFee}`}
          </Typography>

          <IconButton size="small" onClick={onToggleExpand}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        {/* Expanded Content */}
        <Collapse in={expanded}>
          <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${ADMIN_THEME.border}` }}>
            <Stack spacing={2}>
              <TextField
                label="ชื่อ"
                value={option.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                fullWidth
                size="small"
                sx={inputSx}
              />

              <TextField
                label="คำอธิบาย"
                value={option.description || ''}
                onChange={(e) => onUpdate({ description: e.target.value })}
                fullWidth
                size="small"
                sx={inputSx}
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="ค่าส่ง (บาท)"
                  type="number"
                  value={option.baseFee}
                  onChange={(e) => onUpdate({ baseFee: parseInt(e.target.value) || 0 })}
                  sx={{ ...inputSx, flex: 1 }}
                  size="small"
                />
                <TextField
                  label="ค่าส่งเพิ่ม/ชิ้น"
                  type="number"
                  value={option.perItemFee || ''}
                  onChange={(e) => onUpdate({ perItemFee: e.target.value ? parseInt(e.target.value) : undefined })}
                  sx={{ ...inputSx, flex: 1 }}
                  size="small"
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="จัดส่ง (วันต่ำสุด)"
                  type="number"
                  value={option.estimatedDays?.min || ''}
                  onChange={(e) => onUpdate({ 
                    estimatedDays: { 
                      ...option.estimatedDays, 
                      min: parseInt(e.target.value) || 1,
                      max: option.estimatedDays?.max || 3,
                    }
                  })}
                  sx={{ ...inputSx, flex: 1 }}
                  size="small"
                />
                <TextField
                  label="จัดส่ง (วันสูงสุด)"
                  type="number"
                  value={option.estimatedDays?.max || ''}
                  onChange={(e) => onUpdate({ 
                    estimatedDays: { 
                      min: option.estimatedDays?.min || 1,
                      max: parseInt(e.target.value) || 3,
                    }
                  })}
                  sx={{ ...inputSx, flex: 1 }}
                  size="small"
                />
              </Box>

              <TextField
                label="ส่งฟรีขั้นต่ำ (บาท)"
                type="number"
                value={option.freeShippingMinimum || ''}
                onChange={(e) => onUpdate({ freeShippingMinimum: e.target.value ? parseInt(e.target.value) : undefined })}
                fullWidth
                size="small"
                sx={inputSx}
                helperText="ยอดสั่งซื้อขั้นต่ำที่ส่งฟรี"
              />

              {option.provider !== 'pickup' && option.provider !== 'custom' && (
                <TextField
                  label="URL ติดตามพัสดุ (ใช้ {tracking} แทนเลขพัสดุ)"
                  value={option.trackingUrlTemplate || ''}
                  onChange={(e) => onUpdate({ trackingUrlTemplate: e.target.value })}
                  fullWidth
                  size="small"
                  sx={inputSx}
                  placeholder="https://track.example.com/?track={tracking}"
                  InputProps={{
                    endAdornment: option.trackingUrlTemplate && (
                      <InputAdornment position="end">
                        <Tooltip title="เปิดตัวอย่าง">
                          <IconButton 
                            size="small"
                            onClick={() => window.open(option.trackingUrlTemplate?.replace('{tracking}', 'TEST123'), '_blank')}
                          >
                            <OpenInNew size={18} />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              )}

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 1 }}>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<Delete />}
                  onClick={onDelete}
                >
                  ลบ
                </Button>
              </Box>
            </Stack>
          </Box>
        </Collapse>
      </Box>
    </Card>
  );
}

// Add Shipping Option Dialog
function AddShippingOptionDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (option: ShippingOption) => void;
}) {
  const [provider, setProvider] = useState<ShippingProvider>('thailand_post');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseFee, setBaseFee] = useState(0);

  const handleAdd = () => {
    const providerInfo = SHIPPING_PROVIDERS[provider];
    const newOption: ShippingOption = {
      id: `${provider}_${Date.now()}`,
      provider,
      name: name || providerInfo.nameThai,
      description,
      baseFee,
      enabled: true,
      trackingUrlTemplate: providerInfo.trackingUrlTemplate,
    };
    onAdd(newOption);
    // Reset form
    setProvider('thailand_post');
    setName('');
    setDescription('');
    setBaseFee(0);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: adminDialogPaperSx }}>
      <DialogTitle>เพิ่มตัวเลือกการจัดส่ง</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel>ผู้ให้บริการ</InputLabel>
            <Select
              value={provider}
              label="ผู้ให้บริการ"
              onChange={(e) => setProvider(e.target.value as ShippingProvider)}
            >
              {Object.entries(SHIPPING_PROVIDERS).map(([key, info]) => (
                <MenuItem key={key} value={key}>
                  {info.nameThai} ({info.name})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="ชื่อ"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
            placeholder={SHIPPING_PROVIDERS[provider]?.nameThai}
          />

          <TextField
            label="คำอธิบาย"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            size="small"
            placeholder="เช่น: 1-3 วันทำการ"
          />

          <TextField
            label="ค่าส่ง (บาท)"
            type="number"
            value={baseFee}
            onChange={(e) => setBaseFee(parseInt(e.target.value) || 0)}
            fullWidth
            size="small"
            InputProps={{
              endAdornment: <InputAdornment position="end">฿</InputAdornment>,
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button 
          onClick={handleAdd} 
          variant="contained"
          sx={{ bgcolor: '#1e40af', '&:hover': { bgcolor: '#7c3aed' } }}
        >
          เพิ่ม
        </Button>
      </DialogActions>
    </Dialog>
  );
}
