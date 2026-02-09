import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var themeManager: ThemeManager
    @EnvironmentObject var notificationManager: NotificationManager

    @State private var showSignOutAlert = false

    var body: some View {
        List {
            // Account
            Section("บัญชี") {
                HStack {
                    if let imageURL = authManager.currentUser?.image,
                       let url = URL(string: imageURL) {
                        AsyncImage(url: url) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            Image(systemName: "person.circle.fill")
                                .font(.largeTitle)
                        }
                        .frame(width: 44, height: 44)
                        .clipShape(.circle)
                    } else {
                        Image(systemName: "person.circle.fill")
                            .font(.largeTitle)
                            .foregroundStyle(.secondary)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(authManager.currentUser?.name ?? "User")
                            .font(.headline)
                        Text(authManager.currentUser?.email ?? "")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.leading, 4)
                }
            }

            // Appearance
            Section("การแสดงผล") {
                Picker("ธีม", selection: $themeManager.selectedScheme) {
                    Text("ตามระบบ").tag("system")
                    Text("สว่าง").tag("light")
                    Text("มืด").tag("dark")
                }
            }

            // Notifications
            Section("การแจ้งเตือน") {
                HStack {
                    Text("Push Notifications")
                    Spacer()
                    if notificationManager.isAuthorized {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    } else {
                        Button("เปิดใช้งาน") {
                            notificationManager.requestPermission()
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
                }

                if let token = notificationManager.deviceToken {
                    HStack {
                        Text("Device Token")
                            .font(.caption)
                        Spacer()
                        Text(String(token.prefix(20)) + "...")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .monospaced()
                    }
                }
            }

            // About
            Section("เกี่ยวกับ") {
                HStack {
                    Text("เวอร์ชัน")
                    Spacer()
                    Text("1.0.0")
                        .foregroundStyle(.secondary)
                }

                HStack {
                    Text("iOS")
                    Spacer()
                    Text(UIDevice.current.systemVersion)
                        .foregroundStyle(.secondary)
                }

                Link(destination: URL(string: "https://psusccshop.vercel.app/privacy")!) {
                    HStack {
                        Text("นโยบายความเป็นส่วนตัว")
                        Spacer()
                        Image(systemName: "arrow.up.right.square")
                            .foregroundStyle(.secondary)
                    }
                }
            }

            // Sign Out
            Section {
                Button(role: .destructive) {
                    showSignOutAlert = true
                } label: {
                    HStack {
                        Spacer()
                        Text("ออกจากระบบ")
                        Spacer()
                    }
                }
            }
        }
        .navigationTitle("ตั้งค่า")
        .alert("ออกจากระบบ?", isPresented: $showSignOutAlert) {
            Button("ยกเลิก", role: .cancel) {}
            Button("ออกจากระบบ", role: .destructive) {
                authManager.signOut()
            }
        } message: {
            Text("คุณต้องการออกจากระบบใช่หรือไม่?")
        }
    }
}
