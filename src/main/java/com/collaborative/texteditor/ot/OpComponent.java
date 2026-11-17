package com.collaborative.texteditor.ot;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Objects;

@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OpComponent {
    private OpType type;
    private int length;      
    private String text;   

    @JsonCreator
    public OpComponent(
            @JsonProperty("type") OpType type,
            @JsonProperty("length") int length,
            @JsonProperty("text") String text) {
        this.type = type;
        this.length = length;
        this.text = text;
    }

    public static OpComponent retain(int length) {
        if (length <= 0) {
            throw new IllegalArgumentException("Retain length must be positive: " + length);
        }
        return new OpComponent(OpType.RETAIN, length, null);
    }

    public static OpComponent insert(String text) {
        if (text == null || text.isEmpty()) {
            throw new IllegalArgumentException("Insert text must be non-empty");
        }
        return new OpComponent(OpType.INSERT, text.length(), text);
    }

    public static OpComponent delete(int length) {
        if (length <= 0) {
            throw new IllegalArgumentException("Delete length must be positive: " + length);
        }
        return new OpComponent(OpType.DELETE, length, null);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        OpComponent that = (OpComponent) o;
        return length == that.length && type == that.type && Objects.equals(text, that.text);
    }

    @Override
    public int hashCode() {
        return Objects.hash(type, length, text);
    }

    @Override
    public String toString() {
        switch (type) {
            case RETAIN: return "Retain(" + length + ")";
            case INSERT: return "Insert(\"" + text + "\")";
            case DELETE: return "Delete(" + length + ")";
            default: return "OpComponent(" + type + ")";
        }
    }
}

