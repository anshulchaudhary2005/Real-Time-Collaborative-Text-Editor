package com.collaborative.texteditor.service;

import com.collaborative.texteditor.document.Document;
import com.collaborative.texteditor.document.User;
import com.collaborative.texteditor.repository.DocumentRepository;
import com.collaborative.texteditor.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DocumentService {
    
    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;

    @Transactional
    public Document createDocument(String title, Long ownerId) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        Document doc = new Document();
        doc.setTitle(title);
        doc.setOwner(owner);
        return documentRepository.save(doc);
    }

    public Document getDocument(UUID id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Document not found"));
    }
    
    public java.util.List<Document> getAllDocuments() {
        return documentRepository.findAll();
    }

    @Transactional
    public Document updateDocumentContent(UUID id, String newContent) {
        Document doc = getDocument(id);
        doc.setContent(newContent);
        return documentRepository.save(doc);
    }

    @Transactional
    public void deleteDocument(UUID id) {
        if (!documentRepository.existsById(id)) {
            throw new RuntimeException("Document not found");
        }
        documentRepository.deleteById(id);
    }
}