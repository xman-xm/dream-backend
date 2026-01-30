import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { apiFetch, API_URL } from "../../../lib/api";
import { getToken } from "../../../lib/auth-store";
import { useAuth } from "../../../context/AuthContext";

export default function CreatePost() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const groupId = typeof params.groupId === 'string' ? params.groupId : null;

    const { user } = useAuth();
    const [media, setMedia] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
    const [caption, setCaption] = useState("");
    const [uploading, setUploading] = useState(false);

    const pickImage = async (useCamera: boolean) => {
        let result;
        const options: ImagePicker.ImagePickerOptions = {
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: true,
            aspect: [9, 16],
            quality: 0.8,
        };

        try {
            if (useCamera) {
                await ImagePicker.requestCameraPermissionsAsync();
                result = await ImagePicker.launchCameraAsync(options);
            } else {
                await ImagePicker.requestMediaLibraryPermissionsAsync();
                result = await ImagePicker.launchImageLibraryAsync(options);
            }

            if (!result.canceled) {
                const asset = result.assets[0];
                setMedia(asset.uri);
                setMediaType(asset.type === 'video' ? 'video' : 'image');
            }
        } catch (error) {
            console.error("Error picking image:", error);
            Alert.alert("Error", "Failed to pick image");
        }
    };

    const handleShare = async () => {
        if (!media) return;

        if (!user?.id) {
            Alert.alert("Error", "User identification missing. Please restart app.");
            return;
        }

        setUploading(true);
        try {
            const token = await getToken();
            if (!token) throw new Error("Not authenticated");

            const formData = new FormData();
            formData.append('caption', caption);
            formData.append('authorId', user.id);
            if (groupId) {
                formData.append('groupId', groupId);
            }

            const filename = media.split('/').pop() || (mediaType === 'video' ? "upload.mp4" : "upload.jpg");

            // Allow override based on actual media type if simple inference fails
            let type = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';

            // Try to infer from extension if available
            const match = /\.(\w+)$/.exec(filename);
            if (match) {
                type = `${mediaType}/${match[1]}`;
            }

            // @ts-ignore: FormData expects specific object structure in RN
            formData.append('image', { uri: media, name: filename, type });

            const response = await fetch(`${API_URL}/post`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    // Content-Type is handled automatically by FormData
                },
                body: formData
            });

            if (response.ok) {
                setCaption("");
                setMedia(null);
                setMediaType('image');
                // Return to previous screen (Group Detail) if from group
                if (groupId) {
                    router.back();
                } else {
                    router.push("/(protected)/(tabs)");
                }
            } else {
                const err = await response.json();
                Alert.alert("Error", err.error || "Failed to upload");
            }

        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to upload post");
        } finally {
            setUploading(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-white">
            {/* Header */}
            <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-100">
                <Text className="text-xl font-bold text-gray-900">New Post</Text>
                <TouchableOpacity
                    onPress={handleShare}
                    disabled={!media || uploading}
                    className={`${!media || uploading ? 'opacity-50' : ''}`}
                >
                    {uploading ? (
                        <ActivityIndicator />
                    ) : (
                        <Text className="text-blue-500 font-semibold text-lg">Share</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View className="items-center mt-4 px-4">
                {media ? (
                    <View className="mb-4 w-full items-center">
                        {mediaType === 'video' ? (
                            <Video
                                source={{ uri: media }}
                                style={{ width: '100%', aspectRatio: 9 / 16, borderRadius: 12, backgroundColor: '#f3f4f6' }}
                                resizeMode={ResizeMode.COVER}
                                useNativeControls
                                isLooping
                                shouldPlay={false} // Don't auto play in preview
                            />
                        ) : (
                            <Image
                                source={{ uri: media }}
                                style={{ width: '100%', aspectRatio: 9 / 16, borderRadius: 12, backgroundColor: '#f3f4f6' }}
                                contentFit="cover"
                            />
                        )}
                        <View className="flex-row mt-4 space-x-4">
                            <TouchableOpacity onPress={() => setMedia(null)} className="bg-gray-100 px-4 py-2 rounded-full">
                                <Text className="font-semibold text-gray-700">Retake</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity
                        onPress={() => pickImage(true)}
                        className="w-full aspect-[9/16] bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 items-center justify-center mb-6"
                    >
                        <View className="items-center">
                            <Text className="text-4xl mb-2">📸</Text>
                            <Text className="text-gray-500 font-semibold">Take Photo / Video</Text>
                        </View>
                    </TouchableOpacity>
                )}

                {!media && (
                    <TouchableOpacity onPress={() => pickImage(false)} className="mb-8">
                        <Text className="text-blue-500 font-semibold">Choose from Library</Text>
                    </TouchableOpacity>
                )}

                {/* Caption Input */}
                {groupId && (
                    <View className="w-full bg-blue-50 p-3 rounded-lg flex-row items-center mb-4 border border-blue-100">
                        <Ionicons name="people" size={20} color="#2563EB" />
                        <Text className="text-blue-700 font-bold ml-2">Posting to Group</Text>
                    </View>
                )}
                <View className="w-full">
                    <TextInput
                        className="w-full text-lg text-gray-900 min-h-[100px]"
                        placeholder="Write a caption..."
                        placeholderTextColor="#9ca3af"
                        multiline
                        value={caption}
                        onChangeText={setCaption}
                        textAlignVertical="top"
                    />
                </View>
            </View>
        </ScrollView>
    );
}
