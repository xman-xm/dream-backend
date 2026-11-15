import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { apiFetch, API_URL } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";
import { CommentsModal } from "../../../components/CommentsModal";
import { PostItem } from "../../../components/PostItem";
import { OfflineWrapper } from "../../../components/OfflineWrapper";

type Person = {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  isFollowing: boolean;
};

type SearchPost = {
  id: string;
  caption: string | null;
  media: string;
  type: string;
  aiDescription: string | null;
  createdAt: string;
  author: Omit<Person, "isFollowing">;
  _count?: { likes: number; comments: number };
  likes?: { id: string }[];
  isLiked?: boolean;
};

type SearchData = { users: Person[]; posts: SearchPost[] };

export default function Search() {
  const router = useRouter();
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "people" | "videos">("all");
  const [results, setResults] = useState<SearchData>({ users: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [commentsVisible, setCommentsVisible] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults({ users: [], posts: [] });
      setLoading(false);
      return;
    }
    if (trimmed.length < 2) return;

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await apiFetch(`/search/smart?q=${encodeURIComponent(trimmed)}`);
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        if (!cancelled) setResults({ users: data.users || [], posts: data.posts || [] });
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const toggleFollow = async (person: Person) => {
    const nextFollowing = !person.isFollowing;
    setResults((current) => ({
      ...current,
      users: current.users.map((entry) => entry.id === person.id ? { ...entry, isFollowing: nextFollowing } : entry),
    }));
    try {
      const response = await apiFetch(person.isFollowing ? `/follows?followingId=${person.id}` : "/follows", {
        method: person.isFollowing ? "DELETE" : "POST",
        ...(person.isFollowing ? {} : { body: JSON.stringify({ targetUserId: person.id }) }),
      });
      if (!response.ok) throw new Error("Could not update follow");
    } catch (error) {
      setResults((current) => ({
        ...current,
        users: current.users.map((entry) => entry.id === person.id ? { ...entry, isFollowing: person.isFollowing } : entry),
      }));
      console.error(error);
    }
  };

  const toggleLike = async (postId: string) => {
    const response = await apiFetch(`/post/${postId}/like`, { method: "POST" });
    if (!response.ok) return;
    const { liked } = await response.json();
    setResults((current) => ({
      ...current,
      posts: current.posts.map((post) => post.id === postId ? {
        ...post,
        isLiked: liked,
        likes: liked ? [{ id: "local" }] : [],
        _count: { likes: Math.max(0, (post._count?.likes || 0) + (liked ? 1 : -1)), comments: post._count?.comments || 0 },
      } : post),
    }));
  };

  const renderPerson = (person: Person) => {
    const avatar = person.avatarUrl
      ? (person.avatarUrl.startsWith("http") ? person.avatarUrl : `${API_URL.replace("/api", "")}${person.avatarUrl}`)
      : null;
    return (
      <View key={person.id} className="flex-row items-center p-3 mb-2 rounded-2xl bg-[#151922] border border-zinc-800">
        <TouchableOpacity onPress={() => router.push(`/(protected)/user/${person.id}`)} className="flex-row items-center flex-1">
          <View className="w-12 h-12 rounded-full bg-zinc-800 overflow-hidden items-center justify-center mr-3">
            {avatar ? <Image source={{ uri: avatar, headers: token ? { Authorization: `Bearer ${token}` } : undefined }} style={{ width: 48, height: 48 }} contentFit="cover" /> : <Text className="text-violet-300 font-bold">{(person.name?.[0] || person.username[0] || "?").toUpperCase()}</Text>}
          </View>
          <View className="flex-1">
            <Text className="text-zinc-100 font-bold">{person.name || person.username}</Text>
            <Text className="text-zinc-400 text-sm">@{person.username}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void toggleFollow(person)} className={`px-4 py-2 rounded-full ${person.isFollowing ? "bg-zinc-800" : "bg-violet-500"}`}>
          <Text className="text-white text-xs font-bold">{person.isFollowing ? "Following" : "Follow"}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const visiblePeople = activeTab !== "videos";
  const visiblePosts = activeTab !== "people";

  return (
    <OfflineWrapper onRetry={() => setQuery((value) => `${value} `)}>
      <View className="flex-1 bg-[#090b10] pt-12">
        <View className="px-4 pb-3 bg-[#101318]">
          <Text className="text-2xl font-bold text-zinc-100 mb-4">Discover</Text>
          <View className="flex-row items-center bg-[#1a1f29] rounded-2xl px-4 py-3 border border-zinc-800">
            <Ionicons name="search" size={18} color="#8b91a1" />
            <TextInput
              className="flex-1 font-medium text-zinc-100 text-base ml-2"
              placeholder="Search usernames or video prompts..."
              placeholderTextColor="#777f90"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 ? <TouchableOpacity onPress={() => setQuery("")}><Ionicons name="close-circle" size={20} color="#777f90" /></TouchableOpacity> : null}
          </View>
        </View>

        <View className="flex-row px-4 py-3 border-b border-zinc-800 bg-[#101318]">
          {(["all", "people", "videos"] as const).map((tab) => (
            <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} className={`mr-6 pb-1 ${activeTab === tab ? "border-b-2 border-violet-400" : ""}`}>
              <Text className={`capitalize font-semibold ${activeTab === tab ? "text-violet-300" : "text-zinc-500"}`}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? <View className="p-8"><ActivityIndicator size="large" color="#a78bfa" /></View> : (
          <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
            {visiblePeople && results.users.length > 0 ? (
              <View className="mb-5">
                <Text className="text-zinc-500 font-bold uppercase text-xs tracking-wider mb-3">People</Text>
                {results.users.map(renderPerson)}
              </View>
            ) : null}
            {visiblePosts && results.posts.length > 0 ? (
              <View>
                <Text className="text-zinc-500 font-bold uppercase text-xs tracking-wider mb-3">Videos & posts</Text>
                {results.posts.map((post) => (
                  <View key={post.id} className="mb-4">
                    <PostItem
                      post={post as any}
                      token={token}
                      onLike={toggleLike}
                      onComment={(postId) => { setSelectedPostId(postId); setCommentsVisible(true); }}
                      onUserPress={(userId) => router.push(`/(protected)/user/${userId}`)}
                    />
                  </View>
                ))}
              </View>
            ) : null}
            {query.trim().length >= 2 && !results.users.length && !results.posts.length && !loading ? (
              <View className="items-center justify-center py-16">
                <View className="w-14 h-14 rounded-2xl bg-[#151922] items-center justify-center mb-3"><Ionicons name="search-outline" size={24} color="#777f90" /></View>
                <Text className="text-zinc-400 text-center">No matches for “{query.trim()}”</Text>
                <Text className="text-zinc-600 text-center text-sm mt-2">Try a username, caption, or prompt phrase.</Text>
              </View>
            ) : null}
            {!query.trim() ? <Text className="text-zinc-500 text-center mt-8">Search people and video prompts.</Text> : null}
          </ScrollView>
        )}
        <CommentsModal visible={commentsVisible} onClose={() => setCommentsVisible(false)} postId={selectedPostId || ""} />
      </View>
    </OfflineWrapper>
  );
}
