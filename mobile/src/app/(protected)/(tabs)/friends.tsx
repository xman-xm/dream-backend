import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { apiFetch, API_URL } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";

dayjs.extend(relativeTime);

type InboxNotification = {
  id: string;
  type: "FOLLOW" | "NEW_POST" | "LIKE" | "COMMENT";
  message: string;
  createdAt: string;
  readAt: string | null;
  actor: { id: string; username: string; name: string | null; avatarUrl: string | null };
  post: { id: string; media: string; type: string; caption: string | null } | null;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/notifications");
      if (!response.ok) throw new Error("Could not load notifications");
      const data = await response.json();
      setItems(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error("Notifications load failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (notification: InboxNotification) => {
    if (notification.readAt) return;
    setItems((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await apiFetch("/notifications", { method: "PATCH", body: JSON.stringify({ notificationId: notification.id }) });
    } catch (error) {
      console.warn("Could not mark notification read:", error);
    }
  };

  const markAllRead = async () => {
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await apiFetch("/notifications", { method: "PATCH", body: JSON.stringify({ markAllRead: true }) });
    } catch (error) {
      console.warn("Could not mark notifications read:", error);
    }
  };

  const openNotification = async (notification: InboxNotification) => {
    await markRead(notification);
    router.push(`/(protected)/user/${notification.actor.id}`);
  };

  const renderItem = ({ item }: { item: InboxNotification }) => {
    const avatarUrl = item.actor.avatarUrl
      ? (item.actor.avatarUrl.startsWith("http") ? item.actor.avatarUrl : `${API_URL.replace("/api", "")}${item.actor.avatarUrl}`)
      : null;
    const iconName = item.type === "FOLLOW" ? "person-add" : item.type === "NEW_POST" ? "play" : item.type === "LIKE" ? "heart" : "chatbubble";
    const videoUri = item.post?.media
      ? (item.post.media.startsWith("http") ? item.post.media : `${API_URL.replace("/api", "")}${item.post.media}`)
      : null;

    return (
      <TouchableOpacity onPress={() => void openNotification(item)} className={`flex-row items-center px-4 py-4 border-b border-zinc-800 ${item.readAt ? "bg-[#090b10]" : "bg-[#141923]"}`}>
        <View className="w-12 h-12 rounded-full bg-zinc-800 overflow-visible items-center justify-center mr-3">
          {avatarUrl ? <Image source={{ uri: avatarUrl, headers: token ? { Authorization: `Bearer ${token}` } : undefined }} style={{ width: 48, height: 48, borderRadius: 24 }} contentFit="cover" /> : <Text className="text-violet-300 font-bold">{(item.actor.name?.[0] || item.actor.username[0] || "?").toUpperCase()}</Text>}
          <View className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full bg-violet-500 border-2 border-[#090b10] items-center justify-center"><Ionicons name={iconName as "play"} size={10} color="#fff" /></View>
        </View>
        <View className="flex-1 mr-2">
          <Text className="text-zinc-300 text-sm leading-5"><Text className="text-white font-bold">{item.actor.name || `@${item.actor.username}`}</Text>{" "}{item.message}</Text>
          <Text className="text-zinc-500 text-xs mt-1">{dayjs(item.createdAt).fromNow()}</Text>
        </View>
        {!item.readAt ? <View className="w-2 h-2 rounded-full bg-violet-400 mr-2" /> : null}
        {videoUri ? <Image source={{ uri: videoUri, headers: token ? { Authorization: `Bearer ${token}` } : undefined }} style={{ width: 42, height: 56, borderRadius: 8 }} contentFit="cover" /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-[#090b10] pt-12">
      <View className="px-5 pb-4 flex-row items-center justify-between border-b border-zinc-800 bg-[#101318]">
        <View>
          <Text className="text-zinc-100 text-2xl font-bold">Activity</Text>
          <Text className="text-zinc-500 text-xs mt-1">Follows and updates from creators</Text>
        </View>
        {unreadCount > 0 ? <TouchableOpacity onPress={() => void markAllRead()}><Text className="text-violet-300 text-sm font-semibold">Mark all read</Text></TouchableOpacity> : null}
      </View>
      {loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="#a78bfa" size="large" /></View> : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#a78bfa" />}
          ListEmptyComponent={<View className="items-center justify-center py-24 px-8"><View className="w-16 h-16 rounded-2xl bg-[#151922] items-center justify-center mb-4"><Ionicons name="notifications-outline" size={28} color="#8b91a1" /></View><Text className="text-zinc-100 font-bold text-lg">You’re all caught up</Text><Text className="text-zinc-500 text-sm text-center mt-2">When someone follows you or a creator posts a video, you’ll see it here.</Text></View>}
        />
      )}
    </View>
  );
}
