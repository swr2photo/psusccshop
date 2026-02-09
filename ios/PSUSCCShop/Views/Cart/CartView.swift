import SwiftUI

struct CartView: View {
    @EnvironmentObject var cartStore: CartStore
    @Environment(\.dismiss) var dismiss
    @State private var showCheckout = false

    var body: some View {
        NavigationStack {
            Group {
                if cartStore.isEmpty {
                    emptyCartView
                } else {
                    cartContent
                }
            }
            .navigationTitle("ตะกร้าสินค้า")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ปิด") { dismiss() }
                }
                if !cartStore.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("ล้าง", role: .destructive) {
                            cartStore.clearCart()
                        }
                    }
                }
            }
            .sheet(isPresented: $showCheckout) {
                CheckoutView()
            }
        }
    }

    private var emptyCartView: some View {
        ContentUnavailableView {
            Label("ตะกร้าว่าง", systemImage: "cart")
        } description: {
            Text("เริ่มเลือกซื้อสินค้าได้เลย!")
        } actions: {
            Button("ไปหน้าร้าน") {
                dismiss()
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private var cartContent: some View {
        VStack(spacing: 0) {
            List {
                ForEach(cartStore.items) { item in
                    CartItemRow(item: item)
                }
                .onDelete(perform: cartStore.removeItem)
            }
            .listStyle(.plain)

            // Summary & Checkout
            VStack(spacing: 12) {
                Divider()

                HStack {
                    Text("รวมทั้งหมด (\(cartStore.itemCount) ชิ้น)")
                        .font(.headline)
                    Spacer()
                    Text(formatCurrency(cartStore.subtotal))
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundStyle(.tint)
                }
                .padding(.horizontal)

                if cartStore.isSyncing {
                    HStack {
                        ProgressView()
                            .controlSize(.small)
                        Text("กำลังบันทึก...")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Button {
                    showCheckout = true
                } label: {
                    Text("ดำเนินการสั่งซื้อ")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(.white)
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
            .background(.regularMaterial)
        }
    }
}

// MARK: - Cart Item Row

struct CartItemRow: View {
    @EnvironmentObject var cartStore: CartStore
    let item: CartItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Product image placeholder
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.systemGray5))
                .frame(width: 60, height: 60)
                .overlay {
                    Image(systemName: "tshirt.fill")
                        .foregroundStyle(.secondary)
                }

            VStack(alignment: .leading, spacing: 4) {
                Text(item.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(2)

                HStack(spacing: 4) {
                    if !item.size.isEmpty {
                        TagView(text: item.size)
                    }
                    if item.sleeve == "LONG" {
                        TagView(text: "แขนยาว")
                    }
                }

                if let name = item.customName {
                    Text("ชื่อ: \(name)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let number = item.customNumber {
                    Text("เบอร์: \(number)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                HStack {
                    // Quantity controls
                    HStack(spacing: 8) {
                        Button {
                            cartStore.updateQuantity(id: item.id, quantity: item.qty - 1)
                        } label: {
                            Image(systemName: "minus.circle")
                                .foregroundStyle(.secondary)
                        }

                        Text("\(item.qty)")
                            .font(.subheadline)
                            .frame(minWidth: 20)

                        Button {
                            cartStore.updateQuantity(id: item.id, quantity: item.qty + 1)
                        } label: {
                            Image(systemName: "plus.circle")
                                .foregroundStyle(.tint)
                        }
                    }

                    Spacer()

                    Text(formatCurrency(item.total))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }
                .padding(.top, 4)
            }
        }
        .padding(.vertical, 4)
    }
}

struct TagView: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption2)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color(.systemGray5), in: Capsule())
    }
}
