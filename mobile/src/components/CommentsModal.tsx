import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    FlatList,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { apiFetch, API_URL } from "../lib/api";
import dayjs from "dayjs";
import { useAuth } from "../context/AuthContext";

type CommentAuthor = {
    id: string;
    username: string;
    name: string | null;
    avatarUrl: string | null;
};

type Comment = {
    id: string;
    content: string;
    createdAt: string;
    author: CommentAuthor;
};

interface CommentsModalProps {
    visible: boolean;
    onClose: () => void;
    postId: string;
    onCommentAdded?: () => void;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({
    visible,
    onClose,
    postId,
    onCommentAdded
}) => {
    const { token, user } = useAuth();
    const insets = useSafeAreaInsets();
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const EMOJIS = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '🤣'];

    const fetchComments = useCallback(async () => {
        if (!postId) return;
        setLoading(true);
        try {
            const res = await apiFetch(`/post/${postId}/comments`);
            if (res.ok) {
                const data = await res.json();
                setComments(data);
            }
        } catch (error) {
            console.error("Error fetching comments:", error);
        } finally {
            setLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        if (visible && postId) {
            fetchComments();
        }
    }, [visible, postId, fetchComments]);

    const handleAddComment = async () => {
        if (!newComment.trim() || submitting) return;

        setSubmitting(true);
        try {
            const res = await apiFetch(`/post/${postId}/comments`, {
                method: 'POST',
                body: JSON.stringify({ content: newComment.trim() })
            });

            if (res.ok) {
                const data = await res.json();
                setComments(prev => [data, ...prev]);
                setNewComment("");
                if (onCommentAdded) onCommentAdded();
            }
        } catch (error) {
            console.error("Error adding comment:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEmojiPress = (emoji: string) => {
        setNewComment(prev => prev + emoji);
    };

    const renderCommentItem = ({ item }: { item: Comment }) => (
        <View className="flex-row px-4 py-3 mb-2">
            <View className="w-9 h-9 rounded-full bg-gray-200 mr-3 overflow-hidden border border-gray-100 mt-1">
                {item.author.avatarUrl ? (
                    <Image
                        source={{
                            uri: item.author.avatarUrl.startsWith('http')
                                ? item.author.avatarUrl
                                : `${API_URL.replace('/api', '')}${item.author.avatarUrl}`,
                            headers: { Authorization: `Bearer ${token}` }
                        }}
                        style={{ width: '100%', height: '100%' }}
                    />
                ) : (
                    <View className="w-full h-full items-center justify-center bg-blue-100">
                        <Text className="text-blue-600 text-[10px] font-bold">
                            {(item.author.name?.[0] || item.author.username?.[0] || '?').toUpperCase()}
                        </Text>
                    </View>
                )}
            </View>
            <View className="flex-1 pr-2">
                <Text className="text-gray-900 text-[13px] leading-5">
                    <Text className="font-bold">{item.author.username} </Text>
                    {item.content}
                </Text>
                <View className="flex-row items-center mt-1.5">
                    <Text className="text-gray-500 text-[11px] mr-4">
                        {dayjs(item.createdAt).fromNow(true)}
                    </Text>
                    <TouchableOpacity className="mr-4">
                        <Text className="text-gray-500 text-[11px] font-semibold">Reply</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <TouchableOpacity className="mt-2">
                <Ionicons name="heart-outline" size={14} color="#6B7280" />
            </TouchableOpacity>
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-end bg-black/40">
                <View className="bg-white rounded-t-3xl flex-1 mt-20 overflow-hidden">
                    {/* Header */}
                    <View className="items-center pt-3 pb-2 border-b border-gray-100 z-10 bg-white">
                        <View className="w-10 h-1 bg-gray-300 rounded-full mb-3" />
                        <View className="flex-row items-center justify-between w-full px-4 mb-2">
                            <View className="w-8" />
                            <Text className="text-[16px] font-bold text-gray-900">Comments</Text>
                            <TouchableOpacity className="p-1">
                                <Ionicons name="paper-plane-outline" size={22} color="#111827" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        className="flex-1"
                        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
                    >
                        {/* Comments List */}
                        <View className="flex-1 bg-white">
                            {loading ? (
                                <View className="flex-1 items-center justify-center">
                                    <ActivityIndicator color="#2563EB" />
                                </View>
                            ) : (
                                <FlatList
                                    data={comments}
                                    renderItem={renderCommentItem}
                                    keyExtractor={item => item.id}
                                    ListEmptyComponent={
                                        <View className="py-24 items-center justify-center">
                                            <View className="w-20 h-20 bg-gray-50 rounded-full items-center justify-center mb-4">
                                                <Ionicons name="chatbubble-outline" size={32} color="#CBD5E1" />
                                            </View>
                                            <Text className="text-gray-900 font-bold text-lg mb-1">No comments yet</Text>
                                            <Text className="text-gray-400 text-center px-10 text-[13px]">
                                                Start the conversation.
                                            </Text>
                                        </View>
                                    }
                                    contentContainerStyle={{ paddingBottom: 20 }}
                                    showsVerticalScrollIndicator={false}
                                />
                            )}
                        </View>

                        {/* Input Area */}
                        <View className="bg-white border-t border-gray-100 pb-5">
                            {/* Emoji Bar */}
                            <FlatList
                                horizontal
                                data={EMOJIS}
                                keyExtractor={(item) => item}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        onPress={() => handleEmojiPress(item)}
                                        className="px-3 py-2"
                                    >
                                        <Text className="text-[20px]">{item}</Text>
                                    </TouchableOpacity>
                                )}
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 12 }}
                                className="py-1"
                            />

                            {/* Input Row */}
                            <View className="flex-row items-end px-3 py-2">
                                <View className="w-9 h-9 rounded-full bg-gray-200 mr-3 overflow-hidden shrink-0 mb-1">
                                    {user?.avatarUrl ? (
                                        <Image
                                            source={{
                                                uri: user.avatarUrl.startsWith('http')
                                                    ? user.avatarUrl
                                                    : `${API_URL.replace('/api', '')}${user.avatarUrl}`,
                                                headers: { Authorization: `Bearer ${token}` }
                                            }}
                                            style={{ width: '100%', height: '100%' }}
                                        />
                                    ) : (
                                        <Image
                                            source={{ uri: `https://ui-avatars.com/api/?name=${user?.name || user?.username || 'User'}&background=random` }}
                                            style={{ width: '100%', height: '100%' }}
                                        />
                                    )}
                                </View>

                                <View className="flex-1 flex-row items-end bg-gray-100 rounded-3xl px-4 min-h-[44px] border border-gray-200">
                                    <TextInput
                                        className="flex-1 py-3 text-[14px] text-gray-900 leading-5"
                                        placeholder={`Add a comment for ${user?.username || 'user'}...`}
                                        placeholderTextColor="#6B7280"
                                        value={newComment}
                                        onChangeText={setNewComment}
                                        multiline
                                        maxLength={500}
                                        style={{ maxHeight: 100, minHeight: 44, paddingRight: 30 }}
                                    />
                                    {newComment.trim().length > 0 ? (
                                        <TouchableOpacity
                                            onPress={handleAddComment}
                                            disabled={submitting}
                                            className="ml-1 mb-2.5 mr-[-4px]"
                                        >
                                            {submitting ? (
                                                <ActivityIndicator size="small" color="#3B82F6" />
                                            ) : (
                                                <Text className="text-blue-500 font-bold text-[14px]">Post</Text>
                                            )}
                                        </TouchableOpacity>
                                    ) : (
                                        <View className="ml-1 mb-2.5 mr-[-4px] opacity-50">
                                            <TouchableOpacity disabled>
                                                <View className="bg-gray-400 rounded px-1.5 py-0.5">
                                                    <Text className="text-white text-[10px] font-bold">GIF</Text>
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>

                {/* Close Overlay Tap Zone */}
                <TouchableOpacity
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100 }}
                    onPress={onClose}
                />
            </View>
        </Modal>
    );
};
