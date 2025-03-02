document.addEventListener('DOMContentLoaded', function() {
    const resultsDiv = document.getElementById('results');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const errorMessage = document.getElementById('error-message');
    const retryButton = document.getElementById('retry-button');
    const shareButton = document.getElementById('share-button');
    const currentUrlElement = document.getElementById('current-url');
    const iaUrlElement = document.getElementById('ia-url');
    const websiteTitleElement = document.getElementById('website-title');
    const themeToggle = document.getElementById('theme-toggle');
    
    let currentUrl = '';
    let currentTitle = '';
    let currentAnalysisData = null;
    let sourceText = '';
    let isYoutubeVideo = false;
    
    // Theme functions
    function initTheme() {
        // Check for saved theme preference
        chrome.storage.local.get(['theme'], function(result) {
            const savedTheme = result.theme;
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            
            // Use saved theme or fall back to system preference
            if (savedTheme === 'dark' || (savedTheme !== 'light' && prefersDark)) {
                document.body.setAttribute('data-theme', 'dark');
                themeToggle.innerHTML = '🌙';
            } else {
                document.body.setAttribute('data-theme', 'light');
                themeToggle.innerHTML = '☀️';
            }
        });
    }
    
    function toggleTheme() {
        if (document.body.getAttribute('data-theme') === 'dark') {
            document.body.setAttribute('data-theme', 'light');
            themeToggle.innerHTML = '☀️';
            chrome.storage.local.set({theme: 'light'});
        } else {
            document.body.setAttribute('data-theme', 'dark');
            themeToggle.innerHTML = '🌙';
            chrome.storage.local.set({theme: 'dark'});
        }
    }
    
    // Add theme toggle event listener
    themeToggle.addEventListener('click', toggleTheme);
    
    // Initialize theme
    initTheme();
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        // Only auto-change if user hasn't set a preference
        chrome.storage.local.get(['theme'], function(result) {
            if (!result.theme) {
                if (e.matches) {
                    document.body.setAttribute('data-theme', 'dark');
                    themeToggle.innerHTML = '🌙';
                } else {
                    document.body.setAttribute('data-theme', 'light');
                    themeToggle.innerHTML = '☀️';
                }
            }
        });
    });
    
    // Show loading initially
    resultsDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    loadingDiv.style.display = 'flex';
    
    // Add event listener for retry button
    retryButton.addEventListener('click', function() {
      // Show loading
      resultsDiv.style.display = 'none';
      errorDiv.style.display = 'none';
      loadingDiv.style.display = 'flex';
      websiteTitleElement.textContent = 'Analyzing page...';
      
      // Force a new analysis
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        updatePageInfo(currentTab);
        performAnalysis(currentTab, true);
      });
    });
    
    // Add event listener for share button with improved error handling
    if (shareButton) {
      shareButton.addEventListener('click', function() {
        console.log("Download button clicked");
        downloadReport();
      });
    }
    
    // Initialize file upload and source viewer
    initSourceViewer();
    
    // Start the analysis process
    init();
    
    function init() {
      // Get current tab
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs.length > 0) {
          const currentTab = tabs[0];
          updatePageInfo(currentTab);
          
          console.log("Checking for cached results for:", currentUrl);
          
          // Check if we have a cached result for this URL
          try {
            chrome.storage.local.get([currentUrl], function(result) {
              console.log("Retrieved from cache:", result);
              
              if (result && result[currentUrl] && Object.keys(result[currentUrl]).length > 0) {
                // We have a valid cached result
                console.log("Using cached result");
                displayResults(result[currentUrl]);
              } else {
                // No cached result, perform analysis
                console.log("No cached result, performing analysis");
                performAnalysis(currentTab, false);
              }
            });
          } catch (error) {
            console.error("Error accessing cache:", error);
            // If we can't access the cache, just perform the analysis
            performAnalysis(currentTab, false);
          }
        } else {
          showError("No active tab found");
        }
      });
    }
    
    function updatePageInfo(tab) {
      // Update URL and title information
      currentUrl = tab.url;
      currentTitle = tab.title || 'Unknown Page';
      
      // Check if this is a YouTube video
      isYoutubeVideo = currentUrl.includes('youtube.com/watch') || currentUrl.includes('youtu.be/');
      
      // Format and display the title (truncate if too long)
      const maxTitleLength = 40;
      let displayTitle = currentTitle;
      if (displayTitle.length > maxTitleLength) {
        displayTitle = displayTitle.substring(0, maxTitleLength) + '...';
      }
      websiteTitleElement.textContent = displayTitle;
      websiteTitleElement.title = currentTitle; // Full title on hover
      
      // Format and set the URL
      currentUrlElement.textContent = formatUrl(currentUrl);
      currentUrlElement.href = currentUrl;
      currentUrlElement.title = currentUrl; // Full URL on hover

      // Set the Internet Archive URL
      iaUrlElement.href = `https://web.archive.org/*/${currentUrl}`;
    }
    
    function formatUrl(url) {
      try {
        // Try to create a URL object
        const urlObj = new URL(url);
        
        // If the URL is too long, truncate parts of it
        if (url.length > 50) {
          const domain = urlObj.hostname;
          const path = urlObj.pathname;
          
          // Show domain + beginning of path (truncated)
          if (path.length > 20) {
            return `${domain}${path.substring(0, 15)}...`;
          } else {
            return `${domain}${path}`;
          }
        }
        
        return url;
      } catch (e) {
        // If URL parsing fails, return the raw URL
        return url;
      }
    }
    
    function performAnalysis(tab, forceRefresh) {
      console.log("Performing analysis for:", tab.url);
      
      // Check if this is a YouTube video
      const isYoutube = tab.url.includes('youtube.com/watch') || tab.url.includes('youtu.be/');
      
      // If we're forcing a refresh, clear any existing cached data
      if (forceRefresh) {
        try {
          chrome.storage.local.remove([tab.url], function() {
            console.log("Cleared cached data for:", tab.url);
          });
        } catch (error) {
          console.error("Error clearing cache:", error);
        }
      }
      
      // Execute script to get content of current page
      chrome.scripting.executeScript({
        target: {tabId: tab.id},
        function: isYoutube ? getYouTubeContent : getPageContent
      }, function(results) {
        if (chrome.runtime.lastError) {
          showError('Error accessing page content: ' + chrome.runtime.lastError.message);
          return;
        }
        
        if (!results || results.length === 0) {
          showError('Could not extract content from page');
          return;
        }
        
        const content = results[0].result;
        
        // Store source text for later use
        storeSourceText(content);
        
        // Send the content to our backend server
        fetch('http://172.105.18.148:8080/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: tab.url,
            title: tab.title,
            content: content,
            type: isYoutube ? 'youtube' : 'webpage'
          })
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("Analysis complete, results:", data);
          
          // Store the analysis data for potential later use
          currentAnalysisData = data;

          // Only store in cache if we have valid data
          if (data && !data.error) {
            // Cache the result for this URL
            try {
              chrome.storage.local.set({[tab.url]: data}, function() {
                if (chrome.runtime.lastError) {
                  console.error("Error caching result:", chrome.runtime.lastError);
                } else {
                  console.log('Cached fact-check result for:', tab.url);
                }
              });
            } catch (error) {
              console.error("Error setting cache:", error);
            }
          }
          
          // Display the results regardless of caching success
          displayResults(data);
        })
        .catch(error => {
          console.error("Fetch error:", error);
          showError('Error analyzing content: ' + error.message);
        });
      });
    }
    
    function displayResults(data) {
      console.log("Displaying results:", data);
      
      // Hide loading
      loadingDiv.style.display = 'none';
      
      // Handle error in data
      if (data.error) {
        showError(data.error);
        return;
      }
      
      // Show results
      resultsDiv.style.display = 'flex';
      
      // Update score
      const scoreLabel = document.getElementById('score-label');
      const scoreBadge = document.getElementById('score-badge');
      const scoreDescription = document.getElementById('score-description');
      const pinocchioNose = document.getElementById('pinocchio-nose');
      const score = data.misinformation_score || 0;
      
      // Calculate the maximum nose length from CSS variable or default to 200px
      const maxNoseLength = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--nose-max-length')) || 200;
      
      // Animate Pinocchio's nose - length grows with misinformation score
      const noseLength = Math.max(5, Math.round((score / 10) * maxNoseLength));
      setTimeout(() => {
        pinocchioNose.style.width = `${noseLength}px`;
      }, 500);
      
      scoreLabel.innerText = `${score}/10`;
      
      // Set colors and label based on the score
      let bgColor, textColor, borderColor, icon, description;
      
      if (score <= 3) {
        // Low misinformation score - good/reliable
        bgColor = 'rgba(76, 175, 80, 0.1)';
        textColor = '#4CAF50';
        borderColor = '#4CAF50';
        icon = '✓';
        description = 'Generally Reliable';
      } else if (score <= 7) {
        // Medium misinformation score - questionable
        bgColor = 'rgba(255, 193, 7, 0.1)';
        textColor = '#FFC107';
        borderColor = '#FFC107';
        icon = '⚠';
        description = 'Potentially Misleading';
      } else {
        // High misinformation score - bad/unreliable
        bgColor = 'rgba(244, 67, 54, 0.1)';
        textColor = '#F44336';
        borderColor = '#F44336';
        icon = '✗';
        description = 'Likely Unreliable';
      }
      
      // Apply styles to score elements
      scoreLabel.style.color = textColor;
      
      if (scoreBadge) {
        scoreBadge.innerHTML = icon;
        scoreBadge.style.backgroundColor = bgColor;
        scoreBadge.style.color = textColor;
        scoreBadge.style.borderColor = borderColor;
      }
      
      if (scoreDescription) {
        scoreDescription.textContent = description;
        scoreDescription.style.color = textColor;
      }
      
      // Apply a subtle background to the score container
      const scoreContainer = document.querySelector('.score-container');
      if (scoreContainer) {
        scoreContainer.style.borderColor = borderColor;
        scoreContainer.style.backgroundColor = bgColor;
      }
      
      // Update content
      document.getElementById('summary').innerText = data.summary || 'No summary available';
      document.getElementById('report').innerText = data.report || 'No report available';
      document.getElementById('additional-context').innerText = data.additional_context || 'No additional context available';
      
      // Display sources as clickable links
      const sourcesList = document.getElementById('sources-list');
      sourcesList.innerHTML = ''; // Clear existing sources
      
      if (data.sources && Array.isArray(data.sources) && data.sources.length > 0) {
        data.sources.forEach(source => {
          if (source) {
            const li = document.createElement('li');
            const a = document.createElement('a');
            
            // Determine the display text for the link
            let displayText = source;
            
            // If we have source objects with titles, use those instead
            if (data.source_objects && Array.isArray(data.source_objects)) {
              const sourceObj = data.source_objects.find(obj => obj && obj.url === source);
              if (sourceObj && sourceObj.title) {
                displayText = sourceObj.title;
              }
            }
            
            // Clean up display text to avoid encoding issues
            let cleanText = displayText;
            try {
              // Attempt to create a clean URL for display
              const url = new URL(source);
              cleanText = url.hostname || displayText;
            } catch (e) {
              // If URL parsing fails, just use the cleaned display text
              cleanText = displayText.replace(/[^\x00-\x7F]/g, ''); // Remove non-ASCII chars
            }
            
            // Set link properties
            a.href = source;
            a.textContent = cleanText;
            a.title = source; // Show full URL on hover
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            
            li.appendChild(a);
            sourcesList.appendChild(li);
          }
        });
      } else {
        const li = document.createElement('li');
        li.textContent = 'No sources available';
        sourcesList.appendChild(li);
      }
    }
    
    function getPageContent() {
      // Get all text content from the page
      return document.body.innerText;
    }
    
    function getYouTubeContent() {
      // This function extracts content from YouTube videos
      let content = "";
      
      // Try to get video title
      const title = document.querySelector('h1.title.style-scope.ytd-video-primary-info-renderer')?.textContent || 
                    document.querySelector('h1.watch-title-container')?.textContent || 
                    "";
      content += "Title: " + title + "\n\n";
      
      // Try to get video description
      const description = document.querySelector('#description-text')?.textContent || 
                         document.querySelector('#description')?.textContent || 
                         "";
      content += "Description: " + description + "\n\n";
      
      // Try to get channel name
      const channel = document.querySelector('#channel-name')?.textContent || 
                     document.querySelector('#owner-name')?.textContent || 
                     "";
      content += "Channel: " + channel + "\n\n";
      
      // Try to get transcript if available
      const transcriptText = Array.from(document.querySelectorAll('div.cue-group'))
        .map(group => {
          const textElem = group.querySelector('.cue-text');
          return textElem ? textElem.textContent : "";
        })
        .join(' ');
      
      if (transcriptText) {
        content += "Transcript: " + transcriptText + "\n\n";
      }
      
      // Get comments if available (limited to visible ones)
      const comments = Array.from(document.querySelectorAll('#content-text'))
        .map(comment => comment.textContent)
        .join('\n\n');
      
      if (comments) {
        content += "Comments: " + comments + "\n\n";
      }
      
      return content || document.body.innerText; // Fall back to body text if nothing specific was found
    }
    
    function storeSourceText(text) {
      // Store the source text for potential later use
      sourceText = text;
      
      // If we have a source viewer element, update it
      const sourceViewer = document.getElementById('source-text-viewer');
      if (sourceViewer) {
        sourceViewer.textContent = text.substring(0, 1000) + (text.length > 1000 ? "..." : "");
      }
    }
    
    function initSourceViewer() {
      // Add source viewer tab and file upload functionality
      const tabs = document.querySelector('.tab-container');
      const content = document.querySelector('.tab-content');
      
      // Skip if elements don't exist in this version
      if (!tabs || !content) return;
      
      // Create source tab if it doesn't exist
      if (!document.getElementById('source-tab')) {
        const sourceTab = document.createElement('div');
        sourceTab.id = 'source-tab';
        sourceTab.className = 'tab';
        sourceTab.textContent = 'Source';
        tabs.appendChild(sourceTab);
        
        // Create source content container
        const sourceContent = document.createElement('div');
        sourceContent.id = 'source-content';
        sourceContent.className = 'content-section';
        sourceContent.style.display = 'none';
        
        // Add file upload area
        const uploadArea = document.createElement('div');
        uploadArea.className = 'upload-area';
        uploadArea.innerHTML = `
          <p>Analyze text or a URL directly:</p>
          <textarea id="source-input" placeholder="Paste URL, YouTube link, or text to analyze"></textarea>
          <button id="analyze-source-btn" class="analyze-btn">Analyze</button>
          <div id="source-text-viewer" class="source-viewer"></div>
        `;
        sourceContent.appendChild(uploadArea);
        content.appendChild(sourceContent);
        
        // Add event listeners for the new tab
        sourceTab.addEventListener('click', function() {
          // Hide all content sections
          document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
          });
          
          // Show source content
          sourceContent.style.display = 'block';
          
          // Mark this tab as active
          document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
          });
          sourceTab.classList.add('active');
        });
        
        // Add event listener for the analyze button
        document.getElementById('analyze-source-btn').addEventListener('click', function() {
          handleSourceAnalysis();
        });
      }
    }
    
    function handleSourceAnalysis() {
      const sourceInput = document.getElementById('source-input');
      if (!sourceInput || !sourceInput.value.trim()) {
        alert('Please enter a URL or text to analyze.');
        return;
      }
      
      const input = sourceInput.value.trim();
      
      // Show loading
      resultsDiv.style.display = 'none';
      errorDiv.style.display = 'none';
      loadingDiv.style.display = 'flex';
      
      // Check if input is a URL
      let isUrl = false;
      try {
        new URL(input);
        isUrl = true;
      } catch (e) {
        // Not a URL, will be treated as text
      }
      
      if (isUrl) {
        // If it's a URL, check if it's YouTube
        const isYoutube = input.includes('youtube.com/watch') || input.includes('youtu.be/');
        
        // For URLs, we could either open them in a new tab or fetch them directly
        if (isYoutube) {
          // For YouTube, we might want special handling
          analyzeDirectInput(input, 'youtube');
        } else {
          // For other URLs
          analyzeDirectInput(input, 'webpage');
        }
      } else {
        // It's plain text
        storeSourceText(input);
        analyzeDirectInput(input, 'text');
      }
    }
    
    function analyzeDirectInput(input, type) {
      // Analyze text or URL directly without opening a tab
      fetch('http://172.105.18.148:8080/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: input,
          type: type,
          url: type === 'text' ? null : input,
          title: 'User submitted content'
        })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log("Direct analysis complete, results:", data);
        
        // Store the analysis data
        currentAnalysisData = data;
        
        // Display results
        displayResults(data);
      })
      .catch(error => {
        console.error("Direct analysis error:", error);
        showError('Error analyzing content: ' + error.message);
      });
    }
    
    function handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      // Show loading state
      resultsDiv.style.display = 'none';
      errorDiv.style.display = 'none';
      loadingDiv.style.display = 'flex';
      
      const reader = new FileReader();
      
      reader.onload = function(e) {
        const content = e.target.result;
        storeSourceText(content);
        
        // Send for analysis
        fetch('http://172.105.18.148:8080/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: content,
            type: 'file',
            title: file.name,
            filename: file.name
          })
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("File analysis complete, results:", data);
          
          // Store the analysis data
          currentAnalysisData = data;
          
          // Display results
          displayResults(data);
        })
        .catch(error => {
          console.error("File analysis error:", error);
          showError('Error analyzing file: ' + error.message);
        });
      };
      
      reader.onerror = function() {
        showError('Error reading file');
      };
      
      // Read the file as text
      reader.readAsText(file);
    }
    
    function generateAndSendReport() {
      // This function sends the current analysis to predetermined recipients
      if (!currentAnalysisData) {
        alert('Please complete an analysis before generating a report.');
        return;
      }
      
      // Show a loading indicator
      const shareButton = document.getElementById('share-button');
      if (shareButton) {
        const originalText = shareButton.textContent;
        shareButton.textContent = 'Sending...';
        shareButton.disabled = true;
        
        // Prepare report data
        const reportData = {
          url: currentUrl,
          title: currentTitle,
          analysis: currentAnalysisData,
          generated: new Date().toISOString(),
          isYoutubeVideo: isYoutubeVideo,
          score: currentAnalysisData.misinformation_score || 0
        };
        
        // Send to a predetermined endpoint
        fetch('http://172.105.18.148:8080/api/report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(reportData)
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("Report sent successfully:", data);
          alert('Report sent successfully!');
          
          // Reset button
          shareButton.textContent = originalText;
          shareButton.disabled = false;
        })
        .catch(error => {
          console.error("Error sending report:", error);
          alert('Error sending report: ' + error.message);
          
          // Reset button
          shareButton.textContent = originalText;
          shareButton.disabled = false;
        });
      }
    }
    
    function showError(message) {
      console.error("Error:", message);
      loadingDiv.style.display = 'none';
      resultsDiv.style.display = 'none';
      errorDiv.style.display = 'block';
      errorMessage.innerText = message;
    }

    // Improved download function that uses text/html approach (more reliable in extensions)
    function downloadReport() {
      console.log("Starting report download function");
      
      // Check if results are available
      if (resultsDiv.style.display === 'none') {
        alert('Please wait for the analysis to complete before downloading.');
        return;
      }
      
      try {
        // Get the score and other content
        const scoreElement = document.getElementById('score-label');
        const score = scoreElement ? scoreElement.textContent.split('/')[0] : 0;
        const scoreNum = parseInt(score);
        const summary = document.getElementById('summary').textContent;
        const report = document.getElementById('report').textContent;
        const additionalContext = document.getElementById('additional-context').textContent;
        
        // Determine score color and description
        let scoreColor, scoreBackground, scoreDescription, scoreIcon;
        if (scoreNum <= 3) {
          scoreColor = '#4CAF50';
          scoreBackground = 'rgba(76, 175, 80, 0.1)';
          scoreDescription = 'Generally Reliable';
          scoreIcon = '✓';
        } else if (scoreNum <= 7) {
          scoreColor = '#FFC107';
          scoreBackground = 'rgba(255, 193, 7, 0.1)';
          scoreDescription = 'Potentially Misleading';
          scoreIcon = '⚠';
        } else {
          scoreColor = '#F44336';
          scoreBackground = 'rgba(244, 67, 54, 0.1)';
          scoreDescription = 'Likely Unreliable';
          scoreIcon = '✗';
        }

        // Calculate nose length based on score (same logic as in displayResults)
        const maxNoseLength = 200; // Default if CSS variable can't be accessed in this context
        const noseLength = Math.max(5, Math.round((scoreNum / 10) * maxNoseLength));
        
        // Placeholder base64 image for Pinocchio's face
        const pinocchioBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyNpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNS1jMDE0IDc5LjE1MTQ4MSwgMjAxMy8wMy8xMy0xMjowOToxNSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIChNYWNpbnRvc2gpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjFFOTcwNUUyRUZBMjExRTQ4MDU3RThBRDY5RDY5NjM0IiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjFFOTcwNUUzRUZBMjExRTQ4MDU3RThBRDY5RDY5NjM0Ij4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6MUU5NzA1RTBFRkEyMTFFNDgwNTdFOEFENjlENjk2MzQiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6MUU5NzA1RTFFRkEyMTFFNDgwNTdFOEFENjlENjk2MzQiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz7N1+pjAAAF9klEQVR42uxdaYhc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';
        
        // Get the current theme for report styling
        const currentTheme = document.body.getAttribute('data-theme') || 'light';
        
        // Create a formatted HTML report with score coloring and Pinocchio nose
        const reportHtml = `
          <!DOCTYPE html>
          <html data-theme="${currentTheme}">
          <head>
            <meta charset="UTF-8">
            <title>Pinocchio Report - ${currentTitle}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Playfair+Display:wght@400;700&display=swap');
              
              :root {
                --bg-color: #f9f4e8;
                --container-bg: linear-gradient(135deg, #f7f0e1 0%, #eadfc5 100%);
                --text-color: #5b4b33;
                --title-color: #854a11;
                --subtitle-color: #7d6843;
                --heading-color: #714012;
                --border-color: #c4a77d;
                --section-bg: #faf6eb;
                --nose-height: 11px;
                --nose-color: #D8B991;
                --nose-border-radius: 6px;
              }
              
              [data-theme="dark"] {
                --bg-color: #2c2620;
                --container-bg: linear-gradient(135deg, #3a322a 0%, #2a241e 100%);
                --text-color: #e0d5c4;
                --title-color: #d9b380;
                --subtitle-color: #b8a88e;
                --heading-color: #d9b380;
                --border-color: #6d5c45;
                --section-bg: #3a322a;
              }
              
              body { font-family: 'Nunito', Arial, sans-serif; color: var(--text-color); margin: 0; padding: 20px; background-color: var(--bg-color); }
              .container { max-width: 800px; margin: 0 auto; background: var(--container-bg); padding: 30px; border-radius: 10px; box-shadow: 0 5px 20px rgba(91, 75, 51, 0.15); }
              h1 { color: var(--title-color); font-size: 28px; text-align: center; margin-bottom: 5px; }
              h2 { color: var(--heading-color); font-size: 18px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px; margin-top: 25px; }
              .subtitle { text-align: center; color: var(--subtitle-color); font-size: 16px; margin-bottom: 30px; }
              .score-container { text-align: center; margin: 20px 0; padding: 20px; border-radius: 10px; background-color: ${scoreBackground}; border: 1px solid ${scoreColor}; }
              .score-value { font-size: 28px; font-weight: bold; color: ${scoreColor}; margin: 10px 0; }
              .score-description { font-size: 16px; color: ${scoreColor}; margin: 5px 0; }
              .score-badge { display: inline-block; width: 30px; height: 30px; line-height: 30px; text-align: center; border-radius: 50%; background-color: ${scoreColor}; color: white; font-size: 16px; font-weight: bold; margin-right: 10px; }
              .section { background-color: var(--section-bg); padding: 15px; margin: 15px 0; border-radius: 8px; }
              .url { font-size: 12px; color: var(--subtitle-color); text-align: center; margin-bottom: 20px; word-break: break-all; }
              .date { text-align: center; font-size: 12px; color: var(--subtitle-color); margin-top: 10px; }
              .footer { text-align: center; margin-top: 30px; color: var(--subtitle-color); font-size: 12px; }
              .sources { list-style-type: none; padding-left: 20px; }
              .sources li { margin-bottom: 8px; position: relative; }
              .sources li:before { content: '•'; position: absolute; left: -15px; color: var(--title-color); }
              a { color: var(--title-color); text-decoration: none; }
              a:hover { text-decoration: underline; }
              
              /* Pinocchio Nose Styling */
              .pinocchio-container {
                position: relative;
                width: 100%;
                height: 180px;
                display: flex;
                justify-content: flex-start;
                align-items: center;
                margin: 15px 0;
                overflow: visible;
                padding-left: 10px;
                background-color: rgba(255, 255, 255, 0.1);
                border-radius: 8px;
              }
              .pinocchio-face {
                height: 150px;
                width: auto;
                position: relative;
                z-index: 2;
                margin-left: 30px;
              }
              .pinocchio-nose {
                position: absolute;
                left: 110px;
                top: 61%;
                transform: translateY(-50%);
                height: var(--nose-height);
                background-color: var(--nose-color);
                border-radius: 0 var(--nose-border-radius) var(--nose-border-radius) 0;
                z-index: 1;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                width: ${noseLength}px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Pinocchio Report</h1>
              <p class="subtitle">Fact-Check Analysis</p>
              <p class="url">URL: ${currentUrl}</p>
              
              <div class="score-container">
                <h2>Misinformation Score</h2>
                
                <!-- Pinocchio with nose -->
                <div class="pinocchio-container">
                  <img src="${pinocchioBase64}" alt="Pinocchio" class="pinocchio-face">
                  <div class="pinocchio-nose"></div>
                </div>
                
                <div class="score-badge">${scoreIcon}</div>
                <div class="score-value">${score}/10</div>
                <div class="score-description">${scoreDescription}</div>
              </div>
              
              <div class="section">
                <h2>Summary</h2>
                <p>${summary}</p>
              </div>
              
              <div class="section">
                <h2>Truth Report</h2>
                <p>${report}</p>
              </div>
              
              <div class="section">
                <h2>More Context</h2>
                <p>${additionalContext}</p>
              </div>
              
              <div class="section">
                <h2>Sources Checked</h2>
                <ul class="sources">
                  ${generateSourcesList()}
                </ul>
              </div>
              
              <p class="date">Generated: ${new Date().toLocaleString()}</p>
              <div class="footer">✨ Generated by Pinocchio - The Wooden Truth Detective ✨</div>
            </div>
          </body>
          </html>
        `;
        
        // Create a download link and trigger it
        const blob = new Blob([reportHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pinocchio-report-${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log("Report download initiated");
      } catch (error) {
        console.error("Error generating report:", error);
        alert("Sorry, there was an error generating your report. Please try again.");
      }
    }
    
    // Helper function to generate sources HTML
    function generateSourcesList() {
      try {
        const sourcesList = document.getElementById('sources-list');
        if (!sourcesList) return '<li>No sources available</li>';
        
        let sourcesHtml = '';
        const sources = sourcesList.querySelectorAll('li');
        
        if (sources.length > 0) {
          sources.forEach(source => {
            if (source.querySelector('a')) {
              const anchor = source.querySelector('a');
              sourcesHtml += `<li><a href="${anchor.href}" target="_blank">${anchor.textContent}</a></li>`;
            } else {
              sourcesHtml += `<li>${source.textContent}</li>`;
            }
          });
        } else {
          sourcesHtml = '<li>No sources available</li>';
        }
        
        return sourcesHtml;
      } catch (error) {
        console.error("Error generating sources list:", error);
        return '<li>Error loading sources</li>';
      }
    }
  });