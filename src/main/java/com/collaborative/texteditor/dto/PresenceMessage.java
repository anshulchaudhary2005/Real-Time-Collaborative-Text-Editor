package com.collaborative.texteditor.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PresenceMessage {
    private UUID documentId;
    private Long userId;
    private String username;
    private int cursorPosition;
    private String status; 
}

