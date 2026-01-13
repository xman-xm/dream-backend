import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const { signIn } = useAuth();
    const router = useRouter();

    const handleLogin = async () => {
        if (!email || !password) {
            setError('Please enter both email and password');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const response = await apiFetch('/auth/mobile/login', {
                method: 'POST',
                requiresAuth: false,
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Login failed');
            }

            const data = await response.json();
            await signIn(data.token, data.user);
            router.replace('/');
        } catch (err: any) {
            setError(err.message);
            Alert.alert('Login Error', err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View className="flex-1 bg-white justify-center px-8">
            <View className="items-center mb-10">
                <Text className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</Text>
                <Text className="text-gray-500">Sign in to continue</Text>
            </View>

            <View className="space-y-4">
                <View>
                    <Text className="text-gray-700 mb-1 font-medium">Email</Text>
                    <TextInput
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
                        placeholder="you@example.com"
                        placeholderTextColor="#9CA3AF"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                </View>

                <View>
                    <Text className="text-gray-700 mb-1 font-medium">Password</Text>
                    <TextInput
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
                        placeholder="••••••••"
                        placeholderTextColor="#9CA3AF"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                {error ? (
                    <Text className="text-red-500 text-sm text-center mt-2">{error}</Text>
                ) : null}

                <TouchableOpacity
                    onPress={handleLogin}
                    disabled={isSubmitting}
                    className={`w-full bg-blue-600 rounded-xl py-4 items-center mt-6 ${isSubmitting ? 'opacity-70' : ''}`}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-bold text-lg">Sign In</Text>
                    )}
                </TouchableOpacity>
            </View>

            <View className="flex-row justify-center mt-6">
                <Text className="text-gray-500">Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/signup')}>
                    <Text className="text-blue-600 font-semibold">Sign Up</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
