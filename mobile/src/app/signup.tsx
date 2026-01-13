import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export default function Signup() {
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const { signIn } = useAuth();
    const router = useRouter();

    const handleSignup = async () => {
        if (!name || !username || !email || !password) {
            setError('Please fill in all fields');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const response = await apiFetch('/auth/register', {
                method: 'POST',
                requiresAuth: false,
                body: JSON.stringify({ name, username, email, password }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Registration failed');
            }

            const data = await response.json();

            // Auto login after signup if token is present
            if (data.token && data.user) {
                await signIn(data.token, data.user);
                router.replace('/');
            } else {
                // Determine layout behavior if no token (shouldn't happen based on backend analysis)
                Alert.alert('Success', 'Account created! Please log in.');
                router.replace('/login');
            }

        } catch (err: any) {
            setError(err.message);
            Alert.alert('Signup Error', err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1 bg-white"
        >
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} className="px-8">
                <View className="items-center mb-10">
                    <Text className="text-3xl font-bold text-gray-900 mb-2">Create Account</Text>
                    <Text className="text-gray-500">Join our community today</Text>
                </View>

                <View className="space-y-4">
                    <View>
                        <Text className="text-gray-700 mb-1 font-medium">Name</Text>
                        <TextInput
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
                            placeholder="John Doe"
                            placeholderTextColor="#9CA3AF"
                            value={name}
                            onChangeText={setName}
                        />
                    </View>

                    <View>
                        <Text className="text-gray-700 mb-1 font-medium">Username</Text>
                        <TextInput
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
                            placeholder="johndoe"
                            placeholderTextColor="#9CA3AF"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />
                    </View>

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
                        onPress={handleSignup}
                        disabled={isSubmitting}
                        className={`w-full bg-blue-600 rounded-xl py-4 items-center mt-6 ${isSubmitting ? 'opacity-70' : ''}`}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-bold text-lg">Sign Up</Text>
                        )}
                    </TouchableOpacity>

                    <View className="flex-row justify-center mt-6">
                        <Text className="text-gray-500">Already have an account? </Text>
                        <TouchableOpacity onPress={() => router.back()}>
                            <Text className="text-blue-600 font-semibold">Sign In</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
