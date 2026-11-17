/**
 * Operational Transformation Engine (Client-Side)
 * Supports Retain, Insert, Delete, Transform, Compose, and Client State Machine.
 */

export const OpType = {
  RETAIN: 'RETAIN',
  INSERT: 'INSERT',
  DELETE: 'DELETE'
};

export class OTEngine {
  /**
   * Applies an operation to a document string.
   */
  static apply(document = '', operation) {
    if (!operation || !operation.components || operation.components.length === 0) {
      return document;
    }

    let result = '';
    let docIndex = 0;
    const docLength = document.length;

    for (const c of operation.components) {
      if (c.type === OpType.RETAIN) {
        const retainLen = Math.min(c.length, Math.max(0, docLength - docIndex));
        if (retainLen > 0) {
          result += document.substring(docIndex, docIndex + retainLen);
          docIndex += retainLen;
        }
      } else if (c.type === OpType.INSERT) {
        if (c.text) {
          result += c.text;
        }
      } else if (c.type === OpType.DELETE) {
        docIndex = Math.min(docLength, docIndex + c.length);
      }
    }

    if (docIndex < docLength) {
      result += document.substring(docIndex);
    }

    return result;
  }

  /**
   * Transforms opA against opB so opA' can be applied after opB.
   */
  static transform(opA, opB, priorityA = false) {
    const prime = {
      opId: opA.opId,
      documentId: opA.documentId,
      authorId: opA.authorId,
      clientId: opA.clientId,
      baseRevision: (opB.revision > 0 ? opB.revision : opA.baseRevision + 1),
      revision: 0,
      components: []
    };

    const listA = opA.components ? opA.components.map(c => ({ ...c })) : [];
    const listB = opB.components ? opB.components.map(c => ({ ...c })) : [];

    let idxA = 0;
    let idxB = 0;

    const pushComp = (type, length, text) => {
      if (type === OpType.RETAIN || type === OpType.DELETE) {
        if (length <= 0) return;
      }
      if (type === OpType.INSERT) {
        if (!text || text.length === 0) return;
        length = text.length;
      }
      const last = prime.components[prime.components.length - 1];
      if (last && last.type === type) {
        if (type === OpType.INSERT) {
          last.text += text;
          last.length += text.length;
        } else {
          last.length += length;
        }
      } else {
        prime.components.push({ type, length, text: text || null });
      }
    };

    while (idxA < listA.size || idxA < listA.length || idxB < listB.length) {
      const cA = idxA < listA.length ? listA[idxA] : null;
      const cB = idxB < listB.length ? listB[idxB] : null;

      if (cA && cA.type === OpType.INSERT) {
        if (cB && cB.type === OpType.INSERT) {
          if (priorityA) {
            pushComp(OpType.INSERT, cA.text.length, cA.text);
            idxA++;
          } else {
            pushComp(OpType.RETAIN, cB.text.length, null);
            idxB++;
          }
        } else {
          pushComp(OpType.INSERT, cA.text.length, cA.text);
          idxA++;
        }
        continue;
      }

      if (cB && cB.type === OpType.INSERT) {
        pushComp(OpType.RETAIN, cB.text.length, null);
        idxB++;
        continue;
      }

      if (!cA) {
        idxB++;
        continue;
      }
      if (!cB) {
        if (cA.type === OpType.RETAIN) pushComp(OpType.RETAIN, cA.length, null);
        else if (cA.type === OpType.DELETE) pushComp(OpType.DELETE, cA.length, null);
        idxA++;
        continue;
      }

      const minLen = Math.min(cA.length, cB.length);
      if (cA.type === OpType.RETAIN && cB.type === OpType.RETAIN) {
        pushComp(OpType.RETAIN, minLen, null);
      } else if (cA.type === OpType.DELETE && cB.type === OpType.RETAIN) {
        pushComp(OpType.DELETE, minLen, null);
      }

      if (cA.length === minLen) idxA++;
      else cA.length -= minLen;

      if (cB.length === minLen) idxB++;
      else cB.length -= minLen;
    }

    return prime;
  }

  /**
   * Composes two consecutive operations into one.
   */
  static compose(op1, op2) {
    const composed = {
      opId: op1.opId,
      documentId: op1.documentId,
      authorId: op1.authorId,
      clientId: op1.clientId,
      baseRevision: op1.baseRevision,
      revision: op2.revision || 0,
      components: []
    };

    const list1 = op1.components ? op1.components.map(c => ({ ...c })) : [];
    const list2 = op2.components ? op2.components.map(c => ({ ...c })) : [];

    let idx1 = 0;
    let idx2 = 0;

    const pushComp = (type, length, text) => {
      if (type === OpType.RETAIN || type === OpType.DELETE) {
        if (length <= 0) return;
      }
      if (type === OpType.INSERT) {
        if (!text || text.length === 0) return;
        length = text.length;
      }
      const last = composed.components[composed.components.length - 1];
      if (last && last.type === type) {
        if (type === OpType.INSERT) {
          last.text += text;
          last.length += text.length;
        } else {
          last.length += length;
        }
      } else {
        composed.components.push({ type, length, text: text || null });
      }
    };

    while (idx1 < list1.length || idx2 < list2.length) {
      const c1 = idx1 < list1.length ? list1[idx1] : null;
      const c2 = idx2 < list2.length ? list2[idx2] : null;

      if (c1 && c1.type === OpType.DELETE) {
        pushComp(OpType.DELETE, c1.length, null);
        idx1++;
        continue;
      }

      if (c2 && c2.type === OpType.INSERT) {
        pushComp(OpType.INSERT, c2.text.length, c2.text);
        idx2++;
        continue;
      }

      if (!c1) {
        if (c2) {
          if (c2.type === OpType.RETAIN) pushComp(OpType.RETAIN, c2.length, null);
          else if (c2.type === OpType.DELETE) pushComp(OpType.DELETE, c2.length, null);
          idx2++;
        }
        continue;
      }

      if (!c2) {
        if (c1.type === OpType.RETAIN) pushComp(OpType.RETAIN, c1.length, null);
        else if (c1.type === OpType.INSERT) pushComp(OpType.INSERT, c1.text.length, c1.text);
        idx1++;
        continue;
      }

      if (c1.type === OpType.RETAIN && c2.type === OpType.RETAIN) {
        const min = Math.min(c1.length, c2.length);
        pushComp(OpType.RETAIN, min, null);
        c1.length -= min;
        c2.length -= min;
        if (c1.length === 0) idx1++;
        if (c2.length === 0) idx2++;
      } else if (c1.type === OpType.RETAIN && c2.type === OpType.DELETE) {
        const min = Math.min(c1.length, c2.length);
        pushComp(OpType.DELETE, min, null);
        c1.length -= min;
        c2.length -= min;
        if (c1.length === 0) idx1++;
        if (c2.length === 0) idx2++;
      } else if (c1.type === OpType.INSERT && c2.type === OpType.RETAIN) {
        const min = Math.min(c1.text.length, c2.length);
        pushComp(OpType.INSERT, min, c1.text.substring(0, min));
        if (c1.text.length === min) idx1++;
        else c1.text = c1.text.substring(min);
        c2.length -= min;
        if (c2.length === 0) idx2++;
      } else if (c1.type === OpType.INSERT && c2.type === OpType.DELETE) {
        const min = Math.min(c1.text.length, c2.length);
        if (c1.text.length === min) idx1++;
        else c1.text = c1.text.substring(min);
        c2.length -= min;
        if (c2.length === 0) idx2++;
      }
    }

    return composed;
  }

  /**
   * Fast diff calculator between oldText and newText.
   * Produces an Operation that transforms oldText into newText.
   */
  static diffToOperation(oldText, newText, { opId, documentId, authorId, clientId, baseRevision }) {
    let start = 0;
    while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) {
      start++;
    }

    let endOld = oldText.length - 1;
    let endNew = newText.length - 1;
    while (endOld >= start && endNew >= start && oldText[endOld] === newText[endNew]) {
      endOld--;
      endNew--;
    }

    const deleteCount = endOld - start + 1;
    const insertText = newText.substring(start, endNew + 1);

    const components = [];
    if (start > 0) {
      components.push({ type: OpType.RETAIN, length: start, text: null });
    }
    if (insertText.length > 0) {
      components.push({ type: OpType.INSERT, length: insertText.length, text: insertText });
    }
    if (deleteCount > 0) {
      components.push({ type: OpType.DELETE, length: deleteCount, text: null });
    }
    const remainder = oldText.length - (start + deleteCount);
    if (remainder > 0) {
      components.push({ type: OpType.RETAIN, length: remainder, text: null });
    }

    return {
      opId: opId || Math.random().toString(36).substring(2, 11),
      documentId,
      authorId: Number(authorId),
      clientId,
      baseRevision: Number(baseRevision),
      revision: 0,
      components
    };
  }
}

/**
 * Client OT state manager implementing Synchronized, AwaitingConfirm, AwaitingWithBuffer.
 */
export class ClientOTHandler {
  constructor({ documentId, authorId, clientId, onSendOp, onApplyLocalDoc }) {
    this.documentId = documentId;
    this.authorId = authorId;
    this.clientId = clientId;
    this.onSendOp = onSendOp;
    this.onApplyLocalDoc = onApplyLocalDoc;

    this.serverRevision = 0;
    this.inFlightOp = null; // Operation currently being sent to server
    this.bufferOp = null;   // Operation buffered while waiting for ACK
  }

  setServerRevision(rev) {
    this.serverRevision = rev;
  }

  /**
   * Invoked when user types locally.
   */
  handleLocalEdit(oldDoc, newDoc) {
    const op = OTEngine.diffToOperation(oldDoc, newDoc, {
      documentId: this.documentId,
      authorId: this.authorId,
      clientId: this.clientId,
      baseRevision: this.serverRevision
    });

    if (op.components.length === 0) return null;

    if (!this.inFlightOp) {
      // State: SYNCHRONIZED -> AWAITING_CONFIRM
      this.inFlightOp = op;
      this.onSendOp(op);
    } else if (!this.bufferOp) {
      // State: AWAITING_CONFIRM -> AWAITING_WITH_BUFFER
      this.bufferOp = op;
    } else {
      // State: AWAITING_WITH_BUFFER -> compose into buffer
      this.bufferOp = OTEngine.compose(this.bufferOp, op);
    }

    return op;
  }

  /**
   * Invoked when server ACKs an operation.
   */
  handleServerAck(ackedOp) {
    this.serverRevision = ackedOp.revision;

    if (this.inFlightOp && this.inFlightOp.opId === ackedOp.opId) {
      this.inFlightOp = null;

      if (this.bufferOp) {
        // Send buffer as next in-flight op, rebasing its baseRevision to new server revision
        this.bufferOp.baseRevision = this.serverRevision;
        this.inFlightOp = this.bufferOp;
        this.bufferOp = null;
        this.onSendOp(this.inFlightOp);
      }
    }
  }

  /**
   * Invoked when a remote operation is broadcast from another user.
   */
  handleRemoteOp(remoteOp, currentDoc) {
    this.serverRevision = remoteOp.revision;

    let transformedRemote = remoteOp;

    if (this.inFlightOp) {
      const origInFlight = this.inFlightOp;
      // Client has priority over remote op in tie-breaks for local perspective
      this.inFlightOp = OTEngine.transform(origInFlight, transformedRemote, true);
      transformedRemote = OTEngine.transform(transformedRemote, origInFlight, false);
    }

    if (this.bufferOp) {
      const origBuffer = this.bufferOp;
      this.bufferOp = OTEngine.transform(origBuffer, transformedRemote, true);
      transformedRemote = OTEngine.transform(transformedRemote, origBuffer, false);
    }

    // Apply transformed remote operation to local document
    const updatedDoc = OTEngine.apply(currentDoc, transformedRemote);
    this.onApplyLocalDoc(updatedDoc, transformedRemote);
    return updatedDoc;
  }
}

