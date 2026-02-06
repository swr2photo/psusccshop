'use client';

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
  FormControlLabel,
  Radio,
  RadioGroup,
} from '@mui/material';
import {
  CreditCard,
  Plus as Add,
  Trash2 as Delete,
  Pencil as Edit,
  Save,
  ChevronDown as ExpandMore,
  ChevronUp as ExpandLess,
  Settings,
  Wallet as Payment,
  DollarSign as AttachMoney,
  Shield as Security,
  AlertTriangle as Warning,
  Info,
  CheckCircle2 as CheckCircle,
} from 'lucide-react';
import {
  PaymentConfig,
  PaymentOption,
  PaymentMethod,
  PaymentGateway,
  PaymentGatewayConfig,
  PAYMENT_METHODS,
  PAYMENT_GATEWAYS,
  DEFAULT_PAYMENT_CONFIG,
} from '@/lib/payment';

interface PaymentSettingsProps {
  onSave?: () => void;
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    bgcolor: 'rgba(255, 255, 255, 0.05)',
    '&:hover': {
      bgcolor: 'rgba(255, 255, 255, 0.08)',
    },
    '& fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#1e40af',
    },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(255, 255, 255, 0.6)',
    '&.Mui-focused': {
      color: '#1e40af',
    },
  },
  '& .MuiInputBase-input': {
    color: '#fff',
  },
};

export default function PaymentSettings({ onSave }: PaymentSettingsProps) {
  const [config, setConfig] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [gatewayDialogOpen, setGatewayDialogOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(null);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/payment/config');
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
      } else {
        setError('Failed to load payment config');
      }
    } catch (err) {
      setError('Failed to load payment config');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      setError(null);
      
      const res = await fetch('/api/payment/config', {
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
        setError(data.error || 'Failed to save');
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

  const updateOption = (optionId: string, updates: Partial<PaymentOption>) => {
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

  const addOption = (option: PaymentOption) => {
    setConfig(prev => ({
      ...prev,
      options: [...prev.options, option],
    }));
    setAddDialogOpen(false);
  };

  const updateGateway = (gateway: PaymentGateway, updates: Partial<PaymentGatewayConfig>) => {
    setConfig(prev => {
      const existingIndex = prev.gateways.findIndex(g => g.gateway === gateway);
      if (existingIndex >= 0) {
        const newGateways = [...prev.gateways];
        newGateways[existingIndex] = { ...newGateways[existingIndex], ...updates };
        return { ...prev, gateways: newGateways };
      } else {
        return {
          ...prev,
          gateways: [
            ...prev.gateways,
            {
              gateway,
              enabled: false,
              testMode: true,
              supportedMethods: [],
              ...updates,
            },
          ],
        };
      }
    });
  };

  const getGatewayConfig = (gateway: PaymentGateway): PaymentGatewayConfig | undefined => {
    return config.gateways.find(g => g.gateway === gateway);
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
          <CreditCard size={28} color="#1e40af" />
          <Typography variant="h5" fontWeight="bold">
            ตั้งค่าการชำระเงิน
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={saveConfig}
          disabled={saving}
          sx={{
            bgcolor: '#1e40af',
            '&:hover': { bgcolor: '#7c3aed' },
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

      {/* Info Alert */}
      <Alert 
        severity="info" 
        sx={{ mb: 3, bgcolor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}
        icon={<Info />}
      >
        <Typography variant="body2">
          การชำระเงินผ่านบัตรเครดิตต้องตั้งค่า Payment Gateway ก่อน โดย Secret Key จะเก็บใน Environment Variables เท่านั้น
        </Typography>
      </Alert>

      {/* Payment Gateways */}
      <Card sx={{ 
        mb: 3, 
        bgcolor: 'rgba(255, 255, 255, 0.03)', 
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
      }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Security size={20} />
            Payment Gateways
          </Typography>

          <Stack spacing={2}>
            {Object.entries(PAYMENT_GATEWAYS).map(([key, info]) => {
              const gateway = key as PaymentGateway;
              const gatewayConfig = getGatewayConfig(gateway);
              
              return (
                <Card 
                  key={key}
                  sx={{
                    bgcolor: gatewayConfig?.enabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${gatewayConfig?.enabled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: '10px',
                  }}
                >
                  <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Switch
                      checked={gatewayConfig?.enabled || false}
                      onChange={(e) => updateGateway(gateway, { enabled: e.target.checked })}
                      color="success"
                      size="small"
                    />
                    
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography fontWeight="bold">{info.name}</Typography>
                        {gatewayConfig?.testMode && (
                          <Chip 
                            label="TEST MODE" 
                            size="small" 
                            color="warning"
                            sx={{ fontSize: '0.65rem', height: '18px' }}
                          />
                        )}
                        {gatewayConfig?.enabled && !gatewayConfig?.testMode && (
                          <Chip 
                            label="LIVE" 
                            size="small" 
                            color="success"
                            sx={{ fontSize: '0.65rem', height: '18px' }}
                          />
                        )}
                      </Box>
                      <Typography variant="caption" color="textSecondary">
                        รองรับ: {info.supportedMethods.map(m => PAYMENT_METHODS[m]?.nameThai).join(', ')}
                      </Typography>
                    </Box>

                    <Button
                      size="small"
                      onClick={() => {
                        setEditingGateway(gateway);
                        setGatewayDialogOpen(true);
                      }}
                      sx={{ color: '#1e40af' }}
                    >
                      ตั้งค่า
                    </Button>
                  </Box>
                </Card>
              );
            })}
          </Stack>
        </CardContent>
      </Card>

      {/* Payment Options */}
      <Card sx={{ 
        mb: 3,
        bgcolor: 'rgba(255, 255, 255, 0.03)', 
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Payment size={20} />
              ตัวเลือกการชำระเงิน
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={() => setAddDialogOpen(true)}
              sx={{
                borderColor: '#1e40af',
                color: '#1e40af',
                '&:hover': { borderColor: '#7c3aed', bgcolor: 'rgba(30, 64, 175, 0.1)' },
              }}
            >
              เพิ่ม
            </Button>
          </Box>

          <Stack spacing={1}>
            {config.options.map((option) => (
              <PaymentOptionCard
                key={option.id}
                option={option}
                expanded={expandedOption === option.id}
                onToggleExpand={() => setExpandedOption(expandedOption === option.id ? null : option.id)}
                onToggleEnabled={() => toggleOptionEnabled(option.id)}
                onUpdate={(updates) => updateOption(option.id, updates)}
                onDelete={() => deleteOption(option.id)}
                gatewayEnabled={option.gateway ? getGatewayConfig(option.gateway)?.enabled : true}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* COD Settings */}
      <Card sx={{ 
        bgcolor: 'rgba(255, 255, 255, 0.03)', 
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
      }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AttachMoney size={20} />
            เก็บเงินปลายทาง (COD)
          </Typography>
          
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography>เปิดใช้ COD</Typography>
                <Typography variant="caption" color="textSecondary">
                  ลูกค้าสามารถชำระเงินเมื่อรับสินค้าได้
                </Typography>
              </Box>
              <Switch
                checked={config.enableCOD}
                onChange={(e) => setConfig(prev => ({ ...prev, enableCOD: e.target.checked }))}
                color="secondary"
              />
            </Box>

            {config.enableCOD && (
              <TextField
                label="ค่าธรรมเนียม COD (บาท)"
                type="number"
                value={config.codFee || 0}
                onChange={(e) => setConfig(prev => ({ ...prev, codFee: parseInt(e.target.value) || 0 }))}
                fullWidth
                sx={inputSx}
                size="small"
                InputProps={{
                  endAdornment: <InputAdornment position="end">฿</InputAdornment>,
                }}
              />
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Add Payment Option Dialog */}
      <AddPaymentOptionDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={addOption}
        enabledGateways={config.gateways.filter(g => g.enabled).map(g => g.gateway)}
      />

      {/* Gateway Config Dialog */}
      {editingGateway && (
        <GatewayConfigDialog
          open={gatewayDialogOpen}
          onClose={() => {
            setGatewayDialogOpen(false);
            setEditingGateway(null);
          }}
          gateway={editingGateway}
          config={getGatewayConfig(editingGateway)}
          onUpdate={(updates) => updateGateway(editingGateway, updates)}
        />
      )}
    </Box>
  );
}

// Payment Option Card Component
function PaymentOptionCard({
  option,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onUpdate,
  onDelete,
  gatewayEnabled,
}: {
  option: PaymentOption;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onUpdate: (updates: Partial<PaymentOption>) => void;
  onDelete: () => void;
  gatewayEnabled?: boolean;
}) {
  const methodInfo = PAYMENT_METHODS[option.method];
  const needsGateway = methodInfo?.requiresGateway;
  const canEnable = !needsGateway || gatewayEnabled;

  return (
    <Card sx={{
      bgcolor: option.enabled ? 'rgba(30, 64, 175, 0.1)' : 'rgba(255, 255, 255, 0.02)',
      border: `1px solid ${option.enabled ? 'rgba(30, 64, 175, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
      borderRadius: '10px',
      transition: 'all 0.2s',
      opacity: canEnable ? 1 : 0.6,
    }}>
      <Box sx={{ p: 2 }}>
        {/* Header Row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip title={!canEnable ? 'ต้องเปิด Payment Gateway ก่อน' : ''}>
            <span>
              <Switch
                checked={option.enabled}
                onChange={onToggleEnabled}
                color="secondary"
                size="small"
                disabled={!canEnable}
              />
            </span>
          </Tooltip>
          
          <Typography sx={{ fontSize: '1.5rem' }}>{methodInfo?.icon}</Typography>
          
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography fontWeight="bold">{option.nameThai || option.name}</Typography>
              {option.gateway && (
                <Chip 
                  label={PAYMENT_GATEWAYS[option.gateway]?.name} 
                  size="small" 
                  sx={{ 
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    fontSize: '0.7rem',
                    height: '20px',
                  }}
                />
              )}
              {!canEnable && (
                <Chip 
                  label="ต้องเปิด Gateway" 
                  size="small" 
                  color="warning"
                  sx={{ fontSize: '0.65rem', height: '18px' }}
                />
              )}
            </Box>
            {option.description && (
              <Typography variant="caption" color="textSecondary">
                {option.description}
              </Typography>
            )}
          </Box>

          {(option.feeType && option.feeAmount) && (
            <Typography sx={{ color: '#fb923c', fontSize: '0.85rem' }}>
              +{option.feeType === 'percentage' ? `${option.feeAmount}%` : `฿${option.feeAmount}`}
            </Typography>
          )}

          <IconButton size="small" onClick={onToggleExpand}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        {/* Expanded Content */}
        <Collapse in={expanded}>
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <Stack spacing={2}>
              <TextField
                label="ชื่อแสดง (ไทย)"
                value={option.nameThai || ''}
                onChange={(e) => onUpdate({ nameThai: e.target.value })}
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

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 120, ...inputSx }}>
                  <InputLabel>ประเภทค่าธรรมเนียม</InputLabel>
                  <Select
                    value={option.feeType || ''}
                    label="ประเภทค่าธรรมเนียม"
                    onChange={(e) => onUpdate({ feeType: e.target.value as 'fixed' | 'percentage' || undefined })}
                  >
                    <MenuItem value="">ไม่มี</MenuItem>
                    <MenuItem value="fixed">คงที่</MenuItem>
                    <MenuItem value="percentage">เปอร์เซ็นต์</MenuItem>
                  </Select>
                </FormControl>

                {option.feeType && (
                  <TextField
                    label="ค่าธรรมเนียม"
                    type="number"
                    value={option.feeAmount || ''}
                    onChange={(e) => onUpdate({ feeAmount: parseFloat(e.target.value) || undefined })}
                    sx={{ ...inputSx, flex: 1 }}
                    size="small"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          {option.feeType === 'percentage' ? '%' : '฿'}
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="ยอดขั้นต่ำ (บาท)"
                  type="number"
                  value={option.minOrderAmount || ''}
                  onChange={(e) => onUpdate({ minOrderAmount: e.target.value ? parseInt(e.target.value) : undefined })}
                  sx={{ ...inputSx, flex: 1 }}
                  size="small"
                />
                <TextField
                  label="ยอดสูงสุด (บาท)"
                  type="number"
                  value={option.maxOrderAmount || ''}
                  onChange={(e) => onUpdate({ maxOrderAmount: e.target.value ? parseInt(e.target.value) : undefined })}
                  sx={{ ...inputSx, flex: 1 }}
                  size="small"
                />
              </Box>

              <TextField
                label="ลำดับการแสดง"
                type="number"
                value={option.sortOrder || 0}
                onChange={(e) => onUpdate({ sortOrder: parseInt(e.target.value) || 0 })}
                fullWidth
                size="small"
                sx={inputSx}
                helperText="ตัวเลขน้อย = แสดงก่อน"
              />

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

// Add Payment Option Dialog
function AddPaymentOptionDialog({
  open,
  onClose,
  onAdd,
  enabledGateways,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (option: PaymentOption) => void;
  enabledGateways: PaymentGateway[];
}) {
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [gateway, setGateway] = useState<PaymentGateway | ''>('');
  const [name, setName] = useState('');

  const methodInfo = PAYMENT_METHODS[method];
  const availableGateways = methodInfo?.supportedGateways.filter(g => enabledGateways.includes(g)) || [];

  useEffect(() => {
    if (methodInfo?.requiresGateway && availableGateways.length > 0) {
      setGateway(availableGateways[0]);
    } else {
      setGateway('');
    }
  }, [method]);

  const handleAdd = () => {
    const newOption: PaymentOption = {
      id: `${method}_${gateway || 'default'}_${Date.now()}`,
      method,
      gateway: gateway || undefined,
      name: name || methodInfo?.name || method,
      nameThai: name || methodInfo?.nameThai,
      enabled: true,
      sortOrder: 99,
    };
    onAdd(newOption);
    // Reset form
    setMethod('bank_transfer');
    setGateway('');
    setName('');
  };

  const canAdd = !methodInfo?.requiresGateway || (gateway && enabledGateways.includes(gateway));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>เพิ่มตัวเลือกการชำระเงิน</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel>วิธีการชำระเงิน</InputLabel>
            <Select
              value={method}
              label="วิธีการชำระเงิน"
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {Object.entries(PAYMENT_METHODS).map(([key, info]) => (
                <MenuItem key={key} value={key}>
                  {info.icon} {info.nameThai}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {methodInfo?.requiresGateway && (
            <>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Gateway</InputLabel>
                <Select
                  value={gateway}
                  label="Payment Gateway"
                  onChange={(e) => setGateway(e.target.value as PaymentGateway)}
                >
                  {availableGateways.length === 0 ? (
                    <MenuItem value="" disabled>
                      ไม่มี Gateway ที่เปิดใช้งาน
                    </MenuItem>
                  ) : (
                    availableGateways.map((g) => (
                      <MenuItem key={g} value={g}>
                        {PAYMENT_GATEWAYS[g].name}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>

              {availableGateways.length === 0 && (
                <Alert severity="warning" sx={{ bgcolor: 'rgba(251, 146, 60, 0.1)' }}>
                  ต้องเปิดใช้ Payment Gateway ที่รองรับวิธีนี้ก่อน
                </Alert>
              )}
            </>
          )}

          <TextField
            label="ชื่อแสดง (ไม่บังคับ)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
            placeholder={methodInfo?.nameThai}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button 
          onClick={handleAdd} 
          variant="contained"
          disabled={!canAdd}
          sx={{ bgcolor: '#1e40af', '&:hover': { bgcolor: '#7c3aed' } }}
        >
          เพิ่ม
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Gateway Config Dialog
function GatewayConfigDialog({
  open,
  onClose,
  gateway,
  config,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  gateway: PaymentGateway;
  config?: PaymentGatewayConfig;
  onUpdate: (updates: Partial<PaymentGatewayConfig>) => void;
}) {
  const gatewayInfo = PAYMENT_GATEWAYS[gateway];

  const getEnvVarName = (gateway: PaymentGateway, type: 'secret' | 'public' | 'webhook') => {
    const prefix = gateway.toUpperCase().replace('2C2P', 'TWOCTWOP');
    switch (type) {
      case 'secret': return `${prefix}_SECRET_KEY`;
      case 'public': return `${prefix}_PUBLIC_KEY` || `NEXT_PUBLIC_${prefix}_PUBLIC_KEY`;
      case 'webhook': return `${prefix}_WEBHOOK_SECRET`;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        ตั้งค่า {gatewayInfo.name}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Alert severity="info" sx={{ bgcolor: 'rgba(59, 130, 246, 0.1)' }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Secret Keys ต้องเก็บใน Environment Variables:</strong>
            </Typography>
            <Typography variant="caption" component="pre" sx={{ 
              bgcolor: 'var(--glass-bg)', 
              p: 1, 
              borderRadius: 1,
              overflow: 'auto',
            }}>
              {getEnvVarName(gateway, 'secret')}=sk_...<br/>
              {getEnvVarName(gateway, 'public')}=pk_...<br/>
              {getEnvVarName(gateway, 'webhook')}=whsec_...
            </Typography>
          </Alert>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography>โหมดทดสอบ</Typography>
              <Typography variant="caption" color="textSecondary">
                ใช้ Test API Keys
              </Typography>
            </Box>
            <Switch
              checked={config?.testMode ?? true}
              onChange={(e) => onUpdate({ testMode: e.target.checked })}
              color="warning"
            />
          </Box>

          <TextField
            label="Public Key (แสดงได้)"
            value={config?.publicKey || ''}
            onChange={(e) => onUpdate({ publicKey: e.target.value })}
            fullWidth
            size="small"
            sx={inputSx}
            placeholder="pk_test_..."
            helperText="Public Key สามารถเก็บในฐานข้อมูลได้"
          />

          <TextField
            label="Webhook Endpoint"
            value={config?.webhookEndpoint || `/api/payment/webhook/${gateway}`}
            fullWidth
            size="small"
            sx={inputSx}
            disabled
            helperText="URL สำหรับรับ webhook จาก payment gateway"
          />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>รองรับวิธีการชำระเงิน:</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {gatewayInfo.supportedMethods.map(method => (
                <Chip
                  key={method}
                  label={`${PAYMENT_METHODS[method]?.icon} ${PAYMENT_METHODS[method]?.nameThai}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(30, 64, 175, 0.2)' }}
                />
              ))}
            </Box>
          </Box>

          <Button
            variant="outlined"
            href={gatewayInfo.docUrl}
            target="_blank"
            sx={{ borderColor: '#1e40af', color: '#1e40af' }}
          >
            เอกสาร API
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ปิด</Button>
      </DialogActions>
    </Dialog>
  );
}
