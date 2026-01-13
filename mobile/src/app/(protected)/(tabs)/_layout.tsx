import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
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
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="person-circle" size={28} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
