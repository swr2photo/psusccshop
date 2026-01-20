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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: THEME.text, mb: 0.5 }}>
            👥 ประวัติการใช้งานผู้ใช้
          </Typography>
          <Typography sx={{ color: THEME.textSecondary, fontSize: '0.9rem' }}>
            ติดตามกิจกรรมของลูกค้าบนเว็บไซต์
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} sx={{ color: THEME.primary }} /> : <Refresh />}
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
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          <StatCard icon={<TrendingUp />} label="กิจกรรมทั้งหมด" value={stats.total} color={THEME.primary} />
          <StatCard icon={<Groups />} label="ผู้ใช้ไม่ซ้ำ" value={stats.uniqueUsers} color={THEME.success} />
          <StatCard icon={<AccessTime />} label="24 ชม. ล่าสุด" value={stats.last24h} color={THEME.info} />
          <StatCard icon={<Login />} label="เข้าสู่ระบบ" value={stats.byAction['login'] || 0} color={THEME.warning} />
        </Box>
      )}

      {/* Filters & Table */}
      <Card sx={{ bgcolor: THEME.bgCard, border: `1px solid ${THEME.border}`, borderRadius: '16px' }}>
        <CardContent>
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="ค้นหาอีเมล, ชื่อ, รายละเอียด..."
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
                minWidth: 280,
                '& .MuiOutlinedInput-root': {
                  bgcolor: THEME.glassSoft,
                  '& fieldset': { borderColor: THEME.border },
                  '&:hover fieldset': { borderColor: THEME.primary },
                },
                '& .MuiInputBase-input': { color: THEME.text },
              }}
            />

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel sx={{ color: THEME.muted }}>กรองตามกิจกรรม</InputLabel>
              <Select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                label="กรองตามกิจกรรม"
                sx={{
                  bgcolor: THEME.glassSoft,
                  color: THEME.text,
                  '& fieldset': { borderColor: THEME.border },
                  '& .MuiSvgIcon-root': { color: THEME.muted },
                }}
              >
                <MenuItem value="">ทั้งหมด</MenuItem>
                {Object.entries(actionLabels).map(([key, { label }]) => (
                  <MenuItem key={key} value={key}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: THEME.primary }} />
            </Box>
          ) : (
            <>
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ bgcolor: THEME.glass, color: THEME.textSecondary, fontWeight: 700 }}>กิจกรรม</TableCell>
                      <TableCell sx={{ bgcolor: THEME.glass, color: THEME.textSecondary, fontWeight: 700 }}>ผู้ใช้</TableCell>
                      <TableCell sx={{ bgcolor: THEME.glass, color: THEME.textSecondary, fontWeight: 700 }}>รายละเอียด</TableCell>
                      <TableCell sx={{ bgcolor: THEME.glass, color: THEME.textSecondary, fontWeight: 700 }}>เวลา</TableCell>
                      <TableCell sx={{ bgcolor: THEME.glass, color: THEME.textSecondary, fontWeight: 700, width: 60 }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedLogs.map((log) => {
                      const actionInfo = actionLabels[log.action] || { label: log.action, color: THEME.muted, icon: <Visibility sx={{ fontSize: 16 }} /> };
                      const isExpanded = expandedLog === log.id;
                      const ua = parseUserAgent(log.userAgent);

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
                                icon={actionInfo.icon}
                                label={actionInfo.label}
                                sx={{
                                  bgcolor: `${actionInfo.color}20`,
                                  color: actionInfo.color,
                                  fontWeight: 600,
                                  fontSize: '0.7rem',
                                  '& .MuiChip-icon': { color: actionInfo.color },
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar sx={{ bgcolor: THEME.primary, width: 28, height: 28, fontSize: '0.75rem' }}>
                                  {(log.name || log.email).charAt(0).toUpperCase()}
                                </Avatar>
                                <Box>
                                  <Typography sx={{ color: THEME.text, fontSize: '0.85rem', fontWeight: 600 }}>
                                    {log.name || 'ไม่ระบุชื่อ'}
                                  </Typography>
                                  <Typography sx={{ color: THEME.muted, fontSize: '0.7rem' }}>
                                    {log.email}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography sx={{ color: THEME.textSecondary, fontSize: '0.85rem', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {log.details || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography sx={{ color: THEME.muted, fontSize: '0.8rem' }}>
                                {formatDate(log.timestamp)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <IconButton size="small" sx={{ color: THEME.muted }}>
                                {isExpanded ? <ExpandLess /> : <ExpandMore />}
                              </IconButton>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell colSpan={5} sx={{ p: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                              <Collapse in={isExpanded}>
                                <Box sx={{ p: 2, bgcolor: THEME.glassSoft }}>
                                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                                    <Box>
                                      <Typography sx={{ color: THEME.muted, fontSize: '0.75rem', mb: 0.5 }}>ID</Typography>
                                      <Typography sx={{ color: THEME.textSecondary, fontSize: '0.85rem' }}>{log.id}</Typography>
                                    </Box>
                                    <Box>
                                      <Typography sx={{ color: THEME.muted, fontSize: '0.75rem', mb: 0.5 }}>IP Address</Typography>
                                      <Typography sx={{ color: THEME.textSecondary, fontSize: '0.85rem' }}>{log.ip || 'ไม่ทราบ'}</Typography>
                                    </Box>
                                    <Box>
                                      <Typography sx={{ color: THEME.muted, fontSize: '0.75rem', mb: 0.5 }}>Browser / OS</Typography>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Computer sx={{ fontSize: 14, color: THEME.muted }} />
                                        <Typography sx={{ color: THEME.textSecondary, fontSize: '0.85rem' }}>
                                          {ua.browser} / {ua.os}
                                        </Typography>
                                      </Box>
                                    </Box>
                                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                                      <Box sx={{ gridColumn: { md: 'span 2' } }}>
                                        <Typography sx={{ color: THEME.muted, fontSize: '0.75rem', mb: 0.5 }}>Metadata</Typography>
                                        <Box sx={{ bgcolor: THEME.glass, p: 1, borderRadius: '8px' }}>
                                          <pre style={{ margin: 0, fontSize: '0.75rem', color: THEME.textSecondary, whiteSpace: 'pre-wrap' }}>
                                            {JSON.stringify(log.metadata, null, 2)}
                                          </pre>
                                        </Box>
                                      </Box>
                                    )}
                                  </Box>
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </Fragment>
                      );
                    })}
                    {paginatedLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                          <Typography sx={{ color: THEME.muted }}>
                            {searchTerm || filterAction ? 'ไม่พบผลลัพธ์' : 'ยังไม่มีประวัติการใช้งาน'}
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Activity Summary */}
      {stats && Object.keys(stats.byAction).length > 0 && (
        <Card sx={{ bgcolor: THEME.bgCard, border: `1px solid ${THEME.border}`, borderRadius: '16px' }}>
          <CardContent>
            <Typography sx={{ color: THEME.text, fontWeight: 700, mb: 2 }}>
              📊 สรุปกิจกรรม
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {Object.entries(stats.byAction)
                .sort(([, a], [, b]) => b - a)
                .map(([action, count]) => {
                  const actionInfo = actionLabels[action] || { label: action, color: THEME.muted };
                  return (
                    <Chip
                      key={action}
                      label={`${actionInfo.label}: ${count}`}
                      sx={{
                        bgcolor: `${actionInfo.color}20`,
                        color: actionInfo.color,
                        fontWeight: 600,
                      }}
                    />
                  );
                })}
            </Box>
          </CardContent>
        </Card>
      )}
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
