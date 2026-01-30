import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import dayjs from "dayjs";
import { API_URL } from "../lib/api";

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
    _count?: {
        likes: number;
        comments: number;
    };
    likes?: { id: string }[];
};

interface PostItemProps {
    post: Post;
    token: string | null;
    onLike: (postId: string) => void;
    onComment: (postId: string) => void;
    onUserPress: (userId: string) => void;
}

export const PostItem: React.FC<PostItemProps> = ({
    post,
    token,
    onLike,
    onComment,
    onUserPress
}) => {
    const isLiked = post.likes && post.likes.length > 0;

    return (
        <View className="bg-white mb-4 py-4 shadow-sm">
            {/* User header */}
            <View className="flex-row items-center px-4 mb-3">
                <TouchableOpacity
                    className="flex-row items-center"
                    onPress={() => onUserPress(post.author.id)}
                >
                    <View className="bg-gray-200 w-10 h-10 rounded-full flex items-center justify-center mr-3 overflow-hidden border border-gray-100">
                        {post.author.avatarUrl ? (
                            <Image
                                source={{
                                    uri: post.author.avatarUrl.startsWith('http')
                                        ? post.author.avatarUrl
                                        : `${API_URL.replace('/api', '')}${post.author.avatarUrl}`,
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
                        <Text className="font-bold text-[14px] text-gray-900">{post.author.name || post.author.username || 'Unknown User'}</Text>
                        <Text className="text-gray-500 text-[11px]">{dayjs(post.createdAt).fromNow(true)}</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Media */}
            {token && (
                <View className="w-full aspect-[9/16] bg-gray-100 mb-3">
                    <Image
                        source={{
                            uri: post.media.startsWith('http') ? post.media : `${API_URL.replace('/api', '')}${post.media}`,
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
                    <Ionicons name="chatbubble-outline" size={24} color="#000" />
                    {(post._count?.comments || 0) > 0 && (
                        <Text className="ml-1 text-sm font-medium">{post._count.comments}</Text>
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
                    {post.caption || '...'}
                </Text>
            </View>
        </View>
    );
};
