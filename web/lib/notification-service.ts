import { prisma } from "@/lib/prisma";

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

}
