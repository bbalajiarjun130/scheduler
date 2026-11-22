import type { NotificationView } from "@scheduler/shared";
import { api } from "./apiClient";

export function fetchNotifications() {
  return api.get<{ notifications: NotificationView[] }>("/notifications").then((r) => r.notifications);
}

export function fetchUnreadCount() {
  return api.get<{ count: number }>("/notifications/unread-count").then((r) => r.count);
}

export function markNotificationRead(id: string) {
  return api.post<{ notification: NotificationView }>(`/notifications/${id}/read`).then((r) => r.notification);
}

export function markAllNotificationsRead() {
  return api.post<void>("/notifications/read-all");
}
