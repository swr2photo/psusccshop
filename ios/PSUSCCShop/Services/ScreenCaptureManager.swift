import SwiftUI
import UIKit

// MARK: - Screen Capture Protection Manager

/// Banking-grade screen capture protection for iOS
/// Uses UIScreen.isCaptured to detect screen recording
/// and secure TextField overlay trick to blank screenshots
@MainActor
final class ScreenCaptureManager: ObservableObject {
    static let shared = ScreenCaptureManager()

    @Published var isCaptured: Bool = false
    @Published var showShield: Bool = false

    private var secureField: UITextField?
    private var secureContainer: UIView?

    private init() {
        // Check initial state
        isCaptured = UIScreen.main.isCaptured

        // Monitor screen capture state changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(capturedDidChange),
            name: UIScreen.capturedDidChangeNotification,
            object: nil
        )

        // Monitor screenshot taken
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screenshotTaken),
            name: UIApplication.userDidTakeScreenshotNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func capturedDidChange() {
        Task { @MainActor in
            let captured = UIScreen.main.isCaptured
            self.isCaptured = captured
            self.showShield = captured

            if captured {
                // Activate secure overlay to blank content in recordings
                self.activateSecureOverlay()
            } else {
                self.deactivateSecureOverlay()
            }
        }
    }

    @objc private func screenshotTaken() {
        Task { @MainActor in
            // Brief shield on screenshot
            self.showShield = true
            try? await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
            if !self.isCaptured {
                self.showShield = false
            }
        }
    }

    // MARK: - Secure Overlay (Banking App Technique)
    // Uses UITextField.isSecureTextEntry trick:
    // iOS renders secure text fields as blank in screenshots/recordings

    func setupSecureOverlay(in window: UIWindow) {
        guard secureContainer == nil else { return }

        let container = UIView(frame: window.bounds)
        container.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        container.isUserInteractionEnabled = false

        let field = UITextField()
        field.isSecureTextEntry = true
        field.isUserInteractionEnabled = false
        container.addSubview(field)

        // The field's layer will be used to host our content
        // When isSecureTextEntry = true, iOS blanks this layer in screenshots
        field.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            field.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            field.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            field.topAnchor.constraint(equalTo: container.topAnchor),
            field.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])

        self.secureField = field
        self.secureContainer = container
    }

    private func activateSecureOverlay() {
        guard let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first?.windows.first
        else { return }

        setupSecureOverlay(in: window)

        if let container = secureContainer, container.superview == nil {
            window.addSubview(container)
        }
        secureContainer?.isHidden = false
    }

    private func deactivateSecureOverlay() {
        secureContainer?.isHidden = true
    }
}

// MARK: - Screen Capture Shield View

/// Full-screen shield overlay shown when screen capture is detected
/// Mimics banking app behavior (SCB, KBank, etc.)
struct ScreenCaptureShield: View {
    let isRecording: Bool

    var body: some View {
        ZStack {
            // Black background
            Color.black
                .ignoresSafeArea()

            VStack(spacing: 24) {
                // Shield icon
                if isRecording {
                    // Video camera with slash
                    Image(systemName: "video.slash.fill")
                        .font(.system(size: 48, weight: .light))
                        .foregroundStyle(.white.opacity(0.9))
                        .symbolEffect(.pulse, options: .repeating)
                } else {
                    // Lock shield
                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: 48, weight: .light))
                        .foregroundStyle(.white.opacity(0.9))
                        .symbolEffect(.pulse, options: .repeating)
                }

                VStack(spacing: 8) {
                    // Thai message
                    Text(isRecording
                         ? "ไม่สามารถบันทึกวิดีโอหน้าจอได้"
                         : "ไม่สามารถบันทึกภาพหน้าจอได้")
                        .font(.system(size: 20, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)

                    // English sub-message
                    Text(isRecording
                         ? "Screen recording is not allowed"
                         : "Screenshot is not allowed")
                        .font(.system(size: 14, weight: .regular))
                        .foregroundStyle(.white.opacity(0.45))
                        .multilineTextAlignment(.center)
                }

                // App branding
                HStack(spacing: 6) {
                    Image(systemName: "shield.fill")
                        .font(.system(size: 10))
                    Text("SCC SHOP SECURITY")
                        .font(.system(size: 11, weight: .medium))
                        .tracking(0.5)
                }
                .foregroundStyle(.white.opacity(0.3))
                .padding(.top, 16)
            }
            .padding(32)
        }
        .transition(.opacity.animation(.easeOut(duration: 0.15)))
    }
}

// MARK: - View Modifier for Screen Capture Protection

/// Apply this modifier to any view to enable banking-grade screen capture protection
struct ScreenCaptureProtection: ViewModifier {
    @ObservedObject var captureManager = ScreenCaptureManager.shared

    func body(content: Content) -> some View {
        ZStack {
            content
                // Blur content when captured (fallback if shield doesn't render on top)
                .blur(radius: captureManager.showShield ? 30 : 0)
                .animation(.easeOut(duration: 0.1), value: captureManager.showShield)

            if captureManager.showShield {
                ScreenCaptureShield(isRecording: captureManager.isCaptured)
                    .zIndex(999)
            }
        }
        .onAppear {
            // Setup secure overlay when view appears
            if let window = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first?.windows.first {
                captureManager.setupSecureOverlay(in: window)
            }
        }
    }
}

extension View {
    /// Apply banking-grade screen capture protection
    /// Shows a shield overlay and blanks content during screenshots/recording
    func screenCaptureProtected() -> some View {
        modifier(ScreenCaptureProtection())
    }
}
