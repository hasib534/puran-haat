import { useEffect, useState } from 'react';

import { useApp, type ChatMessage } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { isFirebaseConfigured, subscribeToMessages } from '../lib/firebase';

function formatMessageTime(createdAt: number): string {
  const date = new Date(createdAt);
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Subscribes to a conversation's message subcollection in Firebase mode.
 * In demo mode it returns the in-memory messages from the shared context.
 */
export function useConversationMessages(conversationId?: string): ChatMessage[] {
  const { conversations } = useApp();
  const { user } = useAuth();
  const conversation = conversations.find((entry) => entry.id === conversationId);
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured || !conversationId || !user || conversation?.pending) {
      return;
    }
    const uid = user.uid;
    return subscribeToMessages(
      conversationId,
      (rows) => {
        const messages = rows
          .map((row) => {
            const createdAt = Number(row.created_at || 0);
            return {
              id: row.id,
              sender: String(row.sender_id) === uid ? ('me' as const) : ('other' as const),
              text: String(row.text || ''),
              time: formatMessageTime(createdAt),
              createdAt,
            };
          })
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        setLiveMessages(messages);
      },
      (error) => console.warn('Messages listener failed:', error.message),
    );
  }, [conversationId, conversation?.pending, user]);

  if (!isFirebaseConfigured) {
    return conversation?.messages ?? [];
  }

  return liveMessages;
}
