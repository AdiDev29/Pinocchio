// Background script for handling events that happen when the extension is not open

// Listen for installation
chrome.runtime.onInstalled.addListener(function() {
    console.log("Pinocchio extension has been installed");
});

// When handling messages from content scripts or other background scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message received in background.js:", message.action);
    
    // For YouTube transcript processing
    if (message.action === 'processYouTubeTranscript') {
        const { transcript, url, title, metadata } = message;
        
        console.log("YouTube transcript received, length:", transcript ? transcript.length : 0);
        
        // Create a formatted document with metadata
        let formattedContent = `# ${title}\n\n`;
        formattedContent += `Source: ${url}\n\n`;
        
        // Add additional metadata if available
        if (metadata) {
          if (metadata.author) formattedContent += `Author: ${metadata.author}\n`;
          if (metadata.duration) {
            const minutes = Math.floor(metadata.duration / 60);
            const seconds = metadata.duration % 60;
            formattedContent += `Duration: ${minutes}:${seconds.toString().padStart(2, '0')}\n`;
          }
          if (metadata.views) formattedContent += `Views: ${parseInt(metadata.views).toLocaleString()}\n`;
          formattedContent += '\n';
        }
        
        // Add the transcript
        formattedContent += `## Transcript\n\n${transcript}`;
        
        // Forward to popup with source text
        chrome.runtime.sendMessage({
            action: 'processContent',
            content: formattedContent,
            source: 'youtube',
            format: 'text'
        });
        
        // Try to open the popup
        try {
            chrome.action.openPopup();
        } catch (e) {
            console.error("Error opening popup:", e);
        }
    }
});