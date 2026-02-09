import Foundation

// MARK: - API Configuration

enum APIConfig {
    /// Base URL for the API. Change this to your deployed URL.
    static var baseURL: String {
        #if DEBUG
        return "http://localhost:3000"
        #else
        return "https://psusccshop.vercel.app"
        #endif
    }

    static let timeout: TimeInterval = 30
    static let uploadTimeout: TimeInterval = 60
}

// MARK: - API Error

enum APIError: LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case serverError(String)
    case unauthorized
    case forbidden
    case notFound
    case rateLimited
    case networkError(Error)
    case unknown(Int)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .noData: return "No data received"
        case .decodingError(let error): return "Data error: \(error.localizedDescription)"
        case .serverError(let message): return message
        case .unauthorized: return "Please sign in to continue"
        case .forbidden: return "Access denied"
        case .notFound: return "Not found"
        case .rateLimited: return "Too many requests. Please wait."
        case .networkError(let error): return error.localizedDescription
        case .unknown(let code): return "Server error (\(code))"
        }
    }
}

// MARK: - API Client

@MainActor
final class APIClient: ObservableObject, Sendable {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder

    init() {
        let config = URLSessionConfiguration.default
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.httpCookieStorage = .shared
        config.timeoutIntervalForRequest = APIConfig.timeout
        config.waitsForConnectivity = true

        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
        self.decoder.keyDecodingStrategy = .useDefaultKeys
    }

    // MARK: - Generic Request

    func request<T: Decodable>(
        _ path: String,
        method: String = "GET",
        body: (any Encodable)? = nil,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        guard var components = URLComponents(string: "\(APIConfig.baseURL)\(path)") else {
            throw APIError.invalidURL
        }

        if let queryItems {
            components.queryItems = queryItems
        }

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        // Identify as iOS app
        request.setValue("PSUSCCShop-iOS/1.0", forHTTPHeaderField: "X-Client")

        if let body {
            let encoder = JSONEncoder()
            request.httpBody = try encoder.encode(body)
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.noData
        }

        switch httpResponse.statusCode {
        case 200...299:
            break
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        case 429:
            throw APIError.rateLimited
        default:
            // Try to extract error message from response
            if let apiError = try? decoder.decode(APIResponse<EmptyData>.self, from: data) {
                throw APIError.serverError(apiError.message ?? apiError.error?.code ?? "Unknown error")
            }
            throw APIError.unknown(httpResponse.statusCode)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Convenience methods

    func get<T: Decodable>(_ path: String, queryItems: [URLQueryItem]? = nil) async throws -> T {
        try await request(path, method: "GET", queryItems: queryItems)
    }

    func post<T: Decodable>(_ path: String, body: any Encodable) async throws -> T {
        try await request(path, method: "POST", body: body)
    }

    func put<T: Decodable>(_ path: String, body: any Encodable) async throws -> T {
        try await request(path, method: "PUT", body: body)
    }

    func delete<T: Decodable>(_ path: String, queryItems: [URLQueryItem]? = nil) async throws -> T {
        try await request(path, method: "DELETE", queryItems: queryItems)
    }

    // MARK: - Upload

    func uploadImage(base64: String, filename: String? = nil, mime: String? = nil) async throws -> String {
        struct UploadBody: Encodable {
            let base64: String
            let filename: String?
            let mime: String?
        }

        struct UploadData: Decodable {
            let url: String
            let path: String?
            let size: Int?
        }

        let body = UploadBody(base64: base64, filename: filename, mime: mime)
        let response: APIResponse<UploadData> = try await post("/api/upload", body: body)

        guard let url = response.data?.url else {
            throw APIError.serverError(response.message ?? "Upload failed")
        }
        return url
    }
}

// MARK: - Empty data placeholder

struct EmptyData: Decodable {}

// MARK: - Shop API

extension APIClient {
    func fetchConfig() async throws -> ShopConfig {
        let response: APIResponse<ShopConfig> = try await get("/api/config")
        guard let config = response.data else {
            throw APIError.serverError(response.message ?? "Failed to load config")
        }
        return config
    }

    func fetchShippingOptions() async throws -> ShippingConfig {
        let response: ShippingConfigResponse = try await get("/api/shipping/options")
        guard let config = response.data else {
            throw APIError.noData
        }
        return config
    }
}

// MARK: - Cart API

extension APIClient {
    func fetchCart(email: String) async throws -> [CartItem] {
        struct CartData: Decodable {
            let cart: [CartItem]?
        }
        let response: APIResponse<CartData> = try await get("/api/cart", queryItems: [
            URLQueryItem(name: "email", value: email)
        ])
        return response.data?.cart ?? []
    }

    func saveCart(email: String, cart: [CartItem]) async throws {
        struct CartBody: Encodable {
            let email: String
            let cart: [CartItem]
        }
        let _: APIResponse<EmptyData> = try await post("/api/cart", body: CartBody(email: email, cart: cart))
    }
}

// MARK: - Orders API

extension APIClient {
    func fetchOrders(email: String, offset: Int = 0, limit: Int = 50) async throws -> OrdersResponse {
        let response: APIResponse<OrdersResponse> = try await get("/api/orders", queryItems: [
            URLQueryItem(name: "email", value: email),
            URLQueryItem(name: "offset", value: String(offset)),
            URLQueryItem(name: "limit", value: String(limit))
        ])
        guard let data = response.data else {
            throw APIError.serverError(response.message ?? "Failed to load orders")
        }
        return data
    }

    func submitOrder(_ order: SubmitOrderRequest) async throws -> String {
        let response: APIResponse<EmptyData> = try await post("/api/orders", body: order)
        guard let ref = response.ref else {
            throw APIError.serverError(response.message ?? "Failed to submit order")
        }
        return ref
    }

    func cancelOrder(ref: String) async throws {
        let _: APIResponse<EmptyData> = try await delete("/api/orders", queryItems: [
            URLQueryItem(name: "ref", value: ref)
        ])
    }

    func updateOrder(ref: String, data: [String: String]) async throws {
        struct UpdateBody: Encodable {
            let ref: String
            let data: [String: String]
        }
        let _: APIResponse<EmptyData> = try await put("/api/orders", body: UpdateBody(ref: ref, data: data))
    }
}

// MARK: - Payment API

extension APIClient {
    func fetchPaymentInfo(ref: String) async throws -> PaymentInfo {
        let response: APIResponse<PaymentInfo> = try await get("/api/payment-info", queryItems: [
            URLQueryItem(name: "ref", value: ref)
        ])
        guard let data = response.data else {
            throw APIError.serverError(response.message ?? "Failed to load payment info")
        }
        return data
    }
}

// MARK: - Profile API

extension APIClient {
    func fetchProfile(email: String) async throws -> UserProfile {
        struct ProfileData: Decodable {
            let profile: UserProfile
        }
        let response: APIResponse<ProfileData> = try await get("/api/profile", queryItems: [
            URLQueryItem(name: "email", value: email)
        ])
        guard let data = response.data else {
            return UserProfile()
        }
        return data.profile
    }

    func saveProfile(email: String, profile: UserProfile) async throws {
        struct ProfileBody: Encodable {
            let email: String
            let data: UserProfile
        }
        let _: APIResponse<EmptyData> = try await post("/api/profile", body: ProfileBody(email: email, data: profile))
    }
}

// MARK: - Support Chat API

extension APIClient {
    func fetchActiveChat() async throws -> ChatSession? {
        struct ChatData: Decodable {
            let chat: ChatSession?
        }
        let response: APIResponse<ChatData> = try await get("/api/support-chat")
        return response.data?.chat
    }

    func fetchChatHistory() async throws -> [ChatSession] {
        struct ChatsData: Decodable {
            let chats: [ChatSession]?
        }
        let response: APIResponse<ChatsData> = try await get("/api/support-chat", queryItems: [
            URLQueryItem(name: "action", value: "history")
        ])
        return response.data?.chats ?? []
    }

    func createChat(subject: String?, message: String) async throws -> ChatSession {
        struct CreateChatBody: Encodable {
            let subject: String?
            let message: String
        }
        struct ChatData: Decodable {
            let chat: ChatSession
        }
        let response: APIResponse<ChatData> = try await post("/api/support-chat",
            body: CreateChatBody(subject: subject, message: message))
        guard let data = response.data else {
            throw APIError.serverError(response.message ?? "Failed to create chat")
        }
        return data.chat
    }

    func fetchChatMessages(sessionId: String, markRead: Bool = true) async throws -> ChatSession {
        struct ChatDetail: Decodable {
            let chat: ChatSession
        }
        let response: APIResponse<ChatDetail> = try await get("/api/support-chat/\(sessionId)", queryItems: [
            URLQueryItem(name: "markRead", value: markRead ? "true" : "false")
        ])
        guard let data = response.data else {
            throw APIError.serverError(response.message ?? "Failed to load messages")
        }
        return data.chat
    }

    func sendChatMessage(sessionId: String, message: String) async throws {
        struct MessageBody: Encodable {
            let sessionId: String
            let message: String
        }
        let _: APIResponse<EmptyData> = try await post("/api/support-chat/\(sessionId)",
            body: MessageBody(sessionId: sessionId, message: message))
    }
}

// MARK: - Promo Code API

extension APIClient {
    func validatePromo(code: String, subtotal: Double) async throws -> PromoValidation {
        struct PromoBody: Encodable {
            let code: String
            let subtotal: Double
        }
        let response: PromoValidation = try await post("/api/promo", body: PromoBody(code: code, subtotal: subtotal))
        return response
    }
}

// MARK: - Tracking API

extension APIClient {
    func trackShipment(trackingNumber: String, provider: String? = nil) async throws -> TrackingInfo {
        struct TrackBody: Encodable {
            let trackingNumber: String
            let provider: String?
            let useFallback: Bool
        }
        let response: APIResponse<TrackingInfo> = try await post("/api/shipping/track",
            body: TrackBody(trackingNumber: trackingNumber, provider: provider, useFallback: true))
        guard let data = response.data else {
            throw APIError.serverError(response.message ?? "Failed to track shipment")
        }
        return data
    }
}

// MARK: - Refund API

extension APIClient {
    func fetchRefundInfo(ref: String) async throws -> RefundInfoResponse {
        let response: RefundInfoResponse = try await get("/api/refund", queryItems: [
            URLQueryItem(name: "ref", value: ref)
        ])
        return response
    }

    func requestRefund(ref: String, reason: String, details: String?, bankName: String, bankAccount: String, accountName: String, amount: Double?) async throws {
        struct RefundBody: Encodable {
            let ref: String
            let reason: String
            let details: String?
            let bankName: String
            let bankAccount: String
            let accountName: String
            let amount: Double?
        }
        let _: APIResponse<EmptyData> = try await post("/api/refund",
            body: RefundBody(ref: ref, reason: reason, details: details,
                           bankName: bankName, bankAccount: bankAccount,
                           accountName: accountName, amount: amount))
    }
}
