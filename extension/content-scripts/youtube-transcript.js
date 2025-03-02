/**
 * YouTube Transcript Extractor for Pinocchio
 * This script extracts transcripts from YouTube videos using YouTube's API
 */

(function() {
  // Check if we're on a YouTube video page
  function isYouTubeVideoPage() {
    return window.location.hostname.includes('youtube.com') && 
           window.location.pathname.includes('/watch');
  }

  // Wait for an element to be present in the DOM
  function waitForElement(selector) {
    return new Promise(resolve => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }

  // Function to retrieve transcript using YouTube's API data
  async function retrieveTranscript() {
    try {
      const videoId = new URLSearchParams(window.location.search).get('v');
      if (!videoId) {
        throw new Error('Could not find video ID');
      }

      const YT_INITIAL_PLAYER_RESPONSE_RE =
        /ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*(?:var\s+(?:meta|head)|<\/script|\n)/;
      
      // Try to get the player response from the window object
      let player = window.ytInitialPlayerResponse;
      
      // If not available or mismatched video ID, fetch it from the page
      if (!player || videoId !== (player.videoDetails?.videoId || '')) {
        const response = await fetch('https://www.youtube.com/watch?v=' + videoId);
        const body = await response.text();
        
        const playerResponse = body.match(YT_INITIAL_PLAYER_RESPONSE_RE);
        if (!playerResponse) {
          throw new Error('Unable to parse player response');
        }
        
        player = JSON.parse(playerResponse[1]);
      }
      
      // Extract video metadata
      const metadata = {
        title: player.videoDetails.title,
        duration: player.videoDetails.lengthSeconds,
        author: player.videoDetails.author,
        views: player.videoDetails.viewCount
      };
      
      // Check if captions are available
      if (!player.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
        throw new Error('No captions available for this video');
      }
      
      // Get the tracks and sort them by priority (English and manual first)
      const tracks = player.captions.playerCaptionsTracklistRenderer.captionTracks;
      if (!tracks || tracks.length === 0) {
        throw new Error('No caption tracks found');
      }
      
      tracks.sort(compareTracks);
      
      // Get the transcript from the first (highest priority) track
      const transcriptResponse = await fetch(tracks[0].baseUrl + '&fmt=json3');
      const transcript = await transcriptResponse.json();
      
      // Parse the transcript
      const parsedTranscript = transcript.events
        // Remove invalid segments
        .filter(function(x) {
          return x.segs;
        })
        // Concatenate into single long string
        .map(function(x) {
          return x.segs
            .map(function(y) {
              return y.utf8;
            })
            .join(' ');
        })
        .join(' ')
        // Remove invalid characters
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        // Replace any whitespace with a single space
        .replace(/\s+/g, ' ');
      
      return {
        text: parsedTranscript,
        metadata: metadata
      };
    } catch (error) {
      console.error('Error retrieving transcript:', error);
      throw error;
    }
  }

  // Helper function to sort tracks by priority
  function compareTracks(track1, track2) {
    const langCode1 = track1.languageCode;
    const langCode2 = track2.languageCode;

    if (langCode1 === 'en' && langCode2 !== 'en') {
      return -1; // English comes first
    } else if (langCode1 !== 'en' && langCode2 === 'en') {
      return 1; // English comes first
    } else if (track1.kind !== 'asr' && track2.kind === 'asr') {
      return -1; // Non-ASR (manual captions) comes first
    } else if (track1.kind === 'asr' && track2.kind !== 'asr') {
      return 1; // Non-ASR comes first
    }

    return 0; // Preserve order if both have same priority
  }

  // Send transcript to the extension
  function sendTranscriptToExtension(transcript, metadata) {
    chrome.runtime.sendMessage({
      action: 'processYouTubeTranscript',
      transcript: transcript,
      url: window.location.href,
      title: metadata.title,
      metadata: metadata
    });
  }

  // Main function to handle the process
  async function handleYouTubeTranscript() {
    if (!isYouTubeVideoPage()) return;
    
    try {
      // Add a button to extract transcript
      const container = await waitForElement('#above-the-fold');
      
      const extractButton = document.createElement('button');
      extractButton.textContent = 'Process with Pinocchio';
      extractButton.style.cssText = 'margin: 10px 0; padding: 10px; background-color: #3ea6ff; color: white; border: none; border-radius: 4px; cursor: pointer;';
      
      // Insert the button at the beginning of the container
      if (container.firstChild) {
        container.insertBefore(extractButton, container.firstChild);
      } else {
        container.appendChild(extractButton);
      }
      
      // Add click handler
      extractButton.addEventListener('click', async () => {
        try {
          extractButton.textContent = 'Extracting transcript...';
          extractButton.disabled = true;
          
          const result = await retrieveTranscript();
          
          if (result && result.text) {
            sendTranscriptToExtension(result.text, result.metadata);
            extractButton.textContent = 'Transcript sent for processing!';
            
            // Show a success message
            const successMsg = document.createElement('div');
            successMsg.textContent = 'Opening Pinocchio...';
            successMsg.style.cssText = 'color: green; margin-top: 5px; font-weight: bold;';
            extractButton.parentNode.insertBefore(successMsg, extractButton.nextSibling);
            
            // Remove message after 3 seconds
            setTimeout(() => {
              if (successMsg.parentNode) {
                successMsg.parentNode.removeChild(successMsg);
              }
            }, 3000);
          } else {
            extractButton.textContent = 'Failed to extract transcript';
            extractButton.disabled = false;
          }
        } catch (error) {
          console.error('Error extracting YouTube transcript:', error);
          extractButton.textContent = 'Error: ' + (error.message || 'Failed to extract transcript');
          extractButton.disabled = false;
        }
      });
    } catch (error) {
      console.error('Error setting up YouTube transcript extractor:', error);
    }
  }

  // Run when the page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleYouTubeTranscript);
  } else {
    handleYouTubeTranscript();
  }
})();
