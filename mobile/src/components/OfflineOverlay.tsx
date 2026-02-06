import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStatus } from '../context/NetworkContext';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const OfflineOverlay: React.FC = () => {
    const { isConnected, isServerReachable } = useNetworkStatus();
    const { isAuthenticated } = useAuth();
    const insets = useSafeAreaInsets();

    // Only show if logged in
    if (!isAuthenticated) return null;

    // Determine state
    const isOffline = isConnected === false;
    const isServerDown = isConnected === true && isServerReachable === false;

    // If everything is fine, show nothing
    if (!isOffline && !isServerDown) return null;

    // Unified State: Treat Server Down as "Connection Issue"
    const message = "No Internet Connection";
    const subMessage = "Please check your connection and try again.";

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Ionicons name="wifi" size={64} style={{ opacity: 0.3 }} color="#000" />
                    {/* Cut slash simulation */}
                    <View style={[styles.slash, { transform: [{ rotate: '45deg' }] }]} />
                </View>
                <Text style={styles.title}>{message}</Text>
                <Text style={styles.subtitle}>{subMessage}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 1)', // Solid white to replace content
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        padding: 20,
    },
    iconContainer: {
        marginBottom: 20,
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    slash: {
        position: 'absolute',
        width: '60%',
        height: 4,
        borderRadius: 2,
        backgroundColor: '#000',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    }
});
