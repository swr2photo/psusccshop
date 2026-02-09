# PSU SCC Shop - iOS Native App

## Overview
Native iOS companion app for PSU SCC Shop (ร้านค้าสโมสรนิสิต ม.อ.), built with **SwiftUI** targeting **iOS 26+**.

## Requirements
- **Xcode 26** (or later)
- **iOS 26+** SDK
- **macOS 26** (Tahoe) or later
- Apple Developer account (for Sign in with Apple & Push Notifications)

## Project Structure

```
ios/
├── Package.swift                          # Swift Package Manager config
├── PSUSCCShop/
│   ├── PSUSCCShop.swift                   # App entry point (@main)
│   ├── Info.plist                          # App configuration
│   ├── PSUSCCShop.entitlements            # Capabilities
│   ├── Models/
│   │   └── Models.swift                   # All data models (Product, Order, Cart, etc.)
│   ├── Services/
│   │   ├── APIClient.swift                # HTTP client for all API endpoints
│   │   ├── AuthManager.swift              # OAuth + Sign in with Apple + session mgmt
│   │   ├── CartStore.swift                # Cart state + cloud sync
│   │   ├── ChatManager.swift              # Support chat with polling
│   │   └── NotificationManager.swift      # APNs push notifications
│   ├── Views/
│   │   ├── ContentView.swift              # Main TabView controller
│   │   ├── Auth/
│   │   │   └── LoginView.swift            # Sign in screen (Apple, Google, LINE, FB)
│   │   ├── Shop/
│   │   │   ├── ShopView.swift             # Product catalog with filters
│   │   │   └── ProductDetailView.swift    # Product detail + add to cart
│   │   ├── Cart/
│   │   │   ├── CartView.swift             # Shopping cart
│   │   │   └── CheckoutView.swift         # Order submission form
│   │   ├── Payment/
│   │   │   └── PaymentView.swift          # PromptPay QR code + slip upload
│   │   ├── Orders/
│   │   │   └── OrderHistoryView.swift     # Order list + detail + tracking + refund
│   │   ├── Chat/
│   │   │   └── SupportChatView.swift      # Real-time support chat
│   │   ├── Profile/
│   │   │   └── ProfileView.swift          # User profile editor
│   │   └── Settings/
│   │       └── SettingsView.swift         # App settings + sign out
│   └── Resources/
│       ├── Localizable.xcstrings          # Localization (Thai + English)
│       └── Assets.xcassets/               # App icon + colors
```

## Features

### 🛍️ Product Catalog
- Browse products with category filters & search
- Product detail with size selection, variants, custom name/number
- Size chart with measurements

### 🛒 Shopping Cart
- Add/remove/update cart items
- Cloud sync with backend (debounced 2s)
- Real-time price calculation

### 💳 PromptPay QR Payment
- Native QR code generation from PromptPay payload
- Bank transfer info display
- Slip photo upload from camera/gallery

### 📦 Order History & Tracking
- View all orders with status badges
- Cancel/refund orders
- Track shipments with timeline
- Real-time status updates

### 🔔 Push Notifications
- APNs integration for order status updates
- Chat message notifications
- Deep linking to orders and chats

### 💬 Support Chat
- Real-time messaging with admin
- Chat history with unread badges
- Auto-polling for new messages (5s interval)
- System messages & read receipts

### 🔐 Authentication
- **Sign in with Apple** (native ASAuthorization)
- **Google, LINE, Facebook** OAuth (via ASWebAuthenticationSession)
- Secure session management with Keychain
- Cookie-based NextAuth session persistence

## Setup Instructions

### 1. Create Xcode Project
```bash
# Open in Xcode 26
open ios/PSUSCCShop.xcodeproj
```

Or create a new Xcode project and add the source files:
1. **File → New → Project → iOS → App**
2. Product Name: `PSUSCCShop`
3. Bundle ID: `com.psusccshop.ios`
4. Interface: **SwiftUI**
5. Language: **Swift**
6. Minimum Deployments: **iOS 26.0**

### 2. Add Source Files
Copy all files from `ios/PSUSCCShop/` into the Xcode project.

### 3. Configure Capabilities
In Xcode → Signing & Capabilities:
- ✅ **Sign in with Apple**
- ✅ **Push Notifications**
- ✅ **Associated Domains** → `applinks:psusccshop.vercel.app`
- ✅ **Keychain Sharing** → `com.psusccshop.ios`

### 4. Configure API URL
In `Services/APIClient.swift`, update `APIConfig.baseURL`:
```swift
#if DEBUG
return "http://localhost:3000"   // Your local dev server
#else
return "https://psusccshop.vercel.app"  // Production URL
#endif
```

### 5. Apple Developer Setup
1. Register App ID with **Sign in with Apple** capability
2. Generate APNs key (.p8) for push notifications
3. Configure **Associated Domains** in Apple Developer Portal
4. Update backend to handle iOS Apple Sign In tokens

### 6. Build & Run
```bash
xcodebuild -scheme PSUSCCShop -destination 'platform=iOS,name=iPhone' build
```

## Architecture

### State Management
- **AuthManager** → Singleton, manages OAuth sessions & Keychain
- **CartStore** → ObservableObject, local + cloud cart sync
- **ChatManager** → ObservableObject, chat state with polling
- **NotificationManager** → Singleton, APNs registration
- **ThemeManager** → AppStorage-based light/dark mode

### Networking
- **APIClient** → Generic async/await HTTP client
- Cookie-based authentication (NextAuth JWT sessions)
- All endpoints match the existing Next.js API

### Data Flow
```
View → EnvironmentObject → Service → APIClient → Backend API
                                         ↑
                                    Keychain (auth)
                                    AppStorage (prefs)
```

## iOS 26 Features Used
- SwiftUI `@Observable` macro support
- New `Tab` view builder syntax
- Enhanced `NavigationStack`
- `ContentUnavailableView` native component
- `symbolEffect` animations
- Liquid Glass material effects
- `ASWebAuthenticationSession` callback improvements

## Backend Requirements
The iOS app connects to the same Next.js API as the web app. No backend changes are required. The app uses:
- Cookie-based sessions (NextAuth)
- JSON API endpoints under `/api/*`
- PromptPay QR payload for native rendering
- Image upload via base64

## License
Private project for PSU Student Council Club.
