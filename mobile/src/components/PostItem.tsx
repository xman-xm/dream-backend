import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import dayjs from "dayjs";
import { API_URL } from "../lib/api";
import { Video, ResizeMode } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Author = {
    id: string;
    name?: string | null;
    username?: string;
    avatarUrl?: string | null;
};

type Post = {
    id: string;
    caption: string | null;
    media: string;
    type: string;
    createdAt: string;
    author: Author;
    aiDescription?: string | null;
    _count?: {
        likes: number;
        comments: number;
    };
    likes?: { id: string }[];
    isLiked?: boolean;
    isCommented?: boolean;
};

interface PostItemProps {
    post: Post;
    token: string | null;
    currentUserId?: string;
    onLike: (postId: string) => void;
    onComment: (postId: string) => void;
    onUserPress: (userId: string) => void;
    onFollow?: (authorId: string) => void;
    isFollowing?: boolean;
    onShare?: (post: Post) => void;
    onOptionPress?: (post: Post) => void;
    immersive?: boolean;
    isActive?: boolean;
    immersiveHeight?: number;
}

export const PostItem: React.FC<PostItemProps> = ({
    post,
    token,
    currentUserId,
    onLike,
    onComment,
    onUserPress,
    onFollow,
    isFollowing = false,
    onShare,
    onOptionPress,
    immersive = false,
    isActive = false,
    immersiveHeight
}) => {
    const insets = useSafeAreaInsets();
    const isLiked = post.isLiked !== undefined ? post.isLiked : (post.likes && post.likes.length > 0);
    const isCommented = post.isCommented;
    const [paused, setPaused] = useState(false);
    const [videoLoadError, setVideoLoadError] = useState(false);
    const mediaUri = post.media.startsWith('http')
        ? post.media
        : `${API_URL.replace(/\/api\/?$/, '')}${post.media.startsWith('/') ? post.media : `/${post.media}`}`;

    useEffect(() => {
        setVideoLoadError(false);
    }, [post.id, post.media]);

    const handleVideoError = (error: unknown) => {
        console.error(`[Video] Failed to load ${post.id} from ${mediaUri}:`, error);
        setVideoLoadError(true);
    };

    if (immersive) {
        const mediaSource = {
            uri: mediaUri,
            headers: { Authorization: `Bearer ${token}` }
        };

        return (
            <View className="bg-black" style={immersiveHeight ? { height: immersiveHeight, position: "relative" } : { flex: 1, position: "relative" }}>
                {post.type === 'VIDEO' && videoLoadError ? (
                    <View className="absolute inset-0 items-center justify-center bg-zinc-950 px-8">
                        <Ionicons name="videocam-off-outline" size={38} color="#a1a1aa" />
                        <Text className="text-white font-semibold mt-3">Video unavailable</Text>
                        <Text className="text-zinc-400 text-center text-xs leading-5 mt-1">
                            This video could not be found on the server.
                        </Text>
                    </View>
                ) : post.type === 'VIDEO' ? (
                    <Video
                        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
                        source={mediaSource}
                        resizeMode={ResizeMode.COVER}
                        isLooping
                        shouldPlay={isActive && !paused}
                        useNativeControls={false}
                        onError={handleVideoError}
                    />
                ) : (
                    <Image source={mediaSource} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} contentFit="cover" />
                )}
                <View pointerEvents="none" className="absolute inset-0 bg-black/10" />
                <Pressable
                    className="absolute left-0 right-0 top-0"
                    onPress={() => setPaused(value => !value)}
                    style={{ bottom: immersiveHeight ? 0 : 60 + insets.bottom, zIndex: 1 }}
                />
                {post.type === 'VIDEO' && paused && (
                    <View pointerEvents="none" className="absolute inset-0 items-center justify-center z-10">
                        <View className="h-16 w-16 rounded-full bg-black/50 items-center justify-center">
                            <Ionicons name="play" size={30} color="#fff" />
                        </View>
                    </View>
                )}

                    <View className="absolute left-5 right-20 z-20" pointerEvents="box-none" style={{ bottom: immersiveHeight ? 28 : 60 + insets.bottom + 18 }}>
                        {post.aiDescription ? (
                            <View className="self-start flex-row items-center rounded-full bg-black/45 px-2.5 py-1 mb-3 border border-white/15">
                                <Ionicons name="sparkles" size={12} color="#d8c6ff" />
                                <Text className="text-white text-[10px] font-semibold ml-1.5">Made with AI</Text>
                            </View>
                        ) : null}
                        <View className="flex-row items-center mb-3">
                            <TouchableOpacity className="flex-row items-center flex-1" onPress={() => onUserPress(post.author.id)}>
                                <View className="h-10 w-10 rounded-full bg-white/20 overflow-hidden mr-3 border border-white/70 items-center justify-center">
                                    {post.author.avatarUrl ? (
                                        <Image
                                            source={{
                                                uri: post.author.avatarUrl.startsWith('http') ? post.author.avatarUrl : `${API_URL.replace(/\/api\/?$/, '')}${post.author.avatarUrl.startsWith('/') ? post.author.avatarUrl : `/${post.author.avatarUrl}`}`,
                                                headers: { Authorization: `Bearer ${token}` }
                                            }}
                                            style={{ width: 40, height: 40 }}
                                            contentFit="cover"
                                        />
                                    ) : (
                                        <Text className="text-white font-bold">{(post.author.name?.[0] || post.author.username?.[0] || '?').toUpperCase()}</Text>
                                    )}
                                </View>
                                <View className="flex-1">
                                    <Text className="text-white font-bold text-base" numberOfLines={1}>{post.author.name || post.author.username || 'Creator'}</Text>
                                    {post.author.username ? <Text className="text-white/70 text-xs mt-0.5">@{post.author.username}</Text> : null}
                                </View>
                            </TouchableOpacity>
                        {currentUserId && currentUserId !== post.author.id && onFollow ? (
                            <TouchableOpacity
                                onPress={() => onFollow(post.author.id)}
                                accessibilityRole="button"
                                accessibilityLabel={isFollowing ? "Unfollow creator" : "Follow creator"}
                                className={`ml-2 px-3 py-1.5 rounded-lg border ${isFollowing ? "border-white/30 bg-black/30" : "border-white bg-white"}`}
                            >
                                <Text className={`text-xs font-bold ${isFollowing ? "text-white" : "text-black"}`}>{isFollowing ? "Following" : "Follow"}</Text>
                            </TouchableOpacity>
                        ) : null}
                        </View>
                        <Text className="text-white text-sm leading-5" numberOfLines={3}>{post.caption || 'Sharing a moment.'}</Text>
                        <Text className="text-white/60 text-xs mt-2">{dayjs(post.createdAt).fromNow()}</Text>
                    </View>

                    <View className="absolute right-4 items-center z-20" pointerEvents="box-none" style={{ bottom: immersiveHeight ? 32 : 60 + insets.bottom + 16 }}>
                        <TouchableOpacity className="items-center mb-5" onPress={() => onLike(post.id)}>
                            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={31} color={isLiked ? "#ff476f" : "#fff"} />
                            <Text className="text-white text-xs mt-1">{post._count?.likes || 0}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity className="items-center mb-5" onPress={() => onComment(post.id)}>
                            <Ionicons name="chatbubble-outline" size={29} color="#fff" />
                            <Text className="text-white text-xs mt-1">{post._count?.comments || 0}</Text>
                        </TouchableOpacity>
                        {onShare ? (
                            <TouchableOpacity className="items-center mb-5" onPress={() => onShare(post)} accessibilityRole="button" accessibilityLabel="Share post">
                                <Ionicons name="paper-plane-outline" size={30} color="#fff" />
                                <Text className="text-white text-[10px] mt-1">Share</Text>
                            </TouchableOpacity>
                        ) : null}
                        {currentUserId === post.author.id && onOptionPress ? (
                            <TouchableOpacity onPress={() => onOptionPress(post)} accessibilityRole="button" accessibilityLabel="Post options">
                                <Ionicons name="ellipsis-horizontal" size={28} color="#fff" />
                            </TouchableOpacity>
                        ) : null}
                    </View>
            </View>
        );
    }

    return (
        <View className="bg-[#0d0d12] mb-4 py-4 border-b border-white/10">
            {/* User header */}
            <View className="flex-row items-center px-4 mb-3">
                <TouchableOpacity
                    className="flex-row items-center"
                    onPress={() => onUserPress(post.author.id)}
                >
                    <View className="bg-zinc-800 w-10 h-10 rounded-full flex items-center justify-center mr-3 overflow-hidden border border-white/10">
                        {post.author.avatarUrl ? (
                            <Image
                                source={{
                                    uri: post.author.avatarUrl.startsWith('http')
                                        ? post.author.avatarUrl
                                        : `${API_URL.replace(/\/api\/?$/, '')}${post.author.avatarUrl.startsWith('/') ? post.author.avatarUrl : `/${post.author.avatarUrl}`}`,
                                    headers: { Authorization: `Bearer ${token}` }
                                }}
                                style={{ width: 40, height: 40 }}
                                contentFit="cover"
                            />
                        ) : (
                            <Text className="text-gray-500 font-bold text-xs">
                                {(post.author.name?.[0] || post.author.username?.[0] || '?').toUpperCase()}
                            </Text>
                        )}
                    </View>
                    <View>
                        <Text className="font-bold text-[14px] text-white">{post.author.name || post.author.username || 'Creator'}</Text>
                        <Text className="text-zinc-400 text-[11px]">{dayjs(post.createdAt).fromNow(true)}</Text>
                    </View>
                </TouchableOpacity>

                <View className="flex-1" />

                {(currentUserId === post.author.id && onOptionPress) && (
                    <TouchableOpacity onPress={() => onOptionPress(post)}>
                        <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Media */}
            {token && (
                <View className="w-full aspect-[9/16] bg-zinc-900 mb-3">
                    {post.type === 'VIDEO' ? (
                        videoLoadError ? (
                            <View className="flex-1 items-center justify-center px-6">
                                <Ionicons name="videocam-off-outline" size={32} color="#a1a1aa" />
                                <Text className="text-white font-semibold mt-3">Video unavailable</Text>
                                <Text className="text-zinc-400 text-center text-xs leading-5 mt-1">
                                    This video could not be found on the server.
                                </Text>
                            </View>
                        ) : <Video
                            style={{ width: '100%', height: '100%' }}
                            source={{
                                uri: mediaUri,
                                headers: { Authorization: `Bearer ${token}` }
                            }}
                            useNativeControls={true}
                            resizeMode={ResizeMode.COVER}
                            isLooping
                            shouldPlay={false} // Autoplay policy can be added later
                            onError={handleVideoError}
                        />
                    ) : (
                        <Image
                            source={{
                                uri: mediaUri,
                                headers: { Authorization: `Bearer ${token}` }
                            }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                            transition={200}
                        />
                    )}
                </View>
            )}

            {/* Interaction Icons */}
            <View className="flex-row items-center px-4 py-3">
                <TouchableOpacity
                    className="flex-row items-center mr-5"
                    onPress={() => onLike(post.id)}
                >
                    <Ionicons
                        name={isLiked ? "heart" : "heart-outline"}
                        size={24}
                        color={isLiked ? "#ef4444" : "#000"}
                    />
                    {(post._count?.likes || 0) > 0 && (
                        <Text className="ml-1 text-sm font-medium">{post._count.likes}</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    className="flex-row items-center mr-5"
                    onPress={() => onComment(post.id)}
                >
                    <Ionicons
                        name={isCommented ? "chatbubble" : "chatbubble-outline"}
                        size={24}
                        color={isCommented ? "#000" : "#000"}
                    />
                    {(post._count?.comments || 0) > 0 && (
                        <Text className="ml-1 text-sm font-medium">{post._count.comments}</Text>
                    )}
                </TouchableOpacity>

                {onShare ? (
                    <TouchableOpacity className="mr-5" onPress={() => onShare(post)} accessibilityRole="button" accessibilityLabel="Share post">
                        <Ionicons name="paper-plane-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                ) : null}

                <View className="flex-1" />

            </View>

            {/* Caption */}
            <View className="px-4 pb-2">
                <Text className="text-zinc-100 text-[14px] leading-5">
                    {post.caption || ' '}
                </Text>
            </View>
        </View>
    );
};
