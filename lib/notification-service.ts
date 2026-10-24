import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/notifications";

export type NotificationInput = {
  recipientId: string;
  actorId: string;
  type: "FOLLOW" | "NEW_POST" | "LIKE" | "COMMENT";
  message: string;
  postId?: string;
};

export async function createNotifications(inputs: NotificationInput[]) {
  const notifications = inputs.filter((item) => item.recipientId !== item.actorId);
  if (!notifications.length) return;

  await prisma.notification.createMany({
    data: notifications.map(({ recipientId, actorId, type, message, postId }) => ({
      recipientId,
      actorId,
      type,
      message,
      postId,
    })),
  });

  const recipientIds = [...new Set(notifications.map((item) => item.recipientId))];
  const recipients = await prisma.user.findMany({
    where: { id: { in: recipientIds }, pushToken: { not: null } },
    select: { id: true, pushToken: true },
  });
  const tokensByRecipient = new Map(recipients.map((recipient) => [recipient.id, recipient.pushToken]));

  await Promise.all(notifications.map(async (notification) => {
    const token = tokensByRecipient.get(notification.recipientId);
    if (!token) return;
    const title = {
      FOLLOW: "New follower",
      NEW_POST: "New video",
      LIKE: "New like",
      COMMENT: "New comment",
    }[notification.type];
    await sendPushNotification([token], title, notification.message, {
      type: notification.type,
      postId: notification.postId,
      actorId: notification.actorId,
    });
  }));
}
