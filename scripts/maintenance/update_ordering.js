const fs = require('fs');
const path = 'src/app/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const orderDataState = `  const [orderData, setOrderData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    instagram: '',
    profileImage: '',
  });`;

// Remove the original orderData declaration
content = content.replace(orderDataState + '\n\n', '');
// If it didn't have two newlines:
content = content.replace(orderDataState + '\r\n\r\n', '');
content = content.replace(orderDataState + '\n', '');
content = content.replace(orderDataState, '');

// Insert it before useProductReviews
const targetUseProductReviews = `  const { reviews: selectedProductReviewsList } = useProductReviews(selectedProduct?.id, orderData.email);`;
content = content.replace(
  targetUseProductReviews,
  orderDataState + '\n\n' + targetUseProductReviews
);

fs.writeFileSync(path, content, 'utf8');
console.log('Moved orderData declaration above useProductReviews');
