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
public class AckMessage {
    private String status;
    private String opId;
    private int revision;
    private UUID documentId;
}

