/* eslint-disable */
'use client';

import { apiFetch } from '@/lib/api-client';
// src/components/admin/EmailManagement.tsx

import { useState, useEffect, useCallback, Fragment } from 'react';
import type { ReactElement } from 'react';
import {
  Mail as Email,
  Send,
  Search,
  RotateCcw as Refresh,
  CheckCircle2 as CheckCircle,
  AlertCircle as ErrorIcon,
  Clock as Pending,
  Megaphone as Campaign,
  ChevronDown as ExpandMore,
  ChevronUp as ExpandLess,
  Copy as ContentCopy,
  TrendingUp,
  Users as Groups,
  History,
  X as Close,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const AccessTime = Pending;

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
  order_confirmation: { label: 'ยืนยันคำสั่งซื้อ', color: '#2563eb', icon: <CheckCircle size={16} /> },
  payment_received: { label: 'ชำระเงินแล้ว', color: '#10b981', icon: <CheckCircle size={16} /> },
  order_ready: { label: 'พร้อมรับ', color: '#f59e0b', icon: <CheckCircle size={16} /> },
  order_shipped: { label: 'จัดส่งแล้ว', color: '#0ea5e9', icon: <Send size={16} /> },
  order_completed: { label: 'สำเร็จ', color: '#10b981', icon: <CheckCircle size={16} /> },
  order_cancelled: { label: 'ยกเลิก', color: '#ef4444', icon: <ErrorIcon size={16} /> },
  custom: { label: 'ส่งเอง', color: '#1e40af', icon: <Email size={16} /> },
  broadcast: { label: 'ประกาศ', color: '#f472b6', icon: <Campaign size={16} /> },
};

const statusColors: Record<string, string> = {
  sent: 'var(--success)',
  failed: 'var(--error)',
  pending: 'var(--warning)',
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

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const logsRes = await apiFetch('/api/admin/email?action=logs&limit=200').then((r) => r.json());
      setLogs(logsRes.logs || []);
    } catch (error: unknown) {
      console.error('Failed to fetch email logs:', error);
      showToast('error', 'ไม่สามารถโหลดประวัติอีเมลได้');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchStats = useCallback(async () => {
    if (stats) return;
    try {
      const statsRes = await apiFetch('/api/admin/email?action=stats').then((r) => r.json());
      setStats(statsRes.stats || null);
    } catch (error: unknown) {
      console.error('Failed to fetch email stats:', error);
    }
  }, [stats]);

  const fetchCustomers = useCallback(async () => {
    if (customers.length > 0) return;
    try {
      const customersRes = await apiFetch('/api/admin/email?action=customers').then((r) => r.json());
      setCustomers(customersRes.customers || []);
    } catch (error: unknown) {
      console.error('Failed to fetch email customers:', error);
    }
  }, [customers.length]);

  const fetchData = useCallback(async () => {
    await fetchLogs();
    if (activeTab === 1) {
      await apiFetch('/api/admin/email?action=customers')
        .then((r) => r.json())
        .then((res) => setCustomers(res.customers || []))
        .catch(() => {});
    }
    if (activeTab === 2) {
      setStats(null);
      await apiFetch('/api/admin/email?action=stats')
        .then((r) => r.json())
        .then((res) => setStats(res.stats || null))
        .catch(() => {});
    }
  }, [fetchLogs, activeTab]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (activeTab === 1) fetchCustomers();
    if (activeTab === 2) fetchStats();
  }, [activeTab, fetchStats, fetchCustomers]);

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
      const res = await apiFetch('/api/admin/email', {
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
    } catch (error: unknown) {
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
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="mb-1 text-xl font-extrabold text-[var(--foreground)]">
              ระบบจัดการอีเมล
            </h2>
            <p className="text-[0.9rem] text-[var(--muted-foreground)]">
              ส่งอีเมลแจ้งลูกค้าและดูประวัติการส่ง
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchData}
              disabled={loading}
              className="border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              <Refresh />
              รีเฟรช
            </Button>
            <Button
              onClick={() => setComposeOpen(true)}
              className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90"
            >
              <Send />
              เขียนอีเมล
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              icon={<Email />}
              label="ส่งทั้งหมด"
              value={stats.total}
              color="var(--primary)"
            />
            <StatCard
              icon={<CheckCircle />}
              label="สำเร็จ"
              value={stats.sent}
              color="var(--success)"
            />
            <StatCard
              icon={<ErrorIcon />}
              label="ล้มเหลว"
              value={stats.failed}
              color="var(--error)"
            />
            <StatCard
              icon={<AccessTime />}
              label="24 ชม. ล่าสุด"
              value={stats.last24h}
              color="var(--primary)"
            />
          </div>
        )}

        {/* Tabs */}
        <Card className="gap-0 overflow-hidden rounded-2xl border-[var(--border)] bg-[var(--card)] py-0 shadow-none">
          <Tabs
            value={String(activeTab)}
            onValueChange={(v) => setActiveTab(Number(v))}
          >
            <TabsList
              variant="line"
              className="h-auto w-full justify-start rounded-none border-b border-[var(--border)] bg-transparent p-0"
            >
              <TabsTrigger
                value="0"
                className="rounded-none px-4 py-3 data-[state=active]:text-[var(--primary)]"
              >
                <History size={18} />
                ประวัติส่ง
              </TabsTrigger>
              <TabsTrigger
                value="1"
                className="rounded-none px-4 py-3 data-[state=active]:text-[var(--primary)]"
              >
                <Groups size={18} />
                {`ลูกค้า (${customers.length})`}
              </TabsTrigger>
              <TabsTrigger
                value="2"
                className="rounded-none px-4 py-3 data-[state=active]:text-[var(--primary)]"
              >
                <TrendingUp size={18} />
                สถิติ
              </TabsTrigger>
            </TabsList>

            <CardContent className="pt-6">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="size-8 animate-spin text-[var(--primary)]" />
                </div>
              ) : (
                <>
                  {/* Tab 0: Email Logs */}
                  <TabsContent value="0" className="mt-0">
                    <div className="mb-4 flex gap-4">
                      <div className="relative max-w-[400px] flex-1">
                        <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-[var(--muted-foreground)]" />
                        <Input
                          placeholder="ค้นหาอีเมล, หัวข้อ, เลขออเดอร์..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="border-[var(--border)] bg-[var(--glass-bg)] pl-10 text-[var(--foreground)]"
                        />
                      </div>
                    </div>

                    <ScrollArea className="h-[500px] rounded-md border border-[var(--border)]">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-[var(--card)]">
                          <TableRow className="border-[var(--border)] hover:bg-transparent">
                            <TableHead className="bg-[var(--glass-bg)] font-bold text-[var(--muted-foreground)]">สถานะ</TableHead>
                            <TableHead className="bg-[var(--glass-bg)] font-bold text-[var(--muted-foreground)]">ประเภท</TableHead>
                            <TableHead className="bg-[var(--glass-bg)] font-bold text-[var(--muted-foreground)]">ผู้รับ</TableHead>
                            <TableHead className="bg-[var(--glass-bg)] font-bold text-[var(--muted-foreground)]">หัวข้อ</TableHead>
                            <TableHead className="bg-[var(--glass-bg)] font-bold text-[var(--muted-foreground)]">ออเดอร์</TableHead>
                            <TableHead className="bg-[var(--glass-bg)] font-bold text-[var(--muted-foreground)]">เวลา</TableHead>
                            <TableHead className="w-[60px] bg-[var(--glass-bg)] font-bold text-[var(--muted-foreground)]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedLogs.map((log) => {
                            const typeInfo = typeLabels[log.type] || {
                              label: log.type,
                              color: 'var(--muted-foreground)',
                              icon: <Email size={16} />,
                            };
                            const isExpanded = expandedLog === log.id;

                            return (
                              <Fragment key={log.id}>
                                <TableRow
                                  className="cursor-pointer border-[var(--border)] hover:bg-[var(--glass-bg)]"
                                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                                >
                                  <TableCell>
                                    <Badge
                                      className="border-0 text-[0.7rem] font-semibold"
                                      style={{
                                        backgroundColor: `color-mix(in srgb, ${statusColors[log.status]} 20%, transparent)`,
                                        color: statusColors[log.status],
                                      }}
                                    >
                                      {log.status === 'sent' ? 'ส่งแล้ว' : log.status === 'failed' ? 'ล้มเหลว' : 'รอส่ง'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      className="gap-1 border-0 text-[0.7rem] font-semibold [&>svg]:text-current"
                                      style={{
                                        backgroundColor: `color-mix(in srgb, ${typeInfo.color} 20%, transparent)`,
                                        color: typeInfo.color,
                                      }}
                                    >
                                      {typeInfo.icon}
                                      {typeInfo.label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-[0.85rem] text-[var(--foreground)]">
                                      {log.to}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <span className="block max-w-[200px] truncate text-[0.85rem] text-[var(--muted-foreground)]">
                                      {log.subject}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    {log.orderRef ? (
                                      <Badge
                                        className="border-0 bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[0.7rem] font-semibold text-[var(--primary)]"
                                      >
                                        {log.orderRef}
                                      </Badge>
                                    ) : (
                                      <span className="text-[0.8rem] text-[var(--muted-foreground)]">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-[0.8rem] text-[var(--muted-foreground)]">
                                      {formatDate(log.sentAt)}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-[var(--muted-foreground)]">
                                      {isExpanded ? <ExpandLess size={18} /> : <ExpandMore size={18} />}
                                    </span>
                                  </TableCell>
                                </TableRow>
                                {isExpanded && (
                                  <TableRow className="border-[var(--border)] hover:bg-transparent">
                                    <TableCell colSpan={7} className="p-0">
                                      <div className="bg-[var(--glass-bg)] p-4">
                                        <p className="mb-2 text-[0.85rem] text-[var(--muted-foreground)]">
                                          <strong>ID:</strong> {log.id}
                                        </p>
                                        {log.error && (
                                          <Alert variant="destructive" className="mt-2 bg-[color-mix(in_srgb,var(--error)_10%,transparent)]">
                                            <AlertDescription>{log.error}</AlertDescription>
                                          </Alert>
                                        )}
                                        {log.metadata && (
                                          <p className="mt-2 text-[0.8rem] text-[var(--muted-foreground)]">
                                            <strong>Metadata:</strong> {JSON.stringify(log.metadata)}
                                          </p>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="mt-2 text-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setComposeTo(log.to);
                                            setComposeMode('single');
                                            setComposeOpen(true);
                                          }}
                                        >
                                          <Send />
                                          ส่งอีเมลใหม่
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Fragment>
                            );
                          })}
                          {paginatedLogs.length === 0 && (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={7} className="py-8 text-center">
                                <span className="text-[var(--muted-foreground)]">
                                  {searchTerm ? 'ไม่พบผลลัพธ์' : 'ยังไม่มีประวัติการส่งอีเมล'}
                                </span>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>

                    {totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => p - 1)}
                          className="border-[var(--border)] text-[var(--muted-foreground)]"
                        >
                          <ChevronLeft />
                          ก่อนหน้า
                        </Button>
                        <span className="text-sm text-[var(--muted-foreground)]">
                          {page} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => p + 1)}
                          className="border-[var(--border)] text-[var(--muted-foreground)]"
                        >
                          ถัดไป
                          <ChevronRight />
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  {/* Tab 1: Customers */}
                  <TabsContent value="1" className="mt-0">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                      <div className="relative max-w-[300px] flex-1">
                        <Search className="absolute top-1/2 left-3 size-6 -translate-y-1/2 text-[var(--muted-foreground)]" />
                        <Input
                          placeholder="ค้นหาลูกค้า..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="border-[var(--border)] bg-[var(--glass-bg)] pl-10 text-[var(--foreground)]"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedCustomers.length > 0 && (
                          <>
                            <Badge className="gap-1 bg-[var(--primary)] text-[var(--primary-foreground)]">
                              {`เลือก ${selectedCustomers.length} คน`}
                              <button
                                type="button"
                                onClick={deselectAllCustomers}
                                className="ml-1 rounded-sm hover:opacity-80"
                              >
                                <Close size={14} />
                              </button>
                            </Badge>
                            <Button
                              onClick={() => {
                                setComposeMode('broadcast');
                                setComposeOpen(true);
                              }}
                              className="bg-[var(--success)] text-white hover:bg-[var(--success)]/90"
                            >
                              <Campaign />
                              ส่งอีเมลถึงที่เลือก
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={selectedCustomers.length === customers.length ? deselectAllCustomers : selectAllCustomers}
                          className="border-[var(--border)] text-[var(--muted-foreground)]"
                        >
                          {selectedCustomers.length === customers.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                        </Button>
                      </div>
                    </div>

                    <ScrollArea className="h-[500px]">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
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
                                className={cn(
                                  'cursor-pointer gap-0 rounded-xl border py-0 shadow-none transition-all hover:border-[var(--primary)]',
                                  isSelected
                                    ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_15%,transparent)]'
                                    : 'border-[var(--border)] bg-[var(--glass-bg)]'
                                )}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-center gap-3">
                                    <Checkbox
                                      checked={isSelected}
                                      className="pointer-events-none"
                                    />
                                    <Avatar size="sm" className="size-9 bg-[var(--primary)]">
                                      <AvatarFallback className="bg-[var(--primary)] text-[0.9rem] text-[var(--primary-foreground)]">
                                        {customer.name.charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-[0.9rem] font-semibold text-[var(--foreground)]">
                                        {customer.name}
                                      </p>
                                      <p className="truncate text-[0.75rem] text-[var(--muted-foreground)]">
                                        {customer.email}
                                      </p>
                                    </div>
                                    <Badge
                                      className="border-0 bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[0.7rem] text-[var(--success)]"
                                    >
                                      {`${customer.orderCount} ออเดอร์`}
                                    </Badge>
                                  </div>
                                  <div className="mt-3 flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 flex-1 text-[0.75rem] text-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openComposeForCustomer(customer);
                                      }}
                                    >
                                      <Email />
                                      ส่งอีเมล
                                    </Button>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon-sm"
                                          variant="ghost"
                                          className="text-[var(--muted-foreground)]"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(customer.email);
                                            showToast('info', 'คัดลอกอีเมลแล้ว');
                                          }}
                                        >
                                          <ContentCopy size={16} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>คัดลอกอีเมล</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Tab 2: Statistics */}
                  <TabsContent value="2" className="mt-0">
                    {stats && (
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* By Type */}
                        <Card className="rounded-xl border-[var(--border)] bg-[var(--glass-bg)] py-0 shadow-none">
                          <CardContent className="p-6">
                            <h3 className="mb-4 font-bold text-[var(--foreground)]">
                              จำแนกตามประเภท
                            </h3>
                            <div className="flex flex-col gap-3">
                              {Object.entries(stats.byType).map(([type, count]) => {
                                const typeInfo = typeLabels[type] || { label: type, color: 'var(--muted-foreground)' };
                                const percentage = Math.round((count / stats.total) * 100);
                                return (
                                  <div key={type}>
                                    <div className="mb-1 flex justify-between">
                                      <span className="text-[0.85rem] text-[var(--muted-foreground)]">
                                        {typeInfo.label}
                                      </span>
                                      <span className="text-[0.85rem] font-semibold text-[var(--foreground)]">
                                        {count} ({percentage}%)
                                      </span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-bg)]">
                                      <div
                                        className="h-full rounded-full transition-[width] duration-500 ease-out"
                                        style={{
                                          width: `${percentage}%`,
                                          backgroundColor: typeInfo.color,
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Overview */}
                        <Card className="rounded-xl border-[var(--border)] bg-[var(--glass-bg)] py-0 shadow-none">
                          <CardContent className="p-6">
                            <h3 className="mb-4 font-bold text-[var(--foreground)]">
                              ภาพรวม
                            </h3>
                            <div className="flex flex-col gap-4">
                              <div className="flex items-center justify-between">
                                <span className="text-[var(--muted-foreground)]">อีเมลทั้งหมด</span>
                                <span className="text-[1.2rem] font-bold text-[var(--foreground)]">{stats.total}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[var(--muted-foreground)]">ส่งสำเร็จ</span>
                                <span className="text-[1.2rem] font-bold text-[var(--success)]">{stats.sent}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[var(--muted-foreground)]">ล้มเหลว</span>
                                <span className="text-[1.2rem] font-bold text-[var(--error)]">{stats.failed}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[var(--muted-foreground)]">24 ชั่วโมงล่าสุด</span>
                                <span className="text-[1.2rem] font-bold text-[var(--primary)]">{stats.last24h}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[var(--muted-foreground)]">7 วันล่าสุด</span>
                                <span className="text-[1.2rem] font-bold text-[var(--warning)]">{stats.last7days}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </TabsContent>
                </>
              )}
            </CardContent>
          </Tabs>
        </Card>

        {/* Compose Dialog */}
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogContent className="max-w-2xl border-[var(--border)] bg-[var(--card)] sm:max-w-2xl">
            <DialogHeader className="flex-row items-center justify-between space-y-0 border-b border-[var(--border)] pb-4">
              <DialogTitle className="flex items-center gap-2 font-bold text-[var(--foreground)]">
                {composeMode === 'broadcast' ? (
                  <Campaign size={24} className="text-[var(--success)]" />
                ) : (
                  <Email size={24} className="text-[var(--primary)]" />
                )}
                {composeMode === 'broadcast' ? `ส่งถึงลูกค้า ${selectedCustomers.length} คน` : 'เขียนอีเมล'}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              {composeMode === 'single' && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="compose-to" className="text-[var(--muted-foreground)]">
                      ถึง (อีเมล) *
                    </Label>
                    <Input
                      id="compose-to"
                      value={composeTo}
                      onChange={(e) => setComposeTo(e.target.value)}
                      className="border-[var(--border)] text-[var(--foreground)]"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="compose-name" className="text-[var(--muted-foreground)]">
                      ชื่อผู้รับ
                    </Label>
                    <Input
                      id="compose-name"
                      value={composeName}
                      onChange={(e) => setComposeName(e.target.value)}
                      placeholder="ลูกค้า"
                      className="border-[var(--border)] text-[var(--foreground)]"
                    />
                  </div>
                </>
              )}

              {composeMode === 'broadcast' && (
                <div className="max-h-[150px] overflow-auto rounded-xl bg-[var(--glass-bg)] p-4">
                  <p className="mb-2 text-[0.85rem] text-[var(--muted-foreground)]">
                    ผู้รับ ({selectedCustomers.length} คน):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedCustomers.map(c => (
                      <Badge
                        key={c.email}
                        className="gap-1 border-0 bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-[var(--primary)]"
                      >
                        {c.name || c.email}
                        <button
                          type="button"
                          onClick={() => toggleCustomerSelection(c)}
                          className="rounded-sm hover:opacity-80"
                        >
                          <Close size={12} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="compose-subject" className="text-[var(--muted-foreground)]">
                  หัวข้อ *
                </Label>
                <Input
                  id="compose-subject"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="border-[var(--border)] text-[var(--foreground)]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="compose-message" className="text-[var(--muted-foreground)]">
                  ข้อความ *
                </Label>
                <Textarea
                  id="compose-message"
                  value={composeMessage}
                  onChange={(e) => setComposeMessage(e.target.value)}
                  rows={6}
                  placeholder="พิมพ์ข้อความที่ต้องการส่ง..."
                  className="border-[var(--border)] text-[var(--foreground)]"
                />
              </div>

              <Alert className="border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]">
                <AlertDescription>
                  อีเมลจะถูกส่งในรูปแบบ HTML พร้อมดีไซน์สวยงาม โดยอัตโนมัติ
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter className="border-t border-[var(--border)] pt-4">
              <Button
                variant="ghost"
                onClick={() => setComposeOpen(false)}
                className="text-[var(--muted-foreground)]"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={sending}
                className={cn(
                  'text-white',
                  composeMode === 'broadcast'
                    ? 'bg-[var(--success)] hover:bg-[var(--success)]/90'
                    : 'bg-[var(--primary)] hover:bg-[var(--primary)]/90'
                )}
              >
                {sending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    กำลังส่ง...
                  </>
                ) : (
                  <>
                    <Send />
                    {composeMode === 'broadcast' ? `ส่ง ${selectedCustomers.length} ฉบับ` : 'ส่งอีเมล'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// Stat Card Component
function StatCard({ icon, label, value, color }: { icon: ReactElement; label: string; value: number; color: string }) {
  return (
    <Card className="rounded-xl border-[var(--border)] bg-[var(--glass-bg)] py-0 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="grid size-10 place-items-center rounded-[10px]"
            style={{
              backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
              color,
            }}
          >
            {icon}
          </div>
          <div>
            <p className="text-[0.75rem] text-[var(--muted-foreground)]">
              {label}
            </p>
            <p className="text-[1.25rem] font-bold text-[var(--foreground)]">
              {value.toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
