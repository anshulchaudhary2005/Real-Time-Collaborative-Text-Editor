package com.collaborative.texteditor.repository;

import com.collaborative.texteditor.document.DocumentSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface DocumentSnapshotRepository extends JpaRepository<DocumentSnapshot, UUID> {

    Optional<DocumentSnapshot> findTopByDocumentIdOrderByRevisionDesc(UUID documentId);

    Optional<DocumentSnapshot> findTopByDocumentIdAndRevisionLessThanEqualOrderByRevisionDesc(UUID documentId, int revision);
}

