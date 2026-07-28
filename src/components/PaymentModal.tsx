'use client';

import { apiFetch } from '@/lib/api-client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { JSX } from 'react';
import {
  X, Upload, Check, Loader2, AlertCircle, CheckCircle2, Download,
  Copy, Smartphone, Sparkles, AlertTriangle, Info, Mail, FileText, Printer, Headphones,
} from 'lucide-react';
import { Drawer, Box, Typography, Button, IconButton, Skeleton, useMediaQuery, LinearProgress, Checkbox, FormControlLabel, TextField } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { PaymentCountdown } from './OrderCountdown';
import StripePromptPay from './StripePromptPay';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from '@/components/ui/toast';
import { cancelOrder } from '@/lib/api-client';
import {
  ISSUER,
  bahtText,
  buildPaymentNoticeNumber,
} from '@/lib/invoice-html';

interface PaymentModalProps {
  orderRef: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface CartItem {
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  customName?: string;
  customNumber?: string;
  isLongSleeve?: boolean;
  pattern?: string;
  coverImage?: string;
}

const usePaymentToast = () => {
  const addToast = (
    type: 'success' | 'error' | 'info' | 'warning',
    title: string,
    message?: string,
  ) =>
    toast.add({
      type,
      title,
      description: message,
      timeout: type === 'error' ? 5000 : 3500,
      priority: type === 'error' ? 'high' : 'low',
    });

  return { addToast };
};

const PAID_STATUSES = ['PAID', 'COMPLETED', 'SHIPPED', 'READY', 'VERIFYING'];

const NAVY = '#1e3a5f';
const NAVY_SOFT = 'rgba(30, 58, 95, 0.08)';
const EMERALD = '#059669';
const EMERALD_SOFT = 'rgba(5, 150, 105, 0.12)';
const AMBER = '#d97706';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

/** Common Thai bank app URL schemes (open app only — not a payment API). */
const MOBILE_BANK_APPS = [
  { id: 'scb', scheme: 'scbeasy://', labelKey: 'openScbEasy' as const },
  { id: 'kbank', scheme: 'kplus://', labelKey: 'openKPlus' as const },
  { id: 'ktb', scheme: 'ktbnext://', labelKey: 'openKtbNext' as const },
  { id: 'bbl', scheme: 'bualuangmbanking://', labelKey: 'openBualuang' as const },
] as const;

const OPEN_SUPPORT_CHAT_EVENT = 'psuscc:open-support-chat';

function itemSpec(item: CartItem, t: { sizeLabel: string; numberLabel: string; longSleeve: string }): string {
  const parts: string[] = [];
  if (item.size && item.size !== '-') parts.push(`${t.sizeLabel} ${item.size}`);
  if (item.customName) parts.push(item.customName);
  if (item.customNumber) parts.push(`${t.numberLabel} ${item.customNumber}`);
  if (item.isLongSleeve) parts.push(t.longSleeve);
  if (item.pattern) parts.push(item.pattern);
  return parts.join(' · ') || '—';
}

export default function PaymentModal({ orderRef, onClose, onSuccess }: PaymentModalProps): JSX.Element {
  const { addToast } = usePaymentToast();
  const { t, lang } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [baseAmount, setBaseAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderStatus, setOrderStatus] = useState<string>('PENDING');
  const [orderDate, setOrderDate] = useState<string | null>(null);
  const [taxId, setTaxId] = useState<string>('');

  const [paymentEnabled, setPaymentEnabled] = useState(true);
  const [paymentDisabledMessage, setPaymentDisabledMessage] = useState<string | null>(null);
  const [accountHolderName, setAccountHolderName] = useState<string>('');
  const [promptPayId, setPromptPayId] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');

  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [payMethod, setPayMethod] = useState<'stripe' | 'manual'>('manual');

  const [wantFullReceipt, setWantFullReceipt] = useState(false);
  const [receiptTaxOrStudentId, setReceiptTaxOrStudentId] = useState('');
  const [receiptOrgName, setReceiptOrgName] = useState('');
  const [receiptAddress, setReceiptAddress] = useState('');

  const isPaid = PAID_STATUSES.includes(orderStatus.toUpperCase());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const printRegionRef = useRef<HTMLDivElement>(null);
  const reservationCancelRef = useRef(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const hasSlip = Boolean(selectedFile);
  const discountValue = Math.abs(discount);

  const handleReservationExpired = useCallback(async () => {
    if (reservationCancelRef.current || isPaid) return;
    reservationCancelRef.current = true;
    addToast('warning', t.payment.expiredPayment, t.payment.autoCancel);
    try {
      await cancelOrder(orderRef);
    } catch (err) {
      console.error('[PaymentModal] reservation cancel failed:', err);
    }
    onClose();
  }, [addToast, isPaid, onClose, orderRef, t.payment.autoCancel, t.payment.expiredPayment]);

  const [swipeDragOffset, setSwipeDragOffset] = useState(0);
  const [isSwipeDragging, setIsSwipeDragging] = useState(false);
  const swipeStartY = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const orgName = lang === 'th' ? ISSUER.nameTh : ISSUER.nameEn;
  const orgShort = lang === 'th' ? ISSUER.shortTh : ISSUER.shortEn;
  const vatNote = lang === 'th' ? ISSUER.vatNoteTh : ISSUER.vatNoteEn;
  const amountWords = useMemo(() => bahtText(amount, lang === 'th' ? 'th' : 'en'), [amount, lang]);
  const noticeNo = useMemo(
    () => buildPaymentNoticeNumber(orderRef, orderDate || new Date()),
    [orderRef, orderDate],
  );

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [orderRef, loading]);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    swipeStartY.current = e.touches[0].clientY;
    setIsSwipeDragging(true);
  }, []);

  const handleSwipeMove = useCallback((e: React.TouchEvent) => {
    if (!isSwipeDragging) return;
    const delta = e.touches[0].clientY - swipeStartY.current;
    if (delta < 0) { setSwipeDragOffset(0); return; }
    setSwipeDragOffset(delta > 80 ? 80 + (delta - 80) * 0.3 : delta);
  }, [isSwipeDragging]);

  const handleSwipeEnd = useCallback(() => {
    if (!isSwipeDragging) return;
    setIsSwipeDragging(false);
    if (swipeDragOffset >= 80) {
      setSwipeDragOffset(window.innerHeight);
      setTimeout(() => { onClose(); setSwipeDragOffset(0); }, 200);
    } else {
      setSwipeDragOffset(0);
    }
  }, [isSwipeDragging, swipeDragOffset, onClose]);

  useEffect(() => {
    fetchPaymentInfo();
  }, [orderRef]);

  const fetchPaymentInfo = async () => {
    setLoading(true);
    try {
      const res: Response = await apiFetch(`/api/payment-info?ref=${encodeURIComponent(orderRef)}`);
      const data: any = await res.json();

      if (data.status === 'success') {
        const info = data.data || data;
        setQrPayload(info.qrPayload || null);
        setQrUrl(info.qrUrl || null);
        setAmount(Number(info.finalAmount ?? info.amount ?? 0));
        setBaseAmount(Number(info.baseAmount ?? info.amount ?? 0));
        setDiscount(Number(info.discount ?? 0));
        setCartItems(info.cart || []);
        setOrderStatus(info.status || 'PENDING');
        setOrderDate(info.orderDate || info.date || info.createdAt || null);
        setPaymentEnabled(info.paymentEnabled !== false);
        setPaymentDisabledMessage(info.paymentDisabledMessage || null);
        setAccountHolderName(info.accountName || '');
        setPromptPayId(info.promptPayId || '');
        setBankName(info.bankName || '');
        setAccountNumber(info.accountNumber || '');
        setTaxId(info.taxId || '');
        const stripeOk = info.stripePromptPayEnabled === true;
        setStripeEnabled(stripeOk);
        if (stripeOk) setPayMethod('stripe');
      } else {
        addToast('error', t.common.error, data.message || t.payment.noPaymentInfo);
      }
    } catch {
      addToast('error', t.payment.connectionError, t.payment.tryAgain);
    } finally {
      setLoading(false);
    }
  };

  const handleStripeSuccess = () => {
    addToast('success', t.payment.paymentSuccessToast, t.payment.paymentDetected);
    setOrderStatus('PAID');
    setTimeout(() => onSuccess(), 800);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast('error', t.payment.invalidFile, t.payment.selectImage);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('error', t.payment.fileTooLarge, t.payment.maxSize5MB);
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleConfirmPayment = async () => {
    if (!selectedFile) {
      addToast('warning', t.payment.pleaseAttachSlip);
      return;
    }

    setVerifying(true);
    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = async () => {
      const base64 = reader.result?.toString().split(',')[1];
      try {
        const res: Response = await apiFetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ref: orderRef,
            base64,
            mime: selectedFile.type,
            name: selectedFile.name,
            ...(wantFullReceipt
              ? {
                  receiptRequest: {
                    wanted: true,
                    taxOrStudentId: receiptTaxOrStudentId.trim(),
                    orgName: receiptOrgName.trim(),
                    address: receiptAddress.trim(),
                  },
                }
              : {}),
          }),
        });
        const data: any = await res.json();

        if (data.status === 'success') {
          const senderName = data.data?.senderName;
          const successMsg = senderName
            ? `${t.payment.thankYouPrefix} ${senderName}`
            : t.payment.slipReceived;
          addToast('success', t.payment.paymentSuccessToast, successMsg);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1800);
        } else {
          const errorCode = data.code;
          let title: string = t.payment.verifyFailed;
          let message: string = data.message || t.payment.checkSlipRetry;

          if (errorCode === 1012) {
            title = t.payment.duplicateSlip;
            message = t.payment.duplicateSlipDesc;
          } else if (errorCode === 1013) {
            title = t.payment.amountMismatch;
          } else if (errorCode === 1014) {
            title = t.payment.wrongAccount;
            message = t.payment.wrongAccountDesc;
          } else if (errorCode === 1007 || errorCode === 1008) {
            title = t.payment.invalidQR;
          } else if (errorCode === 'PAYMENT_DISABLED') {
            title = t.payment.systemClosed;
            message = data.message || t.payment.systemClosedDesc;
            setPaymentEnabled(false);
            setPaymentDisabledMessage(data.message);
          }

          addToast('error', title, message);

          if (errorCode === 1012 || errorCode === 1014) {
            setSelectedFile(null);
            setPreviewUrl(null);
          }
        }
      } catch {
        addToast('error', t.common.error, t.payment.serverError);
      } finally {
        setVerifying(false);
      }
    };
  };

  const handleSaveQr = async () => {
    if (qrPayload) {
      try {
        setDownloading(true);
        setDownloadProgress(30);

        const svgElement = document.getElementById('promptpay-qr-svg');
        if (!svgElement) {
          addToast('error', t.payment.noQRCode);
          setDownloading(false);
          setDownloadProgress(0);
          return;
        }

        setDownloadProgress(50);

        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);

        const canvas = document.createElement('canvas');
        const padding = 40;
        const qrSize = 200;
        const totalSize = qrSize + (padding * 2);
        canvas.width = totalSize;
        canvas.height = totalSize + 60;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          addToast('error', t.payment.cannotCreateImage);
          setDownloading(false);
          setDownloadProgress(0);
          return;
        }

        ctx.fillStyle = NAVY;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        const rx = 16;
        const qrX = padding;
        const qrY = padding;
        ctx.beginPath();
        ctx.moveTo(qrX + rx, qrY);
        ctx.lineTo(qrX + qrSize - rx, qrY);
        ctx.quadraticCurveTo(qrX + qrSize, qrY, qrX + qrSize, qrY + rx);
        ctx.lineTo(qrX + qrSize, qrY + qrSize - rx);
        ctx.quadraticCurveTo(qrX + qrSize, qrY + qrSize, qrX + qrSize - rx, qrY + qrSize);
        ctx.lineTo(qrX + rx, qrY + qrSize);
        ctx.quadraticCurveTo(qrX, qrY + qrSize, qrX, qrY + qrSize - rx);
        ctx.lineTo(qrX, qrY + rx);
        ctx.quadraticCurveTo(qrX, qrY, qrX + rx, qrY);
        ctx.closePath();
        ctx.fill();

        setDownloadProgress(70);

        const img = document.createElement('img') as HTMLImageElement;
        img.onload = () => {
          ctx.drawImage(img, padding + 10, padding + 10, qrSize - 20, qrSize - 20);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`฿${amount.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', { minimumFractionDigits: 2 })}`, totalSize / 2, totalSize + 35);

          ctx.font = '12px Arial, sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillText('PromptPay', totalSize / 2, totalSize + 52);

          setDownloadProgress(90);

          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `promptpay-qr-${orderRef}.png`;
              link.click();
              URL.revokeObjectURL(url);
              setDownloadProgress(100);
              addToast('success', t.payment.savedQR);
            } else {
              addToast('error', t.payment.saveFailed);
            }
            setDownloading(false);
            setTimeout(() => setDownloadProgress(0), 500);
          }, 'image/png', 0.95);

          URL.revokeObjectURL(svgUrl);
        };

        img.onerror = () => {
          addToast('error', t.payment.loadQRFailed);
          setDownloading(false);
          setDownloadProgress(0);
          URL.revokeObjectURL(svgUrl);
        };

        img.src = svgUrl;
      } catch {
        addToast('error', t.payment.saveFailed, t.payment.tryAgain);
        setDownloading(false);
        setDownloadProgress(0);
      }
      return;
    }

    if (!qrUrl) {
      addToast('warning', t.payment.noQR);
      return;
    }
    try {
      setDownloading(true);
      setDownloadProgress(0);
      const xhr = new XMLHttpRequest();
      xhr.open('GET', qrUrl, true);
      xhr.responseType = 'blob';
      xhr.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          setDownloadProgress(Math.round((event.loaded / event.total) * 100));
        } else {
          setDownloadProgress((prev) => Math.min(99, prev + 5));
        }
      };
      xhr.onload = () => {
        if (xhr.status === 200) {
          const blobUrl = URL.createObjectURL(xhr.response);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `qr-${orderRef}.png`;
          link.click();
          URL.revokeObjectURL(blobUrl);
          setDownloadProgress(100);
          addToast('success', t.payment.savedQRToast);
        } else {
          addToast('error', t.payment.saveFailed, t.payment.tryAgain);
        }
        setDownloading(false);
        setTimeout(() => setDownloadProgress(0), 500);
      };
      xhr.onerror = () => {
        addToast('error', t.payment.saveFailed, t.payment.tryAgain);
        setDownloading(false);
        setDownloadProgress(0);
      };
      xhr.send();
    } catch {
      addToast('error', t.payment.saveFailed, t.payment.tryAgain);
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  const formatMoney = (value: number) =>
    `฿${value.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const copyText = async (value: string, successTitle: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      addToast('success', successTitle);
    } catch {
      addToast('error', t.common.error, t.payment.tryAgain);
    }
  };

  const copyAmount = () => copyText(amount.toFixed(2), t.payment.copiedAmount);
  const copyPromptPay = () => copyText(promptPayId, t.payment.copiedPromptPay);
  const copyAccount = () => copyText(accountNumber, t.payment.copiedAccount);

  const handlePrintNotice = useCallback(() => {
    window.print();
  }, []);

  const openSupportForPayment = useCallback(() => {
    const prefill = String(t.payment.supportPrefillMessage || '')
      .replace(/\{ref\}/g, orderRef)
      .replace(/\{noticeNo\}/g, noticeNo);
    window.dispatchEvent(
      new CustomEvent(OPEN_SUPPORT_CHAT_EVENT, {
        detail: { prefill, orderRef },
      }),
    );
  }, [t.payment.supportPrefillMessage, orderRef, noticeNo]);

  const openBankApp = useCallback((scheme: string) => {
    const isLikelyMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (!isLikelyMobile) {
      addToast('info', t.payment.payOnMobile, t.payment.bankAppDesktopHint);
      return;
    }
    try {
      // Custom schemes: try without leaving the page when possible
      const anchor = document.createElement('a');
      anchor.href = scheme;
      anchor.rel = 'noopener';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      addToast('warning', t.payment.bankAppOpenFailed);
    }
  }, [addToast, t.payment.payOnMobile, t.payment.bankAppDesktopHint, t.payment.bankAppOpenFailed]);

  const sectionSx = {
    borderRadius: '12px',
    bgcolor: 'var(--surface-2)',
    border: '1px solid var(--glass-border)',
    overflow: 'hidden',
  } as const;

  const sectionHeaderSx = {
    px: 2.25,
    py: 1.5,
    borderBottom: '1px solid var(--glass-border)',
    bgcolor: NAVY_SOFT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 1,
  } as const;

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={true}
      onClose={onClose}
      PaperProps={{
        sx: {
          height: isMobile ? { xs: '88vh', sm: '88vh' } : '100vh',
          maxHeight: isMobile ? '92vh' : '100vh',
          width: isMobile ? '100%' : '560px',
          borderTopLeftRadius: isMobile ? { xs: 16, sm: 20 } : { xs: 0, sm: 16 },
          borderTopRightRadius: isMobile ? { xs: 16, sm: 20 } : 0,
          borderBottomLeftRadius: isMobile ? 0 : { xs: 0, sm: 16 },
          bgcolor: 'var(--background)',
          overflow: 'hidden',
          transform: isMobile && swipeDragOffset > 0 ? `translateY(${swipeDragOffset}px) !important` : undefined,
          transition: isSwipeDragging ? 'none !important' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1) !important',
        },
      }}
    >
      {/* Official document header */}
      <Box sx={{
        px: { xs: 2, sm: 2.5 },
        pt: 1,
        pb: 1.75,
        borderBottom: `2px solid ${NAVY}`,
        background: 'var(--glass-strong)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        {isMobile && (
          <Box
            onTouchStart={handleSwipeStart}
            onTouchMove={handleSwipeMove}
            onTouchEnd={handleSwipeEnd}
            sx={{ width: '100%', display: 'flex', justifyContent: 'center', py: 0.5, cursor: 'grab', touchAction: 'none' }}
          >
            <Box sx={{
              width: isSwipeDragging ? 48 : 36,
              height: 4,
              bgcolor: isSwipeDragging ? 'var(--text-muted)' : 'var(--glass-bg)',
              borderRadius: 3,
              transition: 'all 0.2s ease',
            }} />
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{
              fontSize: '0.68rem',
              fontWeight: 600,
              color: NAVY,
              letterSpacing: 0.2,
              lineHeight: 1.45,
              mb: 0.75,
            }}>
              {orgName}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Box sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.6,
                px: 1,
                py: 0.35,
                borderRadius: '6px',
                bgcolor: NAVY,
                color: '#fff',
              }}>
                <FileText size={12} />
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: 0.8 }}>
                  {t.payment.titleShort}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--foreground)' }}>
                {t.payment.title}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 2 }, mt: 1 }}>
              <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {t.payment.noticeNo}:{' '}
                <Box component="span" sx={{ fontFamily: MONO, fontWeight: 700, color: 'var(--foreground)', letterSpacing: 0.4 }}>
                  {noticeNo}
                </Box>
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {t.payment.orderRefId}:{' '}
                <Box component="span" sx={{ fontFamily: MONO, fontWeight: 700, color: 'var(--foreground)', letterSpacing: 0.4 }}>
                  {orderRef}
                </Box>
              </Typography>
            </Box>
          </Box>

          <Box className="payment-notice-no-print" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {!loading && (
              <Button
                size="small"
                startIcon={<Printer size={14} />}
                onClick={handlePrintNotice}
                aria-label={t.payment.downloadPdf}
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  color: NAVY,
                  border: '1px solid rgba(30,58,95,0.28)',
                  bgcolor: NAVY_SOFT,
                  borderRadius: '8px',
                  px: 1.1,
                  minHeight: 34,
                  '&:hover': { bgcolor: 'rgba(30,58,95,0.14)' },
                }}
              >
                {t.payment.downloadPdf}
              </Button>
            )}
            {!loading && (
              <IconButton
                onClick={handlePrintNotice}
                size="small"
                aria-label={t.payment.printNotice}
                sx={{
                  display: { xs: 'inline-flex', sm: 'none' },
                  bgcolor: NAVY_SOFT,
                  color: NAVY,
                  border: '1px solid rgba(30,58,95,0.28)',
                  '&:hover': { bgcolor: 'rgba(30,58,95,0.14)' },
                }}
              >
                <Printer size={16} />
              </IconButton>
            )}
            <IconButton
              onClick={onClose}
              size="small"
              aria-label={t.common.cancel}
              sx={{
                bgcolor: 'var(--glass-bg)',
                color: 'var(--text-muted)',
                border: '1px solid var(--glass-border)',
                '&:hover': { bgcolor: 'var(--glass-bg)', color: 'var(--foreground)' },
              }}
            >
              <X size={18} />
            </IconButton>
          </Box>
        </Box>
      </Box>

      <Box
        ref={scrollContainerRef}
        sx={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', px: { xs: 2, sm: 2.5 }, py: 2 }}
      >
        <Box
          ref={printRegionRef}
          className="payment-notice-print"
          sx={{ position: 'relative', maxWidth: 520, mx: 'auto' }}
        >
          {/* Print-only letterhead (screen header is outside print scope) */}
          <Box
            className="payment-notice-letterhead"
            sx={{
              display: 'none',
              '@media print': { display: 'block' },
              mb: 2,
              pb: 1.5,
              borderBottom: `2.5px solid ${NAVY}`,
              pr: 14,
            }}
          >
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY, lineHeight: 1.35 }}>
              {orgName}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: '#64748b', mt: 0.35 }}>
              {lang === 'th' ? ISSUER.nameEn : ISSUER.nameTh}
            </Typography>
            <Typography sx={{ fontSize: '0.68rem', color: '#64748b', mt: 0.5, lineHeight: 1.45 }}>
              {lang === 'th' ? ISSUER.addressTh : ISSUER.addressEn}
              <br />
              {lang === 'th' ? 'โทร' : 'Tel'}: {ISSUER.phone} · {ISSUER.email}
            </Typography>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: NAVY, mt: 1.25, letterSpacing: 0.4 }}>
              {t.payment.title}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#475569', mt: 0.5, fontFamily: MONO }}>
              {t.payment.noticeNo}: {noticeNo} · {orderRef}
            </Typography>
          </Box>

          {/* Digital status stamp */}
          {!loading && (
            <Box
              className="payment-notice-stamp"
              aria-hidden
              sx={{
                position: 'absolute',
                top: { xs: 4, sm: 8 },
                right: { xs: 4, sm: 8 },
                zIndex: 2,
                pointerEvents: 'none',
                transform: 'rotate(12deg)',
                px: 1.25,
                py: 0.55,
                borderRadius: '4px',
                border: `2.5px solid ${isPaid ? EMERALD : AMBER}`,
                color: isPaid ? EMERALD : AMBER,
                bgcolor: isPaid ? 'rgba(5,150,105,0.06)' : 'rgba(217,119,6,0.07)',
                opacity: 0.88,
                minWidth: 88,
                textAlign: 'center',
              }}
            >
              <Typography sx={{
                fontSize: '0.62rem',
                fontWeight: 900,
                letterSpacing: 1.2,
                lineHeight: 1.2,
                textTransform: 'uppercase',
              }}>
                {isPaid ? 'PAID' : 'PENDING'}
              </Typography>
              <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, lineHeight: 1.25, mt: 0.15 }}>
                {isPaid ? t.payment.stampPaid : t.payment.stampPending}
              </Typography>
            </Box>
          )}

        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Skeleton variant="rectangular" height={72} sx={{ bgcolor: 'var(--skeleton-bg)', borderRadius: '12px' }} />
            <Skeleton variant="rectangular" height={180} sx={{ bgcolor: 'var(--skeleton-bg)', borderRadius: '12px' }} />
            <Skeleton variant="rectangular" height={220} sx={{ bgcolor: 'var(--skeleton-bg)', borderRadius: '12px' }} />
          </Box>
        ) : isPaid ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{
              p: 3.5,
              borderRadius: '12px',
              bgcolor: 'var(--surface-2)',
              border: '1px solid var(--glass-border)',
              borderTop: `4px solid ${EMERALD}`,
              textAlign: 'center',
            }}>
              <Box sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                bgcolor: EMERALD_SOFT,
                border: `2px solid rgba(5,150,105,0.35)`,
                display: 'grid',
                placeItems: 'center',
                mx: 'auto',
                mb: 1.75,
              }}>
                <Check size={28} strokeWidth={3} style={{ color: EMERALD }} />
              </Box>
              <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, mb: 0.5, color: 'var(--foreground)' }}>
                {t.payment.paymentSuccess}
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)', mb: 2 }}>
                {t.payment.paymentSuccessDesc}
              </Typography>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                px: 1.75,
                py: 1.1,
                borderRadius: '10px',
                bgcolor: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
              }}>
                <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {t.payment.orderRef}
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: MONO, color: 'var(--foreground)' }}>
                  {orderRef}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ ...sectionSx, p: 2 }}>
              <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', mb: 0.75 }}>
                {t.payment.orderStatus}
              </Typography>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: EMERALD }}>
                {orderStatus === 'PAID' && t.payment.paidWaiting}
                {orderStatus === 'READY' && t.payment.readyForPickup}
                {orderStatus === 'SHIPPED' && t.payment.shipped}
                {orderStatus === 'COMPLETED' && t.payment.completed}
                {orderStatus === 'VERIFYING' && t.payment.verifyingSlipStatus}
                {!['PAID', 'READY', 'SHIPPED', 'COMPLETED', 'VERIFYING'].includes(orderStatus) && t.payment.processed}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', mt: 0.5 }}>
                {t.payment.waitingAdmin}
              </Typography>
            </Box>

            <Box sx={{ ...sectionSx, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t.payment.amountPaid}
              </Typography>
              <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, color: EMERALD }}>
                {formatMoney(amount)}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {!paymentEnabled && (
              <Box sx={{
                p: 2,
                borderRadius: '12px',
                bgcolor: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.28)',
                display: 'flex',
                gap: 1.5,
              }}>
                <AlertCircle size={22} style={{ color: '#dc2626', flexShrink: 0, marginTop: 2 }} />
                <Box>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--error)', mb: 0.35 }}>
                    {t.payment.paymentDisabled}
                  </Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: 'var(--error)', lineHeight: 1.55 }}>
                    {paymentDisabledMessage || t.payment.waitAdminOpenPayment}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Status + countdown */}
            {paymentEnabled && (
              <Box sx={{
                ...sectionSx,
                p: 1.75,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.6,
                    px: 1,
                    py: 0.4,
                    borderRadius: '6px',
                    bgcolor: 'rgba(217,119,6,0.12)',
                    border: '1px solid rgba(217,119,6,0.28)',
                  }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: AMBER }} />
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: AMBER }}>
                      {t.payment.awaitingPayment}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: MONO }}>
                    {orgShort}
                  </Typography>
                </Box>
                {orderDate && (
                  <PaymentCountdown
                    orderDate={orderDate}
                    onExpired={handleReservationExpired}
                  />
                )}
              </Box>
            )}

            {/* Structured order amount table */}
            <Box sx={sectionSx}>
              <Box sx={sectionHeaderSx}>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: NAVY }}>
                  {t.payment.orderSummary}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', fontFamily: MONO, color: 'var(--text-muted)' }}>
                  {orderRef}
                </Typography>
              </Box>

              <Box sx={{ overflowX: 'auto' }}>
                <Box
                  component="table"
                  sx={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.75rem',
                    minWidth: 360,
                    '& th': {
                      textAlign: 'left',
                      px: 1.25,
                      py: 1,
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                      borderBottom: '1px solid var(--glass-border)',
                      bgcolor: 'var(--surface)',
                      whiteSpace: 'nowrap',
                    },
                    '& td': {
                      px: 1.25,
                      py: 1.05,
                      borderBottom: '1px solid var(--glass-border)',
                      color: 'var(--foreground)',
                      verticalAlign: 'top',
                    },
                    '& tbody tr:last-of-type td': { borderBottom: 'none' },
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}>{t.payment.colNo}</th>
                      <th>{t.payment.colItem}</th>
                      <th>{t.payment.colSpec}</th>
                      <th style={{ textAlign: 'right', width: 44 }}>{t.payment.colQty}</th>
                      <th style={{ textAlign: 'right', width: 88 }}>{t.payment.colAmount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.length > 0 ? cartItems.map((item, index) => (
                      <tr key={index}>
                        <td style={{ fontFamily: MONO, color: 'var(--text-muted)' }}>{index + 1}</td>
                        <td>
                          <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.35 }}>
                            {item.productName}
                          </Typography>
                        </td>
                        <td>
                          <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                            {itemSpec(item, {
                              sizeLabel: t.payment.sizeLabel,
                              numberLabel: t.payment.numberLabel,
                              longSleeve: t.common.longSleeve,
                            })}
                          </Typography>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: MONO }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right', fontFamily: MONO, fontWeight: 600 }}>
                          {formatMoney(item.unitPrice * item.quantity)}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          —
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Box>
              </Box>

              <Box sx={{ px: 1.75, py: 1.75, borderTop: '1px solid var(--glass-border)', bgcolor: 'var(--surface)' }}>
                {discountValue > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {t.payment.discount}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', fontFamily: MONO, color: 'var(--text-muted)' }}>
                      −{formatMoney(discountValue)}
                    </Typography>
                  </Box>
                )}
                {discountValue > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {lang === 'th' ? 'ยอดก่อนลด' : 'Subtotal'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', fontFamily: MONO, color: 'var(--text-muted)' }}>
                      {formatMoney(baseAmount)}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY }}>
                    {t.payment.netAmount}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography sx={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
                      {formatMoney(amount)}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={copyAmount}
                      aria-label={t.payment.copy}
                      sx={{
                        bgcolor: 'var(--glass-bg)',
                        border: '1px solid var(--glass-border)',
                        color: 'var(--foreground)',
                        width: 32,
                        height: 32,
                      }}
                    >
                      <Copy size={14} />
                    </IconButton>
                  </Box>
                </Box>
                <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)', mt: 0.75, fontStyle: 'italic' }}>
                  {t.payment.amountInWords}: {amountWords}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', mt: 0.85 }}>
                  {vatNote}
                </Typography>
              </Box>
            </Box>

            {/* Stripe / manual switcher */}
            {stripeEnabled && paymentEnabled && (
              <Box sx={{
                display: 'flex',
                gap: 0.6,
                p: 0.6,
                borderRadius: '12px',
                bgcolor: 'var(--surface-2)',
                border: '1px solid var(--glass-border)',
              }}>
                {([
                  { key: 'stripe' as const, label: t.payment.autoPromptPay, icon: <Sparkles size={14} /> },
                  { key: 'manual' as const, label: t.payment.manualTransfer, icon: <Upload size={14} /> },
                ]).map((m) => {
                  const active = payMethod === m.key;
                  return (
                    <Box
                      key={m.key}
                      onClick={() => setPayMethod(m.key)}
                      sx={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.6,
                        py: 1.1,
                        px: 1,
                        borderRadius: '9px',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        transition: 'all 0.2s ease',
                        color: active ? '#fff' : 'var(--text-muted)',
                        background: active
                          ? (m.key === 'stripe' ? NAVY : EMERALD)
                          : 'transparent',
                        '&:hover': { bgcolor: active ? undefined : 'var(--glass-bg)' },
                      }}
                    >
                      {m.icon}
                      <Typography sx={{ fontSize: 'inherit', fontWeight: 'inherit' }}>{m.label}</Typography>
                    </Box>
                  );
                })}
              </Box>
            )}

            {stripeEnabled && paymentEnabled && payMethod === 'stripe' && (
              <Box sx={sectionSx}>
                <Box sx={sectionHeaderSx}>
                  <Box>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY }}>
                      {t.payment.autoPromptPay}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {t.payment.autoPromptPayDesc}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ p: 2.5 }}>
                  <StripePromptPay
                    orderRef={orderRef}
                    orderDate={orderDate ?? undefined}
                    onExpired={handleReservationExpired}
                    onSuccess={handleStripeSuccess}
                  />
                </Box>
              </Box>
            )}

            {payMethod === 'manual' && (
              <>
                {/* Payment channels: QR + official account */}
                <Box sx={sectionSx}>
                  <Box sx={sectionHeaderSx}>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY }}>
                      {t.payment.paymentChannels}
                    </Typography>
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {t.payment.step1}
                    </Typography>
                  </Box>

                  <Box sx={{
                    p: 2,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 2,
                    alignItems: 'start',
                  }}>
                    {/* QR column */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25 }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', alignSelf: 'stretch' }}>
                        {t.payment.scanToTransfer}
                      </Typography>

                      {!paymentEnabled ? (
                        <Box sx={{
                          width: '100%',
                          maxWidth: 200,
                          aspectRatio: '1',
                          bgcolor: 'rgba(239,68,68,0.08)',
                          borderRadius: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 1,
                          border: '2px dashed rgba(239,68,68,0.3)',
                        }}>
                          <AlertCircle size={32} style={{ color: '#dc2626' }} />
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#dc2626', textAlign: 'center', px: 1.5 }}>
                            {t.payment.paymentDisabledOverlay}
                          </Typography>
                        </Box>
                      ) : qrPayload ? (
                        <Box sx={{
                          bgcolor: NAVY,
                          borderRadius: '12px',
                          p: 1.5,
                          width: '100%',
                          maxWidth: 220,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                            <Box
                              component="img"
                              src="/trust/promptpay.svg"
                              alt="PromptPay"
                              sx={{ height: 14, width: 'auto', filter: 'brightness(0) invert(1)' }}
                            />
                            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.75rem', letterSpacing: 0.6 }}>
                              {t.payment.promptPay}
                            </Typography>
                          </Box>
                          <Box sx={{ bgcolor: '#fff', p: 1.25, borderRadius: 1.5, lineHeight: 0 }}>
                            <QRCodeSVG
                              id="promptpay-qr-svg"
                              value={qrPayload}
                              size={168}
                              level="M"
                              includeMargin={false}
                              bgColor="#ffffff"
                              fgColor={NAVY}
                              imageSettings={{
                                src: '/trust/promptpay.svg',
                                height: 24,
                                width: 24,
                                excavate: true,
                              }}
                            />
                          </Box>
                          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem', mt: 1.1 }}>
                            {formatMoney(amount)}
                          </Typography>
                          <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.65rem', mt: 0.35, textAlign: 'center', px: 0.5 }}>
                            {t.payment.scanInstruction}
                          </Typography>
                        </Box>
                      ) : qrUrl ? (
                        <Box sx={{ bgcolor: 'white', borderRadius: '12px', p: 1.5, border: '1px solid var(--glass-border)' }}>
                          <Box
                            component="img"
                            src={qrUrl}
                            alt="PromptPay QR"
                            sx={{ width: 180, height: 180, objectFit: 'contain', display: 'block' }}
                          />
                        </Box>
                      ) : (
                        <Box sx={{
                          width: '100%',
                          p: 2,
                          borderRadius: '12px',
                          bgcolor: 'rgba(217,119,6,0.08)',
                          border: '1px dashed rgba(217,119,6,0.35)',
                          textAlign: 'center',
                        }}>
                          <AlertTriangle size={22} style={{ color: AMBER, marginBottom: 6 }} />
                          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)', mb: 0.35 }}>
                            {t.payment.qrUnavailable}
                          </Typography>
                          <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                            {t.payment.qrUnavailableDesc}
                          </Typography>
                        </Box>
                      )}

                      <Button
                        fullWidth
                        startIcon={downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        onClick={handleSaveQr}
                        disabled={(!qrPayload && !qrUrl) || downloading || !paymentEnabled}
                        sx={{
                          maxWidth: 220,
                          py: 1,
                          borderRadius: '10px',
                          bgcolor: NAVY_SOFT,
                          border: `1px solid rgba(30,58,95,0.25)`,
                          color: NAVY,
                          fontWeight: 600,
                          textTransform: 'none',
                          fontSize: '0.8rem',
                          '&:hover': { bgcolor: 'rgba(30,58,95,0.14)' },
                          '&:disabled': { opacity: 0.5 },
                        }}
                      >
                        {downloading ? `${t.payment.savingQR} ${downloadProgress}%` : t.payment.saveQR}
                      </Button>
                      {downloading && (
                        <LinearProgress
                          variant="determinate"
                          value={downloadProgress}
                          sx={{
                            width: '100%',
                            maxWidth: 220,
                            borderRadius: 1,
                            bgcolor: 'var(--glass-bg)',
                            '& .MuiLinearProgress-bar': { bgcolor: NAVY },
                          }}
                        />
                      )}

                      {/* Mobile banking deep links */}
                      <Box className="payment-notice-no-print" sx={{ width: '100%', maxWidth: 220, mt: 0.5 }}>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', mb: 0.75 }}>
                          {t.payment.payOnMobile}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                          {MOBILE_BANK_APPS.map((bank) => (
                            <Button
                              key={bank.id}
                              size="small"
                              startIcon={<Smartphone size={13} />}
                              onClick={() => openBankApp(bank.scheme)}
                              disabled={!paymentEnabled}
                              sx={{
                                justifyContent: 'flex-start',
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.72rem',
                                color: NAVY,
                                border: '1px solid rgba(30,58,95,0.2)',
                                bgcolor: 'var(--surface)',
                                borderRadius: '8px',
                                py: 0.55,
                                '&:hover': { bgcolor: NAVY_SOFT },
                              }}
                            >
                              {t.payment[bank.labelKey]}
                            </Button>
                          ))}
                        </Box>
                        <Typography sx={{ fontSize: '0.62rem', color: 'var(--text-muted)', mt: 0.65, lineHeight: 1.4 }}>
                          {t.payment.bankAppDesktopHint}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Official account column */}
                    <Box>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', mb: 1.1 }}>
                        {t.payment.officialAccount}
                      </Typography>
                      <Box sx={{
                        p: 1.75,
                        borderRadius: '10px',
                        bgcolor: 'var(--surface)',
                        border: '1px solid var(--glass-border)',
                      }}>
                        <Box sx={{ mb: 1.35 }}>
                          <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            {t.payment.accountName}
                          </Typography>
                          <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--foreground)', mt: 0.2 }}>
                            {accountHolderName || t.payment.accountHolderName || '—'}
                          </Typography>
                        </Box>

                        {bankName && (
                          <Box sx={{ mb: 1.35 }}>
                            <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {t.payment.bankName}
                            </Typography>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', mt: 0.2 }}>
                              {bankName}
                            </Typography>
                          </Box>
                        )}

                        {promptPayId && (
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1,
                            mb: 1.1,
                            p: 1.1,
                            borderRadius: '8px',
                            bgcolor: EMERALD_SOFT,
                            border: '1px solid rgba(5,150,105,0.22)',
                          }}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                {t.payment.promptPayNumber}
                              </Typography>
                              <Typography sx={{
                                fontSize: '1rem',
                                fontWeight: 800,
                                fontFamily: MONO,
                                letterSpacing: 0.8,
                                color: 'var(--foreground)',
                                wordBreak: 'break-all',
                              }}>
                                {promptPayId}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              startIcon={<Copy size={13} />}
                              onClick={copyPromptPay}
                              sx={{
                                flexShrink: 0,
                                textTransform: 'none',
                                fontWeight: 700,
                                borderRadius: '8px',
                                bgcolor: 'rgba(5,150,105,0.16)',
                                color: EMERALD,
                                minHeight: 36,
                                px: 1.25,
                                '&:hover': { bgcolor: 'rgba(5,150,105,0.26)' },
                              }}
                            >
                              {t.payment.copy}
                            </Button>
                          </Box>
                        )}

                        {accountNumber && (
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1,
                            mb: taxId ? 1.1 : 0,
                            p: 1.1,
                            borderRadius: '8px',
                            bgcolor: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                          }}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                {t.payment.bankAccount}
                              </Typography>
                              <Typography sx={{
                                fontSize: '0.92rem',
                                fontWeight: 700,
                                fontFamily: MONO,
                                color: 'var(--foreground)',
                                wordBreak: 'break-all',
                              }}>
                                {accountNumber}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              startIcon={<Copy size={13} />}
                              onClick={copyAccount}
                              sx={{
                                flexShrink: 0,
                                textTransform: 'none',
                                fontWeight: 700,
                                borderRadius: '8px',
                                bgcolor: 'var(--glass-bg)',
                                color: 'var(--foreground)',
                                border: '1px solid var(--glass-border)',
                                minHeight: 36,
                                px: 1.25,
                              }}
                            >
                              {t.payment.copy}
                            </Button>
                          </Box>
                        )}

                        {taxId && (
                          <Box sx={{ mt: accountNumber || promptPayId ? 0 : 0 }}>
                            <Typography sx={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                              {t.payment.taxId}
                            </Typography>
                            <Typography sx={{
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              fontFamily: MONO,
                              color: 'var(--foreground)',
                              mt: 0.2,
                            }}>
                              {taxId}
                            </Typography>
                          </Box>
                        )}

                        <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', mt: 1.35, fontStyle: 'italic' }}>
                          {amountWords}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>

                {/* Full E-Receipt / tax invoice options */}
                <Box className="payment-notice-no-print" sx={sectionSx}>
                  <Box sx={sectionHeaderSx}>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY }}>
                      {lang === 'th' ? 'ใบเสร็จ / ใบกำกับภาษี' : 'Receipt / Tax invoice'}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={wantFullReceipt}
                          onChange={(e) => setWantFullReceipt(e.target.checked)}
                          size="small"
                          sx={{
                            color: NAVY,
                            '&.Mui-checked': { color: EMERALD },
                          }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.4 }}>
                          {t.payment.wantFullReceipt}
                        </Typography>
                      }
                      sx={{ alignItems: 'flex-start', m: 0 }}
                    />
                    {wantFullReceipt && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mt: 1.5 }}>
                        <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                          {t.payment.receiptFieldsHint}
                        </Typography>
                        <TextField
                          size="small"
                          fullWidth
                          label={t.payment.receiptTaxOrStudentId}
                          value={receiptTaxOrStudentId}
                          onChange={(e) => setReceiptTaxOrStudentId(e.target.value)}
                          inputProps={{ maxLength: 64 }}
                        />
                        <TextField
                          size="small"
                          fullWidth
                          label={t.payment.receiptOrgName}
                          value={receiptOrgName}
                          onChange={(e) => setReceiptOrgName(e.target.value)}
                          inputProps={{ maxLength: 160 }}
                        />
                        <TextField
                          size="small"
                          fullWidth
                          multiline
                          minRows={2}
                          label={t.payment.receiptAddress}
                          value={receiptAddress}
                          onChange={(e) => setReceiptAddress(e.target.value)}
                          inputProps={{ maxLength: 400 }}
                        />
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Formal slip upload */}
                <Box sx={{
                  ...sectionSx,
                  border: hasSlip ? `2px solid rgba(5,150,105,0.4)` : '1px solid var(--glass-border)',
                }}>
                  <Box sx={sectionHeaderSx}>
                    <Box>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY }}>
                        {hasSlip ? t.payment.slipAttached : t.payment.attachSlipBtn}
                      </Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {hasSlip ? t.payment.readyToConfirm : t.payment.uploadSlipInstruction}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: hasSlip ? EMERALD : 'var(--text-muted)' }}>
                      {t.payment.step2}
                    </Typography>
                  </Box>

                  <Box sx={{ p: 2 }}>
                    {!paymentEnabled ? (
                      <Box sx={{
                        border: '2px dashed rgba(239,68,68,0.3)',
                        borderRadius: '12px',
                        p: 3.5,
                        textAlign: 'center',
                        bgcolor: 'rgba(239,68,68,0.05)',
                      }}>
                        <AlertCircle size={28} style={{ color: '#dc2626', marginBottom: 8 }} />
                        <Typography sx={{ color: '#dc2626', fontWeight: 600, mb: 0.35, fontSize: '0.95rem' }}>
                          {t.payment.paymentDisabledOverlay}
                        </Typography>
                        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          {t.payment.waitAdminOpenPayment}
                        </Typography>
                      </Box>
                    ) : !previewUrl ? (
                      <Box
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragActive(false);
                          const droppedFile = e.dataTransfer.files?.[0];
                          if (droppedFile) processFile(droppedFile);
                        }}
                        sx={{
                          border: '2px dashed',
                          borderColor: dragActive ? NAVY : 'var(--glass-border)',
                          borderRadius: '12px',
                          p: 3.5,
                          textAlign: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          bgcolor: dragActive ? NAVY_SOFT : 'var(--surface)',
                          '&:hover': {
                            borderColor: NAVY,
                            bgcolor: NAVY_SOFT,
                          },
                        }}
                      >
                        <Box sx={{
                          width: 56,
                          height: 56,
                          borderRadius: '12px',
                          bgcolor: NAVY_SOFT,
                          display: 'grid',
                          placeItems: 'center',
                          mx: 'auto',
                          mb: 1.5,
                        }}>
                          <Upload size={24} style={{ color: NAVY }} />
                        </Box>
                        <Typography sx={{ color: 'var(--foreground)', fontWeight: 600, mb: 0.4, fontSize: '0.95rem' }}>
                          {t.payment.clickOrDrag}
                        </Typography>
                        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          {t.payment.slipHint}
                        </Typography>
                        <Box sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 0.5,
                          mt: 1.25,
                          color: 'var(--text-muted)',
                          fontSize: '0.72rem',
                        }}>
                          <Smartphone size={13} />
                          <Typography sx={{ fontSize: 'inherit' }}>{t.payment.fileHint}</Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ position: 'relative' }}>
                        <Box sx={{
                          borderRadius: '12px',
                          overflow: 'hidden',
                          bgcolor: '#0f172a',
                          position: 'relative',
                        }}>
                          <Box
                            component="img"
                            src={previewUrl}
                            alt="Slip Preview"
                            sx={{
                              width: '100%',
                              maxHeight: 260,
                              objectFit: 'contain',
                              display: 'block',
                            }}
                          />
                          <Box sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            py: 1.25,
                            px: 2,
                            background: 'linear-gradient(transparent, rgba(5,150,105,0.92))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 0.75,
                          }}>
                            <CheckCircle2 size={16} color="#fff" />
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'white' }}>
                              {t.payment.readyToSubmit}
                            </Typography>
                          </Box>
                        </Box>
                        <Button
                          fullWidth
                          onClick={() => {
                            setSelectedFile(null);
                            setPreviewUrl(null);
                          }}
                          sx={{
                            mt: 1.25,
                            py: 0.9,
                            borderRadius: '10px',
                            bgcolor: 'rgba(217,119,6,0.1)',
                            color: AMBER,
                            fontWeight: 600,
                            textTransform: 'none',
                            '&:hover': { bgcolor: 'rgba(217,119,6,0.18)' },
                          }}
                        >
                          {t.payment.changeSlip}
                        </Button>
                      </Box>
                    )}
                  </Box>

                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files && processFile(e.target.files[0])}
                    style={{ display: 'none' }}
                  />
                </Box>

                <Box sx={{
                  px: 1.75,
                  py: 1.35,
                  borderRadius: '10px',
                  bgcolor: EMERALD_SOFT,
                  border: '1px solid rgba(5,150,105,0.2)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.25,
                }}>
                  <Info size={16} style={{ color: EMERALD, flexShrink: 0, marginTop: 2 }} />
                  <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {t.payment.slipOkAutoCheck}
                  </Typography>
                </Box>
              </>
            )}

            {/* E-Receipt notice */}
            <Box sx={{
              px: 1.75,
              py: 1.5,
              borderRadius: '10px',
              bgcolor: NAVY_SOFT,
              border: '1px solid rgba(30,58,95,0.18)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.25,
            }}>
              <Mail size={16} style={{ color: NAVY, flexShrink: 0, marginTop: 2 }} />
              <Typography sx={{ fontSize: '0.78rem', color: 'var(--foreground)', lineHeight: 1.55 }}>
                {t.payment.eReceiptNotice}
              </Typography>
            </Box>

            {/* Payment support escalation */}
            <Box
              className="payment-notice-no-print"
              sx={{
                px: 1.75,
                py: 1.35,
                borderRadius: '10px',
                bgcolor: 'var(--surface-2)',
                border: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.1,
                flexWrap: 'wrap',
              }}
            >
              <Headphones size={15} style={{ color: NAVY, flexShrink: 0, marginTop: 2 }} />
              <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {t.payment.paymentSupportHelp}{' '}
                <Box
                  component="button"
                  type="button"
                  onClick={openSupportForPayment}
                  sx={{
                    appearance: 'none',
                    border: 0,
                    background: 'none',
                    p: 0,
                    m: 0,
                    color: NAVY,
                    fontWeight: 700,
                    fontSize: 'inherit',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t.payment.contactAccounting}
                </Box>
              </Typography>
            </Box>
          </Box>
        )}
        </Box>
      </Box>

      {/* Footer — Cancel left | Confirm right */}
      <Box sx={{
        px: { xs: 2, sm: 2.5 },
        py: 1.75,
        borderTop: '1px solid var(--glass-border)',
        background: 'var(--glass-strong)',
        backdropFilter: 'blur(20px)',
        paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
      }}>
        <Box sx={{ maxWidth: 520, mx: 'auto' }}>
          {isPaid ? (
            <Button
              fullWidth
              onClick={onClose}
              sx={{
                py: 1.6,
                borderRadius: '12px',
                bgcolor: NAVY,
                color: 'white',
                fontSize: '0.95rem',
                fontWeight: 700,
                textTransform: 'none',
                '&:hover': { bgcolor: '#16304f' },
              }}
            >
              {t.payment.closeWindow}
            </Button>
          ) : !paymentEnabled ? (
            <Box sx={{ display: 'flex', gap: 1.25 }}>
              <Button
                onClick={onClose}
                sx={{
                  flex: 1,
                  py: 1.45,
                  borderRadius: '12px',
                  bgcolor: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--foreground)',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'var(--glass-bg)' },
                }}
              >
                {t.common.cancel}
              </Button>
              <Button
                disabled
                startIcon={<AlertCircle size={18} />}
                sx={{
                  flex: 2,
                  py: 1.45,
                  borderRadius: '12px',
                  background: 'rgba(239,68,68,0.12)',
                  color: '#dc2626',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  '&:disabled': {
                    background: 'rgba(239,68,68,0.12)',
                    color: '#dc2626',
                  },
                }}
              >
                {t.payment.paymentDisabledOverlay}
              </Button>
            </Box>
          ) : payMethod === 'stripe' ? (
            <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
              <Button
                onClick={onClose}
                sx={{
                  flexShrink: 0,
                  py: 1.45,
                  px: 2.25,
                  borderRadius: '12px',
                  bgcolor: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--foreground)',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'var(--glass-bg)' },
                }}
              >
                {t.common.cancel}
              </Button>
              <Box sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.85,
                py: 1.35,
                borderRadius: '12px',
                bgcolor: NAVY_SOFT,
                border: '1px solid rgba(30,58,95,0.2)',
              }}>
                <Sparkles size={15} style={{ color: NAVY }} />
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: NAVY }}>
                  {t.payment.autoVerifyHint}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 1.25 }}>
              <Button
                onClick={onClose}
                disabled={verifying}
                sx={{
                  flex: 1,
                  py: 1.45,
                  borderRadius: '12px',
                  bgcolor: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--foreground)',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'var(--glass-bg)' },
                }}
              >
                {t.common.cancel}
              </Button>
              <Button
                onClick={handleConfirmPayment}
                disabled={verifying || loading || !selectedFile}
                startIcon={verifying ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                sx={{
                  flex: 2,
                  py: 1.45,
                  borderRadius: '12px',
                  background: hasSlip && !verifying ? EMERALD : 'rgba(100,116,139,0.15)',
                  color: hasSlip && !verifying ? 'white' : '#86868b',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: hasSlip && !verifying ? '0 6px 18px rgba(5,150,105,0.28)' : 'none',
                  transition: 'all 0.25s ease',
                  '&:hover': {
                    background: hasSlip && !verifying ? '#047857' : 'rgba(100,116,139,0.2)',
                  },
                  '&:disabled': {
                    background: verifying ? NAVY : 'rgba(100,116,139,0.15)',
                    color: verifying ? 'white' : '#86868b',
                  },
                }}
              >
                {verifying ? t.payment.verifyingSlip : t.payment.confirmAndSubmit}
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
