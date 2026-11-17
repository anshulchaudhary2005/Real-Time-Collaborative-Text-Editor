package com.collaborative.texteditor.dto;

import com.collaborative.texteditor.ot.OpComponent;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OperationMessage {
    private String opId;
    private UUID documentId;
    private int baseRevision;
    private String clientId;
    private List<OpComponent> components;
    private String content;
}

