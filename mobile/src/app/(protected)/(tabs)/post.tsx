import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from "expo-router";
import { apiFetch, API_URL } from "../../../lib/api";
import { getToken } from "../../../lib/auth-store";
import { useAuth } from "../../../context/AuthContext";

export default function CreatePost() {
    const router = useRouter();
    const { user } = useAuth();
    const [image, setImage] = useState<string | null>(null);
    const [caption, setCaption] = useState("");
    const [uploading, setUploading] = useState(false);

    const pickImage = async (useCamera: boolean) => {
        let result;
        const options: ImagePicker.ImagePickerOptions = {
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
                setImage(result.assets[0].uri);
            }
        } catch (error) {
            console.error("Error picking image:", error);
            Alert.alert("Error", "Failed to pick image");
        }
    };

    const handleShare = async () => {
        if (!image) return;

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

            const filename = image.split('/').pop() || "upload.jpg";
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : `image/jpeg`;

            // @ts-ignore: FormData expects specific object structure in RN
            formData.append('image', { uri: image, name: filename, type });

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
                setImage(null);
                // Go back to feed
                router.push("/(protected)/(tabs)");
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
                    disabled={!image || uploading}
                    className={`${!image || uploading ? 'opacity-50' : ''}`}
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
                {image ? (
                    <View className="mb-4 w-full items-center">
                        <Image
                            source={{ uri: image }}
                            style={{ width: '100%', aspectRatio: 9 / 16, borderRadius: 12, backgroundColor: '#f3f4f6' }}
                            contentFit="cover"
                        />
                        <View className="flex-row mt-4 space-x-4">
                            <TouchableOpacity onPress={() => setImage(null)} className="bg-gray-100 px-4 py-2 rounded-full">
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
                            <Text className="text-gray-500 font-semibold">Take a Photo</Text>
                        </View>
                    </TouchableOpacity>
                )}

                {!image && (
                    <TouchableOpacity onPress={() => pickImage(false)} className="mb-8">
                        <Text className="text-blue-500 font-semibold">Choose from Library</Text>
                    </TouchableOpacity>
                )}

                {/* Caption Input */}
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
