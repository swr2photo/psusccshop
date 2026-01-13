'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, Shirt, X, Trash2, Loader2, LogIn, History, Package, UserPen } from 'lucide-react';
import Swal from 'sweetalert2';
import { useSession, signIn, signOut } from "next-auth/react"; 
import { useCartStore, Product, CartItem } from '@/store/cartStore';
import { API_URL } from '@/lib/config';
import PaymentModal from '@/components/PaymentModal';

// --- Constants ---

// 🔥 1. ตารางราคา (อ้างอิงจาก Backend .gs)
const PRICE_TABLE = {
  JERSEY: {
    'S': 339, 'M': 339, 'L': 339, 'XL': 339,
    '2XL': 349, '3XL': 349, '4XL': 369, '5XL': 369
  },
  CREW: {
    'S': 249, 'M': 249, 'L': 249, 'XL': 249,
    '2XL': 279, '3XL': 279, '4XL': 289, '5XL': 289
  }
};

// 🔥 2. แก้ราคาเริ่มต้นให้ตรง
const PRODUCTS: Product[] = [
  { id: 'j1', name: 'CS Jersey 2026', type: 'JERSEY', price: 339 }, // เริ่มต้น 339
  { id: 'c1', name: 'CS Crew Neck (White)', type: 'CREW', price: 249 }, // เริ่มต้น 249
  { id: 'c2', name: 'CS Crew Neck (Black)', type: 'CREW', price: 249 }, // เริ่มต้น 249
];

const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

export default function Home() {
  const { data: session } = useSession(); 
  const cartStore = useCartStore();

  // --- UI States ---
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'JERSEY' | 'CREW'>('ALL');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  
  // --- Data States ---
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  
  // State สำหรับเก็บข้อมูลลูกค้า (Auto-fill)
  const [userProfile, setUserProfile] = useState({ name: '', phone: '', address: '' });

  // --- Form States (Product Detail) ---
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [sleeve, setSleeve] = useState<'SHORT' | 'LONG'>('SHORT');
  const [customName, setCustomName] = useState('');
  const [customNumber, setCustomNumber] = useState('');

  // ป้องกัน Hydration Error
  useEffect(() => { setIsClient(true); }, []);

  // 🔄 1. Sync Down
  useEffect(() => {
    if (session?.user?.email) {
      // ดึงตะกร้า
      fetch(`${API_URL}?action=getCart`, { method: 'POST', body: JSON.stringify({ email: session.user.email }) })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success' && Array.isArray(data.cart) && data.cart.length > 0) {
             cartStore.setCart(data.cart);
          }
        })
        .catch(err => console.error("Load cart failed", err));

      // ดึงข้อมูล Profile
      fetch(`${API_URL}?action=getProfile`, { method: 'POST', body: JSON.stringify({ email: session.user.email }) })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success' && data.profile) {
            setUserProfile(data.profile);
          } else {
            setUserProfile(prev => ({ ...prev, name: session.user?.name || '' }));
          }
        })
        .catch(err => console.error("Load profile failed", err));
    }
  }, [session]);

  // 🔄 2. Sync Up
  useEffect(() => {
    if (!session?.user?.email) return;
    const timeoutId = setTimeout(() => {
       fetch(`${API_URL}?action=saveCart`, { 
         method: 'POST', 
         body: JSON.stringify({ 
           email: session.user?.email, 
           cart: cartStore.cart 
         }) 
       }).catch(err => console.error("Silent save error:", err)); 
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [cartStore.cart, session]);

  // --- Logic Functions ---

  const filteredProducts = activeTab === 'ALL' ? PRODUCTS : PRODUCTS.filter(p => p.type === activeTab);

  // 🔥 3. แก้ระบบคำนวณราคาให้ดูตามไซส์
  const calculatePrice = () => {
    if (!selectedProduct) return 0;
    
    let price = selectedProduct.price; // ราคาเริ่มต้น

    // ถ้าเลือกไซส์แล้ว ให้ดึงราคาตามตาราง
    if (size) {
      const type = selectedProduct.type; // JERSEY หรือ CREW
      // @ts-ignore
      const sizePrice = PRICE_TABLE[type]?.[size];
      if (sizePrice) {
        price = sizePrice;
      }
    }

    // บวกแขนยาว (เฉพาะ Jersey)
    if (selectedProduct.type === 'JERSEY' && sleeve === 'LONG') {
      price += 50;
    }

    return price * qty;
  };

  const fetchHistory = async () => {
    if (!session?.user?.email) return;
    setLoadingHistory(true);
    setIsHistoryOpen(true);
    try {
      const res = await fetch(`${API_URL}?action=getHistory`, { method: 'POST', body: JSON.stringify({ email: session.user.email }) }).then(r => r.json());
      if (res.status === 'success') setOrderHistory(res.history);
      else setOrderHistory([]);
    } catch { Swal.fire('Error', 'ดึงประวัติไม่ได้', 'error'); } 
    finally { setLoadingHistory(false); }
  };

  const handleEditProfile = async () => {
    if (!session) return;
    const { value: formValues } = await Swal.fire({
      title: 'แก้ไขข้อมูลติดต่อ',
      html: `
        <div class="text-left text-sm mb-1 text-slate-600 font-bold">ชื่อ-นามสกุล</div>
        <input id="swal-name" class="swal2-input m-0 mb-3 w-full" placeholder="ชื่อ-นามสกุล" value="${userProfile.name || ''}">
        <div class="text-left text-sm mb-1 text-slate-600 font-bold">เบอร์โทรศัพท์</div>
        <input id="swal-phone" class="swal2-input m-0 mb-3 w-full" placeholder="เบอร์โทรศัพท์" value="${userProfile.phone || ''}">
        <div class="text-left text-sm mb-1 text-slate-600 font-bold">ที่อยู่จัดส่ง</div>
        <textarea id="swal-address" class="swal2-textarea m-0 w-full h-24" placeholder="บ้านเลขที่, ถนน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์">${userProfile.address || ''}</textarea>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      preConfirm: () => ({
        name: (document.getElementById('swal-name') as HTMLInputElement).value,
        phone: (document.getElementById('swal-phone') as HTMLInputElement).value,
        address: (document.getElementById('swal-address') as HTMLInputElement).value
      })
    });

    if (formValues) {
      setUserProfile(formValues);
      fetch(`${API_URL}?action=saveProfile`, {
        method: 'POST',
        body: JSON.stringify({ email: session?.user?.email, data: formValues })
      });
      Swal.fire({ icon: 'success', title: 'บันทึกข้อมูลเรียบร้อย', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
    }
  };

  const handleAddToCart = () => {
    if (!session) {
      Swal.fire({ icon: 'warning', title: 'กรุณาเข้าสู่ระบบ', text: 'ต้อง Login ก่อนจึงจะสั่งซื้อได้', confirmButtonText: 'Login' })
        .then((r) => { if (r.isConfirmed) signIn('google'); });
      return;
    }
    if (!selectedProduct) return;
    if (!size) { Swal.fire('Error', 'กรุณาเลือกไซส์', 'error'); return; }
    if (selectedProduct.type === 'JERSEY' && (!customName || !customNumber)) { Swal.fire('Error', 'กรุณากรอกชื่อและเบอร์', 'error'); return; }

    const newItem: CartItem = { ...selectedProduct, qty, size, sleeve, customName, customNumber, total: calculatePrice() };
    cartStore.addToCart(newItem);
    setSelectedProduct(null); 
    Swal.fire({ icon: 'success', title: 'เพิ่มลงตะกร้าแล้ว', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false });
  };

  const submitOrder = async () => {
    if (cartStore.cart.length === 0) return;
    if (!session) return signIn('google');
    
    const { value: formValues } = await Swal.fire({
      title: 'ยืนยันการสั่งซื้อ',
      html: `
        <div class="text-left text-sm mb-1 font-bold">ชื่อ-นามสกุล</div>
        <input id="swal-name" class="swal2-input m-0 mb-3 w-full" placeholder="ชื่อ-นามสกุล" value="${userProfile.name || ''}">
        <div class="text-left text-sm mb-1 font-bold">เบอร์โทรศัพท์</div>
        <input id="swal-phone" class="swal2-input m-0 mb-3 w-full" placeholder="เบอร์โทรศัพท์" value="${userProfile.phone || ''}">
        <div class="text-left text-sm mb-1 font-bold">ที่อยู่จัดส่ง</div>
        <textarea id="swal-address" class="swal2-textarea m-0 w-full h-24" placeholder="ที่อยู่ (ถ้ามี)">${userProfile.address || ''}</textarea>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'ยืนยันและชำระเงิน',
      cancelButtonText: 'กลับ',
      preConfirm: () => ({
        name: (document.getElementById('swal-name') as HTMLInputElement).value,
        phone: (document.getElementById('swal-phone') as HTMLInputElement).value,
        address: (document.getElementById('swal-address') as HTMLInputElement).value
      })
    });

    if (formValues) {
      if (!formValues.name || !formValues.phone) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อและเบอร์โทร', 'error');

      setLoading(true);
      try {
        const res = await fetch(`${API_URL}?action=submitOrder`, {
          method: 'POST',
          body: JSON.stringify({
            customerName: formValues.name,
            customerPhone: formValues.phone,
            customerAddress: formValues.address,
            customerEmail: session.user?.email,
            totalAmount: cartStore.totalAmount(),
            cart: cartStore.cart
          })
        }).then(r => r.json());
        
        if (res.status === 'success') {
          setUserProfile(formValues);
          cartStore.clearCart(); 
          setIsCartOpen(false);
          setPaymentRef(res.ref);
        } else throw new Error(res.message);
      } catch (e) { 
        Swal.fire('Error', 'บันทึกคำสั่งซื้อไม่สำเร็จ', 'error'); 
        console.error(e);
      } 
      finally { setLoading(false); }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-20">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent cursor-pointer" onClick={() => window.location.reload()}>
          CS Shop
        </h1>
        
        <div className="flex items-center gap-4">
          {session ? (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col items-end">
                <p className="text-sm font-bold text-white leading-tight">{session.user?.name}</p>
                <button onClick={handleEditProfile} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-0.5 transition-colors">
                   แก้ไขที่อยู่ <UserPen size={10} />
                </button>
              </div>
              <img 
                src={session.user?.image && session.user.image !== "" ? session.user.image : `https://ui-avatars.com/api/?name=${session.user?.name || 'User'}&background=6366f1&color=fff`} 
                className="w-9 h-9 rounded-full border border-indigo-500 object-cover" 
                alt="Profile" referrerPolicy="no-referrer" 
                onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${session.user?.name || 'User'}&background=6366f1&color=fff`; }}
              />
              <button onClick={() => signOut()} className="text-xs text-red-400 border border-red-500/30 px-2 py-1 rounded-md hover:bg-red-500/10 transition-colors">Logout</button>
              <button onClick={fetchHistory} className="p-2 rounded-full hover:bg-slate-800 text-slate-200 transition" title="ประวัติการสั่งซื้อ"><History /></button>
            </div>
          ) : (
            <button onClick={() => signIn('google')} className="flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-full font-bold text-sm hover:bg-slate-200 transition-colors"><LogIn size={16} /> Login</button>
          )}

          <button onClick={() => setIsCartOpen(true)} className="relative p-2 rounded-full hover:bg-slate-800 transition-colors">
            <ShoppingCart className="text-slate-200" />
            {isClient && cartStore.cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-xs font-bold px-1.5 py-0.5 rounded-full animate-in zoom-in">{cartStore.cart.length}</span>}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 mt-8">
        <div className="flex justify-center gap-3 mb-8">
          {['ALL', 'JERSEY', 'CREW'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-2 rounded-full font-semibold transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{tab === 'ALL' ? 'ทั้งหมด' : tab}</button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((p) => (
            <div key={p.id} onClick={() => { setSelectedProduct(p); setQty(1); setSize(''); }} className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden hover:border-indigo-500/50 transition-all cursor-pointer group">
              <div className="aspect-4/3 bg-slate-800 flex items-center justify-center">
                <Shirt className="w-20 h-20 text-slate-600 group-hover:text-indigo-400 transition-transform group-hover:scale-110 duration-300" />
              </div>
              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold px-2 py-1 rounded bg-slate-800 text-indigo-300 border border-slate-700">{p.type}</span>
                  <span className="text-emerald-400 font-bold text-lg">฿{p.price}</span>
                </div>
                <h3 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition-colors">{p.name}</h3>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl p-6 relative shadow-2xl">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X /></button>
            <h2 className="text-2xl font-bold mb-1">{selectedProduct.name}</h2>
            <p className="text-indigo-400 font-semibold mb-6">฿{selectedProduct.price}</p>
            <div className="space-y-4">
              <div><label className="text-sm text-slate-400 mb-2 block">เลือกไซส์</label><div className="flex flex-wrap gap-2">{SIZES.map((s) => (<button key={s} onClick={() => setSize(s)} className={`w-10 h-10 rounded-lg font-bold text-sm border transition-all ${size === s ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>{s}</button>))}</div></div>
              {selectedProduct.type === 'JERSEY' && (
                <div className="space-y-4 pt-4 border-t border-slate-800">
                   <div className="flex gap-2 bg-slate-800 p-1 rounded-lg w-fit"><button onClick={() => setSleeve('SHORT')} className={`px-4 py-1.5 rounded-md text-sm transition ${sleeve === 'SHORT' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>แขนสั้น</button><button onClick={() => setSleeve('LONG')} className={`px-4 py-1.5 rounded-md text-sm transition ${sleeve === 'LONG' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>แขนยาว (+50)</button></div>
                   <input type="text" placeholder="ชื่อหลังเสื้อ (A-Z)" value={customName} onChange={(e) => setCustomName(e.target.value.toUpperCase())} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 placeholder-slate-500" />
                   <input type="number" placeholder="หมายเลข (0-99)" value={customNumber} onChange={(e) => setCustomNumber(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 placeholder-slate-500" />
                </div>
              )}
              <div className="flex items-center justify-between pt-4"><div className="flex items-center gap-3 bg-slate-800 rounded-lg p-1"><button onClick={() => setQty(Math.max(1, qty - 1))} className="p-2 text-slate-400 hover:text-white">-</button><span className="font-bold w-4 text-center">{qty}</span><button onClick={() => setQty(qty + 1)} className="p-2 text-slate-400 hover:text-white">+</button></div><div className="text-2xl font-bold text-emerald-400">฿{calculatePrice().toLocaleString()}</div></div>
              <button onClick={handleAddToCart} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg mt-4 transition-all active:scale-95">เพิ่มลงตะกร้า</button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {isCartOpen && (
        <>
          <div className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-60 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl p-6 flex flex-col animate-in slide-in-from-right">
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold flex items-center gap-2"><ShoppingCart className="text-indigo-400" /> ตะกร้าสินค้า</h2><button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-white"><X /></button></div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {cartStore.cart.length === 0 ? <div className="text-center text-slate-500 py-10">ตะกร้าว่างเปล่า</div> : cartStore.cart.map((item, idx) => (
                <div key={idx} className="bg-slate-800 p-4 rounded-xl border border-slate-700 relative group">
                  <button onClick={() => cartStore.removeFromCart(idx)} className="absolute top-2 right-2 text-red-400 opacity-0 group-hover:opacity-100 transition"><Trash2 size={18} /></button>
                  <h3 className="font-bold">{item.name}</h3><p className="text-sm text-slate-400">Size: {item.size} {item.sleeve === 'LONG' && '| แขนยาว'} {item.type === 'JERSEY' && `| ${item.customName} #${item.customNumber}`}</p><div className="flex justify-between items-end mt-2"><span className="text-xs bg-slate-700 px-2 py-1 rounded">x{item.qty}</span><span className="font-bold text-emerald-400">฿{item.total.toLocaleString()}</span></div>
                </div>
              ))}
            </div>
            <div className="pt-6 border-t border-slate-800 mt-4">
              <div className="flex justify-between items-center mb-4 text-xl font-bold"><span>รวมค่าสินค้า</span><span className="text-indigo-400">฿{cartStore.totalAmount().toLocaleString()}</span></div>
              <button onClick={submitOrder} disabled={loading || cartStore.cart.length === 0} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3.5 rounded-xl shadow-lg flex justify-center items-center gap-2 transition-all">{loading ? <Loader2 className="animate-spin" /> : 'ยืนยันการสั่งซื้อ'}</button>
            </div>
          </div>
        </>
      )}

      {/* History Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-3xl p-6 relative shadow-2xl flex flex-col max-h-[80vh]">
            <button onClick={() => setIsHistoryOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X /></button>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Package className="text-indigo-400" /> ประวัติการสั่งซื้อ</h2>
            <div className="overflow-y-auto pr-2 space-y-4 custom-scrollbar flex-1">
              {loadingHistory ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500 w-10 h-10" /></div> : orderHistory.length === 0 ? <div className="text-center text-slate-500 py-10">ไม่พบประวัติ</div> : orderHistory.map((order, idx) => {
                let items = []; try { items = JSON.parse(order.items); } catch(e){}
                return (
                  <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-3 border-b border-slate-700 pb-2"><div><span className="text-indigo-300 font-bold text-lg">{order.ref}</span><p className="text-xs text-slate-400">{new Date(order.date).toLocaleString('th-TH')}</p></div><div className={`px-3 py-1 rounded-full text-xs font-bold ${order.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-orange-500/10 text-orange-400 border-orange-500/30'} border`}>{order.status}</div></div>
                    <div className="space-y-2 mb-3">{items.map((item: any, i: number) => (<div key={i} className="flex justify-between text-sm text-slate-300"><span>{item.name} <span className="text-slate-500">x{item.qty}</span></span><span className="text-slate-400">฿{item.total}</span></div>))}</div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
                        <span className="text-sm text-slate-400">รวมสุทธิ</span>
                        <div className="text-right">
                            <span className="text-xl font-bold text-white block">฿{order.total}</span>
                            {order.status === 'PENDING' && (
                                <button onClick={() => { setIsHistoryOpen(false); setPaymentRef(order.ref); }} className="mt-1 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-500 transition-colors">
                                    ชำระเงิน
                                </button>
                            )}
                        </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentRef && (
        <PaymentModal 
          orderRef={paymentRef}
          onClose={() => setPaymentRef(null)}
          onSuccess={() => { setPaymentRef(null); fetchHistory(); }}
        />
      )}

    </div>
  );
}