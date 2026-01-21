import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { Image } from "expo-image";
import { apiFetch } from "../../../lib/api";

type FriendUser = {
    id: string;
    name: string;
    username: string;
    avatarUrl?: string;
    friendshipId: string;
};

export default function Friends() {
    const [friends, setFriends] = useState<FriendUser[]>([]);
    const [requests, setRequests] = useState<FriendUser[]>([]);
    const [sentRequests, setSentRequests] = useState<FriendUser[]>([]);
    const [declinedRequests, setDeclinedRequests] = useState<FriendUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
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
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleAccept = async (friendshipId: string) => {
        try {
            const res = await apiFetch('/friends', {
                method: 'PATCH',
                body: JSON.stringify({ friendshipId })
            });
            if (res.ok) {
                Alert.alert("Connected!", "You are now friends.");
                fetchData(); // Reload to move from requests to friends
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
                fetchData(); // Reload to remove
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
                fetchData();
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
                        <Image source={{ uri: item.avatarUrl }} style={{ width: 48, height: 48 }} contentFit="cover" />
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
                        <Image source={{ uri: item.avatarUrl }} style={{ width: 48, height: 48 }} contentFit="cover" />
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
                        <Image source={{ uri: item.avatarUrl }} style={{ width: 48, height: 48 }} contentFit="cover" />
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
        <View className="flex-row items-center py-3 px-4 bg-white border-b border-gray-100">
            <View className="w-10 h-10 rounded-full bg-gray-200 mr-3 overflow-hidden">
                {item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={{ width: 40, height: 40 }} contentFit="cover" />
                ) : (
                    <View className="w-full h-full items-center justify-center bg-gray-300">
                        <Text className="text-gray-600 font-bold">{(item.name?.[0] || item.username?.[0] || '?').toUpperCase()}</Text>
                    </View>
                )}
            </View>
            <Text className="font-semibold text-gray-900 text-base">{item.name || item.username}</Text>
        </View>
    );

    return (
        <View className="flex-1 bg-white">
            <View className="px-4 py-4 border-b border-gray-200">
                <Text className="text-2xl font-bold text-gray-900">Friends</Text>
            </View>

            <FlatList
                data={null}
                renderItem={() => null}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListHeaderComponent={
                    <View>
                        {/* Incoming Requests Section */}
                        {requests.length > 0 && (
                            <View>
                                <Text className="px-4 py-2 font-bold text-gray-900 text-lg bg-gray-50 border-y border-gray-100">
                                    Friend Requests <Text className="text-red-500 text-sm">{requests.length}</Text>
                                </Text>
                                {requests.map(req => (
                                    <View key={req.friendshipId}>
                                        {renderRequestItem({ item: req })}
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Sent Requests Section */}
                        {sentRequests.length > 0 && (
                            <View>
                                <Text className="px-4 py-2 font-bold text-gray-900 text-lg bg-gray-50 border-y border-gray-100 mt-2">
                                    Sent Requests <Text className="text-gray-500 text-sm">{sentRequests.length}</Text>
                                </Text>
                                {sentRequests.map(req => (
                                    <View key={req.friendshipId}>
                                        {renderSentRequestItem({ item: req })}
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Declined Requests Section */}
                        {declinedRequests.length > 0 && (
                            <View>
                                <Text className="px-4 py-2 font-bold text-gray-900 text-lg bg-gray-50 border-y border-gray-100 mt-2">
                                    Declined Requests <Text className="text-red-500 text-sm">{declinedRequests.length}</Text>
                                </Text>
                                {declinedRequests.map(req => (
                                    <View key={req.friendshipId}>
                                        {renderDeclinedItem({ item: req })}
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Friends List Section */}
                        <Text className="px-4 py-2 font-bold text-gray-900 text-lg bg-gray-50 border-y border-gray-100 mt-2">
                            Your Friends ({friends.length})
                        </Text>
                        {friends.length === 0 ? (
                            <View className="p-8 items-center">
                                <Text className="text-gray-500">No friends yet.</Text>
                                <Text className="text-gray-400 text-sm mt-1">Check the Home feed for suggestions!</Text>
                            </View>
                        ) : (
                            friends.map(friend => (
                                <View key={friend.friendshipId}>
                                    {renderFriendItem({ item: friend })}
                                </View>
                            ))
                        )}
                    </View>
                }
            />
        </View>
    );
}
