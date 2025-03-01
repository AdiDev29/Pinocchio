from flask import Flask, request, jsonify, send_from_directory, render_template, redirect, url_for
from flask_cors import CORS
import os
import traceback
from gemini_service import analyze_website_content
from db_service import ReportDatabase
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# The static folder path should be absolute to ensure it finds the correct directory
app = Flask(__name__, static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static'))
CORS(app)  # Enable CORS for all routes

# Initialize database service
db = ReportDatabase()

@app.route('/api/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        if not data or 'url' not in data or 'content' not in data:
            return jsonify({"error": "Missing required parameters. Please provide 'url' and 'content'."}), 400

        url = data['url']
        content = data['content']

        try:
            result = analyze_website_content(url, content)
            return jsonify(result)
        except Exception as e:
            print(f"Error in analyze_website_content: {str(e)}")
            print(traceback.format_exc())
            return jsonify({
                "error": f"Server error analyzing content: {str(e)}",
                "summary": "Could not analyze the content",
                "misinformation_detected": None,
                "misinformation_score": 5,  # Neutral score
                "report": "The system encountered an error while analyzing this content. Please try again later.",
                "additional_context": "Error processing the content",
                "sources": []
            }), 500
    except Exception as e:
        print(f"Server error: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/reports', methods=['POST'])
def save_report():
    try:
        data = request.json
        if not data or 'url' not in data or 'title' not in data or 'score' not in data or 'html' not in data:
            return jsonify({
                "error": "Missing required parameters. Please provide 'url', 'title', 'score', and 'html'."
            }), 400

        url = data['url']
        title = data['title']
        score = data['score']
        html_content = data['html']
        
        # Use the database service to save the report
        result = db.save_report(url, title, score, html_content)
        
        return jsonify({
            "success": True,
            "report_id": result["report_id"],
            "message": "Report saved successfully"
        })
    except Exception as e:
        print(f"Error saving report: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/reports', methods=['GET'])
def list_reports():
    """Get a list of all reports"""
    try:
        limit = request.args.get('limit', default=100, type=int)
        offset = request.args.get('offset', default=0, type=int)
        reports = db.get_reports(limit, offset)
        return jsonify({"reports": reports})
    except Exception as e:
        print(f"Error retrieving reports: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/reports/<report_id>', methods=['GET'])
def get_report(report_id):
    """Get a specific report by ID"""
    try:
        report = db.get_report(report_id)
        if not report:
            return jsonify({"error": "Report not found"}), 404
        return jsonify(report)
    except Exception as e:
        print(f"Error retrieving report: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/reports/<report_id>/html', methods=['GET'])
def get_report_html(report_id):
    """Get the HTML content of a report"""
    try:
        html = db.get_report_html(report_id)
        if not html:
            return jsonify({"error": "Report not found"}), 404
        return html, 200, {'Content-Type': 'text/html'}
    except Exception as e:
        print(f"Error retrieving report HTML: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/reports/<path:filename>')
def serve_report(filename):
    """Serve static report files"""
    # Make sure we're using the correct reports directory
    try:
        return send_from_directory(db.reports_dir, filename)
    except Exception as e:
        print(f"Error serving report file: {str(e)}")
        return jsonify({"error": f"Error serving file: {str(e)}"}), 500

@app.route('/reports')
def reports_page():
    """Render the reports dashboard page"""
    return render_template('reports.html')

@app.route('/reports/test')
def test_reports_api():
    """Test endpoint to verify API functionality"""
    try:
        reports_count = len(db.get_reports(limit=100))
        return jsonify({
            "status": "success",
            "message": f"API is working. Found {reports_count} reports in database.",
            "database_path": db.db_path,
            "reports_dir": db.reports_dir  # Use reports_dir instead of REPORTS_DIR
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error: {str(e)}",
            "traceback": traceback.format_exc()
        }), 500

@app.route('/')
def index():
    """Serve the homepage"""
    return render_template('index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)