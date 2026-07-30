/* eslint-disable */
'use client';

import { apiFetch } from '@/lib/api-client';
import { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
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
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

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
  login: { label: 'เข้าสู่ระบบ', color: 'var(--success)', icon: <Login size={16} /> },
  logout: { label: 'ออกจากระบบ', color: 'var(--muted-foreground)', icon: <Logout size={16} /> },
  new_user: { label: 'ผู้ใช้ใหม่', color: '#1e40af', icon: <Person size={16} /> },
  view_product: { label: 'ดูสินค้า', color: '#2563eb', icon: <Visibility size={16} /> },
  add_to_cart: { label: 'เพิ่มตะกร้า', color: 'var(--warning)', icon: <ShoppingCart size={16} /> },
  remove_from_cart: { label: 'ลบตะกร้า', color: 'var(--error)', icon: <ShoppingCart size={16} /> },
  place_order: { label: 'สั่งซื้อ', color: 'var(--success)', icon: <Receipt size={16} /> },
  upload_slip: { label: 'อัปโหลดสลิป', color: '#0ea5e9', icon: <Payment size={16} /> },
  verify_payment: { label: 'ยืนยันชำระเงิน', color: 'var(--success)', icon: <Payment size={16} /> },
  view_order: { label: 'ดูออเดอร์', color: '#1e40af', icon: <Receipt size={16} /> },
  profile_update: { label: 'อัปเดตโปรไฟล์', color: '#f472b6', icon: <Person size={16} /> },
  upload_image: { label: 'อัปโหลดรูป', color: '#0ea5e9', icon: <Visibility size={16} /> },
  page_view: { label: 'เยี่ยมชมหน้า', color: 'var(--muted-foreground)', icon: <Visibility size={16} /> },
  error: { label: 'เกิดข้อผิดพลาด', color: 'var(--error)', icon: <ErrorIcon size={16} /> },
  refund_request: { label: 'ขอคืนเงิน', color: 'var(--warning)', icon: <Payment size={16} /> },
  refund_approve: { label: 'อนุมัติคืนเงิน', color: 'var(--success)', icon: <Payment size={16} /> },
  refund_reject: { label: 'ปฏิเสธคืนเงิน', color: 'var(--error)', icon: <Payment size={16} /> },
  refund_complete: { label: 'คืนเงินสำเร็จ', color: 'var(--success)', icon: <Payment size={16} /> },
  admin_change_status: { label: 'แอดมินเปลี่ยนสถานะ', color: 'var(--warning)', icon: <Receipt size={16} /> },
  admin_pickup_confirm: { label: 'แอดมินยืนยันรับสินค้า', color: 'var(--success)', icon: <Receipt size={16} /> },
  admin_pickup_cancel: { label: 'แอดมินยกเลิกรับสินค้า', color: 'var(--error)', icon: <Receipt size={16} /> },
  admin_config_change: { label: 'แอดมินแก้ไขตั้งค่า', color: '#1e40af', icon: <Computer size={16} /> },
  admin_permissions_change: { label: 'แก้ไขสิทธิ์แอดมิน', color: '#7c3aed', icon: <Shield size={16} /> },
};

const sourceLabels: Record<TimelineEvent['source'], { label: string; color: string }> = {
  user_log: { label: 'กิจกรรม', color: '#2563eb' },
  audit_trail: { label: 'Audit', color: '#7c3aed' },
  security: { label: 'ความปลอดภัย', color: 'var(--error)' },
  email: { label: 'อีเมล', color: '#0ea5e9' },
  order: { label: 'ออเดอร์', color: 'var(--success)' },
};

function SimplePagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="mt-2 flex items-center justify-center gap-1">
      <Button variant="outline" size="icon" className="size-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft className="size-4" />
      </Button>
      <span className="px-2 text-xs text-[var(--muted-foreground)]">
        {page} / {totalPages}
      </span>
      <Button variant="outline" size="icon" className="size-8" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

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
    } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
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
    } catch (e: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
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
    <div className="flex h-full flex-col gap-2">
      <Alert className="border-[var(--border)] bg-blue-500/8 text-[0.75rem] text-[var(--foreground)]">
        <FileText className="size-[18px] text-blue-600" />
        <AlertDescription>
          เก็บประวัติกิจกรรม / audit / ความปลอดภัย 2 ปี (730 วัน) ตามนโยบายความเป็นส่วนตัวและข้อกำหนดทางบัญชี
          — คลิกอีเมลเพื่อเปิดไทม์ไลน์รวมทุกลายละเอียด
        </AlertDescription>
      </Alert>

      <div className="sticky top-0 z-10 bg-[var(--background)] pb-1.5 -mx-2 px-2 md:-mx-3 md:px-3">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
          <div>
            <h2 className="text-base font-extrabold text-[var(--foreground)] md:text-[1.3rem]">ประวัติผู้ใช้</h2>
            <p className="text-[0.75rem] text-[var(--muted-foreground)]">
              {filteredLogs.length}/{logs.length} รายการ · retention {retentionDays} วัน
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="size-8 border-[var(--border)] bg-blue-500/10 text-blue-600"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? <Loader2 className="size-[18px] animate-spin" /> : <Refresh className="size-[18px]" />}
          </Button>
        </div>

        <div className="flex flex-wrap gap-1">
          <div className="relative min-w-[150px] flex-1">
            <Search className="absolute top-1/2 left-2.5 size-[18px] -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
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
              className="rounded-[10px] border-[var(--border)] bg-[var(--card)] py-2 pl-9 text-[0.8rem] text-[var(--foreground)]"
            />
          </div>

          <Select
            value={filterAction || '__all__'}
            onValueChange={(v) => setFilterAction(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="min-w-[100px] rounded-[10px] border-[var(--border)] bg-[var(--card)] text-[0.75rem] sm:min-w-[150px]">
              <SelectValue placeholder="ทั้งหมด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">ทั้งหมด</SelectItem>
              {Object.entries(actionLabels).map(([key, { label }]) => (
                <SelectItem key={key} value={key} className="text-[0.8rem]">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {searchTerm.includes('@') && (
            <Button size="sm" className="rounded-[10px]" onClick={() => openTimeline(searchTerm.trim())}>
              ไทม์ไลน์
            </Button>
          )}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-1">
          <StatCard icon={<TrendingUp />} label="ทั้งหมด" value={stats.total} color="#2563eb" />
          <StatCard icon={<Groups />} label="ผู้ใช้" value={stats.uniqueUsers} color="var(--success)" />
          <StatCard icon={<AccessTime />} label="24ชม." value={stats.last24h} color="#0ea5e9" />
          <StatCard icon={<Login />} label="ล็อกอิน" value={stats.byAction['login'] || 0} color="var(--warning)" />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="size-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {paginatedLogs.map((log) => {
            const actionInfo = actionLabels[log.action] || {
              label: log.action,
              color: 'var(--muted-foreground)',
              icon: <Visibility size={14} />,
            };
            const isExpanded = expandedLog === log.id;
            const ua = parseUserAgent(log.userAgent);

            return (
              <div
                key={log.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 transition-all"
              >
                <div
                  className="mb-0.5 flex cursor-pointer items-center gap-1"
                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                >
                  <div
                    className="flex size-7 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${actionInfo.color}20`, color: actionInfo.color }}
                  >
                    {actionInfo.icon}
                  </div>
                  <span className="flex-1 text-[0.7rem] font-semibold" style={{ color: actionInfo.color }}>
                    {actionInfo.label}
                  </span>
                  <span className="text-[0.65rem] text-[var(--muted-foreground)]">{formatDate(log.timestamp)}</span>
                  <Button variant="ghost" size="icon" className="size-6 text-[var(--muted-foreground)]">
                    {isExpanded ? <ExpandLess className="size-4" /> : <ExpandMore className="size-4" />}
                  </Button>
                </div>

                <div className="mb-0.5 flex items-center gap-0.5">
                  <Avatar className="size-5">
                    <AvatarFallback className="bg-blue-600 text-[0.65rem] text-white">
                      {(log.name || log.email).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openTimeline(log.email);
                    }}
                    className="cursor-pointer text-[0.75rem] font-semibold text-blue-600 underline underline-offset-2"
                  >
                    {log.name || log.email.split('@')[0]}
                  </button>
                  <span className="text-[0.65rem] text-[var(--muted-foreground)]">{log.email}</span>
                </div>

                {log.details && (
                  <p
                    className={cn(
                      'text-[0.7rem] text-[var(--muted-foreground)]',
                      !isExpanded && 'truncate whitespace-nowrap'
                    )}
                  >
                    {log.details}
                  </p>
                )}

                {isExpanded && (
                  <div className="mt-1 border-t border-[var(--border)] pt-1">
                    <DetailRow label="อีเมล" value={log.email} />
                    <DetailRow label="IP" value={log.ip || '—'} />
                    <DetailRow label="Browser / OS" value={`${ua.browser} · ${ua.os}`} />
                    <DetailRow label="User-Agent" value={ua.raw || '—'} mono />
                    <DetailRow label="Log ID" value={log.id} mono />
                    <p className="mt-0.5 mb-0.5 text-[0.65rem] text-[var(--muted-foreground)]">Metadata (เต็ม)</p>
                    <pre className="max-h-60 overflow-auto rounded-md bg-[var(--card)] p-2 font-mono text-[0.65rem] whitespace-pre-wrap break-words text-[var(--muted-foreground)]">
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
                        2
                      )}
                    </pre>
                    <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-[0.7rem]" onClick={() => openTimeline(log.email)}>
                      เปิดไทม์ไลน์รวมของผู้ใช้นี้
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {paginatedLogs.length === 0 && (
            <div className="py-4 text-center text-[var(--muted-foreground)]">
              {searchTerm || filterAction ? 'ไม่พบผลลัพธ์' : 'ยังไม่มีประวัติ'}
            </div>
          )}

          {totalPages > 1 && (
            <SimplePagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </div>
      )}

      <Sheet open={Boolean(timelineEmail)} onOpenChange={(open) => !open && setTimelineEmail(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[440px] md:max-w-[520px]">
          <SheetHeader>
            <SheetTitle className="text-base font-extrabold">ไทม์ไลน์ผู้ใช้</SheetTitle>
            <p className="text-[0.75rem] text-[var(--muted-foreground)]">{timelineEmail}</p>
          </SheetHeader>
          <p className="mb-1.5 text-[0.7rem] text-[var(--muted-foreground)]">
            รวม user_logs · audit_trail · security · email · orders · เก็บ {retentionDays} วัน
          </p>
          <Separator className="mb-1.5" />

          {timelineLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-7 animate-spin text-blue-600" />
            </div>
          ) : timelineEvents.length === 0 ? (
            <p className="py-4 text-center text-[0.85rem] text-[var(--muted-foreground)]">ไม่พบเหตุการณ์</p>
          ) : (
            <div className="flex flex-col gap-1 pb-4">
              {timelineEvents.map((ev) => {
                const src = sourceLabels[ev.source];
                const open = expandedTimeline === ev.id;
                return (
                  <div
                    key={ev.id}
                    onClick={() => setExpandedTimeline(open ? null : ev.id)}
                    className="cursor-pointer rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-1.5"
                  >
                    <div className="mb-0.5 flex items-center gap-0.5">
                      <Badge
                        className="h-5 text-[0.6rem]"
                        style={{ backgroundColor: `${src.color}22`, color: src.color, borderColor: 'transparent' }}
                      >
                        {src.label}
                      </Badge>
                      <span className="flex-1 text-[0.7rem] font-bold text-[var(--foreground)]">{ev.action}</span>
                      <span className="text-[0.6rem] text-[var(--muted-foreground)]">{formatDate(ev.at)}</span>
                    </div>
                    {ev.summary && (
                      <p className="text-[0.7rem] text-[var(--muted-foreground)]">{ev.summary}</p>
                    )}
                    {open && (
                      <div className="mt-1">
                        <DetailRow label="Actor" value={ev.actorEmail || '—'} />
                        <DetailRow label="Subject" value={ev.subjectEmail || '—'} />
                        <DetailRow label="IP" value={ev.ip || '—'} />
                        <DetailRow label="UA" value={ev.userAgent || '—'} mono />
                        <pre className="mt-0.5 max-h-[280px] overflow-auto rounded-md bg-[var(--card)] p-2 font-mono text-[0.6rem] whitespace-pre-wrap break-words text-[var(--muted-foreground)]">
                          {JSON.stringify(ev.detail, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <p
      className={cn(
        'mb-0.5 text-[0.65rem] break-all text-[var(--muted-foreground)]',
        mono && 'font-mono'
      )}
    >
      {label}: {value}
    </p>
  );
}

function StatCard({ icon, label, value, color }: { icon: ReactElement; label: string; value: number; color: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-1 text-center">
      <div className="mb-0.5 [&_svg]:mx-auto [&_svg]:size-[18px]" style={{ color }}>
        {icon}
      </div>
      <p className="text-base font-bold text-[var(--foreground)]">{value.toLocaleString()}</p>
      <p className="text-[0.6rem] text-[var(--muted-foreground)]">{label}</p>
    </div>
  );
}
