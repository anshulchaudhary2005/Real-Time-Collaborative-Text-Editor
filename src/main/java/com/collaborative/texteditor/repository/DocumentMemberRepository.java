package com.collaborative.texteditor.repository;

import com.collaborative.texteditor.document.DocumentMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentMemberRepository extends JpaRepository<DocumentMember, Long> {

    List<DocumentMember> findByDocumentId(UUID documentId);

    Optional<DocumentMember> findByDocumentIdAndUserId(UUID documentId, Long userId);

    boolean existsByDocumentIdAndUserId(UUID documentId, Long userId);

    void deleteByDocumentIdAndUserId(UUID documentId, Long userId);
}

