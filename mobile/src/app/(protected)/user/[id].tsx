import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, FlatList, Modal, Pressable, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, API_URL } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";
import { CommentsModal } from "../../../components/CommentsModal";
import { PostItem } from "../../../components/PostItem";
import { VideoPlayground } from "../../../components/VideoPlayground";

type Author = { id: string; name?: string | null; username?: string; avatarUrl?: string | null };
type Post = {
  id: string;
  caption: string | null;
  media: string;
  type: "IMAGE" | "VIDEO";
  createdAt: string;
  aiDescription?: string | null;
  author: Author;
  _count?: { likes: number; comments: number };
  likes?: { id: string }[];
  isLiked?: boolean;
};
type Profile = {
  id: string;
  name: string | null;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  _count?: { posts: number; followers: number; following: number };
};

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const userId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { token } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedImagePost, setSelectedImagePost] = useState<Post | null>(null);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const videoPosts = useMemo(() => posts.filter((post) => post.type === "VIDEO"), [posts]);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    const response = await apiFetch(`/user/${userId}`);
    if (!response.ok) throw new Error("Could not fetch profile");
    const data = await response.json();
    setProfile(data.user);
    setIsFollowing(Boolean(data.isFollowing));
    setIsSelf(Boolean(data.isSelf));
  }, [userId]);

  const loadPosts = useCallback(async () => {
    if (!userId) return;
    const response = await apiFetch(`/post?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) throw new Error("Could not fetch posts");
    const data = await response.json();
    setPosts(data.posts || (Array.isArray(data) ? data : []));
  }, [userId]);

  const load = useCallback(async () => {
    try {
      await Promise.all([loadProfile(), loadPosts()]);
    } catch (error) {
      console.error("Profile load failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadProfile, loadPosts]);

  useEffect(() => { void load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
  };

  const toggleFollow = async () => {
    if (!userId || isSelf) return;
    const previous = isFollowing;
    setIsFollowing(!previous);
    setProfile((value) => value ? {
      ...value,
      _count: {
        posts: value._count?.posts || 0,
        followers: Math.max(0, (value._count?.followers || 0) + (previous ? -1 : 1)),
        following: value._count?.following || 0,
      },
    } : value);
    try {
      const response = await apiFetch(previous ? `/follows?followingId=${encodeURIComponent(userId)}` : "/follows", {
        method: previous ? "DELETE" : "POST",
        ...(previous ? {} : { body: JSON.stringify({ targetUserId: userId }) }),
      });
      if (!response.ok) throw new Error("Could not update follow");
    } catch (error) {
      setIsFollowing(previous);
      setProfile((value) => value ? {
        ...value,
        _count: {
          posts: value._count?.posts || 0,
          followers: Math.max(0, (value._count?.followers || 0) + (previous ? 1 : -1)),
          following: value._count?.following || 0,
        },
      } : value);
      Alert.alert("Follow update failed", "Please try again.");
      console.error(error);
    }
  };

  const likePost = async (postId: string) => {
    try {
      const response = await apiFetch(`/post/${postId}/like`, { method: "POST" });
      if (!response.ok) return;
      const { liked } = await response.json();
      setPosts((current) => current.map((post) => post.id === postId ? {
        ...post,
        isLiked: liked,
        likes: liked ? [{ id: "local" }] : [],
        _count: { likes: Math.max(0, (post._count?.likes || 0) + (liked ? 1 : -1)), comments: post._count?.comments || 0 },
      } : post));
    } catch (error) {
      console.error("Like failed:", error);
    }
  };

  const avatarUrl = profile?.avatarUrl
    ? (profile.avatarUrl.startsWith("http") ? profile.avatarUrl : `${API_URL.replace("/api", "")}${profile.avatarUrl}`)
    : null;

  const renderHeader = () => (
    <View>
      <View className="bg-[#101318] px-6 py-7 border-b border-zinc-800 items-center">
        {profile ? (
          <>
            <View className="w-24 h-24 rounded-full bg-zinc-800 mb-3 overflow-hidden border-2 border-zinc-600 items-center justify-center">
              {avatarUrl ? <Image source={{ uri: avatarUrl, headers: token ? { Authorization: `Bearer ${token}` } : undefined }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Text className="text-violet-300 text-3xl font-bold">{(profile.name?.[0] || profile.username[0] || "?").toUpperCase()}</Text>}
            </View>
            <Text className="text-zinc-100 text-xl font-bold">{profile.name || profile.username}</Text>
            <Text className="text-zinc-400 text-sm mt-1">@{profile.username}</Text>
            {profile.bio ? <Text className="text-zinc-300 text-center mt-3 px-4">{profile.bio}</Text> : null}
            <View className="flex-row justify-center mt-5 mb-2">
              <View className="items-center px-5"><Text className="text-white font-bold text-lg">{profile._count?.posts || 0}</Text><Text className="text-zinc-500 text-xs">Posts</Text></View>
              <View className="items-center px-5"><Text className="text-white font-bold text-lg">{profile._count?.followers || 0}</Text><Text className="text-zinc-500 text-xs">Followers</Text></View>
              <View className="items-center px-5"><Text className="text-white font-bold text-lg">{profile._count?.following || 0}</Text><Text className="text-zinc-500 text-xs">Following</Text></View>
            </View>
            {isSelf ? (
              <TouchableOpacity onPress={() => router.push("/(protected)/edit-profile")} className="mt-4 bg-zinc-900 border border-zinc-700 rounded-full px-8 py-3"><Text className="text-white font-bold">Edit profile</Text></TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => void toggleFollow()} className={`mt-4 rounded-full px-10 py-3 ${isFollowing ? "bg-zinc-800 border border-zinc-700" : "bg-violet-500"}`}><Text className="text-white font-bold">{isFollowing ? "Following" : "Follow"}</Text></TouchableOpacity>
            )}
          </>
        ) : <ActivityIndicator color="#a78bfa" />}
      </View>
      <View className="bg-black px-6 py-3 border-b border-zinc-800"><Text className="text-zinc-100 text-lg font-bold">Videos & posts</Text></View>
    </View>
  );

  const renderPost = ({ item }: { item: Post }) => {
    const uri = item.media.startsWith("http") ? item.media : `${API_URL.replace("/api", "")}${item.media}`;
    return (
      <TouchableOpacity activeOpacity={0.88} onPress={() => {
        if (item.type === "VIDEO") setSelectedVideoIndex(videoPosts.findIndex((video) => video.id === item.id));
        else setSelectedImagePost(item);
      }} style={{ width: `${100 / 3}%`, aspectRatio: 9 / 16, padding: 1 }}>
        {item.type === "VIDEO" ? (
          <View className="flex-1 bg-zinc-900">
            <Video source={{ uri, headers: token ? { Authorization: `Bearer ${token}` } : undefined }} style={{ width: "100%", height: "100%" }} resizeMode={ResizeMode.COVER} isMuted shouldPlay={false} onError={(error) => console.warn("Profile thumbnail video error:", error)} />
            <View className="absolute left-2 bottom-2 flex-row items-center"><Ionicons name="play" size={12} color="#fff" /><Text className="text-white text-[10px] font-bold ml-1">VIDEO</Text></View>
          </View>
        ) : <Image source={{ uri, headers: token ? { Authorization: `Bearer ${token}` } : undefined }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
      </TouchableOpacity>
    );
  };

  if (loading) return <View className="flex-1 items-center justify-center bg-[#090b10]"><ActivityIndicator size="large" color="#a78bfa" /></View>;

  return (
    <View className="flex-1 bg-[#090b10]">
      <View className="bg-[#101318] px-4 pt-12 pb-3 border-b border-zinc-800 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4"><Ionicons name="arrow-back" size={24} color="#f4f4f5" /></TouchableOpacity>
        <Text className="text-zinc-100 font-bold text-lg">{profile?.username || "Profile"}</Text>
      </View>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(post) => post.id}
        numColumns={3}
        ListHeaderComponent={renderHeader}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#a78bfa" />}
        columnWrapperStyle={{ width: "100%" }}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={<View className="p-8 items-center"><Text className="text-zinc-400 text-center">No posts yet.</Text></View>}
      />
      <Modal visible={Boolean(selectedImagePost)} animationType="slide" onRequestClose={() => setSelectedImagePost(null)}>
        <View className="flex-1 bg-black">
          <Pressable onPress={() => setSelectedImagePost(null)} className="absolute z-10 right-4 top-12 h-10 w-10 rounded-full bg-black/60 items-center justify-center"><Ionicons name="close" size={26} color="#fff" /></Pressable>
          {selectedImagePost ? <PostItem post={selectedImagePost as any} token={token} currentUserId={undefined} onLike={likePost} onComment={setCommentPostId} onUserPress={(authorId) => router.push(`/(protected)/user/${authorId}`)} /> : null}
        </View>
      </Modal>
      <VideoPlayground
        visible={selectedVideoIndex !== null}
        videos={videoPosts.map((post) => ({
          url: post.media.startsWith("http") ? post.media : `${API_URL.replace("/api", "")}${post.media}`,
          username: post.author.username || post.author.name || "Creator",
          caption: post.caption,
          creationLabel: post.aiDescription ? "AI-generated" : undefined,
          avatarUrl: post.author.avatarUrl ? (post.author.avatarUrl.startsWith("http") ? post.author.avatarUrl : `${API_URL.replace("/api", "")}${post.author.avatarUrl}`) : null,
          likesCount: post._count?.likes || 0,
          commentsCount: post._count?.comments || 0,
          isLiked: Boolean(post.isLiked || post.likes?.length),
        }))}
        initialIndex={selectedVideoIndex ?? 0}
        headers={token ? { Authorization: `Bearer ${token}` } : undefined}
        showBottomNavigation
        showHeaderControls={false}
        showFeedHeader
        onClose={() => setSelectedVideoIndex(null)}
        onLike={(index) => { const post = videoPosts[index]; if (post) void likePost(post.id); }}
        onComment={(index) => { const post = videoPosts[index]; if (post) setCommentPostId(post.id); }}
      />
      <CommentsModal visible={Boolean(commentPostId)} onClose={() => setCommentPostId(null)} postId={commentPostId || ""} onCommentAdded={() => void load()} />
    </View>
  );
}
