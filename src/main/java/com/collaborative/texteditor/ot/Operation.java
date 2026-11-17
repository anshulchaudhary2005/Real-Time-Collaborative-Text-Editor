package com.collaborative.texteditor.ot;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Operation {
    private String opId;
    private UUID documentId;
    private Long authorId;
    private String clientId;
    private int baseRevision;
    private int revision;
    @Builder.Default
    private List<OpComponent> components = new ArrayList<>();

    public Operation addComponent(OpComponent component) {
        if (components == null) {
            components = new ArrayList<>();
        }
        components.add(component);
        return this;
    }

    public Operation retain(int length) {
        if (length > 0) {
            addComponent(OpComponent.retain(length));
        }
        return this;
    }

    public Operation insert(String text) {
        if (text != null && !text.isEmpty()) {
            addComponent(OpComponent.insert(text));
        }
        return this;
    }

    public Operation delete(int length) {
        if (length > 0) {
            addComponent(OpComponent.delete(length));
        }
        return this;
    }

    public Operation compact() {
        List<OpComponent> compacted = new ArrayList<>();
        for (OpComponent c : components) {
            if (c.getType() == OpType.INSERT && (c.getText() == null || c.getText().isEmpty())) {
                continue;
            }
            if ((c.getType() == OpType.RETAIN || c.getType() == OpType.DELETE) && c.getLength() <= 0) {
                continue;
            }

            if (compacted.isEmpty()) {
                compacted.add(new OpComponent(c.getType(), c.getLength(), c.getText()));
                continue;
            }

            OpComponent last = compacted.get(compacted.size() - 1);
            if (last.getType() == c.getType()) {
                if (c.getType() == OpType.RETAIN) {
                    last.setLength(last.getLength() + c.getLength());
                } else if (c.getType() == OpType.DELETE) {
                    last.setLength(last.getLength() + c.getLength());
                } else if (c.getType() == OpType.INSERT) {
                    last.setText(last.getText() + c.getText());
                    last.setLength(last.getText().length());
                }
            } else {
                compacted.add(new OpComponent(c.getType(), c.getLength(), c.getText()));
            }
        }
        this.components = compacted;
        return this;
    }

    public static Operation fromDiff(
            int docLength,
            int index,
            String textToInsert,
            int charsToDelete,
            String opId,
            UUID documentId,
            Long authorId,
            String clientId,
            int baseRevision) {

        Operation op = Operation.builder()
                .opId(opId != null ? opId : UUID.randomUUID().toString())
                .documentId(documentId)
                .authorId(authorId)
                .clientId(clientId)
                .baseRevision(baseRevision)
                .build();

        if (index > 0) {
            op.retain(Math.min(index, docLength));
        }

        if (textToInsert != null && !textToInsert.isEmpty()) {
            op.insert(textToInsert);
        }

        if (charsToDelete > 0) {
            op.delete(charsToDelete);
        }

        int remainder = docLength - (index + charsToDelete);
        if (remainder > 0) {
            op.retain(remainder);
        }

        return op.compact();
    }
}

