package com.collaborative.texteditor.service;

import com.collaborative.texteditor.document.Document;
import com.collaborative.texteditor.document.User;
import com.collaborative.texteditor.ot.Operation;
import com.collaborative.texteditor.repository.DocumentRepository;
import com.collaborative.texteditor.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
public class CollaborationConcurrencyTest {

    @Autowired
    private CollaborationService collaborationService;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private UserRepository userRepository;

    private User testUser;
    private Document testDoc;

    @BeforeEach
    void setUp() {
        testUser = userRepository.findByUsername("concurrency_user")
                .orElseGet(() -> userRepository.save(User.builder()
                        .username("concurrency_user")
                        .password("pass")
                        .role("ROLE_USER")
                        .build()));

        testDoc = new Document();
        testDoc.setTitle("Concurrency Doc");
        testDoc.setOwner(testUser);
        testDoc.setContent("Base");
        testDoc.setCurrentRevision(0);
        testDoc = documentRepository.save(testDoc);
    }

    @Test
    @DisplayName("Idempotency: Re-submitting identical opId returns existing committed revision without duplicate apply")
    void testIdempotency() {
        Operation op1 = Operation.builder()
                .opId("idem-op-123")
                .documentId(testDoc.getId())
                .authorId(testUser.getId())
                .clientId("clientA")
                .baseRevision(0)
                .build()
                .retain(4)
                .insert(" Extended");

        Operation committed1 = collaborationService.applyAndCommitOperation(op1, testUser.getId(), testUser.getUsername());
        assertEquals(1, committed1.getRevision());

       
        Operation committed2 = collaborationService.applyAndCommitOperation(op1, testUser.getId(), testUser.getUsername());
        assertEquals(1, committed2.getRevision(), "Idempotent submission must yield the original revision");

        Document reloaded = documentRepository.findById(testDoc.getId()).orElseThrow();
        assertEquals(1, reloaded.getCurrentRevision());
        assertEquals("Base Extended", reloaded.getContent());
    }

    @Test
    @DisplayName("Catch-up recovery: Returns all intervening operations when client was offline")
    void testCatchupRecovery() {
      
        for (int i = 1; i <= 3; i++) {
            Document doc = documentRepository.findById(testDoc.getId()).orElseThrow();
            Operation op = Operation.builder()
                    .opId("seq-op-" + i)
                    .documentId(testDoc.getId())
                    .authorId(testUser.getId())
                    .clientId("client")
                    .baseRevision(doc.getCurrentRevision())
                    .build()
                    .retain(doc.getContent().length())
                    .insert("-" + i);

            collaborationService.applyAndCommitOperation(op, testUser.getId(), testUser.getUsername());
        }

        
        CollaborationService.CatchupResult catchup = collaborationService.catchup(testDoc.getId(), 0, testUser.getId());
        assertEquals(3, catchup.currentRevision());
        assertEquals(3, catchup.missingOperations().size());
        assertEquals(1, catchup.missingOperations().get(0).getRevision());
        assertEquals(2, catchup.missingOperations().get(1).getRevision());
        assertEquals(3, catchup.missingOperations().get(2).getRevision());
    }
}

