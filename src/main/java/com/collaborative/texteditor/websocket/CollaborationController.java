package com.collaborative.texteditor.websocket;

import com.collaborative.texteditor.document.Document;
import com.collaborative.texteditor.dto.AckMessage;
import com.collaborative.texteditor.dto.CatchupRequest;
import com.collaborative.texteditor.dto.OperationMessage;
import com.collaborative.texteditor.dto.PresenceMessage;
import com.collaborative.texteditor.ot.Operation;
import com.collaborative.texteditor.repository.DocumentRepository;
import com.collaborative.texteditor.security.UserPrincipal;
import com.collaborative.texteditor.service.CollaborationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Controller
@RequiredArgsConstructor
public class CollaborationController {

    private final CollaborationService collaborationService;
    private final DocumentRepository documentRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/edit/{documentId}")
    public void handleDocumentEdit(
            @DestinationVariable UUID documentId,
            @Payload OperationMessage message,
            Principal principal) {

        Long userId = extractUserId(principal);
        String username = principal != null ? principal.getName() : "user_" + userId;

        log.debug("Received edit for doc {} from user {} (baseRev: {})", documentId, username, message.getBaseRevision());

        Operation op;
        if (message.getComponents() != null && !message.getComponents().isEmpty()) {
            op = Operation.builder()
                    .opId(message.getOpId() != null ? message.getOpId() : UUID.randomUUID().toString())
                    .documentId(documentId)
                    .authorId(userId)
                    .clientId(message.getClientId())
                    .baseRevision(message.getBaseRevision())
                    .components(message.getComponents())
                    .build();
        } else if (message.getContent() != null) {
            Document doc = documentRepository.findById(documentId).orElse(null);
            String oldContent = (doc != null && doc.getContent() != null) ? doc.getContent() : "";
            op = Operation.fromDiff(
                    oldContent.length(),
                    0,
                    message.getContent(),
                    oldContent.length(),
                    message.getOpId(),
                    documentId,
                    userId,
                    message.getClientId(),
                    message.getBaseRevision()
            );
        } else {
            return;
        }

        try {
            Operation committed = collaborationService.applyAndCommitOperation(op, userId, username);

            AckMessage ack = AckMessage.builder()
                    .status("ACK")
                    .opId(committed.getOpId())
                    .revision(committed.getRevision())
                    .documentId(documentId)
                    .build();

            if (principal != null) {
                messagingTemplate.convertAndSendToUser(principal.getName(), "/queue/ack", ack);
            }
            messagingTemplate.convertAndSend("/topic/documents/" + documentId + "/ack", (Object) ack);

        } catch (SecurityException secEx) {
            log.warn("Unauthorized edit attempt on doc {}: {}", documentId, secEx.getMessage());
            Map<String, String> err = Map.of("error", "FORBIDDEN", "message", secEx.getMessage());
            if (principal != null) {
                messagingTemplate.convertAndSendToUser(principal.getName(), "/queue/errors", err);
            }
        } catch (Exception ex) {
            log.error("Failed to commit edit on doc {}: {}", documentId, ex.getMessage(), ex);
            Map<String, String> err = Map.of("error", "COMMIT_FAILED", "message", ex.getMessage());
            if (principal != null) {
                messagingTemplate.convertAndSendToUser(principal.getName(), "/queue/errors", err);
            }
        }
    }

    @MessageMapping("/sync/{documentId}")
    @SendToUser("/queue/sync")
    public CollaborationService.CatchupResult handleSync(
            @DestinationVariable UUID documentId,
            @Payload CatchupRequest request,
            Principal principal) {

        Long userId = extractUserId(principal);
        log.info("Client {} requested catchup for doc {} from revision {}", userId, documentId, request.getLastKnownRevision());
        return collaborationService.catchup(documentId, request.getLastKnownRevision(), userId);
    }


    @MessageMapping("/presence/{documentId}")
    public void handlePresence(
            @DestinationVariable UUID documentId,
            @Payload PresenceMessage presence,
            Principal principal) {

        Long userId = extractUserId(principal);
        presence.setDocumentId(documentId);
        presence.setUserId(userId);
        if (principal != null) {
            presence.setUsername(principal.getName());
        }

        messagingTemplate.convertAndSend("/topic/documents/" + documentId + "/presence", presence);
    }

    private Long extractUserId(Principal principal) {
        if (principal instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getUserId();
        }
        return 1L;
    }
}
