import SwiftUI

struct CheckoutView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var cartStore: CartStore
    @Environment(\.dismiss) var dismiss

    @State private var customerName = ""
    @State private var customerPhone = ""
    @State private var customerAddress = ""
    @State private var customerInstagram = ""
    @State private var promoCode = ""
    @State private var promoDiscount: Double = 0
    @State private var promoValid: Bool?
    @State private var promoError: String?
    @State private var selectedShippingOption: ShippingOption?
    @State private var shippingOptions: [ShippingOption] = []
    @State private var shippingFee: Double = 0
    @State private var isSubmitting = false
    @State private var orderRef: String?
    @State private var error: String?
    @State private var showPayment = false
    @State private var profile: UserProfile?

    private var totalAmount: Double {
        cartStore.subtotal + shippingFee - promoDiscount
    }

    var body: some View {
        NavigationStack {
            Form {
                // Order Summary
                Section("สรุปรายการ") {
                    ForEach(cartStore.items) { item in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(item.displayName)
                                    .font(.subheadline)
                                Text("×\(item.qty)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(formatCurrency(item.total))
                                .font(.subheadline)
                        }
                    }
                }

                // Customer Info
                Section("ข้อมูลผู้สั่งซื้อ") {
                    TextField("ชื่อ-นามสกุล", text: $customerName)
                        .textContentType(.name)
                    TextField("เบอร์โทรศัพท์", text: $customerPhone)
                        .textContentType(.telephoneNumber)
                        .keyboardType(.phonePad)
                    TextField("ที่อยู่จัดส่ง", text: $customerAddress, axis: .vertical)
                        .textContentType(.fullStreetAddress)
                        .lineLimit(3...6)
                    TextField("Instagram (ถ้ามี)", text: $customerInstagram)
                }

                // Shipping
                if !shippingOptions.isEmpty {
                    Section("การจัดส่ง") {
                        ForEach(shippingOptions) { option in
                            Button {
                                selectedShippingOption = option
                                shippingFee = option.baseFee ?? 0
                            } label: {
                                HStack {
                                    VStack(alignment: .leading) {
                                        Text(option.name)
                                            .font(.subheadline)
                                        if let desc = option.description {
                                            Text(desc)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                        if let est = option.estimatedDays {
                                            Text("\(est.min ?? 0)-\(est.max ?? 0) วัน")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                    Spacer()
                                    if option.baseFee ?? 0 > 0 {
                                        Text(formatCurrency(option.baseFee ?? 0))
                                            .font(.subheadline)
                                    } else {
                                        Text("ฟรี")
                                            .font(.subheadline)
                                            .foregroundStyle(.green)
                                    }
                                    if selectedShippingOption?.id == option.id {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(.tint)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                // Promo Code
                Section("โค้ดส่วนลด") {
                    HStack {
                        TextField("กรอกโค้ดส่วนลด", text: $promoCode)
                            .textInputAutocapitalization(.characters)
                        Button("ใช้") {
                            Task { await validatePromo() }
                        }
                        .disabled(promoCode.isEmpty)
                    }

                    if let error = promoError {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                    if promoValid == true {
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                            Text("ส่วนลด \(formatCurrency(promoDiscount))")
                                .font(.subheadline)
                                .foregroundStyle(.green)
                        }
                    }
                }

                // Total
                Section("สรุปราคา") {
                    HStack {
                        Text("ค่าสินค้า")
                        Spacer()
                        Text(formatCurrency(cartStore.subtotal))
                    }
                    if shippingFee > 0 {
                        HStack {
                            Text("ค่าจัดส่ง")
                            Spacer()
                            Text(formatCurrency(shippingFee))
                        }
                    }
                    if promoDiscount > 0 {
                        HStack {
                            Text("ส่วนลด")
                            Spacer()
                            Text("-\(formatCurrency(promoDiscount))")
                                .foregroundStyle(.green)
                        }
                    }
                    HStack {
                        Text("รวมทั้งหมด")
                            .font(.headline)
                        Spacer()
                        Text(formatCurrency(totalAmount))
                            .font(.title3)
                            .fontWeight(.bold)
                            .foregroundStyle(.tint)
                    }
                }

                // Error
                if let error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("สั่งซื้อ")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ยกเลิก") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    Task { await submitOrder() }
                } label: {
                    HStack {
                        if isSubmitting {
                            ProgressView()
                                .tint(.white)
                        }
                        Text(isSubmitting ? "กำลังสั่งซื้อ..." : "ยืนยันสั่งซื้อ")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(canSubmit ? Color.accentColor : Color.gray,
                               in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(.white)
                }
                .disabled(!canSubmit || isSubmitting)
                .padding()
                .background(.regularMaterial)
            }
            .task {
                await loadInitialData()
            }
            .sheet(isPresented: $showPayment) {
                if let ref = orderRef {
                    PaymentView(orderRef: ref)
                }
            }
        }
    }

    private var canSubmit: Bool {
        !customerName.isEmpty && !customerPhone.isEmpty &&
        !customerAddress.isEmpty && !cartStore.isEmpty
    }

    private func loadInitialData() async {
        // Load profile
        if let email = authManager.currentUser?.email {
            if let profile = try? await APIClient.shared.fetchProfile(email: email) {
                self.profile = profile
                if customerName.isEmpty { customerName = profile.name ?? "" }
                if customerPhone.isEmpty { customerPhone = profile.phone ?? "" }
                if customerAddress.isEmpty { customerAddress = profile.address ?? "" }
                if customerInstagram.isEmpty { customerInstagram = profile.instagram ?? "" }
            }
        }

        // Load shipping options
        if let config = try? await APIClient.shared.fetchShippingOptions() {
            shippingOptions = (config.options ?? []).filter { $0.enabled ?? false }
            if let defaultId = config.defaultOptionId {
                selectedShippingOption = shippingOptions.first { $0.id == defaultId }
            }
            if selectedShippingOption == nil {
                selectedShippingOption = shippingOptions.first
            }
            shippingFee = selectedShippingOption?.baseFee ?? 0
        }
    }

    private func validatePromo() async {
        guard !promoCode.isEmpty else { return }
        promoError = nil
        promoValid = nil

        do {
            let result = try await APIClient.shared.validatePromo(code: promoCode, subtotal: cartStore.subtotal)
            if result.valid ?? false {
                promoValid = true
                promoDiscount = result.discount ?? 0
            } else {
                promoValid = false
                promoError = result.error ?? "โค้ดไม่ถูกต้อง"
            }
        } catch {
            promoError = error.localizedDescription
        }
    }

    private func submitOrder() async {
        guard canSubmit else { return }
        isSubmitting = true
        error = nil

        let order = SubmitOrderRequest(
            customerName: customerName,
            customerEmail: authManager.currentUser?.email ?? "",
            customerPhone: customerPhone,
            customerAddress: customerAddress,
            customerInstagram: customerInstagram.isEmpty ? nil : customerInstagram,
            cart: cartStore.items,
            totalAmount: totalAmount,
            shippingOptionId: selectedShippingOption?.id,
            paymentOptionId: nil,
            shippingFee: shippingFee > 0 ? shippingFee : nil,
            promoCode: promoValid == true ? promoCode : nil,
            promoDiscount: promoDiscount > 0 ? promoDiscount : nil
        )

        do {
            let ref = try await APIClient.shared.submitOrder(order)
            orderRef = ref
            cartStore.clearCart()
            showPayment = true
        } catch {
            self.error = error.localizedDescription
        }

        isSubmitting = false
    }
}
