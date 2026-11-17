package com.collaborative.texteditor.document;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "document_operations",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_doc_revision", columnNames = {"document_id", "revision"}),
                @UniqueConstraint(name = "uk_doc_opid", columnNames = {"document_id", "op_id"})
        },
        indexes = {
                @Index(name = "idx_doc_revision", columnList = "document_id, revision")
        }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentOperation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(nullable = false)
    private int revision;

    @Column(name = "op_id", nullable = false)
    private String opId;

    @Column(name = "author_id", nullable = false)
    private Long authorId;

    @Column(name = "client_id")
    private String clientId;

    @Column(name = "base_revision", nullable = false)
    private int baseRevision;

    @Column(name = "operation_data", columnDefinition = "TEXT", nullable = false)
    private String operationData;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}

