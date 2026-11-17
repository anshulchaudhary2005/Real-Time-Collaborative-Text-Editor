package com.collaborative.texteditor.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CatchupRequest {
    private UUID documentId;
    private int lastKnownRevision;
}

