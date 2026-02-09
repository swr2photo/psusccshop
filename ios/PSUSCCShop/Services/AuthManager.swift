import SwiftUI
import AuthenticationServices

// MARK: - Auth Manager

@MainActor
final class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published var currentUser: SessionUser?
    @Published var isAuthenticated = false
    @Published var isLoading = true
    @Published var error: String?

    private let api = APIClient.shared
    private let keychain = KeychainHelper.shared

    private init() {}

    // MARK: - Session Management

    func checkSession() async {
        isLoading = true
        defer { isLoading = false }

        // Try to restore cached session first
        if let cached = keychain.loadSession() {
            currentUser = cached
            isAuthenticated = true
        }

        // Validate with server
        do {
            let session: AuthSession = try await api.get("/api/auth/session")
            if let user = session.user, user.email != nil {
                currentUser = user
                isAuthenticated = true
                keychain.saveSession(user)
            } else {
                // Session expired
                if isAuthenticated {
                    signOut()
                }
            }
        } catch {
            // Network error - keep cached session if available
            if currentUser == nil {
                isAuthenticated = false
            }
        }
    }

    // MARK: - Sign in with Apple

    func handleAppleSignIn(result: Result<ASAuthorization, Error>) async {
        switch result {
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let identityToken = credential.identityToken,
                  let tokenString = String(data: identityToken, encoding: .utf8) else {
                self.error = "Failed to get Apple credentials"
                return
            }

            let fullName = [
                credential.fullName?.givenName,
                credential.fullName?.familyName
            ].compactMap { $0 }.joined(separator: " ")

            // Store user info (Apple only provides name on first sign-in)
            if !fullName.isEmpty {
                keychain.set("apple_name", value: fullName)
            }

            // Authenticate with backend via NextAuth Apple provider
            await authenticateWithBackend(
                provider: "apple",
                idToken: tokenString,
                name: fullName.isEmpty ? keychain.get("apple_name") : fullName,
                email: credential.email
            )

        case .failure(let error):
            if (error as? ASAuthorizationError)?.code == .canceled {
                return // User cancelled
            }
            self.error = error.localizedDescription
        }
    }

    // MARK: - OAuth Web Flow (Google, LINE, etc.)

    func signInWithOAuth(provider: String) async {
        guard let callbackURL = URL(string: "\(APIConfig.baseURL)/api/auth/callback/\(provider)") else {
            error = "Invalid configuration"
            return
        }

        let signInURL = URL(string: "\(APIConfig.baseURL)/api/auth/signin/\(provider)")!

        // Use ASWebAuthenticationSession for OAuth
        await withCheckedContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: signInURL,
                callback: .https(callbackURL.host() ?? "localhost")
            ) { callbackURL, error in
                if let error {
                    if (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin {
                        continuation.resume()
                        return
                    }
                    Task { @MainActor in
                        self.error = error.localizedDescription
                    }
                }
                continuation.resume()
            }

            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }

        // After OAuth, check session
        await checkSession()
    }

    // MARK: - Backend Authentication

    private func authenticateWithBackend(provider: String, idToken: String, name: String?, email: String?) async {
        isLoading = true
        defer { isLoading = false }

        struct AuthBody: Encodable {
            let provider: String
            let idToken: String
            let name: String?
            let email: String?
        }

        do {
            // Call NextAuth callback with the token
            let csrfResponse: [String: String] = try await api.get("/api/auth/csrf")
            let csrfToken = csrfResponse["csrfToken"] ?? ""

            struct SignInBody: Encodable {
                let csrfToken: String
                let idToken: String
            }

            let _: EmptyData = try await api.post(
                "/api/auth/callback/apple",
                body: SignInBody(csrfToken: csrfToken, idToken: idToken)
            )

            await checkSession()
        } catch {
            self.error = error.localizedDescription
            isAuthenticated = false
        }
    }

    // MARK: - Sign Out

    func signOut() {
        currentUser = nil
        isAuthenticated = false
        keychain.deleteSession()

        // Clear cookies
        if let cookies = HTTPCookieStorage.shared.cookies {
            for cookie in cookies {
                HTTPCookieStorage.shared.deleteCookie(cookie)
            }
        }

        // Call server logout
        Task {
            let _: EmptyData? = try? await api.post("/api/auth/signout", body: EmptyData())
        }
    }
}

// MARK: - Keychain Helper

final class KeychainHelper {
    static let shared = KeychainHelper()
    private let service = "com.psusccshop.ios"

    func saveSession(_ user: SessionUser) {
        guard let data = try? JSONEncoder().encode(user) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "session",
            kSecValueData as String: data
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    func loadSession() -> SessionUser? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "session",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(SessionUser.self, from: data)
    }

    func deleteSession() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "session"
        ]
        SecItemDelete(query as CFDictionary)
    }

    func set(_ key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
