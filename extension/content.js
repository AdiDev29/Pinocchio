// This content script is injected into web pages
console.log("Pinocchio extension loaded");

// Listen for messages from background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // If we need to get selected text on demand (not used right now but might be needed)
    if (request.action === "getSelectedText") {
        const selection = window.getSelection().toString();
        sendResponse({text: selection});
    }
    return true;
});