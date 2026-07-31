import { useState, useCallback } from 'react';
import type { Product } from '@/lib/config';

export interface ProductContext {
  shopId?: string;
  shopSlug?: string;
  isOpen?: boolean;
}

export function useHomePageDialogs() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductContext, setSelectedProductContext] = useState<ProductContext>({});
  const [productDialogOpen, setProductDialogOpen] = useState(false);

  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [loginScreenOpen, setLoginScreenOpen] = useState(false);
  const [supportChatOpen, setSupportChatOpen] = useState(false);

  const openProductDialog = useCallback((product: Product, context?: ProductContext) => {
    setSelectedProduct(product);
    setSelectedProductContext(context || {});
    setProductDialogOpen(true);
  }, []);

  const closeProductDialog = useCallback(() => {
    setProductDialogOpen(false);
    setSelectedProduct(null);
    setSelectedProductContext({});
  }, []);

  return {
    selectedProduct,
    selectedProductContext,
    productDialogOpen,
    openProductDialog,
    closeProductDialog,

    cartDrawerOpen,
    setCartDrawerOpen,
    checkoutOpen,
    setCheckoutOpen,
    orderHistoryOpen,
    setOrderHistoryOpen,
    profileModalOpen,
    setProfileModalOpen,
    loginScreenOpen,
    setLoginScreenOpen,
    supportChatOpen,
    setSupportChatOpen,
  };
}
