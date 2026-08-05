/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api-client';
import {
  Sparkles,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MoveUp,
  MoveDown,
  Globe,
  Settings2,
} from 'lucide-react';
import type { Product } from '@/lib/config';
import type { FlagshipProductConfig, FlagshipStageCopy } from '@/lib/flagship/config';

interface FlagshipSettingsProps {
  products: Product[];
  currentConfig?: any;
  onSaveSuccess?: () => void;
}

const DEFAULT_FLAGSHIP_CONFIG: FlagshipProductConfig = {
  slug: 'scc-jersey-2026',
  productId: '',
  framesFolder: '/flagship/scc-jersey-2026/frames',
  frameCount: 60,
  frameExt: 'webp',
  frameStep: 1,
  mobileFrameStep: 2,
  mobileMaxFrames: 28,
  brandLabel: {
    th: 'SCC Flagship 2026',
    en: 'SCC Flagship 2026',
  },
  stages: {
    th: [
      {
        side: 'left',
        eyebrow: 'Stage 01',
        title: 'เผยโฉมเสื้อกีฬา',
        body: 'หมุนชมทุกรายละเอียด — ดีไซน์ที่ออกแบบมาเพื่อ SCC 2026',
      },
      {
        side: 'right',
        eyebrow: 'Cool Elite',
        title: 'เนื้อผ้า Cool Elite',
        body: 'ระบายอากาศได้ดี เบาสบาย เหมาะกับการเคลื่อนไหวตลอดวัน',
      },
      {
        side: 'left',
        eyebrow: 'Customize',
        title: 'ใส่ชื่อและเบอร์ของคุณ',
        body: 'สกรีนชื่อและหมายเลขด้านหลัง ให้เป็นตัวตนของคุณบนสนาม',
      },
      {
        side: 'right',
        eyebrow: 'Yours',
        title: 'เลือกไซส์ แล้วใส่ตะกร้า',
        body: 'เลือกขนาดที่พอดี แล้วเริ่มสั่งซื้อได้ทันที',
      },
    ],
    en: [
      {
        side: 'left',
        eyebrow: 'Stage 01',
        title: 'Reveal the jersey',
        body: 'Scroll to explore every angle — designed for SCC 2026.',
      },
      {
        side: 'right',
        eyebrow: 'Cool Elite',
        title: 'Cool Elite fabric',
        body: 'Breathable and lightweight — built to move with you all day.',
      },
      {
        side: 'left',
        eyebrow: 'Customize',
        title: 'Make it yours',
        body: 'Add your name and number on the back — your identity on the field.',
      },
      {
        side: 'right',
        eyebrow: 'Yours',
        title: 'Pick a size & add to cart',
        body: 'Choose your fit and order in one scroll.',
      },
    ],
  },
};

export default function FlagshipSettings({
  products,
  currentConfig,
  onSaveSuccess,
}: FlagshipSettingsProps) {
  const [config, setConfig] = useState<FlagshipProductConfig>(() => {
    if (currentConfig?.flagshipConfig) {
      return { ...DEFAULT_FLAGSHIP_CONFIG, ...currentConfig.flagshipConfig };
    }
    return DEFAULT_FLAGSHIP_CONFIG;
  });

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'th' | 'en'>('th');

  useEffect(() => {
    if (currentConfig?.flagshipConfig) {
      setConfig((prev) => ({ ...prev, ...currentConfig.flagshipConfig }));
    }
  }, [currentConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setStatusMsg(null);

      const res = await apiFetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...currentConfig,
          flagshipConfig: config,
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setStatusMsg({ type: 'success', text: 'บันทึกการตั้งค่าหน้า Flagship สำเร็จแล้ว' });
        onSaveSuccess?.();
      } else {
        throw new Error(data.message || 'ไม่สามารถบันทึกการตั้งค่าได้');
      }
    } catch (err: any) {
      console.error('[FlagshipSettings] Save error:', err);
      setStatusMsg({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    } finally {
      setSaving(false);
    }
  };

  // Stage manipulation functions
  const addStage = () => {
    const newStageTH: FlagshipStageCopy = {
      side: 'left',
      eyebrow: `Stage 0${(config.stages.th?.length || 0) + 1}`,
      title: 'หัวข้อจุดเด่นใหม่',
      body: 'คำอธิบายจุดเด่นของสินค้าเพิ่มเติม...',
    };
    const newStageEN: FlagshipStageCopy = {
      side: 'left',
      eyebrow: `Stage 0${(config.stages.en?.length || 0) + 1}`,
      title: 'New Feature Stage',
      body: 'Detailed description of this product feature...',
    };

    setConfig({
      ...config,
      stages: {
        th: [...(config.stages.th || []), newStageTH],
        en: [...(config.stages.en || []), newStageEN],
      },
    });
  };

  const removeStage = (index: number) => {
    setConfig({
      ...config,
      stages: {
        th: (config.stages.th || []).filter((_, i) => i !== index),
        en: (config.stages.en || []).filter((_, i) => i !== index),
      },
    });
  };

  const moveStage = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= (config.stages.th?.length || 0)) return;

    const swapArr = (arr: any[]) => {
      const copy = [...arr];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    };

    setConfig({
      ...config,
      stages: {
        th: swapArr(config.stages.th || []),
        en: swapArr(config.stages.en || []),
      },
    });
  };

  const updateStageField = (
    langKey: 'th' | 'en',
    index: number,
    field: keyof FlagshipStageCopy,
    value: string
  ) => {
    const updatedStages = [...(config.stages[langKey] || [])];
    if (updatedStages[index]) {
      updatedStages[index] = {
        ...updatedStages[index],
        [field]: value,
      };
      setConfig({
        ...config,
        stages: {
          ...config.stages,
          [langKey]: updatedStages,
        },
      });
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--glass-border)] pb-4">
        <div>
          <h2 className="flex items-center gap-2.5 text-xl font-bold text-[var(--foreground)]">
            <Sparkles className="size-6 text-indigo-500" />
            ตั้งค่าหน้าสินค้า Flagship (Scrollytelling Experience)
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            ปรับแต่งเนื้อหา ข้อความ แอนิเมชัน และการหมุน 360° ของหน้าสินค้าพรีเมียม /flagship/scc-jersey-2026
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/flagship/${config.slug || 'scc-jersey-2026'}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
          >
            <ExternalLink className="size-4 text-indigo-500" />
            เปิดทดสอบหน้าร้านจริง
          </a>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer transition-all"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span>บันทึกการตั้งค่า Flagship</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`flex items-center gap-2.5 rounded-xl border p-4 text-sm font-semibold transition-all ${
            statusMsg.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
              : 'border-red-500/30 bg-red-500/10 text-red-600'
          }`}
        >
          {statusMsg.type === 'success' ? <CheckCircle2 className="size-5 shrink-0" /> : <AlertCircle className="size-5 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* 1. General & Linked Product Settings */}
      <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-5 backdrop-blur-xl space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
          <Settings2 className="size-4 text-indigo-500" />
          1. การตั้งค่าสินค้า & ป้ายกำกับ (General & Linked Product)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--foreground)]">เชื่อมโยงกับสินค้าในแคตตาล็อก (Catalog Product)</label>
            <select
              value={config.productId || ''}
              onChange={(e) => setConfig({ ...config, productId: e.target.value })}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- อัตโนมัติ (ค้นหาจากคำว่า jersey / scc-2026) --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (ID: {p.id}) - ฿{p.basePrice || (p as any).price || 0}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--foreground)]">URL Path Slug</label>
            <input
              type="text"
              value={config.slug || 'scc-jersey-2026'}
              onChange={(e) => setConfig({ ...config, slug: e.target.value })}
              placeholder="scc-jersey-2026"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--foreground)]">ป้ายกำกับแบรนด์ ภาษาไทย (Brand Label TH)</label>
            <input
              type="text"
              value={config.brandLabel?.th || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  brandLabel: { th: e.target.value, en: config.brandLabel?.en || e.target.value },
                })
              }
              placeholder="SCC Flagship 2026"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--foreground)]">ป้ายกำกับแบรนด์ ภาษาอังกฤษ (Brand Label EN)</label>
            <input
              type="text"
              value={config.brandLabel?.en || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  brandLabel: { th: config.brandLabel?.th || e.target.value, en: e.target.value },
                })
              }
              placeholder="SCC Flagship 2026"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* 2. Scrollytelling Frames & 360 Animation Settings */}
      <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-5 backdrop-blur-xl space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
          <ImageIcon className="size-4 text-indigo-500" />
          2. ตั้งค่าแอนิเมชันหมุน 360° (Scrollytelling Frames & Canvas)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-bold text-[var(--foreground)]">โฟลเดอร์รูปภาพ (Frames Path)</label>
            <input
              type="text"
              value={config.framesFolder || ''}
              onChange={(e) => setConfig({ ...config, framesFolder: e.target.value })}
              placeholder="/flagship/scc-jersey-2026/frames"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-[var(--foreground)]">จำนวนเฟรมทั้งหมด (Frame Count)</label>
            <input
              type="number"
              value={config.frameCount || 60}
              onChange={(e) => setConfig({ ...config, frameCount: Number(e.target.value) || 60 })}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-[var(--foreground)]">นามสกุลไฟล์ภาพ (Extension)</label>
            <select
              value={config.frameExt || 'webp'}
              onChange={(e) => setConfig({ ...config, frameExt: e.target.value as any })}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 font-medium focus:ring-2 focus:ring-indigo-500"
            >
              <option value="webp">.webp (แนะนำ)</option>
              <option value="jpg">.jpg</option>
              <option value="png">.png</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-[var(--foreground)]">จำกัดเฟรมมือถือ (Mobile Max Frames)</label>
            <input
              type="number"
              value={config.mobileMaxFrames || 28}
              onChange={(e) => setConfig({ ...config, mobileMaxFrames: Number(e.target.value) || 28 })}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* 3. Story Stages Editor */}
      <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-5 backdrop-blur-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--glass-border)] pb-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
              <Layers className="size-4 text-indigo-500" />
              3. กำหนดเนื้อหาจุดเด่นตามสโครล (Story Stages Content)
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              ข้อความแจ้งเตือนจุดเด่นที่จะปรากฏในแต่ละช่วงของการสโครลหน้าจอ
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl bg-card border border-[var(--glass-border)] p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('th')}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-all ${
                  activeTab === 'th' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-foreground'
                }`}
              >
                <Globe className="size-3.5" />
                ภาษาไทย (TH)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('en')}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-all ${
                  activeTab === 'en' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-foreground'
                }`}
              >
                <Globe className="size-3.5" />
                English (EN)
              </button>
            </div>

            <button
              type="button"
              onClick={addStage}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-all cursor-pointer"
            >
              <Plus className="size-4" />
              เพิ่มช่วงจุดเด่น
            </button>
          </div>
        </div>

        {/* Stages List */}
        <div className="space-y-4">
          {(config.stages[activeTab] || []).map((stage, idx) => (
            <div
              key={idx}
              className="group relative rounded-xl border border-[var(--glass-border)] bg-card/60 p-4 transition-all hover:border-indigo-500/40"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/10 px-2.5 py-1 text-xs font-bold text-indigo-500">
                  Stage #{idx + 1}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveStage(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 text-[var(--text-muted)]"
                    title="เลื่อนขึ้น"
                  >
                    <MoveUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStage(idx, 'down')}
                    disabled={idx === (config.stages[activeTab]?.length || 0) - 1}
                    className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 text-[var(--text-muted)]"
                    title="เลื่อนลง"
                  >
                    <MoveDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStage(idx)}
                    className="p-1 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors ml-1"
                    title="ลบช่วงนี้"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-[var(--foreground)]">ป้ายหัวข้อเล็ก (Eyebrow Tag)</label>
                  <input
                    type="text"
                    value={stage.eyebrow || ''}
                    onChange={(e) => updateStageField(activeTab, idx, 'eyebrow', e.target.value)}
                    placeholder="เช่น Stage 01, Cool Elite"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-[var(--foreground)]">หัวข้อหลัก (Title)</label>
                  <input
                    type="text"
                    value={stage.title || ''}
                    onChange={(e) => updateStageField(activeTab, idx, 'title', e.target.value)}
                    placeholder="เช่น เผยโฉมเสื้อกีฬา"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 font-semibold text-foreground focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-[var(--foreground)]">รายละเอียด (Body Description)</label>
                  <textarea
                    rows={2}
                    value={stage.body || ''}
                    onChange={(e) => updateStageField(activeTab, idx, 'body', e.target.value)}
                    placeholder="คำอธิบายจุดเด่นในช่วงนี้..."
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 font-normal focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[var(--foreground)]">ฝั่งข้อความ (Text Side)</label>
                  <select
                    value={stage.side || 'left'}
                    onChange={(e) => updateStageField(activeTab, idx, 'side', e.target.value as any)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="left">ด้านซ้าย (Left)</option>
                    <option value="right">ด้านขวา (Right)</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
