import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Dimensions, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { apiFetch, API_URL } from "../../../lib/api";
import { getToken } from "../../../lib/auth-store";
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import { CommentsModal } from "../../../components/CommentsModal";



type SearchResultUser = {
    id: string;
    username: string;
    name: string | null;
    avatarUrl: string | null;
};

type SearchResultGroup = {
    id: string;
    name: string;
    description: string | null;
    avatarUrl: string | null;
};

type SearchResultPost = {
    id: string;
    caption: string | null;
    media: string;
    type: string;
    aiDescription: string | null;
    createdAt: string;
    author: SearchResultUser;
    group?: { id: string; name: string };
    _count?: {
        likes: number;
        comments: number;
    };
    likes?: { id: string }[];
};

type SearchState = {
    users: SearchResultUser[];
    groups: SearchResultGroup[];
    posts: SearchResultPost[];
};

import { useAuth } from "../../../context/AuthContext";

export default function Search() {
    const router = useRouter();
    const { token } = useAuth();
    const [query, setQuery] = useState("");
    const [activeTab, setActiveTab] = useState<'all' | 'users' | 'groups' | 'posts'>('all');
    const [results, setResults] = useState<SearchState>({ users: [], groups: [], posts: [] });
    const [loading, setLoading] = useState(false);
    const [commentModalVisible, setCommentModalVisible] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

    // Debounced Search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim()) {
                performSearch(query);
            } else {
                setResults({ users: [], groups: [], posts: [] });
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query, activeTab]);

    const performSearch = async (currentQuery: string) => {
        setLoading(true);
        try {
            // New Smart Search API (returns all types at once)
            const res = await apiFetch(`/search/smart?q=${encodeURIComponent(currentQuery)}`);
            if (res.ok) {
                const data = await res.json();
                setResults(data);
            }
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setLoading(false);
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
                setResults(prev => ({
                    ...prev,
                    posts: prev.posts.map(post =>
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
                }));
            }
        } catch (error) {
            console.error('Like error:', error);
        }
    };

    const renderTabs = () => (
        <View className="flex-row px-4 py-2 border-b border-gray-100 bg-white">
            {(['all', 'users', 'groups', 'posts'] as const).map((tab) => (
                <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    className={`mr-4 pb-2 ${activeTab === tab ? 'border-b-2 border-blue-600' : ''}`}
                >
                    <Text className={`capitalize font-medium ${activeTab === tab ? 'text-blue-600' : 'text-gray-500'}`}>
                        {tab}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderUserItem = ({ item }: { item: SearchResultUser }) => (
        <View className="flex-row items-center p-3 bg-white mb-1 rounded-lg">
            <View className="w-12 h-12 bg-gray-200 rounded-full mr-3 overflow-hidden">
                {item.avatarUrl ? (
                    <Image
                        source={{
                            uri: item.avatarUrl.startsWith('http')
                                ? item.avatarUrl
                                : `${API_URL.replace('/api', '')}${item.avatarUrl}`,
                            headers: { Authorization: `Bearer ${token}` }
                        }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                    />
                ) : (
                    <View className="w-full h-full items-center justify-center bg-blue-100">
                        <Text className="text-blue-600 font-bold">{(item.name?.[0] || item.username?.[0] || '?').toUpperCase()}</Text>
                    </View>
                )}
            </View>
            <View className="flex-1">
                <Text className="font-bold text-gray-900">{item.name || item.username}</Text>
                <Text className="text-gray-500 text-sm">@{item.username}</Text>
            </View>
            <TouchableOpacity
                className="bg-gray-100 px-4 py-2 rounded-full"
                onPress={() => router.push(`/(protected)/user/${item.id}`)}
            >
                <Text className="font-semibold text-gray-900 text-xs">View</Text>
            </TouchableOpacity>
        </View>
    );

    const renderGroupItem = ({ item }: { item: SearchResultGroup }) => (
        <View className="flex-row items-center p-3 bg-white mb-1 rounded-lg">
            <View className="w-12 h-12 bg-gray-200 rounded-lg mr-3 overflow-hidden">
                {item.avatarUrl ? (
                    <Image
                        source={{
                            uri: item.avatarUrl.startsWith('http')
                                ? item.avatarUrl
                                : `${API_URL.replace('/api', '')}${item.avatarUrl}`,
                            headers: { Authorization: `Bearer ${token}` }
                        }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                    />
                ) : (
                    <View className="w-full h-full items-center justify-center bg-indigo-100">
                        <Text className="text-indigo-600 font-bold">{(item.name?.[0] || '?').toUpperCase()}</Text>
                    </View>
                )}
            </View>
            <View className="flex-1">
                <Text className="font-bold text-gray-900">{item.name}</Text>
                <Text className="text-gray-500 text-sm" numberOfLines={1}>{item.description || 'No description'}</Text>
            </View>
            <TouchableOpacity
                className="bg-indigo-50 px-4 py-2 rounded-full"
                onPress={() => router.push(`/(protected)/groups/${item.id}`)}
            >
                <Text className="font-semibold text-indigo-600 text-xs">View</Text>
            </TouchableOpacity>
        </View>
    );

    const renderPostItem = ({ item }: { item: SearchResultPost }) => {
        const isLiked = item.likes && item.likes.length > 0;

        return (
            <View className="bg-white mb-4 py-4 shadow-sm">
                {/* User header */}
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
                {token && (
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

        // Combine data for FlatList based on activeTab
        // This is a bit tricky for mixed layouts (list vs grid). 
        // Simplified approach: Two separate sections or just conditionally render.
    };

    return (
        <View className="flex-1 bg-gray-50 pt-12">
            <View className="px-4 pb-2 bg-white">
                <Text className="text-2xl font-bold text-gray-900 mb-4">Search</Text>
                <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-2.5">
                    <Text className="mr-2 text-gray-400">🔍</Text>
                    <TextInput
                        className="flex-1 font-medium text-gray-900 text-base"
                        placeholder="Search users, posts, or keywords..."
                        placeholderTextColor="#9CA3AF"
                        value={query}
                        onChangeText={setQuery}
                        autoCapitalize="none"
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery('')}>
                            <Text className="text-gray-400 font-bold ml-2">✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {renderTabs()}

            {loading ? (
                <View className="p-8">
                    <ActivityIndicator size="large" color="#2563EB" />
                </View>
            ) : (
                <ScrollView className="flex-1 px-4 pt-4">
                    {activeTab === 'all' || activeTab === 'users' ? (
                        <>
                            {results.users.length > 0 && (
                                <View className="mb-6">
                                    {activeTab === 'all' && <Text className="font-bold text-gray-500 mb-2 uppercase text-xs tracking-wider">People</Text>}
                                    {results.users.map(user => (
                                        <View key={user.id}>{renderUserItem({ item: user })}</View>
                                    ))}
                                </View>
                            )}
                        </>
                    ) : null}

                    {activeTab === 'all' || activeTab === 'groups' ? (
                        <>
                            {results.groups.length > 0 && (
                                <View className="mb-6">
                                    {activeTab === 'all' && <Text className="font-bold text-gray-500 mb-2 uppercase text-xs tracking-wider">Groups</Text>}
                                    {results.groups.map(group => (
                                        <View key={group.id}>{renderGroupItem({ item: group })}</View>
                                    ))}
                                </View>
                            )}
                        </>
                    ) : null}

                    {activeTab === 'all' || activeTab === 'posts' ? (
                        <>
                            {results.posts.length > 0 && (
                                <View className="flex-1">
                                    {activeTab === 'all' && <Text className="font-bold text-gray-500 mb-2 uppercase text-xs tracking-wider">Posts</Text>}
                                    {results.posts.map(post => (
                                        <View key={post.id}>{renderPostItem({ item: post })}</View>
                                    ))}
                                </View>
                            )}
                        </>
                    ) : null}

                    {!loading && query && results.users.length === 0 && results.groups.length === 0 && results.posts.length === 0 && (
                        <View className="items-center justify-center py-10">
                            <Text className="text-gray-500 text-center">No results found for "{query}"</Text>
                        </View>
                    )}
                </ScrollView>
            )}

            <CommentsModal
                visible={commentModalVisible}
                onClose={() => setCommentModalVisible(false)}
                postId={selectedPostId || ''}
                onCommentAdded={() => {
                    // Refresh search results to update comment count
                    if (query.trim()) {
                        if (query.trim()) {
                            performSearch(query);
                        }
                    }
                }}
            />
        </View>
    );
}
