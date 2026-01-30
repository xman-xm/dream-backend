import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, RefreshControl, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch, API_URL } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const { width } = Dimensions.get('window');

type User = {
    id: string;
    username: string;
    name: string | null;
    avatarUrl: string | null;
};

type Post = {
    id: string;
    caption: string | null;
    media: string;
    type: 'IMAGE' | 'VIDEO';
    author: User;
    _count: {
        likes: number;
        comments: number;
    };
    likes: { userId: string }[];
    isLiked?: boolean;
    createdAt: string;
};

type GroupDetail = {
    id: string;
    name: string;
    description: string | null;
    avatarUrl: string | null;
    memberCount: number;
    isMember: boolean;
    membershipStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null;
    isPrivate: boolean;
    role: string | null;
};

export default function GroupDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { token } = useAuth();
    const [group, setGroup] = useState<GroupDetail | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [joining, setJoining] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const res = await apiFetch(`/groups/${id}`);
            if (res.ok) {
                const data = await res.json();
                setGroup(data.group);
                setPosts(data.posts);
            } else {
                Alert.alert("Error", "Could not fetch group");
                router.back();
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Network error");
        }
    }, [id, router]);

    const loadData = useCallback(async () => {
        setLoading(true);
        await fetchData();
        setLoading(false);
    }, [fetchData]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const handleJoin = async () => {
        if (!group) return;
        setJoining(true);
        try {
            const res = await apiFetch(`/groups/${group.id}/join`, {
                method: 'POST'
            });
            if (res.ok) {
                Alert.alert("Joined!", `You are now a member of ${group.name}`);
                fetchData();
            } else {
                Alert.alert("Error", "Could not join group");
            }
        } catch (error) {
            Alert.alert("Error", "Network error");
        } finally {
            setJoining(false);
        }
    };

    const handlePostToGroup = () => {
        if (!group) return;
        // Navigate to create-post but pass groupId
        // We'll assume create-post handles param or we create a specific route
        // Ideally: router.push(`/(protected)/create-post?groupId=${group.id}`);
        // But the tab bar navigation is tricky. Let's redirect to 'post' tab with params if possible, 
        // or just push the screen if it's not a modal. create-post is usually a tab.
        // Let's assume we can push it as a modal or screen.
        // Since create-post is not in the stack here (it's a tab), we might need to duplicate or handle params in the tab.
        // Simplest: Edit create-post to check LocalSearchParams for groupId.

        // For now, let's just log or Alert since we haven't updated create-post yet.
        Alert.alert("Implement Post", "Redirecting to create post with Group ID: " + group.id);
        // router.push(`/(protected)/post?groupId=${group.id}`); // If post is a screen
        // The 'post' tab is at /(tabs)/post.tsx (it's actually 'index' or a separate tab?)
        // Wait, the "Add Post" is usually a centered tab button or a modal.
        // Let's check navigation structure later. For now, plan to use params.
    };

    const renderHeader = () => {
        if (!group) return null;
        return (
            <View className="bg-white p-6 pb-4 mb-2">
                <View className="items-center">
                    <View className="w-24 h-24 bg-blue-100 rounded-3xl mb-4 overflow-hidden border border-blue-50 items-center justify-center shadow-sm">
                        {group.avatarUrl ? (
                            <Image
                                source={{
                                    uri: group.avatarUrl.startsWith('http')
                                        ? group.avatarUrl
                                        : `${API_URL.replace('/api', '')}${group.avatarUrl}`,
                                    headers: { Authorization: `Bearer ${token}` }
                                }}
                                style={{ width: '100%', height: '100%' }}
                                contentFit="cover"
                            />
                        ) : (
                            <Ionicons name="people" size={48} color="#3B82F6" />
                        )}
                    </View>
                    <Text className="text-2xl font-bold text-gray-900 text-center">{group.name}</Text>
                    {group.description && (
                        <Text className="text-gray-500 text-center mt-2 px-4 leading-5">{group.description}</Text>
                    )}

                    <View className="flex-row items-center mt-3">
                        {group.isPrivate && (
                            <View className="bg-gray-100 px-3 py-1 rounded-full mr-2 flex-row items-center">
                                <Ionicons name="lock-closed" size={12} color="#6B7280" />
                                <Text className="text-gray-500 text-xs font-medium ml-1">Private</Text>
                            </View>
                        )}
                        <Text className="text-gray-400 text-sm font-medium">{group.memberCount} Members</Text>
                    </View>

                    {group.role === 'ADMIN' && (
                        <TouchableOpacity
                            className="bg-gray-100 px-4 py-2 rounded-full mt-4 flex-row items-center"
                            onPress={() => router.push(`/(protected)/groups/${group.id}/requests`)}
                        >
                            <Ionicons name="people-circle" size={20} color="#4B5563" />
                            <Text className="text-gray-700 font-medium ml-2">Manage Requests</Text>
                        </TouchableOpacity>
                    )}

                    {!group.isMember ? (
                        group.membershipStatus === 'PENDING' ? (
                            <TouchableOpacity
                                className="bg-gray-300 px-8 py-3 rounded-full mt-6"
                                disabled={true}
                            >
                                <Text className="text-gray-600 font-bold text-base">Request Pending</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                className="bg-blue-600 px-8 py-3 rounded-full mt-6 shadow-md shadow-blue-200"
                                onPress={handleJoin}
                                disabled={joining}
                            >
                                {joining ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-bold text-base">{group.isPrivate ? "Request to Join" : "Join Group"}</Text>
                                )}
                            </TouchableOpacity>
                        )
                    ) : (
                        <View className="flex-row mt-6">
                            <TouchableOpacity className="bg-gray-100 px-6 py-3 rounded-full mr-2">
                                <Text className="text-gray-700 font-bold">Joined</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="bg-black px-6 py-3 rounded-full shadow-md"
                                onPress={() => router.push({ pathname: '/(protected)/(tabs)/post', params: { groupId: group.id } })}
                            >
                                <View className="flex-row items-center">
                                    <Ionicons name="add" size={20} color="white" />
                                    <Text className="text-white font-bold ml-1">Post</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    const renderItem = ({ item }: { item: Post }) => (
        <View className="bg-white mb-4 shadow-sm">
            <View className="flex-row items-center p-3">
                <View className="w-10 h-10 bg-gray-200 rounded-full mr-3 overflow-hidden">
                    {item.author.avatarUrl ? (
                        <Image
                            source={{
                                uri: item.author.avatarUrl.startsWith('http')
                                    ? item.author.avatarUrl
                                    : `${API_URL.replace('/api', '')}${item.author.avatarUrl}`,
                                headers: { Authorization: `Bearer ${token}` }
                            }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                        />
                    ) : (
                        <View className="w-full h-full items-center justify-center bg-gray-300">
                            <Text className="text-gray-600 font-bold">{item.author.username[0].toUpperCase()}</Text>
                        </View>
                    )}
                </View>
                <View>
                    <Text className="font-bold text-gray-900">{item.author.name || item.author.username}</Text>
                    <Text className="text-gray-400 text-xs">{dayjs(item.createdAt).fromNow()}</Text>
                </View>
            </View>

            <Image
                source={{
                    uri: item.media.startsWith('http') ? item.media : `${API_URL.replace('/api', '')}${item.media}`,
                    headers: { Authorization: `Bearer ${token}` }
                }}
                style={{ width: width, height: width }}
                contentFit="cover"
            />

            <View className="p-3">
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity className="mr-4">
                        <Ionicons name={item.isLiked ? "heart" : "heart-outline"} size={28} color={item.isLiked ? "#EF4444" : "#1F2937"} />
                    </TouchableOpacity>
                    <TouchableOpacity>
                        <Ionicons name="chatbubble-outline" size={26} color="#1F2937" />
                    </TouchableOpacity>
                </View>
                <Text className="font-bold text-gray-900 mb-1">{item._count.likes} likes</Text>
                {item.caption && (
                    <Text className="text-gray-800 leading-5">
                        <Text className="font-bold">{item.author.username}</Text> {item.caption}
                    </Text>
                )}
            </View>
        </View>
    );

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-100">
            <FlatList
                data={posts}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={renderHeader}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View className="py-12 items-center">
                        <Text className="text-gray-500">No posts in this group yet.</Text>
                    </View>
                }
            />
        </View>
    );
}
