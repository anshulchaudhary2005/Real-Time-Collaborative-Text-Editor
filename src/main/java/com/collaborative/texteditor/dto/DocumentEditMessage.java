package com.collaborative.texteditor.dto;

import lombok.Data;
import java.util.UUID;

@Data
public class DocumentEditMessage {
    private UUID documentId;
    private Long senderId;
    private String content;
}