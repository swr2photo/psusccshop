const fs = require('fs');
const path = 'src/app/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Update useProductReviews
content = content.replace(
  'const { reviews: selectedProductReviewsList } = useProductReviews(selectedProduct?.id);',
  'const { reviews: selectedProductReviewsList } = useProductReviews(selectedProduct?.id, orderData.email);'
);

// Update apiFetch for selectedProduct.id
content = content.replace(
  'const freshRes = await apiFetch(`/api/reviews?productId=${encodeURIComponent(selectedProduct.id)}`);',
  'const freshRes = await apiFetch(`/api/reviews?productId=${encodeURIComponent(selectedProduct.id)}${orderData.email ? `&viewerEmail=${encodeURIComponent(orderData.email)}` : \'\'}`);'
);

// Update apiFetch for selectedProduct?.id || ''
content = content.replace(
  'const freshRes = await apiFetch(`/api/reviews?productId=${encodeURIComponent(selectedProduct?.id || \'\')}`);',
  'const freshRes = await apiFetch(`/api/reviews?productId=${encodeURIComponent(selectedProduct?.id || \'\')}${orderData.email ? `&viewerEmail=${encodeURIComponent(orderData.email)}` : \'\'}`);'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed viewerEmail in page.tsx');
