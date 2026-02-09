import SwiftUI

struct ProductDetailView: View {
    @EnvironmentObject var cartStore: CartStore
    @Environment(\.dismiss) var dismiss

    let product: Product

    @State private var selectedSize: String = ""
    @State private var selectedVariant: ProductVariant?
    @State private var quantity = 1
    @State private var customName = ""
    @State private var customNumber = ""
    @State private var isLongSleeve = false
    @State private var customFieldValues: [String: String] = [:]
    @State private var currentImageIndex = 0
    @State private var showSizeChart = false
    @State private var addedToCart = false

    private var unitPrice: Double {
        var price = product.sizePricing?[selectedSize] ?? product.basePrice
        if isLongSleeve, let extra = product.options?.longSleevePrice {
            price += extra
        }
        if let variant = selectedVariant {
            price = variant.price
        }
        return price
    }

    private var totalPrice: Double {
        unitPrice * Double(quantity)
    }

    private var canAddToCart: Bool {
        if product.options?.requiresSize ?? true, selectedSize.isEmpty { return false }
        if product.options?.hasCustomName ?? false, customName.isEmpty { return false }
        return product.isAvailable
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    // Image Gallery
                    imageGallery

                    VStack(alignment: .leading, spacing: 20) {
                        // Title & Price
                        headerSection

                        Divider()

                        // Size Selection
                        if product.options?.requiresSize ?? true {
                            sizeSection
                        }

                        // Variants
                        if let variants = product.variants, !variants.isEmpty {
                            variantSection(variants)
                        }

                        // Sleeve Option
                        if product.options?.hasLongSleeve ?? false {
                            sleeveSection
                        }

                        // Custom Name & Number
                        if product.options?.hasCustomName ?? false {
                            customNameSection
                        }

                        // Custom Fields
                        if let fields = product.options?.customFields, !fields.isEmpty {
                            customFieldsSection(fields)
                        }

                        // Quantity
                        quantitySection

                        // Description
                        if let description = product.description {
                            descriptionSection(description)
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle(product.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ปิด") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                addToCartButton
            }
            .sheet(isPresented: $showSizeChart) {
                SizeChartView()
            }
        }
    }

    // MARK: - Image Gallery

    @ViewBuilder
    private var imageGallery: some View {
        let images = product.images ?? [product.coverImage].compactMap { $0 }

        if !images.isEmpty {
            TabView(selection: $currentImageIndex) {
                ForEach(images.indices, id: \.self) { index in
                    if let url = URL(string: images[index]) {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .scaledToFit()
                            default:
                                Rectangle()
                                    .fill(Color(.systemGray5))
                                    .overlay { ProgressView() }
                            }
                        }
                        .tag(index)
                    }
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .automatic))
            .frame(height: 350)
            .background(Color(.systemGray6))
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(product.name)
                .font(.title2)
                .fontWeight(.bold)

            HStack(alignment: .firstTextBaseline) {
                Text(formatCurrency(unitPrice))
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundStyle(.tint)

                if quantity > 1 {
                    Text("× \(quantity) = \(formatCurrency(totalPrice))")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            if let stock = product.stock {
                Text("เหลือ \(stock) ชิ้น")
                    .font(.caption)
                    .foregroundStyle(stock < 5 ? .red : .secondary)
            }

            if let tags = product.customTags, !tags.isEmpty {
                HStack(spacing: 6) {
                    ForEach(tags, id: \.label) { tag in
                        Text(tag.label ?? "")
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.orange.opacity(0.15), in: Capsule())
                    }
                }
            }
        }
    }

    // MARK: - Size Selection

    private var sizeSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("ไซส์")
                    .font(.headline)
                Spacer()
                Button("ตารางไซส์") {
                    showSizeChart = true
                }
                .font(.caption)
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 5), spacing: 8) {
                ForEach(ShirtSize.allCases, id: \.rawValue) { size in
                    let sizeStr = size.rawValue
                    let hasPrice = product.sizePricing?[sizeStr] != nil || (product.options?.requiresSize ?? true)

                    if hasPrice {
                        Button {
                            selectedSize = sizeStr
                        } label: {
                            VStack(spacing: 2) {
                                Text(sizeStr)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                if let price = product.sizePricing?[sizeStr], price != product.basePrice {
                                    Text(formatCurrency(price))
                                        .font(.caption2)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                selectedSize == sizeStr ? Color.accentColor : Color(.systemGray6),
                                in: RoundedRectangle(cornerRadius: 8)
                            )
                            .foregroundStyle(selectedSize == sizeStr ? .white : .primary)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Variant Selection

    private func variantSection(_ variants: [ProductVariant]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("รูปแบบ")
                .font(.headline)

            ForEach(variants.filter { $0.isActive ?? true }) { variant in
                Button {
                    selectedVariant = variant
                } label: {
                    HStack {
                        if let imageURL = variant.image, let url = URL(string: imageURL) {
                            AsyncImage(url: url) { image in
                                image.resizable().scaledToFill()
                            } placeholder: {
                                Color(.systemGray5)
                            }
                            .frame(width: 44, height: 44)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                        }

                        VStack(alignment: .leading) {
                            Text(variant.name)
                                .font(.subheadline)
                            Text(formatCurrency(variant.price))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        if selectedVariant?.id == variant.id {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.tint)
                        }
                    }
                    .padding(10)
                    .background(
                        selectedVariant?.id == variant.id ? Color.accentColor.opacity(0.1) : Color(.systemGray6),
                        in: RoundedRectangle(cornerRadius: 8)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Sleeve Option

    private var sleeveSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("แขนเสื้อ")
                .font(.headline)

            HStack(spacing: 12) {
                Button {
                    isLongSleeve = false
                } label: {
                    Text("แขนสั้น")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(!isLongSleeve ? Color.accentColor : Color(.systemGray6),
                                   in: RoundedRectangle(cornerRadius: 8))
                        .foregroundStyle(!isLongSleeve ? .white : .primary)
                }

                Button {
                    isLongSleeve = true
                } label: {
                    VStack(spacing: 2) {
                        Text("แขนยาว")
                        if let extra = product.options?.longSleevePrice {
                            Text("+\(formatCurrency(extra))")
                                .font(.caption2)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(isLongSleeve ? Color.accentColor : Color(.systemGray6),
                               in: RoundedRectangle(cornerRadius: 8))
                    .foregroundStyle(isLongSleeve ? .white : .primary)
                }
            }
        }
    }

    // MARK: - Custom Name/Number

    private var customNameSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("ชื่อ-เบอร์บนเสื้อ")
                .font(.headline)

            if product.options?.hasCustomName ?? false {
                TextField("ชื่อบนเสื้อ", text: $customName)
                    .textFieldStyle(.roundedBorder)
            }

            if product.options?.hasCustomNumber ?? false {
                TextField("เบอร์บนเสื้อ", text: $customNumber)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.numberPad)
            }
        }
    }

    // MARK: - Custom Fields

    private func customFieldsSection(_ fields: [ProductCustomField]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("ข้อมูลเพิ่มเติม")
                .font(.headline)

            ForEach(fields) { field in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(field.label)
                            .font(.subheadline)
                        if field.required ?? false {
                            Text("*")
                                .foregroundStyle(.red)
                        }
                    }

                    if field.type == "select", let options = field.options {
                        Picker(field.label, selection: Binding(
                            get: { customFieldValues[field.id] ?? "" },
                            set: { customFieldValues[field.id] = $0 }
                        )) {
                            Text("เลือก...").tag("")
                            ForEach(options, id: \.self) { option in
                                Text(option).tag(option)
                            }
                        }
                        .pickerStyle(.menu)
                    } else {
                        TextField(field.placeholder ?? field.label,
                                 text: Binding(
                                     get: { customFieldValues[field.id] ?? "" },
                                     set: { customFieldValues[field.id] = $0 }
                                 ))
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(field.type == "number" ? .numberPad :
                                     field.type == "email" ? .emailAddress :
                                     field.type == "phone" ? .phonePad : .default)
                    }
                }
            }
        }
    }

    // MARK: - Quantity

    private var quantitySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("จำนวน")
                .font(.headline)

            HStack(spacing: 16) {
                Button {
                    if quantity > 1 { quantity -= 1 }
                } label: {
                    Image(systemName: "minus.circle.fill")
                        .font(.title2)
                        .foregroundStyle(quantity > 1 ? .tint : .secondary)
                }
                .disabled(quantity <= 1)

                Text("\(quantity)")
                    .font(.title3)
                    .fontWeight(.semibold)
                    .frame(minWidth: 40)

                Button {
                    let max = product.maxPerOrder ?? 10
                    if quantity < max { quantity += 1 }
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                }
            }
        }
    }

    // MARK: - Description

    private func descriptionSection(_ description: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("รายละเอียด")
                .font(.headline)
            Text(description)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Add to Cart Button

    private var addToCartButton: some View {
        VStack(spacing: 0) {
            Divider()
            HStack(spacing: 16) {
                VStack(alignment: .leading) {
                    Text("รวม")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(formatCurrency(totalPrice))
                        .font(.title3)
                        .fontWeight(.bold)
                }

                Button {
                    addToCart()
                } label: {
                    HStack {
                        Image(systemName: addedToCart ? "checkmark" : "cart.badge.plus")
                        Text(addedToCart ? "เพิ่มแล้ว!" : "เพิ่มลงตะกร้า")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(canAddToCart ? Color.accentColor : Color.gray, in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(.white)
                }
                .disabled(!canAddToCart)
            }
            .padding()
        }
        .background(.regularMaterial)
    }

    private func addToCart() {
        let item = CartItem(
            id: "\(product.id)_\(selectedSize)_\(isLongSleeve ? "LONG" : "SHORT")_\(UUID().uuidString.prefix(6))",
            name: product.name,
            type: product.type ?? "OTHER",
            category: product.category,
            subType: product.subType,
            price: unitPrice,
            qty: quantity,
            size: selectedSize,
            sleeve: isLongSleeve ? "LONG" : "SHORT",
            customName: customName.isEmpty ? nil : customName,
            customNumber: customNumber.isEmpty ? nil : customNumber,
            total: totalPrice,
            selectedVariant: selectedVariant,
            customFieldValues: customFieldValues.isEmpty ? nil : customFieldValues,
            variants: product.variants,
            customFields: product.options?.customFields
        )

        cartStore.addItem(item)
        addedToCart = true

        Task {
            try? await Task.sleep(for: .seconds(1.5))
            dismiss()
        }
    }
}

// MARK: - Size Chart

struct SizeChartView: View {
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(ShirtSize.allCases, id: \.rawValue) { size in
                    HStack {
                        Text(size.rawValue)
                            .font(.headline)
                            .frame(width: 50, alignment: .leading)
                        Spacer()
                        VStack(alignment: .trailing) {
                            Text("รอบอก: \(size.measurements.chest) นิ้ว")
                                .font(.subheadline)
                            Text("ความยาว: \(size.measurements.length) นิ้ว")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("ตารางไซส์")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ปิด") { dismiss() }
                }
            }
        }
    }
}
