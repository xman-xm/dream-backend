import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { Image } from "expo-image";
import { useAuth } from "../../../context/AuthContext";
import { API_URL } from "../../../lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
    const { user, token } = useAuth();
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: "#ffffff",
                    borderTopWidth: 1,
                    borderTopColor: "#e5e7eb",
                    height: 60 + insets.bottom, // Base height + safe area inset
                    paddingBottom: insets.bottom > 0 ? insets.bottom : 8, // Add safe area padding, or default 8
                    paddingTop: 8,
                },
                tabBarActiveTintColor: "#2563EB",
                tabBarInactiveTintColor: "#6B7280",
                tabBarShowLabel: false,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="home" size={28} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="friends"
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="people" size={28} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="post"
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="add-circle" size={32} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="search"
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="search" size={28} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        user?.avatarUrl ? (
                            <View style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                overflow: 'hidden',
                                borderWidth: focused ? 2 : 0,
                                borderColor: '#2563EB',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}>
                                <Image
                                    source={{
                                        uri: user.avatarUrl.startsWith('http')
                                            ? user.avatarUrl
                                            : `${API_URL.replace('/api', '')}${user.avatarUrl}`,
                                        headers: { Authorization: `Bearer ${token}` }
                                    }}
                                    style={{ width: '100%', height: '100%' }}
                                    contentFit="cover"
                                />
                            </View>
                        ) : (
                            <Ionicons name={focused ? "person" : "person-outline"} size={28} color={color} />
                        )
                    ),
                }}
            />
        </Tabs>
    );
}
