// Background script for handling events that happen when the extension is not open

// Listen for installation
chrome.runtime.onInstalled.addListener(function() {
    console.log("Pinocchio extension has been installed");
  });
  
  // We're using the default popup, so we don't need to add any action listeners here
  // But we could add functionality in the future, such as:
  // - Badge notifications
  // - Context menu options
  // - Background processing