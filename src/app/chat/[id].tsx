import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { useConversationMessages } from '../../hooks/useConversationMessages';
import { AuthGate } from '../../components/auth/AuthGate';
import { VerificationBanner } from '../../components/auth/VerificationBanner';

export default function ChatScreen() {
  return (
    <AuthGate
      title="Sign in to view your chats"
      description="Sign in to message traders and negotiate your barter exchanges."
    >
      <ChatView />
    </AuthGate>
  );
}

function ChatView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, conversations, sendMessage, markConversationRead, acceptTrade, declineTrade } =
    useApp();
  const { user } = useAuth();
  const { guard } = useAuthGuard();

  const conv = conversations.find((entry) => entry.id === id || entry.itemId === id);
  const item = items.find((entry) => entry.id === conv?.itemId) || items.find((entry) => entry.id === id);
  const liveMessages = useConversationMessages(conv?.id);
  const messages = liveMessages.length > 0 ? liveMessages : conv?.messages ?? [];

  const tradeStatus = conv?.status || 'pending';
  const other = conv?.other || item?.user;

  const [inputText, setInputText] = useState('');

  useEffect(() => {
    if (!conv?.id) return;
    markConversationRead(conv.id).catch(() => {});
  }, [conv?.id, markConversationRead]);

  const handleSend = async () => {
    if (!inputText.trim() || !conv) return;
    if (!guard('send messages', { requireVerified: true })) return;
    const text = inputText;
    setInputText('');
    try {
      await sendMessage(conv.id, text);
    } catch (error) {
      setInputText(text);
      Alert.alert('Message not sent', (error as Error).message);
    }
  };

  const handleAcceptTrade = async () => {
    if (!conv) return;
    if (!guard('accept this trade', { requireVerified: true })) return;
    try {
      await acceptTrade(conv.id);
      Alert.alert(
        'Trade Accepted! 🎉',
        `You agreed to the barter swap with ${other?.full_name}! Both of you have earned +50 Eco-Points for keeping items circular.`,
      );
    } catch (error) {
      Alert.alert('Could not accept trade', (error as Error).message);
    }
  };

  const handleDeclineTrade = async () => {
    if (!conv) return;
    if (!guard('decline this trade')) return;
    try {
      await declineTrade(conv.id);
    } catch (error) {
      Alert.alert('Could not decline trade', (error as Error).message);
    }
  };

  if (!conv || !other) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.missingState}>
          <MaterialIcons name="chat-bubble-outline" size={52} color={Colors.outline} />
          <Text style={styles.missingTitle}>Conversation not found</Text>
          <Text style={styles.missingText}>
            Open a listing and tap the chat button to start a conversation.
          </Text>
          <TouchableOpacity style={styles.missingButton} onPress={() => router.back()}>
            <Text style={styles.missingButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>

        <View style={styles.headerTraderInfo}>
          <Image source={{ uri: other?.avatar_url }} style={styles.traderAvatar} contentFit="cover" />
          <View>
            <Text style={styles.traderName}>{other?.full_name}</Text>
            <Text style={styles.traderStatus}>Active now • Verified Trader</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.actionIcon}
          onPress={() => Alert.alert('Report / Safety', 'Report suspicious activity or block user.')}
        >
          <MaterialIcons name="more-vert" size={22} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      {user && !user.emailVerified ? <VerificationBanner /> : null}

      {/* Pinned Trade Proposal Card */}
      <View style={[styles.tradeBar, Shadows.card]}>
        <View style={styles.tradeBarTop}>
          <Image
            source={{ uri: item?.images[0] || conv.itemImage }}
            style={styles.tradeThumb}
            contentFit="cover"
          />
          <View style={styles.tradeBarInfo}>
            <Text style={styles.tradeBarTitle} numberOfLines={1}>
              {item?.title || conv.itemTitle || 'Barter item'}
            </Text>
            <Text style={styles.tradeBarMeta}>
              Status: <Text style={tradeStatus === 'accepted' ? styles.statusAccepted : styles.statusPending}>
                {tradeStatus === 'accepted' ? 'Accepted ✅' : 'Barter Proposal Pending'}
              </Text>
            </Text>
          </View>
        </View>

        {tradeStatus === 'pending' && (
          <View style={styles.tradeActionRow}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={handleDeclineTrade}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAcceptTrade}
            >
              <MaterialIcons name="handshake" size={18} color={Colors.onPrimary} />
              <Text style={styles.acceptButtonText}>Accept Swap</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Messages Feed */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          data={messages}
          keyExtractor={(msg) => msg.id}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Text style={styles.emptyMessagesText}>
                No messages yet. Say hello and suggest a meetup spot.
              </Text>
            </View>
          }
          renderItem={({ item: msg }) => {
            const isMe = msg.sender === 'me';
            return (
              <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
                <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                  <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>
                    {msg.text}
                  </Text>
                  <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeOther]}>
                    {msg.time}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => Alert.alert('Attach Photo', 'Share photo of condition or meeting point.')}
          >
            <MaterialIcons name="add-photo-alternate" size={22} color={Colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={styles.inputField}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
            placeholderTextColor={Colors.outline}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />

          <TouchableOpacity
            style={[styles.sendButton, inputText.trim().length > 0 && styles.sendButtonActive]}
            onPress={handleSend}
            disabled={inputText.trim().length === 0}
          >
            <MaterialIcons name="send" size={20} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  missingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  missingTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    marginTop: Spacing.md,
  },
  missingText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 6,
  },
  missingButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  missingButtonText: { ...Typography.labelLg, color: Colors.onPrimary },
  emptyMessages: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyMessagesText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 260,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(21, 66, 18, 0.05)',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(21, 66, 18, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTraderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  traderAvatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
  },
  traderName: {
    ...Typography.labelLg,
    color: Colors.onSurface,
  },
  traderStatus: {
    ...Typography.bodySm,
    color: Colors.primaryContainer,
    fontSize: 11,
  },
  actionIcon: {
    padding: 6,
  },
  tradeBar: {
    backgroundColor: Colors.surfaceContainerLowest,
    marginHorizontal: Spacing.margin,
    marginTop: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.08)',
  },
  tradeBarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tradeThumb: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceContainer,
  },
  tradeBarInfo: {
    flex: 1,
  },
  tradeBarTitle: {
    ...Typography.labelMd,
    color: Colors.onSurface,
  },
  tradeBarMeta: {
    ...Typography.bodySm,
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  statusPending: {
    color: Colors.tertiary,
    fontWeight: '700',
  },
  statusAccepted: {
    color: Colors.primary,
    fontWeight: '700',
  },
  tradeActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(21, 66, 18, 0.05)',
  },
  declineButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },
  acceptButton: {
    flex: 2,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  acceptButtonText: {
    ...Typography.labelSm,
    color: Colors.onPrimary,
  },
  messagesList: {
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.md,
    gap: 12,
  },
  msgRow: {
    flexDirection: 'row',
  },
  msgRowMe: {
    justifyContent: 'flex-end',
  },
  msgRowOther: {
    justifyContent: 'flex-start',
  },
  msgBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
  },
  msgBubbleMe: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 2,
  },
  msgBubbleOther: {
    backgroundColor: Colors.surfaceContainerLow,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.05)',
  },
  msgText: {
    ...Typography.bodyMd,
    lineHeight: 20,
  },
  msgTextMe: {
    color: Colors.onPrimary,
  },
  msgTextOther: {
    color: Colors.onSurface,
  },
  msgTime: {
    fontSize: 9,
    marginTop: 4,
  },
  msgTimeMe: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  msgTimeOther: {
    color: Colors.outline,
    textAlign: 'left',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(21, 66, 18, 0.05)',
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(21, 66, 18, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputField: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: Colors.primary,
  },
});
