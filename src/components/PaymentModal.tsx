'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Upload, Check, Loader2, Tag, QrCode } from 'lucide-react';
import Swal from 'sweetalert2';
// import { API_URL } from '@/lib/config'; // ไม่ต้องใช้ API_URL ของ GAS แล้ว

interface PaymentModalProps {
  orderRef: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({ orderRef, onClose, onSuccess }: PaymentModalProps) {
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [baseAmount, setBaseAmount] = useState(0);
  
  const [code, setCode] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentInfo();
  }, [orderRef]);

  const fetchPaymentInfo = async (discountCodeStr = '') => {
    setLoading(true);
    try {
      // ✅ เรียก API ของ Next.js แทน GAS
      const res = await fetch('/api/payment/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: orderRef, discountCode: discountCodeStr })
      });
      const data = await res.json();
      
      if (data.status === 'success') {
        setQrUrl(data.qrUrl);
        setAmount(data.finalAmount);
        setBaseAmount(data.baseAmount);
        setDiscount(data.discount);
        if (discountCodeStr) Swal.fire({ icon: 'success', title: 'ใช้โค้ดส่วนลดแล้ว', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
      } else {
        Swal.fire('Error', data.message || 'โหลดข้อมูลไม่สำเร็จ', 'error');
      }
    } catch (error) {
      console.error(error);
      Swal.fire('Error', 'การเชื่อมต่อขัดข้อง', 'error');
    } finally {
      setLoading(false);
      setApplyingCode(false);
    }
  };

  const handleApplyCode = () => {
    if (!code) return;
    setApplyingCode(true);
    fetchPaymentInfo(code);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleConfirmPayment = () => {
    if (!selectedFile) return Swal.fire('แจ้งเตือน', 'กรุณาแนบสลิปโอนเงิน', 'warning');

    setVerifying(true);
    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = async () => {
      const base64 = reader.result?.toString().split(',')[1];
      try {
        // ✅ เรียก API ของ Next.js แทน GAS
        const res = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ref: orderRef,
            base64: base64,
            mime: selectedFile.type,
            name: selectedFile.name,
            discountCode: code
          })
        });
        const data = await res.json();

        if (data.status === 'success') {
          Swal.fire({
            icon: 'success',
            title: 'ชำระเงินสำเร็จ!',
            text: 'ระบบได้รับสลิปเรียบร้อยแล้ว',
            timer: 2000,
            showConfirmButton: false
          });
          onSuccess();
        } else {
          Swal.fire('ตรวจสอบไม่ผ่าน', data.message || 'สลิปไม่ถูกต้อง', 'error');
        }
      } catch (error) {
        Swal.fire('Error', 'เกิดข้อผิดพลาดในการส่งข้อมูล', 'error');
      } finally {
        setVerifying(false);
      }
    };
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
      <div className="bg-white text-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
        
        <div className="bg-slate-100 p-4 flex justify-between items-center border-b">
          <div><h3 className="font-bold text-lg">ชำระเงิน</h3><p className="text-xs text-slate-500">Ref: {orderRef}</p></div>
          <button onClick={onClose} className="bg-slate-200 p-2 rounded-full hover:bg-slate-300"><X size={20} /></button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-2 w-10 h-10 text-indigo-600" />
              <p>กำลังสร้าง QR Code...</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center mb-6">
                <div className="bg-white p-3 rounded-xl border-2 border-indigo-100 shadow-sm mb-3 min-h-[200px] flex items-center justify-center">
                  {qrUrl ? (
                    <img src={qrUrl} alt="PromptPay QR" className="w-48 h-48 object-contain" />
                  ) : (
                    <div className="flex flex-col items-center text-slate-300">
                      <QrCode size={48} className="mb-2 opacity-20" />
                      <span className="text-xs">กำลังสร้าง QR...</span>
                    </div>
                  )}
                </div>
                <div className="text-center w-full">
                  <p className="text-sm text-slate-500 mb-1">ยอดชำระสุทธิ</p>
                  <p className="text-3xl font-extrabold text-indigo-600">฿{amount.toLocaleString()}</p>
                  
                  <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                    <div className="flex justify-between"><span>ค่าสินค้า:</span> <span>฿{baseAmount.toLocaleString()}</span></div>
                    {/* ไม่แสดงค่าส่ง */}
                    {discount > 0 && <div className="flex justify-between text-green-600 font-bold"><span>ส่วนลด:</span> <span>-฿{discount.toLocaleString()}</span></div>}
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1"><Tag size={12} /> โค้ดส่วนลด</label>
                <div className="flex gap-2">
                  <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="กรอกโค้ดส่วนลด" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 uppercase" />
                  <button onClick={handleApplyCode} disabled={applyingCode || !code} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700 disabled:opacity-50">{applyingCode ? <Loader2 className="animate-spin w-4 h-4" /> : 'ใช้'}</button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <p className="font-bold text-slate-700 mb-3">แนบสลิปโอนเงิน</p>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                {!previewUrl ? (
                  <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-slate-300 rounded-xl p-6 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50 transition flex flex-col items-center gap-2">
                    <Upload size={24} /><span className="text-sm">คลิกเพื่ออัปโหลดสลิป</span>
                  </button>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200">
                    <img src={previewUrl} alt="Slip Preview" className="w-full h-auto max-h-64 object-contain bg-slate-50" />
                    <button onClick={() => { setPreviewUrl(null); setSelectedFile(null); }} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600"><X size={16} /></button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t bg-white">
          <button onClick={handleConfirmPayment} disabled={verifying || loading || !selectedFile} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold py-3.5 rounded-xl shadow-lg flex justify-center items-center gap-2 transition-all">
            {verifying ? <><Loader2 className="animate-spin" /> กำลังตรวจสอบ...</> : <><Check /> ยืนยันการโอนเงิน</>}
          </button>
        </div>
      </div>
    </div>
  );
}