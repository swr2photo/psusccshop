'use client';

import { Box, Container, Typography, Paper, Divider, List, ListItem, ListItemIcon, ListItemText, Button, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { 
  Shield, 
  Database, 
  Lock, 
  Eye, 
  Trash2, 
  Download, 
  Mail, 
  Clock, 
  Users, 
  Globe, 
  ChevronDown,
  ArrowLeft,
  Cookie,
  FileText,
  AlertCircle,
  CheckCircle,
  Settings
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// Theme colors
const THEME = {
  bg: '#0a0f1a',
  bgCard: 'rgba(15,23,42,0.85)',
  glass: 'rgba(30,41,59,0.6)',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  muted: '#64748b',
  border: 'rgba(255,255,255,0.08)',
  primary: '#6366f1',
  success: '#10b981',
};

const LAST_UPDATED = '20 มกราคม 2569';
const VERSION = '2.0';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: THEME.bg,
      py: { xs: 4, md: 8 },
      px: { xs: 2, sm: 3 }
    }}>
      <Container maxWidth="md">
        {/* Back Button */}
        <Button
          startIcon={<ArrowLeft size={18} />}
          onClick={() => router.push('/')}
          sx={{
            mb: 4,
            color: THEME.textSecondary,
            '&:hover': { color: THEME.text }
          }}
        >
          กลับหน้าหลัก
        </Button>

        {/* Header */}
        <Paper sx={{
          p: { xs: 3, md: 5 },
          borderRadius: '24px',
          bgcolor: THEME.bgCard,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${THEME.border}`,
          mb: 4,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Box sx={{
              width: 56,
              height: 56,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
            }}>
              <Shield size={28} color="white" />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: THEME.text, mb: 0.5 }}>
                นโยบายความเป็นส่วนตัว
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', color: THEME.textSecondary }}>
                Privacy Policy • PDPA Compliance
              </Typography>
            </Box>
          </Box>

          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 2, 
            p: 2, 
            borderRadius: '12px', 
            bgcolor: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.2)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Clock size={16} color="#94a3b8" />
              <Typography sx={{ fontSize: '0.85rem', color: THEME.textSecondary }}>
                อัปเดตล่าสุด: {LAST_UPDATED}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FileText size={16} color="#94a3b8" />
              <Typography sx={{ fontSize: '0.85rem', color: THEME.textSecondary }}>
                เวอร์ชัน {VERSION}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Introduction */}
        <Paper sx={{
          p: { xs: 3, md: 4 },
          borderRadius: '20px',
          bgcolor: THEME.bgCard,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${THEME.border}`,
          mb: 3,
        }}>
          <Typography sx={{ fontSize: '1rem', color: THEME.text, lineHeight: 1.8, mb: 3 }}>
            ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ (&quot;SCC Shop&quot;, &quot;เรา&quot;, &quot;ของเรา&quot;) 
            ให้ความสำคัญกับความเป็นส่วนตัวของข้อมูลของท่าน นโยบายความเป็นส่วนตัวฉบับนี้อธิบายวิธีการที่เราเก็บรวบรวม 
            ใช้ เปิดเผย และคุ้มครองข้อมูลส่วนบุคคลของท่าน ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
          </Typography>

          <Box sx={{ 
            p: 2.5, 
            borderRadius: '14px', 
            bgcolor: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <CheckCircle size={20} color="#10b981" />
              <Typography sx={{ fontSize: '0.9rem', color: '#6ee7b7', lineHeight: 1.7 }}>
                <strong>คำมั่นสัญญาของเรา:</strong> เราจะไม่ขายหรือเปิดเผยข้อมูลส่วนบุคคลของท่านให้กับบุคคลภายนอก 
                เว้นแต่จะได้รับความยินยอมจากท่านหรือตามที่กฎหมายกำหนด
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Section 1: Data Collection */}
        <Accordion 
          defaultExpanded
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
            '&.Mui-expanded': { margin: '0 0 24px 0' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Database size={24} color="#6366f1" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                1. ข้อมูลที่เราเก็บรวบรวม
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              เราเก็บรวบรวมข้อมูลส่วนบุคคลของท่านเฉพาะเท่าที่จำเป็นสำหรับการให้บริการ:
            </Typography>
            
            <Box sx={{ bgcolor: 'rgba(30,41,59,0.5)', borderRadius: '14px', p: 3 }}>
              <Typography sx={{ fontWeight: 600, color: THEME.text, mb: 2 }}>
                ข้อมูลที่ท่านให้โดยตรง:
              </Typography>
              <List dense>
                {[
                  { primary: 'ชื่อ-นามสกุล', secondary: 'สำหรับการจัดส่งสินค้าและการติดต่อ' },
                  { primary: 'อีเมล', secondary: 'สำหรับการยืนยันตัวตนและการแจ้งสถานะคำสั่งซื้อ' },
                  { primary: 'หมายเลขโทรศัพท์', secondary: 'สำหรับการติดต่อกรณีมีปัญหาการจัดส่ง' },
                  { primary: 'ที่อยู่จัดส่ง', secondary: 'สำหรับการจัดส่งสินค้า (เฉพาะกรณีเลือกจัดส่ง)' },
                  { primary: 'Instagram', secondary: 'สำหรับการติดต่อทางช่องทางเสริม' },
                  { primary: 'หลักฐานการชำระเงิน (สลิป)', secondary: 'สำหรับการยืนยันการชำระเงิน' },
                ].map((item, idx) => (
                  <ListItem key={idx} sx={{ py: 1 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircle size={16} color="#10b981" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.primary}
                      secondary={item.secondary}
                      primaryTypographyProps={{ sx: { color: THEME.text, fontWeight: 500 } }}
                      secondaryTypographyProps={{ sx: { color: THEME.muted, fontSize: '0.85rem' } }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            <Box sx={{ bgcolor: 'rgba(30,41,59,0.5)', borderRadius: '14px', p: 3, mt: 3 }}>
              <Typography sx={{ fontWeight: 600, color: THEME.text, mb: 2 }}>
                ข้อมูลที่เก็บรวบรวมโดยอัตโนมัติ:
              </Typography>
              <List dense>
                {[
                  { primary: 'ข้อมูลการเข้าสู่ระบบ', secondary: 'ผ่าน Google Account (OAuth 2.0)' },
                  { primary: 'IP Address', secondary: 'สำหรับการรักษาความปลอดภัย' },
                  { primary: 'คุกกี้', secondary: 'สำหรับการจดจำตะกร้าสินค้าและการตั้งค่า' },
                ].map((item, idx) => (
                  <ListItem key={idx} sx={{ py: 1 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Settings size={16} color="#6366f1" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.primary}
                      secondary={item.secondary}
                      primaryTypographyProps={{ sx: { color: THEME.text, fontWeight: 500 } }}
                      secondaryTypographyProps={{ sx: { color: THEME.muted, fontSize: '0.85rem' } }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Section 2: Purpose of Use */}
        <Accordion 
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Eye size={24} color="#6366f1" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                2. วัตถุประสงค์ในการใช้ข้อมูล
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <List>
              {[
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'ดำเนินการตามคำสั่งซื้อและจัดส่งสินค้า' },
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'ยืนยันการชำระเงินและตรวจสอบสลิป' },
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'แจ้งสถานะคำสั่งซื้อทางอีเมล' },
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'ติดต่อกรณีมีปัญหาเกี่ยวกับคำสั่งซื้อ' },
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'ป้องกันการทุจริตและรักษาความปลอดภัยของระบบ' },
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'ปฏิบัติตามกฎหมายที่เกี่ยวข้อง' },
              ].map((item, idx) => (
                <ListItem key={idx} sx={{ py: 1.5 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText 
                    primary={item.text}
                    primaryTypographyProps={{ sx: { color: THEME.text, lineHeight: 1.6 } }}
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>

        {/* Section 3: Data Retention */}
        <Accordion 
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Clock size={24} color="#6366f1" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                3. ระยะเวลาในการเก็บรักษาข้อมูล
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Box sx={{ bgcolor: 'rgba(30,41,59,0.5)', borderRadius: '14px', overflow: 'hidden' }}>
              {[
                { type: 'ข้อมูลคำสั่งซื้อ', duration: '2 ปี นับจากวันที่สั่งซื้อ', note: 'ตามข้อกำหนดทางบัญชี' },
                { type: 'หลักฐานการชำระเงิน', duration: '2 ปี นับจากวันที่ชำระเงิน', note: 'เพื่อการตรวจสอบ' },
                { type: 'ข้อมูลโปรไฟล์ผู้ใช้', duration: 'จนกว่าจะขอลบ', note: 'สามารถขอลบได้ทุกเมื่อ' },
                { type: 'คุกกี้', duration: '1 ปี', note: 'หรือจนกว่าจะลบออก' },
                { type: 'Logs ความปลอดภัย', duration: '90 วัน', note: 'สำหรับการตรวจสอบ' },
              ].map((item, idx) => (
                <Box 
                  key={idx} 
                  sx={{ 
                    p: 2.5, 
                    borderBottom: idx < 4 ? `1px solid ${THEME.border}` : 'none',
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 1, sm: 2 },
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography sx={{ fontWeight: 600, color: THEME.text }}>{item.type}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography sx={{ color: '#6ee7b7', fontWeight: 500 }}>{item.duration}</Typography>
                    <Typography sx={{ color: THEME.muted, fontSize: '0.85rem' }}>({item.note})</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Section 4: Your Rights */}
        <Accordion 
          defaultExpanded
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Users size={24} color="#6366f1" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                4. สิทธิ์ของเจ้าของข้อมูล (PDPA Rights)
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ท่านมีสิทธิ์ดังต่อไปนี้:
            </Typography>
            
            <Box sx={{ display: 'grid', gap: 2 }}>
              {[
                { 
                  icon: <Eye size={20} />, 
                  title: 'สิทธิ์ในการเข้าถึง', 
                  desc: 'ท่านสามารถขอดูข้อมูลส่วนบุคคลที่เราเก็บรักษาไว้เกี่ยวกับท่านได้',
                  color: '#6366f1'
                },
                { 
                  icon: <Download size={20} />, 
                  title: 'สิทธิ์ในการขอรับข้อมูล', 
                  desc: 'ท่านสามารถขอรับสำเนาข้อมูลส่วนบุคคลของท่านในรูปแบบที่อ่านได้',
                  color: '#0ea5e9'
                },
                { 
                  icon: <Settings size={20} />, 
                  title: 'สิทธิ์ในการแก้ไขข้อมูล', 
                  desc: 'ท่านสามารถขอให้แก้ไขข้อมูลส่วนบุคคลที่ไม่ถูกต้องหรือไม่สมบูรณ์',
                  color: '#f59e0b'
                },
                { 
                  icon: <Trash2 size={20} />, 
                  title: 'สิทธิ์ในการลบข้อมูล', 
                  desc: 'ท่านสามารถขอให้ลบข้อมูลส่วนบุคคลของท่านได้ ยกเว้นข้อมูลที่ต้องเก็บตามกฎหมาย',
                  color: '#ef4444'
                },
                { 
                  icon: <Lock size={20} />, 
                  title: 'สิทธิ์ในการระงับการใช้', 
                  desc: 'ท่านสามารถขอให้ระงับการใช้ข้อมูลส่วนบุคคลของท่านชั่วคราว',
                  color: '#8b5cf6'
                },
                { 
                  icon: <AlertCircle size={20} />, 
                  title: 'สิทธิ์ในการคัดค้าน', 
                  desc: 'ท่านสามารถคัดค้านการประมวลผลข้อมูลส่วนบุคคลของท่านได้',
                  color: '#ec4899'
                },
              ].map((item, idx) => (
                <Box 
                  key={idx}
                  sx={{
                    p: 2.5,
                    borderRadius: '14px',
                    bgcolor: 'rgba(30,41,59,0.5)',
                    border: `1px solid ${THEME.border}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                  }}
                >
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    bgcolor: `${item.color}20`,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    color: item.color,
                  }}>
                    {item.icon}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600, color: THEME.text, mb: 0.5 }}>
                      {item.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: THEME.textSecondary, lineHeight: 1.6 }}>
                      {item.desc}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>

            <Box sx={{ 
              mt: 4, 
              p: 3, 
              borderRadius: '14px', 
              bgcolor: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}>
              <Typography sx={{ fontWeight: 600, color: THEME.text, mb: 2 }}>
                วิธีการใช้สิทธิ์:
              </Typography>
              <Typography sx={{ color: THEME.textSecondary, lineHeight: 1.8 }}>
                ส่งคำขอมาที่อีเมล <Box component="span" sx={{ color: '#a78bfa', fontWeight: 600 }}>psuscc@psusci.club</Box> 
                {' '}พร้อมระบุชื่อ-อีเมลที่ใช้สั่งซื้อ และสิทธิ์ที่ต้องการใช้ 
                เราจะดำเนินการภายใน <strong>30 วัน</strong> นับจากวันที่ได้รับคำขอ
              </Typography>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Section 5: Security Measures */}
        <Accordion 
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Lock size={24} color="#6366f1" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                5. มาตรการรักษาความปลอดภัย
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              เราใช้มาตรการรักษาความปลอดภัยตามมาตรฐานสากล:
            </Typography>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              {[
                { icon: <Lock size={18} />, text: 'การเข้ารหัส HTTPS/TLS' },
                { icon: <Shield size={18} />, text: 'Content Security Policy (CSP)' },
                { icon: <Database size={18} />, text: 'การเข้ารหัสข้อมูลด้วย SHA-256' },
                { icon: <Users size={18} />, text: 'การยืนยันตัวตนด้วย OAuth 2.0' },
                { icon: <Eye size={18} />, text: 'Rate Limiting & IP Blocking' },
                { icon: <AlertCircle size={18} />, text: 'การป้องกัน SQL/XSS Injection' },
                { icon: <Settings size={18} />, text: 'Bot Detection & Prevention' },
                { icon: <CheckCircle size={18} />, text: 'Regular Security Audits' },
              ].map((item, idx) => (
                <Box 
                  key={idx}
                  sx={{
                    p: 2,
                    borderRadius: '12px',
                    bgcolor: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    color: '#6ee7b7',
                  }}
                >
                  {item.icon}
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.text}</Typography>
                </Box>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Section 6: Cookies */}
        <Accordion 
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Cookie size={24} color="#6366f1" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                6. นโยบายคุกกี้
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              เราใช้คุกกี้เพื่อปรับปรุงประสบการณ์การใช้งานของท่าน โดยแบ่งออกเป็น 4 ประเภท:
            </Typography>
            
            <Box sx={{ bgcolor: 'rgba(30,41,59,0.5)', borderRadius: '14px', overflow: 'hidden' }}>
              {[
                { 
                  type: 'คุกกี้ที่จำเป็น (Essential)', 
                  required: true,
                  desc: 'สำหรับการทำงานพื้นฐานของเว็บไซต์ เช่น การเข้าสู่ระบบ, ความปลอดภัย',
                },
                { 
                  type: 'คุกกี้ฟังก์ชัน (Functional)', 
                  required: false,
                  desc: 'สำหรับจดจำตะกร้าสินค้า, ข้อมูลส่วนตัว, การตั้งค่าต่างๆ',
                },
                { 
                  type: 'คุกกี้วิเคราะห์ (Analytics)', 
                  required: false,
                  desc: 'สำหรับเข้าใจพฤติกรรมการใช้งานเพื่อปรับปรุงบริการ',
                },
                { 
                  type: 'คุกกี้การตลาด (Marketing)', 
                  required: false,
                  desc: 'สำหรับแสดงโฆษณาที่ตรงกับความสนใจของท่าน',
                },
              ].map((item, idx) => (
                <Box 
                  key={idx} 
                  sx={{ 
                    p: 2.5, 
                    borderBottom: idx < 3 ? `1px solid ${THEME.border}` : 'none',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Typography sx={{ fontWeight: 600, color: THEME.text }}>{item.type}</Typography>
                    {item.required && (
                      <Box sx={{
                        px: 1.5,
                        py: 0.3,
                        borderRadius: '8px',
                        bgcolor: 'rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.3)',
                      }}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#6ee7b7' }}>
                          จำเป็น
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Typography sx={{ color: THEME.muted, fontSize: '0.9rem' }}>{item.desc}</Typography>
                </Box>
              ))}
            </Box>

            <Typography sx={{ color: THEME.textSecondary, mt: 3, lineHeight: 1.7 }}>
              ท่านสามารถจัดการการตั้งค่าคุกกี้ได้ผ่าน Cookie Banner ที่ด้านล่างของหน้าเว็บ 
              หรือลบคุกกี้ทั้งหมดผ่านการตั้งค่าเบราว์เซอร์
            </Typography>
          </AccordionDetails>
        </Accordion>

        {/* Section 7: Third Parties */}
        <Accordion 
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Globe size={24} color="#6366f1" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                7. การเปิดเผยข้อมูลต่อบุคคลภายนอก
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              เราอาจเปิดเผยข้อมูลส่วนบุคคลของท่านให้กับบุคคลภายนอกในกรณีต่อไปนี้เท่านั้น:
            </Typography>
            
            <Box sx={{ bgcolor: 'rgba(30,41,59,0.5)', borderRadius: '14px', overflow: 'hidden' }}>
              {[
                { 
                  party: 'Google (OAuth)', 
                  purpose: 'การยืนยันตัวตนเมื่อเข้าสู่ระบบ',
                },
                { 
                  party: 'Cloudflare', 
                  purpose: 'การรักษาความปลอดภัยและ CDN',
                },
                { 
                  party: 'Filebase (S3)', 
                  purpose: 'การจัดเก็บข้อมูลคำสั่งซื้อและรูปภาพ',
                },
                { 
                  party: 'Resend', 
                  purpose: 'การส่งอีเมลแจ้งเตือน',
                },
                { 
                  party: 'SlipOK', 
                  purpose: 'การตรวจสอบสลิปการชำระเงิน',
                },
              ].map((item, idx) => (
                <Box 
                  key={idx} 
                  sx={{ 
                    p: 2.5, 
                    borderBottom: idx < 4 ? `1px solid ${THEME.border}` : 'none',
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: 1,
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography sx={{ fontWeight: 600, color: THEME.text }}>{item.party}</Typography>
                  <Typography sx={{ color: THEME.muted, fontSize: '0.9rem' }}>{item.purpose}</Typography>
                </Box>
              ))}
            </Box>

            <Box sx={{ 
              mt: 3, 
              p: 2.5, 
              borderRadius: '14px', 
              bgcolor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <AlertCircle size={20} color="#f87171" />
                <Typography sx={{ fontSize: '0.9rem', color: '#fca5a5', lineHeight: 1.7 }}>
                  <strong>หมายเหตุ:</strong> เราจะไม่ขายหรือให้เช่าข้อมูลส่วนบุคคลของท่านแก่บุคคลภายนอกเด็ดขาด
                </Typography>
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Section 8: Contact */}
        <Paper sx={{
          p: { xs: 3, md: 4 },
          borderRadius: '20px',
          bgcolor: THEME.bgCard,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${THEME.border}`,
          mb: 3,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Mail size={24} color="#6366f1" />
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
              8. ช่องทางติดต่อ (Data Protection Officer)
            </Typography>
          </Box>

          <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
            หากท่านมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัว หรือต้องการใช้สิทธิ์ของเจ้าของข้อมูล สามารถติดต่อเราได้ที่:
          </Typography>

          <Box sx={{ 
            p: 3, 
            borderRadius: '14px', 
            bgcolor: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.2)',
          }}>
            <Typography sx={{ fontWeight: 700, color: THEME.text, mb: 2, fontSize: '1.1rem' }}>
              ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Mail size={18} color="#a78bfa" />
                <Typography sx={{ color: THEME.text }}>
                  อีเมล: <Box component="span" sx={{ color: '#a78bfa', fontWeight: 600 }}>psuscc@psusci.club</Box>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Globe size={18} color="#a78bfa" />
                <Typography sx={{ color: THEME.text }}>
                  Facebook: <Box component="span" sx={{ color: '#a78bfa', fontWeight: 600 }}>@psuscc</Box>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Users size={18} color="#a78bfa" />
                <Typography sx={{ color: THEME.text }}>
                  Instagram: <Box component="span" sx={{ color: '#a78bfa', fontWeight: 600 }}>@psuscc</Box>
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Section 9: Policy Updates */}
        <Paper sx={{
          p: { xs: 3, md: 4 },
          borderRadius: '20px',
          bgcolor: THEME.bgCard,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${THEME.border}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <FileText size={24} color="#6366f1" />
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
              9. การเปลี่ยนแปลงนโยบาย
            </Typography>
          </Box>

          <Typography sx={{ color: THEME.textSecondary, lineHeight: 1.8 }}>
            เราอาจปรับปรุงนโยบายความเป็นส่วนตัวนี้เป็นครั้งคราว หากมีการเปลี่ยนแปลงที่สำคัญ 
            เราจะแจ้งให้ท่านทราบผ่านทางอีเมลหรือประกาศบนเว็บไซต์ 
            การใช้งานเว็บไซต์ต่อหลังจากมีการเปลี่ยนแปลงนโยบาย ถือว่าท่านยอมรับนโยบายฉบับใหม่
          </Typography>

          <Divider sx={{ my: 3, borderColor: THEME.border }} />

          <Typography sx={{ color: THEME.muted, fontSize: '0.85rem', textAlign: 'center' }}>
            © 2569 ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ สงวนลิขสิทธิ์
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
