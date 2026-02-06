import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

interface VideoRecorderProps {
    onVideoRecorded: (uri: string) => void;
    onCancel: () => void;
}

export default function VideoRecorder({ onVideoRecorded, onCancel }: VideoRecorderProps) {
    const [facing, setFacing] = useState<'back' | 'front'>('back');
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const cameraRef = useRef<CameraView>(null);

    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRecording) {
            interval = setInterval(() => {
                setDuration(prev => {
                    if (prev >= 60) {
                        stopRecording();
                        return 60;
                    }
                    return prev + 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    useEffect(() => {
        (async () => {
            if (!cameraPermission?.granted) await requestCameraPermission();
            if (!microphonePermission?.granted) await requestMicrophonePermission();
        })();
    }, []);

    if (!cameraPermission || !microphonePermission) {
        return <View className="flex-1 bg-black justify-center items-center"><ActivityIndicator color="#fff" /></View>;
    }

    if (!cameraPermission.granted || !microphonePermission.granted) {
        return (
            <View className="flex-1 bg-black justify-center items-center p-4">
                <Text className="text-white text-center mb-4">We need camera and microphone permissions to record video.</Text>
                <TouchableOpacity onPress={async () => {
                    await requestCameraPermission();
                    await requestMicrophonePermission();
                }} className="bg-blue-500 px-6 py-3 rounded-full">
                    <Text className="text-white font-bold">Grant Permissions</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onCancel} className="mt-4">
                    <Text className="text-gray-400">Cancel</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const startRecording = async () => {
        if (cameraRef.current) {
            setIsRecording(true);
            setDuration(0);
            try {
                const video = await cameraRef.current.recordAsync({ maxDuration: 60 });
                if (video) {
                    onVideoRecorded(video.uri);
                }
            } catch (error) {
                console.error("Recording failed", error);
                Alert.alert("Error", "Failed to record video");
                setIsRecording(false);
            }
        }
    };

    const stopRecording = () => {
        if (cameraRef.current && isRecording) {
            cameraRef.current.stopRecording();
            setIsRecording(false);
        }
    };

    const toggleCameraFacing = () => {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    };

    const formatTime = (seconds: number) => {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    return (
        <View className="flex-1 bg-black relative">
            <CameraView
                style={StyleSheet.absoluteFill}
                facing={facing}
                mode="video"
                ref={cameraRef}
            />

            {/* Overlay UI */}
            <View className="flex-1 justify-between py-12 px-6">
                {/* Top Bar */}
                <View className="flex-row justify-between items-center">
                    <TouchableOpacity onPress={onCancel} className="bg-black/40 p-2 rounded-full">
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                    <View className="bg-red-500/80 px-3 py-1 rounded-full">
                        <Text className="text-white font-bold">{formatTime(duration)} / 1:00</Text>
                    </View>
                    <TouchableOpacity onPress={toggleCameraFacing} className="bg-black/40 p-2 rounded-full">
                        <Ionicons name="camera-reverse" size={28} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Bottom Control */}
                <View className="items-center">
                    <TouchableOpacity
                        onPress={isRecording ? stopRecording : startRecording}
                        className="items-center justify-center"
                    >
                        <View className={`w-20 h-20 rounded-full border-4 border-white items-center justify-center ${isRecording ? 'bg-red-500' : 'bg-transparent'}`}>
                            {isRecording && <View className="w-8 h-8 bg-white rounded-sm" />}
                            {!isRecording && <View className="w-16 h-16 bg-red-500 rounded-full border-2 border-transparent" />}
                        </View>
                    </TouchableOpacity>
                    <Text className="text-white mt-4 font-medium">{isRecording ? 'Tap to Stop' : 'Tap to Record'}</Text>
                </View>
            </View>
        </View>
    );
}
