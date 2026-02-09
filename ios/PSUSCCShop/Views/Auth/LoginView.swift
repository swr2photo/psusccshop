import SwiftUI
import AuthenticationServices

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var isSigningIn = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    // Header
                    VStack(spacing: 12) {
                        Image(systemName: "tshirt.fill")
                            .font(.system(size: 64))
                            .foregroundStyle(.tint)
                            .symbolEffect(.bounce, value: isSigningIn)

                        Text("PSU SCC Shop")
                            .font(.largeTitle)
                            .fontWeight(.bold)

                        Text("ร้านค้าสโมสรนิสิต\nมหาวิทยาลัยสงขลานครินทร์")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 60)

                    // Sign In Buttons
                    VStack(spacing: 16) {
                        // Sign in with Apple (Primary)
                        SignInWithAppleButton(.signIn) { request in
                            request.requestedScopes = [.fullName, .email]
                        } onCompletion: { result in
                            isSigningIn = true
                            Task {
                                await authManager.handleAppleSignIn(result: result)
                                isSigningIn = false
                            }
                        }
                        .signInWithAppleButtonStyle(.black)
                        .frame(height: 54)
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                        // Google Sign In
                        OAuthButton(
                            provider: "google",
                            title: "Sign in with Google",
                            icon: "globe",
                            backgroundColor: .white,
                            foregroundColor: .primary,
                            borderColor: .gray.opacity(0.3)
                        )

                        // LINE Sign In
                        OAuthButton(
                            provider: "line",
                            title: "Sign in with LINE",
                            icon: "bubble.left.fill",
                            backgroundColor: Color(red: 0, green: 0.73, blue: 0.36),
                            foregroundColor: .white
                        )

                        // Facebook Sign In
                        OAuthButton(
                            provider: "facebook",
                            title: "Sign in with Facebook",
                            icon: "person.2.fill",
                            backgroundColor: Color(red: 0.23, green: 0.35, blue: 0.60),
                            foregroundColor: .white
                        )
                    }
                    .padding(.horizontal, 24)

                    // Error Message
                    if let error = authManager.error {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                            .padding(.horizontal)
                    }

                    // Terms
                    VStack(spacing: 8) {
                        Text("เข้าสู่ระบบเพื่อเข้าถึงร้านค้า, ดูประวัติสั่งซื้อ")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text("และรับการแจ้งเตือนสถานะออเดอร์")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 8)
                }
            }
        }
        .disabled(isSigningIn)
        .overlay {
            if isSigningIn {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                ProgressView("Signing in...")
                    .padding()
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }
}

// MARK: - OAuth Button

struct OAuthButton: View {
    @EnvironmentObject var authManager: AuthManager

    let provider: String
    let title: String
    let icon: String
    var backgroundColor: Color = .blue
    var foregroundColor: Color = .white
    var borderColor: Color? = nil

    var body: some View {
        Button {
            Task {
                await authManager.signInWithOAuth(provider: provider)
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.title3)
                Text(title)
                    .fontWeight(.medium)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .background(backgroundColor, in: RoundedRectangle(cornerRadius: 12))
            .foregroundStyle(foregroundColor)
            .overlay {
                if let borderColor {
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(borderColor, lineWidth: 1)
                }
            }
        }
    }
}
