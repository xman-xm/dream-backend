import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useAuth } from "../../../context/AuthContext";

export default function Profile() {
    const { user, signOut } = useAuth();

    return (
        <View className="flex-1 bg-white p-6">
            <Text className="text-2xl font-bold text-gray-900 mb-6">Profile</Text>

            {user && (
                <View className="items-center mb-8">
                    <View className="bg-blue-100 rounded-full w-24 h-24 items-center justify-center mb-4">
                        <Text className="text-blue-600 font-bold text-3xl">
                            {(user.name?.[0] || user.email[0]).toUpperCase()}
                        </Text>
                    </View>
                    <Text className="text-xl font-bold text-gray-900">{user.name || user.email.split('@')[0]}</Text>
                    <Text className="text-gray-500">{user.email}</Text>
                </View>
            )}

            <TouchableOpacity
                onPress={signOut}
                className="bg-red-50 py-4 rounded-xl items-center border border-red-100"
            >
                <Text className="text-red-600 font-medium text-lg">Sign Out</Text>
            </TouchableOpacity>
        </View>
    );
}
