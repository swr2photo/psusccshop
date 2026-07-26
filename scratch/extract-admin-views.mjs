import fs from 'fs';

const path = 'src/app/admin/page.tsx';
const raw = fs.readFileSync(path, 'utf8');
const lines = raw.replace(/\r\n/g, '\n').split('\n');

function sliceLines(start1, end1Inclusive) {
  return lines.slice(start1 - 1, end1Inclusive).join('\n');
}

// Boundaries (1-based, inclusive end for section headers before next)
// Promo: 601-800
// Events: 801-1606
// Announcements: 1607-2724
// ProductCardItem + ProductsView + pickup: from 8223 to EOF helpers - need full Products section

const promo = sliceLines(601, 800);
const events = sliceLines(801, 1606);
const announcements = sliceLines(1607, 2724);

// Products: ProductCardItem helpers through end of file (pickup dialog included)
const productsStart = lines.findIndex((l) => l.includes('const ProductCardItem'));
const products = lines.slice(productsStart).join('\n');

// Shared header for extracted files
const sharedImports = `'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { JSX } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  FormControlLabel,
  FormControl,
  InputLabel,
  Checkbox,
  CircularProgress,
  Typography,
  Switch,
  Box,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  LayoutDashboard as Dashboard,
  ShoppingCart,
  Receipt,
  Settings,
  History,
  Plus as Add,
  Pencil as Edit,
  Trash2 as Delete,
  Save,
  X as Close,
  Search,
  Ticket,
  Sparkles,
  Megaphone as Announcement,
  Image as ImageIcon,
  FileText as FileTextIcon,
  ToggleLeft as ToggleOff,
  ToggleRight as ToggleOn,
  Upload,
  Calendar,
  PartyPopper,
  Tag,
  Clock as AccessTime,
  Circle as FiberManualRecord,
  Check,
  Package as Inventory,
  Store,
  Truck as LocalShipping,
  ShoppingBag as LocalMall,
  RefreshCw as Refresh,
} from 'lucide-react';
import { ShopConfig, Product, PromoCode, ShopEvent } from '@/lib/config';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import {
  ADMIN_THEME,
  adminGlassCardSx as glassCardSx,
  adminSecondaryButtonSx as secondaryButtonSx,
  adminGradientButtonSx as gradientButtonSx,
  adminInputSx as inputSx,
} from '@/lib/adminTheme';
import { apiFetch, uploadImageApi } from '@/lib/api-client';

`;

// The extracted slices already have their component code; strip the section comments and rewrite exports.

function writeView(file, body, exportName) {
  // Replace const X = React.memo with export const X = React.memo
  let out = body
    .replace(/^\/\/ =+.*$/gm, '')
    .replace(`const ${exportName} = React.memo`, `export const ${exportName} = React.memo`)
    .replace(`function ${exportName}`, `export function ${exportName}`);
  fs.writeFileSync(file, sharedImports + '\n' + out + '\n');
  console.log('wrote', file, 'lines', out.split('\n').length);
}

writeView('src/components/admin/PromoCodesView.tsx', promo, 'PromoCodesView');
writeView('src/components/admin/EventsView.tsx', events, 'EventsView');
writeView('src/components/admin/AnnouncementsView.tsx', announcements, 'AnnouncementsView');

// Products needs helpers above ProductCardItem - include isProductOpen, formatDateTime, STATUS stuff
const helpersStart = lines.findIndex((l) => l.includes('Check if product is currently open'));
const productsBlock = lines.slice(Math.max(0, helpersStart - 2)).join('\n');
let productsOut = productsBlock
  .replace(/^\/\/ =+.*$/gm, '')
  .replace('function ProductsView', 'export function ProductsView')
  .replace('const ProductCardItem', 'export const ProductCardItem');
fs.writeFileSync(
  'src/components/admin/ProductsView.tsx',
  sharedImports +
    `\nimport type { AdminOrder } from '@/lib/config';\n` +
    '\n' +
    productsOut +
    '\n',
);
console.log('wrote ProductsView.tsx');

// Remove extracted sections from page.tsx and add imports
let page = lines.join('\n');

// Remove promo through announcements (601-2724) — keep MAIN COMPONENT
const before = lines.slice(0, 600).join('\n');
const mainAndRest = lines.slice(2724).join('\n'); // from MAIN COMPONENT comment

// Remove ProductCardItem through EOF from mainAndRest — find SUB-COMPONENTS StatCard keep until ProductCardItem
const mainLines = mainAndRest.split('\n');
const productCardIdx = mainLines.findIndex((l) => l.includes('const ProductCardItem'));
const checkOpenIdx = mainLines.findIndex((l) => l.includes('Check if product is currently open'));
const cutFrom = checkOpenIdx > 0 ? checkOpenIdx - 5 : productCardIdx;
const pageWithoutProducts = mainLines.slice(0, cutFrom).join('\n');

const importBlock = `import { PromoCodesView } from '@/components/admin/PromoCodesView';
import { EventsView } from '@/components/admin/EventsView';
import { AnnouncementsView } from '@/components/admin/AnnouncementsView';
import { ProductsView } from '@/components/admin/ProductsView';
`;

let newPage = before + '\n\n' + pageWithoutProducts + '\n';
// Insert imports after ShopManagement import
newPage = newPage.replace(
  `import ShopManagement from '@/components/admin/ShopManagement';`,
  `import ShopManagement from '@/components/admin/ShopManagement';\n${importBlock}`,
);

fs.writeFileSync(path, newPage);
console.log('updated page.tsx, new length', newPage.split('\n').length);
