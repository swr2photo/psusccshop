import SwiftUI

struct SupportChatView: View {
    @EnvironmentObject var chatManager: ChatManager
    @State private var showNewChat = false
    @State private var selectedTab = 0

    var body: some View {
        VStack(spacing: 0) {
            // Tabs
            Picker("", selection: $selectedTab) {
                Text("แชทปัจจุบัน").tag(0)
                Text("ประวัติ").tag(1)
            }
            .pickerStyle(.segmented)
            .padding()

            if selectedTab == 0 {
                activeChatContent
            } else {
                chatHistoryContent
            }
        }
        .navigationTitle("ติดต่อเรา")
        .toolbar {
            if chatManager.activeChat == nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showNewChat = true
                    } label: {
                        Image(systemName: "plus.bubble.fill")
                    }
                }
            }
        }
        .sheet(isPresented: $showNewChat) {
            NewChatView()
        }
        .task {
            await chatManager.loadActiveChat()
            await chatManager.loadHistory()
        }
    }

    @ViewBuilder
    private var activeChatContent: some View {
        if chatManager.isLoading {
            Spacer()
            ProgressView()
            Spacer()
        } else if let chat = chatManager.activeChat {
            ChatRoomView(chatSession: chat)
        } else {
            ContentUnavailableView {
                Label("ยังไม่มีแชท", systemImage: "bubble.left.and.bubble.right")
            } description: {
                Text("เริ่มแชทกับเจ้าหน้าที่ได้เลย")
            } actions: {
                Button("เริ่มแชทใหม่") {
                    showNewChat = true
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    @ViewBuilder
    private var chatHistoryContent: some View {
        if chatManager.chatHistory.isEmpty {
            ContentUnavailableView(
                "ยังไม่มีประวัติแชท",
                systemImage: "bubble.left.and.bubble.right"
            )
        } else {
            List(chatManager.chatHistory) { chat in
                Button {
                    Task {
                        await chatManager.loadChat(sessionId: chat.id)
                        selectedTab = 0
                    }
                } label: {
                    ChatHistoryRow(chat: chat)
                }
                .buttonStyle(.plain)
            }
            .listStyle(.plain)
        }
    }
}

// MARK: - Chat History Row

struct ChatHistoryRow: View {
    let chat: ChatSession

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(chat.subject ?? "แชทสนับสนุน")
                    .font(.subheadline)
                    .fontWeight(.medium)
                Spacer()
                StatusBadge(status: chat.status)
            }

            if let preview = chat.last_message_preview {
                Text(preview)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            HStack {
                Text(formatChatDate(chat.created_at))
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                Spacer()

                if let unread = chat.customer_unread_count, unread > 0 {
                    Text("\(unread)")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                        .frame(minWidth: 20, minHeight: 20)
                        .background(Color.red, in: .circle)
                }

                if let rating = chat.rating {
                    HStack(spacing: 2) {
                        ForEach(1...5, id: \.self) { star in
                            Image(systemName: star <= rating ? "star.fill" : "star")
                                .font(.caption2)
                                .foregroundStyle(.orange)
                        }
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func formatChatDate(_ dateStr: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: dateStr) else { return dateStr }

        let displayFormatter = DateFormatter()
        displayFormatter.locale = Locale(identifier: "th_TH")
        displayFormatter.dateStyle = .short
        displayFormatter.timeStyle = .short
        return displayFormatter.string(from: date)
    }
}

// MARK: - New Chat View

struct NewChatView: View {
    @EnvironmentObject var chatManager: ChatManager
    @Environment(\.dismiss) var dismiss

    @State private var subject = ""
    @State private var message = ""
    @State private var isSubmitting = false

    var body: some View {
        NavigationStack {
            Form {
                Section("หัวข้อ") {
                    TextField("หัวข้อที่ต้องการสอบถาม", text: $subject)
                }

                Section("ข้อความ") {
                    TextEditor(text: $message)
                        .frame(minHeight: 120)
                }
            }
            .navigationTitle("แชทใหม่")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ยกเลิก") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("ส่ง") {
                        Task {
                            isSubmitting = true
                            await chatManager.createChat(
                                subject: subject.isEmpty ? nil : subject,
                                message: message
                            )
                            isSubmitting = false
                            dismiss()
                        }
                    }
                    .disabled(message.isEmpty || isSubmitting)
                }
            }
        }
    }
}

// MARK: - Chat Room View

struct ChatRoomView: View {
    @EnvironmentObject var chatManager: ChatManager
    let chatSession: ChatSession

    @State private var newMessage = ""
    @State private var isSending = false
    @FocusState private var isInputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Chat Header
            chatHeader

            Divider()

            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(chatManager.messages) { message in
                            MessageBubble(message: message)
                                .id(message.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: chatManager.messages.count) {
                    if let lastId = chatManager.messages.last?.id {
                        withAnimation {
                            proxy.scrollTo(lastId, anchor: .bottom)
                        }
                    }
                }
            }

            Divider()

            // Input
            if chatSession.status != "closed" {
                messageInput
            } else {
                Text("แชทนี้ปิดแล้ว")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding()
            }
        }
        .onAppear {
            chatManager.startPolling()
        }
        .onDisappear {
            chatManager.stopPolling()
        }
    }

    private var chatHeader: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading) {
                Text(chatSession.subject ?? "แชทสนับสนุน")
                    .font(.subheadline)
                    .fontWeight(.semibold)

                HStack(spacing: 4) {
                    Circle()
                        .fill(chatSession.status == "active" ? Color.green : Color.gray)
                        .frame(width: 6, height: 6)
                    Text(chatSession.admin_name ?? "เจ้าหน้าที่")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            StatusBadge(status: chatSession.status)
        }
        .padding()
        .background(Color(.systemGray6))
    }

    private var messageInput: some View {
        HStack(spacing: 8) {
            TextField("พิมพ์ข้อความ...", text: $newMessage, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(1...4)
                .focused($isInputFocused)

            Button {
                guard !newMessage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
                let text = newMessage
                newMessage = ""
                Task {
                    await chatManager.sendMessage(text)
                }
            } label: {
                Image(systemName: "paperplane.fill")
                    .font(.title3)
                    .foregroundStyle(newMessage.isEmpty ? .secondary : .tint)
            }
            .disabled(newMessage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.regularMaterial)
    }
}

// MARK: - Message Bubble

struct MessageBubble: View {
    let message: ChatMessage

    var body: some View {
        if message.isSystem {
            systemMessage
        } else {
            userMessage
        }
    }

    private var systemMessage: some View {
        Text(message.message)
            .font(.caption)
            .foregroundStyle(.secondary)
            .padding(.vertical, 4)
            .frame(maxWidth: .infinity)
    }

    private var userMessage: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if message.isCustomer {
                Spacer(minLength: 60)
            } else {
                // Admin avatar
                if let avatarURL = message.sender_avatar,
                   let url = URL(string: avatarURL) {
                    AsyncImage(url: url) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Image(systemName: "person.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .frame(width: 28, height: 28)
                    .clipShape(.circle)
                } else {
                    Image(systemName: "person.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
            }

            VStack(alignment: message.isCustomer ? .trailing : .leading, spacing: 2) {
                if !message.isCustomer, let name = message.sender_name {
                    Text(name)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Text(message.message)
                    .font(.subheadline)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(
                        message.isCustomer ? Color.accentColor : Color(.systemGray5),
                        in: ChatBubbleShape(isFromUser: message.isCustomer)
                    )
                    .foregroundStyle(message.isCustomer ? .white : .primary)

                HStack(spacing: 4) {
                    if let timestamp = message.timestamp {
                        Text(formatMessageTime(timestamp))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    if message.isCustomer && (message.is_read ?? false) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if !message.isCustomer {
                Spacer(minLength: 60)
            }
        }
    }

    private func formatMessageTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Chat Bubble Shape

struct ChatBubbleShape: Shape {
    let isFromUser: Bool

    func path(in rect: CGRect) -> Path {
        let radius: CGFloat = 16
        let tailSize: CGFloat = 6

        var path = Path()

        if isFromUser {
            path.addRoundedRect(in: CGRect(
                x: rect.minX,
                y: rect.minY,
                width: rect.width - tailSize,
                height: rect.height
            ), cornerSize: CGSize(width: radius, height: radius))
        } else {
            path.addRoundedRect(in: CGRect(
                x: rect.minX + tailSize,
                y: rect.minY,
                width: rect.width - tailSize,
                height: rect.height
            ), cornerSize: CGSize(width: radius, height: radius))
        }

        return path
    }
}
