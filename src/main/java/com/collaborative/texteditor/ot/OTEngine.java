package com.collaborative.texteditor.ot;

import java.util.ArrayList;
import java.util.List;


public class OTEngine {

    public static String apply(String document, Operation op) {
        if (document == null) {
            document = "";
        }
        if (op == null || op.getComponents() == null || op.getComponents().isEmpty()) {
            return document;
        }

        StringBuilder result = new StringBuilder();
        int docIndex = 0;
        int docLength = document.length();

        for (OpComponent c : op.getComponents()) {
            switch (c.getType()) {
                case RETAIN: {
                    int retainLen = c.getLength();
                    if (docIndex + retainLen > docLength) {
                        // Clamp to document boundary gracefully
                        retainLen = Math.max(0, docLength - docIndex);
                    }
                    if (retainLen > 0) {
                        result.append(document, docIndex, docIndex + retainLen);
                        docIndex += retainLen;
                    }
                    break;
                }
                case INSERT: {
                    if (c.getText() != null) {
                        result.append(c.getText());
                    }
                    break;
                }
                case DELETE: {
                    int deleteLen = c.getLength();
                    docIndex = Math.min(docLength, docIndex + deleteLen);
                    break;
                }
            }
        }
        if (docIndex < docLength) {
            result.append(document.substring(docIndex));
        }

        return result.toString();
    }

    public static Operation transform(Operation opA, Operation opB, boolean priorityA) {
        Operation prime = Operation.builder()
                .opId(opA.getOpId())
                .documentId(opA.getDocumentId())
                .authorId(opA.getAuthorId())
                .clientId(opA.getClientId())
                .baseRevision(opB.getRevision() > 0 ? opB.getRevision() : opA.getBaseRevision() + 1)
                .revision(0)
                .components(new ArrayList<>())
                .build();

        List<OpComponent> listA = copyComponents(opA.getComponents());
        List<OpComponent> listB = copyComponents(opB.getComponents());

        int idxA = 0;
        int idxB = 0;

        while (idxA < listA.size() || idxB < listB.size()) {
            OpComponent cA = idxA < listA.size() ? listA.get(idxA) : null;
            OpComponent cB = idxB < listB.size() ? listB.get(idxB) : null;

            if (cA != null && cA.getType() == OpType.INSERT) {
                if (cB != null && cB.getType() == OpType.INSERT) {
                    if (priorityA) {
                        // A inserts first
                        prime.insert(cA.getText());
                        idxA++;
                    } else {
                        prime.retain(cB.getText().length());
                        idxB++;
                    }
                } else {
                    prime.insert(cA.getText());
                    idxA++;
                }
                continue;
            }

            if (cB != null && cB.getType() == OpType.INSERT) {
                prime.retain(cB.getText().length());
                idxB++;
                continue;
            }

            if (cA == null) {
                idxB++;
                continue;
            }
            if (cB == null) {
                if (cA.getType() == OpType.RETAIN) {
                    prime.retain(cA.getLength());
                } else if (cA.getType() == OpType.DELETE) {
                    prime.delete(cA.getLength());
                }
                idxA++;
                continue;
            }

            int lenA = cA.getLength();
            int lenB = cB.getLength();
            int minLen = Math.min(lenA, lenB);

            if (cA.getType() == OpType.RETAIN && cB.getType() == OpType.RETAIN) {
                prime.retain(minLen);
            } else if (cA.getType() == OpType.RETAIN && cB.getType() == OpType.DELETE) {
                // cB deleted what cA wanted to retain
            } else if (cA.getType() == OpType.DELETE && cB.getType() == OpType.RETAIN) {
                prime.delete(minLen);
            } else if (cA.getType() == OpType.DELETE && cB.getType() == OpType.DELETE) {
                // Both deleted same range; dropped
            }

            if (lenA == minLen) {
                idxA++;
            } else {
                cA.setLength(lenA - minLen);
            }

            if (lenB == minLen) {
                idxB++;
            } else {
                cB.setLength(lenB - minLen);
            }
        }

        return prime.compact();
    }

  
    public static Operation compose(Operation op1, Operation op2) {
        Operation composed = Operation.builder()
                .opId(op1.getOpId())
                .documentId(op1.getDocumentId())
                .authorId(op1.getAuthorId())
                .clientId(op1.getClientId())
                .baseRevision(op1.getBaseRevision())
                .revision(op2.getRevision())
                .components(new ArrayList<>())
                .build();

        List<OpComponent> list1 = copyComponents(op1.getComponents());
        List<OpComponent> list2 = copyComponents(op2.getComponents());

        int idx1 = 0;
        int idx2 = 0;

        while (idx1 < list1.size() || idx2 < list2.size()) {
            OpComponent c1 = idx1 < list1.size() ? list1.get(idx1) : null;
            OpComponent c2 = idx2 < list2.size() ? list2.get(idx2) : null;

            if (c1 != null && c1.getType() == OpType.DELETE) {
                composed.delete(c1.getLength());
                idx1++;
                continue;
            }

            if (c2 != null && c2.getType() == OpType.INSERT) {
                composed.insert(c2.getText());
                idx2++;
                continue;
            }

            if (c1 == null) {
                if (c2 != null) {
                    if (c2.getType() == OpType.RETAIN) composed.retain(c2.getLength());
                    else if (c2.getType() == OpType.DELETE) composed.delete(c2.getLength());
                    idx2++;
                }
                continue;
            }

            if (c2 == null) {
                if (c1.getType() == OpType.RETAIN) composed.retain(c1.getLength());
                else if (c1.getType() == OpType.INSERT) composed.insert(c1.getText());
                idx1++;
                continue;
            }

            if (c1.getType() == OpType.RETAIN && c2.getType() == OpType.RETAIN) {
                int min = Math.min(c1.getLength(), c2.getLength());
                composed.retain(min);
                advance(list1, idx1, list2, idx2, min);
                if (c1.getLength() == 0) idx1++;
                if (c2.getLength() == 0) idx2++;
            } else if (c1.getType() == OpType.RETAIN && c2.getType() == OpType.DELETE) {
                int min = Math.min(c1.getLength(), c2.getLength());
                composed.delete(min);
                advance(list1, idx1, list2, idx2, min);
                if (c1.getLength() == 0) idx1++;
                if (c2.getLength() == 0) idx2++;
            } else if (c1.getType() == OpType.INSERT && c2.getType() == OpType.RETAIN) {
                int min = Math.min(c1.getText().length(), c2.getLength());
                composed.insert(c1.getText().substring(0, min));
                if (c1.getText().length() == min) {
                    idx1++;
                } else {
                    c1.setText(c1.getText().substring(min));
                    c1.setLength(c1.getText().length());
                }
                if (c2.getLength() == min) {
                    idx2++;
                } else {
                    c2.setLength(c2.getLength() - min);
                }
            } else if (c1.getType() == OpType.INSERT && c2.getType() == OpType.DELETE) {
                int min = Math.min(c1.getText().length(), c2.getLength());
                if (c1.getText().length() == min) {
                    idx1++;
                } else {
                    c1.setText(c1.getText().substring(min));
                    c1.setLength(c1.getText().length());
                }
                if (c2.getLength() == min) {
                    idx2++;
                } else {
                    c2.setLength(c2.getLength() - min);
                }
            }
        }

        return composed.compact();
    }

    private static void advance(List<OpComponent> l1, int i1, List<OpComponent> l2, int i2, int consumed) {
        l1.get(i1).setLength(l1.get(i1).getLength() - consumed);
        l2.get(i2).setLength(l2.get(i2).getLength() - consumed);
    }

    private static List<OpComponent> copyComponents(List<OpComponent> original) {
        List<OpComponent> copy = new ArrayList<>();
        if (original == null) return copy;
        for (OpComponent c : original) {
            copy.add(new OpComponent(c.getType(), c.getLength(), c.getText()));
        }
        return copy;
    }
}

