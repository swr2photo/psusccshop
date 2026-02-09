import SwiftUI
import CoreImage.CIFilterBuiltins

struct PaymentView: View {
    @Environment(\.dismiss) var dismiss
    let orderRef: String

    @State private var paymentInfo: PaymentInfo?
    @State private var isLoading = true
    @State private var error: String?
    @State private var showImagePicker = false
    @State private var slipImage: UIImage?
    @State private var isUploading = false
    @State private var uploadSuccess = false
    @State private var copiedToClipboard = false

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("กำลังโหลดข้อมูลชำระเงิน...")
                } else if let error {
                    ErrorView(message: error) {
                        await loadPaymentInfo()
                    }
                } else if let info = paymentInfo {
                    paymentContent(info)
                }
            }
            .navigationTitle("ชำระเงิน")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("เสร็จ") { dismiss() }
                }
            }
            .task {
                await loadPaymentInfo()
            }
        }
    }

    @ViewBuilder
    private func paymentContent(_ info: PaymentInfo) -> some View {
        ScrollView {
            VStack(spacing: 24) {
                // Order Reference
                VStack(spacing: 8) {
                    Text("หมายเลขสั่งซื้อ")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(orderRef)
                        .font(.title2)
                        .fontWeight(.bold)
                        .monospaced()
                }
                .padding()

                // QR Code
                if let qrPayload = info.qrPayload {
                    VStack(spacing: 12) {
                        Text("สแกนจ่ายด้วย PromptPay")
                            .font(.headline)

                        QRCodeView(payload: qrPayload)
                            .frame(width: 250, height: 250)
                            .padding()
                            .background(.white, in: RoundedRectangle(cornerRadius: 16))
                            .shadow(color: .black.opacity(0.1), radius: 8)

                        Text(formatCurrency(info.finalAmount ?? 0))
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .foregroundStyle(.tint)
                    }
                }

                Divider()
                    .padding(.horizontal)

                // Bank Transfer Info
                VStack(alignment: .leading, spacing: 12) {
                    Text("ข้อมูลการโอน")
                        .font(.headline)

                    if let bankName = info.bankName {
                        InfoRow(label: "ธนาคาร", value: bankName)
                    }
                    if let accountName = info.accountName {
                        InfoRow(label: "ชื่อบัญชี", value: accountName)
                    }
                    if let accountNumber = info.accountNumber {
                        HStack {
                            InfoRow(label: "เลขที่บัญชี", value: accountNumber)
                            Button {
                                UIPasteboard.general.string = accountNumber
                                copiedToClipboard = true
                                Task {
                                    try? await Task.sleep(for: .seconds(2))
                                    copiedToClipboard = false
                                }
                            } label: {
                                Image(systemName: copiedToClipboard ? "checkmark" : "doc.on.doc")
                                    .font(.caption)
                            }
                        }
                    }
                }
                .padding()
                .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)

                // Price breakdown
                VStack(alignment: .leading, spacing: 8) {
                    if let base = info.baseAmount {
                        HStack {
                            Text("ค่าสินค้า")
                            Spacer()
                            Text(formatCurrency(base))
                        }
                    }
                    if let discount = info.discount, discount > 0 {
                        HStack {
                            Text("ส่วนลด")
                            Spacer()
                            Text("-\(formatCurrency(discount))")
                                .foregroundStyle(.green)
                        }
                    }
                    Divider()
                    HStack {
                        Text("ยอดชำระ")
                            .fontWeight(.bold)
                        Spacer()
                        Text(formatCurrency(info.finalAmount ?? 0))
                            .fontWeight(.bold)
                            .foregroundStyle(.tint)
                    }
                }
                .padding()
                .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)

                // Slip Upload
                if !(info.hasSlip ?? false) {
                    slipUploadSection
                } else {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                        Text("อัพโหลดสลิปแล้ว")
                            .foregroundStyle(.green)
                    }
                    .padding()
                }

                // Order Items
                if let cart = info.cart, !cart.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("รายการสินค้า")
                            .font(.headline)

                        ForEach(cart) { item in
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(item.productName ?? "")
                                        .font(.subheadline)
                                    HStack(spacing: 4) {
                                        if let size = item.size {
                                            Text(size)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                        if item.isLongSleeve ?? false {
                                            Text("แขนยาว")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                }
                                Spacer()
                                Text("×\(item.quantity ?? 1)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text(formatCurrency(item.unitPrice ?? 0))
                                    .font(.subheadline)
                            }
                        }
                    }
                    .padding()
                    .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal)
                }

                Spacer(minLength: 40)
            }
        }
    }

    // MARK: - Slip Upload

    private var slipUploadSection: some View {
        VStack(spacing: 12) {
            if let image = slipImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 200)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                if uploadSuccess {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                        Text("อัพโหลดสลิปสำเร็จ!")
                            .foregroundStyle(.green)
                    }
                } else {
                    Button {
                        Task { await uploadSlip() }
                    } label: {
                        HStack {
                            if isUploading {
                                ProgressView()
                                    .tint(.white)
                            }
                            Text(isUploading ? "กำลังอัพโหลด..." : "ยืนยันอัพโหลดสลิป")
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 10))
                        .foregroundStyle(.white)
                    }
                    .disabled(isUploading)
                }
            } else {
                Button {
                    showImagePicker = true
                } label: {
                    VStack(spacing: 8) {
                        Image(systemName: "photo.on.rectangle.angled")
                            .font(.title)
                        Text("อัพโหลดสลิปการโอน")
                            .font(.subheadline)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 100)
                    .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [8]))
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding(.horizontal)
        .sheet(isPresented: $showImagePicker) {
            ImagePicker(image: $slipImage)
        }
    }

    // MARK: - Actions

    private func loadPaymentInfo() async {
        isLoading = true
        error = nil

        do {
            paymentInfo = try await APIClient.shared.fetchPaymentInfo(ref: orderRef)
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    private func uploadSlip() async {
        guard let image = slipImage,
              let data = image.jpegData(compressionQuality: 0.8) else { return }

        isUploading = true

        do {
            let base64 = data.base64EncodedString()
            let url = try await APIClient.shared.uploadImage(base64: "data:image/jpeg;base64,\(base64)", filename: "slip_\(orderRef).jpg")

            // Update order with slip
            try await APIClient.shared.updateOrder(ref: orderRef, data: ["slip": url])
            uploadSuccess = true
        } catch {
            self.error = error.localizedDescription
        }

        isUploading = false
    }
}

// MARK: - Supporting Views

struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.subheadline)
                .fontWeight(.medium)
        }
    }
}

// MARK: - QR Code Generator

struct QRCodeView: View {
    let payload: String

    var body: some View {
        if let qrImage = generateQRCode(from: payload) {
            Image(uiImage: qrImage)
                .interpolation(.none)
                .resizable()
                .scaledToFit()
        } else {
            Image(systemName: "qrcode")
                .font(.system(size: 100))
                .foregroundStyle(.secondary)
        }
    }

    private func generateQRCode(from string: String) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()

        guard let data = string.data(using: .utf8) else { return nil }
        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("M", forKey: "inputCorrectionLevel")

        guard let outputImage = filter.outputImage else { return nil }

        let transform = CGAffineTransform(scaleX: 10, y: 10)
        let scaledImage = outputImage.transformed(by: transform)

        guard let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}

// MARK: - Image Picker

struct ImagePicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        picker.sourceType = .photoLibrary
        picker.allowsEditing = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: ImagePicker

        init(_ parent: ImagePicker) {
            self.parent = parent
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.image = image
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
