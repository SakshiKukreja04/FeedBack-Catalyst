from flask import Flask, request, send_file, jsonify, send_from_directory, url_for
from flask_cors import CORS
import os, pandas as pd
from feedback_processor import process_feedback, process_for_charts
import matplotlib.pyplot as plt
import re
from pymongo import MongoClient
import gridfs
from io import BytesIO
import tempfile
import zipfile

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})

# MongoDB setup
client = MongoClient('mongodb://localhost:27017/')
db = client['feedback_db']
files_collection = db['files']
charts_collection = db['charts']
fs_files = gridfs.GridFS(db, collection='files')
fs_charts = gridfs.GridFS(db, collection='charts')

def sanitize_filename(name):
    return re.sub(r'[^A-Za-z0-9_]+', '_', name)

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    try:
        file_content = file.read()
        file_id = fs_files.put(
            file_content,
            filename=file.filename,
            content_type=file.content_type
        )
        files_collection.insert_one({
            'file_id': file_id,
            'filename': file.filename,
            'content_type': file.content_type,
            'size': len(file_content)
        })
        return jsonify({"filename": file.filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/headers/<filename>', methods=['GET'])
def get_headers(filename):
    try:
        file_doc = fs_files.find_one({"filename": filename})
        if not file_doc:
            return jsonify({"error": "File not found"}), 404

        file_content = file_doc.read()
        if filename.lower().endswith('.csv'):
            df = pd.read_csv(BytesIO(file_content))
        else:
            df = pd.read_excel(BytesIO(file_content))

        return jsonify({"headers": list(df.columns)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/generate-report', methods=['POST'])
def generate_report():
    files = request.files.getlist('file')
    choice = request.form.get('choice')
    feedback_type = request.form.get('feedbackType', 'stakeholder')
    report_type = request.form.get('reportType', 'generalized')

    if not files or not choice:
        return jsonify({"error": "Missing file(s) or choice"}), 400

    if choice not in ['1', '2'] or feedback_type not in ['stakeholder', 'subject']:
        return jsonify({"error": "Invalid parameters"}), 400

    try:
        zip_stream = BytesIO()
        with zipfile.ZipFile(zip_stream, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file in files:
                buffer = process_feedback(
                    file_bytes=file.stream,
                    filename=file.filename,
                    choice=choice,
                    feedback_type=feedback_type,
                    uploaded_filename=os.path.splitext(file.filename)[0],
                    report_type=report_type
                )
                zipf.writestr(f"{os.path.splitext(file.filename)[0]}.pdf", buffer.getvalue())
        zip_stream.seek(0)
        return send_file(zip_stream, as_attachment=True, download_name='feedback_reports.zip', mimetype='application/zip')
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/generate-charts', methods=['POST'])
def generate_charts():
    files = request.files.getlist('file')
    choice = request.form.get('choice')
    feedback_type = request.form.get('feedbackType', 'stakeholder')
    report_type = request.form.get('reportType', 'generalized')

    if not files or not choice:
        return jsonify({"error": "Missing file(s) or choice"}), 400

    chart_urls = []
    try:
        for file in files:
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp_file:
                tmp_file_path = tmp_file.name
                file.save(tmp_file_path)

            chart_filenames = process_for_charts(tmp_file_path, choice, feedback_type, os.path.splitext(file.filename)[0], report_type)
            os.unlink(tmp_file_path)
            chart_urls.extend([
                url_for('get_chart', filename=filename, _external=True)
                for filename in chart_filenames
            ])

        return jsonify({"chart_urls": chart_urls, "total_charts": len(chart_urls)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/charts/<filename>')
def get_chart(filename):
    try:
        chart_doc = fs_charts.find_one({"filename": filename})
        if not chart_doc:
            return jsonify({"error": "Chart not found"}), 404

        return send_file(BytesIO(chart_doc.read()), mimetype='image/png', as_attachment=False)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5001, debug=True)
