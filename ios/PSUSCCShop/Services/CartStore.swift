import SwiftUI

// MARK: - Cart Store

@MainActor
final class CartStore: ObservableObject {
    @Published var items: [CartItem] = []
    @Published var isLoading = false
    @Published var isSyncing = false

    private let api = APIClient.shared
    private var syncTask: Task<Void, Never>?

    var itemCount: Int {
        items.reduce(0) { $0 + $1.qty }
    }

    var subtotal: Double {
        items.reduce(0) { $0 + $1.total }
    }

    var isEmpty: Bool {
        items.isEmpty
    }

    // MARK: - Cart Operations

    func addItem(_ item: CartItem) {
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            items[index].qty += item.qty
            items[index].total = Double(items[index].qty) * items[index].price
        } else {
            items.append(item)
        }
        debouncedSync()
    }

    func removeItem(at offsets: IndexSet) {
        items.remove(atOffsets: offsets)
        debouncedSync()
    }

    func removeItem(id: String) {
        items.removeAll { $0.id == id }
        debouncedSync()
    }

    func updateQuantity(id: String, quantity: Int) {
        guard let index = items.firstIndex(where: { $0.id == id }) else { return }
        if quantity <= 0 {
            items.remove(at: index)
        } else {
            items[index].qty = quantity
            items[index].total = Double(quantity) * items[index].price
        }
        debouncedSync()
    }

    func clearCart() {
        items.removeAll()
        debouncedSync()
    }

    // MARK: - Cloud Sync

    func loadFromCloud(email: String) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let cloudCart = try await api.fetchCart(email: email)
            if !cloudCart.isEmpty {
                items = cloudCart
            }
        } catch {
            print("Failed to load cart: \(error)")
        }
    }

    private func debouncedSync() {
        syncTask?.cancel()
        syncTask = Task {
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
            await syncToCloud()
        }
    }

    private func syncToCloud() async {
        guard let email = AuthManager.shared.currentUser?.email else { return }
        isSyncing = true
        defer { isSyncing = false }

        do {
            try await api.saveCart(email: email, cart: items)
        } catch {
            print("Failed to sync cart: \(error)")
        }
    }
}

// MARK: - Theme Manager

@MainActor
final class ThemeManager: ObservableObject {
    @AppStorage("colorScheme") var selectedScheme: String = "system"

    var colorScheme: ColorScheme? {
        switch selectedScheme {
        case "light": return .light
        case "dark": return .dark
        default: return nil
        }
    }

    func setScheme(_ scheme: String) {
        selectedScheme = scheme
    }
}
