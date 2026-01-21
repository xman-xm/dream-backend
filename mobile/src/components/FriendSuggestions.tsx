import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import { apiFetch } from '../lib/api';

type Suggestion = {
    id: string;
    name: string;
    username: string;
    avatarUrl?: string;
};

export function FriendSuggestions() {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSuggestions();
    }, []);

    const fetchSuggestions = async () => {
        try {
            const res = await apiFetch('/friends/suggestions');
            if (res.ok) {
                const data = await res.json();
                setSuggestions(data.suggestions || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const addFriend = async (userId: string) => {
        try {
            const res = await apiFetch('/friends', {
                method: 'POST',
                body: JSON.stringify({ targetUserId: userId }),
            });
            if (res.ok) {
                Alert.alert('Success', 'Friend request sent!');
                // Remove from list
                setSuggestions(prev => prev.filter(p => p.id !== userId));
            } else {
                const err = await res.json();
                Alert.alert('Error', err.error || 'Failed to send request');
            }
        } catch (e) {
            Alert.alert('Error', 'Network error');
        }
    };

    if (!loading && suggestions.length === 0) return null;

    const renderItem = ({ item }: { item: Suggestion }) => (
        <View className="mr-4 w-32 items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
            <View className="w-16 h-16 rounded-full bg-gray-200 mb-2 overflow-hidden">
                {item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={{ width: 64, height: 64 }} contentFit="cover" />
                ) : (
                    <View className="w-full h-full items-center justify-center bg-blue-100">
                        <Text className="text-blue-500 font-bold text-xl">{(item.name?.[0] || item.username?.[0] || '?').toUpperCase()}</Text>
                    </View>
                )}
            </View>
            <Text numberOfLines={1} className="font-semibold text-gray-900 text-sm mb-0.5">{item.name || item.username}</Text>
            <Text numberOfLines={1} className="text-gray-500 text-xs mb-3">@{item.username}</Text>

            <TouchableOpacity
                className="bg-blue-500 px-3 py-1.5 rounded-full w-full items-center"
                onPress={() => addFriend(item.id)}
            >
                <Text className="text-white text-xs font-bold">Add</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View className="py-4 bg-gray-50">
            <View className="px-4 mb-3 flex-row justify-between items-center">
                <Text className="text-sm font-bold text-gray-700">Suggested for you</Text>
            </View>
            <FlatList
                horizontal
                data={suggestions}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
            />
        </View>
    );
}
