import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    FlatList,
    TextInput,
    ActivityIndicator,
    Alert,
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
            } else {
                const data = await res.json().catch(() => null);
                Alert.alert("Could not post comment", data?.error || "Please try again.");
            }
        } catch (error) {
            console.error("Error adding comment:", error);
            Alert.alert("Could not post comment", "Check your connection and try again.");
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
                <Text className="text-zinc-200 text-[13px] leading-5">
                    <Text className="font-bold text-white">{item.author.username} </Text>
                    {item.content}
                </Text>
                <View className="flex-row items-center mt-1.5">
                    <Text className="text-zinc-500 text-[11px]">{dayjs(item.createdAt).fromNow(true)}</Text>
                </View>
            </View>
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-end bg-black/65">
                <View className="bg-[#101318] rounded-t-3xl flex-1 mt-20 overflow-hidden border-t border-zinc-800">
                    {/* Header */}
                    <View className="items-center pt-3 pb-2 border-b border-zinc-800 z-10 bg-[#101318]">
                        <View className="w-10 h-1 bg-zinc-700 rounded-full mb-3" />
                        <View className="flex-row items-center justify-between w-full px-4 mb-2">
                            <View className="w-8" />
                            <Text className="text-[16px] font-bold text-zinc-100">Comments</Text>
                            <TouchableOpacity onPress={onClose} className="p-1" accessibilityRole="button" accessibilityLabel="Close comments">
                                <Ionicons name="close" size={23} color="#d4d4d8" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        className="flex-1"
                        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
                    >
                        {/* Comments List */}
                        <View className="flex-1 bg-[#101318]">
                            {loading ? (
                                <View className="flex-1 items-center justify-center">
                                    <ActivityIndicator color="#a78bfa" />
                                </View>
                            ) : (
                                <FlatList
                                    data={comments}
                                    renderItem={renderCommentItem}
                                    keyExtractor={item => item.id}
                                    ListEmptyComponent={
                                        <View className="py-24 items-center justify-center">
                                            <View className="w-20 h-20 bg-zinc-900 rounded-full items-center justify-center mb-4">
                                                <Ionicons name="chatbubble-outline" size={32} color="#52525b" />
                                            </View>
                                            <Text className="text-zinc-100 font-bold text-lg mb-1">No comments yet</Text>
                                            <Text className="text-zinc-500 text-center px-10 text-[13px]">
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
                        <View className="bg-[#101318] border-t border-zinc-800" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
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
                                <View className="w-9 h-9 rounded-full bg-zinc-800 mr-3 overflow-hidden shrink-0 mb-1">
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
                                            <View className="flex-1 items-center justify-center bg-zinc-700">
                                                <Text className="text-white font-bold">{(user?.name?.[0] || user?.username?.[0] || "U").toUpperCase()}</Text>
                                            </View>
                                    )}
                                </View>

                                <View className="flex-1 flex-row items-end bg-zinc-900 rounded-3xl px-4 min-h-[44px] border border-zinc-700">
                                    <TextInput
                                        className="flex-1 py-3 text-[14px] text-zinc-100 leading-5"
                                        placeholder={`Add a comment for ${user?.username || 'user'}...`}
                                        placeholderTextColor="#8b91a1"
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
                                            accessibilityRole="button"
                                            accessibilityLabel="Post comment"
                                        >
                                            {submitting ? (
                                                <ActivityIndicator size="small" color="#3B82F6" />
                                            ) : (
                                                <Text className="text-violet-300 font-bold text-[14px]">Post</Text>
                                            )}
                                        </TouchableOpacity>
                                    ) : null}
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
