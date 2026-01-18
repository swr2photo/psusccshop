'use client';

import Link from 'next/link';
import { Home, ShoppingBag, Search, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      <div className="relative z-10 text-center max-w-lg mx-auto">
        {/* Glitch 404 Effect */}
        <div className="relative mb-8">
          <h1 
            className="text-[150px] sm:text-[200px] font-black leading-none select-none"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 50%, #8b5cf6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 80px rgba(99, 102, 241, 0.5)',
            }}
          >
            404
          </h1>
          
          {/* Glitch layers */}
          <h1 
            className="absolute inset-0 text-[150px] sm:text-[200px] font-black leading-none select-none opacity-30 animate-glitch-1"
            style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            404
          </h1>
          <h1 
            className="absolute inset-0 text-[150px] sm:text-[200px] font-black leading-none select-none opacity-30 animate-glitch-2"
            style={{
              background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            404
          </h1>
        </div>

        {/* Glass Card */}
        <div 
          className="backdrop-blur-xl rounded-3xl p-8 mb-8 border border-white/10"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <Search className="w-6 h-6 text-indigo-400" />
            <h2 className="text-2xl font-bold text-white">ไม่พบหน้าที่คุณต้องการ</h2>
          </div>
          
          <p className="text-slate-400 mb-6 leading-relaxed">
            หน้าที่คุณกำลังค้นหาอาจถูกย้าย ลบไปแล้ว หรือไม่เคยมีอยู่<br />
            ลองตรวจสอบ URL อีกครั้ง หรือกลับไปหน้าหลัก
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.back()}
              className="group flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 border border-white/20 text-white hover:bg-white/10 hover:border-white/30"
            >
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              ย้อนกลับ
            </button>
            
            <Link
              href="/"
              className="group flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 text-white"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
              }}
            >
              <Home className="w-5 h-5 transition-transform group-hover:scale-110" />
              กลับหน้าหลัก
            </Link>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-slate-400 hover:text-indigo-400 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            สินค้าทั้งหมด
          </Link>
          <span className="text-slate-600">•</span>
          <Link 
            href="/orders" 
            className="flex items-center gap-2 text-slate-400 hover:text-indigo-400 transition-colors"
          >
            <Search className="w-4 h-4" />
            ตรวจสอบคำสั่งซื้อ
          </Link>
        </div>

        {/* Decorative Element */}
        <div className="mt-12 flex justify-center gap-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 animate-bounce"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>

      {/* Custom CSS for glitch animation */}
      <style jsx>{`
        @keyframes glitch-1 {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(-3px, 3px); }
          40% { transform: translate(-3px, -3px); }
          60% { transform: translate(3px, 3px); }
          80% { transform: translate(3px, -3px); }
        }
        
        @keyframes glitch-2 {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(3px, -3px); }
          40% { transform: translate(3px, 3px); }
          60% { transform: translate(-3px, -3px); }
          80% { transform: translate(-3px, 3px); }
        }
        
        .animate-glitch-1 {
          animation: glitch-1 2s infinite;
        }
        
        .animate-glitch-2 {
          animation: glitch-2 2s infinite;
          animation-delay: 0.1s;
        }
      `}</style>
    </div>
  );
}
