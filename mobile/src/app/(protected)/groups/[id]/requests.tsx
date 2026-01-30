import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch, API_URL } from '../../../../lib/api';
import { useAuth } from '../../../../context/AuthContext';

type RequestUser = {
    id: string;
    username: string;
    name: string | null;
    avatarUrl: string | null;
};

type JoinRequest = {
    id: string;
    userId: string;
    groupId: string;
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
    joinedAt: string;
    user: RequestUser;
};

export default function GroupRequestsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { token } = useAuth();
    const [requests, setRequests] = useState<JoinRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchRequests = useCallback(async () => {
        try {
            const res = await apiFetch(`/groups/${id}/requests`);
            if (res.ok) {
                const data = await res.json();
                setRequests(data);
            } else {
                Alert.alert("Error", "Could not fetch requests");
                router.back();
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Network error");
        } finally {
            setLoading(false);
        }
    }, [id, router]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleAction = async (userId: string, action: 'ACCEPT' | 'DECLINE') => {
        setActionLoading(userId);
        try {
            const res = await apiFetch(`/groups/${id}/requests/${userId}`, {
                method: 'POST',
                body: JSON.stringify({ action }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                // Remove from list
                setRequests(prev => prev.filter(req => req.user.id !== userId));
                Alert.alert("Success", `Request ${action === 'ACCEPT' ? 'accepted' : 'declined'}`);
            } else {
                const data = await res.json();
                Alert.alert("Error", data.error || "Failed to process request");
            }
        } catch (error) {
            Alert.alert("Error", "Network error");
        } finally {
            setActionLoading(null);
        }
    };

    const renderItem = ({ item }: { item: JoinRequest }) => (
        <View className="flex-row items-center justify-between bg-white p-4 mb-2 rounded-xl border border-gray-100 shadow-sm">
            <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 bg-gray-200 rounded-full mr-3 overflow-hidden">
                    {item.user.avatarUrl ? (
                        <Image
                            source={{
                                uri: item.user.avatarUrl.startsWith('http')
                                    ? item.user.avatarUrl
                                    : `${API_URL.replace('/api', '')}${item.user.avatarUrl}`
                            }}
                            style={{ width: '100%', height: '100%' }}
                        />
                    ) : (
                        <View className="w-full h-full items-center justify-center bg-gray-300">
                            <Text className="text-gray-600 font-bold text-lg">{item.user.username[0].toUpperCase()}</Text>
                        </View>
                    )}
                </View>
                <View className="flex-1">
                    <Text className="font-bold text-gray-900 text-base">{item.user.name || item.user.username}</Text>
                    <Text className="text-gray-500 text-sm">@{item.user.username}</Text>
                </View>
            </View>

            <View className="flex-row">
                <TouchableOpacity
                    className="bg-red-50 p-2 rounded-lg mr-2"
                    onPress={() => handleAction(item.user.id, 'DECLINE')}
                    disabled={!!actionLoading}
                >
                    <Ionicons name="close" size={20} color="#EF4444" />
                </TouchableOpacity>
                <TouchableOpacity
                    className="bg-green-50 p-2 rounded-lg"
                    onPress={() => handleAction(item.user.id, 'ACCEPT')}
                    disabled={!!actionLoading}
                >
                    {actionLoading === item.user.id ? (
                        <ActivityIndicator size="small" color="#10B981" />
                    ) : (
                        <Ionicons name="checkmark" size={20} color="#10B981" />
                    )}
                </TouchableOpacity>
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
        <View className="flex-1 bg-gray-50 p-4">
            <View className="flex-row items-center mb-6">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <Ionicons name="arrow-back" size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-gray-900">Member Requests</Text>
            </View>

            <FlatList
                data={requests}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                    <View className="py-20 items-center">
                        <Ionicons name="checkmark-circle-outline" size={64} color="#D1D5DB" />
                        <Text className="text-gray-500 mt-4 text-center">No pending requests</Text>
                    </View>
                }
            />
        </View>
    );
}
