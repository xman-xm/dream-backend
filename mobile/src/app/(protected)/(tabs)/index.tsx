import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import updateLocale from "dayjs/plugin/updateLocale";

dayjs.extend(relativeTime);
dayjs.extend(updateLocale);

dayjs.updateLocale('en', {
  relativeTime: {
    future: "in %s",
    past: "%s",
    s: 'now',
    m: "1m ago",
    mm: "%dm ago",
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
import { View, Text, FlatList, RefreshControl } from "react-native";

import { apiFetch } from "../../../lib/api";
import { Image } from "expo-image";

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

export default function Page() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    <View className="bg-white px-6 py-4 border-b border-gray-200 mb-4">
      <Text className="text-2xl font-bold text-gray-900">Social App</Text>
    </View>
  );

  const renderItem = ({ item }: { item: Post }) => (
    <View className="bg-white mb-4 py-4 shadow-sm">
      <View className="flex-row items-center px-4 mb-3">
        <View className="bg-gray-200 w-10 h-10 rounded-full flex items-center justify-center mr-3 overflow-hidden">
          {item.author.avatarUrl ? (
            <Image source={{ uri: item.author.avatarUrl }} style={{ width: 40, height: 40 }} contentFit="cover" />
          ) : (
            <Text className="text-gray-500 font-medium">
              {(item.author.name?.[0] || item.author.username?.[0] || '?').toUpperCase()}
            </Text>
          )}
        </View>
        <View>
          <Text className="font-semibold flex  text-gray-900">{item.author.name || item.author.username || 'Unknown User'}</Text>
          {item.author.username && <Text className="text-gray-500 text-xs text-center items-center justify-center"> @{item.author.username}  •  <Text className="text-gray-500 text-xs font-bold">{dayjs(item.createdAt).fromNow(true)}</Text> </Text>}

        </View>
      </View>

      {/* Media */}
      {item.media && (
        <View className="w-full aspect-square bg-gray-100 mb-3">
          <Image
            source={{ uri: item.media }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover" // or contain
            transition={200}
          />
        </View>
      )}

      {/* Caption */}
      <View className="px-4">
        <Text className="text-gray-900 leading-relaxed">
          <Text className="font-semibold"> </Text>
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
    </View>
  );
}
