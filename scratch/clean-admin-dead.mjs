import fs from 'fs';

const p = 'src/app/admin/page.tsx';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

s = s.replace(/const SettingToggleRow = \(\{ label, description, checked, onChange \}[\s\S]*?\n\);\n\n/, '');

s = s.replace(/\nconst StatCard = \(\{ label, value, trend, icon, gradient \}[\s\S]*$/, '\n');

const noPerm = `const NoPermissionView = ({ permission }: { permission: string }): JSX.Element => (
    <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[20px] bg-red-500/10">
        <Lock size={40} color="#ef4444" />
      </div>
      <p className="mb-1 text-xl font-bold text-[var(--foreground)]">ไม่มีสิทธิ์เข้าถึง</p>
      <p className="mb-2 text-sm text-[var(--text-muted)]">คุณไม่มีสิทธิ์ในการ{permission}</p>
      <p className="text-xs text-[var(--text-muted)]">กรุณาติดต่อ Super Admin เพื่อขอสิทธิ์เพิ่มเติม</p>
    </div>
  );`;

s = s.replace(
  /const NoPermissionView = \(\{ permission \}: \{ permission: string \}\): JSX\.Element => \(\n    <Box sx=\{\{[\s\S]*?<\/Box>\n  \);/,
  noPerm,
);

fs.writeFileSync(p, s);
console.log('lines', s.split('\n').length);
console.log('has SettingToggle', s.includes('SettingToggleRow'));
console.log('has StatCard', s.includes('StatCard'));
console.log('has StatusChip', s.includes('StatusChip'));
console.log('has @mui', s.includes('@mui/material'));
console.log('NoPermission ok', s.includes('min-h-[300px]'));
