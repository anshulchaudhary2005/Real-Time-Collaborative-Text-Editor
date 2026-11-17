package com.collaborative.texteditor.controller;

import com.collaborative.texteditor.document.Document;
import com.collaborative.texteditor.document.DocumentMember;
import com.collaborative.texteditor.document.User;
import com.collaborative.texteditor.dto.DocumentResponseDTO;
import com.collaborative.texteditor.repository.DocumentMemberRepository;
import com.collaborative.texteditor.repository.UserRepository;
import com.collaborative.texteditor.security.DocumentAuthorizationService;
import com.collaborative.texteditor.service.CollaborationService;
import com.collaborative.texteditor.service.DocumentService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;
    private final CollaborationService collaborationService;
    private final DocumentAuthorizationService authService;
    private final DocumentMemberRepository memberRepository;
    private final UserRepository userRepository;

    @PostMapping
    public ResponseEntity<DocumentResponseDTO> createDocument(@RequestParam String title, @RequestParam Long ownerId) {
        Document doc = documentService.createDocument(title, ownerId);
        return ResponseEntity.ok(new DocumentResponseDTO(doc));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DocumentResponseDTO> getDocument(@PathVariable UUID id) {
        Document doc = documentService.getDocument(id);
        return ResponseEntity.ok(new DocumentResponseDTO(doc));
    }

    @GetMapping
    public ResponseEntity<List<DocumentResponseDTO>> getAllDocuments() {
        List<DocumentResponseDTO> dtos = documentService.getAllDocuments().stream()
                .map(DocumentResponseDTO::new)
                .toList();
        return ResponseEntity.ok(dtos);
    }

    @PutMapping("/{id}")
    public ResponseEntity<DocumentResponseDTO> updateDocument(@PathVariable UUID id, @RequestBody String content) {
        Document doc = documentService.updateDocumentContent(id, content);
        return ResponseEntity.ok(new DocumentResponseDTO(doc));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocument(@PathVariable UUID id) {
        documentService.deleteDocument(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/sync")
    public ResponseEntity<CollaborationService.CatchupResult> syncDocument(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int sinceRevision,
            @RequestParam(defaultValue = "1") Long userId) {
        CollaborationService.CatchupResult result = collaborationService.catchup(id, sinceRevision, userId);
        return ResponseEntity.ok(result);
    }

   
    @PostMapping("/{id}/members")
    public ResponseEntity<?> setMemberRole(
            @PathVariable UUID id,
            @RequestParam Long ownerId,
            @RequestBody MemberRoleRequest request) {
        Long targetUserId = request.getUserId();
        if (targetUserId == null && request.getUsername() != null) {
            User found = userRepository.findByUsername(request.getUsername())
                    .orElseThrow(() -> new IllegalArgumentException("User not found: " + request.getUsername()));
            targetUserId = found.getId();
        }
        if (targetUserId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Must provide userId or username"));
        }

        DocumentMember member = authService.setMemberRole(id, ownerId, targetUserId, request.getRole());
        return ResponseEntity.ok(Map.of(
                "documentId", id,
                "userId", member.getUser().getId(),
                "username", member.getUser().getUsername(),
                "role", member.getRole()
        ));
    }

    @DeleteMapping("/{id}/members/{targetUserId}")
    public ResponseEntity<?> removeMember(
            @PathVariable UUID id,
            @RequestParam Long ownerId,
            @PathVariable Long targetUserId) {
        authService.removeMember(id, ownerId, targetUserId);
        return ResponseEntity.ok(Map.of("message", "Member access removed successfully"));
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<Map<String, Object>>> getMembers(@PathVariable UUID id) {
        Document doc = documentService.getDocument(id);
        List<Map<String, Object>> members = new java.util.ArrayList<>();

        if (doc.getOwner() != null) {
            members.add(Map.of(
                    "userId", doc.getOwner().getId(),
                    "username", doc.getOwner().getUsername(),
                    "role", "OWNER"
            ));
        }

        for (DocumentMember m : memberRepository.findByDocumentId(id)) {
            members.add(Map.of(
                    "userId", m.getUser().getId(),
                    "username", m.getUser().getUsername(),
                    "role", m.getRole()
            ));
        }

        return ResponseEntity.ok(members);
    }

    @Data
    public static class MemberRoleRequest {
        private Long userId;
        private String username;
        private String role;
    }
}
