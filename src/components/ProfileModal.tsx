'use client';

import { useState, useEffect } from 'react';
import { X, ShieldCheck, User, Phone, Instagram, AlertTriangle } from 'lucide-react';

interface ProfileModalProps {
  initialData: { name: string; phone: string; address: string; instagram: string };
  onClose: () => void;
  onSave: (data: any) => void;
}

export default function ProfileModal({ initialData, onClose, onSave }: ProfileModalProps) {
  const [formData, setFormData] = useState(initialData);
  const [pdpaAccepted, setPdpaAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData.name && initialData.phone && initialData.instagram) {
      setPdpaAccepted(true);
    }
  }, [initialData]);

  const sanitizeThai = (value: string) => value.replace(/[^\u0E00-\u0E7F\s]/g, '').trimStart();
  const sanitizePhone = (value: string) => value.replace(/\D/g, '').slice(0, 12);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!formData.name || !/^[\u0E00-\u0E7F\s]+$/.test(formData.name.trim())) nextErrors.name = 'กรอกชื่อ-นามสกุลภาษาไทย';
    if (!formData.phone || formData.phone.length < 9) nextErrors.phone = 'กรอกเบอร์โทรให้ถูกต้อง';
    if (!formData.instagram.trim()) nextErrors.instagram = 'กรอก Instagram (จำเป็น)';
    if (!pdpaAccepted) nextErrors.pdpa = 'กรุณายืนยันการใช้ข้อมูล';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl p-6 relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X />
        </button>

        <h2 className="text-2xl font-bold mb-1 text-white">ข้อมูลผู้ติดต่อ</h2>
        <p className="text-slate-400 text-sm mb-6">กรุณากรอกข้อมูลเพื่อใช้ในการติดต่อและอัปเดตสถานะ (ชื่อไทย / เบอร์ / IG)</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute top-3 left-3 text-slate-500 w-5 h-5" />
            <input
              required
              type="text"
              placeholder="ชื่อ-นามสกุล"
              value={formData.name}
              onChange={e => setFormData({...formData, name: sanitizeThai(e.target.value)})}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
            />
            {errors.name && <p className="text-rose-400 text-xs mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <Phone className="absolute top-3 left-3 text-slate-500 w-5 h-5" />
              <input
                required
                type="tel"
                placeholder="เบอร์โทร"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: sanitizePhone(e.target.value)})}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
              />
              {errors.phone && <p className="text-rose-400 text-xs mt-1">{errors.phone}</p>}
            </div>
            <div className="relative">
              <Instagram className="absolute top-3 left-3 text-pink-500 w-5 h-5" />
              <input
                required
                type="text"
                placeholder="Instagram (จำเป็น)"
                value={formData.instagram}
                onChange={e => setFormData({...formData, instagram: e.target.value.trimStart()})}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
              />
              {errors.instagram && <p className="text-rose-400 text-xs mt-1">{errors.instagram}</p>}
            </div>
          </div>

          <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl">
            <div className="flex items-start gap-3">
              <ShieldCheck className="text-indigo-400 w-6 h-6 shrink-0" />
              <div className="text-xs text-slate-300">
                <p className="font-bold text-indigo-300 mb-1">นโยบายความเป็นส่วนตัว</p>
                <p>ข้อมูลของท่านจะถูกใช้เพื่อการจัดส่งเท่านั้น</p>
              </div>
            </div>
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={pdpaAccepted}
                onChange={e => setPdpaAccepted(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-400">ยินยอมให้ใช้ข้อมูล</span>
            </label>
            {errors.pdpa && (
              <div className="flex items-center gap-2 text-amber-400 text-xs mt-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{errors.pdpa}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!pdpaAccepted}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition"
          >
            บันทึกข้อมูล
          </button>
        </form>
      </div>
    </div>
  );
}
