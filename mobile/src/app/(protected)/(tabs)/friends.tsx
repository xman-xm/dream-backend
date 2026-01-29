import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Dimensions, Alert, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, API_URL } from "../../../lib/api";

type FriendUser = {
    id: string;
    name: string;
    username: string;
    avatarUrl?: string;
    friendshipId: string;
};

import { useAuth } from "../../../context/AuthContext";

type Group = {
    id: string;
    name: string;
    avatarUrl: string | null;
    memberCount: number;
};

export default function Friends() {
    const router = useRouter();
    const { token } = useAuth();
    const [viewMode, setViewMode] = useState<'friends' | 'groups'>('friends');
    const [friends, setFriends] = useState<FriendUser[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [requests, setRequests] = useState<FriendUser[]>([]);
    const [sentRequests, setSentRequests] = useState<FriendUser[]>([]);
    const [declinedRequests, setDeclinedRequests] = useState<FriendUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchFriends = useCallback(async () => {
        try {
            const res = await apiFetch('/friends');
            if (res.ok) {
                const data = await res.json();
                setFriends(data.friends || []);
                setRequests(data.incomingRequests || []);
                setSentRequests(data.sentRequests || []);
                setDeclinedRequests(data.declinedRequests || []);
            }
        } catch (error) {
            console.error("Error fetching friends data:", error);
        }
    }, []);

    const fetchGroups = useCallback(async () => {
        try {
            const res = await apiFetch('/groups/member');
            if (res.ok) {
                const data = await res.json();
                setGroups(data);
            }
        } catch (error) {
            console.error("Error fetching groups data:", error);
        }
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        await Promise.all([fetchFriends(), fetchGroups()]);
        setLoading(false);
    }, [fetchFriends, fetchGroups]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchFriends(), fetchGroups()]);
        setRefreshing(false);
    };

    const handleAccept = async (friendshipId: string) => {
        try {
            const res = await apiFetch('/friends', {
                method: 'PATCH',
                body: JSON.stringify({ friendshipId })
            });
            if (res.ok) {
                Alert.alert("Connected!", "You are now friends.");
                fetchFriends(); // Reload to move from requests to friends
            } else {
                Alert.alert("Error", "Could not accept request");
            }
        } catch (e) {
            Alert.alert("Error", "Network error");
        }
    };

    const handleDelete = async (friendshipId: string) => {
        try {
            const res = await apiFetch(`/friends?id=${friendshipId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchFriends(); // Reload to remove
            }
        } catch (e) {
            Alert.alert("Error", "Network error");
        }
    };

    const handleDecline = async (friendshipId: string) => {
        try {
            const res = await apiFetch('/friends', {
                method: 'PATCH',
                body: JSON.stringify({ friendshipId, action: 'DECLINE' })
            });
            if (res.ok) {
                Alert.alert("Declined", "You have declined this request.");
                fetchFriends();
            } else {
                Alert.alert("Error", "Could not decline request");
            }
        } catch (e) {
            Alert.alert("Error", "Network error");
        }
    };

    const renderRequestItem = ({ item }: { item: FriendUser }) => (
        <View className="flex-row items-center justify-between py-3 px-4 bg-white border-b border-gray-100">
            <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-gray-200 mr-3 overflow-hidden">
                    {item.avatarUrl ? (
                        <Image
                            source={{
                                uri: item.avatarUrl.startsWith('http')
                                    ? item.avatarUrl
                                    : `${API_URL.replace('/api', '')}${item.avatarUrl}`,
                                headers: { Authorization: `Bearer ${token}` }
                            }}
                            style={{ width: 48, height: 48 }}
                            contentFit="cover"
                        />
                    ) : (
                        <View className="w-full h-full items-center justify-center bg-blue-100">
                            <Text className="text-blue-500 font-bold text-lg">{(item.name?.[0] || item.username?.[0] || '?').toUpperCase()}</Text>
                        </View>
                    )}
                </View>
                <View>
                    <Text className="font-bold text-gray-900">{item.name || item.username}</Text>
                    <Text className="text-gray-500 text-xs">wants to be friends</Text>
                </View>
            </View>
            <View className="flex-row space-x-2">
                <TouchableOpacity
                    className="bg-blue-600 px-4 py-2 rounded-lg mr-2"
                    onPress={() => handleAccept(item.friendshipId)}
                >
                    <Text className="text-white font-bold text-sm  ">Confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className="bg-gray-200 px-4 py-2 rounded-lg"
                    onPress={() => handleDecline(item.friendshipId)}
                >
                    <Text className="text-gray-700 font-bold text-sm">Decline</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderSentRequestItem = ({ item }: { item: FriendUser }) => (
        <View className="flex-row items-center justify-between py-3 px-4 bg-white border-b border-gray-100">
            <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-gray-200 mr-3 overflow-hidden">
                    {item.avatarUrl ? (
                        <Image
                            source={{
                                uri: item.avatarUrl.startsWith('http')
                                    ? item.avatarUrl
                                    : `${API_URL.replace('/api', '')}${item.avatarUrl}`,
                                headers: { Authorization: `Bearer ${token}` }
                            }}
                            style={{ width: 48, height: 48 }}
                            contentFit="cover"
                        />
                    ) : (
                        <View className="w-full h-full items-center justify-center bg-gray-300">
                            <Text className="text-gray-500 font-bold text-lg">{(item.name?.[0] || item.username?.[0] || '?').toUpperCase()}</Text>
                        </View>
                    )}
                </View>
                <View>
                    <Text className="font-bold text-gray-900">{item.name || item.username}</Text>
                    <Text className="text-gray-500 text-xs">Request Sent</Text>
                </View>
            </View>
            <TouchableOpacity
                className="bg-gray-200 px-4 py-2 rounded-lg"
                onPress={() => handleDelete(item.friendshipId)}
            >
                <Text className="text-gray-700 font-bold text-sm">Cancel</Text>
            </TouchableOpacity>
        </View>
    );

    const renderDeclinedItem = ({ item }: { item: FriendUser }) => (
        <View className="flex-row items-center justify-between py-3 px-4 bg-white border-b border-gray-100 opacity-60">
            <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-gray-200 mr-3 overflow-hidden grayscale">
                    {item.avatarUrl ? (
                        <Image
                            source={{
                                uri: item.avatarUrl.startsWith('http')
                                    ? item.avatarUrl
                                    : `${API_URL.replace('/api', '')}${item.avatarUrl}`,
                                headers: { Authorization: `Bearer ${token}` }
                            }}
                            style={{ width: 48, height: 48 }}
                            contentFit="cover"
                        />
                    ) : (
                        <View className="w-full h-full items-center justify-center bg-gray-300">
                            <Text className="text-gray-500 font-bold text-lg">{(item.name?.[0] || item.username?.[0] || '?').toUpperCase()}</Text>
                        </View>
                    )}
                </View>
                <View>
                    <Text className="font-bold text-gray-900">{item.name || item.username}</Text>
                    <Text className="text-red-500 text-xs">Declined your request</Text>
                </View>
            </View>
            <TouchableOpacity
                className="bg-gray-100 px-4 py-2 rounded-lg"
                onPress={() => handleDelete(item.friendshipId)}
            >
                <Text className="text-gray-500 font-bold text-sm">Remove</Text>
            </TouchableOpacity>
        </View>
    );

    const renderFriendItem = ({ item }: { item: FriendUser }) => (
        <TouchableOpacity
            className="flex-row items-center p-4 bg-white mb-1 rounded-xl shadow-sm"
            onPress={() => router.push(`/(protected)/user/${item.id}`)}
        >
            <View className="w-12 h-12 bg-gray-200 rounded-full mr-3 overflow-hidden border border-gray-100">
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
                    <View className="w-full h-full items-center justify-center bg-gray-300">
                        <Text className="text-gray-600 font-bold">{(item.name?.[0] || item.username?.[0] || '?').toUpperCase()}</Text>
                    </View>
                )}
            </View>
            <View className="flex-1">
                <Text className="font-bold text-gray-900 text-base">{item.name || item.username}</Text>
                <Text className="text-gray-500 text-sm">@{item.username}</Text>
            </View>
            <TouchableOpacity className="p-2">
                <Ionicons name="ellipsis-horizontal" size={20} color="#9CA3AF" />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    const renderGroupItem = ({ item }: { item: Group }) => (
        <TouchableOpacity
            className="flex-row items-center p-4 bg-white mb-1 rounded-xl shadow-sm"
            onPress={() => router.push(`/(protected)/groups/${item.id}`)}
        >
            <View className="w-12 h-12 bg-blue-100 rounded-xl mr-3 overflow-hidden border border-blue-50 items-center justify-center">
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
                    <Ionicons name="people" size={24} color="#3B82F6" />
                )}
            </View>
            <View className="flex-1">
                <Text className="font-bold text-gray-900 text-base">{item.name}</Text>
                <Text className="text-gray-500 text-sm">{item.memberCount} members</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
    );

    return (
        <View className="flex-1 bg-gray-50 pt-12 px-4">
            <View className="flex-row items-center justify-between mb-4">
                <Text className="text-2xl font-bold text-gray-900">Directory</Text>
                <TouchableOpacity onPress={() => router.push('/(protected)/groups/create')}>
                    <Ionicons name="add-circle" size={28} color="#2563EB" />
                </TouchableOpacity>
            </View>

            {/* View Mode Toggle */}
            <View className="flex-row bg-gray-200 p-1 rounded-xl mb-4">
                <TouchableOpacity
                    className={`flex-1 py-2 rounded-lg items-center ${viewMode === 'friends' ? 'bg-white shadow-sm' : ''}`}
                    onPress={() => setViewMode('friends')}
                >
                    <Text className={`font-bold ${viewMode === 'friends' ? 'text-gray-900' : 'text-gray-500'}`}>Friends</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className={`flex-1 py-2 rounded-lg items-center ${viewMode === 'groups' ? 'bg-white shadow-sm' : ''}`}
                    onPress={() => setViewMode('groups')}
                >
                    <Text className={`font-bold ${viewMode === 'groups' ? 'text-gray-900' : 'text-gray-500'}`}>Groups</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#2563EB" />
                </View>
            ) : viewMode === 'groups' ? (
                <FlatList
                    data={groups}
                    renderItem={renderGroupItem}
                    keyExtractor={(item) => item.id}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <View className="items-center justify-center py-20">
                            <Ionicons name="people-outline" size={64} color="#D1D5DB" />
                            <Text className="text-gray-500 mt-4 text-center">You haven't joined any groups yet.</Text>
                            <TouchableOpacity onPress={() => router.push('/(protected)/groups/create')}>
                                <Text className="text-blue-600 font-bold mt-2">Create a Group</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            ) : (
                <FlatList
                    data={friends}
                    ListHeaderComponent={
                        <>
                            {requests.length > 0 && (
                                <View className="mb-6">
                                    <Text className="text-lg font-bold text-gray-900 mb-3">Friend Requests</Text>
                                    {requests.map(item => (
                                        <View key={item.id} className="mb-2">
                                            {renderRequestItem({ item })}
                                        </View>
                                    ))}
                                </View>
                            )}

                            {sentRequests.length > 0 && (
                                <View className="mb-6">
                                    <Text className="text-lg font-bold text-gray-900 mb-3">Sent Requests</Text>
                                    {sentRequests.map(item => (
                                        <View key={item.id} className="mb-2">
                                            {renderSentRequestItem({ item })}
                                        </View>
                                    ))}
                                </View>
                            )}

                            {declinedRequests.length > 0 && (
                                <View className="mb-6">
                                    <Text className="text-lg font-bold text-gray-900 mb-3">Declined Requests</Text>
                                    {declinedRequests.map(item => (
                                        <View key={item.friendshipId}>
                                            {renderDeclinedItem({ item })}
                                        </View>
                                    ))}
                                </View>
                            )}

                            <Text className="text-lg font-bold text-gray-900 mb-3">My Friends</Text>
                        </>
                    }
                    renderItem={renderFriendItem}
                    keyExtractor={(item) => item.id}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <View className="items-center justify-center py-20">
                            <Ionicons name="person-add-outline" size={64} color="#D1D5DB" />
                            <Text className="text-gray-500 mt-4">No friends yet.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}
