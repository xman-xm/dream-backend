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

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { apiFetch, API_URL } from "../../../lib/api";
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

type UserProfile = {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    _count?: {
        posts: number;
        friends: number;
    };
};

type FriendshipStatus = 'NONE' | 'FRIENDS' | 'SENT_REQUEST' | 'RECEIVED_REQUEST' | 'SELF';

export default function UserProfileScreen() {
    const { id } = useLocalSearchParams();
    console.log('[Mobile] UserProfileScreen mounted with ID:', id);
    const router = useRouter();
    const { token, user: currentUser } = useAuth();

    // Safety check just in case, though file path ensures it's protected
    if (!token) return null;

    const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
    const [status, setStatus] = useState<FriendshipStatus>('NONE');
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [commentModalVisible, setCommentModalVisible] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

    const userId = Array.isArray(id) ? id[0] : id;

    const fetchUserProfile = async () => {
        try {
            if (!userId) return;
            const res = await apiFetch(`/user/${userId}`);
            if (res.ok) {
                const data = await res.json();
                setProfileUser(data.user);
                setStatus(data.status);
            } else {
                Alert.alert("Error", "Could not fetch user profile");
                router.back();
            }
        } catch (error) {
            console.error('[Mobile] fetchUserProfile error:', error);
        }
    };

    const fetchUserPosts = async () => {
        try {
            if (!userId) return;
            const res = await apiFetch(`/post?userId=${userId}`);
            if (res.ok) {
                const data = await res.json();
                setPosts(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const loadData = async () => {
        setLoading(true);
        await Promise.all([fetchUserProfile(), fetchUserPosts()]);
        setLoading(false);
    };

    useEffect(() => {
        if (userId) {
            loadData();
        }
    }, [userId]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchUserProfile(), fetchUserPosts()]);
        setRefreshing(false);
    };

    const handleFriendAction = async () => {
        if (!userId) return;

        try {
            let res;
            if (status === 'NONE') {
                // Send Request
                res = await apiFetch('/friends', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ addresseeId: userId })
                });
                if (res.ok) setStatus('SENT_REQUEST');
            } else if (status === 'SENT_REQUEST') {
                // Cancel Request
                res = await apiFetch(`/friends?targetId=${userId}`, {
                    method: 'DELETE'
                });
                if (res.ok) setStatus('NONE');
            } else if (status === 'RECEIVED_REQUEST') {
                // Accept Request
                res = await apiFetch('/friends', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requesterId: userId, status: 'ACCEPTED' })
                });
                if (res.ok) setStatus('FRIENDS');
            } else if (status === 'FRIENDS') {
                // Unfriend
                Alert.alert(
                    "Unfriend",
                    `Are you sure you want to remove ${profileUser?.name || profileUser?.username} as a friend?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Unfriend",
                            style: 'destructive',
                            onPress: async () => {
                                const res = await apiFetch(`/friends?targetId=${userId}`, {
                                    method: 'DELETE'
                                });
                                if (res.ok) setStatus('NONE');
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error("Action failed", error);
            Alert.alert("Error", "Action failed. Please try again.");
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
            <View className="bg-white px-6 py-6 border-b border-gray-200">
                {profileUser ? (
                    <View className="items-center mb-4">
                        <View className="w-24 h-24 rounded-full bg-gray-200 mb-4 overflow-hidden border-4 border-white shadow-sm items-center justify-center">
                            {profileUser.avatarUrl ? (
                                <Image
                                    source={{
                                        uri: profileUser.avatarUrl.startsWith('http')
                                            ? profileUser.avatarUrl
                                            : `${API_URL.replace('/api', '')}${profileUser.avatarUrl}`,
                                        headers: { Authorization: `Bearer ${token}` }
                                    }}
                                    style={{ width: '100%', height: '100%' }}
                                    contentFit="cover"
                                />
                            ) : (
                                <Text className="text-blue-600 font-bold text-3xl">
                                    {(profileUser.name?.[0] || profileUser.username?.[0] || '?').toUpperCase()}
                                </Text>
                            )}
                        </View>
                        <Text className="text-xl font-bold text-gray-900">{profileUser.name || profileUser.username}</Text>
                        <Text className="text-gray-500 text-sm mb-1">@{profileUser.username}</Text>
                        {profileUser.bio && (
                            <Text className="text-gray-700 text-center px-8 mb-2 leading-5">
                                {profileUser.bio}
                            </Text>
                        )}

                        <View className="flex-row justify-center mt-4 mb-2 space-x-8">
                            <View className="items-center px-4">
                                <Text className="font-bold text-lg text-gray-900">{profileUser._count?.posts || 0}</Text>
                                <Text className="text-gray-500 text-sm">Posts</Text>
                            </View>
                            <View className="items-center px-4">
                                <Text className="font-bold text-lg text-gray-900">{profileUser._count?.friends || 0}</Text>
                                <Text className="text-gray-500 text-sm">Friends</Text>
                            </View>
                        </View>

                        {/* Dynamic Action Button */}
                        {status !== 'SELF' && (
                            <TouchableOpacity
                                onPress={handleFriendAction}
                                className={`py-3 px-6 rounded-xl mt-4 w-full items-center ${status === 'FRIENDS' ? 'bg-gray-100 border border-gray-200' :
                                    status === 'SENT_REQUEST' ? 'bg-gray-100 border border-gray-200' :
                                        'bg-blue-600'
                                    }`}
                            >
                                <Text className={`font-bold ${status === 'FRIENDS' || status === 'SENT_REQUEST' ? 'text-gray-700' : 'text-white'
                                    }`}>
                                    {status === 'NONE' && "Add Friend"}
                                    {status === 'FRIENDS' && "Friends"}
                                    {status === 'SENT_REQUEST' && "Request Sent"}
                                    {status === 'RECEIVED_REQUEST' && "Accept Request"}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {status === 'SELF' && (
                            <TouchableOpacity
                                onPress={() => router.push("/(protected)/edit-profile")}
                                className="bg-blue-50 py-3 px-6 rounded-xl border border-blue-100 mt-4 w-full items-center"
                            >
                                <Text className="text-blue-600 font-bold">Edit Profile</Text>
                            </TouchableOpacity>
                        )}

                    </View>
                ) : (
                    <ActivityIndicator />
                )}
            </View>

            {/* Posts Header */}
            <View className="bg-white px-6 py-3 border-b border-gray-200 mt-2">
                <Text className="text-lg font-bold text-gray-900">Posts</Text>
            </View>
        </View>
    );

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

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            {/* Simple Back Header */}
            <View className="bg-white px-4 pt-12 pb-3 border-b border-gray-200 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text className="font-bold text-lg text-gray-900">
                    {profileUser?.username || "Profile"}
                </Text>
            </View>

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
