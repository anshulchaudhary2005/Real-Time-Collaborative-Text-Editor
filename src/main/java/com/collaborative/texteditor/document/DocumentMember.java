package com.collaborative.texteditor.document;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        name = "document_members",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_doc_member", columnNames = {"document_id", "user_id"})
        }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentMember {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private Document document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String role;
}
