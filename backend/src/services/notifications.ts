export type NotificationChannel = 'email' | 'push' | 'in_app';

export type NotificationPayload = {
  userId: string;
  title: string;
  body: string;
  channel?: NotificationChannel;
};

export async function sendNotification(payload: NotificationPayload): Promise<{ queued: boolean }> {
  console.log(
    JSON.stringify({
      event: 'notification_stub',
      userId: payload.userId,
      title: payload.title,
      channel: payload.channel ?? 'in_app',
    })
  );
  return { queued: true };
}
