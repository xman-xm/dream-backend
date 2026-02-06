import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { useNetworkStatus } from '../context/NetworkContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export const NetworkStatusBanner: React.FC = () => {
    const { isConnected, isServerReachable, checkServerReachability } = useNetworkStatus();
    const insets = useSafeAreaInsets();
    const [isVisible, setIsVisible] = useState(false);

    // Determine the state to show
    const isOffline = isConnected === false;
    // Only show server unreachable if we are otherwise online
    const isServerDown = isConnected === true && isServerReachable === false;

    useEffect(() => {
        if (isOffline || isServerDown) {
            setIsVisible(true);
        } else {
            // Add a small delay before hiding to prevent flickering
            const timeout = setTimeout(() => setIsVisible(false), 500);
            return () => clearTimeout(timeout);
        }
    }, [isOffline, isServerDown]);

    if (!isVisible) return null;

    let backgroundColor = '#ef4444'; // Red for offline
    let message = 'No Internet Connection';
    let iconName: keyof typeof Ionicons.glyphMap = 'cloud-offline';

    if (isServerDown) {
        backgroundColor = '#f97316'; // Orange for server issues
        message = 'Server Unreachable';
        iconName = 'server-outline';
    }

    return (
        <View
            className="absolute left-0 right-0 z-50 flex-row items-center justify-between px-4 py-2"
            style={{
                backgroundColor,
                paddingTop: insets.top > 0 ? insets.top : 10,
                // Shadow for visibility
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5
            }}
        >
            <View className="flex-row items-center flex-1">
                <Ionicons name={iconName} size={20} color="white" />
                <Text className="text-white text-sm font-medium ml-2">{message}</Text>
            </View>

            {isServerDown && (
                <TouchableOpacity
                    onPress={() => checkServerReachability()}
                    className="bg-white/20 px-3 py-1 rounded-md"
                >
                    <Text className="text-white text-xs font-bold">Retry</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};
