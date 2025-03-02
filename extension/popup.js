document.addEventListener('DOMContentLoaded', function() {
    const resultsDiv = document.getElementById('results');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const errorMessage = document.getElementById('error-message');
    const retryButton = document.getElementById('retry-button');
    const shareButton = document.getElementById('share-button');
    const currentUrlElement = document.getElementById('current-url');
    const websiteTitleElement = document.getElementById('website-title');
    
    let currentUrl = '';
    let currentTitle = '';
    let currentAnalysisData = null;
    
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
        function: getPageContent
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
        
        // Send the content to our backend server - UPDATED SERVER ADDRESS
        fetch('http://172.105.18.148:8080/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: tab.url,
            title: tab.title,
            content: content
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

      // Automatically generate and send report to backend
      generateAndSendReport(data, score);
    }
    
    // New function to generate and send report to the backend
    function generateAndSendReport(data, score) {
      try {
        // Generate the HTML report
        const reportHtml = createReportHtml(data, score);
        
        // Send the report to the backend - UPDATED SERVER ADDRESS
        fetch('http://172.105.18.148:8080/api/reports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: currentUrl,
            title: currentTitle,
            score: score,
            html: reportHtml
          })
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("Report saved to backend:", data);
        })
        .catch(error => {
          console.error("Error saving report to backend:", error);
        });
      } catch (error) {
        console.error("Error generating report for backend:", error);
      }
    }
    
    // Helper function to create HTML report content
    function createReportHtml(data, score) {
      const summary = document.getElementById('summary').textContent;
      const report = document.getElementById('report').textContent;
      const additionalContext = document.getElementById('additional-context').textContent;
      
      // Determine score color and description
      let scoreColor, scoreBackground, scoreDescription, scoreIcon;
      if (score <= 3) {
        scoreColor = '#4CAF50';
        scoreBackground = 'rgba(76, 175, 80, 0.1)';
        scoreDescription = 'Generally Reliable';
        scoreIcon = '✓';
      } else if (score <= 7) {
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
      
      // Create HTML report
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Pinocchio Report - ${currentTitle}</title>
          <style>
            body { font-family: 'Nunito', Arial, sans-serif; color: #5b4b33; margin: 0; padding: 20px; background-color: #f9f4e8; }
            .container { max-width: 800px; margin: 0 auto; background: linear-gradient(135deg, #f7f0e1 0%, #eadfc5 100%); padding: 30px; border-radius: 10px; box-shadow: 0 5px 20px rgba(91, 75, 51, 0.15); }
            h1 { color: #854a11; font-size: 28px; text-align: center; margin-bottom: 5px; }
            h2 { color: #714012; font-size: 18px; border-bottom: 1px solid #c4a77d; padding-bottom: 5px; margin-top: 25px; }
            .subtitle { text-align: center; color: #7d6843; font-size: 16px; margin-bottom: 30px; }
            .score-container { text-align: center; margin: 20px 0; padding: 20px; border-radius: 10px; background-color: ${scoreBackground}; border: 1px solid ${scoreColor}; }
            .score-value { font-size: 28px; font-weight: bold; color: ${scoreColor}; margin: 10px 0; }
            .score-description { font-size: 16px; color: ${scoreColor}; margin: 5px 0; }
            .score-badge { display: inline-block; width: 30px; height: 30px; line-height: 30px; text-align: center; border-radius: 50%; background-color: ${scoreColor}; color: white; font-size: 16px; font-weight: bold; margin-right: 10px; }
            .section { background-color: #faf6eb; padding: 15px; margin: 15px 0; border-radius: 8px; }
            .url { font-size: 12px; color: #7d6843; text-align: center; margin-bottom: 20px; word-break: break-all; }
            .date { text-align: center; font-size: 12px; color: #7d6843; margin-top: 10px; }
            .footer { text-align: center; margin-top: 30px; color: #7d6843; font-size: 12px; }
            .sources { list-style-type: none; padding-left: 20px; }
            .sources li { margin-bottom: 8px; position: relative; }
            .sources li:before { content: '•'; position: absolute; left: -15px; color: #854a11; }
            a { color: #854a11; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Pinocchio Report</h1>
            <p class="subtitle">Fact-Check Analysis</p>
            <p class="url">URL: ${currentUrl}</p>
            
            <div class="score-container">
              <h2>Misinformation Score</h2>
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
            <div class="footer">
              <p>✨ Generated by Pinocchio - The Wooden Truth Detective ✨</p>
              <p>Developed by: Adrian Maier, Dimeji Aiyesan, Ashton Grant</p>
              <p>&copy; 2023 Adrian Maier</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }
    
    function getPageContent() {
      // Get all text content from the page
      return document.body.innerText;
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
        
        // Create the report HTML
        const reportHtml = createReportHtml(currentAnalysisData, scoreNum);
        
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