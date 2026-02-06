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
import { View, Text, TouchableOpacity, FlatList, RefreshControl, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { apiFetch, API_URL } from "../../../lib/api";
import { getToken } from "../../../lib/auth-store";
import { Image } from "expo-image";
import { CommentsModal } from "../../../components/CommentsModal";

import { Ionicons } from "@expo/vector-icons";

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
};

import { OfflineWrapper } from "../../../components/OfflineWrapper";
import { useAutoRetry } from "../../../hooks/useAutoRetry";
import { PostItem } from "../../../components/PostItem";

// ... previous imports

export default function Profile() {
    const router = useRouter();
    const { user, signOut, token, refreshUserProfile } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [commentModalVisible, setCommentModalVisible] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

    const fetchUserPosts = async () => {
        try {
            if (!user?.id) return;
            const res = await apiFetch(`/post?userId=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                // Handle both new { posts: [], nextCursor } and old [] formats
                const postsData = data.posts || (Array.isArray(data) ? data : []);
                setPosts(postsData);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (user?.id) {
            fetchUserPosts();
        }
    }, [user?.id]);

    useAutoRetry(() => {
        if (user?.id) {
            console.log('Auto-retrying profile...');
            fetchUserPosts();
            refreshUserProfile();
        }
    });

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            fetchUserPosts(),
            refreshUserProfile()
        ]);
        setRefreshing(false);
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
                // Remove from local state
                setPosts(prev => prev.filter(p => p.id !== postId));
                // Refresh profile stats (post count)
                refreshUserProfile();
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
            {/* Profile Info Section */}
            <View className="bg-white px-6 py-6 border-b border-gray-200">
                {user && (
                    <View className="items-center mb-4">
                        <View className="w-24 h-24 rounded-full bg-gray-200 mb-4 overflow-hidden border-4 border-white shadow-sm items-center justify-center">
                            {user.avatarUrl ? (
                                <Image
                                    source={{
                                        uri: user.avatarUrl.startsWith('http')
                                            ? user.avatarUrl
                                            : `${API_URL.replace('/api', '')}${user.avatarUrl}`,
                                        headers: { Authorization: `Bearer ${token}` }
                                    }}
                                    style={{ width: '100%', height: '100%' }}
                                    contentFit="cover"
                                />
                            ) : (
                                <Text className="text-blue-600 font-bold text-3xl">
                                    {(user.name?.[0] || user.username?.[0] || user.email[0]).toUpperCase()}
                                </Text>
                            )}
                        </View>
                        <Text className="text-xl font-bold text-gray-900">{user.name || user.username || 'User'}</Text>
                        <Text className="text-gray-500 text-sm mb-1">@{user.username}</Text>
                        {user.bio && (
                            <Text className="text-gray-700 text-center px-8 mb-2 leading-5">
                                {user.bio}
                            </Text>
                        )}

                        <View className="flex-row justify-center mt-4 mb-4 space-x-8">
                            <View className="items-center px-4">
                                <Text className="font-bold text-lg text-gray-900">{user._count?.posts || 0}</Text>
                                <Text className="text-gray-500 text-sm">Posts</Text>
                            </View>
                            <View className="items-center px-4">
                                <Text className="font-bold text-lg text-gray-900">{user._count?.friends || 0}</Text>
                                <Text className="text-gray-500 text-sm">Friends</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={() => router.push("/(protected)/edit-profile")}
                            className="bg-blue-50 py-3 px-6 rounded-xl border border-blue-100 mt-2 mb-2 w-full items-center"
                        >
                            <Text className="text-blue-600 font-bold">Edit Profile</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={signOut}
                            className="py-3 px-6 rounded-xl mt-2"
                        >
                            <Text className="text-red-500 font-medium text-sm">Sign Out</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Posts Header */}
            <View className="bg-white px-6 py-3 border-b border-gray-200">
                <Text className="text-lg font-bold text-gray-900">My Posts</Text>
                <Text className="text-gray-500 text-sm">{posts.length} {posts.length === 1 ? 'post' : 'posts'}</Text>
            </View>
        </View>
    );

    const renderItem = ({ item }: { item: Post }) => (
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

    return (
        <View className="flex-1 bg-gray-50">
            <OfflineWrapper onRetry={onRefresh}>
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
                            <View className="p-8 items-center bg-white">
                                <Text className="text-gray-500 text-center">No posts yet.</Text>
                                <Text className="text-gray-400 text-center text-sm mt-2">Create your first post!</Text>
                            </View>
                        ) : null
                    }
                />

                <CommentsModal
                    visible={commentModalVisible}
                    onClose={() => setCommentModalVisible(false)}
                    postId={selectedPostId || ''}
                    onCommentAdded={fetchUserPosts}
                />
            </OfflineWrapper>
        </View>
    );
}
