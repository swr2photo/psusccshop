// PSUSCCShop - Native iOS App for PSU SCC Shop
// Built with SwiftUI, targeting iOS 26+

import SwiftUI

@main
struct PSUSCCShopApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    @StateObject private var authManager = AuthManager.shared
    @StateObject private var cartStore = CartStore()
    @StateObject private var chatManager = ChatManager()
    @StateObject private var notificationManager = NotificationManager.shared
    @StateObject private var themeManager = ThemeManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .environmentObject(cartStore)
                .environmentObject(chatManager)
                .environmentObject(notificationManager)
                .environmentObject(themeManager)
                .preferredColorScheme(themeManager.colorScheme)
                .onAppear {
                    notificationManager.requestPermission()
                }
        }
    }
}
