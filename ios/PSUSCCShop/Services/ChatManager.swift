import SwiftUI

@MainActor
final class ChatManager: ObservableObject {
    @Published var activeChat: ChatSession?
    @Published var chatHistory: [ChatSession] = []
    @Published var messages: [ChatMessage] = []
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIClient.shared
    private var pollingTask: Task<Void, Never>?

    func loadActiveChat() async {
        isLoading = true
        defer { isLoading = false }

        do {
            activeChat = try await api.fetchActiveChat()
            if let chatId = activeChat?.id {
                let detail = try await api.fetchChatMessages(sessionId: chatId)
                messages = detail.messages ?? []
                activeChat = detail
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadHistory() async {
        do {
            chatHistory = try await api.fetchChatHistory()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func createChat(subject: String?, message: String) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let chat = try await api.createChat(subject: subject, message: message)
            activeChat = chat
            messages = chat.messages ?? []
            startPolling()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func sendMessage(_ text: String) async {
        guard let chatId = activeChat?.id else { return }

        // Optimistic UI update
        let tempMessage = ChatMessage(
            id: UUID().uuidString,
            session_id: chatId,
            sender: "customer",
            sender_email: AuthManager.shared.currentUser?.email,
            sender_name: AuthManager.shared.currentUser?.name,
            sender_avatar: AuthManager.shared.currentUser?.image,
            message: text,
            created_at: ISO8601DateFormatter().string(from: Date()),
            is_read: false,
            read_at: nil,
            is_unsent: nil
        )
        messages.append(tempMessage)

        do {
            try await api.sendChatMessage(sessionId: chatId, message: text)
            // Refresh to get server-assigned message
            await refreshMessages()
        } catch {
            // Mark as failed
            if let index = messages.firstIndex(where: { $0.id == tempMessage.id }) {
                messages.remove(at: index)
            }
            self.error = error.localizedDescription
        }
    }

    func refreshMessages() async {
        guard let chatId = activeChat?.id else { return }

        do {
            let detail = try await api.fetchChatMessages(sessionId: chatId)
            messages = detail.messages ?? []
            activeChat = detail
        } catch {
            // Silently fail on refresh
        }
    }

    func loadChat(sessionId: String) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let detail = try await api.fetchChatMessages(sessionId: sessionId)
            activeChat = detail
            messages = detail.messages ?? []
            startPolling()
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Polling

    func startPolling() {
        pollingTask?.cancel()
        pollingTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5))
                guard !Task.isCancelled else { break }
                await refreshMessages()
            }
        }
    }

    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }
}
