package com.collaborative.texteditor.ot;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Random;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class OTEngineTest {

    private final UUID docId = UUID.randomUUID();

    @Test
    @DisplayName("Basic apply: Retain, Insert, Delete")
    void testBasicApply() {
        String base = "Hello World";
       
        Operation op = Operation.builder()
                .opId("op1")
                .documentId(docId)
                .build()
                .retain(6)
                .delete(5)
                .insert("Universe");

        String result = OTEngine.apply(base, op);
        assertEquals("Hello Universe", result);
    }

    @Test
    @DisplayName("Simultaneous insertions at the exact same location with deterministic tie-breaking")
    void testSimultaneousInsertions() {
        String base = "Hello World";

       
        Operation opA = Operation.builder()
                .opId("opA")
                .authorId(1L)
                .clientId("clientA")
                .documentId(docId)
                .baseRevision(1)
                .build()
                .retain(5)
                .insert(" Beautiful");

      
        Operation opB = Operation.builder()
                .opId("opB")
                .authorId(2L)
                .clientId("clientB")
                .documentId(docId)
                .baseRevision(1)
                .build()
                .retain(5)
                .insert(" Wonderful");

       
        Operation opAPrime = OTEngine.transform(opA, opB, true);
        Operation opBPrime = OTEngine.transform(opB, opA, false);

        String resultAFirst = OTEngine.apply(OTEngine.apply(base, opA), opBPrime);
        String resultBFirst = OTEngine.apply(OTEngine.apply(base, opB), opAPrime);

       
        assertEquals(resultAFirst, resultBFirst);
        assertEquals("Hello Beautiful Wonderful World", resultAFirst);
    }

    @Test
    @DisplayName("Overlapping deletions convergence")
    void testOverlappingDeletions() {
        String base = "The quick brown fox jumps";

       
        Operation opA = Operation.builder()
                .opId("opA")
                .documentId(docId)
                .build()
                .retain(4)
                .delete(12);

      
        Operation opB = Operation.builder()
                .opId("opB")
                .documentId(docId)
                .build()
                .retain(10)
                .delete(10);

        Operation opAPrime = OTEngine.transform(opA, opB, true);
        Operation opBPrime = OTEngine.transform(opB, opA, false);

        String docA = OTEngine.apply(OTEngine.apply(base, opA), opBPrime);
        String docB = OTEngine.apply(OTEngine.apply(base, opB), opAPrime);

        assertEquals(docA, docB);
        assertEquals("The jumps", docA);
    }

    @Test
    @DisplayName("Insert and Delete interactions")
    void testInsertDeleteInteraction() {
        String base = "abcdef";

      
        Operation opA = Operation.builder().opId("opA").documentId(docId).build()
                .retain(2).insert("XYZ").retain(4);

       
        Operation opB = Operation.builder().opId("opB").documentId(docId).build()
                .retain(2).delete(3).retain(1);

        Operation opAPrime = OTEngine.transform(opA, opB, true);
        Operation opBPrime = OTEngine.transform(opB, opA, false);

        String docA = OTEngine.apply(OTEngine.apply(base, opA), opBPrime);
        String docB = OTEngine.apply(OTEngine.apply(base, opB), opAPrime);

        assertEquals(docA, docB);
        assertEquals("abXYZf", docA);
    }

    @Test
    @DisplayName("Edits in separate independent regions")
    void testSeparateRegionEdits() {
        String base = "Prefix Middle Suffix";

       
        Operation opA = Operation.builder().opId("opA").documentId(docId).build()
                .delete(6).insert("Start");

       
        Operation opB = Operation.builder().opId("opB").documentId(docId).build()
                .retain(14).delete(6).insert("End");

        Operation opAPrime = OTEngine.transform(opA, opB, true);
        Operation opBPrime = OTEngine.transform(opB, opA, false);

        String docA = OTEngine.apply(OTEngine.apply(base, opA), opBPrime);
        String docB = OTEngine.apply(OTEngine.apply(base, opB), opAPrime);

        assertEquals(docA, docB);
        assertEquals("Start Middle End", docA);
    }

    @Test
    @DisplayName("Three-way concurrency: opA, opB, opC concurrently created on base")
    void testThreeWayConcurrency() {
        String base = "System Design";

        Operation opA = Operation.builder().opId("opA").documentId(docId).build()
                .insert("Distributed ");
        Operation opB = Operation.builder().opId("opB").documentId(docId).build()
                .retain(13).insert(" Architecture");
        Operation opC = Operation.builder().opId("opC").documentId(docId).build()
                .retain(7).delete(6).insert("Scale");

       
        Operation opBTransA = OTEngine.transform(opB, opA, false);
        Operation opCTransA = OTEngine.transform(opC, opA, false);
        Operation opCTransAB = OTEngine.transform(opCTransA, opBTransA, false);

        String state1 = OTEngine.apply(base, opA);
        String state2 = OTEngine.apply(state1, opBTransA);
        String finalState1 = OTEngine.apply(state2, opCTransAB);

      
        Operation opATransB = OTEngine.transform(opA, opB, true);
        Operation opCTransB = OTEngine.transform(opC, opB, false);
        Operation opCTransBA = OTEngine.transform(opCTransB, opATransB, false);

        String bState1 = OTEngine.apply(base, opB);
        String bState2 = OTEngine.apply(bState1, opATransB);
        String finalState2 = OTEngine.apply(bState2, opCTransBA);

        assertEquals(finalState1, finalState2);
    }

    @Test
    @DisplayName("Operation composition: apply(S, compose(op1, op2)) == apply(apply(S, op1), op2)")
    void testOperationComposition() {
        String base = "Hello World";

        Operation op1 = Operation.builder().opId("1").documentId(docId).build()
                .retain(6).delete(5).insert("Everyone");

        Operation op2 = Operation.builder().opId("2").documentId(docId).build()
                .insert("Greetings! ").retain(14);

        Operation composed = OTEngine.compose(op1, op2);

        String sequential = OTEngine.apply(OTEngine.apply(base, op1), op2);
        String composite = OTEngine.apply(base, composed);

        assertEquals(sequential, composite);
    }

    @Test
    @DisplayName("Randomized property-based convergence testing (100 random concurrent pairs)")
    void testRandomizedConvergence() {
        Random random = new Random(42);
        String[] alphabet = {"a", "b", "c", "d", "e", " ", "\n", "1", "2"};

        for (int trial = 0; trial < 100; trial++) {
            
            int docLen = 10 + random.nextInt(30);
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < docLen; i++) {
                sb.append(alphabet[random.nextInt(alphabet.length)]);
            }
            String baseDoc = sb.toString();

           
            int idxA = random.nextInt(Math.max(1, baseDoc.length()));
            int delA = random.nextInt(Math.max(1, baseDoc.length() - idxA));
            String insA = "INS_A_" + trial;
            Operation opA = Operation.fromDiff(baseDoc.length(), idxA, insA, delA, "opA" + trial, docId, 1L, "clientA", 0);

          
            int idxB = random.nextInt(Math.max(1, baseDoc.length()));
            int delB = random.nextInt(Math.max(1, baseDoc.length() - idxB));
            String insB = "INS_B_" + trial;
            Operation opB = Operation.fromDiff(baseDoc.length(), idxB, insB, delB, "opB" + trial, docId, 2L, "clientB", 0);

            Operation opAPrime = OTEngine.transform(opA, opB, true);
            Operation opBPrime = OTEngine.transform(opB, opA, false);

            String resultAB = OTEngine.apply(OTEngine.apply(baseDoc, opA), opBPrime);
            String resultBA = OTEngine.apply(OTEngine.apply(baseDoc, opB), opAPrime);

            assertEquals(resultAB, resultBA, "Convergence failed on trial " + trial + " with base: " + baseDoc);
        }
    }
}

