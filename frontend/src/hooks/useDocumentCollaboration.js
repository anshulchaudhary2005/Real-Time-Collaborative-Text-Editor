import { useState, useEffect, useCallback, useRef } from 'react';
import documentWebSocketService, { ConnectionState } from '../services/websocketService';
import { ClientOTHandler, OTEngine } from '../ot/OTEngine';

export function useDocumentCollaboration({
  documentId,
  currentUserId,
  username,
  initialRevision = 0,
  initialContent = '',
  onRemoteOperation,
  onRemoteContentSync
}) {
  const [connectionState, setConnectionState] = useState(ConnectionState.DISCONNECTED);
  const [currentRevision, setCurrentRevision] = useState(initialRevision);
  const [activities, setActivities] = useState([]);
  const [lastRemoteEdit, setLastRemoteEdit] = useState(null);
  const [activeCollaborators, setActiveCollaborators] = useState([]);
  const [presenceList, setPresenceList] = useState(new Map());
  const [syncStatus, setSyncStatus] = useState('SYNCED'); // 'SYNCED' | 'SENDING' | 'RECOVERING'

  const currentUserIdNum = Number(currentUserId);
  const clientIdRef = useRef(Math.random().toString(36).substring(2, 9));
  const currentContentRef = useRef(initialContent);
  const otHandlerRef = useRef(null);

  // Initialize OT Handler
  if (!otHandlerRef.current && documentId) {
    otHandlerRef.current = new ClientOTHandler({
      documentId,
      authorId: currentUserIdNum,
      clientId: clientIdRef.current,
      onSendOp: (op) => {
        setSyncStatus('SENDING');
        documentWebSocketService.sendOperation(documentId, op);
      },
      onApplyLocalDoc: (newDoc, op) => {
        currentContentRef.current = newDoc;
        if (onRemoteContentSync) onRemoteContentSync(newDoc);
        if (onRemoteOperation) onRemoteOperation(op);
      }
    });
    otHandlerRef.current.setServerRevision(initialRevision);
  }

  // Update content ref on changes
  const updateLocalContentRef = useCallback((text) => {
    currentContentRef.current = text;
  }, []);

  useEffect(() => {
    if (otHandlerRef.current) {
      otHandlerRef.current.setServerRevision(initialRevision);
    }
    setCurrentRevision(initialRevision);
  }, [initialRevision]);

  useEffect(() => {
    if (!documentId) return;

    // 1. Connection state
    const unsubState = documentWebSocketService.onStateChange((state) => {
      setConnectionState(state);
      if (state === ConnectionState.CONNECTED && otHandlerRef.current) {
        // Automatically request catch-up for any missed revisions during disconnection
        documentWebSocketService.requestCatchup(documentId, otHandlerRef.current.serverRevision);
      }
    });

    // 2. Activities
    const unsubActivity = documentWebSocketService.onActivity((_, all) => {
      setActivities([...all]);
    });
    setActivities(documentWebSocketService.getRecentActivities());

    // 3. Connect STOMP
    documentWebSocketService.connect();

    // 4. Document Message Callback (Committed operations broadcasted)
    const handleBroadcastMessage = (payload) => {
      const sender = Number(payload.senderId);
      const isSelf = (sender === currentUserIdNum) || (payload.operation?.clientId === clientIdRef.current);

      if (sender && !isSelf) {
        setActiveCollaborators((prev) => {
          if (!prev.includes(payload.senderUsername || `User #${sender}`)) {
            return [...prev, payload.senderUsername || `User #${sender}`];
          }
          return prev;
        });
      }

      if (payload.revision) {
        setCurrentRevision(payload.revision);
      }

      if (isSelf) {
        // Own edit broadcast echo; ACK handles confirmation
        return;
      }

      setLastRemoteEdit({
        sender: payload.senderUsername || `User #${sender}`,
        time: new Date().toLocaleTimeString(),
        revision: payload.revision
      });

      // Pass operation through client OT engine
      if (payload.operation && otHandlerRef.current) {
        otHandlerRef.current.handleRemoteOp(payload.operation, currentContentRef.current);
      } else if (payload.fullContent !== undefined && onRemoteContentSync) {
        currentContentRef.current = payload.fullContent;
        onRemoteContentSync(payload.fullContent);
      }
    };

    // 5. Server ACK callback
    const handleAck = (ackPayload) => {
      if (ackPayload.revision) {
        setCurrentRevision(ackPayload.revision);
      }
      if (otHandlerRef.current) {
        otHandlerRef.current.handleServerAck(ackPayload);
      }
      setSyncStatus('SYNCED');
    };

    // 6. Presence callback
    const handlePresence = (presence) => {
      if (presence.userId === currentUserIdNum) return;
      setPresenceList((prev) => {
        const next = new Map(prev);
        next.set(presence.userId, {
          username: presence.username || `User #${presence.userId}`,
          cursor: presence.cursorPosition,
          status: presence.status,
          updatedAt: Date.now()
        });
        return next;
      });
    };

    // 7. Sync catchup callback
    const unsubSync = documentWebSocketService.onSync((catchup) => {
      if (catchup.currentRevision) {
        setCurrentRevision(catchup.currentRevision);
        if (otHandlerRef.current) {
          otHandlerRef.current.setServerRevision(catchup.currentRevision);
        }
      }
      if (catchup.currentContent !== undefined && catchup.currentContent !== null) {
        currentContentRef.current = catchup.currentContent;
        if (onRemoteContentSync) onRemoteContentSync(catchup.currentContent);
      }
      setSyncStatus('SYNCED');
    });

    const unsubDoc = documentWebSocketService.subscribeToDocument(
      documentId,
      handleBroadcastMessage,
      handleAck,
      handlePresence
    );

    return () => {
      unsubDoc();
      unsubState();
      unsubActivity();
      unsubSync();
    };
  }, [documentId, currentUserIdNum, onRemoteContentSync, onRemoteOperation]);

  /**
   * Submit local edit through OT Engine
   */
  const submitLocalEdit = useCallback((newText) => {
    if (!otHandlerRef.current) return;
    const oldText = currentContentRef.current;
    currentContentRef.current = newText;
    otHandlerRef.current.handleLocalEdit(oldText, newText);
  }, []);

  /**
   * Broadcast cursor presence
   */
  const updateCursorPresence = useCallback((cursorPos) => {
    if (!documentId) return;
    documentWebSocketService.sendPresence(documentId, cursorPos, 'TYPING');
  }, [documentId]);

  const reconnect = useCallback(() => {
    documentWebSocketService.disconnect();
    setTimeout(() => {
      documentWebSocketService.connect();
    }, 400);
  }, []);

  return {
    connectionState,
    isConnected: connectionState === ConnectionState.CONNECTED,
    isConnecting: connectionState === ConnectionState.CONNECTING,
    isError: connectionState === ConnectionState.ERROR,
    currentRevision,
    syncStatus,
    submitLocalEdit,
    updateLocalContentRef,
    updateCursorPresence,
    reconnect,
    lastRemoteEdit,
    activeCollaborators,
    presenceList,
    activities
  };
}
