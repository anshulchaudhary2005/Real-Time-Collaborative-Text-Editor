package com.collaborative.texteditor.repository;

import com.collaborative.texteditor.document.DocumentOperation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentOperationRepository extends JpaRepository<DocumentOperation, UUID> {

    boolean existsByDocumentIdAndOpId(UUID documentId, String opId);

    Optional<DocumentOperation> findByDocumentIdAndOpId(UUID documentId, String opId);

    List<DocumentOperation> findByDocumentIdAndRevisionGreaterThanOrderByRevisionAsc(UUID documentId, int revision);

    Optional<DocumentOperation> findByDocumentIdAndRevision(UUID documentId, int revision);
}

