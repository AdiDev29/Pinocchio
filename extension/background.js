// Background script for handling events that happen when the extension is not open

// Listen for installation
chrome.runtime.onInstalled.addListener(function () {
	console.log("Pinocchio extension has been installed");

	// Create context menu item with icon
	chrome.contextMenus.create({
		id: "checkSelectedText",
		title: "Fact-check with Pinocchio",
		contexts: ["selection"],
		icons: {
			"16": "images/icon16.png",
			"32": "images/icon48.png"  // Will be scaled down if needed
		}
	});
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
	if (info.menuItemId === "checkSelectedText" && info.selectionText) {
		console.log("Selected text for fact-checking:", info.selectionText);

		// Format the selected text
		const selectedText = info.selectionText.trim();
		const formattedContent = `# Selected Text from ${tab.title}\n\n` +
			`Source: ${tab.url}\n\n` +
			`## Content\n\n${selectedText}`;

		// Forward to popup with source text
		chrome.runtime.sendMessage({
			action: 'processContent',
			content: formattedContent,
			source: 'selection',
			format: 'text'
		});

		// Try to open the popup
		try {
			chrome.action.openPopup();
		} catch (e) {
			console.error("Error opening popup:", e);

			// If popup can't open directly, send the text to be analyzed
			analyzeSelectedText(selectedText, tab);
		}
	}
});

// Function to analyze selected text when popup can't be opened
function analyzeSelectedText(text, tab) {
	fetch('http://172.105.18.148:8080/api/analyze', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			content: text,
			url: tab.url,
			title: `Selected text from: ${tab.title}`,
			type: 'text'
		})
	})
		.then(response => {
			if (!response.ok) {
				throw new Error(`Server responded with status: ${response.status}`);
			}
			return response.json();
		})
		.then(data => {
			console.log("Analysis complete, storing results:", data);

			// Cache the result with a special key for this selection
			const selectionKey = `selection_${Date.now()}`;
			try {
				chrome.storage.local.set({ [selectionKey]: data }, function () {
					console.log('Cached analysis result for selected text');

					// Create a notification to let the user know analysis is complete
					chrome.notifications.create({
						type: 'basic',
						iconUrl: 'images/icon128.png',
						title: 'Analysis Complete',
						message: `Misinformation score: ${data.misinformation_score}/10. Click the Pinocchio icon to view full results.`
					});
				});
			} catch (error) {
				console.error("Error caching result:", error);
			}
		})
		.catch(error => {
			console.error("Selected text analysis error:", error);
		});
}

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