package com.collaborative.texteditor.service;

import com.collaborative.texteditor.document.Document;
import com.collaborative.texteditor.document.User;
import com.collaborative.texteditor.ot.Operation;
import com.collaborative.texteditor.repository.DocumentRepository;
import com.collaborative.texteditor.repository.UserRepository;
import com.collaborative.texteditor.security.DocumentAuthorizationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class RBACSecurityTest {

    @Autowired
    private CollaborationService collaborationService;

    @Autowired
    private DocumentAuthorizationService authService;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private UserRepository userRepository;

    private User owner;
    private User editor;
    private User viewer;
    private Document testDoc;

    @BeforeEach
    void setUp() {
        owner = userRepository.findByUsername("sec_owner")
                .orElseGet(() -> userRepository.save(User.builder().username("sec_owner").password("p").role("ROLE_USER").build()));

        editor = userRepository.findByUsername("sec_editor")
                .orElseGet(() -> userRepository.save(User.builder().username("sec_editor").password("p").role("ROLE_USER").build()));

        viewer = userRepository.findByUsername("sec_viewer")
                .orElseGet(() -> userRepository.save(User.builder().username("sec_viewer").password("p").role("ROLE_USER").build()));

        testDoc = new Document();
        testDoc.setTitle("Security RBAC Doc");
        testDoc.setOwner(owner);
        testDoc.setContent("Secure State");
        testDoc.setCurrentRevision(0);
        testDoc = documentRepository.save(testDoc);

       
        authService.setMemberRole(testDoc.getId(), owner.getId(), editor.getId(), "EDITOR");
        authService.setMemberRole(testDoc.getId(), owner.getId(), viewer.getId(), "VIEWER");
    }

    @Test
    @DisplayName("RBAC: Owner can edit document")
    void testOwnerCanEdit() {
        Operation op = Operation.builder()
                .opId("op-owner-1")
                .documentId(testDoc.getId())
                .authorId(owner.getId())
                .clientId("c1")
                .baseRevision(0)
                .build()
                .insert("By Owner ");

        Operation committed = collaborationService.applyAndCommitOperation(op, owner.getId(), owner.getUsername());
        assertNotNull(committed);
        assertEquals(1, committed.getRevision());
    }

    @Test
    @DisplayName("RBAC: Editor can edit document")
    void testEditorCanEdit() {
        Operation op = Operation.builder()
                .opId("op-editor-1")
                .documentId(testDoc.getId())
                .authorId(editor.getId())
                .clientId("c2")
                .baseRevision(0)
                .build()
                .insert("By Editor ");

        Operation committed = collaborationService.applyAndCommitOperation(op, editor.getId(), editor.getUsername());
        assertNotNull(committed);
    }

    @Test
    @DisplayName("RBAC: Viewer CANNOT edit document -> throws SecurityException")
    void testViewerCannotEdit() {
        Operation op = Operation.builder()
                .opId("op-viewer-fail")
                .documentId(testDoc.getId())
                .authorId(viewer.getId())
                .clientId("c3")
                .baseRevision(0)
                .build()
                .insert("Malicious Edit");

        assertThrows(SecurityException.class, () -> {
            collaborationService.applyAndCommitOperation(op, viewer.getId(), viewer.getUsername());
        });
    }
}

