'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  Mail, 
  ShieldAlert, 
  Clock, 
  WifiOff,
  KeyRound,
  UserX,
  ServerCrash,
  LucideIcon
} from 'lucide-react';

// ==================== ERROR TYPES ====================
interface AuthErrorInfo {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  suggestion: string;
  canRetry: boolean;
}

const AUTH_ERRORS: Record<string, AuthErrorInfo> = {
  // OAuth Errors
  OAuthSignin: {
    title: 'ไม่สามารถเริ่มการเข้าสู่ระบบได้',
    description: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ Google',
    icon: ShieldAlert,
    color: '#ef4444',
    suggestion: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตและลองใหม่อีกครั้ง',
    canRetry: true,
  },
  OAuthCallback: {
    title: 'การตอบกลับจาก Google ไม่ถูกต้อง',
    description: 'ไม่สามารถยืนยันตัวตนกับ Google ได้',
    icon: ShieldAlert,
    color: '#f59e0b',
    suggestion: 'กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง หากยังพบปัญหา กรุณาติดต่อแอดมิน',
    canRetry: true,
  },
  OAuthCreateAccount: {
    title: 'ไม่สามารถสร้างบัญชีได้',
    description: 'เกิดข้อผิดพลาดในการสร้างบัญชีผู้ใช้ใหม่',
    icon: UserX,
    color: '#ef4444',
    suggestion: 'กรุณาลองใหม่อีกครั้ง หรือติดต่อแอดมินหากปัญหายังคงอยู่',
    canRetry: true,
  },
  OAuthAccountNotLinked: {
    title: 'บัญชีนี้ถูกใช้งานแล้ว',
    description: 'อีเมลนี้เคยลงทะเบียนด้วยวิธีอื่นแล้ว',
    icon: Mail,
    color: '#f59e0b',
    suggestion: 'กรุณาใช้อีเมลอื่น หรือเข้าสู่ระบบด้วยวิธีที่เคยใช้ก่อนหน้านี้',
    canRetry: false,
  },
  
  // Callback Errors
  Callback: {
    title: 'เกิดข้อผิดพลาดในการประมวลผล',
    description: 'ไม่สามารถดำเนินการเข้าสู่ระบบได้',
    icon: ServerCrash,
    color: '#ef4444',
    suggestion: 'กรุณาลองใหม่อีกครั้ง หากยังพบปัญหา กรุณารอสักครู่แล้วลองใหม่',
    canRetry: true,
  },
  
  // Session Errors
  SessionRequired: {
    title: 'กรุณาเข้าสู่ระบบ',
    description: 'คุณต้องเข้าสู่ระบบก่อนเข้าถึงหน้านี้',
    icon: KeyRound,
    color: '#6366f1',
    suggestion: 'กรุณาเข้าสู่ระบบด้วย Google Account ของคุณ',
    canRetry: true,
  },
  
  // Access Errors
  AccessDenied: {
    title: 'ไม่มีสิทธิ์เข้าถึง',
    description: 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้',
    icon: ShieldAlert,
    color: '#ef4444',
    suggestion: 'หากคุณคิดว่านี่เป็นข้อผิดพลาด กรุณาติดต่อแอดมิน',
    canRetry: false,
  },
  
  // Verification Errors
  Verification: {
    title: 'ลิงก์หมดอายุหรือถูกใช้แล้ว',
    description: 'ลิงก์ยืนยันตัวตนนี้ไม่สามารถใช้งานได้',
    icon: Clock,
    color: '#f59e0b',
    suggestion: 'กรุณาขอลิงก์ใหม่หรือลองเข้าสู่ระบบอีกครั้ง',
    canRetry: true,
  },
  
  // Configuration Errors
  Configuration: {
    title: 'ระบบมีปัญหา',
    description: 'การตั้งค่าระบบยืนยันตัวตนไม่ถูกต้อง',
    icon: ServerCrash,
    color: '#ef4444',
    suggestion: 'กรุณาติดต่อแอดมินเพื่อแจ้งปัญหานี้',
    canRetry: false,
  },
  
  // WebView/UserAgent Errors (Google 403)
  disallowed_useragent: {
    title: 'ไม่รองรับการเข้าสู่ระบบจากแอปนี้',
    description: 'Google ไม่อนุญาตให้เข้าสู่ระบบผ่าน WebView ในแอป (เช่น LINE, Facebook, Instagram)',
    icon: ShieldAlert,
    color: '#f59e0b',
    suggestion: 'กรุณาเปิดลิงก์ในเบราว์เซอร์หลัก เช่น Chrome หรือ Safari โดยกดปุ่ม ⋮ หรือ ... แล้วเลือก "เปิดในเบราว์เซอร์"',
    canRetry: false,
  },
  
  // Network/Connection Errors
  fetch_failed: {
    title: 'การเชื่อมต่อล้มเหลว',
    description: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
    icon: WifiOff,
    color: '#f59e0b',
    suggestion: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตและลองใหม่',
    canRetry: true,
  },
  
  // Default Error
  Default: {
    title: 'เกิดข้อผิดพลาด',
    description: 'เกิดข้อผิดพลาดที่ไม่คาดคิดในการเข้าสู่ระบบ',
    icon: AlertTriangle,
    color: '#ef4444',
    suggestion: 'กรุณาลองใหม่อีกครั้ง หากยังพบปัญหา กรุณาติดต่อแอดมิน',
    canRetry: true,
  },
};

// ==================== ERROR CONTENT COMPONENT ====================
function AuthErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const errorCode = searchParams.get('error') || 'Default';
  const errorInfo = AUTH_ERRORS[errorCode] || AUTH_ERRORS.Default;
  const IconComponent = errorInfo.icon;

  const handleRetry = () => {
    router.push('/');
  };

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background */}
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <Box
          sx={{
            position: 'absolute',
            top: '20%',
            left: '20%',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${errorInfo.color}20 0%, transparent 70%)`,
            filter: 'blur(60px)',
            animation: 'pulse 4s ease-in-out infinite',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: '20%',
            right: '20%',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'pulse 5s ease-in-out infinite reverse',
          }}
        />
      </Box>

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <Box
          sx={{
            p: { xs: 4, sm: 5 },
            borderRadius: '24px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
            textAlign: 'center',
          }}
        >
          {/* Error Icon */}
          <Box
            sx={{
              width: 100,
              height: 100,
              borderRadius: '24px',
              background: `linear-gradient(135deg, ${errorInfo.color}30 0%, ${errorInfo.color}10 100%)`,
              border: `2px solid ${errorInfo.color}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
              animation: 'bounce 2s ease-in-out infinite',
            }}
          >
            <IconComponent size={48} color={errorInfo.color} />
          </Box>

          {/* Error Title */}
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: '#f1f5f9',
              mb: 1.5,
              fontSize: { xs: '1.5rem', sm: '1.75rem' },
            }}
          >
            {errorInfo.title}
          </Typography>

          {/* Error Description */}
          <Typography
            sx={{
              color: '#94a3b8',
              mb: 2,
              fontSize: '1rem',
              lineHeight: 1.6,
            }}
          >
            {errorInfo.description}
          </Typography>

          {/* Error Code Badge */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 0.5,
              borderRadius: '8px',
              bgcolor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              mb: 3,
            }}
          >
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
              Error Code:
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: errorInfo.color, fontFamily: 'monospace', fontWeight: 600 }}>
              {errorCode}
            </Typography>
          </Box>

          {/* Suggestion */}
          <Box
            sx={{
              p: 2,
              borderRadius: '12px',
              bgcolor: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.2)',
              mb: 4,
            }}
          >
            <Typography sx={{ fontSize: '0.9rem', color: '#a5b4fc' }}>
              💡 {errorInfo.suggestion}
            </Typography>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            {errorInfo.canRetry && (
              <Button
                variant="contained"
                onClick={handleRetry}
                startIcon={<RefreshCw size={18} />}
                sx={{
                  px: 3,
                  py: 1.5,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 30px rgba(99,102,241,0.4)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                ลองใหม่อีกครั้ง
              </Button>
            )}
            
            <Button
              variant="outlined"
              onClick={handleGoHome}
              startIcon={<Home size={18} />}
              sx={{
                px: 3,
                py: 1.5,
                borderRadius: '12px',
                borderColor: 'rgba(255,255,255,0.2)',
                color: '#e2e8f0',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.95rem',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.4)',
                  bgcolor: 'rgba(255,255,255,0.05)',
                },
              }}
            >
              กลับหน้าหลัก
            </Button>
          </Box>

          {/* Contact Support */}
          <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography sx={{ fontSize: '0.85rem', color: '#64748b' }}>
              ยังพบปัญหาอยู่?{' '}
              <Box
                component="a"
                href="mailto:psuscc@psusci.club"
                sx={{
                  color: '#6366f1',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                ติดต่อแอดมิน
              </Box>
            </Typography>
          </Box>
        </Box>

        {/* Footer */}
        <Typography
          sx={{
            textAlign: 'center',
            mt: 3,
            fontSize: '0.8rem',
            color: '#475569',
          }}
        >
          SCC Shop - ร้านค้าชุมนุมคอมพิวเตอร์ ม.อ.
        </Typography>
      </Container>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </Box>
  );
}

// ==================== MAIN PAGE COMPONENT ====================
export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#0a0f1a',
          }}
        >
          <Typography sx={{ color: '#64748b' }}>กำลังโหลด...</Typography>
        </Box>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
