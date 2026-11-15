import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiFetch, API_URL } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type SuggestedUser = {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
    bio?: string | null;
};

export const SuggestedUsers = () => {
    const router = useRouter();
    const { token } = useAuth();
    const [users, setUsers] = useState<SuggestedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchSuggestions();
    }, []);

    const fetchSuggestions = async () => {
        try {
            const res = await apiFetch('/follows/suggestions');
            if (res.ok) {
                const data = await res.json();
                setUsers(data.suggestions || []);
            }
        } catch (error) {
            console.error("Error fetching suggestions:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async (userId: string) => {
        try {
            // Optimistic update
            setFollowedIds(prev => new Set(prev).add(userId));

            const res = await apiFetch('/follows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: userId })
            });

            if (!res.ok) {
                // Revert if failed
                setFollowedIds(prev => {
                    const next = new Set(prev);
                    next.delete(userId);
                    return next;
                });
            }
        } catch (error) {
            console.error("Follow error:", error);
        }
    };

    const renderItem = ({ item }: { item: SuggestedUser }) => {
        const isFollowed = followedIds.has(item.id);

        return (
            <View className="bg-[#151922] rounded-2xl p-4 mr-3 w-40 items-center border border-zinc-800">
                <TouchableOpacity onPress={() => router.push(`/(protected)/user/${item.id}`)} className="items-center">
                    <View className="w-16 h-16 rounded-full bg-zinc-800 mb-2 overflow-hidden">
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
                            <View className="w-full h-full items-center justify-center bg-violet-950">
                                <Text className="text-violet-300 font-bold text-xl">
                                    {(item.name?.[0] || item.username?.[0] || '?').toUpperCase()}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text className="font-bold text-zinc-100 text-center" numberOfLines={1}>
                        {item.name || item.username}
                    </Text>
                    <Text className="text-xs text-zinc-400 mb-3 text-center" numberOfLines={1}>
                        @{item.username}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => !isFollowed && handleFollow(item.id)}
                    className={`px-4 py-1.5 rounded-full w-full items-center ${isFollowed ? 'bg-zinc-800' : 'bg-violet-500'
                        }`}
                >
                    <Text className={`text-xs font-bold ${isFollowed ? 'text-zinc-300' : 'text-white'}`}>
                        {isFollowed ? 'Following' : 'Follow'}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    if (loading) return <View className="h-40 items-center justify-center"><ActivityIndicator /></View>;
    if (users.length === 0) return null;

    return (
        <View className="mb-4 pl-4 py-2">
            <Text className="text-zinc-100 font-bold text-base mb-3 ml-1">People to discover</Text>
            <FlatList
                horizontal
                data={users}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 20 }}
            />
        </View>
    );
};
