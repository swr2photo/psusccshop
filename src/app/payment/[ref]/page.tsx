'use client';

import { Box } from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import MobileBottomNav from '@/components/MobileBottomNav';
import PaymentModal from '@/components/PaymentModal';
import StorefrontNavbar from '@/components/StorefrontNavbar';

/**
 * Route bridge for links, bookmarks and notifications.
 * PaymentModal remains the single source of truth for payment behaviour.
 */
export default function StandalonePaymentPage() {
  const params = useParams();
  const router = useRouter();
  const ref = String(params?.ref || '');

  const returnToOrder = () => {
    router.replace(ref ? `/orders/${encodeURIComponent(ref)}` : '/orders');
  };

  return (
    <>
      <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background)', color: 'var(--foreground)' }}>
        <StorefrontNavbar />
        <MobileBottomNav activeKey="history" />
      </Box>
      <PaymentModal
        standalone
        orderRef={ref}
        onClose={returnToOrder}
        onSuccess={returnToOrder}
      />
    </>
  );
}
