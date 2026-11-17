import { Client } from '@stomp/stompjs';

/**
 * Connection states for the STOMP WebSocket client
 */
export const ConnectionState = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  ERROR: 'ERROR'
};

const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';

class DocumentWebSocketService {
  constructor() {
    this.client = null;
    this.connectionState = ConnectionState.DISCONNECTED;
    this.stateListeners = new Set();
    this.messageListeners = new Map(); // documentId -> Set of callbacks
    this.ackListeners = new Map();     // documentId -> Set of callbacks
    this.presenceListeners = new Map();// documentId -> Set of callbacks
    this.syncListeners = new Set();
    this.errorListeners = new Set();
    this.activityListeners = new Set(); // logs for UI inspector
    this.activeSubscriptions = new Map(); // topic -> StompSubscription
    this.recentActivities = [];
  }

  onStateChange(callback) {
    this.stateListeners.add(callback);
    callback(this.connectionState);
    return () => this.stateListeners.delete(callback);
  }

  onActivity(callback) {
    this.activityListeners.add(callback);
    return () => this.activityListeners.delete(callback);
  }

  onSync(callback) {
    this.syncListeners.add(callback);
    return () => this.syncListeners.delete(callback);
  }

  onError(callback) {
    this.errorListeners.add(callback);
    return () => this.errorListeners.delete(callback);
  }

  getRecentActivities() {
    return this.recentActivities;
  }

  _logActivity(type, data) {
    const activity = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      ...data
    };
    this.recentActivities = [activity, ...this.recentActivities.slice(0, 49)];
    this.activityListeners.forEach((cb) => {
      try {
        cb(activity, this.recentActivities);
      } catch (err) {
        console.error('Error in activity listener:', err);
      }
    });
  }

  _setConnectionState(newState, errorInfo = null) {
    if (this.connectionState === newState) return;
    this.connectionState = newState;
    this.stateListeners.forEach((callback) => {
      try {
        callback(newState, errorInfo);
      } catch (err) {
        console.error('Error in state listener:', err);
      }
    });
  }

  /**
   * Initialize and connect STOMP client over WebSocket with auth credentials
   */
  connect(wsUrl = DEFAULT_WS_URL) {
    if (this.client && (this.connectionState === ConnectionState.CONNECTED || this.connectionState === ConnectionState.CONNECTING)) {
      return;
    }

    this._setConnectionState(ConnectionState.CONNECTING);
    this._logActivity('CONNECTING', { details: `Connecting to ${wsUrl}` });

    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('ownerId') || '1';
    const username = localStorage.getItem('ownerUsername') || 'developer_nishant';

    const connectHeaders = {};
    if (token) {
      connectHeaders['Authorization'] = `Bearer ${token}`;
    }
    connectHeaders['userId'] = String(userId);
    connectHeaders['username'] = username;

    this.client = new Client({
      brokerURL: wsUrl,
      connectHeaders,
      reconnectDelay: 4000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      onConnect: (frame) => {
        this._setConnectionState(ConnectionState.CONNECTED);
        this._logActivity('CONNECT', { details: 'Connected to STOMP Broker with Auth Context' });

        // Subscribe to private user queues
        this._subscribeToUserQueues();

        // Re-subscribe to any active documents on reconnect
        this.messageListeners.forEach((callbacks, documentId) => {
          this._subscribeToTopic(documentId);
        });
      },

      onDisconnect: () => {
        this._setConnectionState(ConnectionState.DISCONNECTED);
        this._logActivity('DISCONNECT', { details: 'Disconnected from STOMP broker' });
        this.activeSubscriptions.clear();
      },

      onStompError: (frame) => {
        const errorMsg = frame.headers['message'] || frame.body;
        console.error('Broker reported error:', errorMsg);
        this._setConnectionState(ConnectionState.ERROR, errorMsg);
        this._logActivity('ERROR', { title: 'STOMP Error', details: errorMsg });
      },

      onWebSocketClose: (event) => {
        this._setConnectionState(ConnectionState.DISCONNECTED);
        this._logActivity('WS_CLOSE', { code: event.code, reason: event.reason || 'Closed' });
      },

      onWebSocketError: (event) => {
        this._setConnectionState(ConnectionState.ERROR, 'WebSocket connection failure');
        this._logActivity('ERROR', { title: 'Transport Error', details: 'WebSocket failure' });
      }
    });

    this.client.activate();
  }

  _subscribeToUserQueues() {
    if (!this.client || !this.client.connected) return;

    // 1. Private ACKs
    this.client.subscribe('/user/queue/ack', (msg) => {
      try {
        const payload = JSON.parse(msg.body);
        this._handleAck(payload);
      } catch (e) {
        console.error('Failed to parse ACK payload', e);
      }
    });

    // 2. Private Sync/Catchup
    this.client.subscribe('/user/queue/sync', (msg) => {
      try {
        const payload = JSON.parse(msg.body);
        this.syncListeners.forEach((cb) => cb(payload));
      } catch (e) {
        console.error('Failed to parse sync payload', e);
      }
    });

    // 3. Private Errors (RBAC denial, validation failure)
    this.client.subscribe('/user/queue/errors', (msg) => {
      try {
        const payload = JSON.parse(msg.body);
        this._logActivity('SECURITY_ERROR', { title: payload.error, details: payload.message });
        this.errorListeners.forEach((cb) => cb(payload));
      } catch (e) {
        console.error('Failed to parse error payload', e);
      }
    });
  }

  _handleAck(payload) {
    this._logActivity('ACK_RECEIVED', {
      opId: payload.opId,
      revision: payload.revision,
      status: payload.status
    });
    const cbs = this.ackListeners.get(payload.documentId);
    if (cbs) {
      cbs.forEach((cb) => cb(payload));
    }
  }

  _subscribeToTopic(documentId) {
    if (!this.client || !this.client.connected) return;

    const topic = `/topic/documents/${documentId}`;
    if (!this.activeSubscriptions.has(topic)) {
      const sub = this.client.subscribe(topic, (message) => {
        try {
          const payload = JSON.parse(message.body);
          this._logActivity('BROADCAST_RECEIVED', {
            documentId,
            revision: payload.revision,
            sender: payload.senderUsername || payload.senderId,
            componentsCount: payload.operation?.components?.length || 0
          });

          const callbacks = this.messageListeners.get(documentId);
          if (callbacks) callbacks.forEach((cb) => cb(payload));
        } catch (err) {
          console.error('Failed to parse broadcast message:', err);
        }
      });
      this.activeSubscriptions.set(topic, sub);
    }

    // Subscribe to ACK topic for universal confirmation
    const ackTopic = `/topic/documents/${documentId}/ack`;
    if (!this.activeSubscriptions.has(ackTopic)) {
      const sub = this.client.subscribe(ackTopic, (message) => {
        try {
          const payload = JSON.parse(message.body);
          this._handleAck(payload);
        } catch (_) {}
      });
      this.activeSubscriptions.set(ackTopic, sub);
    }

    // Subscribe to presence topic
    const presenceTopic = `/topic/documents/${documentId}/presence`;
    if (!this.activeSubscriptions.has(presenceTopic)) {
      const sub = this.client.subscribe(presenceTopic, (message) => {
        try {
          const payload = JSON.parse(message.body);
          const cbs = this.presenceListeners.get(documentId);
          if (cbs) cbs.forEach((cb) => cb(payload));
        } catch (_) {}
      });
      this.activeSubscriptions.set(presenceTopic, sub);
    }
  }

  subscribeToDocument(documentId, onMessage, onAck, onPresence) {
    if (!this.messageListeners.has(documentId)) this.messageListeners.set(documentId, new Set());
    if (!this.ackListeners.has(documentId)) this.ackListeners.set(documentId, new Set());
    if (!this.presenceListeners.has(documentId)) this.presenceListeners.set(documentId, new Set());

    if (onMessage) this.messageListeners.get(documentId).add(onMessage);
    if (onAck) this.ackListeners.get(documentId).add(onAck);
    if (onPresence) this.presenceListeners.get(documentId).add(onPresence);

    if (this.client && this.client.connected) {
      this._subscribeToTopic(documentId);
    }

    return () => {
      if (onMessage) this.messageListeners.get(documentId)?.delete(onMessage);
      if (onAck) this.ackListeners.get(documentId)?.delete(onAck);
      if (onPresence) this.presenceListeners.get(documentId)?.delete(onPresence);
    };
  }

  /**
   * Sends an Operational Transformation operation to /app/edit/{documentId}
   */
  sendOperation(documentId, operation) {
    if (!this.client || !this.client.connected) {
      return false;
    }

    const payload = {
      opId: operation.opId,
      documentId,
      baseRevision: operation.baseRevision,
      clientId: operation.clientId,
      components: operation.components
    };

    try {
      this.client.publish({
        destination: `/app/edit/${documentId}`,
        body: JSON.stringify(payload)
      });

      this._logActivity('SEND_OP', {
        documentId,
        opId: operation.opId,
        baseRevision: operation.baseRevision,
        components: operation.components.length
      });
      return true;
    } catch (err) {
      console.error('Failed to send operation:', err);
      return false;
    }
  }

  /**
   * Request catch-up from server
   */
  requestCatchup(documentId, lastKnownRevision) {
    if (!this.client || !this.client.connected) return;

    this.client.publish({
      destination: `/app/sync/${documentId}`,
      body: JSON.stringify({ documentId, lastKnownRevision })
    });
    this._logActivity('REQUEST_SYNC', { documentId, lastKnownRevision });
  }

  /**
   * Send ephemeral cursor position
   */
  sendPresence(documentId, cursorPosition, status = 'TYPING') {
    if (!this.client || !this.client.connected) return;

    this.client.publish({
      destination: `/app/presence/${documentId}`,
      body: JSON.stringify({ cursorPosition, status })
    });
  }

  disconnect() {
    if (this.client) {
      this.client.deactivate();
      this.client = null;
      this._setConnectionState(ConnectionState.DISCONNECTED);
    }
  }

  isConnected() {
    return this.connectionState === ConnectionState.CONNECTED && this.client && this.client.connected;
  }
}

const documentWebSocketService = new DocumentWebSocketService();
export default documentWebSocketService;
