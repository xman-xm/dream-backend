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
import { View, Text, TouchableOpacity, FlatList, RefreshControl } from "react-native";
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

export default function Profile() {
    const router = useRouter();
    const { user, signOut, token } = useAuth();
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
                setPosts(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchUserPosts();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchUserPosts();
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

    const renderItem = ({ item }: { item: Post }) => {
        const isLiked = item.likes && item.likes.length > 0;

        return (
            <View className="bg-white mb-4 py-4 shadow-sm">
                <View className="flex-row items-center px-4 mb-3">
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
                            contentFit="cover"
                            transition={200}
                        />
                    </View>
                )}

                {/* Interaction Icons */}
                <View className="flex-row items-center px-4 py-3">
                    <TouchableOpacity
                        className="flex-row items-center mr-5"
                        onPress={() => handleLike(item.id)}
                    >
                        <Ionicons
                            name={isLiked ? "heart" : "heart-outline"}
                            size={24}
                            color={isLiked ? "#ef4444" : "#000"}
                        />
                        {(item._count?.likes || 0) > 0 && (
                            <Text className="ml-1 text-sm font-medium">{item._count.likes}</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="flex-row items-center mr-5"
                        onPress={() => {
                            setSelectedPostId(item.id);
                            setCommentModalVisible(true);
                        }}
                    >
                        <Ionicons name="chatbubble-outline" size={24} color="#000" />
                        {(item._count?.comments || 0) > 0 && (
                            <Text className="ml-1 text-sm font-medium">{item._count.comments}</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity className="mr-5">
                        <Ionicons name="paper-plane-outline" size={24} color="#000" />
                    </TouchableOpacity>

                    <View className="flex-1" />

                    <TouchableOpacity>
                        <Ionicons name="bookmark-outline" size={24} color="#000" />
                    </TouchableOpacity>
                </View>

                {/* Caption */}
                <View className="px-4 pb-2">
                    <Text className="text-gray-900 text-[14px] leading-5">
                        {item.caption || '...'}
                    </Text>
                </View>
            </View>
        );
    };

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
        </View>
    );
}
