import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch, API_URL } from '../../../../lib/api';
import { useAuth } from '../../../../context/AuthContext';
import { Image } from 'expo-image';

export default function EditPostScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { token } = useAuth();
    const [caption, setCaption] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [post, setPost] = useState<any>(null);

    useEffect(() => {
        const fetchPost = async () => {
            try {
                // We reuse the search results or fetch again. 
                // Since we don't have a direct 'GET /post/:id' that returns details easily without complex includes, 
                // we might need a specific endpoint or just rely on what we have.
                // Actually, let's assume web/app/api/(protected)/post/[id]/route.ts has a GET method too.
                // Let's check.
                const res = await apiFetch(`/post/${id}`);
                if (res.ok) {
                    const data = await res.json();
                    setPost(data);
                    setCaption(data.caption || '');
                } else {
                    Alert.alert("Error", "Could not load post details.");
                    router.back();
                }
            } catch (error) {
                console.error(error);
                Alert.alert("Error", "Network error.");
            } finally {
                setLoading(false);
            }
        };

        fetchPost();
    }, [id]);

    const handleSave = async () => {
        if (saving) return;

        setSaving(true);
        try {
            const res = await apiFetch(`/post/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ caption }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                Alert.alert("Success", "Post updated successfully.", [
                    { text: "OK", onPress: () => router.back() }
                ]);
            } else {
                const data = await res.json();
                Alert.alert("Error", data.error || "Failed to update post.");
            }
        } catch (error) {
            Alert.alert("Error", "Network error.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-white"
        >
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="close" size={28} color="#1F2937" />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-gray-900">Edit Post</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    {saving ? (
                        <ActivityIndicator size="small" color="#2563EB" />
                    ) : (
                        <Text className="text-blue-600 font-bold text-base">Done</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
                {post?.media && (
                    <View className="w-full aspect-square bg-gray-100 rounded-xl mb-6 overflow-hidden">
                        <Image
                            source={{
                                uri: post.media.startsWith('http') ? post.media : `${API_URL.replace('/api', '')}${post.media}`,
                                headers: { Authorization: `Bearer ${token}` }
                            }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                        />
                    </View>
                )}

                <Text className="text-gray-900 font-bold text-base mb-2">Caption</Text>
                <TextInput
                    className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 min-h-[120px]"
                    placeholder="Write a caption..."
                    multiline
                    value={caption}
                    onChangeText={setCaption}
                    textAlignVertical="top"
                />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
