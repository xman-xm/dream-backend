import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, API_URL } from "../../../lib/api";
import { getToken } from "../../../lib/auth-store";
import { useAuth } from "../../../context/AuthContext";
import VideoRecorder from "../../../components/VideoRecorder";

type CreateMode = "generate" | "upload";

export default function CreatePost() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [mode, setMode] = useState<CreateMode>("generate");
  const [prompt, setPrompt] = useState("");
  const [drafts, setDrafts] = useState<string[]>([]);
  const [jobStatus, setJobStatus] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [showDrafts, setShowDrafts] = useState(false);

  const [media, setMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const slideY = useRef(new Animated.Value(Platform.OS === "web" ? Dimensions.get("window").height : 0)).current;
  const isClosing = useRef(false);

  useFocusEffect(useCallback(() => {
    if (Platform.OS !== "web") return;
    isClosing.current = false;
    slideY.setValue(Dimensions.get("window").height);
    const animation = Animated.timing(slideY, {
      toValue: 0,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [slideY]));

  useEffect(() => {
    let cancelled = false;
    const loadSavedData = async () => {
      try {
        const savedDrafts = Platform.OS === "web"
          ? localStorage.getItem("veo-drafts")
          : await SecureStore.getItemAsync("veo-drafts");
        if (cancelled) return;
        if (savedDrafts) {
          const parsed: unknown = JSON.parse(savedDrafts);
          if (Array.isArray(parsed)) setDrafts(parsed.filter((entry): entry is string => typeof entry === "string"));
        }
      } catch (error) {
        console.warn("Unable to load saved video prompts:", error);
      }
    };
    void loadSavedData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activeJobId || !isGenerating) return;
    let cancelled = false;
    const pollStatus = async () => {
      try {
        const response = await apiFetch(`/video/status/${activeJobId}`);
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        setJobStatus(data.status);
        if (data.status === "COMPLETED") {
          setGeneratedVideoUrl(data.videoAsset?.storageUrl || null);
          setIsGenerating(false);
        } else if (data.status === "FAILED") {
          setIsGenerating(false);
          Alert.alert("Generation failed", data.errorMessage || "The video could not be generated.");
        }
      } catch (error) {
        console.error("Video status polling failed:", error);
      }
    };
    void pollStatus();
    const interval = setInterval(() => void pollStatus(), 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeJobId, isGenerating]);

  const closeComposer = () => {
    if (isClosing.current) return;
    isClosing.current = true;
    const dismiss = () => {
      if (router.canGoBack()) router.back();
      else router.replace("/(protected)/(tabs)");
    };

    if (Platform.OS === "web") {
      Animated.timing(slideY, {
        toValue: Dimensions.get("window").height,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(dismiss);
    } else {
      dismiss();
    }
  };

  const persistDrafts = async (nextDrafts: string[]) => {
    try {
      const serialized = JSON.stringify(nextDrafts);
      if (Platform.OS === "web") localStorage.setItem("veo-drafts", serialized);
      else await SecureStore.setItemAsync("veo-drafts", serialized);
    } catch (error) {
      console.warn("Could not save video drafts on this device:", error);
    }
  };

  const saveDraft = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    const next = [trimmed, ...drafts.filter((draft) => draft !== trimmed)].slice(0, 8);
    setDrafts(next);
    await persistDrafts(next);
    setShowDrafts(true);
  };

  const deleteDraft = async (draft: string) => {
    const next = drafts.filter((entry) => entry !== draft);
    setDrafts(next);
    await persistDrafts(next);
  };

  const generateVideo = async () => {
    if (!prompt.trim()) {
      Alert.alert("Write a prompt", "Describe the video you want to create.");
      return;
    }
    setGeneratedVideoUrl(null);
    setIsGenerating(true);
    setJobStatus("QUEUED");
    try {
      const response = await apiFetch("/video/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: prompt.trim(), durationSeconds: 8, resolution: "720p", aspectRatio: "9:16" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start video generation.");
      setActiveJobId(data.jobId);
      setJobStatus(data.status || "GENERATING");
    } catch (error) {
      setIsGenerating(false);
      Alert.alert("Could not generate video", error instanceof Error ? error.message : "Please try again.");
    }
  };

  const pickMedia = async (useCamera: boolean) => {
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.85,
      };
      let result;
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return Alert.alert("Camera permission", "Allow camera access to capture media.");
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return Alert.alert("Library permission", "Allow photo access to choose media.");
        result = await ImagePicker.launchImageLibraryAsync(options);
      }
      if (!result.canceled) {
        const asset = result.assets[0];
        setMedia(asset.uri);
        setMediaType(asset.type === "video" ? "video" : "image");
      }
    } catch (error) {
      console.error("Media picker failed:", error);
      Alert.alert("Media error", "Could not open the camera or photo library.");
    }
  };

  const shareUpload = async () => {
    if (!media || !user?.id) return;
    setUploading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const formData = new FormData();
      formData.append("caption", caption);
      formData.append("authorId", user.id);
      const filename = media.split("/").pop() || (mediaType === "video" ? "upload.mp4" : "upload.jpg");
      const extension = /\.(\w+)$/.exec(filename)?.[1];
      const mimeType = mediaType === "video"
        ? (extension ? `video/${extension}` : "video/mp4")
        : (extension ? `image/${extension}` : "image/jpeg");
      formData.append("image", { uri: media, name: filename, type: mimeType } as unknown as Blob);
      const response = await fetch(`${API_URL}/post`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Post upload failed.");
      }
      setCaption("");
      setMedia(null);
      setMediaType("image");
      Alert.alert("Posted", "Your post has been shared.");
      router.push("/(protected)/(tabs)");
    } catch (error) {
      Alert.alert("Upload failed", error instanceof Error ? error.message : "Could not upload post.");
    } finally {
      setUploading(false);
    }
  };

  if (isRecording) {
    return <VideoRecorder
      onVideoRecorded={(uri) => { setMedia(uri); setMediaType("video"); setIsRecording(false); setMode("upload"); }}
      onCancel={() => setIsRecording(false)}
    />;
  }

  return (
    <Animated.View
      className="flex-1 bg-[#101113]"
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        transform: [{ translateY: slideY }],
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#101113" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View className="flex-1">
          <View className="h-14 flex-row items-center justify-center px-5">
            <TouchableOpacity onPress={closeComposer} className="absolute left-5 w-9 h-9 rounded-full border border-white/15 items-center justify-center">
              <Ionicons name="close" size={22} color="#e5e7eb" />
            </TouchableOpacity>
            <View className="items-center">
              <Text className="text-white text-[15px] font-semibold">{mode === "generate" ? "Create video" : "Create post"}</Text>
              {mode === "generate" ? (
                <View className="flex-row items-center mt-0.5">
                  <Ionicons name="sparkles" size={11} color="#c4b5fd" />
                  <Text className="text-zinc-400 text-xs ml-1">Veo · 8 sec · 720p</Text>
                </View>
              ) : <Text className="text-zinc-400 text-xs">Photo or video post</Text>}
            </View>
            <TouchableOpacity onPress={() => setShowDrafts((visible) => !visible)} className="absolute right-5 px-2 py-2 flex-row items-center" accessibilityRole="button" accessibilityLabel="Toggle saved prompts">
              <Ionicons name="bookmark-outline" size={16} color="#d4d4d8" />
              <Text className="text-zinc-200 text-xs font-semibold ml-1">Drafts</Text>
            </TouchableOpacity>
          </View>

          {mode === "generate" ? (
            <>
              <View className="flex-1 px-5 justify-center">
                {generatedVideoUrl ? (
                  <Video
                    source={{ uri: generatedVideoUrl }}
                    style={{ width: "100%", height: "100%", maxHeight: 570, borderRadius: 22, backgroundColor: "#17181b" }}
                    resizeMode={ResizeMode.CONTAIN}
                    useNativeControls
                    isLooping
                    shouldPlay
                  />
                ) : isGenerating ? (
                  <View className="items-center justify-center px-8 py-12 rounded-[28px] bg-[#17151f] border border-violet-300/15">
                    <View className="w-16 h-16 rounded-2xl bg-violet-300/10 items-center justify-center mb-5">
                      <ActivityIndicator size="large" color="#d8c6ff" />
                    </View>
                    <Text className="text-white text-lg font-bold">Bringing your idea to life</Text>
                    <Text className="text-zinc-400 text-sm mt-2 text-center">This can take a few minutes. You can stay here while your video renders.</Text>
                    <Text className="text-violet-200 text-[10px] font-bold tracking-widest mt-5">{jobStatus.replaceAll("_", " ")}</Text>
                  </View>
                ) : (
                  <View className="px-7 py-10 rounded-[28px] bg-[#17151f] border border-violet-300/15 items-center">
                    <View className="w-16 h-16 rounded-2xl bg-violet-300/10 items-center justify-center mb-5">
                      <Ionicons name="sparkles" size={30} color="#d8c6ff" />
                    </View>
                    <Text className="text-white text-xl font-bold text-center">Start with an idea</Text>
                    <Text className="text-zinc-400 text-sm leading-5 text-center mt-2">Describe a moment, a mood, or a world. AI will turn your prompt into a vertical video.</Text>
                    {prompt.trim() ? <Text className="text-violet-100 text-sm leading-5 text-center mt-5 px-2" numberOfLines={4}>“{prompt.trim()}”</Text> : null}
                  </View>
                )}
              </View>

              {drafts.length > 0 && showDrafts ? (
                <View className="mx-4 mb-2 max-h-32 rounded-2xl bg-zinc-900 border border-zinc-800 p-2">
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {drafts.map((draft) => (
                      <View key={draft} className="flex-row items-center">
                        <TouchableOpacity onPress={() => { setPrompt(draft); setShowDrafts(false); }} className="flex-1 p-2">
                          <Text numberOfLines={1} className="text-zinc-200 text-sm">{draft}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => void deleteDraft(draft)} className="p-2"><Ionicons name="trash-outline" size={16} color="#a1a1aa" /></TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <View className="flex-row items-center px-4 pt-2 pb-2">
                <TouchableOpacity onPress={() => setMode("upload")} className="w-11 h-11 rounded-full bg-zinc-800 items-center justify-center mr-2">
                  <Ionicons name="image-outline" size={21} color="#f4f4f5" />
                </TouchableOpacity>
                <TextInput
                  className="flex-1 min-h-11 max-h-24 rounded-full bg-zinc-800 px-4 py-2.5 text-white text-[15px]"
                  placeholder="Describe your video..."
                  placeholderTextColor="#a1a1aa"
                  autoFocus
                  value={prompt}
                  onChangeText={setPrompt}
                  multiline
                  returnKeyType="default"
                  blurOnSubmit={false}
                />
                <TouchableOpacity onPress={() => void saveDraft()} className="w-9 h-10 items-center justify-center ml-1">
                  <Ionicons name="bookmark-outline" size={19} color="#a1a1aa" />
                </TouchableOpacity>
                <TouchableOpacity onPress={generateVideo} disabled={isGenerating || !prompt.trim()} className={`w-10 h-10 rounded-full items-center justify-center ml-1 ${prompt.trim() && !isGenerating ? "bg-white" : "bg-zinc-700"}`}>
                  {isGenerating ? <ActivityIndicator size="small" color="#111" /> : <Ionicons name="arrow-up" size={23} color={prompt.trim() ? "#111" : "#a1a1aa"} />}
                </TouchableOpacity>
              </View>
              <Text className="text-zinc-500 text-[10px] text-center pb-2">8 seconds · 720p · 9:16 vertical</Text>
            </>
          ) : (
            <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 18 }} keyboardShouldPersistTaps="handled">
              {media ? (
                <View>
                  {mediaType === "video" ? <Video source={{ uri: media }} style={{ width: "100%", aspectRatio: 9 / 16, borderRadius: 18, backgroundColor: "#18181b" }} resizeMode={ResizeMode.COVER} useNativeControls isLooping /> : <Image source={{ uri: media }} style={{ width: "100%", aspectRatio: 9 / 16, borderRadius: 18, backgroundColor: "#18181b" }} contentFit="cover" />}
                  <TouchableOpacity onPress={() => setMedia(null)} className="self-center mt-3 px-5 py-2 rounded-full bg-zinc-800"><Text className="text-white font-semibold">Remove media</Text></TouchableOpacity>
                  <TextInput className="text-white mt-4 p-4 bg-zinc-900 rounded-xl min-h-[90px]" placeholder="Write a caption..." placeholderTextColor="#71717a" multiline value={caption} onChangeText={setCaption} textAlignVertical="top" />
                  <TouchableOpacity onPress={shareUpload} disabled={uploading} className="mt-4 py-4 rounded-2xl bg-white items-center">{uploading ? <ActivityIndicator color="#000" /> : <Text className="text-black font-extrabold">Share post</Text>}</TouchableOpacity>
                </View>
              ) : (
                <View className="flex-1 justify-center">
                  <TouchableOpacity onPress={() => void pickMedia(false)} className="w-full aspect-[9/16] max-h-[560px] bg-zinc-900 rounded-2xl border border-dashed border-zinc-600 items-center justify-center">
                    <View className="w-16 h-16 rounded-full bg-zinc-800 items-center justify-center mb-4"><Ionicons name="images-outline" size={30} color="#fff" /></View>
                    <Text className="text-white text-lg font-bold">Import a photo or video</Text>
                    <Text className="text-zinc-400 text-sm mt-2">Choose from your library</Text>
                  </TouchableOpacity>
                  <View className="flex-row mt-4">
                    <TouchableOpacity onPress={() => void pickMedia(true)} className="flex-1 mr-2 py-4 rounded-xl bg-zinc-900 items-center"><Ionicons name="camera-outline" size={23} color="#fff" /><Text className="text-white font-semibold mt-1">Camera</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsRecording(true)} className="flex-1 ml-2 py-4 rounded-xl bg-zinc-900 items-center"><Ionicons name="videocam-outline" size={23} color="#fff" /><Text className="text-white font-semibold mt-1">Record video</Text></TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
