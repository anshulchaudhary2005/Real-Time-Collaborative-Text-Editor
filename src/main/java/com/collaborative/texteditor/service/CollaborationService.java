package com.collaborative.texteditor.service;

import com.collaborative.texteditor.document.Document;
import com.collaborative.texteditor.document.DocumentOperation;
import com.collaborative.texteditor.document.DocumentSnapshot;
import com.collaborative.texteditor.document.OutboxEvent;
import com.collaborative.texteditor.messaging.DocumentBroadcastMessage;
import com.collaborative.texteditor.messaging.RedisPublisher;
import com.collaborative.texteditor.observability.CollaborationMetrics;
import com.collaborative.texteditor.ot.OTEngine;
import com.collaborative.texteditor.ot.OpComponent;
import com.collaborative.texteditor.ot.Operation;
import com.collaborative.texteditor.repository.DocumentOperationRepository;
import com.collaborative.texteditor.repository.DocumentRepository;
import com.collaborative.texteditor.repository.DocumentSnapshotRepository;
import com.collaborative.texteditor.repository.OutboxEventRepository;
import com.collaborative.texteditor.security.DocumentAuthorizationService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CollaborationService {

    private final DocumentRepository documentRepository;
    private final DocumentOperationRepository operationRepository;
    private final DocumentSnapshotRepository snapshotRepository;
    private final OutboxEventRepository outboxRepository;
    private final DocumentAuthorizationService authService;
    private final RedisPublisher redisPublisher;
    private final CollaborationMetrics metrics;
    private final ObjectMapper objectMapper;

    private static final int SNAPSHOT_INTERVAL = 10;
    private static final int MAX_OPERATION_COMPONENTS = 500;
    private static final int MAX_INSERT_LENGTH = 50_000;

 
    @Transactional
    public Operation applyAndCommitOperation(Operation incomingOp, Long authenticatedUserId, String username) {
        metrics.incrementReceived();

        UUID docId = incomingOp.getDocumentId();

        if (!authService.canEdit(docId, authenticatedUserId)) {
            metrics.incrementRejected();
            throw new SecurityException("User " + authenticatedUserId + " does not have EDIT permission on document " + docId);
        }

        validateOperation(incomingOp);

        return metrics.getOperationProcessingTimer().record(() -> {
            try {
                Document doc = documentRepository.findByIdWithLock(docId)
                        .orElseThrow(() -> new IllegalArgumentException("Document not found: " + docId));

                
                if (operationRepository.existsByDocumentIdAndOpId(docId, incomingOp.getOpId())) {
                    DocumentOperation existing = operationRepository.findByDocumentIdAndOpId(docId, incomingOp.getOpId())
                            .orElseThrow();
                    log.info("Idempotent hit: opId {} already committed at revision {}", incomingOp.getOpId(), existing.getRevision());
                    List<OpComponent> comps = objectMapper.readValue(existing.getOperationData(), new TypeReference<>() {});
                    return Operation.builder()
                            .opId(existing.getOpId())
                            .documentId(docId)
                            .authorId(existing.getAuthorId())
                            .clientId(existing.getClientId())
                            .baseRevision(existing.getBaseRevision())
                            .revision(existing.getRevision())
                            .components(comps)
                            .build();
                }

                int currentRevision = doc.getCurrentRevision();
                int baseRevision = incomingOp.getBaseRevision();
                Operation opToApply = incomingOp;

                if (baseRevision < currentRevision) {
                    List<DocumentOperation> interveningOps = operationRepository
                            .findByDocumentIdAndRevisionGreaterThanOrderByRevisionAsc(docId, baseRevision);

                    for (DocumentOperation interveningEntity : interveningOps) {
                        List<OpComponent> interveningComps = objectMapper.readValue(
                                interveningEntity.getOperationData(), new TypeReference<>() {});
                        Operation interveningOp = Operation.builder()
                                .opId(interveningEntity.getOpId())
                                .documentId(docId)
                                .authorId(interveningEntity.getAuthorId())
                                .clientId(interveningEntity.getClientId())
                                .baseRevision(interveningEntity.getBaseRevision())
                                .revision(interveningEntity.getRevision())
                                .components(interveningComps)
                                .build();

                      
                        opToApply = OTEngine.transform(opToApply, interveningOp, false);
                        metrics.incrementTransformed();
                    }
                }

             
                int newRevision = currentRevision + 1;
                opToApply.setRevision(newRevision);
                opToApply.setAuthorId(authenticatedUserId);

              
                String updatedContent = OTEngine.apply(doc.getContent(), opToApply);
                doc.setContent(updatedContent);
                doc.setCurrentRevision(newRevision);
                documentRepository.save(doc);

                String opDataJson = objectMapper.writeValueAsString(opToApply.getComponents());
                DocumentOperation opEntity = DocumentOperation.builder()
                        .documentId(docId)
                        .revision(newRevision)
                        .opId(opToApply.getOpId())
                        .authorId(authenticatedUserId)
                        .clientId(opToApply.getClientId())
                        .baseRevision(baseRevision)
                        .operationData(opDataJson)
                        .build();
                operationRepository.save(opEntity);

                if (newRevision % SNAPSHOT_INTERVAL == 0) {
                    DocumentSnapshot snapshot = DocumentSnapshot.builder()
                            .documentId(docId)
                            .revision(newRevision)
                            .content(updatedContent)
                            .build();
                    snapshotRepository.save(snapshot);
                    log.debug("Saved periodic snapshot for doc {} at revision {}", docId, newRevision);
                }

                DocumentBroadcastMessage broadcast = DocumentBroadcastMessage.builder()
                        .documentId(docId)
                        .revision(newRevision)
                        .operation(opToApply)
                        .fullContent(updatedContent)
                        .senderId(authenticatedUserId)
                        .senderUsername(username)
                        .type("OPERATION")
                        .build();

                String broadcastJson = objectMapper.writeValueAsString(broadcast);
                OutboxEvent outbox = OutboxEvent.builder()
                        .aggregateId(docId)
                        .eventType("OPERATION_COMMITTED")
                        .payload(broadcastJson)
                        .build();
                outboxRepository.save(outbox);

                metrics.incrementCommitted();

                redisPublisher.publish(broadcast);

                return opToApply;
            } catch (Exception e) {
                log.error("Error processing operation for doc {}: {}", docId, e.getMessage(), e);
                throw new RuntimeException("Failed to commit operation: " + e.getMessage(), e);
            }
        });
    }


    @Transactional(readOnly = true)
    public CatchupResult catchup(UUID documentId, int lastKnownRevision, Long userId) {
        if (!authService.canView(documentId, userId)) {
            throw new SecurityException("User does not have access to document " + documentId);
        }

        Document doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));

        if (lastKnownRevision < 0) {
       
            return new CatchupResult(doc.getCurrentRevision(), doc.getContent(), List.of());
        }

        if (lastKnownRevision >= doc.getCurrentRevision()) {
            return new CatchupResult(doc.getCurrentRevision(), null, List.of());
        }

        metrics.incrementRevisionGap();

        List<DocumentOperation> opEntities = operationRepository
                .findByDocumentIdAndRevisionGreaterThanOrderByRevisionAsc(documentId, lastKnownRevision);

        List<Operation> missingOps = new ArrayList<>();
        for (DocumentOperation entity : opEntities) {
            try {
                List<OpComponent> comps = objectMapper.readValue(entity.getOperationData(), new TypeReference<>() {});
                missingOps.add(Operation.builder()
                        .opId(entity.getOpId())
                        .documentId(documentId)
                        .authorId(entity.getAuthorId())
                        .clientId(entity.getClientId())
                        .baseRevision(entity.getBaseRevision())
                        .revision(entity.getRevision())
                        .components(comps)
                        .build());
            } catch (Exception e) {
                log.error("Failed to parse operation {}: {}", entity.getId(), e.getMessage());
            }
        }

        return new CatchupResult(doc.getCurrentRevision(), doc.getContent(), missingOps);
    }

    private void validateOperation(Operation op) {
        if (op == null || op.getComponents() == null || op.getComponents().isEmpty()) {
            throw new IllegalArgumentException("Operation must contain components");
        }
        if (op.getComponents().size() > MAX_OPERATION_COMPONENTS) {
            throw new IllegalArgumentException("Operation exceeds max component limit (" + MAX_OPERATION_COMPONENTS + ")");
        }
        int totalInsert = 0;
        for (OpComponent c : op.getComponents()) {
            if (c.getText() != null) {
                totalInsert += c.getText().length();
            }
        }
        if (totalInsert > MAX_INSERT_LENGTH) {
            throw new IllegalArgumentException("Operation insert exceeds length limit (" + MAX_INSERT_LENGTH + ")");
        }
    }

    public record CatchupResult(int currentRevision, String currentContent, List<Operation> missingOperations) {}
}

