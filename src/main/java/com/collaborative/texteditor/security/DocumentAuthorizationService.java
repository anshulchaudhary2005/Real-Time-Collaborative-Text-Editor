package com.collaborative.texteditor.security;

import com.collaborative.texteditor.document.Document;
import com.collaborative.texteditor.document.DocumentMember;
import com.collaborative.texteditor.document.User;
import com.collaborative.texteditor.repository.DocumentMemberRepository;
import com.collaborative.texteditor.repository.DocumentRepository;
import com.collaborative.texteditor.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DocumentAuthorizationService {

    private final DocumentRepository documentRepository;
    private final DocumentMemberRepository memberRepository;
    private final UserRepository userRepository;

    public String getUserRole(UUID documentId, Long userId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + documentId));

        if (document.getOwner() != null && document.getOwner().getId().equals(userId)) {
            return "OWNER";
        }

        Optional<DocumentMember> member = memberRepository.findByDocumentIdAndUserId(documentId, userId);
        return member.map(DocumentMember::getRole).orElse(null);
    }

    public boolean canView(UUID documentId, Long userId) {
        String role = getUserRole(documentId, userId);
        return role != null && !"BLOCKED".equalsIgnoreCase(role);
    }

    public boolean canEdit(UUID documentId, Long userId) {
        String role = getUserRole(documentId, userId);
        return ("OWNER".equalsIgnoreCase(role) || "EDITOR".equalsIgnoreCase(role)) && !"BLOCKED".equalsIgnoreCase(role);
    }

    public boolean canManage(UUID documentId, Long userId) {
        String role = getUserRole(documentId, userId);
        return "OWNER".equalsIgnoreCase(role);
    }

    @Transactional
    public DocumentMember setMemberRole(UUID documentId, Long ownerUserId, Long targetUserId, String role) {
        if (!canManage(documentId, ownerUserId)) {
            throw new SecurityException("Only the document owner can manage members");
        }

        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("Target user not found"));

        DocumentMember member = memberRepository.findByDocumentIdAndUserId(documentId, targetUserId)
                .orElseGet(() -> DocumentMember.builder()
                        .document(document)
                        .user(targetUser)
                        .build());

        member.setRole(role.toUpperCase());
        return memberRepository.save(member);
    }

    @Transactional
    public void removeMember(UUID documentId, Long ownerUserId, Long targetUserId) {
        if (!canManage(documentId, ownerUserId)) {
            throw new SecurityException("Only the document owner can manage members");
        }
        memberRepository.deleteByDocumentIdAndUserId(documentId, targetUserId);
    }
}

