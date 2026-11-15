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
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Alert, ActivityIndicator, Share, useWindowDimensions, ViewToken } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { apiFetch, API_URL } from "../../../lib/api";
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
  aiDescription?: string | null;
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [feedError, setFeedError] = useState<string | null>(null);

  const loadPosts = useCallback(async (startCursor: number | string | null = 0, isRefresh = false) => {
    if (startCursor === null) return;

    try {
      // Pass cursor as string directly if it's an object/string, or number
      const cursorParam = typeof startCursor === 'string' ? startCursor : String(startCursor);
      const response = await apiFetch(`/post?cursor=${encodeURIComponent(cursorParam)}`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Your feed could not be loaded.");
      }
      const data = await response.json();
      setFeedError(null);
      const newPosts: Post[] = data.posts || [];
      const nextCursor = data.nextCursor;

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
    } catch (error) {
      console.error('Error fetching posts:', error);
      setFeedError(error instanceof Error ? error.message : "Your feed could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsFetchingMore(false);
    }
  }, []);

  useEffect(() => {
    loadPosts(0, true);
  }, [loadPosts]);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/follows")
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setFollowingIds(new Set((data.following || []).map((person: { id: string }) => person.id)));
      })
      .catch((error) => console.warn("Could not load following state:", error));
    return () => { cancelled = true; };
  }, []);

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

  const handleFollowToggle = async (authorId: string) => {
    const wasFollowing = followingIds.has(authorId);
    setFollowingIds((current) => {
      const next = new Set(current);
      if (wasFollowing) next.delete(authorId);
      else next.add(authorId);
      return next;
    });

    try {
      const response = await apiFetch(
        wasFollowing ? `/follows?followingId=${encodeURIComponent(authorId)}` : "/follows",
        {
          method: wasFollowing ? "DELETE" : "POST",
          ...(wasFollowing ? {} : { body: JSON.stringify({ targetUserId: authorId }) }),
        },
      );
      if (!response.ok) throw new Error("Could not update follow status.");
      await loadPosts(0, true);
    } catch (error) {
      setFollowingIds((current) => {
        const next = new Set(current);
        if (wasFollowing) next.add(authorId);
        else next.delete(authorId);
        return next;
      });
      Alert.alert("Follow update failed", error instanceof Error ? error.message : "Please try again.");
    }
  };

  const handleShare = async (post: Post) => {
    const creator = post.author.username ? `@${post.author.username}` : post.author.name || "a creator";
    const message = [post.caption, `Shared by ${creator} on SocialApp`].filter(Boolean).join("\n\n");
    try {
      await Share.share({ message });
    } catch (error) {
      console.warn("Could not open share sheet:", error);
    }
  };

  const handleLike = async (postId: string) => {
    const previousPost = posts.find((post) => post.id === postId);
    if (!previousPost) return;
    const wasLiked = Boolean(previousPost.isLiked || previousPost.likes?.length);
    setPosts((current) => current.map((post) => post.id === postId ? {
      ...post,
      isLiked: !wasLiked,
      _count: {
        likes: Math.max(0, (post._count?.likes || 0) + (wasLiked ? -1 : 1)),
        comments: post._count?.comments || 0,
      },
    } : post));

    try {
      const response = await apiFetch(`/post/${postId}/like`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error("Could not update your like.");
      const { liked } = await response.json();
      if (liked === wasLiked) {
        setPosts((current) => current.map((post) => post.id === postId ? {
          ...post,
          isLiked: liked,
          _count: {
            likes: Math.max(0, (post._count?.likes || 0) + (liked ? 1 : -1)),
            comments: post._count?.comments || 0,
          },
        } : post));
      }
    } catch (error) {
      console.error('Like error:', error);
      setPosts((current) => current.map((post) => post.id === postId ? previousPost : post));
      Alert.alert("Like not saved", "Check your connection and try again.");
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

  const renderItem = ({ item }: { item: Post }) => {
    if (item.specialType === 'SUGGESTIONS') {
      return (
        <View style={{ height: screenHeight }} className="bg-[#111111] justify-center">
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
        isFollowing={followingIds.has(item.author.id)}
        onFollow={handleFollowToggle}
        onShare={handleShare}
        onComment={(id) => {
          setSelectedPostId(id);
          setCommentModalVisible(true);
        }}
        onUserPress={(userId) => router.push(`/(protected)/user/${userId}`)}
        onOptionPress={handlePostOptions}
        immersive
        immersiveHeight={screenHeight}
        isActive={item.id === activePostId}
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

  const handleViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visiblePost = viewableItems.find(({ item }) => item && !(item as Post).specialType)?.item as Post | undefined;
    setActivePostId(visiblePost?.id || null);
  }).current;

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <OfflineWrapper onRetry={() => loadPosts(0, true)}>
        <FlatList
          data={posts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListFooterComponent={renderFooter}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={3}
          contentContainerStyle={{ backgroundColor: '#000' }}
          ListEmptyComponent={
            <View style={{ height: screenHeight }} className="px-8 items-center justify-center bg-black">
              {loading ? (
                <>
                  <ActivityIndicator size="large" color="#c4b5fd" />
                  <Text className="text-white/70 text-sm mt-4">Loading your feed…</Text>
                </>
              ) : feedError ? (
                <>
                  <View className="w-16 h-16 rounded-2xl bg-white/[0.06] items-center justify-center mb-5">
                    <Ionicons name="cloud-offline-outline" size={28} color="#c4b5fd" />
                  </View>
                  <Text className="text-white text-xl font-bold text-center">Your feed didn’t load</Text>
                  <Text className="text-white/60 text-sm text-center leading-5 mt-2">{feedError}</Text>
                  <TouchableOpacity onPress={() => loadPosts(0, true)} className="mt-6 px-6 py-3 rounded-full bg-white">
                    <Text className="text-black font-bold">Try again</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View className="w-16 h-16 rounded-2xl bg-violet-300/10 items-center justify-center mb-5">
                    <Ionicons name="sparkles" size={28} color="#c4b5fd" />
                  </View>
                  <Text className="text-white text-xl font-bold text-center">Your next idea starts here</Text>
                  <Text className="text-white/60 text-sm text-center leading-5 mt-2">Create an AI video or find creators to shape a feed that feels like yours.</Text>
                  <TouchableOpacity onPress={() => router.push("/(protected)/create")} className="mt-6 px-6 py-3 rounded-full bg-white flex-row items-center">
                    <Ionicons name="sparkles" size={16} color="#171717" />
                    <Text className="text-black font-bold ml-2">Create with AI</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push("/(protected)/(tabs)/search")} className="mt-4 px-6 py-3 rounded-full border border-white/20">
                    <Text className="text-white font-semibold">Discover creators</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          }
        />

        <View className="absolute left-0 right-0 flex-row items-center justify-center" style={{ top: insets.top + 8 }}>
          <View className="items-center">
            <Text className="text-white text-lg font-extrabold">For You</Text>
            <View className="flex-row items-center mt-0.5">
              <Ionicons name="sparkles" size={11} color="#c4b5fd" />
              <Text className="text-white/75 text-[9px] font-bold tracking-[1.4px] ml-1">AI-PERSONALIZED</Text>
            </View>
          </View>
          <TouchableOpacity
            className="absolute right-5 w-10 h-10 rounded-full bg-black/25 items-center justify-center"
            onPress={() => router.push("/(protected)/(tabs)/search")}
            accessibilityRole="button"
            accessibilityLabel="Search creators and posts"
          >
            <Ionicons name="search-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

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
