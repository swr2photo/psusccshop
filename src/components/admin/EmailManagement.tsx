// src/components/admin/EmailManagement.tsx
'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import type { ReactElement } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  Tabs,
  Tab,
  FormControlLabel,
  Checkbox,
  Alert,
  InputAdornment,
  Tooltip,
  Badge,
  Pagination,
  Stack,
  Avatar,
  Collapse,
} from '@mui/material';
import {
  Email,
  Send,
  Search,
  Refresh,
  CheckCircle,
  Error,
  Pending,
  Campaign,
  Person,
  ExpandMore,
  ExpandLess,
  ContentCopy,
  FilterList,
  AccessTime,
  TrendingUp,
  Groups,
  History,
  Visibility,
  Close,
} from '@mui/icons-material';

// Theme
const THEME = {
  bg: '#0a0f1a',
  bgCard: 'rgba(15,23,42,0.7)',
  glass: 'rgba(30,41,59,0.6)',
  glassSoft: 'rgba(30,41,59,0.4)',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  muted: '#64748b',
  border: 'rgba(255,255,255,0.08)',
  primary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#0ea5e9',
};

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  type: string;
  status: 'sent' | 'failed' | 'pending';
  orderRef?: string;
  sentAt: string;
  error?: string;
  metadata?: Record<string, any>;
}

interface EmailStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  byType: Record<string, number>;
  last24h: number;
  last7days: number;
}

interface Customer {
  email: string;
  name: string;
  orderCount: number;
}

interface Props {
  showToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

const typeLabels: Record<string, { label: string; color: string; icon: ReactElement }> = {
  order_confirmation: { label: 'ยืนยันคำสั่งซื้อ', color: '#6366f1', icon: <CheckCircle sx={{ fontSize: 16 }} /> },
  payment_received: { label: 'ชำระเงินแล้ว', color: '#10b981', icon: <CheckCircle sx={{ fontSize: 16 }} /> },
  order_ready: { label: 'พร้อมรับ', color: '#f59e0b', icon: <CheckCircle sx={{ fontSize: 16 }} /> },
  order_shipped: { label: 'จัดส่งแล้ว', color: '#0ea5e9', icon: <Send sx={{ fontSize: 16 }} /> },
  order_completed: { label: 'สำเร็จ', color: '#10b981', icon: <CheckCircle sx={{ fontSize: 16 }} /> },
  order_cancelled: { label: 'ยกเลิก', color: '#ef4444', icon: <Error sx={{ fontSize: 16 }} /> },
  custom: { label: 'ส่งเอง', color: '#8b5cf6', icon: <Email sx={{ fontSize: 16 }} /> },
  broadcast: { label: 'ประกาศ', color: '#f472b6', icon: <Campaign sx={{ fontSize: 16 }} /> },
};

const statusColors: Record<string, string> = {
  sent: '#10b981',
  failed: '#ef4444',
  pending: '#f59e0b',
};

export default function EmailManagement({ showToast }: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  
  // Compose dialog
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<'single' | 'broadcast'>('single');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [composeName, setComposeName] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([]);
  const [sending, setSending] = useState(false);
  
  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes, customersRes] = await Promise.all([
        fetch('/api/admin/email?action=logs&limit=200').then(r => r.json()),
        fetch('/api/admin/email?action=stats').then(r => r.json()),
        fetch('/api/admin/email?action=customers').then(r => r.json()),
      ]);
      
      setLogs(logsRes.logs || []);
      setStats(statsRes.stats || null);
      setCustomers(customersRes.customers || []);
    } catch (error: any) {
      console.error('Failed to fetch email data:', error);
      showToast('error', 'ไม่สามารถโหลดข้อมูลอีเมลได้');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      log.to.toLowerCase().includes(term) ||
      log.subject.toLowerCase().includes(term) ||
      (log.orderRef || '').toLowerCase().includes(term) ||
      log.type.toLowerCase().includes(term)
    );
  });

  const paginatedLogs = filteredLogs.slice((page - 1) * 20, page * 20);
  const totalPages = Math.ceil(filteredLogs.length / 20);

  const handleSendEmail = async () => {
    if (composeMode === 'single') {
      if (!composeTo || !composeSubject || !composeMessage) {
        showToast('error', 'กรุณากรอกข้อมูลให้ครบ');
        return;
      }
    } else {
      if (selectedCustomers.length === 0 || !composeSubject || !composeMessage) {
        showToast('error', 'กรุณาเลือกผู้รับและกรอกข้อมูลให้ครบ');
        return;
      }
    }

    setSending(true);
    try {
      const res = await fetch('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          composeMode === 'single'
            ? {
                action: 'send_custom',
                to: composeTo,
                subject: composeSubject,
                message: composeMessage,
                customerName: composeName || 'ลูกค้า',
              }
            : {
                action: 'send_broadcast',
                recipients: selectedCustomers.map(c => ({ email: c.email, name: c.name })),
                subject: composeSubject,
                message: composeMessage,
              }
        ),
      });

      const result = await res.json();

      if (composeMode === 'single') {
        if (result.success) {
          showToast('success', 'ส่งอีเมลสำเร็จ');
          setComposeOpen(false);
          resetCompose();
          fetchData();
        } else {
          showToast('error', result.error || 'ส่งอีเมลไม่สำเร็จ');
        }
      } else {
        showToast('success', `ส่งสำเร็จ ${result.sent}/${result.total} ฉบับ`);
        setComposeOpen(false);
        resetCompose();
        fetchData();
      }
    } catch (error: any) {
      showToast('error', error.message);
    } finally {
      setSending(false);
    }
  };

  const resetCompose = () => {
    setComposeTo('');
    setComposeSubject('');
    setComposeMessage('');
    setComposeName('');
    setSelectedCustomers([]);
    setComposeMode('single');
  };

  const openComposeForCustomer = (customer: Customer) => {
    setComposeMode('single');
    setComposeTo(customer.email);
    setComposeName(customer.name);
    setComposeOpen(true);
  };

  const toggleCustomerSelection = (customer: Customer) => {
    setSelectedCustomers(prev => {
      const exists = prev.find(c => c.email === customer.email);
      if (exists) {
        return prev.filter(c => c.email !== customer.email);
      }
      return [...prev, customer];
    });
  };

  const selectAllCustomers = () => {
    setSelectedCustomers(customers);
  };

  const deselectAllCustomers = () => {
    setSelectedCustomers([]);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: THEME.text, mb: 0.5 }}>
            📧 ระบบจัดการอีเมล
          </Typography>
          <Typography sx={{ color: THEME.textSecondary, fontSize: '0.9rem' }}>
            ส่งอีเมลแจ้งลูกค้าและดูประวัติการส่ง
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchData}
            disabled={loading}
            sx={{
              borderColor: THEME.border,
              color: THEME.textSecondary,
              '&:hover': { borderColor: THEME.primary, color: THEME.primary },
            }}
          >
            รีเฟรช
          </Button>
          <Button
            variant="contained"
            startIcon={<Send />}
            onClick={() => setComposeOpen(true)}
            sx={{
              bgcolor: THEME.primary,
              '&:hover': { bgcolor: '#4f46e5' },
            }}
          >
            เขียนอีเมล
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          <StatCard
            icon={<Email />}
            label="ส่งทั้งหมด"
            value={stats.total}
            color={THEME.primary}
          />
          <StatCard
            icon={<CheckCircle />}
            label="สำเร็จ"
            value={stats.sent}
            color={THEME.success}
          />
          <StatCard
            icon={<Error />}
            label="ล้มเหลว"
            value={stats.failed}
            color={THEME.error}
          />
          <StatCard
            icon={<AccessTime />}
            label="24 ชม. ล่าสุด"
            value={stats.last24h}
            color={THEME.info}
          />
        </Box>
      )}

      {/* Tabs */}
      <Card sx={{ bgcolor: THEME.bgCard, border: `1px solid ${THEME.border}`, borderRadius: '16px' }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            borderBottom: `1px solid ${THEME.border}`,
            '& .MuiTab-root': {
              color: THEME.textSecondary,
              fontWeight: 600,
              textTransform: 'none',
              '&.Mui-selected': { color: THEME.primary },
            },
            '& .MuiTabs-indicator': { bgcolor: THEME.primary },
          }}
        >
          <Tab icon={<History sx={{ fontSize: 18 }} />} iconPosition="start" label="ประวัติส่ง" />
          <Tab icon={<Groups sx={{ fontSize: 18 }} />} iconPosition="start" label={`ลูกค้า (${customers.length})`} />
          <Tab icon={<TrendingUp sx={{ fontSize: 18 }} />} iconPosition="start" label="สถิติ" />
        </Tabs>

        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: THEME.primary }} />
            </Box>
          ) : (
            <>
              {/* Tab 0: Email Logs */}
              {activeTab === 0 && (
                <Box>
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <TextField
                      placeholder="ค้นหาอีเมล, หัวข้อ, เลขออเดอร์..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      size="small"
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search sx={{ color: THEME.muted }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        maxWidth: 400,
                        '& .MuiOutlinedInput-root': {
                          bgcolor: THEME.glassSoft,
                          '& fieldset': { borderColor: THEME.border },
                          '&:hover fieldset': { borderColor: THEME.primary },
                        },
                        '& .MuiInputBase-input': { color: THEME.text },
                      }}
                    />
                  </Box>

                  <TableContainer sx={{ maxHeight: 500 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ bgcolor: THEME.glass, color: THEME.textSecondary, fontWeight: 700 }}>สถานะ</TableCell>
                          <TableCell sx={{ bgcolor: THEME.glass, color: THEME.textSecondary, fontWeight: 700 }}>ประเภท</TableCell>
                          <TableCell sx={{ bgcolor: THEME.glass, color: THEME.textSecondary, fontWeight: 700 }}>ผู้รับ</TableCell>
                          <TableCell sx={{ bgcolor: THEME.glass, color: THEME.textSecondary, fontWeight: 700 }}>หัวข้อ</TableCell>
                          <TableCell sx={{ bgcolor: THEME.glass, color: THEME.textSecondary, fontWeight: 700 }}>ออเดอร์</TableCell>
                          <TableCell sx={{ bgcolor: THEME.glass, color: THEME.textSecondary, fontWeight: 700 }}>เวลา</TableCell>
                          <TableCell sx={{ bgcolor: THEME.glass, color: THEME.textSecondary, fontWeight: 700, width: 60 }}></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginatedLogs.map((log) => {
                          const typeInfo = typeLabels[log.type] || { label: log.type, color: THEME.muted, icon: <Email sx={{ fontSize: 16 }} /> };
                          const isExpanded = expandedLog === log.id;
                          
                          return (
                            <Fragment key={log.id}>
                              <TableRow 
                                hover
                                sx={{ 
                                  cursor: 'pointer',
                                  '& td': { borderColor: THEME.border },
                                  '&:hover': { bgcolor: THEME.glassSoft },
                                }}
                                onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                              >
                                <TableCell>
                                  <Chip
                                    size="small"
                                    label={log.status === 'sent' ? 'ส่งแล้ว' : log.status === 'failed' ? 'ล้มเหลว' : 'รอส่ง'}
                                    sx={{
                                      bgcolor: `${statusColors[log.status]}20`,
                                      color: statusColors[log.status],
                                      fontWeight: 600,
                                      fontSize: '0.7rem',
                                    }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    size="small"
                                    icon={typeInfo.icon}
                                    label={typeInfo.label}
                                    sx={{
                                      bgcolor: `${typeInfo.color}20`,
                                      color: typeInfo.color,
                                      fontWeight: 600,
                                      fontSize: '0.7rem',
                                      '& .MuiChip-icon': { color: typeInfo.color },
                                    }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Typography sx={{ color: THEME.text, fontSize: '0.85rem' }}>
                                    {log.to}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography sx={{ color: THEME.textSecondary, fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {log.subject}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  {log.orderRef ? (
                                    <Chip
                                      size="small"
                                      label={log.orderRef}
                                      sx={{
                                        bgcolor: 'rgba(99,102,241,0.1)',
                                        color: THEME.primary,
                                        fontWeight: 600,
                                        fontSize: '0.7rem',
                                      }}
                                    />
                                  ) : (
                                    <Typography sx={{ color: THEME.muted, fontSize: '0.8rem' }}>-</Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Typography sx={{ color: THEME.muted, fontSize: '0.8rem' }}>
                                    {formatDate(log.sentAt)}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <IconButton size="small" sx={{ color: THEME.muted }}>
                                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell colSpan={7} sx={{ p: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                                  <Collapse in={isExpanded}>
                                    <Box sx={{ p: 2, bgcolor: THEME.glassSoft }}>
                                      <Typography sx={{ color: THEME.textSecondary, fontSize: '0.85rem', mb: 1 }}>
                                        <strong>ID:</strong> {log.id}
                                      </Typography>
                                      {log.error && (
                                        <Alert severity="error" sx={{ mt: 1, bgcolor: 'rgba(239,68,68,0.1)' }}>
                                          {log.error}
                                        </Alert>
                                      )}
                                      {log.metadata && (
                                        <Typography sx={{ color: THEME.muted, fontSize: '0.8rem', mt: 1 }}>
                                          <strong>Metadata:</strong> {JSON.stringify(log.metadata)}
                                        </Typography>
                                      )}
                                      <Button
                                        size="small"
                                        startIcon={<Send />}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setComposeTo(log.to);
                                          setComposeMode('single');
                                          setComposeOpen(true);
                                        }}
                                        sx={{ mt: 1, color: THEME.primary }}
                                      >
                                        ส่งอีเมลใหม่
                                      </Button>
                                    </Box>
                                  </Collapse>
                                </TableCell>
                              </TableRow>
                            </Fragment>
                          );
                        })}
                        {paginatedLogs.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                              <Typography sx={{ color: THEME.muted }}>
                                {searchTerm ? 'ไม่พบผลลัพธ์' : 'ยังไม่มีประวัติการส่งอีเมล'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {totalPages > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                      <Pagination
                        count={totalPages}
                        page={page}
                        onChange={(_, p) => setPage(p)}
                        sx={{
                          '& .MuiPaginationItem-root': {
                            color: THEME.textSecondary,
                            '&.Mui-selected': { bgcolor: THEME.primary, color: '#fff' },
                          },
                        }}
                      />
                    </Box>
                  )}
                </Box>
              )}

              {/* Tab 1: Customers */}
              {activeTab === 1 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                    <TextField
                      placeholder="ค้นหาลูกค้า..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      size="small"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search sx={{ color: THEME.muted }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        maxWidth: 300,
                        '& .MuiOutlinedInput-root': {
                          bgcolor: THEME.glassSoft,
                          '& fieldset': { borderColor: THEME.border },
                        },
                        '& .MuiInputBase-input': { color: THEME.text },
                      }}
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {selectedCustomers.length > 0 && (
                        <>
                          <Chip
                            label={`เลือก ${selectedCustomers.length} คน`}
                            onDelete={deselectAllCustomers}
                            sx={{ bgcolor: THEME.primary, color: '#fff' }}
                          />
                          <Button
                            variant="contained"
                            startIcon={<Campaign />}
                            onClick={() => {
                              setComposeMode('broadcast');
                              setComposeOpen(true);
                            }}
                            sx={{ bgcolor: THEME.success }}
                          >
                            ส่งอีเมลถึงที่เลือก
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={selectedCustomers.length === customers.length ? deselectAllCustomers : selectAllCustomers}
                        sx={{ borderColor: THEME.border, color: THEME.textSecondary }}
                      >
                        {selectedCustomers.length === customers.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                      </Button>
                    </Box>
                  </Box>

                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, 
                    gap: 2,
                    maxHeight: 500,
                    overflow: 'auto',
                  }}>
                    {customers
                      .filter(c => {
                        const term = searchTerm.toLowerCase();
                        return c.email.toLowerCase().includes(term) || c.name.toLowerCase().includes(term);
                      })
                      .map((customer) => {
                        const isSelected = selectedCustomers.some(c => c.email === customer.email);
                        return (
                          <Card
                            key={customer.email}
                            onClick={() => toggleCustomerSelection(customer)}
                            sx={{
                              bgcolor: isSelected ? 'rgba(99,102,241,0.15)' : THEME.glassSoft,
                              border: `1px solid ${isSelected ? THEME.primary : THEME.border}`,
                              borderRadius: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              '&:hover': { borderColor: THEME.primary },
                            }}
                          >
                            <CardContent sx={{ p: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Checkbox
                                  checked={isSelected}
                                  sx={{
                                    color: THEME.muted,
                                    '&.Mui-checked': { color: THEME.primary },
                                    p: 0,
                                  }}
                                />
                                <Avatar sx={{ bgcolor: THEME.primary, width: 36, height: 36, fontSize: '0.9rem' }}>
                                  {customer.name.charAt(0).toUpperCase()}
                                </Avatar>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography sx={{ color: THEME.text, fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {customer.name}
                                  </Typography>
                                  <Typography sx={{ color: THEME.muted, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {customer.email}
                                  </Typography>
                                </Box>
                                <Chip
                                  size="small"
                                  label={`${customer.orderCount} ออเดอร์`}
                                  sx={{
                                    bgcolor: 'rgba(16,185,129,0.1)',
                                    color: THEME.success,
                                    fontSize: '0.7rem',
                                  }}
                                />
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                                <Button
                                  size="small"
                                  startIcon={<Email />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openComposeForCustomer(customer);
                                  }}
                                  sx={{ 
                                    flex: 1, 
                                    color: THEME.primary,
                                    fontSize: '0.75rem',
                                    '&:hover': { bgcolor: 'rgba(99,102,241,0.1)' },
                                  }}
                                >
                                  ส่งอีเมล
                                </Button>
                                <Tooltip title="คัดลอกอีเมล">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(customer.email);
                                      showToast('info', 'คัดลอกอีเมลแล้ว');
                                    }}
                                    sx={{ color: THEME.muted }}
                                  >
                                    <ContentCopy sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </Box>
                </Box>
              )}

              {/* Tab 2: Statistics */}
              {activeTab === 2 && stats && (
                <Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
                    {/* By Type */}
                    <Card sx={{ bgcolor: THEME.glassSoft, border: `1px solid ${THEME.border}`, borderRadius: '12px' }}>
                      <CardContent>
                        <Typography sx={{ color: THEME.text, fontWeight: 700, mb: 2 }}>
                          📊 จำแนกตามประเภท
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {Object.entries(stats.byType).map(([type, count]) => {
                            const typeInfo = typeLabels[type] || { label: type, color: THEME.muted };
                            const percentage = Math.round((count / stats.total) * 100);
                            return (
                              <Box key={type}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography sx={{ color: THEME.textSecondary, fontSize: '0.85rem' }}>
                                    {typeInfo.label}
                                  </Typography>
                                  <Typography sx={{ color: THEME.text, fontWeight: 600, fontSize: '0.85rem' }}>
                                    {count} ({percentage}%)
                                  </Typography>
                                </Box>
                                <Box sx={{ height: 6, bgcolor: THEME.glass, borderRadius: 3, overflow: 'hidden' }}>
                                  <Box
                                    sx={{
                                      height: '100%',
                                      width: `${percentage}%`,
                                      bgcolor: typeInfo.color,
                                      borderRadius: 3,
                                      transition: 'width 0.5s ease',
                                    }}
                                  />
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                      </CardContent>
                    </Card>

                    {/* Overview */}
                    <Card sx={{ bgcolor: THEME.glassSoft, border: `1px solid ${THEME.border}`, borderRadius: '12px' }}>
                      <CardContent>
                        <Typography sx={{ color: THEME.text, fontWeight: 700, mb: 2 }}>
                          📈 ภาพรวม
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ color: THEME.textSecondary }}>อีเมลทั้งหมด</Typography>
                            <Typography sx={{ color: THEME.text, fontWeight: 700, fontSize: '1.2rem' }}>{stats.total}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ color: THEME.textSecondary }}>ส่งสำเร็จ</Typography>
                            <Typography sx={{ color: THEME.success, fontWeight: 700, fontSize: '1.2rem' }}>{stats.sent}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ color: THEME.textSecondary }}>ล้มเหลว</Typography>
                            <Typography sx={{ color: THEME.error, fontWeight: 700, fontSize: '1.2rem' }}>{stats.failed}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ color: THEME.textSecondary }}>24 ชั่วโมงล่าสุด</Typography>
                            <Typography sx={{ color: THEME.info, fontWeight: 700, fontSize: '1.2rem' }}>{stats.last24h}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ color: THEME.textSecondary }}>7 วันล่าสุด</Typography>
                            <Typography sx={{ color: THEME.warning, fontWeight: 700, fontSize: '1.2rem' }}>{stats.last7days}</Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Box>
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Compose Dialog */}
      <Dialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: THEME.bgCard,
            border: `1px solid ${THEME.border}`,
            borderRadius: '16px',
          },
        }}
      >
        <DialogTitle sx={{ borderBottom: `1px solid ${THEME.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {composeMode === 'broadcast' ? <Campaign sx={{ color: THEME.success }} /> : <Email sx={{ color: THEME.primary }} />}
            <Typography sx={{ color: THEME.text, fontWeight: 700 }}>
              {composeMode === 'broadcast' ? `ส่งถึงลูกค้า ${selectedCustomers.length} คน` : 'เขียนอีเมล'}
            </Typography>
          </Box>
          <IconButton onClick={() => setComposeOpen(false)} sx={{ color: THEME.muted }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={2}>
            {composeMode === 'single' && (
              <>
                <TextField
                  label="ถึง (อีเมล)"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  fullWidth
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: THEME.border },
                    },
                    '& .MuiInputBase-input': { color: THEME.text },
                    '& .MuiInputLabel-root': { color: THEME.muted },
                  }}
                />
                <TextField
                  label="ชื่อผู้รับ"
                  value={composeName}
                  onChange={(e) => setComposeName(e.target.value)}
                  fullWidth
                  placeholder="ลูกค้า"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: THEME.border },
                    },
                    '& .MuiInputBase-input': { color: THEME.text },
                    '& .MuiInputLabel-root': { color: THEME.muted },
                  }}
                />
              </>
            )}

            {composeMode === 'broadcast' && (
              <Box sx={{ bgcolor: THEME.glassSoft, p: 2, borderRadius: '12px', maxHeight: 150, overflow: 'auto' }}>
                <Typography sx={{ color: THEME.textSecondary, fontSize: '0.85rem', mb: 1 }}>
                  ผู้รับ ({selectedCustomers.length} คน):
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selectedCustomers.map(c => (
                    <Chip
                      key={c.email}
                      label={c.name || c.email}
                      size="small"
                      onDelete={() => toggleCustomerSelection(c)}
                      sx={{ bgcolor: 'rgba(99,102,241,0.2)', color: THEME.primary }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            <TextField
              label="หัวข้อ"
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              fullWidth
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: THEME.border },
                },
                '& .MuiInputBase-input': { color: THEME.text },
                '& .MuiInputLabel-root': { color: THEME.muted },
              }}
            />

            <TextField
              label="ข้อความ"
              value={composeMessage}
              onChange={(e) => setComposeMessage(e.target.value)}
              fullWidth
              required
              multiline
              rows={6}
              placeholder="พิมพ์ข้อความที่ต้องการส่ง..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: THEME.border },
                },
                '& .MuiInputBase-input': { color: THEME.text },
                '& .MuiInputLabel-root': { color: THEME.muted },
              }}
            />

            <Alert severity="info" sx={{ bgcolor: 'rgba(14,165,233,0.1)', color: THEME.info }}>
              อีเมลจะถูกส่งในรูปแบบ HTML พร้อมดีไซน์สวยงาม โดยอัตโนมัติ
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: `1px solid ${THEME.border}` }}>
          <Button onClick={() => setComposeOpen(false)} sx={{ color: THEME.textSecondary }}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            startIcon={sending ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <Send />}
            onClick={handleSendEmail}
            disabled={sending}
            sx={{
              bgcolor: composeMode === 'broadcast' ? THEME.success : THEME.primary,
              '&:hover': { bgcolor: composeMode === 'broadcast' ? '#059669' : '#4f46e5' },
            }}
          >
            {sending ? 'กำลังส่ง...' : composeMode === 'broadcast' ? `ส่ง ${selectedCustomers.length} ฉบับ` : 'ส่งอีเมล'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Stat Card Component
function StatCard({ icon, label, value, color }: { icon: ReactElement; label: string; value: number; color: string }) {
  return (
    <Card sx={{ bgcolor: THEME.glassSoft, border: `1px solid ${THEME.border}`, borderRadius: '12px' }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 40,
            height: 40,
            borderRadius: '10px',
            bgcolor: `${color}20`,
            display: 'grid',
            placeItems: 'center',
            color: color,
          }}>
            {icon}
          </Box>
          <Box>
            <Typography sx={{ color: THEME.muted, fontSize: '0.75rem' }}>
              {label}
            </Typography>
            <Typography sx={{ color: THEME.text, fontWeight: 700, fontSize: '1.25rem' }}>
              {value.toLocaleString()}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
