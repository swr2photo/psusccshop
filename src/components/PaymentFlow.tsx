"use client";

import { useCallback, useEffect, useState } from "react";
import PaymentModal from "./PaymentModal";

type PaymentFlowProps = {
  registerOpener: (opener: ((ref: string) => void) | null) => void;
  onPaymentSuccess: () => void;
};

export default function PaymentFlow({ registerOpener, onPaymentSuccess }: PaymentFlowProps) {
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => {
    setOpen(false);
    setPaymentRef(null);
  }, []);

  useEffect(() => {
    const opener = (ref: string) => {
      setPaymentRef(ref);
      setOpen(true);
    };

    registerOpener(opener);
    return () => registerOpener(null);
  }, [registerOpener]);

  if (!open || !paymentRef) return null;

  return (
    <PaymentModal
      orderRef={paymentRef}
      onClose={handleClose}
      onSuccess={() => {
        onPaymentSuccess();
      }}
    />
  );
}
