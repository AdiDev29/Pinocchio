# Pinocchio - The Wooden Truth Detective

<p align="center">
  <img src="extension/images/icon128.png" alt="Pinocchio Logo" width="128" height="128">
</p>

<p align="center">
  <strong>A browser extension to detect misinformation across the web</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#backend-setup">Backend Setup</a> •
  <a href="#development">Development</a> •
  <a href="#license">License</a>
</p>

## Features

Pinocchio is a powerful browser extension that helps users navigate the complex landscape of online information by:

- **Analyzing web content** for potential misinformation using AI
- **Providing reliability scores** from 0-10 (with Pinocchio's nose growing accordingly!)
- **Generating comprehensive reports** with context and verified sources
- **Creating a database** of all analyzed pages for historical reference
- **Supporting sharing** of fact-check results

## Installation

### Chrome Extension

1. Download the extension ZIP file from our [website](http://172.105.18.148:8080/static/files/extension.zip)
2. Unzip/extract the downloaded file to a location on your computer
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer Mode" in the top-right corner
5. Click "Load unpacked" and select the extracted extension folder
6. The Pinocchio icon should now appear in your browser toolbar

### Server Setup

The extension requires the backend server to be running:

1. Set up the server as described in the [Backend Setup](#backend-setup) section
2. The extension is configured to connect to `http://172.105.18.148:8080` by default
3. To use a different server address, modify `popup.js` and `manifest.json` accordingly

## How It Works

1. **Installation**: Add the Pinocchio extension to your browser.
2. **Browse & Analyze**: When visiting a webpage, click the Pinocchio icon to analyze the content.
3. **Review Results**: Get instant feedback with:
   - A misinformation score (0-10)
   - Visual indication via Pinocchio's growing nose
   - A detailed report explaining potential issues
   - Links to verified sources
   - Additional context about the topic
4. **Download Reports**: Save detailed HTML reports for future reference.
5. **Access Dashboard**: Visit the report dashboard to view all previously analyzed pages.

## Backend Setup

The backend server uses Flask with Google's Gemini AI for content analysis:

### Prerequisites

- Python 3.8+
- Google Gemini API key
- SQLite (included with Python)

### Environment Setup

1. Create a `.env` file in the `backend` directory with:

```
GEMINI_API_KEY=your_gemini_api_key
DATABASE_PATH=reports.db
REPORTS_DIR=reports
```

2. Install dependencies:

```bash
cd backend
pip install flask flask-cors google-generativeai python-dotenv
```

3. Start the server:

```bash
python app.py
```

The server will run at `http://127.0.0.1:8080` by default.

## Project Structure

```
Pinocchio/
├── extension/             # Chrome extension files
│   ├── images/            # Extension icons and images
│   ├── libs/              # JavaScript libraries
│   ├── background.js      # Extension background script
│   ├── content.js         # Content script for web pages
│   ├── manifest.json      # Extension manifest
│   ├── popup.html         # Extension popup UI
│   ├── popup.js           # Extension popup logic
│   └── styles.css         # Extension styling
│
├── backend/               # Server-side code
│   ├── reports/           # Stored HTML reports
│   ├── static/            # Static assets for web UI
│   ├── templates/         # HTML templates
│   │   ├── index.html     # Homepage template
│   │   └── reports.html   # Reports dashboard template
│   ├── app.py             # Flask application
│   ├── db_service.py      # Database operations
│   └── gemini_service.py  # Gemini AI integration
│
└── README.md              # This file
```

## Development

### Extension Development

1. Make changes to the extension files in the `extension` directory
2. Reload the extension in Chrome (`chrome://extensions/` and click the refresh icon)

### Backend Development

1. Make changes to the server files in the `backend` directory
2. Restart the Flask server to apply changes

### API Endpoints

- `POST /api/analyze`: Analyze webpage content for misinformation
- `POST /api/reports`: Save a new report to the database
- `GET /api/reports`: Retrieve list of all reports
- `GET /api/reports/{id}`: Get specific report data
- `GET /api/reports/{id}/html`: Get HTML content of a specific report

## Contributors

- Adrian Maier
- Dimeji Aiyesan
- Ashton Grant

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Inspired by the classic tale of Pinocchio, whose nose grows when he tells lies
- Powered by Google's Gemini AI for content analysis
- Built with Flask, SQLite, Gemini, and Chrome Extension APIs
