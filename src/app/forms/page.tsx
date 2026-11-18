'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Box, Card, Chip, Container, Skeleton, Typography } from '@mui/material';
import { CheckCircle2, ChevronRight, ClipboardList, Clock, ShieldCheck, Users } from 'lucide-react';
import StorefrontNavbar from '@/components/StorefrontNavbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import { apiFetch } from '@/lib/api-client';
import { FormBannerThumb } from '@/components/forms/FormBanner';
import type { FormListItem } from '@/lib/forms';

function formatDate(iso?: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function FormsListPage() {
  const [forms, setForms] = useState<FormListItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    apiFetch('/api/forms', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (data?.status === 'success') setForms(data.forms || []);
        else setError(data?.message || 'โหลดแบบฟอร์มไม่สำเร็จ');
      })
      .catch(() => alive && setError('โหลดแบบฟอร์มไม่สำเร็จ'));
    return () => { alive = false; };
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background, #f8fafc)', color: 'var(--foreground, #0f172a)', pb: 10 }}>
      <StorefrontNavbar />
      <Container maxWidth="md" sx={{ pt: { xs: 3, md: 5 }, pb: 6 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: '1.5rem', md: '2rem' }, mb: 0.5 }}>
            แบบสำรวจ & โหวต
          </Typography>
          <Typography sx={{ color: 'var(--text-muted, #64748b)' }}>
            ร่วมแสดงความคิดเห็น ลงชื่อ หรือโหวตกิจกรรมของชุมนุม
          </Typography>
        </Box>

        {error && <Typography color="error">{error}</Typography>}

        {!forms && !error && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={110} />)}
          </Box>
        )}

        {forms && forms.length === 0 && (
          <Card variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
            <ClipboardList size={36} style={{ opacity: 0.5 }} />
            <Typography sx={{ mt: 1, color: 'text.secondary' }}>ยังไม่มีแบบสำรวจที่เปิดอยู่ตอนนี้</Typography>
          </Card>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {forms?.map((f) => (
            <Card
              key={f.id}
              component={Link}
              href={`/forms/${f.id}`}
              prefetch
              variant="outlined"
              sx={{
                p: { xs: 2, md: 2.5 },
                borderRadius: 3,
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                // Phones: banner on top at full width; larger screens: thumbnail beside the text
                flexDirection: { xs: 'column', sm: 'row' },
                gap: { xs: 1.5, sm: 2 },
                alignItems: { xs: 'stretch', sm: 'flex-start' },
                transition: 'border-color .15s, transform .15s',
                '&:hover': { borderColor: 'primary.main', transform: 'translateY(-1px)' },
                '&:active': { transform: 'scale(0.99)' },
              }}
            >
              <FormBannerThumb banner={f.banner} className="aspect-[3/1] w-full sm:aspect-auto sm:h-20 sm:w-32" />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', overflowWrap: 'anywhere' }}>{f.title}</Typography>
                  {f.isAcceptingResponses ? (
                    <Chip size="small" label="เปิดรับคำตอบ" sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 700 }} />
                  ) : (
                    <Chip size="small" label="ปิดแล้ว" sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700 }} />
                  )}
                  {f.accessMode === 'public' ? (
                    <Chip size="small" label="ไม่ต้องเข้าสู่ระบบ" sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700 }} />
                  ) : f.accessNote ? (
                    <Chip size="small" label={f.accessNote} sx={{ bgcolor: '#ede9fe', color: '#5b21b6', fontWeight: 700 }} />
                  ) : null}
                  {f.hasResponded && (
                    <Chip size="small" icon={<CheckCircle2 size={14} />} label="ตอบแล้ว" sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 700 }} />
                  )}
                  {f.pdpaEnabled && (
                    <Chip size="small" icon={<ShieldCheck size={13} />} label="PDPA" sx={{ bgcolor: '#f1f5f9', color: '#334155', fontWeight: 700 }} />
                  )}
                </Box>
                {f.description && (
                  <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem', mb: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {f.description}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', columnGap: 2, rowGap: 0.5, flexWrap: 'wrap', alignItems: 'center', color: 'text.secondary', fontSize: '0.8rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><ClipboardList size={14} /> {f.questionCount} คำถาม</Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Users size={14} /> {f.responseCount} คนตอบแล้ว</Box>
                  {f.closesAt && f.isAcceptingResponses && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Clock size={14} /> ปิด {formatDate(f.closesAt)}</Box>
                  )}
                  <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.25, color: 'primary.main', fontWeight: 700, fontSize: '0.85rem' }}>
                    {f.isAcceptingResponses && !f.hasResponded ? 'เริ่มตอบ' : 'ดูผล'} <ChevronRight size={16} />
                  </Box>
                </Box>
              </Box>
            </Card>
          ))}
        </Box>
      </Container>
      <MobileBottomNav />
    </Box>
  );
}
