#!/usr/bin/env node
/** Move 'use client' before apiFetch import (migration script side-effect fix). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

const files = [
  'app/shop/ShopDirectory.tsx',
  'components/NotificationPrompt.tsx',
  'components/admin/EmailManagement.tsx',
  'components/admin/ShopManagement.tsx',
  'components/admin/SupportChatPanel.tsx',
  'components/admin/UserLogsView.tsx',
  'components/SupportChatWidget.tsx',
  'components/PasskeyManager.tsx',
  'components/PasskeyLoginButton.tsx',
  'hooks/usePushNotification.ts',
];

for (const rel of files) {
  const filePath = path.join(root, rel);
  let src = fs.readFileSync(filePath, 'utf8');
  if (!src.includes("import { apiFetch }")) continue;

  src = src.replace(/^import \{ apiFetch \} from '@\/lib\/api-client';\r?\n/, '');
  const useClientMatch = src.match(/^(['"]use client['"];?\r?\n)/);
  if (useClientMatch) {
    src = src.replace(/^(['"]use client['"];?\r?\n)/, '');
    src = `'use client';\n\nimport { apiFetch } from '@/lib/api-client';\n${src}`;
  } else {
    src = `'use client';\n\nimport { apiFetch } from '@/lib/api-client';\n${src}`;
  }

  fs.writeFileSync(filePath, src);
  console.log('Fixed', rel);
}
