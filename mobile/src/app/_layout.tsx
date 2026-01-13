import "../global.css";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup && segments[0] !== "login" && segments[0] !== "signup") {
      // Redirect to the login page if not authenticated
      router.replace("/login");
    } else if (isAuthenticated && (segments[0] === "login" || segments[0] === "signup")) {
      // Redirect to the home page if already authenticated. 
      // This assumes current "login" is a top-level route based on my file creation
      router.replace("/");
    }
  }, [isAuthenticated, segments, isLoading]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View className="flex flex-1 bg-white">
      <Slot />
    </View>
  );
}

export default function Layout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}


