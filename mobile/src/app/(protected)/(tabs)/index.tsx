import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import updateLocale from "dayjs/plugin/updateLocale";

dayjs.extend(relativeTime);
dayjs.extend(updateLocale);

dayjs.updateLocale('en', {
  relativeTime: {
    future: "in %s",
    past: "%s",
    s: ' now',
    m: "1 min ago",
    mm: " %d min  ago",
    h: "1h ago",
    hh: "%dh ago",
    d: "1d ago",
    dd: "%dd ago",
    M: "1mo ago",
    MM: "%dmo ago",
    y: "1y ago",
    yy: "%dy ago"
  }
});

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

import { apiFetch, API_URL } from "../../../lib/api";
import { getToken } from "../../../lib/auth-store";
import { Image } from "expo-image";
import { FriendSuggestions } from "../../../components/FriendSuggestions";
import { CommentsModal } from "../../../components/CommentsModal";


type Author = {
  id: string;
  name?: string;
  username?: string;
  avatarUrl?: string;
};

type Post = {
  id: string;
  caption: string;
  media?: string;
  type?: 'IMAGE' | 'VIDEO';
  createdAt: string;
  author: Author;
};

import { useAuth } from "../../../context/AuthContext";

export default function Page() {
  const router = useRouter();
  const { token } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Token is now managed by AuthContext

  const fetchPosts = useCallback(async () => {
    try {
      // The API route is /api/post (Next.js route groups like (protected) are excluded from URL)
      const response = await apiFetch('/post');
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      } else {
        console.error('Failed to fetch posts');
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts();
  }, [fetchPosts]);


  const renderHeader = () => (
    <View>
      <View className="bg-white px-6 py-4 border-b border-gray-200 mb-2">
        <Text className="text-2xl font-bold text-gray-900 text-blue-600">Social App</Text>
      </View>
      <FriendSuggestions />
    </View>
  );

  const renderItem = ({ item }: { item: Post }) => (
    <View className="bg-white mb-4 py-4 shadow-sm">
      <View className="flex-row items-center px-4 mb-3">
        <TouchableOpacity
          className="flex-row items-center"
          onPress={() => router.push(`/(protected)/user/${item.author.id}`)}
        >
          <View className="bg-gray-200 w-10 h-10 rounded-full flex items-center justify-center mr-3 overflow-hidden border border-gray-100">
            {item.author.avatarUrl ? (
              <Image
                source={{
                  uri: item.author.avatarUrl.startsWith('http')
                    ? item.author.avatarUrl
                    : `${API_URL.replace('/api', '')}${item.author.avatarUrl}`,
                  headers: { Authorization: `Bearer ${token}` }
                }}
                style={{ width: 40, height: 40 }}
                contentFit="cover"
              />
            ) : (
              <Text className="text-gray-500 font-bold text-xs">
                {(item.author.name?.[0] || item.author.username?.[0] || '?').toUpperCase()}
              </Text>
            )}
          </View>
          <View>
            <Text className="font-bold text-[14px] text-gray-900">{item.author.name || item.author.username || 'Unknown User'}</Text>
            <Text className="text-gray-500 text-[11px]">{dayjs(item.createdAt).fromNow(true)}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Media */}
      {item.media && token && (
        <View className="w-full aspect-[9/16] bg-gray-100 mb-3">
          <Image
            source={{
              uri: item.media.startsWith('http') ? item.media : `${API_URL.replace('/api', '')}${item.media}`,
              headers: { Authorization: `Bearer ${token}` }
            }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover" // or contain
            transition={200}
          />
        </View>
      )}

      {/* Interaction Icons */}
      <View className="flex-row items-center px-4 py-3">
        <View className="flex-row items-center mr-4">
          <Text className="text-xl">❤️</Text>
        </View>
        <TouchableOpacity
          className="flex-row items-center mr-4"
          onPress={() => {
            setSelectedPostId(item.id);
            setCommentModalVisible(true);
          }}
        >
          <Text className="text-xl">💬</Text>
        </TouchableOpacity>
        <View className="flex-row items-center">
          <Text className="text-xl">✈️</Text>
        </View>
        <View className="flex-1" />
        <View>
          <Text className="text-xl">🔖</Text>
        </View>
      </View>

      {/* Caption */}
      <View className="px-4 pb-2">
        <Text className="text-gray-900 text-[14px] leading-5">

          {item.caption || '...'}
        </Text>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          !loading ? (
            <View className="p-8 items-center">
              <Text className="text-gray-500 text-center">No posts found.</Text>
              <Text className="text-gray-400 text-center text-sm mt-2">Pull down to refresh</Text>
            </View>
          ) : null
        }
      />

      <CommentsModal
        visible={commentModalVisible}
        onClose={() => setCommentModalVisible(false)}
        postId={selectedPostId || ''}
        onCommentAdded={fetchPosts}
      />
    </View>
  );
}
