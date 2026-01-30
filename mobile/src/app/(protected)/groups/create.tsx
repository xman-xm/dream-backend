import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';

export default function CreateGroup() {
    const router = useRouter();
    const { token } = useAuth();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [image, setImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            Alert.alert("Error", "Please enter a group name");
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('isPrivate', String(isPrivate));
            if (description) formData.append('description', description);

            if (image) {
                const filename = image.split('/').pop() || 'group-avatar.jpg';
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : 'image/jpeg';

                // @ts-ignore
                formData.append('avatar', {
                    uri: image,
                    name: filename,
                    type,
                });
            }

            const res = await apiFetch('/groups', {
                method: 'POST',
                body: formData,
                headers: {
                    // Do NOT set Content-Type manually, let fetch handle boundary
                }
            });

            if (res.ok) {
                Alert.alert("Success", "Group created!");
                router.back();
            } else {
                const data = await res.json();
                Alert.alert("Error", data.error || "Failed to create group");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Network error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-white p-6">
            <View className="items-center mb-8">
                <Text className="text-2xl font-bold text-gray-900 mb-6">Create New Group</Text>

                <TouchableOpacity onPress={pickImage} className="relative">
                    <View className="w-32 h-32 rounded-full bg-gray-100 items-center justify-center overflow-hidden border border-gray-200">
                        {image ? (
                            <Image source={{ uri: image }} className="w-full h-full" />
                        ) : (
                            <Ionicons name="camera" size={40} color="#9CA3AF" />
                        )}
                    </View>
                    <View className="absolute bottom-0 right-0 bg-blue-600 w-10 h-10 rounded-full items-center justify-center border-2 border-white">
                        <Ionicons name="pencil" size={20} color="white" />
                    </View>
                </TouchableOpacity>
                <Text className="text-gray-500 mt-2 text-sm">Add Group Icon</Text>
            </View>

            <View className="mb-6">
                <Text className="text-gray-700 font-bold mb-2">Group Name</Text>
                <TextInput
                    className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 text-base"
                    placeholder="e.g. Photography Lovers"
                    value={name}
                    onChangeText={setName}
                />
            </View>

            <View className="mb-8">
                <Text className="text-gray-700 font-bold mb-2">Description (Optional)</Text>
                <TextInput
                    className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 text-base h-32"
                    placeholder="What is this group about?"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    textAlignVertical="top"
                />
            </View>

            <View className="flex-row items-center justify-between mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <View>
                    <Text className="text-gray-900 font-bold text-base">Private Group</Text>
                    <Text className="text-gray-500 text-xs mt-1">Only members can see posts and join.</Text>
                </View>
                <Switch
                    trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
                    thumbColor={isPrivate ? "#2563EB" : "#F3F4F6"}
                    ios_backgroundColor="#3e3e3e"
                    onValueChange={setIsPrivate}
                    value={isPrivate}
                />
            </View>

            <TouchableOpacity
                className={`w-full py-4 rounded-xl items-center ${loading || !name ? 'bg-blue-300' : 'bg-blue-600'}`}
                onPress={handleCreate}
                disabled={loading || !name}
            >
                {loading ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text className="text-white font-bold text-lg">Create Group</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                className="w-full py-4 mt-2 items-center"
                onPress={() => router.back()}
                disabled={loading}
            >
                <Text className="text-gray-500 font-bold">Cancel</Text>
            </TouchableOpacity>
        </View>
    );
}
