/**
 * Wire AdminShell into admin/page.tsx — replace MUI header+drawer shell.
 */
import fs from 'fs';

const path = 'src/app/admin/page.tsx';
let src = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

if (src.includes('<AdminShell')) {
  console.log('AdminShell already wired');
  process.exit(0);
}

// 1) Imports
const importNeedle = `import LanguageToggle from '@/components/LanguageToggle';
import { useTranslation } from '@/hooks/useTranslation';
`;
const importInsert = `import LanguageToggle from '@/components/LanguageToggle';
import { useTranslation } from '@/hooks/useTranslation';
import { AdminShell, type AdminNavGroup } from '@/components/admin/AdminShell';
import {
  Select as UiSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
`;
if (!src.includes(importNeedle)) {
  console.error('import needle not found');
  process.exit(1);
}
src = src.replace(importNeedle, importInsert);

// 2) navGroups before return of authenticated UI
const navBlock = `
  const adminNavGroups: AdminNavGroup[] = [
    {
      category: t.admin.catMain,
      items: [
        { icon: <Dashboard size={18} />, label: t.admin.navDashboard, idx: 0, color: '#a5b4fc', show: true },
        { icon: <ShoppingCart size={18} />, label: t.admin.navProducts, idx: 1, color: '#fbbf24', show: canManageProducts },
        { icon: <Receipt size={18} />, label: t.admin.navOrders, idx: 2, color: '#34d399', badge: pendingCount, show: canManageOrders },
      ],
    },
    {
      category: t.admin.catManage,
      items: [
        { icon: <QrCodeScanner size={18} />, label: t.admin.navPickup, idx: 3, color: '#06b6d4', show: canManagePickup },
        { icon: <LocalShipping size={18} />, label: t.admin.navTracking, idx: 12, color: '#fb923c', show: canManageTracking },
        { icon: <Refresh size={18} />, label: t.admin.navRefunds, idx: 13, color: '#c084fc', show: canManageRefunds },
      ],
    },
    {
      category: t.admin.catComms,
      items: [
        { icon: <SupportAgent size={18} />, label: t.admin.navSupport, idx: 4, color: '#ec4899', show: canManageSupport },
        { icon: <NotificationsActive size={18} />, label: t.admin.navAnnounce, idx: 5, color: '#f472b6', show: canManageAnnouncement },
        { icon: <Send size={18} />, label: t.admin.navEmail, idx: 7, color: '#10b981', show: canSendEmail },
        { icon: <Sparkles size={18} />, label: t.admin.navEvents, idx: 14, color: '#fbbf24', show: canManageEvents },
        { icon: <Ticket size={18} />, label: t.admin.navPromo, idx: 15, color: '#34c759', show: canManagePromoCodes },
        { icon: <Radio size={18} />, label: t.admin.navLive, idx: 16, color: '#ef4444', show: true },
      ],
    },
    {
      category: t.admin.catSettings,
      items: [
        { icon: <Settings size={18} />, label: t.admin.navShopSettings, idx: 6, color: '#60a5fa', show: canManageShop || canManageSheet || isSuperAdminUser },
        { icon: <LocalShipping size={18} />, label: t.admin.navShipping, idx: 10, color: '#a78bfa', show: canManageShipping },
        { icon: <AttachMoney size={18} />, label: t.admin.navPayment, idx: 11, color: '#22d3ee', show: canManagePayment },
      ],
    },
    {
      category: t.admin.catAudit,
      items: [
        { icon: <Groups size={18} />, label: t.admin.navUserLogs, idx: 8, color: '#f97316', show: isSuperAdminUser },
        { icon: <Store size={18} />, label: t.admin.navShops, idx: 17, color: '#c084fc', show: isSuperAdminUser },
        { icon: <History size={18} />, label: t.admin.navSystemLogs, idx: 9, color: '#64748b', show: isSuperAdminUser },
      ],
    },
  ];

  const shopSwitcher = myShops.length > 0 ? (
    <UiSelect value={selectedShopId} onValueChange={setSelectedShopId}>
      <SelectTrigger className="w-full bg-muted/40">
        <SelectValue placeholder="ร้านค้า" />
      </SelectTrigger>
      <SelectContent>
        {isSuperAdminUser && (
          <SelectItem value="all">
            <span className="inline-flex items-center gap-2"><Store size={16} />ทุกร้านค้า</span>
          </SelectItem>
        )}
        {myShops.map((shop) => (
          <SelectItem key={shop.id} value={shop.id}>
            <span className="inline-flex items-center gap-2"><Store size={16} />{shop.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </UiSelect>
  ) : null;

`;

const returnMarker = `\n  return (\n    <Box\n      sx={{\n        display: 'flex',\n        flexDirection: 'column',\n        minHeight: '100vh',`;
const returnIdx = src.indexOf(returnMarker);
if (returnIdx === -1) {
  console.error('return marker not found');
  process.exit(1);
}
src = src.slice(0, returnIdx) + '\n' + navBlock + src.slice(returnIdx);

// 3) Replace outer shell opening through Main Content Box opening
const shellStart = `  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: \`radial-gradient(ellipse at top, rgba(99,102,241,0.08) 0%, transparent 50%),
                     radial-gradient(ellipse at bottom right, rgba(6,182,212,0.06) 0%, transparent 50%),
                     var(--background)\`,
        color: ADMIN_THEME.text,
        position: 'relative',
      }}
    >
      <ConfirmDialog />
      <AlertDialog />`;

const shellStartIdx = src.indexOf(shellStart);
if (shellStartIdx === -1) {
  console.error('shell start not found');
  process.exit(1);
}

const mainContentMarker = `        {/* Main Content */}
        <Box sx={{ 
          flex: 1, 
          p: { xs: 2, md: 3 }, 
          overflow: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 3,
          minHeight: 0,
        }}>`;
const mainIdx = src.indexOf(mainContentMarker, shellStartIdx);
if (mainIdx === -1) {
  console.error('main content marker not found');
  process.exit(1);
}

const shellOpen = `  return (
    <>
      <ConfirmDialog />
      <AlertDialog />
      {isDataLoading && (
        <div className="fixed inset-x-0 top-0 z-[9999] h-[3px] overflow-hidden bg-[var(--glass-bg)]">
          <div
            className="h-full w-[40%] animate-pulse"
            style={{
              background: 'linear-gradient(90deg, transparent, #8b5cf6, #3b82f6, transparent)',
            }}
          />
          {(sectionsLoading?.config || sectionsLoading?.orders) && (
            <p className="fixed top-1.5 right-3 z-[10000] rounded bg-black/45 px-2 py-0.5 text-[0.65rem] text-[var(--text-muted)]">
              {sectionsLoading.config && sectionsLoading.orders
                ? t.admin.loadingConfigOrders
                : sectionsLoading.config
                  ? t.admin.loadingConfig
                  : t.admin.loadingOrders}
            </p>
          )}
        </div>
      )}
      <AdminShell
        title={t.admin.title}
        brand={t.admin.brand}
        roleLabel={t.admin.role}
        userName={session?.user?.name}
        userImage={session?.user?.image}
        saving={saving}
        savingLabel={t.admin.saving}
        readyLabel={t.admin.ready}
        statusTime={
          lastSavedTime
            ? lastSavedTime.toLocaleTimeString(lang === 'en' ? 'en-US' : 'th-TH', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : null
        }
        navGroups={adminNavGroups}
        activeTab={activeTab}
        onNavigate={setActiveTab}
        onLogout={() => setLogoutConfirmOpen(true)}
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={setSidebarOpen}
        isDesktop={isDesktop}
        shopSwitcher={shopSwitcher}
      >
        <div className="flex min-h-0 flex-col gap-6">`;

src = src.slice(0, shellStartIdx) + shellOpen + src.slice(mainIdx + mainContentMarker.length);

// 4) Close AdminShell instead of two Box closings before Slip Viewer
const closeNeedle = `        </Box>
      </Box>

      {/* Slip Viewer Dialog */}`;
const closeReplace = `        </div>
      </AdminShell>

      {/* Slip Viewer Dialog */}`;
if (!src.includes(closeNeedle)) {
  console.error('close needle not found');
  process.exit(1);
}
src = src.replace(closeNeedle, closeReplace);

// 5) Outer close: was </Box> before ); of AdminPage — change last AdminPage closing Box to fragment
// The AdminPage ends with logout dialog then </Box>\n  );
const endNeedle = `      </Dialog>
    </Box>
  );
}

// ============== SUB-COMPONENTS ==============`;
const endReplace = `      </Dialog>
    </>
  );
}

// ============== SUB-COMPONENTS ==============`;
if (!src.includes(endNeedle)) {
  console.error('end needle not found');
  process.exit(1);
}
src = src.replace(endNeedle, endReplace);

// LanguageToggle may be unused in page now — keep import for login screen if used
if (!src.includes('<LanguageToggle')) {
  src = src.replace(`import LanguageToggle from '@/components/LanguageToggle';\n`, '');
}

fs.writeFileSync(path, src);
console.log('Wired AdminShell successfully');
