import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface VideoPlaygroundItem {
  url: string;
  username?: string;
  caption?: string | null;
  avatarUrl?: string | null;
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
  creationLabel?: string;
}

export type VideoPlaygroundTab = "home" | "search" | "create" | "notifications" | "profile";

export interface VideoPlaygroundProps {
  /** Video URLs to play, in swipe order. */
  urls?: string[];
  /** Optional creator and engagement details for TikTok-style overlays. */
  videos?: VideoPlaygroundItem[];
  /** Controls the full-screen viewer. Defaults to true. */
  visible?: boolean;
  /** URL index to show first. */
  initialIndex?: number;
  /** Optional headers, useful for authenticated media endpoints. */
  headers?: Record<string, string>;
  /** Start videos muted. Defaults to false. */
  muted?: boolean;
  /** Loop each video. Defaults to true. */
  loop?: boolean;
  /** Called when the viewer is dismissed. */
  onClose?: () => void;
  /** Called when the active page changes. */
  onIndexChange?: (index: number) => void;
  /** Show the app-style bottom navigation inside the full-screen viewer. */
  showBottomNavigation?: boolean;
  /** Inset and round the video surface like a social feed card. */
  roundedVideoFrame?: boolean;
  /** Profile avatar used in the bottom navigation. */
  bottomAvatarUrl?: string | null;
  onLike?: (index: number) => void;
  onComment?: (index: number) => void;
  onShare?: (index: number) => void;
  onBottomTabPress?: (tab: VideoPlaygroundTab) => void;
  showHeaderControls?: boolean;
  showFeedHeader?: boolean;
}

type VideoPageProps = {
  uri: string;
  headers?: Record<string, string>;
  isActive: boolean;
  isMuted: boolean;
  loop: boolean;
  height: number;
  width: number;
  bottomOverlayOffset: number;
  item: VideoPlaygroundItem;
  index: number;
  onLike?: (index: number) => void;
  onComment?: (index: number) => void;
  onShare?: (index: number) => void;
  roundedFrame: boolean;
};

function VideoPage({ uri, headers, isActive, isMuted, loop, height, width, item, index, onLike, onComment, onShare, roundedFrame, bottomOverlayOffset }: VideoPageProps) {
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isActive) {
      setPaused(false);
      setFailed(false);
      setLoading(true);
    }
  }, [isActive, uri]);

  const handlePlaybackStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      return;
    }
    if (status.isPlaying) setLoading(false);
  }, []);

  return (
    <View style={{ width, height, backgroundColor: "#000", position: "relative" }}>
      <View renderToHardwareTextureAndroid style={{
        position: "absolute",
        left: roundedFrame ? 6 : 0,
        right: roundedFrame ? 6 : 0,
        top: 0,
        bottom: roundedFrame ? 8 : 0,
        borderRadius: roundedFrame ? 18 : 0,
        overflow: "hidden",
        backgroundColor: "#000",
        zIndex: 0,
        elevation: 0,
      }}>
        {!failed ? (
          <Video
            source={{ uri, headers }}
            style={{ width: "100%", height: "100%", zIndex: 0, elevation: 0 }}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isActive && !paused}
            isMuted={isMuted}
            isLooping={loop}
            useNativeControls={false}
            onLoadStart={() => setLoading(true)}
            onReadyForDisplay={() => setLoading(false)}
            onPlaybackStatusUpdate={handlePlaybackStatus}
            onError={() => {
              setFailed(true);
              setLoading(false);
            }}
          />
        ) : (
          <View className="flex-1 items-center justify-center px-10">
            <Ionicons name="warning-outline" size={34} color="#fff" />
            <Text className="text-white text-center mt-3">This video could not be loaded.</Text>
          </View>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={paused ? "Play video" : "Pause video"}
        onPress={() => {
          if (!failed && !loading) setPaused((value) => !value);
        }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 1, elevation: 2 }}
      >
        {loading && !failed ? (
          <View className="absolute inset-0 items-center justify-center bg-black/15">
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : null}
        {paused && !failed ? (
          <View className="absolute inset-0 items-center justify-center bg-black/15">
            <View className="w-16 h-16 rounded-full bg-black/45 items-center justify-center">
              <Ionicons name="play" size={32} color="#fff" />
            </View>
          </View>
        ) : null}
      </Pressable>

      <View
        renderToHardwareTextureAndroid
        pointerEvents="box-none"
        className="absolute left-5 right-[76px]"
        style={{ position: "absolute", left: 20, right: 76, bottom: bottomOverlayOffset, zIndex: 100, elevation: 100 }}
      >
        {item.username || item.avatarUrl ? (
          <View className="flex-row items-center mb-2">
            <View className="w-9 h-9 rounded-full bg-zinc-700 border border-white overflow-visible items-center justify-center mr-2">
              {item.avatarUrl ? <Image source={{ uri: item.avatarUrl, headers }} style={{ width: 34, height: 34, borderRadius: 17 }} contentFit="cover" /> : <Ionicons name="person" size={18} color="#fff" />}
              <View className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-sky-500 border border-black items-center justify-center"><Ionicons name="add" size={12} color="#fff" /></View>
            </View>
            <Text className="text-white text-sm font-bold">{item.username || "Creator"}</Text>
          </View>
        ) : null}
        {item.creationLabel ? (
          <View className="self-start flex-row items-center rounded-full bg-white/15 px-2.5 py-1 mb-2">
            <Ionicons name="sparkles" size={11} color="#e9d5ff" />
            <Text className="text-white text-[10px] font-semibold ml-1.5">{item.creationLabel}</Text>
          </View>
        ) : null}
        {item.caption ? <Text className="text-white text-sm leading-5" numberOfLines={3}>{item.caption}</Text> : null}
      </View>

      <View
        renderToHardwareTextureAndroid
        className={`absolute ${roundedFrame ? "right-[10px]" : "right-3"} items-center`}
        style={{ position: "absolute", right: roundedFrame ? 10 : 12, bottom: bottomOverlayOffset + 4, zIndex: 100, elevation: 100 }}
      >
        <Pressable onPress={() => onLike?.(index)} className="items-center mb-5">
          <Ionicons name={item.isLiked ? "heart" : "heart-outline"} size={29} color={item.isLiked ? "#ff3b67" : "#fff"} />
          <Text className="text-white text-[10px] mt-1">{item.likesCount ?? "Like"}</Text>
        </Pressable>
        <Pressable onPress={() => onComment?.(index)} className="items-center mb-5">
          <Ionicons name="chatbubble-outline" size={27} color="#fff" />
          <Text className="text-white text-[10px] mt-1">{item.commentsCount ?? "Comment"}</Text>
        </Pressable>
        {onShare ? <Pressable onPress={() => onShare(index)} className="items-center mb-5">
          <Ionicons name="paper-plane-outline" size={27} color="#fff" />
          <Text className="text-white text-[10px] mt-1">Share</Text>
        </Pressable> : null}
      </View>
    </View>
  );
}

/** Full-screen, vertically paged video viewer. Only the current page plays. */
export function VideoPlayground({
  urls = [],
  videos,
  visible = true,
  initialIndex = 0,
  headers,
  muted = false,
  loop = true,
  onClose,
  onIndexChange,
  showBottomNavigation = false,
  roundedVideoFrame = false,
  bottomAvatarUrl,
  onLike,
  onComment,
  onShare,
  onBottomTabPress,
  showHeaderControls = true,
  showFeedHeader = false,
}: VideoPlaygroundProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navHeight = showBottomNavigation ? 60 + insets.bottom : 0;
  // Keep the video edge-to-edge behind overlays and the bottom navigation.
  const pageHeight = height;
  const overlayBottom = showBottomNavigation ? navHeight + 18 : insets.bottom + 24;
  const listRef = useRef<FlatList<VideoPlaygroundItem>>(null);
  const items = videos
    ? videos.filter((item) => typeof item.url === "string" && item.url.trim().length > 0)
    : urls.filter((url) => typeof url === "string" && url.trim().length > 0).map((url) => ({ url }));
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, Math.min(initialIndex, items.length - 1)));

  useEffect(() => {
    if (!visible || items.length === 0) return;
    const nextIndex = Math.max(0, Math.min(initialIndex, items.length - 1));
    setActiveIndex(nextIndex);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: pageHeight * nextIndex, animated: false });
    });
  }, [visible, initialIndex, items.length, pageHeight]);

  const handleScrollEnd = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const nextIndex = Math.max(0, Math.min(items.length - 1, Math.round(event.nativeEvent.contentOffset.y / pageHeight)));
    setActiveIndex(nextIndex);
    onIndexChange?.(nextIndex);
  }, [items.length, onIndexChange, pageHeight]);

  const renderItem = useCallback(({ item, index }: { item: VideoPlaygroundItem; index: number }) => (
    <VideoPage
      uri={item.url}
      item={item}
      index={index}
      headers={headers}
      isActive={visible && index === activeIndex}
      isMuted={muted}
      loop={loop}
      width={width}
      height={pageHeight}
      bottomOverlayOffset={overlayBottom}
      onLike={onLike}
      onComment={onComment}
      onShare={onShare}
      roundedFrame={roundedVideoFrame}
    />
  ), [activeIndex, headers, pageHeight, loop, muted, visible, width, onLike, onComment, onShare, roundedVideoFrame, overlayBottom]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View className="flex-1 bg-black">
        {items.length > 0 ? (
          <FlatList
            ref={listRef}
            data={items}
            renderItem={renderItem}
            keyExtractor={(item, index) => `${index}:${item.url}`}
            pagingEnabled
            snapToInterval={pageHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            bounces={false}
            initialScrollIndex={Math.max(0, Math.min(initialIndex, items.length - 1))}
            getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
            onMomentumScrollEnd={handleScrollEnd}
            windowSize={3}
            maxToRenderPerBatch={2}
            initialNumToRender={1}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="videocam-off-outline" size={38} color="#fff" />
            <Text className="text-white mt-3">No videos to play.</Text>
          </View>
        )}

        {showHeaderControls ? (
          <View pointerEvents="box-none" className="absolute left-0 right-0 top-0 flex-row justify-between items-center px-5" style={{ paddingTop: insets.top + 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close video player"
              onPress={onClose}
              className="w-10 h-10 rounded-full bg-black/45 items-center justify-center"
            >
              <Ionicons name="close" size={25} color="#fff" />
            </Pressable>
            <View className="px-3 py-1 rounded-full bg-black/45">
              <Text className="text-white text-xs font-semibold">{items.length ? `${activeIndex + 1} / ${items.length}` : "0 / 0"}</Text>
            </View>
          </View>
        ) : null}

        {showFeedHeader ? (
          <View pointerEvents="box-none" className="absolute left-0 right-0 top-0 flex-row items-center justify-center" style={{ paddingTop: insets.top + 14 }}>
            <View className="flex-row items-center px-3 py-1 rounded-full bg-black/20">
              <Text className="text-white text-base font-bold">For You</Text>
              <Ionicons name="chevron-down" size={15} color="#fff" style={{ marginLeft: 4 }} />
            </View>
          </View>
        ) : null}

        {showBottomNavigation ? (
          <View className="absolute left-0 right-0 bottom-0 flex-row items-center justify-around" style={{ height: navHeight, paddingBottom: insets.bottom, backgroundColor: "rgba(0,0,0,0.58)" }}>
            <Pressable onPress={() => onBottomTabPress?.("home")} className="flex-1 items-center justify-center"><Ionicons name="home" size={23} color="#fff" /></Pressable>
            <Pressable onPress={() => onBottomTabPress?.("search")} className="flex-1 items-center justify-center"><Ionicons name="search-outline" size={24} color="#737373" /></Pressable>
            <Pressable onPress={() => onBottomTabPress?.("create")} className="flex-1 items-center justify-center"><View className="w-10 h-8 rounded-full bg-white items-center justify-center"><Ionicons name="add" size={24} color="#000" /></View></Pressable>
            <Pressable onPress={() => onBottomTabPress?.("notifications")} className="flex-1 items-center justify-center"><Ionicons name="notifications-outline" size={23} color="#737373" /></Pressable>
            <Pressable onPress={() => onBottomTabPress?.("profile")} className="flex-1 items-center justify-center">
              {bottomAvatarUrl ? <Image source={{ uri: bottomAvatarUrl, headers }} style={{ width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: "#777" }} contentFit="cover" /> : <Ionicons name="person-circle-outline" size={25} color="#737373" />}
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

export default VideoPlayground;
