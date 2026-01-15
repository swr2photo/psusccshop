import { Facebook, Instagram, Mail } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-10 mt-auto">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Brand */}
        <div>
          <h3 className="text-xl font-bold text-white mb-4 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent w-fit">
            PSUSCCSHOP
          </h3>
          <p className="text-sm">
            ร้านค้าในชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์
          </p>
        </div>

        {/* Links */}
        <div>
          <h4 className="font-bold text-white mb-4">เมนู</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/" className="hover:text-indigo-400 transition flex items-center gap-2">
                หน้าแรก
              </Link>
            </li>
            <li>
              <Link href="/payment" className="hover:text-indigo-400 transition flex items-center gap-2">
                แจ้งชำระเงิน
              </Link>
            </li>
            <li>
              <Link href="/orders" className="hover:text-indigo-400 transition flex items-center gap-2">
                ตรวจสอบสถานะ
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="font-bold text-white mb-4">ติดต่อเรา</h4>
          <div className="flex gap-4 mb-4">
            <a href="https://facebook.com/psuscc" className="hover:text-indigo-500 transition" title="Facebook">
              <Facebook size={20} />
            </a>
            <a href="https://instagram.com/psuscc" className="hover:text-pink-500 transition" title="Instagram">
              <Instagram size={20} />
            </a>
            <a href="psuscc@psusci.club" className="hover:text-emerald-500 transition" title="Email">
              <Mail size={20} />
            </a>
          </div>
          <p className="text-xs opacity-50">
            © {new Date().getFullYear()} PSUSCCSHOP. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
