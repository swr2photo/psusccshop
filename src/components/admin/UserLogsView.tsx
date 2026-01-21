// src/components/admin/UserLogsView.tsx
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  InputAdornment,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Avatar,
  Collapse,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Search,
  Refresh,
  ExpandMore,
  ExpandLess,
  Login,
  Logout,
  ShoppingCart,
  Receipt,
  Payment,
  Visibility,
  Person,
  Error,
  FilterList,
  AccessTime,
  TrendingUp,
  Groups,
  Computer,
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

interface UserLog {
  id: string;
  email: string;
  name?: string;
  action: string;
  details?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: string;
}

interface LogStats {
  total: number;
  byAction: Record<string, number>;
  uniqueUsers: number;
  last24h: number;
}

interface Props {
  showToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

const actionLabels: Record<string, { label: string; color: string; icon: ReactElement }> = {
  login: { label: 'เข้าสู่ระบบ', color: '#10b981', icon: <Login sx={{ fontSize: 16 }} /> },
  logout: { label: 'ออกจากระบบ', color: '#64748b', icon: <Logout sx={{ fontSize: 16 }} /> },
  view_product: { label: 'ดูสินค้า', color: '#6366f1', icon: <Visibility sx={{ fontSize: 16 }} /> },
  add_to_cart: { label: 'เพิ่มตะกร้า', color: '#f59e0b', icon: <ShoppingCart sx={{ fontSize: 16 }} /> },
  remove_from_cart: { label: 'ลบตะกร้า', color: '#ef4444', icon: <ShoppingCart sx={{ fontSize: 16 }} /> },
  place_order: { label: 'สั่งซื้อ', color: '#10b981', icon: <Receipt sx={{ fontSize: 16 }} /> },
  upload_slip: { label: 'อัปโหลดสลิป', color: '#0ea5e9', icon: <Payment sx={{ fontSize: 16 }} /> },
  verify_payment: { label: 'ยืนยันชำระเงิน', color: '#10b981', icon: <Payment sx={{ fontSize: 16 }} /> },
  view_order: { label: 'ดูออเดอร์', color: '#8b5cf6', icon: <Receipt sx={{ fontSize: 16 }} /> },
  profile_update: { label: 'อัปเดตโปรไฟล์', color: '#f472b6', icon: <Person sx={{ fontSize: 16 }} /> },
  page_view: { label: 'เยี่ยมชมหน้า', color: '#64748b', icon: <Visibility sx={{ fontSize: 16 }} /> },
  error: { label: 'เกิดข้อผิดพลาด', color: '#ef4444', icon: <Error sx={{ fontSize: 16 }} /> },
};

export default function UserLogsView({ showToast }: Props) {
  const [logs, setLogs] = useState<UserLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('');
  const [page, setPage] = useState(1);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterAction) params.set('action', filterAction);
      params.set('limit', '200');

      const res = await fetch(`/api/admin/user-logs?${params.toString()}`);
      const data = await res.json();

      setLogs(data.logs || []);
      setStats(data.stats || null);
    } catch (error: any) {
      console.error('Failed to fetch user logs:', error);
      showToast('error', 'ไม่สามารถโหลดประวัติผู้ใช้ได้');
    } finally {
      setLoading(false);
    }
  }, [filterAction, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      log.email.toLowerCase().includes(term) ||
      (log.name || '').toLowerCase().includes(term) ||
      (log.details || '').toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term)
    );
  });

  const paginatedLogs = filteredLogs.slice((page - 1) * 25, page * 25);
  const totalPages = Math.ceil(filteredLogs.length / 25);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const parseUserAgent = (ua?: string) => {
    if (!ua) return { browser: 'Unknown', os: 'Unknown' };
    
    let browser = 'Unknown';
    let os = 'Unknown';

    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return { browser, os };
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      {/* Sticky Header */}
      <Box sx={{ 
        position: 'sticky',
        top: 0,
        zIndex: 10,
        bgcolor: THEME.bg,
        pb: 1.5,
        mx: { xs: -2, md: -3 },
        px: { xs: 2, md: 3 },
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: { xs: '1rem', md: '1.3rem' }, fontWeight: 800, color: THEME.text }}>
              👥 ประวัติผู้ใช้
            </Typography>
            <Typography sx={{ color: THEME.textSecondary, fontSize: '0.75rem' }}>
              {filteredLogs.length}/{logs.length} รายการ
            </Typography>
          </Box>
          <IconButton
            onClick={fetchData}
            disabled={loading}
            size="small"
            sx={{
              bgcolor: 'rgba(99,102,241,0.1)',
              border: `1px solid ${THEME.border}`,
              color: THEME.primary,
            }}
          >
            {loading ? <CircularProgress size={18} sx={{ color: THEME.primary }} /> : <Refresh sx={{ fontSize: 18 }} />}
          </IconButton>
        </Box>

        {/* Filters - Compact */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            placeholder="ค้นหา..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: THEME.muted, fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              flex: 1,
              minWidth: 150,
              '& .MuiOutlinedInput-root': {
                bgcolor: THEME.glassSoft,
                borderRadius: '10px',
                '& fieldset': { borderColor: THEME.border },
              },
              '& .MuiInputBase-input': { color: THEME.text, fontSize: '0.8rem', py: 0.8 },
            }}
          />

          <FormControl size="small" sx={{ minWidth: { xs: 100, sm: 150 } }}>
            <Select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              displayEmpty
              sx={{
                bgcolor: THEME.glassSoft,
                color: THEME.text,
                fontSize: '0.75rem',
                borderRadius: '10px',
                '& fieldset': { borderColor: THEME.border },
                '& .MuiSvgIcon-root': { color: THEME.muted },
                '& .MuiSelect-select': { py: 0.8 },
              }}
            >
              <MenuItem value="" sx={{ fontSize: '0.8rem' }}>ทั้งหมด</MenuItem>
              {Object.entries(actionLabels).map(([key, { label }]) => (
                <MenuItem key={key} value={key} sx={{ fontSize: '0.8rem' }}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Stats Cards - Compact */}
      {stats && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
          <StatCard icon={<TrendingUp />} label="ทั้งหมด" value={stats.total} color={THEME.primary} />
          <StatCard icon={<Groups />} label="ผู้ใช้" value={stats.uniqueUsers} color={THEME.success} />
          <StatCard icon={<AccessTime />} label="24ชม." value={stats.last24h} color={THEME.info} />
          <StatCard icon={<Login />} label="ล็อกอิน" value={stats.byAction['login'] || 0} color={THEME.warning} />
        </Box>
      )}

      {/* Logs List - Mobile Card View */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: THEME.primary }} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {paginatedLogs.map((log) => {
            const actionInfo = actionLabels[log.action] || { label: log.action, color: THEME.muted, icon: <Visibility sx={{ fontSize: 14 }} /> };
            const isExpanded = expandedLog === log.id;

            return (
              <Box
                key={log.id}
                onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                sx={{
                  bgcolor: THEME.bgCard,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: '12px',
                  p: 1.5,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:active': { transform: 'scale(0.99)' },
                }}
              >
                {/* Header Row */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
                  <Box sx={{ 
                    width: 28, 
                    height: 28, 
                    borderRadius: '8px', 
                    bgcolor: `${actionInfo.color}20`, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: actionInfo.color,
                  }}>
                    {actionInfo.icon}
                  </Box>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: actionInfo.color, flex: 1 }}>
                    {actionInfo.label}
                  </Typography>
                  <Typography sx={{ color: THEME.muted, fontSize: '0.65rem' }}>
                    {formatDate(log.timestamp)}
                  </Typography>
                  <IconButton size="small" sx={{ p: 0.3, color: THEME.muted }}>
                    {isExpanded ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
                  </IconButton>
                </Box>

                {/* User Info */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5 }}>
                  <Avatar sx={{ bgcolor: THEME.primary, width: 20, height: 20, fontSize: '0.65rem' }}>
                    {(log.name || log.email).charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography sx={{ color: THEME.text, fontSize: '0.75rem', fontWeight: 600 }}>
                    {log.name || log.email.split('@')[0]}
                  </Typography>
                </Box>

                {/* Details */}
                {log.details && (
                  <Typography sx={{ 
                    color: THEME.textSecondary, 
                    fontSize: '0.7rem', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: isExpanded ? 'normal' : 'nowrap',
                  }}>
                    {log.details}
                  </Typography>
                )}

                {/* Expanded Info */}
                <Collapse in={isExpanded}>
                  <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${THEME.border}` }}>
                    <Typography sx={{ color: THEME.muted, fontSize: '0.65rem', mb: 0.3 }}>
                      อีเมล: {log.email}
                    </Typography>
                    {log.ip && (
                      <Typography sx={{ color: THEME.muted, fontSize: '0.65rem', mb: 0.3 }}>
                        IP: {log.ip}
                      </Typography>
                    )}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <Box sx={{ 
                        bgcolor: THEME.glassSoft, 
                        borderRadius: '6px', 
                        p: 0.8, 
                        mt: 0.5,
                        fontSize: '0.6rem',
                        color: THEME.textSecondary,
                        fontFamily: 'monospace',
                        overflow: 'auto',
                      }}>
                        {JSON.stringify(log.metadata, null, 2)}
                      </Box>
                    )}
                  </Box>
                </Collapse>
              </Box>
            );
          })}

          {paginatedLogs.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4, color: THEME.muted }}>
              {searchTerm || filterAction ? 'ไม่พบผลลัพธ์' : 'ยังไม่มีประวัติ'}
            </Box>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                size="small"
                sx={{
                  '& .MuiPaginationItem-root': {
                    color: THEME.textSecondary,
                    fontSize: '0.75rem',
                    '&.Mui-selected': { bgcolor: THEME.primary, color: '#fff' },
                  },
                }}
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

// Stat Card Component - Compact
function StatCard({ icon, label, value, color }: { icon: ReactElement; label: string; value: number; color: string }) {
  return (
    <Box sx={{ 
      bgcolor: THEME.glassSoft, 
      border: `1px solid ${THEME.border}`, 
      borderRadius: '10px',
      p: 1,
      textAlign: 'center',
    }}>
      <Box sx={{ color: color, mb: 0.3, '& svg': { fontSize: 18 } }}>
        {icon}
      </Box>
      <Typography sx={{ color: THEME.text, fontWeight: 700, fontSize: '1rem' }}>
        {value.toLocaleString()}
      </Typography>
      <Typography sx={{ color: THEME.muted, fontSize: '0.6rem' }}>
        {label}
      </Typography>
    </Box>
  );
}
