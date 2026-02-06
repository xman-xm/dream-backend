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

import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

import { apiFetch, API_URL } from "../../../lib/api";
import { getToken } from "../../../lib/auth-store";
import { Image } from "expo-image";
import { SuggestedUsers } from "../../../components/SuggestedUsers";
import { CommentsModal } from "../../../components/CommentsModal";
import { useAuth } from "../../../context/AuthContext";
import { PostItem } from "../../../components/PostItem";

type Author = {
  id: string;
  name?: string;
  username?: string;
  avatarUrl?: string;
};

type Post = {
  id: string;
  caption: string | null;
  media: string;
  type: string;
  createdAt: string;
  author: Author;
  _count?: {
    likes: number;
    comments: number;
  };
  likes?: { id: string }[];
  isLiked?: boolean;
  isCommented?: boolean;
  // Special type for injection
  specialType?: 'SUGGESTIONS';
};

import { OfflineWrapper } from "../../../components/OfflineWrapper";
import { useAutoRetry } from "../../../hooks/useAutoRetry";

// ... existing imports

export default function Page() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination State
  const [cursor, setCursor] = useState<number | string | null>(0);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const loadPosts = useCallback(async (startCursor: number | string | null = 0, isRefresh = false) => {
    if (startCursor === null) return;

    try {
      // Pass cursor as string directly if it's an object/string, or number
      const cursorParam = typeof startCursor === 'string' ? startCursor : String(startCursor);
      const response = await apiFetch(`/post?cursor=${encodeURIComponent(cursorParam)}`);
      if (response.ok) {
        const data = await response.json();
        const newPosts: Post[] = data.posts || [];
        const nextCursor = data.nextCursor; // Might be null or object string

        setPosts(prev => {
          // Deduping logic: Create a map from existing posts
          const existingPostsMap = new Map((isRefresh ? [] : prev).map(p => [p.id, p]));

          // Add/Update with new posts
          newPosts.forEach(p => {
            existingPostsMap.set(p.id, p);
          });

          // Convert back to array
          let updated = Array.from(existingPostsMap.values());


          // Inject Suggestions if we have enough posts and haven't injected yet
          // Only injecting once for now at index 3
          const hasInjection = updated.some(p => p.specialType === 'SUGGESTIONS');
          if (!hasInjection && updated.length >= 3) {
            const head = updated.slice(0, 3);
            const tail = updated.slice(3);
            updated = [...head, { id: 'suggestions-injection', specialType: 'SUGGESTIONS' } as any, ...tail];
          }

          return updated;
        });

        setCursor(nextCursor);
        setHasMore(nextCursor !== null);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsFetchingMore(false);
    }
  }, []);

  useEffect(() => {
    loadPosts(0, true);
  }, [loadPosts]);

  // Auto Retry on connection restore
  useAutoRetry(() => {
    console.log('Auto-retrying feed...');
    loadPosts(0, true);
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setHasMore(true);
    setCursor(0);
    // Force reset posts
    // setPosts([]); // Optional: clear list or keep while loading
    loadPosts(0, true);
  }, [loadPosts]);

  const onEndReached = () => {
    if (!isFetchingMore && hasMore && cursor !== null && !loading) {
      setIsFetchingMore(true);
      loadPosts(cursor);
    }
  };

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
                isLiked: liked,
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

  const handlePostOptions = (post: Post) => {
    Alert.alert(
      "Post Options",
      "What would you like to do?",
      [
        {
          text: "Edit Caption",
          onPress: () => router.push(`/(protected)/post/edit/${post.id}`)
        },
        {
          text: "Delete Post",
          style: "destructive",
          onPress: () => confirmDelete(post.id)
        },
        {
          text: "Cancel",
          style: "cancel"
        }
      ]
    );
  };

  const confirmDelete = (postId: string) => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDeletePost(postId)
        }
      ]
    );
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const response = await apiFetch(`/post/${postId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        Alert.alert("Success", "Post deleted successfully.");
      } else {
        const data = await response.json();
        Alert.alert("Error", data.error || "Failed to delete post.");
      }
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert("Error", "Network error.");
    }
  };

  const renderHeader = () => (
    <View>
      <View className="bg-white px-6 py-4 border-b border-gray-200 mb-2">
        <Text className="text-2xl font-bold text-gray-900 text-blue-600">Home</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: Post }) => {
    if (item.specialType === 'SUGGESTIONS') {
      return (
        <View className="my-2 py-2 bg-gray-50 border-t border-b border-gray-100">
          <SuggestedUsers />
        </View>
      );
    }

    return (
      <PostItem
        post={item as any}
        token={token}
        currentUserId={user?.id}
        onLike={handleLike}
        onComment={(id) => {
          setSelectedPostId(id);
          setCommentModalVisible(true);
        }}
        onUserPress={(userId) => router.push(`/(protected)/user/${userId}`)}
        onOptionPress={handlePostOptions}
      />
    );
  };

  const renderFooter = () => {
    if (!isFetchingMore) return null;
    return (
      <View className="py-4">
        <ActivityIndicator color="#2563EB" />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <OfflineWrapper onRetry={() => loadPosts(0, true)}>
        <FlatList
          data={posts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={3}
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
          onCommentAdded={() => onRefresh()}
        />
      </OfflineWrapper>
    </View>
  );
}
