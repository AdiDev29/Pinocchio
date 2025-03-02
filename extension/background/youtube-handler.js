/**
 * YouTube Transcript Handler for Pinocchio
 * This script processes YouTube transcripts received from the content script
 */

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'processYouTubeTranscript') {
    const { transcript, url, title, metadata } = message;
    
    console.log("YouTube transcript received in background:", title, "length:", transcript.length);
    
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
    
    // Process the transcript using the existing processing pipeline
    processTranscriptWithPinocchio(formattedContent);
  }
});

// Function to process transcript with existing Pinocchio functionality
function processTranscriptWithPinocchio(content) {
  console.log("Processing YouTube transcript, content length:", content.length);
  
  // Create a synthetic event that mimics user input or file selection
  chrome.runtime.sendMessage({
    action: 'processContent',
    content: content,
    source: 'youtube',
    format: 'text'
  });

  // Open the popup
  try {
    chrome.action.openPopup();
  } catch (e) {
    console.error("Error opening popup:", e);
    // Alternative approach:
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
  }
}
