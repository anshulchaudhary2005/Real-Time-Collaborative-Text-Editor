package com.collaborative.texteditor.messaging;

import com.collaborative.texteditor.ot.Operation;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentBroadcastMessage {
    private String instanceId;
    private UUID documentId;
    private int revision;
    private Operation operation;
    private String fullContent;
    private Long senderId;
    private String senderUsername;
    private String type;
}

