// Lightweight SSR-safe placeholder while ShopStorefront loads (no MUI / Emotion)
export default function ShopStorefrontLoader() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--background, #fff)',
        color: 'var(--foreground, #1d1d1f)',
      }}
      aria-busy="true"
      aria-label="Loading shop"
    >
      <div
        style={{
          height: 56,
          borderBottom: '1px solid var(--glass-border, rgba(0,0,0,0.08))',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--surface, #f5f5f7)',
          }}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              width: 140,
              height: 14,
              borderRadius: 8,
              background: 'var(--surface, #f5f5f7)',
              marginBottom: 6,
            }}
          />
          <div
            style={{
              width: 90,
              height: 10,
              borderRadius: 6,
              background: 'var(--surface, #f5f5f7)',
            }}
          />
        </div>
      </div>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        <div
          style={{
            width: '100%',
            height: 200,
            borderRadius: 16,
            background: 'var(--surface, #f5f5f7)',
            marginBottom: 24,
          }}
        />
        <div
          style={{
            width: '100%',
            height: 40,
            borderRadius: 12,
            background: 'var(--surface, #f5f5f7)',
            marginBottom: 16,
          }}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 16,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 220,
                borderRadius: 16,
                background: 'var(--surface, #f5f5f7)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
