import Foundation

// MARK: - API Response Envelope

struct APIResponse<T: Decodable>: Decodable {
    let status: String
    let data: T?
    let message: String?
    let error: APIErrorDetail?
    let ref: String?
}

struct APIErrorDetail: Decodable {
    let code: String?
    let status: Int?
}

// MARK: - User & Auth

struct SessionUser: Codable, Identifiable {
    var id: String?
    let name: String?
    let email: String?
    let image: String?
}

struct AuthSession: Decodable {
    let user: SessionUser?
    let accessToken: String?
    let error: String?
}

// MARK: - Shop Config

struct ShopConfig: Decodable {
    let isOpen: Bool
    let closeDate: String?
    let openDate: String?
    let closedMessage: String?
    let paymentEnabled: Bool?
    let paymentDisabledMessage: String?
    let nameValidation: NameValidationConfig?
    let shirtNameConfig: ShirtNameConfig?
    let products: [Product]?
    let announcement: Announcement?
    let announcements: [AnnouncementItem]?
    let socialMediaNews: [SocialMediaNews]?
    let bankAccount: BankAccount?
    let pickup: PickupConfig?
    let events: [EventItem]?
}

struct NameValidationConfig: Decodable {
    let maxLength: Int?
    let allowedPattern: String?
    let errorMessage: String?
}

struct ShirtNameConfig: Decodable {
    let maxLength: Int?
    let pattern: String?
}

struct Announcement: Decodable {
    let text: String?
    let type: String?
    let enabled: Bool?
    let link: String?
}

struct AnnouncementItem: Decodable, Identifiable {
    var id: String { text ?? UUID().uuidString }
    let text: String?
    let type: String?
    let enabled: Bool?
    let link: String?
    let startDate: String?
    let endDate: String?
}

struct SocialMediaNews: Decodable, Identifiable {
    var id: String { url ?? UUID().uuidString }
    let platform: String?
    let url: String?
    let title: String?
    let imageUrl: String?
}

struct BankAccount: Decodable {
    let bankName: String?
    let accountName: String?
    let accountNumber: String?
    let promptPayId: String?
}

struct PickupConfig: Decodable {
    let enabled: Bool?
    let location: String?
    let instructions: String?
    let dates: [String]?
}

struct EventItem: Decodable, Identifiable {
    var id: String { title ?? UUID().uuidString }
    let title: String?
    let description: String?
    let imageUrl: String?
    let startDate: String?
    let endDate: String?
    let enabled: Bool?
}

// MARK: - Product

struct Product: Decodable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let category: String?
    let type: String?
    let subType: String?
    let images: [String]?
    let coverImage: String?
    let basePrice: Double
    let sizePricing: [String: Double]?
    let variants: [ProductVariant]?
    let stock: Int?
    let maxPerOrder: Int?
    let startDate: String?
    let endDate: String?
    let isActive: Bool?
    let options: ProductOptions?
    let customTags: [CustomTag]?
    let pickup: ProductPickup?
    let campInfo: CampInfo?
    let eventInfo: EventInfo?
    let slug: String?
    let sortOrder: Int?

    var displayPrice: String {
        formatCurrency(basePrice)
    }

    var isAvailable: Bool {
        (isActive ?? true) && (stock == nil || stock! > 0)
    }

    var primaryImage: String? {
        coverImage ?? images?.first
    }
}

struct ProductOptions: Decodable {
    let hasCustomName: Bool?
    let hasCustomNumber: Bool?
    let hasLongSleeve: Bool?
    let longSleevePrice: Double?
    let requiresSize: Bool?
    let customFields: [ProductCustomField]?
}

struct ProductVariant: Codable, Identifiable {
    let id: String
    let name: String
    let price: Double
    let image: String?
    let stock: Int?
    let isActive: Bool?
}

struct ProductCustomField: Codable, Identifiable {
    let id: String
    let label: String
    let type: String
    let required: Bool?
    let placeholder: String?
    let options: [String]?
}

struct CustomTag: Decodable {
    let label: String?
    let color: String?
}

struct ProductPickup: Decodable {
    let required: Bool?
    let location: String?
    let date: String?
}

struct CampInfo: Decodable {
    let startDate: String?
    let endDate: String?
    let location: String?
    let details: String?
}

struct EventInfo: Decodable {
    let date: String?
    let time: String?
    let location: String?
    let details: String?
}

// MARK: - Cart

struct CartItem: Codable, Identifiable {
    var id: String
    let name: String
    let type: String
    let category: String?
    let subType: String?
    var price: Double
    var qty: Int
    var size: String
    var sleeve: String?
    var customName: String?
    var customNumber: String?
    var total: Double
    var selectedVariant: ProductVariant?
    var customFieldValues: [String: String]?
    var variants: [ProductVariant]?
    var customFields: [ProductCustomField]?

    var displayName: String {
        var parts = [name]
        if let variant = selectedVariant {
            parts.append(variant.name)
        }
        if !size.isEmpty {
            parts.append("Size \(size)")
        }
        if sleeve == "LONG" {
            parts.append("Long Sleeve")
        }
        return parts.joined(separator: " • ")
    }
}

// MARK: - Orders

struct OrdersResponse: Decodable {
    let history: [OrderHistory]?
    let hasMore: Bool?
    let total: Int?
}

struct OrderHistory: Decodable, Identifiable {
    var id: String { ref }
    let ref: String
    let status: String
    let date: String?
    let total: Double?
    let shippingFee: Double?
    let items: [OrderHistoryItem]?
    let cart: [OrderHistoryItem]?
    let trackingNumber: String?
    let shippingProvider: String?
    let shippingMethod: String?
    let shippingOption: String?
    let refundStatus: String?
    let refundReason: String?
    let refundAmount: Double?
    let refundRequestedAt: String?
    let refundAdminNote: String?
    let customerName: String?
    let customerEmail: String?
    let customerPhone: String?
    let customerAddress: String?
    let customerInstagram: String?
    let promoCode: String?
    let promoDiscount: Double?

    var orderItems: [OrderHistoryItem] {
        items ?? cart ?? []
    }

    var statusColor: String {
        switch status.uppercased() {
        case "COMPLETED", "DELIVERED": return "green"
        case "SHIPPED", "READY": return "blue"
        case "PAID", "VERIFYING": return "orange"
        case "CANCELLED", "REJECTED", "FAILED": return "red"
        case "REFUNDED", "REFUND_REQUESTED": return "purple"
        default: return "gray"
        }
    }

    var statusIcon: String {
        switch status.uppercased() {
        case "COMPLETED", "DELIVERED": return "checkmark.circle.fill"
        case "SHIPPED": return "shippingbox.fill"
        case "READY": return "cube.box.fill"
        case "PAID": return "creditcard.fill"
        case "PENDING", "WAITING_PAYMENT", "AWAITING_PAYMENT", "UNPAID":
            return "clock.fill"
        case "CANCELLED": return "xmark.circle.fill"
        case "REFUNDED", "REFUND_REQUESTED": return "arrow.uturn.backward.circle.fill"
        default: return "questionmark.circle.fill"
        }
    }
}

struct OrderHistoryItem: Decodable, Identifiable {
    var id = UUID()
    let productId: String?
    let name: String?
    let productName: String?
    let size: String?
    let qty: Int?
    let quantity: Int?
    let customName: String?
    let customNumber: String?
    let isLongSleeve: Bool?
    let unitPrice: Double?
    let subtotal: Double?

    var displayName: String {
        name ?? productName ?? "Unknown Item"
    }

    var itemQuantity: Int {
        qty ?? quantity ?? 1
    }

    enum CodingKeys: String, CodingKey {
        case productId, name, productName, size, qty, quantity
        case customName, customNumber, isLongSleeve, unitPrice, subtotal
    }
}

// MARK: - Payment

struct PaymentInfo: Decodable {
    let ref: String?
    let bankName: String?
    let accountName: String?
    let accountNumber: String?
    let baseAmount: Double?
    let discount: Double?
    let finalAmount: Double?
    let qrPayload: String?
    let qrUrl: String?
    let cart: [PaymentCartItem]?
    let status: String?
    let hasSlip: Bool?
    let paymentEnabled: Bool?
    let paymentDisabledMessage: String?
}

struct PaymentCartItem: Decodable, Identifiable {
    var id = UUID()
    let productName: String?
    let size: String?
    let quantity: Int?
    let unitPrice: Double?
    let customName: String?
    let customNumber: String?
    let isLongSleeve: Bool?

    enum CodingKeys: String, CodingKey {
        case productName, size, quantity, unitPrice
        case customName, customNumber, isLongSleeve
    }
}

// MARK: - Profile

struct UserProfile: Codable {
    var name: String?
    var phone: String?
    var address: String?
    var instagram: String?
    var profileImage: String?
    var theme: String?
    var savedAddresses: [SavedAddress]?
}

struct SavedAddress: Codable, Identifiable {
    let id: String
    var label: String
    var address: String
    var isDefault: Bool
}

// MARK: - Support Chat

struct ChatSession: Decodable, Identifiable {
    let id: String
    let customer_email: String?
    let customer_name: String?
    let customer_avatar: String?
    let status: String
    let admin_email: String?
    let admin_name: String?
    let subject: String?
    let rating: Int?
    let rating_comment: String?
    let created_at: String
    let updated_at: String?
    let closed_at: String?
    let last_message_at: String?
    let last_message_preview: String?
    let unread_count: Int?
    let customer_unread_count: Int?
    let messages: [ChatMessage]?
}

struct ChatMessage: Decodable, Identifiable {
    let id: String
    let session_id: String?
    let sender: String
    let sender_email: String?
    let sender_name: String?
    let sender_avatar: String?
    let message: String
    let created_at: String
    let is_read: Bool?
    let read_at: String?
    let is_unsent: Bool?

    var isCustomer: Bool {
        sender == "customer"
    }

    var isSystem: Bool {
        sender == "system"
    }

    var timestamp: Date? {
        ISO8601DateFormatter().date(from: created_at)
    }
}

// MARK: - Shipping

struct ShippingConfigResponse: Decodable {
    let success: Bool?
    let data: ShippingConfig?
}

struct ShippingConfig: Decodable {
    let defaultOptionId: String?
    let options: [ShippingOption]?
    let globalFreeShippingMinimum: Double?
    let showOptions: Bool?
    let allowPickup: Bool?
    let pickupLocation: String?
    let pickupInstructions: String?
}

struct ShippingOption: Decodable, Identifiable {
    let id: String
    let provider: String?
    let name: String
    let description: String?
    let baseFee: Double?
    let perItemFee: Double?
    let freeShippingMinimum: Double?
    let estimatedDays: EstimatedDays?
    let enabled: Bool?
    let trackingUrlTemplate: String?
}

struct EstimatedDays: Decodable {
    let min: Int?
    let max: Int?
}

struct TrackingInfo: Decodable {
    let provider: String?
    let trackingNumber: String?
    let status: String?
    let statusText: String?
    let statusTextThai: String?
    let lastUpdate: String?
    let estimatedDelivery: String?
    let events: [TrackingEvent]?
    let trackingUrl: String?
    let track123Url: String?
}

struct TrackingEvent: Decodable, Identifiable {
    var id = UUID()
    let timestamp: String?
    let status: String?
    let description: String?
    let descriptionThai: String?
    let location: String?

    enum CodingKeys: String, CodingKey {
        case timestamp, status, description, descriptionThai, location
    }
}

// MARK: - Promo Code

struct PromoValidation: Decodable {
    let valid: Bool?
    let code: String?
    let discountType: String?
    let discountValue: Double?
    let discount: Double?
    let description: String?
    let error: String?
}

// MARK: - Refund

struct RefundInfoResponse: Decodable {
    let ref: String?
    let status: String?
    let totalAmount: Double?
    let refund: RefundData?
    let canRequestRefund: Bool?
    let reasons: [String]?
    let banks: [String]?
}

struct RefundData: Decodable {
    let status: String?
    let reason: String?
    let details: String?
    let amount: Double?
    let bankName: String?
    let bankAccount: String?
    let accountName: String?
    let requestedAt: String?
    let reviewedAt: String?
    let adminNote: String?
}

// MARK: - Order Submission

struct SubmitOrderRequest: Encodable {
    let customerName: String
    let customerEmail: String
    let customerPhone: String
    let customerAddress: String
    let customerInstagram: String?
    let cart: [CartItem]
    let totalAmount: Double
    let shippingOptionId: String?
    let paymentOptionId: String?
    let shippingFee: Double?
    let promoCode: String?
    let promoDiscount: Double?
}

// MARK: - Helpers

func formatCurrency(_ amount: Double) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "THB"
    formatter.currencySymbol = "฿"
    formatter.maximumFractionDigits = 0
    return formatter.string(from: NSNumber(value: amount)) ?? "฿\(Int(amount))"
}

// MARK: - Size Constants

enum ShirtSize: String, CaseIterable {
    case XS, S, M, L, XL
    case XXL = "2XL"
    case XXXL = "3XL"
    case XXXXL = "4XL"
    case XXXXXL = "5XL"

    struct Measurements {
        let chest: Int
        let length: Int
    }

    var measurements: Measurements {
        switch self {
        case .XS: return .init(chest: 36, length: 25)
        case .S: return .init(chest: 38, length: 26)
        case .M: return .init(chest: 40, length: 27)
        case .L: return .init(chest: 42, length: 28)
        case .XL: return .init(chest: 44, length: 29)
        case .XXL: return .init(chest: 46, length: 30)
        case .XXXL: return .init(chest: 48, length: 31)
        case .XXXXL: return .init(chest: 50, length: 32)
        case .XXXXXL: return .init(chest: 52, length: 33)
        }
    }
}

// MARK: - Order Status

enum OrderStatus: String, CaseIterable {
    case PENDING
    case PAID
    case READY
    case SHIPPED
    case COMPLETED
    case CANCELLED
    case WAITING_PAYMENT
    case AWAITING_PAYMENT
    case UNPAID
    case DRAFT
    case VERIFYING
    case WAITING_SLIP
    case REJECTED
    case FAILED
    case REFUNDED
    case REFUND_REQUESTED

    var displayName: String {
        switch self {
        case .PENDING: return "รอดำเนินการ"
        case .PAID: return "ชำระแล้ว"
        case .READY: return "พร้อมจัดส่ง"
        case .SHIPPED: return "จัดส่งแล้ว"
        case .COMPLETED: return "สำเร็จ"
        case .CANCELLED: return "ยกเลิก"
        case .WAITING_PAYMENT, .AWAITING_PAYMENT: return "รอชำระเงิน"
        case .UNPAID: return "ยังไม่ชำระ"
        case .DRAFT: return "ร่าง"
        case .VERIFYING: return "กำลังตรวจสอบ"
        case .WAITING_SLIP: return "รอสลิป"
        case .REJECTED: return "ปฏิเสธ"
        case .FAILED: return "ล้มเหลว"
        case .REFUNDED: return "คืนเงินแล้ว"
        case .REFUND_REQUESTED: return "ขอคืนเงิน"
        }
    }

    var isPayable: Bool {
        [.PENDING, .WAITING_PAYMENT, .AWAITING_PAYMENT, .UNPAID, .DRAFT].contains(self)
    }

    var isCancelable: Bool {
        isPayable
    }

    var isRefundable: Bool {
        [.PAID, .READY, .COMPLETED, .SHIPPED].contains(self)
    }
}
