'use client';

import { Box, Container, Typography, Paper, Divider, List, ListItem, ListItemIcon, ListItemText, Button } from '@mui/material';
import {
  Shield,
  FileText,
  ArrowLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  ShoppingCart,
  CreditCard,
  Truck,
  Users,
  Ban,
  Scale,
  Mail,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import Link from 'next/link';

const THEME = {
  bg: 'var(--background)',
  bgCard: 'var(--glass-strong)',
  glass: 'var(--glass-bg)',
  text: 'var(--foreground)',
  textSecondary: 'var(--text-muted)',
  border: 'var(--glass-border)',
  primary: '#2563eb',
  success: '#10b981',
};

const CONTENT = {
  th: {
    lastUpdated: '15 กุมภาพันธ์ 2569',
    version: '1.0',
    backHome: 'กลับหน้าหลัก',
    title: 'ข้อกำหนดการใช้งาน',
    subtitle: 'Terms of Service',
    updatedLabel: 'อัปเดตล่าสุด',
    versionLabel: 'เวอร์ชัน',
    intro: 'ข้อกำหนดการใช้งานฉบับนี้ ("ข้อกำหนด") กำหนดเงื่อนไขการใช้บริการเว็บไซต์ SCC Shop (https://sccshop.psusci.club) ซึ่งดำเนินการโดยชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ ("เรา") การเข้าใช้งานเว็บไซต์ถือว่าท่านยอมรับข้อกำหนดเหล่านี้',
    sections: [
      {
        icon: 'FileText',
        title: '1. คำอธิบายบริการ',
        items: [
          'SCC Shop เป็นร้านค้าออนไลน์สำหรับจำหน่ายเสื้อชุมนุม เสื้อคณะ และสินค้าที่ระลึกของชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์',
          'บริการนี้เปิดให้นักศึกษา บุคลากร ศิษย์เก่า และบุคคลทั่วไปที่สนใจสินค้าของชุมนุม',
          'เราใช้ Google OAuth เพื่อยืนยันตัวตนของผู้ใช้ โดยจะขอเข้าถึงอีเมลและชื่อของท่านเพื่อสร้างบัญชีผู้ใช้และจัดการคำสั่งซื้อ',
        ],
      },
      {
        icon: 'Users',
        title: '2. บัญชีผู้ใช้',
        items: [
          'ท่านต้องเข้าสู่ระบบผ่าน OAuth Provider (Google, Microsoft, Facebook, Apple หรือ LINE) เพื่อสั่งซื้อสินค้า',
          'ข้อมูลที่ได้จาก OAuth ได้แก่ ชื่อ, อีเมล และรูปโปรไฟล์ จะถูกเก็บอย่างปลอดภัยตามนโยบายความเป็นส่วนตัว',
          'ท่านต้องรับผิดชอบการใช้บัญชีของตน ไม่แชร์การเข้าถึงกับผู้อื่น',
          'เราขอสงวนสิทธิ์ระงับบัญชีที่มีพฤติกรรมไม่เหมาะสมหรือฝ่าฝืนข้อกำหนด',
        ],
      },
      {
        icon: 'ShoppingCart',
        title: '3. การสั่งซื้อสินค้า',
        items: [
          'ราคาสินค้าแสดงเป็นสกุลเงินบาท (THB) และรวมค่าธรรมเนียมต่าง ๆ แล้ว (ยกเว้นค่าจัดส่ง)',
          'เมื่อยืนยันคำสั่งซื้อแล้ว ท่านต้องชำระเงินภายใน 24 ชั่วโมง มิฉะนั้นคำสั่งซื้ออาจถูกยกเลิกอัตโนมัติ',
          'จำนวนสินค้าขึ้นอยู่กับสต็อกที่มี เราขอสงวนสิทธิ์ปรับเปลี่ยนหรือยกเลิกคำสั่งซื้อหากสินค้าหมด',
          'สินค้าบางรายการอาจเป็นสินค้า Pre-order ที่ต้องรอจัดทำ',
        ],
      },
      {
        icon: 'CreditCard',
        title: '4. การชำระเงิน',
        items: [
          'รองรับการชำระเงินผ่าน PromptPay QR Code และการโอนเงินผ่านธนาคาร',
          'หลักฐานการชำระเงิน (สลิป) จะถูกตรวจสอบอัตโนมัติผ่านระบบ SlipOK',
          'หากสลิปไม่ถูกต้องหรือยอดไม่ตรง ทีมงานจะติดต่อท่านผ่านอีเมล',
          'เราไม่เก็บข้อมูลบัตรเครดิตหรือข้อมูลธนาคารของท่าน (ยกเว้นกรณีขอคืนเงิน)',
        ],
      },
      {
        icon: 'Truck',
        title: '5. การจัดส่งสินค้า',
        items: [
          'รองรับการรับสินค้าหน้าร้าน (Pick-up) และการจัดส่งทางไปรษณีย์',
          'ค่าจัดส่งคำนวณตามวิธีจัดส่งที่เลือกและจะแสดงก่อนยืนยันคำสั่งซื้อ',
          'ระยะเวลาการจัดส่งขึ้นอยู่กับสถานที่และวิธีจัดส่ง',
          'ท่านสามารถติดตามสถานะพัสดุได้ผ่านเลขพัสดุที่ระบบแจ้งให้',
        ],
      },
      {
        icon: 'Ban',
        title: '6. การยกเลิกและคืนเงิน',
        items: [
          'สามารถยกเลิกคำสั่งซื้อได้ก่อนที่สถานะจะเปลี่ยนเป็น "กำลังจัดเตรียม"',
          'การคืนเงินจะพิจารณาเป็นกรณี ๆ ไป เช่น สินค้ามีตำหนิจากการผลิต หรือจัดส่งผิดรายการ',
          'กรณีคืนเงิน ท่านต้องให้ข้อมูลบัญชีธนาคารสำหรับโอนเงินคืน',
          'ระยะเวลาดำเนินการคืนเงินประมาณ 7-14 วันทำการ',
        ],
      },
      {
        icon: 'CheckCircle',
        title: '7. การใช้ข้อมูลจาก Google',
        items: [
          'เราใช้ Google OAuth เพื่อยืนยันตัวตนเท่านั้น ไม่เข้าถึงข้อมูลอื่นใดในบัญชี Google ของท่าน',
          'ข้อมูลที่ได้รับ: ชื่อ, อีเมล, รูปโปรไฟล์ — ใช้สำหรับแสดงผลในเว็บไซต์และจัดการคำสั่งซื้อ',
          'เราจะไม่ขาย แชร์ หรือเปิดเผยข้อมูลจาก Google ของท่านให้กับบุคคลภายนอก',
          'ท่านสามารถเพิกถอนการเข้าถึงได้ตลอดเวลาผ่าน Google Account Settings',
          'รายละเอียดเพิ่มเติมดูได้ที่นโยบายความเป็นส่วนตัวของเรา',
        ],
      },
      {
        icon: 'AlertCircle',
        title: '8. ข้อจำกัดความรับผิดชอบ',
        items: [
          'สีและรายละเอียดสินค้าอาจแตกต่างจากภาพเล็กน้อย เนื่องจากการแสดงผลของหน้าจอ',
          'เราจะไม่รับผิดชอบความเสียหายจากเหตุสุดวิสัย เช่น ภัยธรรมชาติ ความล่าช้าจากบริษัทขนส่ง',
          'เว็บไซต์อาจมีการปิดปรับปรุงบางครั้ง โดยจะแจ้งล่วงหน้าเมื่อเป็นไปได้',
        ],
      },
      {
        icon: 'Scale',
        title: '9. กฎหมายที่ใช้บังคับ',
        items: [
          'ข้อกำหนดนี้อยู่ภายใต้กฎหมายแห่งราชอาณาจักรไทย',
          'ข้อพิพาทที่เกิดขึ้นจะได้รับการแก้ไขโดยศาลที่มีเขตอำนาจในประเทศไทย',
        ],
      },
    ],
    contact: {
      title: '10. ติดต่อเรา',
      desc: 'หากมีคำถามเกี่ยวกับข้อกำหนดการใช้งาน สามารถติดต่อเราได้ที่:',
      orgName: 'ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์',
      orgAddr: 'มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตหาดใหญ่',
      email: 'อีเมล',
      website: 'เว็บไซต์',
    },
    privacyLink: 'อ่านนโยบายความเป็นส่วนตัว',
    copyright: '© 2026 ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ สงวนลิขสิทธิ์',
  },
  en: {
    lastUpdated: 'February 15, 2026',
    version: '1.0',
    backHome: 'Back to Home',
    title: 'Terms of Service',
    subtitle: 'Terms of Service',
    updatedLabel: 'Last Updated',
    versionLabel: 'Version',
    intro: 'These Terms of Service ("Terms") govern your use of the SCC Shop website (https://sccshop.psusci.club), operated by the Science Computer Club, Faculty of Science, Prince of Songkla University ("we", "us"). By accessing or using our website, you agree to these Terms.',
    sections: [
      {
        icon: 'FileText',
        title: '1. Description of Service',
        items: [
          'SCC Shop is an online store selling club shirts, faculty apparel, and souvenir merchandise for the Science Computer Club, Faculty of Science, Prince of Songkla University.',
          'The service is available to students, staff, alumni, and anyone interested in our club merchandise.',
          'We use Google OAuth to verify user identity. We request access to your email and name to create your account and manage orders.',
        ],
      },
      {
        icon: 'Users',
        title: '2. User Accounts',
        items: [
          'You must sign in via an OAuth provider (Google, Microsoft, Facebook, Apple, or LINE) to place orders.',
          'Information obtained from OAuth (name, email, profile picture) is stored securely per our Privacy Policy.',
          'You are responsible for your account usage. Do not share access with others.',
          'We reserve the right to suspend accounts that violate these Terms or exhibit inappropriate behavior.',
        ],
      },
      {
        icon: 'ShoppingCart',
        title: '3. Orders',
        items: [
          'Prices are displayed in Thai Baht (THB) and include all fees except shipping costs.',
          'After placing an order, you must complete payment within 24 hours or the order may be automatically cancelled.',
          'Product availability depends on current stock. We reserve the right to modify or cancel orders if items are out of stock.',
          'Some products may be pre-order items that require production time.',
        ],
      },
      {
        icon: 'CreditCard',
        title: '4. Payment',
        items: [
          'We accept payment via PromptPay QR Code and bank transfer.',
          'Payment proof (transfer slips) are automatically verified via the SlipOK service.',
          'If a slip is invalid or the amount does not match, our team will contact you via email.',
          'We do not store credit card or bank account information (except for refund requests).',
        ],
      },
      {
        icon: 'Truck',
        title: '5. Shipping',
        items: [
          'We support in-person pickup and postal delivery.',
          'Shipping fees are calculated based on the selected delivery method and displayed before order confirmation.',
          'Delivery times vary depending on location and shipping method.',
          'You can track your parcel using the tracking number provided by our system.',
        ],
      },
      {
        icon: 'Ban',
        title: '6. Cancellation & Refunds',
        items: [
          'Orders can be cancelled before the status changes to "Preparing".',
          'Refunds are evaluated on a case-by-case basis, such as manufacturing defects or incorrect items shipped.',
          'For refunds, you must provide bank account details for the transfer.',
          'Refund processing takes approximately 7-14 business days.',
        ],
      },
      {
        icon: 'CheckCircle',
        title: '7. Use of Google Data',
        items: [
          'We use Google OAuth solely for identity verification. We do not access any other data in your Google account.',
          'Data received: name, email, profile picture — used for display on the website and order management.',
          'We will never sell, share, or disclose your Google data to third parties.',
          'You can revoke access at any time through Google Account Settings.',
          'For more details, see our Privacy Policy.',
        ],
      },
      {
        icon: 'AlertCircle',
        title: '8. Limitation of Liability',
        items: [
          'Product colors and details may differ slightly from images due to screen display variations.',
          'We are not liable for damages caused by force majeure events such as natural disasters or shipping carrier delays.',
          'The website may undergo maintenance from time to time. We will provide advance notice when possible.',
        ],
      },
      {
        icon: 'Scale',
        title: '9. Governing Law',
        items: [
          'These Terms are governed by the laws of the Kingdom of Thailand.',
          'Any disputes shall be resolved by the courts of competent jurisdiction in Thailand.',
        ],
      },
    ],
    contact: {
      title: '10. Contact Us',
      desc: 'If you have questions about these Terms of Service, please contact us:',
      orgName: 'Science Computer Club, Faculty of Science',
      orgAddr: 'Prince of Songkla University, Hat Yai Campus',
      email: 'Email',
      website: 'Website',
    },
    privacyLink: 'Read our Privacy Policy',
    copyright: '© 2026 Science Computer Club, Faculty of Science, Prince of Songkla University. All rights reserved.',
  },
};

const ICONS: Record<string, React.ReactNode> = {
  FileText: <FileText size={20} />,
  Users: <Users size={20} />,
  ShoppingCart: <ShoppingCart size={20} />,
  CreditCard: <CreditCard size={20} />,
  Truck: <Truck size={20} />,
  Ban: <Ban size={20} />,
  CheckCircle: <CheckCircle size={20} />,
  AlertCircle: <AlertCircle size={20} />,
  Scale: <Scale size={20} />,
};

export default function TermsPage() {
  const router = useRouter();
  const { lang } = useTranslation();
  const c = CONTENT[lang];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: THEME.bg, py: { xs: 4, md: 8 }, px: { xs: 2, sm: 3 } }}>
      <Container maxWidth="md">
        {/* Back Button */}
        <Button
          startIcon={<ArrowLeft size={18} />}
          onClick={() => router.push('/')}
          sx={{ mb: 4, color: THEME.textSecondary, '&:hover': { color: THEME.text } }}
        >
          {c.backHome}
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
              width: 56, height: 56, borderRadius: '16px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'grid', placeItems: 'center',
              boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
            }}>
              <Scale size={28} color="white" />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: THEME.text, mb: 0.5 }}>
                {c.title}
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', color: THEME.textSecondary }}>
                {c.subtitle}
              </Typography>
            </Box>
          </Box>

          <Box sx={{
            display: 'flex', flexWrap: 'wrap', gap: 2, p: 2, borderRadius: '12px',
            bgcolor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Clock size={16} color="#94a3b8" />
              <Typography sx={{ fontSize: '0.85rem', color: THEME.textSecondary }}>
                {c.updatedLabel}: {c.lastUpdated}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FileText size={16} color="#94a3b8" />
              <Typography sx={{ fontSize: '0.85rem', color: THEME.textSecondary }}>
                {c.versionLabel} {c.version}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Intro */}
        <Paper sx={{
          p: { xs: 3, md: 4 }, borderRadius: '20px',
          bgcolor: THEME.bgCard, backdropFilter: 'blur(20px)', border: `1px solid ${THEME.border}`, mb: 3,
        }}>
          <Box sx={{
            p: 2.5, borderRadius: '14px',
            bgcolor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
          }}>
            <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
              <Shield size={20} color="#10b981" />
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: THEME.text }}>
                SCC Shop — {lang === 'en' ? 'Terms of Service' : 'ข้อกำหนดการใช้งาน'}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.88rem', color: THEME.textSecondary, lineHeight: 1.8 }}>
              {c.intro}
            </Typography>
          </Box>
        </Paper>

        {/* Sections */}
        {c.sections.map((section, idx) => (
          <Paper key={idx} sx={{
            p: { xs: 3, md: 4 }, borderRadius: '20px',
            bgcolor: THEME.bgCard, backdropFilter: 'blur(20px)', border: `1px solid ${THEME.border}`, mb: 3,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: '12px',
                bgcolor: 'rgba(16,185,129,0.1)', display: 'grid', placeItems: 'center',
              }}>
                {ICONS[section.icon] || <FileText size={20} />}
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                {section.title}
              </Typography>
            </Box>
            <List dense disablePadding>
              {section.items.map((item, i) => (
                <ListItem key={i} sx={{ pl: 0, py: 0.5, alignItems: 'flex-start' }}>
                  <ListItemIcon sx={{ minWidth: 32, mt: 0.8 }}>
                    <CheckCircle size={16} color="#10b981" />
                  </ListItemIcon>
                  <ListItemText
                    primary={item}
                    primaryTypographyProps={{ sx: { fontSize: '0.88rem', color: THEME.textSecondary, lineHeight: 1.7 } }}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        ))}

        {/* Contact */}
        <Paper sx={{
          p: { xs: 3, md: 4 }, borderRadius: '20px',
          bgcolor: THEME.bgCard, backdropFilter: 'blur(20px)', border: `1px solid ${THEME.border}`, mb: 3,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: '12px',
              bgcolor: 'rgba(16,185,129,0.1)', display: 'grid', placeItems: 'center',
            }}>
              <Mail size={20} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
              {c.contact.title}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.88rem', color: THEME.textSecondary, mb: 2, lineHeight: 1.7 }}>
            {c.contact.desc}
          </Typography>
          <Box sx={{ p: 2, borderRadius: '12px', bgcolor: THEME.glass, border: `1px solid ${THEME.border}` }}>
            <Typography sx={{ fontSize: '0.85rem', color: THEME.textSecondary, mb: 1 }}>
              <strong>{c.contact.orgName}</strong>
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: THEME.textSecondary, mb: 1 }}>
              {c.contact.orgAddr}
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: THEME.textSecondary, mb: 1 }}>
              {c.contact.email}: doralaikon.th@gmail.com
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: THEME.textSecondary }}>
              {c.contact.website}: https://sccshop.psusci.club
            </Typography>
          </Box>
        </Paper>

        {/* Privacy Policy Link */}
        <Paper sx={{
          p: { xs: 3, md: 4 }, borderRadius: '20px',
          bgcolor: THEME.bgCard, backdropFilter: 'blur(20px)', border: `1px solid ${THEME.border}`, mb: 3,
          textAlign: 'center',
        }}>
          <Link href="/privacy" style={{ textDecoration: 'none' }}>
            <Button
              startIcon={<Shield size={18} />}
              sx={{
                borderRadius: '12px', textTransform: 'none', fontWeight: 600,
                color: THEME.primary, fontSize: '0.95rem',
                '&:hover': { bgcolor: 'rgba(37,99,235,0.08)' },
              }}
            >
              {c.privacyLink}
            </Button>
          </Link>
        </Paper>

        {/* Copyright */}
        <Divider sx={{ my: 3, borderColor: THEME.border }} />
        <Typography sx={{ textAlign: 'center', fontSize: '0.8rem', color: THEME.textSecondary, pb: 4 }}>
          {c.copyright}
        </Typography>
      </Container>
    </Box>
  );
}
