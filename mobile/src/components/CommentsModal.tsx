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
    Platform,
    SafeAreaView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { apiFetch } from "../lib/api";
import dayjs from "dayjs";

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
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [submitting, setSubmitting] = useState(false);

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

    const renderCommentItem = ({ item }: { item: Comment }) => (
        <View className="flex-row px-4 py-3 border-b border-gray-50">
            <View className="w-8 h-8 rounded-full bg-gray-200 mr-3 overflow-hidden">
                {item.author.avatarUrl ? (
                    <Image source={{ uri: item.author.avatarUrl }} style={{ width: '100%', height: '100%' }} />
                ) : (
                    <View className="w-full h-full items-center justify-center bg-blue-100">
                        <Text className="text-blue-600 text-[10px] font-bold">
                            {(item.author.name?.[0] || item.author.username?.[0] || '?').toUpperCase()}
                        </Text>
                    </View>
                )}
            </View>
            <View className="flex-1">
                <View className="flex-row items-baseline mb-0.5">
                    <Text className="font-bold text-gray-900 text-[13px] mr-2">
                        {item.author.name || item.author.username}
                    </Text>
                    <Text className="text-gray-400 text-[10px]">
                        {dayjs(item.createdAt).fromNow()}
                    </Text>
                </View>
                <Text className="text-gray-800 text-[14px] leading-5">
                    {item.content}
                </Text>
            </View>
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <SafeAreaView className="flex-1 bg-white">
                {/* Header */}
                <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
                    <TouchableOpacity onPress={onClose} className="p-1">
                        <Ionicons name="close" size={24} color="#374151" />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-gray-900">Comments</Text>
                    <View className="w-8" />
                </View>

                {/* Comments List */}
                <View className="flex-1">
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
                                <View className="py-20 items-center">
                                    <Text className="text-gray-400">No comments yet. Be the first!</Text>
                                </View>
                            }
                            contentContainerStyle={{ paddingBottom: 20 }}
                        />
                    )}
                </View>

                {/* Input Area */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
                >
                    <View className="flex-row items-center px-4 py-3 border-t border-gray-100 bg-white">
                        <TextInput
                            className="flex-1 bg-gray-50 rounded-full px-4 py-2.5 mr-3 text-gray-900"
                            placeholder="Add a comment..."
                            placeholderTextColor="#9CA3AF"
                            value={newComment}
                            onChangeText={setNewComment}
                            multiline
                            maxLength={500}
                        />
                        <TouchableOpacity
                            onPress={handleAddComment}
                            disabled={!newComment.trim() || submitting}
                            className={`p-2 rounded-full ${!newComment.trim() || submitting ? 'opacity-50' : ''}`}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color="#2563EB" />
                            ) : (
                                <Ionicons name="send" size={20} color="#2563EB" />
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
};
