'use client';

import { apiFetch } from '@/lib/api-client';
import { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Chip,
  CircularProgress,
  InputAdornment,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  Avatar,
  Collapse,
  IconButton,
  Alert,
  Drawer,
  Divider,
} from '@mui/material';
import {
  Search,
  RotateCcw as Refresh,
  ChevronDown as ExpandMore,
  ChevronUp as ExpandLess,
  LogIn as Login,
  LogOut as Logout,
  ShoppingCart,
  Receipt,
  Wallet as Payment,
  Eye as Visibility,
  User as Person,
  AlertCircle as ErrorIcon,
  Clock as AccessTime,
  TrendingUp,
  Users as Groups,
  Monitor as Computer,
  X as Close,
  Shield,
  FileText,
} from 'lucide-react';

import { ADMIN_THEME as THEME } from '@/lib/adminTheme';

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

interface TimelineEvent {
  id: string;
  source: 'user_log' | 'audit_trail' | 'security' | 'email' | 'order';
  at: string;
  action: string;
  summary?: string;
  actorEmail?: string;
  subjectEmail?: string;
  ip?: string | null;
  userAgent?: string | null;
  detail: Record<string, unknown>;
}

interface Props {
  showToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

const actionLabels: Record<string, { label: string; color: string; icon: ReactElement }> = {
  login: { label: 'เข้าสู่ระบบ', color: '#10b981', icon: <Login size={16} /> },
  logout: { label: 'ออกจากระบบ', color: 'var(--text-muted)', icon: <Logout size={16} /> },
  new_user: { label: 'ผู้ใช้ใหม่', color: '#1e40af', icon: <Person size={16} /> },
  view_product: { label: 'ดูสินค้า', color: '#2563eb', icon: <Visibility size={16} /> },
  add_to_cart: { label: 'เพิ่มตะกร้า', color: '#f59e0b', icon: <ShoppingCart size={16} /> },
  remove_from_cart: { label: 'ลบตะกร้า', color: '#ef4444', icon: <ShoppingCart size={16} /> },
  place_order: { label: 'สั่งซื้อ', color: '#10b981', icon: <Receipt size={16} /> },
  upload_slip: { label: 'อัปโหลดสลิป', color: '#0ea5e9', icon: <Payment size={16} /> },
  verify_payment: { label: 'ยืนยันชำระเงิน', color: '#10b981', icon: <Payment size={16} /> },
  view_order: { label: 'ดูออเดอร์', color: '#1e40af', icon: <Receipt size={16} /> },
  profile_update: { label: 'อัปเดตโปรไฟล์', color: '#f472b6', icon: <Person size={16} /> },
  upload_image: { label: 'อัปโหลดรูป', color: '#0ea5e9', icon: <Visibility size={16} /> },
  page_view: { label: 'เยี่ยมชมหน้า', color: 'var(--text-muted)', icon: <Visibility size={16} /> },
  error: { label: 'เกิดข้อผิดพลาด', color: '#ef4444', icon: <ErrorIcon size={16} /> },
  refund_request: { label: 'ขอคืนเงิน', color: '#f59e0b', icon: <Payment size={16} /> },
  refund_approve: { label: 'อนุมัติคืนเงิน', color: '#10b981', icon: <Payment size={16} /> },
  refund_reject: { label: 'ปฏิเสธคืนเงิน', color: '#ef4444', icon: <Payment size={16} /> },
  refund_complete: { label: 'คืนเงินสำเร็จ', color: '#10b981', icon: <Payment size={16} /> },
  admin_change_status: { label: 'แอดมินเปลี่ยนสถานะ', color: '#f59e0b', icon: <Receipt size={16} /> },
  admin_pickup_confirm: { label: 'แอดมินยืนยันรับสินค้า', color: '#10b981', icon: <Receipt size={16} /> },
  admin_pickup_cancel: { label: 'แอดมินยกเลิกรับสินค้า', color: '#ef4444', icon: <Receipt size={16} /> },
  admin_config_change: { label: 'แอดมินแก้ไขตั้งค่า', color: '#1e40af', icon: <Computer size={16} /> },
  admin_permissions_change: { label: 'แก้ไขสิทธิ์แอดมิน', color: '#7c3aed', icon: <Shield size={16} /> },
};

const sourceLabels: Record<TimelineEvent['source'], { label: string; color: string }> = {
  user_log: { label: 'กิจกรรม', color: '#2563eb' },
  audit_trail: { label: 'Audit', color: '#7c3aed' },
  security: { label: 'ความปลอดภัย', color: '#ef4444' },
  email: { label: 'อีเมล', color: '#0ea5e9' },
  order: { label: 'ออเดอร์', color: '#10b981' },
};

export default function UserLogsView({ showToast }: Props) {
  const [logs, setLogs] = useState<UserLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('');
  const [page, setPage] = useState(1);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const [timelineEmail, setTimelineEmail] = useState<string | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [expandedTimeline, setExpandedTimeline] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState(730);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterAction) params.set('action', filterAction);
      if (searchTerm.includes('@')) params.set('email', searchTerm.trim());
      params.set('limit', '200');

      const res = await apiFetch(`/api/admin/user-logs?${params.toString()}`);
      const data = await res.json();

      setLogs(data.logs || []);
      setStats(data.stats || null);
    } catch (error: any) {
      console.error('Failed to fetch user logs:', error);
      showToast('error', 'ไม่สามารถโหลดประวัติผู้ใช้ได้');
    } finally {
      setLoading(false);
    }
  }, [filterAction, searchTerm, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openTimeline = async (email: string) => {
    setTimelineEmail(email);
    setTimelineLoading(true);
    setExpandedTimeline(null);
    try {
      const res = await apiFetch(`/api/admin/user-timeline?email=${encodeURIComponent(email)}&limit=300`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      setTimelineEvents(data.events || []);
      setRetentionDays(data.retentionDays || 730);
    } catch (e: any) {
      showToast('error', e?.message || 'โหลดไทม์ไลน์ไม่สำเร็จ');
      setTimelineEvents([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    if (term.includes('@')) return log.email.toLowerCase().includes(term);
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

  const parseUserAgent = (ua?: string | null) => {
    if (!ua) return { browser: 'Unknown', os: 'Unknown', raw: '' };
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
    return { browser, os, raw: ua };
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      <Alert
        severity="info"
        icon={<FileText size={18} />}
        sx={{
          bgcolor: 'rgba(37,99,235,0.08)',
          color: THEME.text,
          border: `1px solid ${THEME.border}`,
          '& .MuiAlert-icon': { color: THEME.primary },
          fontSize: '0.75rem',
        }}
      >
        เก็บประวัติกิจกรรม / audit / ความปลอดภัย 2 ปี (730 วัน) ตามนโยบายความเป็นส่วนตัวและข้อกำหนดทางบัญชี
        — คลิกอีเมลเพื่อเปิดไทม์ไลน์รวมทุกลายละเอียด
      </Alert>

      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: THEME.bg,
          pb: 1.5,
          mx: { xs: -2, md: -3 },
          px: { xs: 2, md: 3 },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: { xs: '1rem', md: '1.3rem' }, fontWeight: 800, color: THEME.text }}>
              ประวัติผู้ใช้
            </Typography>
            <Typography sx={{ color: THEME.textSecondary, fontSize: '0.75rem' }}>
              {filteredLogs.length}/{logs.length} รายการ · retention {retentionDays} วัน
            </Typography>
          </Box>
          <IconButton
            onClick={fetchData}
            disabled={loading}
            size="small"
            sx={{
              bgcolor: 'rgba(37,99,235,0.1)',
              border: `1px solid ${THEME.border}`,
              color: THEME.primary,
            }}
          >
            {loading ? <CircularProgress size={18} sx={{ color: THEME.primary }} /> : <Refresh size={18} />}
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            placeholder="ค้นหา หรือใส่ email เพื่อเปิดไทม์ไลน์..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchTerm.includes('@')) {
                openTimeline(searchTerm.trim());
              }
            }}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} color={THEME.muted} />
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
              <MenuItem value="" sx={{ fontSize: '0.8rem' }}>
                ทั้งหมด
              </MenuItem>
              {Object.entries(actionLabels).map(([key, { label }]) => (
                <MenuItem key={key} value={key} sx={{ fontSize: '0.8rem' }}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {searchTerm.includes('@') && (
            <Button
              size="small"
              variant="contained"
              onClick={() => openTimeline(searchTerm.trim())}
              sx={{ textTransform: 'none', bgcolor: THEME.primary, borderRadius: '10px' }}
            >
              ไทม์ไลน์
            </Button>
          )}
        </Box>
      </Box>

      {stats && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
          <StatCard icon={<TrendingUp />} label="ทั้งหมด" value={stats.total} color={THEME.primary} />
          <StatCard icon={<Groups />} label="ผู้ใช้" value={stats.uniqueUsers} color={THEME.success} />
          <StatCard icon={<AccessTime />} label="24ชม." value={stats.last24h} color={THEME.info} />
          <StatCard icon={<Login />} label="ล็อกอิน" value={stats.byAction['login'] || 0} color={THEME.warning} />
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: THEME.primary }} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {paginatedLogs.map((log) => {
            const actionInfo = actionLabels[log.action] || {
              label: log.action,
              color: THEME.muted,
              icon: <Visibility size={14} />,
            };
            const isExpanded = expandedLog === log.id;
            const ua = parseUserAgent(log.userAgent);

            return (
              <Box
                key={log.id}
                sx={{
                  bgcolor: THEME.bgCard,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: '12px',
                  p: 1.5,
                  transition: 'all 0.15s ease',
                }}
              >
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8, cursor: 'pointer' }}
                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '8px',
                      bgcolor: `${actionInfo.color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: actionInfo.color,
                    }}
                  >
                    {actionInfo.icon}
                  </Box>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: actionInfo.color, flex: 1 }}>
                    {actionInfo.label}
                  </Typography>
                  <Typography sx={{ color: THEME.muted, fontSize: '0.65rem' }}>{formatDate(log.timestamp)}</Typography>
                  <IconButton size="small" sx={{ p: 0.3, color: THEME.muted }}>
                    {isExpanded ? <ExpandLess size={16} /> : <ExpandMore size={16} />}
                  </IconButton>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5 }}>
                  <Avatar sx={{ bgcolor: THEME.primary, width: 20, height: 20, fontSize: '0.65rem' }}>
                    {(log.name || log.email).charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography
                    onClick={(e) => {
                      e.stopPropagation();
                      openTimeline(log.email);
                    }}
                    sx={{
                      color: THEME.primary,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                    }}
                  >
                    {log.name || log.email.split('@')[0]}
                  </Typography>
                  <Typography sx={{ color: THEME.muted, fontSize: '0.65rem' }}>{log.email}</Typography>
                </Box>

                {log.details && (
                  <Typography
                    sx={{
                      color: THEME.textSecondary,
                      fontSize: '0.7rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: isExpanded ? 'normal' : 'nowrap',
                    }}
                  >
                    {log.details}
                  </Typography>
                )}

                <Collapse in={isExpanded}>
                  <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${THEME.border}` }}>
                    <DetailRow label="อีเมล" value={log.email} />
                    <DetailRow label="IP" value={log.ip || '—'} />
                    <DetailRow label="Browser / OS" value={`${ua.browser} · ${ua.os}`} />
                    <DetailRow label="User-Agent" value={ua.raw || '—'} mono />
                    <DetailRow label="Log ID" value={log.id} mono />
                    <Typography sx={{ color: THEME.muted, fontSize: '0.65rem', mt: 0.8, mb: 0.3 }}>
                      Metadata (เต็ม)
                    </Typography>
                    <Box
                      sx={{
                        bgcolor: THEME.glassSoft,
                        borderRadius: '6px',
                        p: 0.8,
                        fontSize: '0.65rem',
                        color: THEME.textSecondary,
                        fontFamily: 'ui-monospace, monospace',
                        overflow: 'auto',
                        maxHeight: 240,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {JSON.stringify(
                        {
                          action: log.action,
                          details: log.details,
                          metadata: log.metadata ?? null,
                          ip: log.ip,
                          userAgent: log.userAgent,
                          timestamp: log.timestamp,
                        },
                        null,
                        2,
                      )}
                    </Box>
                    <Button
                      size="small"
                      onClick={() => openTimeline(log.email)}
                      sx={{ mt: 1, textTransform: 'none', fontSize: '0.7rem' }}
                    >
                      เปิดไทม์ไลน์รวมของผู้ใช้นี้
                    </Button>
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

      <Drawer
        anchor="right"
        open={Boolean(timelineEmail)}
        onClose={() => setTimelineEmail(null)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 440, md: 520 },
            bgcolor: THEME.bg,
            color: THEME.text,
            p: 2,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>ไทม์ไลน์ผู้ใช้</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: THEME.textSecondary }}>{timelineEmail}</Typography>
          </Box>
          <IconButton onClick={() => setTimelineEmail(null)} size="small" sx={{ color: THEME.muted }}>
            <Close size={18} />
          </IconButton>
        </Box>
        <Typography sx={{ fontSize: '0.7rem', color: THEME.muted, mb: 1.5 }}>
          รวม user_logs · audit_trail · security · email · orders · เก็บ {retentionDays} วัน
        </Typography>
        <Divider sx={{ borderColor: THEME.border, mb: 1.5 }} />

        {timelineLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} sx={{ color: THEME.primary }} />
          </Box>
        ) : timelineEvents.length === 0 ? (
          <Typography sx={{ color: THEME.muted, textAlign: 'center', py: 4, fontSize: '0.85rem' }}>
            ไม่พบเหตุการณ์
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pb: 4 }}>
            {timelineEvents.map((ev) => {
              const src = sourceLabels[ev.source];
              const open = expandedTimeline === ev.id;
              return (
                <Box
                  key={ev.id}
                  onClick={() => setExpandedTimeline(open ? null : ev.id)}
                  sx={{
                    border: `1px solid ${THEME.border}`,
                    borderRadius: '10px',
                    p: 1.2,
                    bgcolor: THEME.bgCard,
                    cursor: 'pointer',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.4 }}>
                    <Chip
                      size="small"
                      label={src.label}
                      sx={{
                        height: 20,
                        fontSize: '0.6rem',
                        bgcolor: `${src.color}22`,
                        color: src.color,
                      }}
                    />
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: THEME.text, flex: 1 }}>
                      {ev.action}
                    </Typography>
                    <Typography sx={{ fontSize: '0.6rem', color: THEME.muted }}>{formatDate(ev.at)}</Typography>
                  </Box>
                  {ev.summary && (
                    <Typography sx={{ fontSize: '0.7rem', color: THEME.textSecondary }}>{ev.summary}</Typography>
                  )}
                  <Collapse in={open}>
                    <Box sx={{ mt: 1 }}>
                      <DetailRow label="Actor" value={ev.actorEmail || '—'} />
                      <DetailRow label="Subject" value={ev.subjectEmail || '—'} />
                      <DetailRow label="IP" value={ev.ip || '—'} />
                      <DetailRow label="UA" value={ev.userAgent || '—'} mono />
                      <Box
                        sx={{
                          mt: 0.5,
                          bgcolor: THEME.glassSoft,
                          borderRadius: '6px',
                          p: 0.8,
                          fontSize: '0.6rem',
                          fontFamily: 'ui-monospace, monospace',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: 280,
                          overflow: 'auto',
                          color: THEME.textSecondary,
                        }}
                      >
                        {JSON.stringify(ev.detail, null, 2)}
                      </Box>
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </Box>
        )}
      </Drawer>
    </Box>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Typography
      sx={{
        color: THEME.muted,
        fontSize: '0.65rem',
        mb: 0.25,
        fontFamily: mono ? 'ui-monospace, monospace' : undefined,
        wordBreak: 'break-all',
      }}
    >
      {label}: {value}
    </Typography>
  );
}

function StatCard({ icon, label, value, color }: { icon: ReactElement; label: string; value: number; color: string }) {
  return (
    <Box
      sx={{
        bgcolor: THEME.glassSoft,
        border: `1px solid ${THEME.border}`,
        borderRadius: '10px',
        p: 1,
        textAlign: 'center',
      }}
    >
      <Box sx={{ color: color, mb: 0.3, '& svg': { width: 18, height: 18 } }}>
        {icon}
      </Box>
      <Typography sx={{ color: THEME.text, fontWeight: 700, fontSize: '1rem' }}>{value.toLocaleString()}</Typography>
      <Typography sx={{ color: THEME.muted, fontSize: '0.6rem' }}>{label}</Typography>
    </Box>
  );
}
