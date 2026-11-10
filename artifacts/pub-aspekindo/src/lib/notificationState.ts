export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function isAppNotification(value: unknown): value is AppNotification {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppNotification>;
  return typeof candidate.id === "string"
    && typeof candidate.type === "string"
    && typeof candidate.title === "string"
    && typeof candidate.message === "string"
    && typeof candidate.is_read === "boolean"
    && typeof candidate.created_at === "string";
}

export function mergeNotifications(
  current: AppNotification[],
  incoming: AppNotification[],
  limit = Number.POSITIVE_INFINITY,
): AppNotification[] {
  const byId = new Map<string, AppNotification>();

  for (const notification of current) {
    if (isAppNotification(notification)) {
      byId.set(notification.id, notification);
    }
  }
  for (const notification of incoming) {
    if (!isAppNotification(notification)) continue;

    const previous = byId.get(notification.id);
    byId.set(notification.id, previous
      ? {
          ...previous,
          ...notification,
          // A stale realtime payload must not make a notification unread again.
          is_read: previous.is_read || notification.is_read,
        }
      : notification);
  }

  return [...byId.values()]
    .sort((a, b) => {
      const aTime = Date.parse(a.created_at);
      const bTime = Date.parse(b.created_at);
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    })
    .slice(0, limit);
}