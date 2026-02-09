import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var cartStore: CartStore
    @State private var selectedTab: AppTab = .shop
    @State private var showCart = false
    @State private var showProfile = false

    enum AppTab: Hashable {
        case shop, orders, chat, settings
    }

    var body: some View {
        Group {
            if authManager.isLoading {
                LoadingView()
            } else if !authManager.isAuthenticated {
                LoginView()
            } else {
                mainTabView
            }
        }
        .animation(.smooth, value: authManager.isAuthenticated)
    }

    @ViewBuilder
    private var mainTabView: some View {
        TabView(selection: $selectedTab) {
            SwiftUI.Tab("Shop", systemImage: "bag.fill", value: AppTab.shop) {
                NavigationStack {
                    ShopView()
                        .toolbar {
                            ToolbarItem(placement: .topBarTrailing) {
                                cartButton
                            }
                            ToolbarItem(placement: .topBarLeading) {
                                profileButton
                            }
                        }
                }
            }

            SwiftUI.Tab("Orders", systemImage: "list.clipboard.fill", value: AppTab.orders) {
                NavigationStack {
                    OrderHistoryView()
                }
            }

            SwiftUI.Tab("Chat", systemImage: "bubble.left.and.bubble.right.fill", value: AppTab.chat) {
                NavigationStack {
                    SupportChatView()
                }
            }

            SwiftUI.Tab("Settings", systemImage: "gearshape.fill", value: AppTab.settings) {
                NavigationStack {
                    SettingsView()
                }
            }
        }
        .sheet(isPresented: $showCart) {
            CartView()
        }
        .sheet(isPresented: $showProfile) {
            ProfileView()
        }
    }

    private var cartButton: some View {
        Button {
            showCart = true
        } label: {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "cart.fill")
                    .font(.title3)
                if cartStore.itemCount > 0 {
                    Text("\(cartStore.itemCount)")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                        .frame(minWidth: 18, minHeight: 18)
                        .background(Color.red, in: .circle)
                        .offset(x: 8, y: -8)
                }
            }
        }
    }

    private var profileButton: some View {
        Button {
            showProfile = true
        } label: {
            if let imageURL = authManager.currentUser?.image,
               let url = URL(string: imageURL) {
                AsyncImage(url: url) { image in
                    image.resizable()
                        .scaledToFill()
                } placeholder: {
                    Image(systemName: "person.circle.fill")
                }
                .frame(width: 30, height: 30)
                .clipShape(.circle)
            } else {
                Image(systemName: "person.circle.fill")
                    .font(.title3)
            }
        }
    }
}

// MARK: - Loading View

struct LoadingView: View {
    var body: some View {
        VStack(spacing: 20) {
            ProgressView()
                .controlSize(.large)
            Text("PSU SCC Shop")
                .font(.title2)
                .fontWeight(.semibold)
            Text("Loading...")
                .foregroundStyle(.secondary)
        }
    }
}
