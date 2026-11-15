import "../global.css";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { NetworkProvider } from "../context/NetworkContext";

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(user)" || segments[0] === "login" || segments[0] === "signup";

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to the login page if not authenticated
      router.replace("/login");
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to the home page if already authenticated. 
      router.replace("/");
    }
  }, [isAuthenticated, segments, isLoading]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-[#08080d]">
        <ActivityIndicator size="large" color="#c4b5fd" />
      </View>
    );
  }

  return (
    <View className="flex flex-1 bg-[#08080d]">
      <Slot />
    </View>
  );
}

export default function Layout() {
  return (
    <AuthProvider>
      <NetworkProvider>
        <RootLayoutNav />
      </NetworkProvider>
    </AuthProvider>
  );
}


