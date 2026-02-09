import SwiftUI
import UserNotifications

@MainActor
final class NotificationManager: ObservableObject {
    static let shared = NotificationManager()

    @Published var isAuthorized = false
    @Published var deviceToken: String?

    private init() {}

    func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            Task { @MainActor in
                self.isAuthorized = granted
                if granted {
                    self.registerForRemoteNotifications()
                }
            }
        }
    }

    func registerForRemoteNotifications() {
        #if !targetEnvironment(simulator)
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
        }
        #endif
    }

    func handleDeviceToken(_ token: Data) {
        let tokenString = token.map { String(format: "%02.2hhx", $0) }.joined()
        deviceToken = tokenString
        print("APNs Device Token: \(tokenString)")

        // Register with backend
        Task {
            await registerWithBackend(token: tokenString)
        }
    }

    func handleRegistrationError(_ error: Error) {
        print("APNs registration failed: \(error.localizedDescription)")
    }

    private func registerWithBackend(token: String) async {
        guard AuthManager.shared.isAuthenticated else { return }

        struct APNsRegistration: Encodable {
            let subscription: APNsSubscription
            let platform: String = "ios"
        }

        struct APNsSubscription: Encodable {
            let endpoint: String
            let keys: APNsKeys
        }

        struct APNsKeys: Encodable {
            let p256dh: String
            let auth: String
        }

        // Register APNs token as push subscription
        let registration = APNsRegistration(
            subscription: APNsSubscription(
                endpoint: "apns://\(token)",
                keys: APNsKeys(p256dh: token, auth: token)
            )
        )

        do {
            let _: APIResponse<EmptyData> = try await APIClient.shared.post(
                "/api/push-subscription",
                body: registration
            )
        } catch {
            print("Failed to register push subscription: \(error)")
        }
    }

    // MARK: - Handle Notifications

    func handleNotification(_ userInfo: [AnyHashable: Any]) {
        // Parse notification payload
        if let aps = userInfo["aps"] as? [String: Any] {
            if let alert = aps["alert"] as? [String: Any] {
                let title = alert["title"] as? String ?? ""
                let body = alert["body"] as? String ?? ""
                print("Notification: \(title) - \(body)")
            }
        }

        // Handle custom data
        if let orderRef = userInfo["ref"] as? String {
            // Navigate to order
            NotificationCenter.default.post(
                name: .openOrder,
                object: nil,
                userInfo: ["ref": orderRef]
            )
        }

        if let chatId = userInfo["chatId"] as? String {
            // Navigate to chat
            NotificationCenter.default.post(
                name: .openChat,
                object: nil,
                userInfo: ["chatId": chatId]
            )
        }
    }

    // MARK: - Local Notifications

    func scheduleLocalNotification(title: String, body: String, identifier: String = UUID().uuidString) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

        UNUserNotificationCenter.current().add(request)
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let openOrder = Notification.Name("openOrder")
    static let openChat = Notification.Name("openChat")
}

// MARK: - App Delegate for Push Notifications

class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in
            NotificationManager.shared.handleDeviceToken(deviceToken)
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Task { @MainActor in
            NotificationManager.shared.handleRegistrationError(error)
        }
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    // Handle notification when app is in foreground
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        return [.banner, .sound, .badge]
    }

    // Handle notification tap
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let userInfo = response.notification.request.content.userInfo
        await NotificationManager.shared.handleNotification(userInfo)
    }
}
