import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isErrorWithCode,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
} from "react-native-nitro-google-signin";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

export default function Login() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    if (isSubmitting) return;
    setSignInError(null);

    if (Platform.OS === "web") {
      setSignInError("Google sign-in requires the Android or iOS development build. Open the installed app, not the browser preview.");
      return;
    }

    setIsSubmitting(true);

    try {
      const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
      if (!webClientId) {
        throw new Error("Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in the build environment.");
      }

      GoogleOneTapSignIn.configure({ webClientId });
      await GoogleOneTapSignIn.checkPlayServices();

      let result = await GoogleOneTapSignIn.signIn();
      if (isNoSavedCredentialFoundResponse(result)) {
        result = await GoogleOneTapSignIn.createAccount();
      }
      if (isNoSavedCredentialFoundResponse(result)) {
        result = await GoogleOneTapSignIn.presentExplicitSignIn();
      }
      if (isCancelledResponse(result)) {
        setSignInError("Google did not open a sign-in prompt. Check that this Android build's package name and signing SHA-1 are registered in the same Google Cloud project as the Web client ID, then rebuild and reinstall.");
        return;
      }
      if (!isSuccessResponse(result) || !result.data.idToken) {
        throw new Error("Google did not return a sign-in credential. Please try again.");
      }

      const response = await apiFetch("/auth/mobile/google", {
        method: "POST",
        requiresAuth: false,
        body: JSON.stringify({ idToken: result.data.idToken }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Google sign-in could not be completed.");
      }

      await signIn(data.token, data.user);
      router.replace("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again in a moment.";
      console.error("[Google sign-in] Failed:", error);
      const code = isErrorWithCode(error) ? ` (${error.code})` : "";
      setSignInError(`${message}${code}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#08080d]" edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#08080d" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between" }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View className="flex-1 justify-center px-7 pt-10 pb-8">
          <View className="self-center items-center mb-12">
            <View className="w-[76px] h-[76px] rounded-[26px] bg-[#171526] border border-violet-300/25 items-center justify-center mb-5">
              <Ionicons name="sparkles" size={36} color="#c4b5fd" />
            </View>
            <Text className="text-white text-[15px] font-bold tracking-[4px] uppercase">SocialApp</Text>
          </View>

          <View className="mb-10">
            <Text className="text-white text-[38px] leading-[44px] font-extrabold text-center">
              Imagine it.{"\n"}Make it real.
            </Text>
            <Text className="text-zinc-400 text-base leading-6 text-center mt-4 px-2">
              Create AI videos, discover fresh ideas, and share your world with creators.
            </Text>
          </View>

          <View className="flex-row justify-center mb-10">
            {[
              { icon: "sparkles-outline" as const, label: "Create" },
              { icon: "play-circle-outline" as const, label: "Discover" },
              { icon: "people-outline" as const, label: "Connect" },
            ].map((feature) => (
              <View key={feature.label} className="items-center mx-4">
                <View className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/[0.08] items-center justify-center mb-2">
                  <Ionicons name={feature.icon} size={21} color="#c4b5fd" />
                </View>
                <Text className="text-zinc-400 text-xs font-medium">{feature.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => void handleGoogleSignIn()}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
            activeOpacity={0.85}
            className={`w-full h-[58px] rounded-2xl bg-white flex-row items-center justify-center ${isSubmitting ? "opacity-70" : ""}`}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#171717" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#4285F4" />
                <Text className="text-[#171717] font-bold text-base ml-3">Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {signInError ? (
            <Text accessibilityRole="alert" className="text-red-300 text-sm leading-5 text-center mt-4">
              {signInError}
            </Text>
          ) : null}

          <Text className="text-zinc-500 text-xs leading-5 text-center mt-5">
            Sign in securely with your Google account. Your account is used to personalize your feed and creations.
          </Text>
        </View>

        <View className="px-8 pb-5">
          <View className="h-px bg-white/[0.08] mb-4" />
          <Text className="text-zinc-600 text-[11px] leading-4 text-center">
            Google sign-in · Secure account access
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}