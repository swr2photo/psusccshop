const fs = require('fs');

const path = 'src/app/shop/[slug]/ShopStorefront.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldHeaderStart = `        <Box sx={{
          maxWidth: '1200px', mx: 'auto', px: 2, py: 1.5,
          display: 'flex', alignItems: 'center', gap: 2,
        }}>`;

const newHeaderStart = `        <Box sx={{
          maxWidth: '1200px', mx: 'auto', px: { xs: 1, md: 2 }, py: 1.5,
          display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1, md: 2 },
        }}>`;

content = content.replace(oldHeaderStart, newHeaderStart);

const oldTogglesStart = `          <ThemeToggle />
          <LanguageToggle />
          {/* Order History button */}
          {session?.user?.email && (
            <Tooltip title={lang === 'en' ? 'Order History' : 'ประวัติคำสั่งซื้อ'}>
              <IconButton
                onClick={() => setShowOrderHistory(true)}
                sx={{ color: 'var(--foreground)' }}
              >
                <Badge badgeContent={pendingPaymentCount} color="warning">
                  <History size={20} />
                </Badge>
              </IconButton>
            </Tooltip>
          )}`;

const newTogglesStart = `          {/* Desktop-only actions to prevent mobile navbar overflow */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: { sm: 0.5, md: 1 } }}>
            <ThemeToggle />
            <LanguageToggle />
            {/* Order History button */}
            {session?.user?.email && (
              <Tooltip title={lang === 'en' ? 'Order History' : 'ประวัติคำสั่งซื้อ'}>
                <IconButton
                  onClick={() => setShowOrderHistory(true)}
                  sx={{ color: 'var(--foreground)' }}
                >
                  <Badge badgeContent={pendingPaymentCount} color="warning">
                    <History size={20} />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}
          </Box>`;

content = content.replace(oldTogglesStart, newTogglesStart);

fs.writeFileSync(path, content, 'utf8');
console.log('Update ShopStorefront.tsx success');
