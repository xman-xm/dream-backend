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
import { View, Text, TouchableOpacity, FlatList, RefreshControl, Alert, Modal, Pressable, Share } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { apiFetch, API_URL } from "../../../lib/api";
import { getToken } from "../../../lib/auth-store";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { CommentsModal } from "../../../components/CommentsModal";
import { VideoPlayground, VideoPlaygroundTab } from "../../../components/VideoPlayground";

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
    aiDescription?: string | null;
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
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);
    const [profileTab, setProfileTab] = useState<"posts" | "videos">("posts");

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

    const totalLikes = posts.reduce((total, post) => total + (post._count?.likes || 0), 0);
    const videoPosts = posts.filter((post) => post.type === "VIDEO");

    const navigateFromVideo = (tab: VideoPlaygroundTab) => {
        setSelectedVideoIndex(null);
        const routes = {
            home: "/(protected)/(tabs)",
            search: "/(protected)/(tabs)/search",
            create: "/(protected)/create",
            notifications: "/(protected)/(tabs)/friends",
            profile: "/(protected)/(tabs)/profile",
        } as const;
        router.push(routes[tab]);
    };

    const handleShareProfile = async () => {
        await Share.share({
            message: `Check out @${user?.username || 'this profile'}`,
        });
    };

    const showProfileOptions = () => {
        Alert.alert("Account", undefined, [
            { text: "Edit profile", onPress: () => router.push("/(protected)/edit-profile") },
            { text: "Sign out", style: "destructive", onPress: () => void signOut() },
            { text: "Cancel", style: "cancel" },
        ]);
    };

    const renderHeader = () => (
        <View>
            {/* Profile Info Section */}
            <View className="bg-black px-5 pt-5 pb-4">
                <View className="flex-row items-center justify-between mb-5">
                    <View className="w-10" />
                    <Text className="text-white text-base font-bold">{user?.username || 'profile'}</Text>
                    <TouchableOpacity onPress={showProfileOptions} className="w-10 h-10 items-center justify-center" accessibilityRole="button" accessibilityLabel="Account options">
                        <Ionicons name="menu-outline" size={25} color="#fff" />
                    </TouchableOpacity>
                </View>
                {user && (
                    <View className="items-center mb-4">
                        <View className="w-24 h-24 rounded-full bg-zinc-800 mb-3 overflow-hidden border border-zinc-600 items-center justify-center">
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
                        <Text className="text-xl font-bold text-white">{user.name || user.username || 'User'}</Text>
                        <Text className="text-zinc-400 text-sm mb-3">@{user.username}</Text>
                        {user.bio && (
                            <Text className="text-zinc-300 text-center px-8 mb-3">
                                {user.bio}
                            </Text>
                        )}

                        <View className="flex-row justify-center mb-4">
                            <View className="items-center px-5">
                                <Text className="font-bold text-lg text-white">{totalLikes}</Text>
                                <Text className="text-zinc-400 text-xs">Likes</Text>
                            </View>
                            <View className="items-center px-5">
                                <Text className="font-bold text-lg text-white">{user._count?.posts || 0}</Text>
                                <Text className="text-zinc-400 text-xs">Posts</Text>
                            </View>
                            <View className="items-center px-5">
                                <Text className="font-bold text-lg text-white">{user._count?.followers || 0}</Text>
                                <Text className="text-zinc-400 text-xs">Followers</Text>
                            </View>
                        </View>

                        <View className="flex-row items-center justify-center mb-2">
                            <TouchableOpacity onPress={handleShareProfile} className="bg-zinc-900 py-2.5 px-8 rounded-full border border-zinc-700 mr-2">
                                <Text className="text-white font-bold text-sm">Share</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push("/(protected)/edit-profile")} className="bg-zinc-900 py-2.5 px-8 rounded-full border border-zinc-700">
                                <Text className="text-white font-bold text-sm">Edit profile</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* Profile tabs */}
            <View className="bg-black border-b border-zinc-800 flex-row">
                {(["posts", "videos"] as const).map((tab) => (
                    <TouchableOpacity key={tab} onPress={() => setProfileTab(tab)} className={`flex-1 items-center py-3 border-b-2 ${profileTab === tab ? "border-white" : "border-transparent"}`} accessibilityRole="tab" accessibilityState={{ selected: profileTab === tab }}>
                        <Ionicons name={tab === "posts" ? "grid-outline" : "videocam-outline"} size={20} color={profileTab === tab ? "#fff" : "#71717a"} />
                        <Text className={`text-[10px] mt-1 capitalize ${profileTab === tab ? "text-white" : "text-zinc-500"}`}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const renderItem = ({ item }: { item: Post }) => {
        const mediaUri = item.media.startsWith('http')
            ? item.media
            : `${API_URL.replace('/api', '')}${item.media}`;

        return (
            <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => {
                    if (item.type === "VIDEO") {
                        setSelectedVideoIndex(videoPosts.findIndex((videoPost) => videoPost.id === item.id));
                    } else {
                        setSelectedPost(item);
                    }
                }}
                style={{ width: `${100 / 3}%`, aspectRatio: 9 / 16, padding: 1 }}
            >
                {item.type === 'VIDEO' ? (
                    <View className="flex-1 bg-gray-900">
                        <Video
                            source={{ uri: mediaUri, headers: { Authorization: `Bearer ${token}` } }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay={false}
                            isMuted
                            onError={(error) => console.error(`[Profile grid video] ${item.id}:`, error)}
                        />
                        <View className="absolute left-2 bottom-2 flex-row items-center">
                            <Ionicons name="play" size={12} color="#fff" />
                            <Text className="text-white text-[10px] font-bold ml-1">VIDEO</Text>
                        </View>
                    </View>
                ) : (
                    <Image
                        source={{ uri: mediaUri, headers: { Authorization: `Bearer ${token}` } }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                    />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View className="flex-1 bg-black">
            <OfflineWrapper onRetry={onRefresh}>
                <FlatList
                    data={profileTab === "videos" ? posts.filter((post) => post.type === "VIDEO") : posts}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    numColumns={3}
                    ListHeaderComponent={renderHeader}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    columnWrapperStyle={{ width: '100%' }}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    ListEmptyComponent={
                        !loading ? (
                            <View className="p-8 items-center bg-black">
                                <Text className="text-zinc-400 text-center">No posts yet.</Text>
                                <Text className="text-zinc-600 text-center text-sm mt-2">Create your first post!</Text>
                            </View>
                        ) : null
                    }
                />

                <Modal visible={Boolean(selectedPost)} animationType="slide" onRequestClose={() => setSelectedPost(null)}>
                    <View className="flex-1 bg-black">
                        <Pressable
                            onPress={() => setSelectedPost(null)}
                            className="absolute z-10 right-4 top-12 h-10 w-10 rounded-full bg-black/60 items-center justify-center"
                        >
                            <Ionicons name="close" size={26} color="#fff" />
                        </Pressable>
                        {selectedPost ? (
                            <PostItem
                                post={selectedPost as any}
                                token={token}
                                currentUserId={user?.id}
                                immersive
                                isActive
                                onLike={handleLike}
                                onComment={(postId) => {
                                    setSelectedPostId(postId);
                                    setCommentModalVisible(true);
                                }}
                                onUserPress={(userId) => {
                                    setSelectedPost(null);
                                    router.push(`/(protected)/user/${userId}`);
                                }}
                                onOptionPress={handlePostOptions}
                            />
                        ) : null}
                    </View>
                </Modal>

                <VideoPlayground
                    visible={selectedVideoIndex !== null}
                    videos={videoPosts.map((post) => ({
                        url: post.media.startsWith("http") ? post.media : `${API_URL.replace("/api", "")}${post.media}`,
                        username: post.author.username || post.author.name || "Creator",
                        caption: post.caption,
                        creationLabel: post.aiDescription ? "AI-generated" : undefined,
                        avatarUrl: post.author.avatarUrl
                            ? (post.author.avatarUrl.startsWith("http") ? post.author.avatarUrl : `${API_URL.replace("/api", "")}${post.author.avatarUrl}`)
                            : null,
                        likesCount: post._count?.likes || 0,
                        commentsCount: post._count?.comments || 0,
                        isLiked: Boolean(post.likes?.length),
                    }))}
                    initialIndex={selectedVideoIndex ?? 0}
                    headers={token ? { Authorization: `Bearer ${token}` } : undefined}
                    bottomAvatarUrl={user?.avatarUrl
                        ? (user.avatarUrl.startsWith("http") ? user.avatarUrl : `${API_URL.replace("/api", "")}${user.avatarUrl}`)
                        : null}
                    showBottomNavigation
                    showHeaderControls={false}
                    showFeedHeader
                    onClose={() => setSelectedVideoIndex(null)}
                    onLike={(index) => {
                        const post = videoPosts[index];
                        if (post) void handleLike(post.id);
                    }}
                    onComment={(index) => {
                        const post = videoPosts[index];
                        if (post) {
                            setSelectedPostId(post.id);
                            setCommentModalVisible(true);
                        }
                    }}
                    onShare={(index) => {
                        const post = videoPosts[index];
                        if (post) void Share.share({ message: post.caption || "Check out this video" });
                    }}
                    onBottomTabPress={navigateFromVideo}
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
