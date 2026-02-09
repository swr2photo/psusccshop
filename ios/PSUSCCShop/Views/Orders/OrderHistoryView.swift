import SwiftUI

struct OrderHistoryView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var orders: [OrderHistory] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var hasMore = false
    @State private var offset = 0
    @State private var selectedOrder: OrderHistory?

    private let limit = 20

    var body: some View {
        Group {
            if isLoading && orders.isEmpty {
                ProgressView("กำลังโหลดรายการ...")
            } else if let error, orders.isEmpty {
                ErrorView(message: error) {
                    await loadOrders()
                }
            } else if orders.isEmpty {
                ContentUnavailableView {
                    Label("ยังไม่มีรายการสั่งซื้อ", systemImage: "list.clipboard")
                } description: {
                    Text("เริ่มสั่งซื้อสินค้าได้เลย!")
                }
            } else {
                orderList
            }
        }
        .navigationTitle("ประวัติสั่งซื้อ")
        .refreshable {
            offset = 0
            await loadOrders(reset: true)
        }
        .task {
            await loadOrders()
        }
        .sheet(item: $selectedOrder) { order in
            OrderDetailView(order: order)
        }
    }

    private var orderList: some View {
        List {
            ForEach(orders) { order in
                OrderRow(order: order)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        selectedOrder = order
                    }
            }

            if hasMore {
                HStack {
                    Spacer()
                    Button("โหลดเพิ่ม") {
                        Task { await loadMore() }
                    }
                    .buttonStyle(.bordered)
                    Spacer()
                }
                .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
    }

    private func loadOrders(reset: Bool = false) async {
        guard let email = authManager.currentUser?.email else { return }
        if reset { offset = 0 }
        isLoading = true
        error = nil

        do {
            let response = try await APIClient.shared.fetchOrders(email: email, offset: offset, limit: limit)
            if reset {
                orders = response.history ?? []
            } else {
                orders = response.history ?? []
            }
            hasMore = response.hasMore ?? false
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    private func loadMore() async {
        offset += limit
        guard let email = authManager.currentUser?.email else { return }

        do {
            let response = try await APIClient.shared.fetchOrders(email: email, offset: offset, limit: limit)
            orders.append(contentsOf: response.history ?? [])
            hasMore = response.hasMore ?? false
        } catch {
            offset -= limit
        }
    }
}

// MARK: - Order Row

struct OrderRow: View {
    let order: OrderHistory

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(order.ref)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .monospaced()

                Spacer()

                StatusBadge(status: order.status)
            }

            if let date = order.date {
                Text(formatOrderDate(date))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            // Items preview
            let items = order.orderItems
            if !items.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(items.prefix(3)) { item in
                        Text("\(item.displayName) ×\(item.itemQuantity)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if items.count > 3 {
                        Text("...และอีก \(items.count - 3) รายการ")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if let total = order.total {
                HStack {
                    Spacer()
                    Text(formatCurrency(total))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }
            }

            // Tracking
            if let trackingNumber = order.trackingNumber {
                HStack(spacing: 4) {
                    Image(systemName: "shippingbox.fill")
                        .font(.caption)
                    Text(trackingNumber)
                        .font(.caption)
                        .monospaced()
                }
                .foregroundStyle(.blue)
            }
        }
        .padding(.vertical, 4)
    }

    private func formatOrderDate(_ dateStr: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: dateStr) ?? ISO8601DateFormatter().date(from: dateStr) else {
            return dateStr
        }

        let displayFormatter = DateFormatter()
        displayFormatter.locale = Locale(identifier: "th_TH")
        displayFormatter.dateStyle = .medium
        displayFormatter.timeStyle = .short
        return displayFormatter.string(from: date)
    }
}

// MARK: - Status Badge

struct StatusBadge: View {
    let status: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: iconName)
                .font(.caption2)
            Text(displayName)
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(backgroundColor.opacity(0.15), in: Capsule())
        .foregroundStyle(backgroundColor)
    }

    private var displayName: String {
        OrderStatus(rawValue: status.uppercased())?.displayName ?? status
    }

    private var iconName: String {
        switch status.uppercased() {
        case "COMPLETED", "DELIVERED": return "checkmark.circle.fill"
        case "SHIPPED": return "shippingbox.fill"
        case "READY": return "cube.box.fill"
        case "PAID": return "creditcard.fill"
        case "PENDING", "WAITING_PAYMENT", "AWAITING_PAYMENT", "UNPAID":
            return "clock.fill"
        case "CANCELLED": return "xmark.circle.fill"
        case "VERIFYING": return "magnifyingglass"
        case "REFUNDED", "REFUND_REQUESTED": return "arrow.uturn.backward.circle.fill"
        default: return "questionmark.circle"
        }
    }

    private var backgroundColor: Color {
        switch status.uppercased() {
        case "COMPLETED", "DELIVERED": return .green
        case "SHIPPED", "READY": return .blue
        case "PAID", "VERIFYING": return .orange
        case "CANCELLED", "REJECTED", "FAILED": return .red
        case "REFUNDED", "REFUND_REQUESTED": return .purple
        default: return .gray
        }
    }
}

// MARK: - Order Detail View

struct OrderDetailView: View {
    @Environment(\.dismiss) var dismiss
    let order: OrderHistory

    @State private var showPayment = false
    @State private var showTracking = false
    @State private var showRefund = false
    @State private var showCancelAlert = false
    @State private var isCancelling = false

    private var orderStatus: OrderStatus? {
        OrderStatus(rawValue: order.status.uppercased())
    }

    var body: some View {
        NavigationStack {
            List {
                // Status
                Section {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(order.ref)
                                .font(.title3)
                                .fontWeight(.bold)
                                .monospaced()
                            if let date = order.date {
                                Text(date)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        StatusBadge(status: order.status)
                    }
                }

                // Items
                Section("รายการสินค้า") {
                    ForEach(order.orderItems) { item in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.displayName)
                                    .font(.subheadline)
                                HStack(spacing: 4) {
                                    if let size = item.size {
                                        Text(size)
                                            .font(.caption)
                                    }
                                    if item.isLongSleeve ?? false {
                                        Text("แขนยาว")
                                            .font(.caption)
                                    }
                                    if let name = item.customName {
                                        Text("ชื่อ: \(name)")
                                            .font(.caption)
                                    }
                                    if let number = item.customNumber {
                                        Text("เบอร์: \(number)")
                                            .font(.caption)
                                    }
                                }
                                .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text("×\(item.itemQuantity)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if let price = item.unitPrice {
                                Text(formatCurrency(price))
                                    .font(.subheadline)
                            }
                        }
                    }
                }

                // Price
                Section("สรุปราคา") {
                    if let total = order.total {
                        HStack {
                            Text("ค่าสินค้า")
                            Spacer()
                            Text(formatCurrency(total))
                        }
                    }
                    if let fee = order.shippingFee, fee > 0 {
                        HStack {
                            Text("ค่าจัดส่ง")
                            Spacer()
                            Text(formatCurrency(fee))
                        }
                    }
                    if let discount = order.promoDiscount, discount > 0 {
                        HStack {
                            Text("ส่วนลด (\(order.promoCode ?? ""))")
                            Spacer()
                            Text("-\(formatCurrency(discount))")
                                .foregroundStyle(.green)
                        }
                    }
                }

                // Shipping
                if let trackingNumber = order.trackingNumber {
                    Section("การจัดส่ง") {
                        HStack {
                            VStack(alignment: .leading) {
                                Text("เลขพัสดุ")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text(trackingNumber)
                                    .font(.subheadline)
                                    .monospaced()
                            }
                            Spacer()
                            Button("ติดตามพัสดุ") {
                                showTracking = true
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                        }

                        if let provider = order.shippingProvider {
                            HStack {
                                Text("ผู้จัดส่ง")
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Text(provider)
                            }
                            .font(.subheadline)
                        }
                    }
                }

                // Refund
                if let refundStatus = order.refundStatus {
                    Section("การคืนเงิน") {
                        HStack {
                            Text("สถานะ")
                            Spacer()
                            StatusBadge(status: refundStatus)
                        }
                        if let reason = order.refundReason {
                            HStack {
                                Text("เหตุผล")
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Text(reason)
                            }
                            .font(.subheadline)
                        }
                        if let note = order.refundAdminNote {
                            Text("หมายเหตุ: \(note)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                // Actions
                Section {
                    if orderStatus?.isPayable ?? false {
                        Button {
                            showPayment = true
                        } label: {
                            Label("ชำระเงิน", systemImage: "creditcard.fill")
                        }
                    }

                    if orderStatus?.isCancelable ?? false {
                        Button(role: .destructive) {
                            showCancelAlert = true
                        } label: {
                            Label("ยกเลิกรายการ", systemImage: "xmark.circle.fill")
                        }
                    }

                    if orderStatus?.isRefundable ?? false {
                        Button {
                            showRefund = true
                        } label: {
                            Label("ขอคืนเงิน", systemImage: "arrow.uturn.backward.circle.fill")
                        }
                    }
                }
            }
            .navigationTitle("รายละเอียดออเดอร์")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ปิด") { dismiss() }
                }
            }
            .sheet(isPresented: $showPayment) {
                PaymentView(orderRef: order.ref)
            }
            .sheet(isPresented: $showTracking) {
                if let tracking = order.trackingNumber {
                    TrackingView(trackingNumber: tracking, provider: order.shippingProvider)
                }
            }
            .sheet(isPresented: $showRefund) {
                RefundRequestView(orderRef: order.ref)
            }
            .alert("ยกเลิกรายการ?", isPresented: $showCancelAlert) {
                Button("ยกเลิก", role: .cancel) {}
                Button("ยืนยัน", role: .destructive) {
                    Task { await cancelOrder() }
                }
            } message: {
                Text("คุณต้องการยกเลิกรายการ \(order.ref) ใช่หรือไม่?")
            }
        }
    }

    private func cancelOrder() async {
        isCancelling = true
        do {
            try await APIClient.shared.cancelOrder(ref: order.ref)
            dismiss()
        } catch {
            // Handle error
        }
        isCancelling = false
    }
}

// MARK: - Tracking View

struct TrackingView: View {
    @Environment(\.dismiss) var dismiss
    let trackingNumber: String
    let provider: String?

    @State private var trackingInfo: TrackingInfo?
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("กำลังติดตามพัสดุ...")
                } else if let error {
                    ErrorView(message: error) {
                        await loadTracking()
                    }
                } else if let info = trackingInfo {
                    trackingContent(info)
                }
            }
            .navigationTitle("ติดตามพัสดุ")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ปิด") { dismiss() }
                }
            }
            .task {
                await loadTracking()
            }
        }
    }

    @ViewBuilder
    private func trackingContent(_ info: TrackingInfo) -> some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text(info.trackingNumber ?? trackingNumber)
                        .font(.title3)
                        .fontWeight(.bold)
                        .monospaced()

                    HStack {
                        StatusBadge(status: info.status ?? "unknown")
                        Spacer()
                        if let provider = info.provider {
                            Text(provider)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    if let statusThai = info.statusTextThai {
                        Text(statusThai)
                            .font(.subheadline)
                    }

                    if let estimated = info.estimatedDelivery {
                        HStack {
                            Image(systemName: "calendar")
                                .foregroundStyle(.secondary)
                            Text("คาดว่าจะถึง: \(estimated)")
                                .font(.caption)
                        }
                    }
                }
            }

            if let events = info.events, !events.isEmpty {
                Section("ประวัติการจัดส่ง") {
                    ForEach(events) { event in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Circle()
                                    .fill(event == events.first ? Color.accentColor : Color(.systemGray4))
                                    .frame(width: 8, height: 8)
                                Text(event.descriptionThai ?? event.description ?? "")
                                    .font(.subheadline)
                                    .fontWeight(event == events.first ? .semibold : .regular)
                            }

                            HStack {
                                if let location = event.location {
                                    Text(location)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if let timestamp = event.timestamp {
                                    Text(timestamp)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(.leading, 16)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }

            // External Tracking Links
            Section {
                if let url = info.trackingUrl, let trackURL = URL(string: url) {
                    Link(destination: trackURL) {
                        Label("เปิดเว็บติดตามพัสดุ", systemImage: "safari")
                    }
                }
                if let url = info.track123Url, let trackURL = URL(string: url) {
                    Link(destination: trackURL) {
                        Label("ติดตามบน Track123", systemImage: "globe")
                    }
                }
            }
        }
    }

    private func loadTracking() async {
        isLoading = true
        error = nil

        do {
            trackingInfo = try await APIClient.shared.trackShipment(
                trackingNumber: trackingNumber,
                provider: provider
            )
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }
}

// MARK: - Refund Request View

struct RefundRequestView: View {
    @Environment(\.dismiss) var dismiss
    let orderRef: String

    @State private var refundInfo: RefundInfoResponse?
    @State private var selectedReason = ""
    @State private var details = ""
    @State private var bankName = ""
    @State private var bankAccount = ""
    @State private var accountName = ""
    @State private var isSubmitting = false
    @State private var error: String?
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            Form {
                if isLoading {
                    Section {
                        ProgressView()
                    }
                } else {
                    Section("เหตุผลขอคืนเงิน") {
                        if let reasons = refundInfo?.reasons {
                            Picker("เหตุผล", selection: $selectedReason) {
                                Text("เลือกเหตุผล").tag("")
                                ForEach(reasons, id: \.self) { reason in
                                    Text(reason).tag(reason)
                                }
                            }
                        }
                        TextField("รายละเอียดเพิ่มเติม", text: $details, axis: .vertical)
                            .lineLimit(3...6)
                    }

                    Section("บัญชีรับเงินคืน") {
                        if let banks = refundInfo?.banks {
                            Picker("ธนาคาร", selection: $bankName) {
                                Text("เลือกธนาคาร").tag("")
                                ForEach(banks, id: \.self) { bank in
                                    Text(bank).tag(bank)
                                }
                            }
                        }
                        TextField("เลขที่บัญชี", text: $bankAccount)
                            .keyboardType(.numberPad)
                        TextField("ชื่อบัญชี", text: $accountName)
                    }

                    if let total = refundInfo?.totalAmount {
                        Section("ยอดคืนเงิน") {
                            Text(formatCurrency(total))
                                .font(.title3)
                                .fontWeight(.bold)
                        }
                    }

                    if let error {
                        Section {
                            Text(error)
                                .foregroundStyle(.red)
                        }
                    }
                }
            }
            .navigationTitle("ขอคืนเงิน")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ยกเลิก") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("ส่งคำขอ") {
                        Task { await submitRefund() }
                    }
                    .disabled(!canSubmit || isSubmitting)
                }
            }
            .task {
                await loadRefundInfo()
            }
        }
    }

    private var canSubmit: Bool {
        !selectedReason.isEmpty && !bankName.isEmpty &&
        !bankAccount.isEmpty && !accountName.isEmpty
    }

    private func loadRefundInfo() async {
        isLoading = true
        do {
            refundInfo = try await APIClient.shared.fetchRefundInfo(ref: orderRef)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func submitRefund() async {
        isSubmitting = true
        error = nil

        do {
            try await APIClient.shared.requestRefund(
                ref: orderRef,
                reason: selectedReason,
                details: details.isEmpty ? nil : details,
                bankName: bankName,
                bankAccount: bankAccount,
                accountName: accountName,
                amount: refundInfo?.totalAmount
            )
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }

        isSubmitting = false
    }
}
