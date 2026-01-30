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
  _count?: {
    likes: number;
    comments: number;
  };
  likes?: { id: string }[];
};

import { useAuth } from "../../../context/AuthContext";

import { PostItem } from "../../../components/PostItem";

export default function Page() {
  const router = useRouter();
  const { token } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      const response = await apiFetch('/post');
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
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

  const handleLike = async (postId: string) => {
    try {
      const response = await apiFetch(`/post/${postId}/like`, {
        method: 'POST'
      });

      if (response.ok) {
        const { liked } = await response.json();

        // Update local state optimistically
        setPosts(prevPosts =>
          prevPosts.map(post =>
            post.id === postId
              ? {
                ...post,
                _count: {
                  ...post._count,
                  likes: liked
                    ? (post._count?.likes || 0) + 1
                    : Math.max((post._count?.likes || 0) - 1, 0),
                  comments: post._count?.comments || 0
                },
                likes: liked ? [{ id: 'temp' }] : []
              }
              : post
          )
        );
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const renderHeader = () => (
    <View>
      <View className="bg-white px-6 py-4 border-b border-gray-200 mb-2">
        <Text className="text-2xl font-bold text-gray-900 text-blue-600">Social App</Text>
      </View>
      <FriendSuggestions />
    </View>
  );

  const renderItem = ({ item }: { item: Post }) => (
    <PostItem
      post={item as any}
      token={token}
      onLike={handleLike}
      onComment={(id) => {
        setSelectedPostId(id);
        setCommentModalVisible(true);
      }}
      onUserPress={(userId) => router.push(`/(protected)/user/${userId}`)}
    />
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
