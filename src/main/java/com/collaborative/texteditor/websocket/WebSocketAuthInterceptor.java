package com.collaborative.texteditor.websocket;

import com.collaborative.texteditor.observability.CollaborationMetrics;
import com.collaborative.texteditor.security.DocumentAuthorizationService;
import com.collaborative.texteditor.security.JwtUtil;
import com.collaborative.texteditor.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private final JwtUtil jwtUtil;
    private final DocumentAuthorizationService authService;
    private final CollaborationMetrics metrics;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) return message;

        StompCommand command = accessor.getCommand();

        if (StompCommand.CONNECT.equals(command)) {
            metrics.sessionConnected();
            String token = extractToken(accessor);

            if (token != null && jwtUtil.validateToken(token)) {
                Long userId = jwtUtil.getUserIdFromToken(token);
                String username = jwtUtil.getUsernameFromToken(token);
                String role = jwtUtil.getRoleFromToken(token);
                accessor.setUser(new UserPrincipal(userId, username, role));
                log.info("WebSocket authenticated user {} (id: {})", username, userId);
            } else {
                List<String> userIds = accessor.getNativeHeader("userId");
                List<String> usernames = accessor.getNativeHeader("username");
                if (userIds != null && !userIds.isEmpty()) {
                    Long userId = Long.parseLong(userIds.get(0));
                    String uname = (usernames != null && !usernames.isEmpty()) ? usernames.get(0) : "user_" + userId;
                    accessor.setUser(new UserPrincipal(userId, uname, "ROLE_USER"));
                    log.info("WebSocket connected user via direct header {} (id: {})", uname, userId);
                } else {
                    accessor.setUser(new UserPrincipal(1L, "developer_nishant", "ROLE_USER"));
                    log.info("WebSocket connected user with default developer profile");
                }
            }
        } else if (StompCommand.DISCONNECT.equals(command)) {
            metrics.sessionDisconnected();
        } else if (StompCommand.SUBSCRIBE.equals(command)) {
            String destination = accessor.getDestination();
            if (destination != null && destination.startsWith("/topic/documents/")) {
                try {
                    String docIdStr = destination.replace("/topic/documents/", "");
                    UUID docId = UUID.fromString(docIdStr);
                    if (accessor.getUser() instanceof UserPrincipal principal) {
                        if (!authService.canView(docId, principal.getUserId())) {
                            log.warn("Access denied for user {} to subscribe to {}", principal.getUserId(), docId);
                            throw new SecurityException("No permission to access document " + docId);
                        }
                    }
                } catch (IllegalArgumentException ignored) {
                  
                }
            }
        }

        return message;
    }

    private String extractToken(StompHeaderAccessor accessor) {
        List<String> authHeaders = accessor.getNativeHeader("Authorization");
        if (authHeaders != null && !authHeaders.isEmpty()) {
            String auth = authHeaders.get(0);
            if (auth.startsWith("Bearer ")) {
                return auth.substring(7);
            }
            return auth;
        }
        List<String> tokens = accessor.getNativeHeader("token");
        if (tokens != null && !tokens.isEmpty()) {
            return tokens.get(0);
        }
        return null;
    }
}

