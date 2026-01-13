import React from "react";
import { View, Text } from "react-native";

export default function CreatePost() {
    return (
        <View className="flex-1 bg-white items-center justify-center">
            <Text className="text-xl font-bold text-gray-900">Create Post</Text>
            <Text className="text-gray-500 mt-2">Share what's on your mind...</Text>
        </View>
    );
}
