'use client';

import { useState, useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { X, Upload, Check, Loader2, AlertCircle, CheckCircle2, Image, Clock3, ShieldCheck, Download } from 'lucide-react';
import { Skeleton, Dialog, useMediaQuery } from '@mui/material';

interface PaymentModalProps {
  orderRef: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

const usePaymentToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const addToast = (type: Toast['type'], title: string, message?: string) => {
    const id = Date.now().toString();
    const newToast: Toast = { id, type, title, message };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => removeToast(id), 3000);
  };

  return { toasts, addToast, removeToast };
};

function PaymentToastContainer({
  toasts,
  removeToast,
  inline = false,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
  inline?: boolean;
}) {
  const bgColors = {
    success: 'bg-emerald-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-orange-600',
  } as const;

  const icons = {
    success: <CheckCircle2 size={20} />,
    error: <AlertCircle size={20} />,
    info: <AlertCircle size={20} />,
    warning: <AlertCircle size={20} />,
  };

  return (
    <div
      className={`${
        inline
          ? 'absolute inset-x-0 top-4 sm:top-5'
          : 'fixed left-0 right-0'
      } z-[200] flex flex-col items-center gap-3 px-3 sm:px-4 pointer-events-none`}
      style={inline ? { paddingTop: 'env(safe-area-inset-top)' } : { top: 'max(1rem, env(safe-area-inset-top))' }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${bgColors[toast.type]} text-white p-4 rounded-lg shadow-lg flex items-start gap-3 w-full max-w-md animate-in slide-in-from-top pointer-events-auto`}
        >
          <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
          <div className="flex-1">
            <p className="font-bold text-sm">{toast.title}</p>
            {toast.message && <p className="text-xs opacity-90 mt-1">{toast.message}</p>}
          </div>
          <button onClick={() => removeToast(toast.id)} className="text-white/60 hover:text-white transition">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function PaymentModal({ orderRef, onClose, onSuccess }: PaymentModalProps): JSX.Element {
  const { toasts, addToast, removeToast } = usePaymentToast();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [baseAmount, setBaseAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const hasSlip = Boolean(selectedFile);
  const discountValue = Math.abs(discount);
  const statusLabel = verifying ? 'กำลังตรวจสอบสลิป' : hasSlip ? 'รอยืนยันการโอน' : 'รอแนบสลิป';
  const statusTone = verifying
    ? 'bg-cyan-500/15 text-cyan-100 border border-cyan-400/40'
    : hasSlip
      ? 'bg-emerald-500/15 text-emerald-100 border border-emerald-400/40'
      : 'bg-amber-500/15 text-amber-100 border border-amber-400/40';
  const steps = [
    {
      id: 1,
      label: 'สแกน/โอนตามยอด',
      hint: 'ใช้ QR ที่ระบบสร้าง',
      state: loading ? 'active' : 'done',
    },
    {
      id: 2,
      label: 'แนบสลิป',
      hint: hasSlip ? selectedFile?.name || 'อัปโหลดแล้ว' : 'รองรับ PNG/JPG สูงสุด 5MB',
      state: verifying ? 'done' : hasSlip ? 'active' : 'pending',
    },
    {
      id: 3,
      label: 'ยืนยันและรอผล',
      hint: verifying ? 'ระบบกำลังตรวจสอบ' : 'ใช้เวลา ~10-20 วินาที',
      state: verifying ? 'active' : hasSlip ? 'pending' : 'disabled',
    },
  ] as const;

  useEffect(() => {
    fetchPaymentInfo();
  }, [orderRef]);

  const fetchPaymentInfo = async () => {
    setLoading(true);
    try {
      const res: Response = await fetch(`/api/payment-info?ref=${encodeURIComponent(orderRef)}`);
      const data: any = await res.json();

      if (data.status === 'success') {
        const info = data.data || data;
        setQrUrl(info.qrUrl || null);
        setAmount(Number(info.finalAmount ?? info.amount ?? 0));
        setBaseAmount(Number(info.baseAmount ?? info.amount ?? 0));
        setDiscount(Number(info.discount ?? 0));
      } else {
        addToast('error', 'ข้อผิดพลาด', data.message || 'ไม่พบข้อมูลชำระเงิน');
      }
    } catch (error) {
      addToast('error', 'เชื่อมต่อไม่ได้', 'ลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast('error', 'ไฟล์ไม่ถูกต้อง', 'เลือกรูปภาพ');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('error', 'ไฟล์ใหญ่เกินไป', 'ขนาดสูงสุด 5MB');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleConfirmPayment = async () => {
    if (!selectedFile) {
      addToast('warning', 'กรุณาแนบสลิป');
      return;
    }

    setVerifying(true);
    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = async () => {
      const base64 = reader.result?.toString().split(',')[1];
      try {
        const res: Response = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ref: orderRef,
            base64,
            mime: selectedFile.type,
            name: selectedFile.name,
          }),
        });
        const data: any = await res.json();

        if (data.status === 'success') {
          addToast('success', 'ชำระเงินสำเร็จ');
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1500);
        } else {
          addToast('error', 'ตรวจสอบไม่ผ่าน', data.message);
        }
      } catch (error) {
        addToast('error', 'เกิดข้อผิดพลาด');
      } finally {
        setVerifying(false);
      }
    };
  };

  const handleSaveQr = async () => {
    if (!qrUrl) {
      addToast('warning', 'ยังไม่มี QR');
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
          const percent = Math.round((event.loaded / event.total) * 100);
          setDownloadProgress(percent);
        } else {
          setDownloadProgress((prev) => Math.min(99, prev + 5));
        }
      };
      xhr.onload = () => {
        if (xhr.status === 200) {
          const blob = xhr.response;
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `qr-${orderRef}.png`;
          link.click();
          URL.revokeObjectURL(blobUrl);
          setDownloadProgress(100);
          addToast('success', 'บันทึกคิวอาร์แล้ว');
        } else {
          addToast('error', 'บันทึกไม่สำเร็จ', 'ลองใหม่อีกครั้ง');
        }
        setDownloading(false);
        setTimeout(() => setDownloadProgress(0), 500);
      };
      xhr.onerror = () => {
        addToast('error', 'บันทึกไม่สำเร็จ', 'ลองใหม่อีกครั้ง');
        setDownloading(false);
        setDownloadProgress(0);
      };
      xhr.send();
    } catch (error) {
      addToast('error', 'บันทึกไม่สำเร็จ', 'ลองใหม่อีกครั้ง');
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        fullWidth
        fullScreen={isMobile}
        maxWidth="lg"
        sx={{
          zIndex: 1700,
          '& .MuiDialog-container': {
            alignItems: 'flex-start',
            paddingTop: { xs: 'max(12px, env(safe-area-inset-top))', sm: '20px' },
            paddingBottom: { xs: '12px', sm: '20px' },
            paddingLeft: { xs: 0, sm: '20px' },
            paddingRight: { xs: 0, sm: '20px' },
          },
          '& .MuiDialog-paper': {
            background: 'transparent',
            boxShadow: 'none',
            overflow: 'visible',
            margin: 0,
            maxHeight: 'calc(100vh - 24px)',
          },
        }}
        BackdropProps={{
          sx: {
            backdropFilter: 'blur(10px)',
            backgroundColor: 'rgba(5, 10, 26, 0.7)',
          },
        }}
      >
        <div className="relative w-full max-w-[calc(100vw)] sm:max-w-[min(1200px,calc(100vw-8px))] mx-auto max-h-[calc(100vh-32px)] overflow-y-auto overscroll-contain overflow-x-hidden px-2 sm:px-6 pb-4">
          <div className="relative border border-slate-800/70 shadow-2xl rounded-3xl overflow-hidden text-slate-100 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
            <div className="sticky top-0 z-10 flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3 sm:gap-4 px-5 sm:px-7 pt-5 sm:pt-6 pb-4 sm:pb-5 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl relative">
              <button
                onClick={onClose}
                className="absolute right-4 sm:right-5 top-4 sm:top-5 h-10 w-10 rounded-full bg-white/10 hover:bg-white/15 text-white transition border border-white/15 flex items-center justify-center"
              >
                <X size={18} />
              </button>
              <div className="space-y-1 pr-12 sm:pr-16">
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/80">payment</p>
                <h3 className="text-xl sm:text-2xl font-black leading-tight">ยืนยันการชำระเงิน</h3>
                <p className="text-sm text-slate-400">หมายเลขออเดอร์: #{orderRef}</p>
              </div>
              <div className="flex items-center sm:items-center flex-wrap gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end pr-12 sm:pr-16">
                <div className={`px-3 py-2 rounded-full text-xs font-semibold ${statusTone}`}>{statusLabel}</div>
              </div>
            </div>

            <div className="px-5 sm:px-7 py-5 sm:py-6 space-y-6">
              <div className="hidden" />

              {loading ? (
                <div className="grid gap-5 sm:gap-6 lg:grid-cols-[1.05fr_1fr]">
                  <div className="space-y-4">
                    <Skeleton variant="rectangular" height={260} className="!bg-slate-800/80 rounded-2xl" />
                    <Skeleton variant="rectangular" height={140} className="!bg-slate-800/80 rounded-2xl" />
                  </div>
                  <div className="space-y-4">
                    <Skeleton variant="rectangular" height={320} className="!bg-slate-800/80 rounded-2xl" />
                    <Skeleton variant="rectangular" height={82} className="!bg-slate-800/80 rounded-2xl" />
                  </div>
                </div>
              ) : (
                <div className="grid gap-5 sm:gap-6 lg:gap-7 lg:grid-cols-[1.05fr_1fr] items-start">
                  <div className="space-y-5">
                    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 shadow-xl">
                      <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.08),transparent_30%)]" />
                      <div className="relative grid sm:grid-cols-[1.1fr_0.9fr] gap-4 p-4 sm:p-5">
                        <div className="relative bg-white/90 rounded-xl border border-emerald-50 shadow-lg p-3 sm:p-4 flex items-center justify-center min-h-[220px] sm:min-h-[240px]">
                          {qrUrl ? (
                            <img src={qrUrl} alt="QR Code" className="w-full max-w-[340px] h-auto object-contain" />
                          ) : (
                            <div className="w-full aspect-square flex items-center justify-center text-slate-400">กำลังสร้าง QR...</div>
                          )}
                          <div className="pointer-events-none absolute inset-x-2 bottom-2 sm:bottom-3 bg-white/90 text-[11px] sm:text-xs text-slate-700 font-semibold px-2 py-1 rounded-md text-center shadow">
                            ใช้สำหรับการชำระค่าเสื้อชุมนุมคอมพิวเตอร์เท่านั้น
                          </div>
                        </div>
                        <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center gap-3 text-xs sm:text-sm px-1 sm:px-0">
                          <button
                            onClick={handleSaveQr}
                            disabled={!qrUrl || loading || downloading}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold px-3 py-2 shadow"
                          >
                            {downloading ? (
                              <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>บันทึก... {downloadProgress}%</span>
                              </>
                            ) : (
                              <>
                                <Download size={16} />
                                <span>บันทึกคิวอาร์โค้ด</span>
                              </>
                            )}
                          </button>
                          <span className="text-slate-400">ไฟล์จะถูกเซฟเป็น PNG</span>
                        </div>
                        {downloading && (
                          <div className="sm:col-span-2 px-1 sm:px-0">
                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-emerald-400 transition-[width] duration-150"
                                style={{ width: `${Math.min(downloadProgress, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-slate-300">ยอดสุทธิที่ต้องชำระ</p>
                            <div className="flex items-center gap-1.5 text-xs text-emerald-200 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-400/30">
                              <Clock3 size={14} />
                              <span>ตรวจอัตโนมัติ</span>
                            </div>
                          </div>
                          <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white p-4 sm:p-5 shadow-lg">
                            <p className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">{amount.toLocaleString()}฿</p>
                            <p className="text-sm text-white/80 mt-1">โอนตามยอดนี้เท่านั้น</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                              <p className="text-slate-400 text-xs">ค่าสินค้า</p>
                              <p className="text-lg font-semibold mt-1">{baseAmount.toLocaleString()}฿</p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                              <p className="text-slate-400 text-xs">ส่วนลด</p>
                              <p className="text-lg font-semibold mt-1 text-emerald-300">-{discountValue.toLocaleString()}฿</p>
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <p className="text-slate-300 font-semibold">โค้ดส่วนลด</p>
                              <span className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-400/30 px-2 py-1 rounded-full">ยังไม่มา</span>
                            </div>
                            <div className="flex gap-2 flex-col sm:flex-row">
                              <input
                                type="text"
                                disabled
                                placeholder="ใส่โค้ดเร็วๆ นี้"
                                className="w-full rounded-lg bg-slate-800/70 border border-slate-700 text-slate-400 px-3 py-2 text-sm cursor-not-allowed"
                              />
                              <button
                                disabled
                                className="sm:w-32 w-full rounded-lg bg-slate-800/70 text-slate-500 border border-slate-700 px-3 py-2 text-sm cursor-not-allowed"
                              >
                                ใช้โค้ด
                              </button>
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-300 space-y-1">
                            <div className="flex items-center gap-2">
                              <Clock3 size={14} className="text-cyan-300" />
                              <span>อัปโหลดสลิปภายใน 15 นาที</span>
                            </div>
                            <p className="text-slate-400">ระบบจะตรวจอัตโนมัติทันทีที่อัปโหลด</p>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 shadow-xl">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-slate-900 grid place-items-center">
                            <Image size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">แนบสลิปโอนเงิน</p>
                            <p className="text-xs text-slate-400">รองรับ PNG หรือ JPG สูงสุด 5MB</p>
                          </div>
                        </div>
                        {hasSlip && (
                          <button
                            onClick={() => {
                              setPreviewUrl(null);
                              setSelectedFile(null);
                            }}
                            className="text-xs text-amber-200 bg-amber-500/10 border border-amber-400/30 px-3 py-1.5 rounded-full hover:bg-amber-500/15"
                          >
                            ลบไฟล์
                          </button>
                        )}
                      </div>

                      {!previewUrl ? (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragActive(true);
                          }}
                          onDragLeave={() => setDragActive(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragActive(false);
                            const droppedFile = e.dataTransfer.files?.[0];
                            if (droppedFile) processFile(droppedFile);
                          }}
                            className={`w-full border-2 border-dashed rounded-2xl p-7 sm:p-10 transition flex flex-col items-center gap-3 cursor-pointer ${
                            dragActive
                              ? 'border-cyan-400 bg-cyan-500/10 text-cyan-100'
                              : 'border-slate-700 bg-slate-900/70 text-slate-400 hover:border-cyan-400 hover:text-cyan-100'
                          }`}
                        >
                          <Upload size={32} />
                          <div className="text-center">
                            <p className="font-semibold">ลากไฟล์หรือคลิกเพื่อเลือก</p>
                            <p className="text-xs opacity-80 mt-0.5">ควรเป็นสลิปที่คมชัด เห็นยอดและเวลา</p>
                          </div>
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/80">
                            <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-96 object-contain p-3" />
                            <CheckCircle2 className="absolute bottom-3 right-3 text-emerald-400" size={26} />
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-300">
                            <span className="truncate pr-2">{selectedFile?.name}</span>
                            <button onClick={() => fileInputRef.current?.click()} className="text-cyan-300 hover:text-cyan-200 font-semibold">
                              เปลี่ยนรูปภาพ
                            </button>
                          </div>
                        </div>
                      )}

                      <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={(e) => e.target.files && processFile(e.target.files[0])}
                        className="hidden"
                      />

                      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-300 space-y-1">
                        <p className="font-semibold text-slate-200">คำแนะนำสั้นๆ</p>
                        <p>• ใช้สลิปชัดเจน ไม่เกิน 5MB</p>
                        <p>• เห็นยอด {amount.toLocaleString()}฿ และเวลาชัด</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-inner space-y-3">
                      <button
                        onClick={handleConfirmPayment}
                        disabled={verifying || loading || !selectedFile}
                        className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold py-3.5 rounded-xl shadow-lg flex justify-center items-center gap-2 transition text-sm sm:text-base"
                      >
                        {verifying ? (
                          <>
                            <Loader2 size={20} className="animate-spin" />
                            <span>กำลังตรวจสอบ...</span>
                          </>
                        ) : selectedFile ? (
                          <>
                            <Check size={20} />
                            <span>ยืนยันการโอนเงิน</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={20} />
                            <span>กรุณาแนบสลิป</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
                        <span>ระบบตรวจสอบอัตโนมัติ โปรดรออยู่ในหน้านี้</span>
                        <span className="text-emerald-200">ผลลัพธ์จะเด้งแจ้งเตือนทันที</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <PaymentToastContainer toasts={toasts} removeToast={removeToast} inline />
      </Dialog>
    </>
  );
}
