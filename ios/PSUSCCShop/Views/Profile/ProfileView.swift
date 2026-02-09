import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var authManager: AuthManager
    @Environment(\.dismiss) var dismiss

    @State private var profile = UserProfile()
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var error: String?
    @State private var saved = false

    var body: some View {
        NavigationStack {
            Form {
                // User Info
                Section {
                    HStack {
                        if let imageURL = authManager.currentUser?.image,
                           let url = URL(string: imageURL) {
                            AsyncImage(url: url) { image in
                                image.resizable().scaledToFill()
                            } placeholder: {
                                Image(systemName: "person.circle.fill")
                                    .font(.system(size: 50))
                            }
                            .frame(width: 60, height: 60)
                            .clipShape(.circle)
                        } else {
                            Image(systemName: "person.circle.fill")
                                .font(.system(size: 50))
                                .foregroundStyle(.secondary)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text(authManager.currentUser?.name ?? "User")
                                .font(.headline)
                            Text(authManager.currentUser?.email ?? "")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.leading, 8)
                    }
                }

                // Editable Info
                if isLoading {
                    Section {
                        ProgressView()
                    }
                } else {
                    Section("ข้อมูลส่วนตัว") {
                        TextField("ชื่อ-นามสกุล", text: Binding(
                            get: { profile.name ?? "" },
                            set: { profile.name = $0 }
                        ))
                        .textContentType(.name)

                        TextField("เบอร์โทรศัพท์", text: Binding(
                            get: { profile.phone ?? "" },
                            set: { profile.phone = $0 }
                        ))
                        .textContentType(.telephoneNumber)
                        .keyboardType(.phonePad)

                        TextField("Instagram", text: Binding(
                            get: { profile.instagram ?? "" },
                            set: { profile.instagram = $0 }
                        ))
                    }

                    Section("ที่อยู่จัดส่ง") {
                        TextEditor(text: Binding(
                            get: { profile.address ?? "" },
                            set: { profile.address = $0 }
                        ))
                        .frame(minHeight: 80)
                        .textContentType(.fullStreetAddress)
                    }

                    // Saved Addresses
                    if let addresses = profile.savedAddresses, !addresses.isEmpty {
                        Section("ที่อยู่ที่บันทึกไว้") {
                            ForEach(addresses) { addr in
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(addr.label)
                                            .font(.subheadline)
                                            .fontWeight(.medium)
                                        if addr.isDefault {
                                            Text("ค่าเริ่มต้น")
                                                .font(.caption2)
                                                .padding(.horizontal, 6)
                                                .padding(.vertical, 2)
                                                .background(Color.accentColor.opacity(0.2), in: Capsule())
                                        }
                                    }
                                    Text(addr.address)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                .padding(.vertical, 2)
                                .onTapGesture {
                                    profile.address = addr.address
                                }
                            }
                        }
                    }
                }

                // Save status
                if let error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }

                if saved {
                    Section {
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                            Text("บันทึกสำเร็จ")
                                .foregroundStyle(.green)
                        }
                    }
                }
            }
            .navigationTitle("โปรไฟล์")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ปิด") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("บันทึก") {
                        Task { await saveProfile() }
                    }
                    .disabled(isSaving)
                }
            }
            .task {
                await loadProfile()
            }
        }
    }

    private func loadProfile() async {
        guard let email = authManager.currentUser?.email else {
            isLoading = false
            return
        }

        do {
            profile = try await APIClient.shared.fetchProfile(email: email)
        } catch {
            // Use defaults
        }
        isLoading = false
    }

    private func saveProfile() async {
        guard let email = authManager.currentUser?.email else { return }
        isSaving = true
        error = nil
        saved = false

        do {
            try await APIClient.shared.saveProfile(email: email, profile: profile)
            saved = true
            Task {
                try? await Task.sleep(for: .seconds(2))
                saved = false
            }
        } catch {
            self.error = error.localizedDescription
        }

        isSaving = false
    }
}
