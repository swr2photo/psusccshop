import SwiftUI
import UIKit

// MARK: - Screen Capture Protection Manager
//
// ARCHITECTURE (3 layers of defense):
//
// Layer 1: UITextField.isSecureTextEntry trick (HARDWARE LEVEL)
//   - iOS renders secure text fields as BLANK in screenshots & recordings
//   - We move the entire app content into the secure field's layer
//   - This is the same technique banking apps (SCB, KBank) use
//   - Result: screenshots/recordings capture a BLACK screen automatically
//
// Layer 2: UIScreen.isCaptured detection (RECORDING)
//   - Detects screen recording, AirPlay, external display mirroring
//   - Shows shield overlay + activates content blur
//   - Keeps shield active for entire duration of recording
//
// Layer 3: userDidTakeScreenshotNotification (AFTER SCREENSHOT)
//   - iOS notifies AFTER screenshot is taken (cannot prevent)
//   - We show a warning shield to discourage sharing
//   - Combined with Layer 1, the screenshot is already blank

@MainActor
final class ScreenCaptureManager: ObservableObject {
    static let shared = ScreenCaptureManager()
    
    @Published var isCaptured: Bool = false
    @Published var showShield: Bool = false
    @Published var isRecording: Bool = false
    
    // The secure window that blanks screenshots
    private var secureWindow: UIWindow?
    private var hostingController: UIHostingController<AnyView>?
    
    private init() {
        isCaptured = UIScreen.main.isCaptured
        isRecording = UIScreen.main.isCaptured
        
        // Monitor screen recording state
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
    
    // MARK: - Screen Recording Detection
    
    @objc private func capturedDidChange() {
        Task { @MainActor in
            let captured = UIScreen.main.isCaptured
            self.isCaptured = captured
            self.isRecording = captured
            self.showShield = captured
        }
    }
    
    // MARK: - Screenshot Detection (post-capture warning)
    
    @objc private func screenshotTaken() {
        Task { @MainActor in
            self.showShield = true
            try? await Task.sleep(nanoseconds: 3_000_000_000) // 3 seconds
            if !self.isCaptured {
                self.showShield = false
            }
        }
    }
    
    // MARK: - Layer 1: Secure Content Protection
    //
    // The KEY technique: UITextField with isSecureTextEntry = true
    // iOS will automatically render this field's layer as BLACK in screenshots.
    // By making our app content a sublayer of this field, ALL content is blanked.
    
    /// Call this once from the App's WindowGroup.onAppear
    func protectWindow() {
        guard secureWindow == nil else { return }
        
        guard let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first else { return }
        
        guard let existingWindow = windowScene.windows.first else { return }
        
        // Create a secure text field
        let secureField = UITextField()
        secureField.isSecureTextEntry = true
        secureField.isUserInteractionEnabled = false
        secureField.alpha = 0.01 // Nearly invisible but still "rendered"
        
        // Add it to the window so iOS activates the secure rendering
        existingWindow.addSubview(secureField)
        secureField.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            secureField.centerXAnchor.constraint(equalTo: existingWindow.centerXAnchor),
            secureField.centerYAnchor.constraint(equalTo: existingWindow.centerYAnchor),
            secureField.widthAnchor.constraint(equalToConstant: 1),
            secureField.heightAnchor.constraint(equalToConstant: 1),
        ])
        
        // CRITICAL: Move the main view's layer into the secure field's layer
        // This makes the secure rendering context encompass ALL app content
        if let secureLayer = secureField.layer.sublayers?.first {
            // The secure layer from UITextField — content rendered within
            // this layer will be blanked in screenshots
            if let rootView = existingWindow.rootViewController?.view {
                secureLayer.addSublayer(rootView.layer)
            }
        }
    }
}

// MARK: - Screen Capture Shield View

struct ScreenCaptureShield: View {
    let isRecording: Bool
    
    var body: some View {
        ZStack {
            Color.black
                .ignoresSafeArea()
            
            VStack(spacing: 24) {
                // Animated icon
                Group {
                    if isRecording {
                        Image(systemName: "video.slash.fill")
                    } else {
                        Image(systemName: "lock.shield.fill")
                    }
                }
                .font(.system(size: 48, weight: .light))
                .foregroundStyle(.white.opacity(0.9))
                .symbolEffect(.pulse, options: .repeating)
                
                VStack(spacing: 8) {
                    Text(isRecording
                         ? "ไม่สามารถบันทึกวิดีโอหน้าจอได้"
                         : "ไม่สามารถบันทึกภาพหน้าจอได้")
                        .font(.system(size: 20, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                    
                    Text(isRecording
                         ? "Screen recording is not allowed"
                         : "Screenshot is not allowed")
                        .font(.system(size: 14, weight: .regular))
                        .foregroundStyle(.white.opacity(0.45))
                        .multilineTextAlignment(.center)
                }
                
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

// MARK: - View Modifier

struct ScreenCaptureProtection: ViewModifier {
    @ObservedObject var captureManager = ScreenCaptureManager.shared
    
    func body(content: Content) -> some View {
        ZStack {
            content
                .blur(radius: captureManager.showShield ? 30 : 0)
                .animation(.easeOut(duration: 0.1), value: captureManager.showShield)
            
            if captureManager.showShield {
                ScreenCaptureShield(isRecording: captureManager.isRecording)
                    .zIndex(999)
            }
        }
        .onAppear {
            // Activate hardware-level protection
            captureManager.protectWindow()
        }
    }
}

extension View {
    /// Apply banking-grade screen capture protection
    /// Layer 1: Secure field blanks screenshots at hardware level
    /// Layer 2: Shield overlay during recording
    /// Layer 3: Warning after screenshot
    func screenCaptureProtected() -> some View {
        modifier(ScreenCaptureProtection())
    }
}
