import os
import sqlite3
import uuid
import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get paths from environment variables or use defaults
DATABASE_PATH = os.getenv('DATABASE_PATH', 'reports.db')
REPORTS_DIR = os.getenv('REPORTS_DIR', 'reports')

# Ensure paths are absolute
if not os.path.isabs(DATABASE_PATH):
    DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), DATABASE_PATH)
    
if not os.path.isabs(REPORTS_DIR):
    REPORTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), REPORTS_DIR)

# Ensure directories exist
if not os.path.exists(os.path.dirname(DATABASE_PATH)):
    os.makedirs(os.path.dirname(DATABASE_PATH))
    
if not os.path.exists(REPORTS_DIR):
    os.makedirs(REPORTS_DIR)

class ReportDatabase:
    def __init__(self, db_path=None):
        """Initialize the database connection."""
        self.db_path = db_path or DATABASE_PATH
        self.reports_dir = REPORTS_DIR  # Add this line to store REPORTS_DIR
        self.init_db()
    
    @property
    def REPORTS_DIR(self):
        """Property to access reports directory."""
        return self.reports_dir
        
    def get_connection(self):
        """Get a database connection."""
        return sqlite3.connect(self.db_path)
        
    def init_db(self):
        """Initialize the database schema if it doesn't exist."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Create reports table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            timestamp TEXT,
            url TEXT,
            title TEXT,
            score REAL,
            file_path TEXT
        )
        ''')
        
        conn.commit()
        conn.close()
        
    def save_report(self, url, title, score, html_content):
        """
        Save a report to the database and file system.
        
        Args:
            url: The URL of the analyzed page
            title: The title of the page
            score: The misinformation score (0-10)
            html_content: HTML content of the report
            
        Returns:
            dict: Report information including ID
        """
        # Generate unique ID for the report
        report_id = str(uuid.uuid4())
        timestamp = datetime.datetime.now().isoformat()
        
        # Create the file name and save the HTML
        file_name = f"report_{report_id}.html"
        file_path = os.path.join(REPORTS_DIR, file_name)
        
        # Save HTML file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        # Save record to database
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO reports (id, timestamp, url, title, score, file_path) VALUES (?, ?, ?, ?, ?, ?)",
            (report_id, timestamp, url, title, score, file_path)
        )
        conn.commit()
        conn.close()
        
        return {
            "report_id": report_id,
            "timestamp": timestamp,
            "file_path": file_path
        }
        
    def get_report(self, report_id):
        """Get a report by ID."""
        conn = self.get_connection()
        conn.row_factory = sqlite3.Row  # Return rows as dictionaries
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
        report = cursor.fetchone()
        conn.close()
        
        if report:
            return dict(report)
        return None
        
    def get_reports(self, limit=100, offset=0):
        """Get a list of reports."""
        conn = self.get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM reports ORDER BY timestamp DESC LIMIT ? OFFSET ?", 
            (limit, offset)
        )
        reports = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return reports
        
    def get_report_html(self, report_id):
        """Get the HTML content of a report."""
        report = self.get_report(report_id)
        if report and os.path.exists(report['file_path']):
            with open(report['file_path'], 'r', encoding='utf-8') as f:
                return f.read()
        return None
        
    def delete_report(self, report_id):
        """Delete a report and its file."""
        report = self.get_report(report_id)
        if not report:
            return False
            
        # Delete the file if it exists
        if os.path.exists(report['file_path']):
            os.remove(report['file_path'])
            
        # Delete from database
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM reports WHERE id = ?", (report_id,))
        conn.commit()
        conn.close()
        
        return True
