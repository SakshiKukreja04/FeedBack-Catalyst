import React, { useState, useRef } from 'react';
import './Report.css';

const Report = () => {
  const fileInputRef = useRef(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fileHeaders, setFileHeaders] = useState([]);
  const [uploadedFilename, setUploadedFilename] = useState('');
  const [feedbackType, setFeedbackType] = useState('stakeholder');
  const [reportType, setReportType] = useState('generalized');
  const [chartUrls, setChartUrls] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleFeedbackTypeChange = (type) => {
    setFeedbackType(type);
    setFileHeaders([]);
    setUploadedFilename('');
    setUploadStatus(null);
    setChartUrls([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setChartUrls([]);
    setIsUploading(true);
    setUploadStatus({ type: 'loading', message: 'Uploading files...' });

    try {
      const formData = new FormData();
      for (let file of files) {
        const validTypes = ['.csv', '.xlsx'];
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!validTypes.includes(fileExtension)) throw new Error('Only .csv or .xlsx allowed');
        if (file.size > 5 * 1024 * 1024) throw new Error('Each file must be < 5MB');
        formData.append('file', file);
      }

      const uploadResponse = await fetch('http://localhost:5001/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed (Status: ${uploadResponse.status}): ${errorText}`);
      }

      const uploadData = await uploadResponse.json();
      setUploadedFilename(files[0].name);
      setFileHeaders(['uploaded']); // dummy to enable generate buttons
      setUploadStatus({ type: 'success', message: 'Files uploaded successfully!' });

    } catch (error) {
      setUploadStatus({ type: 'error', message: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!fileInputRef.current.files.length) return;

    setIsGenerating(true);
    setChartUrls([]);
    setUploadStatus({ type: 'loading', message: 'Generating report(s)...' });

    try {
      const formData = new FormData();
      Array.from(fileInputRef.current.files).forEach((file) => formData.append('file', file));
      formData.append('choice', reportType === 'fieldwise' ? "2" : "1");
      formData.append('feedbackType', feedbackType);
      formData.append('uploadedFilename', uploadedFilename.replace(/\.[^/.]+$/, ""));
      formData.append('reportType', reportType);

      const response = await fetch('http://localhost:5001/generate-report', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate report (Status: ${response.status}): ${errorText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Feedback_Reports.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setUploadStatus({ type: 'success', message: '✅ Reports generated and downloaded.' });

    } catch (error) {
      setUploadStatus({ type: 'error', message: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewCharts = async (e) => {
    e.preventDefault();
    if (!fileInputRef.current.files.length) return;

    setIsGenerating(true);
    setChartUrls([]);
    setUploadStatus({ type: 'loading', message: 'Generating charts...' });

    try {
      const formData = new FormData();
      Array.from(fileInputRef.current.files).forEach((file) => formData.append('file', file));
      formData.append('choice', reportType === 'fieldwise' ? "2" : "1");
      formData.append('feedbackType', feedbackType);
      formData.append('uploadedFilename', uploadedFilename.replace(/\.[^/.]+$/, ""));
      formData.append('reportType', reportType);

      const response = await fetch('http://localhost:5001/generate-charts', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate charts (Status: ${response.status}): ${errorText}`);
      }

      const data = await response.json();
      setChartUrls(data.chart_urls);
      setUploadStatus({ type: 'success', message: 'Charts generated successfully!' });

    } catch (error) {
      setUploadStatus({ type: 'error', message: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="report-container">
      <div className="report-header">
        <h1>Generate PDF Report or View Charts</h1>
        <p>Upload your dataset and create insightful reports and visualizations</p>
      </div>

      <div className="step-section">
        <h2>Step 1: Select Feedback Type</h2>
        <div className="feedback-type-selection">
          <label className="feedback-type-option">
            <input
              type="radio"
              name="feedbackType"
              value="stakeholder"
              checked={feedbackType === 'stakeholder'}
              onChange={() => handleFeedbackTypeChange('stakeholder')}
            />
            Stakeholder Feedback
          </label>
          <label className="feedback-type-option">
            <input
              type="radio"
              name="feedbackType"
              value="subject"
              checked={feedbackType === 'subject'}
              onChange={() => handleFeedbackTypeChange('subject')}
            />
            Subject Feedback
          </label>
        </div>
      </div>

      <div className="step-section">
        <h2>Step 2: Upload Files</h2>
        <div className="upload-section">
          <button
            className="btn-primary upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isGenerating}
          >
            {isUploading ? 'Uploading...' : 'Choose Folder'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.xlsx"
            style={{ display: 'none' }}
            multiple
            webkitdirectory="true"
            directory="true"
          />
          <p className="file-types">Upload a folder containing .csv/.xlsx files (max 5MB each)</p>
          {uploadStatus && (
            <p className={`upload-status ${uploadStatus.type}`}>
              {uploadStatus.message}
            </p>
          )}
          {(isUploading || isGenerating) && <div className="loader"></div>}
        </div>
      </div>

      {fileHeaders.length > 0 && feedbackType === 'stakeholder' && (
        <div className="step-section">
          <h2>Step 3: Choose Report Type</h2>
          <div className="report-type-selection">
            <label className="report-type-option">
              <input
                type="radio"
                name="reportType"
                value="generalized"
                checked={reportType === 'generalized'}
                onChange={() => setReportType('generalized')}
              />
              Generalized Report
            </label>
            <label className="report-type-option">
              <input
                type="radio"
                name="reportType"
                value="fieldwise"
                checked={reportType === 'fieldwise'}
                onChange={() => setReportType('fieldwise')}
              />
              Field-Wise Report
            </label>
          </div>
        </div>
      )}

      {fileHeaders.length > 0 && (
        <div className="step-section">
          <h2>Step {feedbackType === 'stakeholder' ? '4' : '3'}: Generate Output</h2>
          <div className="generate-buttons">
            <button className="btn-generate" onClick={handleGenerate} disabled={isGenerating}>
              Get PDF Report
            </button>
            <button className="btn-secondary" onClick={handleViewCharts} disabled={isGenerating}>
              View Charts
            </button>
          </div>
        </div>
      )}

      {chartUrls.length > 0 && (
        <div className="step-section">
          <h2>Generated Charts</h2>
          <div className="charts-container">
            {chartUrls.map((url, index) => (
              <div key={index} className="chart-item">
                <img src={url} alt={`Chart ${index + 1}`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Report;
