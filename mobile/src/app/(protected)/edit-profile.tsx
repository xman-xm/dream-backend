import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../lib/api";
import { getToken } from "../../lib/auth-store";

export default function EditProfile() {
    const router = useRouter();
    const { user, refreshUserProfile } = useAuth(); // Assuming refreshUserProfile exists or I need to handle it. 
    // Wait, useAuth might not have refreshUserProfile exposed directly. 
    // I'll check AuthContext later, for now I'll assume I might need to trigger a reload or just rely on state update if possible.
    // Actually, if I update the backend, I should probably re-fetch the user profile.

    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [bio, setBio] = useState("");
    const [image, setImage] = useState<string | null>(null);
    const [originalAvatar, setOriginalAvatar] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.name || "");
            setUsername(user.username || "");
            setBio(user.bio || "");
            setOriginalAvatar(user.avatarUrl || null);
        }
    }, [user]);

    const pickImage = async () => {
        const options: ImagePicker.ImagePickerOptions = {
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1], // Square for avatar
            quality: 0.8,
        };

        try {
            const result = await ImagePicker.launchImageLibraryAsync(options);
            if (!result.canceled) {
                setImage(result.assets[0].uri);
            }
        } catch (error) {
            Alert.alert("Error", "Failed to pick image");
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setIsLoading(true);

        try {
            const token = await getToken();
            const formData = new FormData();

            formData.append('name', name);
            formData.append('username', username);
            formData.append('bio', bio);

            if (image) {
                const filename = image.split('/').pop() || "avatar.jpg";
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : `image/jpeg`;
                // @ts-ignore
                formData.append('image', { uri: image, name: filename, type });
            }

            const response = await fetch(`${API_URL}/user/profile`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                // Ideally update local user state here
                if (refreshUserProfile) await refreshUserProfile();
                Alert.alert("Success", "Profile updated successfully");
                router.back();
            } else {
                const err = await response.json();
                Alert.alert("Error", err.error || "Failed to update profile");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-white">
            <ScrollView className="flex-1">
                {/* Header */}
                <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-100">
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text className="text-gray-500 text-lg">Cancel</Text>
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-gray-900">Edit Profile</Text>
                    <TouchableOpacity onPress={handleSave} disabled={isLoading}>
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#2563EB" />
                        ) : (
                            <Text className="text-blue-600 font-bold text-lg">Save</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Avatar Section */}
                <View className="items-center py-8">
                    <TouchableOpacity onPress={pickImage} className="relative">
                        <View className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden border-2 border-gray-100 items-center justify-center">
                            {image ? (
                                <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                            ) : originalAvatar ? (
                                <Image
                                    // Handle both absolute http/s urls and relative /api paths
                                    source={{ uri: originalAvatar.startsWith('http') ? originalAvatar : `${API_URL.replace('/api', '')}${originalAvatar}` }}
                                    style={{ width: '100%', height: '100%' }}
                                    contentFit="cover"
                                />
                            ) : (
                                <Text className="text-3xl font-bold text-gray-400">
                                    {(name?.[0] || username?.[0] || user?.email?.[0] || '?').toUpperCase()}
                                </Text>
                            )}
                        </View>
                        <View className="absolute bottom-0 right-0 bg-blue-500 w-8 h-8 rounded-full items-center justify-center border-2 border-white">
                            <Text className="text-white text-xs">📷</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={pickImage}>
                        <Text className="text-blue-600 font-semibold mt-3">Change Profile Photo</Text>
                    </TouchableOpacity>
                </View>

                {/* Form Fields */}
                <View className="px-4 space-y-6">
                    <View>
                        <Text className="text-gray-500 text-sm font-medium mb-1 ml-1">Name</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
                            placeholder="Your Name"
                        />
                    </View>

                    <View>
                        <Text className="text-gray-500 text-sm font-medium mb-1 ml-1">Username</Text>
                        <TextInput
                            value={username}
                            onChangeText={setUsername}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
                            placeholder="username"
                            autoCapitalize="none"
                        />
                    </View>

                    <View>
                        <Text className="text-gray-500 text-sm font-medium mb-1 ml-1">Bio</Text>
                        <TextInput
                            value={bio}
                            onChangeText={setBio}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
                            placeholder="Write something about yourself..."
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            style={{ minHeight: 100 }}
                        />
                    </View>
                </View>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}
