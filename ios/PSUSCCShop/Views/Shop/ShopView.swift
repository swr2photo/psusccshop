import SwiftUI

struct ShopView: View {
    @EnvironmentObject var cartStore: CartStore
    @State private var config: ShopConfig?
    @State private var isLoading = true
    @State private var error: String?
    @State private var searchText = ""
    @State private var selectedCategory: String?
    @State private var selectedProduct: Product?

    private var products: [Product] {
        guard let products = config?.products else { return [] }
        var filtered = products.filter { $0.isActive ?? true }

        if let category = selectedCategory {
            filtered = filtered.filter { $0.category == category || $0.type == category }
        }

        if !searchText.isEmpty {
            filtered = filtered.filter {
                $0.name.localizedCaseInsensitiveContains(searchText) ||
                ($0.description?.localizedCaseInsensitiveContains(searchText) ?? false)
            }
        }

        return filtered.sorted { ($0.sortOrder ?? 999) < ($1.sortOrder ?? 999) }
    }

    private var categories: [String] {
        let cats = Set((config?.products ?? []).compactMap { $0.category ?? $0.type })
        return Array(cats).sorted()
    }

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading shop...")
            } else if let error {
                ErrorView(message: error) {
                    await loadConfig()
                }
            } else {
                shopContent
            }
        }
        .navigationTitle("PSU SCC Shop")
        .searchable(text: $searchText, prompt: "ค้นหาสินค้า...")
        .refreshable {
            await loadConfig()
        }
        .task {
            await loadConfig()
        }
        .sheet(item: $selectedProduct) { product in
            ProductDetailView(product: product)
        }
    }

    @ViewBuilder
    private var shopContent: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                // Announcement
                if let announcement = config?.announcement,
                   announcement.enabled ?? false,
                   let text = announcement.text {
                    AnnouncementBanner(text: text, type: announcement.type)
                }

                // Shop Status
                if !(config?.isOpen ?? true) {
                    ShopClosedBanner(message: config?.closedMessage)
                }

                // Category Filter
                if !categories.isEmpty {
                    CategoryFilterView(
                        categories: categories,
                        selected: $selectedCategory
                    )
                }

                // Products Grid
                LazyVGrid(columns: [
                    GridItem(.flexible(), spacing: 12),
                    GridItem(.flexible(), spacing: 12)
                ], spacing: 12) {
                    ForEach(products) { product in
                        ProductCard(product: product)
                            .onTapGesture {
                                selectedProduct = product
                            }
                    }
                }
                .padding(.horizontal)

                if products.isEmpty {
                    ContentUnavailableView(
                        "ไม่พบสินค้า",
                        systemImage: "magnifyingglass",
                        description: Text("ลองค้นหาด้วยคำอื่น")
                    )
                }
            }
            .padding(.vertical)
        }
    }

    private func loadConfig() async {
        isLoading = config == nil
        error = nil

        do {
            config = try await APIClient.shared.fetchConfig()
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }
}

// MARK: - Announcement Banner

struct AnnouncementBanner: View {
    let text: String
    let type: String?

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: iconName)
                .foregroundStyle(tintColor)
            Text(text)
                .font(.subheadline)
                .fontWeight(.medium)
            Spacer()
        }
        .padding()
        .background(tintColor.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }

    var iconName: String {
        switch type {
        case "warning": return "exclamationmark.triangle.fill"
        case "error": return "xmark.circle.fill"
        case "success": return "checkmark.circle.fill"
        default: return "megaphone.fill"
        }
    }

    var tintColor: Color {
        switch type {
        case "warning": return .orange
        case "error": return .red
        case "success": return .green
        default: return .blue
        }
    }
}

// MARK: - Shop Closed Banner

struct ShopClosedBanner: View {
    let message: String?

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "storefront.fill")
                .font(.title)
                .foregroundStyle(.secondary)
            Text("ร้านปิดชั่วคราว")
                .font(.headline)
            if let message {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

// MARK: - Category Filter

struct CategoryFilterView: View {
    let categories: [String]
    @Binding var selected: String?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(title: "ทั้งหมด", isSelected: selected == nil) {
                    selected = nil
                }

                ForEach(categories, id: \.self) { category in
                    FilterChip(title: categoryDisplay(category), isSelected: selected == category) {
                        selected = category
                    }
                }
            }
            .padding(.horizontal)
        }
    }

    func categoryDisplay(_ category: String) -> String {
        switch category.uppercased() {
        case "APPAREL": return "เสื้อผ้า"
        case "MERCHANDISE": return "สินค้า"
        case "JERSEY": return "เสื้อแข่ง"
        case "CREW": return "เสื้อทีม"
        case "EVENT": return "กิจกรรม"
        case "CAMP_FEE": return "ค่ายาม"
        default: return category
        }
    }
}

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .fontWeight(isSelected ? .semibold : .regular)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.accentColor : Color(.systemGray6),
                           in: Capsule())
                .foregroundStyle(isSelected ? .white : .primary)
        }
    }
}

// MARK: - Product Card

struct ProductCard: View {
    let product: Product

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Image
            if let imageURL = product.primaryImage, let url = URL(string: imageURL) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        imagePlaceholder
                    default:
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    }
                }
                .frame(height: 180)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                imagePlaceholder
                    .frame(height: 180)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            // Info
            VStack(alignment: .leading, spacing: 4) {
                Text(product.name)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .lineLimit(2)

                Text(product.displayPrice)
                    .font(.headline)
                    .foregroundStyle(.tint)

                if !product.isAvailable {
                    Text("สินค้าหมด")
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                if let tags = product.customTags, !tags.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(tags.prefix(2), id: \.label) { tag in
                            Text(tag.label ?? "")
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.orange.opacity(0.2), in: Capsule())
                        }
                    }
                }
            }
        }
        .contentShape(Rectangle())
    }

    private var imagePlaceholder: some View {
        Rectangle()
            .fill(Color(.systemGray5))
            .overlay {
                Image(systemName: "tshirt.fill")
                    .font(.title)
                    .foregroundStyle(.secondary)
            }
    }
}

// MARK: - Error View

struct ErrorView: View {
    let message: String
    let retry: () async -> Void

    var body: some View {
        ContentUnavailableView {
            Label("เกิดข้อผิดพลาด", systemImage: "exclamationmark.triangle.fill")
        } description: {
            Text(message)
        } actions: {
            Button("ลองใหม่") {
                Task { await retry() }
            }
            .buttonStyle(.borderedProminent)
        }
    }
}
