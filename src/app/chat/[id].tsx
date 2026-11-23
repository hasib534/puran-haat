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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { showAlert, type AlertButton } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';
import { mapsUrl, type Coords } from '../../lib/geo';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { useConversationMessages } from '../../hooks/useConversationMessages';
import { useNow } from '../../hooks/useNow';
import { useTypingSignal } from '../../hooks/useTypingSignal';
import { isSeenByPeer, isTypingFresh, presenceLabel } from '../../lib/presence';
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
  const {
    items,
    conversations,
    sendMessage,
    markConversationRead,
    setTyping,
    presence,
    acceptTrade,
    declineTrade,
  } = useApp();
  const { user } = useAuth();
  const { guard } = useAuthGuard();
  const { location, coordsOf } = useLocation();

  const conv = conversations.find((entry) => entry.id === id || entry.itemId === id);
  const item = items.find((entry) => entry.id === conv?.itemId) || items.find((entry) => entry.id === id);
  const liveMessages = useConversationMessages(conv?.id);
  const messages = liveMessages.length > 0 ? liveMessages : conv?.messages ?? [];

  const tradeStatus = conv?.status || 'pending';
  const other = conv?.other || item?.user;

  const [inputText, setInputText] = useState('');
  // A coarse clock so "typing…" expires on its own and "last seen" stays fresh.
  const now = useNow(4000);

  useEffect(() => {
    if (!conv?.id) return;
    markConversationRead(conv.id).catch(() => {});
  }, [conv?.id, markConversationRead]);

  // --- Live typing heartbeat -----------------------------------------------
  // Publishes the caller's "typing" signal; clears itself on send or leave.
  const typingSignal = useTypingSignal(conv?.id, setTyping);

  const handleInputChange = (text: string) => {
    setInputText(text);
    typingSignal.onChange(text);
  };

  // The newest message we sent is the one that carries the read receipt.
  let lastOwnMessageId: string | null = null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].sender === 'me') {
      lastOwnMessageId = messages[i].id;
      break;
    }
  }


  const handleSend = async () => {
    if (!inputText.trim() || !conv) return;
    if (!guard('send messages')) return;
    const text = inputText;
    setInputText('');
    typingSignal.stop();
    try {
      await sendMessage(conv.id, text);
    } catch (error) {
      setInputText(text);
      showAlert('Message not sent', (error as Error).message);
    }
  };

  /** Sends a tappable maps link so the other trader can meet at a real spot. */
  const sendPlace = async (label: string, coords: Coords) => {
    if (!conv) return;
    const text = `📍 Meet here: ${label}\n${mapsUrl(coords)}`;
    try {
      await sendMessage(conv.id, text);
    } catch (error) {
      showAlert('Location not shared', (error as Error).message);
    }
  };

  const handleShareLocation = () => {
    if (!conv) return;
    if (!guard('share a location')) return;

    const itemCoords = coordsOf(item);
    const myCoords = location
      ? { latitude: location.latitude, longitude: location.longitude }
      : null;

    if (!itemCoords && !myCoords) {
      showAlert(
        'No area yet',
        'Set your area first, or open a listing that has a pickup pin, then share it here.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Choose area', onPress: () => router.push('/location') },
        ],
      );
      return;
    }

    const buttons: AlertButton[] = [{ text: 'Cancel', style: 'cancel' }];
    // Prefer the listing's pin: it is where the item actually is.
    if (itemCoords) {
      buttons.push({
        text: 'Listing pickup area',
        onPress: () => void sendPlace(item?.location_name || 'Pickup area', itemCoords),
      });
    }
    if (myCoords && location) {
      buttons.push({
        text: 'My area',
        onPress: () => void sendPlace(location.label, myCoords),
      });
    }

    showAlert('Share location', 'Send a maps pin for the meeting spot.', buttons);
  };

  const handleAcceptTrade = async () => {
    if (!conv) return;
    if (!guard('accept this trade', { requireVerified: true })) return;
    try {
      await acceptTrade(conv.id);
      showAlert(
        'Trade Accepted! 🎉',
        `You agreed to the barter swap with ${other?.full_name}. This trade now counts toward both of your Eco-Points.`,
      );
    } catch (error) {
      showAlert('Could not accept trade', (error as Error).message);
    }
  };

  const handleDeclineTrade = async () => {
    if (!conv) return;
    if (!guard('decline this trade', { requireVerified: true })) return;
    try {
      await declineTrade(conv.id);
    } catch (error) {
      showAlert('Could not decline trade', (error as Error).message);
    }
  };

  const openProposalItem = () => {
    const targetId = item?.id || conv?.itemId;
    if (!targetId) {
      showAlert('Listing unavailable', 'This listing is no longer on the Haat.');
      return;
    }
    router.push({ pathname: '/item/[id]', params: { id: targetId } } as never);
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

  const ratingLabel =
    other.rating > 0
      ? `${other.rating.toFixed(1)} (${other.trade_count} ${other.trade_count === 1 ? 'trade' : 'trades'})`
      : 'New trader';

  const peerPresence = presence[other.id];
  const peerTyping = isTypingFresh(conv.typingAt, now);
  // Typing wins over presence, which wins over the star rating fallback.
  const presenceSubtitle = presenceLabel(peerPresence, conv.typingAt, now);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={23} color={Colors.primary} />
        </TouchableOpacity>

        <View style={styles.headerTraderInfo}>
          <View style={styles.avatarWrap}>
            {other.avatar_url ? (
              <Image source={{ uri: other.avatar_url }} style={styles.traderAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.traderAvatar, styles.imageFallback]}>
                <MaterialIcons name="person" size={20} color={Colors.primary} />
              </View>
            )}
            {other.is_verified && (
              <View style={styles.verifiedBadge}>
                <MaterialIcons name="verified" size={10} color={Colors.onPrimary} />
              </View>
            )}
            {peerPresence?.online && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.traderName} numberOfLines={1}>{other.full_name}</Text>
            {presenceSubtitle ? (
              <Text
                style={[styles.presenceText, peerTyping && styles.presenceTyping]}
                numberOfLines={1}
              >
                {presenceSubtitle}
              </Text>
            ) : (
              <View style={styles.ratingRow}>
                <MaterialIcons name="star" size={12} color={Colors.star} />
                <Text style={styles.ratingText}>{ratingLabel}</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() =>
            showAlert('Conversation options', 'Report suspicious activity or block this trader.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Report trader',
                style: 'destructive',
                onPress: () => showAlert('Report sent', 'Our safety team will review this conversation.'),
              },
            ])
          }
          accessibilityLabel="Conversation options"
        >
          <MaterialIcons name="more-vert" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {user && !user.emailVerified ? <VerificationBanner /> : null}

      {/* Proposed trade context */}
      {conv.proposalId ? (
        <View style={[styles.tradeCard, Shadows.card]}>
          <View style={styles.tradeCardTop}>
            <Image
              source={{ uri: item?.images[0] || conv.itemImage }}
              style={styles.tradeThumb}
              contentFit="cover"
            />
            <View style={styles.tradeInfo}>
              <Text style={styles.tradeEyebrow}>Proposed Trade</Text>
              <Text style={styles.tradeTitle} numberOfLines={1}>
                {item?.title || conv.itemTitle || 'Barter item'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.viewDetailsButton}
              onPress={openProposalItem}
              accessibilityRole="button"
            >
              <Text style={styles.viewDetailsText}>View Details</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tradeStatusRow}>
            <Text style={styles.tradeStatusLabel}>Status</Text>
            <Text
              style={[
                styles.tradeStatusValue,
                tradeStatus === 'accepted'
                  ? styles.statusAccepted
                  : tradeStatus === 'declined'
                    ? styles.statusDeclined
                    : styles.statusPending,
              ]}
            >
              {tradeStatus === 'accepted'
                ? 'Accepted'
                : tradeStatus === 'declined'
                  ? 'Declined'
                  : 'Awaiting response'}
            </Text>
          </View>

          {tradeStatus === 'pending' && user?.uid === conv.receiverId && (
            <View style={styles.tradeActionRow}>
              <TouchableOpacity style={styles.declineButton} onPress={handleDeclineTrade}>
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.acceptButton} onPress={handleAcceptTrade}>
                <MaterialIcons name="handshake" size={17} color={Colors.onPrimary} />
                <Text style={styles.acceptButtonText}>Accept Swap</Text>
              </TouchableOpacity>
            </View>
          )}

          {tradeStatus === 'pending' && user?.uid === conv.proposerId && (
            <Text style={styles.waitingText}>
              Waiting for {other.full_name} to respond to your offer.
            </Text>
          )}

          {tradeStatus === 'declined' && user?.uid === conv.proposerId && (
            <Text style={styles.waitingText}>
              Declined. Send a new proposal from the listing to try again.
            </Text>
          )}
        </View>
      ) : null}

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          data={messages}
          keyExtractor={(msg) => msg.id}
          contentContainerStyle={styles.messagesList}
          ListHeaderComponent={
            messages.length > 0 ? (
              <View style={styles.dateDivider}>
                <View style={styles.dateLine} />
                <Text style={styles.dateText}>Today</Text>
                <View style={styles.dateLine} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <View style={styles.emptyIcon}>
                <MaterialIcons name="waving-hand" size={26} color={Colors.primary} />
              </View>
              <Text style={styles.emptyMessagesText}>
                No messages yet. Say hello and suggest a meetup spot.
              </Text>
            </View>
          }
          renderItem={({ item: msg }) => {
            const isMe = msg.sender === 'me';
            const seen = isMe && isSeenByPeer(conv.readWatermark, msg.createdAt);
            const isLastOwn = isMe && msg.id === lastOwnMessageId;
            return (
              <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
                {!isMe && (
                  <View style={styles.bubbleAvatarWrap}>
                    {other.avatar_url ? (
                      <Image source={{ uri: other.avatar_url }} style={styles.bubbleAvatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.bubbleAvatar, styles.imageFallback]}>
                        <MaterialIcons name="person" size={14} color={Colors.primary} />
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.bubbleColumn}>
                  <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                    <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>
                      {msg.text}
                    </Text>
                  </View>
                  <View style={[styles.metaRow, isMe ? styles.metaRowMe : styles.metaRowOther]}>
                    <Text style={styles.msgTime}>{msg.time}</Text>
                    {isMe && (
                      <MaterialIcons
                        name={seen ? 'done-all' : 'done'}
                        size={13}
                        color={seen ? Colors.primary : Colors.outline}
                        style={styles.readIcon}
                      />
                    )}
                    {isLastOwn && (
                      <Text style={[styles.receiptText, seen && styles.receiptTextSeen]}>
                        {seen ? 'Seen' : 'Sent'}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />

        {/* Composer */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() =>
              showAlert(
                'Attach Photo',
                'Photo attachments in chat are coming soon. For now, describe the item in a message.',
              )
            }
            accessibilityLabel="Attach a photo"
          >
            <MaterialIcons name="add-photo-alternate" size={21} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handleShareLocation}
            accessibilityLabel="Share a meeting location"
          >
            <MaterialIcons name="location-on" size={20} color={Colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={styles.inputField}
            value={inputText}
            onChangeText={handleInputChange}
            placeholder="Type a message..."
            placeholderTextColor="rgba(66, 73, 62, 0.55)"
            returnKeyType="send"
            onSubmitEditing={handleSend}
            accessibilityLabel="Message"
          />

          <TouchableOpacity
            style={[styles.sendButton, inputText.trim().length > 0 && styles.sendButtonActive]}
            onPress={handleSend}
            disabled={inputText.trim().length === 0}
            accessibilityLabel="Send message"
          >
            <MaterialIcons name="send" size={19} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  missingState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  missingTitle: { ...Typography.headlineSm, color: Colors.onSurface, marginTop: Spacing.md },
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTraderInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatarWrap: { position: 'relative' },
  traderAvatar: { width: 40, height: 40, borderRadius: BorderRadius.full },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondaryContainer,
  },
  verifiedBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  onlineDot: {
    position: 'absolute',
    top: -1,
    left: -1,
    width: 12,
    height: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryContainer,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  headerText: { flex: 1 },
  traderName: { ...Typography.labelLg, color: Colors.onSurface, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  ratingText: { ...Typography.bodySm, color: Colors.onSurfaceVariant, fontSize: 11 },
  presenceText: { ...Typography.bodySm, color: Colors.onSurfaceVariant, fontSize: 11, marginTop: 1 },
  presenceTyping: { color: Colors.primary, fontStyle: 'italic', fontWeight: '600' },
  tradeCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    marginHorizontal: Spacing.margin,
    marginTop: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.08)',
  },
  tradeCardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  tradeThumb: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceContainer,
  },
  tradeInfo: { flex: 1 },
  tradeEyebrow: {
    ...Typography.labelSm,
    color: Colors.tertiary,
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  tradeTitle: { ...Typography.labelMd, color: Colors.onSurface, fontWeight: '700', marginTop: 1 },
  viewDetailsButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  viewDetailsText: { ...Typography.labelSm, color: Colors.primary, fontWeight: '700', fontSize: 10 },
  tradeStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  tradeStatusLabel: { ...Typography.labelSm, color: Colors.outline, fontSize: 10 },
  tradeStatusValue: { ...Typography.labelSm, fontSize: 10, fontWeight: '700' },
  statusPending: { color: Colors.tertiary },
  statusAccepted: { color: Colors.primary },
  statusDeclined: { color: Colors.error },
  waitingText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    marginTop: 7,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: 'rgba(21, 66, 18, 0.06)',
  },
  tradeActionRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(21, 66, 18, 0.06)',
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
  declineButtonText: { ...Typography.labelSm, color: Colors.onSurfaceVariant, fontWeight: '600' },
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
  acceptButtonText: { ...Typography.labelSm, color: Colors.onPrimary, fontWeight: '700' },
  messagesList: {
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.sm,
    gap: 12,
  },
  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.xs,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: 'rgba(21, 66, 18, 0.09)' },
  dateText: { ...Typography.labelSm, color: Colors.outline, fontSize: 10 },
  emptyMessages: { paddingVertical: Spacing.xl, alignItems: 'center', gap: 8 },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMessagesText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 260,
  },
  msgRow: { flexDirection: 'row', gap: 7 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  bubbleAvatarWrap: { alignSelf: 'flex-end', marginBottom: 16 },
  bubbleAvatar: { width: 26, height: 26, borderRadius: BorderRadius.full },
  bubbleColumn: { maxWidth: '78%' },
  msgBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: BorderRadius.lg },
  msgBubbleMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  msgBubbleOther: {
    backgroundColor: Colors.surfaceContainerLow,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.05)',
  },
  msgText: { ...Typography.bodyMd, lineHeight: 20 },
  msgTextMe: { color: Colors.onPrimary },
  msgTextOther: { color: Colors.onSurface },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  metaRowMe: { justifyContent: 'flex-end' },
  metaRowOther: { justifyContent: 'flex-start' },
  msgTime: { fontSize: 9, color: Colors.outline },
  readIcon: { marginLeft: 1 },
  receiptText: { fontSize: 9, color: Colors.outline, marginLeft: 3 },
  receiptTextSeen: { color: Colors.primary, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(21, 66, 18, 0.06)',
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(21, 66, 18, 0.06)',
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
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: { backgroundColor: Colors.primary },
});
