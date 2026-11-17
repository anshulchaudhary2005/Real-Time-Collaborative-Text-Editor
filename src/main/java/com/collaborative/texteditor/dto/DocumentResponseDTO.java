package com.collaborative.texteditor.dto;

import com.collaborative.texteditor.document.Document;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class DocumentResponseDTO {
    private UUID id;
    private String title;
    private String ownerUsername;
    private int currentRevision;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String content;

    public DocumentResponseDTO(Document doc) {
        this.id = doc.getId();
        this.title = doc.getTitle();
        this.ownerUsername = doc.getOwner().getUsername();
        this.currentRevision = doc.getCurrentRevision();
        this.createdAt = doc.getCreatedAt();
        this.updatedAt = doc.getUpdatedAt();
        this.content = doc.getContent();
    }
}