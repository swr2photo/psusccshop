'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import type { Product } from '@/lib/config';
import {
  DEFAULT_SHIRT_NAME,
  getProductName,
  getProductShirtNameConfig,
  type ShirtNameConfig,
} from '@/lib/config';
import { getDisplaySizes, productRequiresSize, resolveProductUnitPrice, createCartLineId } from '@/lib/shop-constants';
import type { CartItem } from '@/lib/shop-constants';
import { useTranslation } from '@/hooks/useTranslation';

function normalizeShirtName(value: string, cfg: ShirtNameConfig = DEFAULT_SHIRT_NAME): string {
  let pattern = '';
  if (cfg.allowEnglish) pattern += 'a-zA-Z';
  if (cfg.allowThai) pattern += '\u0E00-\u0E7F';
  if (cfg.allowSpecialChars && cfg.allowedSpecialChars) {
    pattern += cfg.allowedSpecialChars.replace(/[\\\]\^\-]/g, '\\$&');
  }
  pattern += '\\s';
  const regex = new RegExp(`[^${pattern}]`, 'g');
  let result = value.replace(regex, '');
  if (cfg.autoUppercase) result = result.toUpperCase();
  return result.slice(0, cfg.maxLength).trim();
}

type Props = {
  product: Product;
  shirtNameConfig?: ShirtNameConfig;
  highlighted?: boolean;
  disabled?: boolean;
  onAddToCart: (item: CartItem) => void;
};

export default function FlagshipBuyBar({
  product,
  shirtNameConfig,
  highlighted,
  disabled,
  onAddToCart,
}: Props) {
  const { t, lang } = useTranslation();
  const [size, setSize] = useState('');
  const [customName, setCustomName] = useState('');
  const [customNumber, setCustomNumber] = useState('');
  const [isLongSleeve, setIsLongSleeve] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');

  const needsSize = productRequiresSize(product);
  const sizes = useMemo(
    () => getDisplaySizes(product, lang === 'en' ? 'Free Size' : 'ฟรีไซส์'),
    [product, lang],
  );
  const shirtCfg = useMemo(
    () => getProductShirtNameConfig(product, shirtNameConfig),
    [product, shirtNameConfig],
  );

  const unitPrice = resolveProductUnitPrice(
    product,
    size || (sizes[0] ?? ''),
    product.options?.hasLongSleeve ? isLongSleeve : null,
  );

  const triggerShake = (msg: string) => {
    setError(msg);
    setShake(true);
    window.setTimeout(() => setShake(false), 500);
  };

  const handleAdd = () => {
    if (disabled) return;

    if (needsSize && !size) {
      triggerShake(lang === 'en' ? 'Please select a size' : 'กรุณาเลือกไซส์');
      return;
    }

    const normalized = normalizeShirtName(customName, shirtCfg);

    if (product.options?.hasCustomName && !normalized) {
      triggerShake(t.product.customNameLabel);
      return;
    }
    if (product.options?.hasCustomName && normalized.length < shirtCfg.minLength) {
      triggerShake(`${t.product.customNameMinLength} ${shirtCfg.minLength}`);
      return;
    }
    if (product.options?.hasCustomNumber && !customNumber) {
      triggerShake(t.product.customNumberLabel);
      return;
    }

    const sizeToUse = needsSize ? size : '-';
    const price = resolveProductUnitPrice(
      product,
      sizeToUse,
      product.options?.hasLongSleeve ? isLongSleeve : null,
    );

    const item: CartItem = {
      id: createCartLineId(product.id),
      productId: product.id,
      productName: getProductName(product, lang),
      size: sizeToUse,
      quantity: 1,
      unitPrice: price,
      options: {
        customName: product.options?.hasCustomName ? normalized : undefined,
        customNumber: product.options?.hasCustomNumber ? customNumber : undefined,
        isLongSleeve: product.options?.hasLongSleeve ? isLongSleeve : undefined,
      },
    };

    setError('');
    onAddToCart(item);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        padding: '10px 12px calc(10px + env(safe-area-inset-bottom, 0px))',
        background: 'color-mix(in srgb, var(--glass-strong) 92%, transparent)',
        borderTop: '1px solid var(--glass-border)',
        backdropFilter: 'blur(18px)',
        boxShadow: highlighted
          ? '0 -8px 32px color-mix(in srgb, var(--primary) 18%, transparent)'
          : '0 -4px 24px rgba(0,0,0,0.25)',
        transition: 'box-shadow 0.35s ease',
      }}
    >
      <div
        style={{
          maxWidth: 920,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {(product.options?.hasCustomName || product.options?.hasCustomNumber || product.options?.hasLongSleeve) && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
            }}
          >
            {product.options?.hasCustomName && (
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={lang === 'en' ? t.product.customNameExampleEN : t.product.customNameExample}
                aria-label={t.product.customNameLabel}
                style={fieldStyle}
              />
            )}
            {product.options?.hasCustomNumber && (
              <input
                value={customNumber}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                  setCustomNumber(v);
                }}
                placeholder={t.product.customNumberExample}
                aria-label={t.product.customNumberLabel}
                inputMode="numeric"
                style={{ ...fieldStyle, width: 88 }}
              />
            )}
            {product.options?.hasLongSleeve && (
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={isLongSleeve}
                  onChange={(e) => setIsLongSleeve(e.target.checked)}
                />
                {t.product.longSleeveOption}
                {product.options.longSleevePrice != null && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    (+฿{product.options.longSleevePrice})
                  </span>
                )}
              </label>
            )}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {needsSize &&
              sizes.map((s) => {
                const selected = size === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    style={{
                      minWidth: 40,
                      height: 36,
                      padding: '0 10px',
                      borderRadius: 10,
                      border: selected
                        ? '1.5px solid var(--primary)'
                        : '1px solid var(--glass-border)',
                      background: selected ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'var(--surface)',
                      color: 'var(--foreground)',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                );
              })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.product.totalPrice}</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>
                ฿{unitPrice?.toLocaleString()}
              </div>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={disabled}
              style={{
                height: 44,
                padding: '0 18px',
                borderRadius: 'var(--btn-radius)',
                border: 'none',
                background: disabled ? 'var(--surface-3)' : 'var(--primary)',
                color: 'var(--primary-foreground)',
                fontWeight: 700,
                fontSize: 14,
                cursor: disabled ? 'not-allowed' : 'pointer',
                animation: shake ? 'flagship-shake 0.45s ease' : undefined,
                whiteSpace: 'nowrap',
              }}
            >
              {t.product.addToCart}
            </button>
          </div>
        </div>

        {error && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--warning)' }}>{error}</p>
        )}
      </div>

      <style>{`
        @keyframes flagship-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}

const fieldStyle: CSSProperties = {
  height: 36,
  padding: '0 10px',
  borderRadius: 10,
  border: '1px solid var(--glass-border)',
  background: 'var(--surface)',
  color: 'var(--foreground)',
  fontSize: 13,
  outline: 'none',
  minWidth: 120,
  flex: '1 1 120px',
};
