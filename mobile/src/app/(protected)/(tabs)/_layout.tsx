import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useAuth } from "../../../context/AuthContext";
import { API_URL } from "../../../lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
    const { user, token } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: "#08080d",
                    borderTopWidth: 1,
                    borderTopColor: "#ffffff12",
                    height: 64 + insets.bottom,
                    paddingBottom: insets.bottom > 0 ? insets.bottom : 7,
                    paddingTop: 5,
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 20,
                    elevation: 20,
                },
                tabBarActiveTintColor: "#ffffff",
                tabBarInactiveTintColor: "#777581",
                tabBarShowLabel: true,
                tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 1 },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Home",
                    tabBarAccessibilityLabel: "Home feed",
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="search"
                options={{
                    title: "Discover",
                    tabBarAccessibilityLabel: "Discover creators and videos",
                    tabBarIcon: ({ color }) => (
                        <Ionicons name="search-outline" size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="post"
                options={{
                    title: "Create",
                    tabBarAccessibilityLabel: "Create an AI video or post",
                    tabBarButton: (props) => (
                        <TouchableOpacity
                            onPress={() => router.push("/(protected)/create")}
                            style={[props.style, { alignItems: "center", justifyContent: "center" }]}
                            accessibilityRole="button"
                            accessibilityLabel="Create video"
                            accessibilityState={props.accessibilityState}
                            testID={props.testID}
                            onLongPress={props.onLongPress}
                        >
                            <View style={{
                                width: 42,
                                height: 32,
                                borderRadius: 11,
                                backgroundColor: '#ffffff',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <Ionicons name="sparkles" size={19} color="#16131f" />
                            </View>
                        </TouchableOpacity>
                    ),
                }}
            />
            <Tabs.Screen
                name="friends"
                options={{
                    title: "Activity",
                    tabBarAccessibilityLabel: "Activity notifications",
                    tabBarIcon: ({ color }) => (
                        <Ionicons name="notifications-outline" size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarAccessibilityLabel: "Your profile",
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
