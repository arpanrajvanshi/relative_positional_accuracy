import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MapComponent from './MapComponent';
import './App.css';

function App() {
  const [standardDeviationX, setStandardDeviationX] = useState(null);
  const [standardDeviationY, setStandardDeviationY] = useState(null);
  const [totalStandardDeviation, setTotalStandardDeviation] = useState(null);
  const [ce90, setCe90] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const [dataToSave, setDataToSave] = useState([]);
  const [file, setFile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [excludeOutliers, setExcludeOutliers] = useState(false);
  const [metrics, setMetrics] = useState({});

  const uploadFile = async () => {
    if (!file) {
      alert('Please select a points file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:3000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.error) {
        alert(response.data.error);
        return;
      }

      const createdAtDate = new Date(response.data.createdAt);
      setDataToSave(response.data.dataToSave);
      setCreatedAt(createdAtDate);

      setMetrics({
        standardDeviationX: response.data.allMetrics.stdDevX,
        standardDeviationY: response.data.allMetrics.stdDevY,
        totalStandardDeviation: response.data.allMetrics.totalStdDev,
        ce90: response.data.allMetrics.CE90,
        standardDeviationXNoOutliers: response.data.nonOutlierMetrics.stdDevX,
        standardDeviationYNoOutliers: response.data.nonOutlierMetrics.stdDevY,
        totalStandardDeviationNoOutliers: response.data.nonOutlierMetrics.totalStdDev,
        ce90NoOutliers: response.data.nonOutlierMetrics.CE90,
      });

      setStandardDeviationX(response.data.allMetrics.stdDevX);
      setStandardDeviationY(response.data.allMetrics.stdDevY);
      setTotalStandardDeviation(response.data.allMetrics.totalStdDev);
      setCe90(response.data.allMetrics.CE90);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file. Please check the server.');
    }
  };

  const fetchEntries = async (page = 1) => {
    try {
      const response = await axios.get(`http://localhost:3000/getEntries?page=${page}`);
      setEntries(response.data.entries);
      setCurrentPage(response.data.currentPage);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Error fetching entries:', error);
      alert('Error fetching entries from the database.');
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const openModal = async (entry) => {
    try {
      const response = await axios.get(`http://localhost:3000/getDistances/${entry.id}`);
      const distances = response.data;

      setModalData({
        distances,
        standardDeviationX: excludeOutliers
          ? entry.standard_deviation_x_no_outliers
          : entry.standard_deviation_x,
        standardDeviationY: excludeOutliers
          ? entry.standard_deviation_y_no_outliers
          : entry.standard_deviation_y,
        totalStandardDeviation: excludeOutliers
          ? entry.total_standard_deviation_no_outliers
          : entry.total_standard_deviation,
        ce90: excludeOutliers ? entry.ce90_no_outliers : entry.ce90,
        createdAt: new Date(entry.created_at),
        fileName: entry.file_name,
      });
      setShowModal(true);
    } catch (error) {
      console.error('Error fetching distances:', error);
      alert('Error fetching distances from the database.');
    }
  };

  const saveData = async () => {
    try {
      await axios.post('http://localhost:3000/save', {
        fileName: file.name,
        createdAt,
        allMetrics: {
          stdDevX: metrics.standardDeviationX,
          stdDevY: metrics.standardDeviationY,
          totalStdDev: metrics.totalStandardDeviation,
          CE90: metrics.ce90,
        },
        nonOutlierMetrics: {
          stdDevX: metrics.standardDeviationXNoOutliers,
          stdDevY: metrics.standardDeviationYNoOutliers,
          totalStdDev: metrics.totalStandardDeviationNoOutliers,
          CE90: metrics.ce90NoOutliers,
        },
        dataToSave,
      });

      alert('Data saved to database successfully.');
      fetchEntries();
    } catch (error) {
      console.error('Error saving data:', error);
      alert('Error saving data to the database.');
    }
  };

  const calculateMetrics = () => {
    if (excludeOutliers) {
      setStandardDeviationX(metrics.standardDeviationXNoOutliers);
      setStandardDeviationY(metrics.standardDeviationYNoOutliers);
      setTotalStandardDeviation(metrics.totalStandardDeviationNoOutliers);
      setCe90(metrics.ce90NoOutliers);
    } else {
      setStandardDeviationX(metrics.standardDeviationX);
      setStandardDeviationY(metrics.standardDeviationY);
      setTotalStandardDeviation(metrics.totalStandardDeviation);
      setCe90(metrics.ce90);
    }
  };

  useEffect(() => {
    calculateMetrics();
  }, [excludeOutliers]);

  return (
    <div className="App">
      <h1>Relative Positional Accuracy Measurement Tool</h1>

      <div className="main-content">
        <div className="left-panel">
          <div className="file-input-container">
            <label htmlFor="file">Points File:</label>
            <input
              id="file"
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
            />
            <span className="file-name">{file ? file.name : 'No file chosen'}</span>
          </div>

          <button className="upload-button" onClick={uploadFile}>
            Upload File
          </button>

          {dataToSave.length > 0 && (
            <div className="button-group">
              <button onClick={() => setExcludeOutliers(!excludeOutliers)}>
                {excludeOutliers ? 'Include Outliers' : 'Exclude Outliers'}
              </button>
            </div>
          )}

          {standardDeviationX != null && standardDeviationY != null && (
            <div className="metrics-display">
              <h3>Results:</h3>
              <p>
                Standard Deviation in X: {standardDeviationX?.toFixed(6) ?? 'N/A'} m
              </p>
              <p>
                Standard Deviation in Y: {standardDeviationY?.toFixed(6) ?? 'N/A'} m
              </p>
              <p>
                Total Standard Deviation: {totalStandardDeviation?.toFixed(6) ?? 'N/A'} m
              </p>
              <p>CE90: {ce90?.toFixed(6) ?? 'N/A'} m</p>
              <button className="save-button" onClick={saveData}>
                Save Results
              </button>
            </div>
          )}
        </div>

        {dataToSave.length > 0 && (
          <div className="right-panel">
            <div className="map-container">
              <MapComponent
                dataToSave={dataToSave}
                excludeOutliers={excludeOutliers}
              />
            </div>
          </div>
        )}
      </div>

      <h2>Uploaded Entries</h2>
      {entries.length > 0 ? (
        <div className="file-grid">
          <table>
            <thead>
              <tr>
                <th>Points File</th>
                <th>Created At</th>
                <th>Std Dev X (m)</th>
                <th>Std Dev Y (m)</th>
                <th>Total Std Dev (m)</th>
                <th>CE90 (m)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.file_name}</td>
                  <td>{new Date(entry.created_at).toLocaleString()}</td>
                  <td>{entry.standard_deviation_x.toFixed(6)}</td>
                  <td>{entry.standard_deviation_y.toFixed(6)}</td>
                  <td>{entry.total_standard_deviation.toFixed(6)}</td>
                  <td>{entry.ce90.toFixed(6)}</td>
                  <td>
                    <button onClick={() => openModal(entry)}>👁️ View</button>
                    <button onClick={() => window.location = `http://localhost:3000/downloadDistances/${entry.id}`}>
                      ⬇️ Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <button
              onClick={() => {
                if (currentPage > 1) {
                  fetchEntries(currentPage - 1);
                }
              }}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => {
                if (currentPage < totalPages) {
                  fetchEntries(currentPage + 1);
                }
              }}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <p>No entries found.</p>
      )}

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={() => setShowModal(false)}>
              &times;
            </span>
            <h2>Data Preview</h2>
            <p>Points File: {modalData.fileName}</p>
            <p>Created At: {new Date(modalData.createdAt).toLocaleString()}</p>
            <p>
              Standard Deviation in X:{' '}
              {modalData.standardDeviationX != null
                ? modalData.standardDeviationX.toFixed(6)
                : 'N/A'}{' '}
              m
            </p>
            <p>
              Standard Deviation in Y:{' '}
              {modalData.standardDeviationY != null
                ? modalData.standardDeviationY.toFixed(6)
                : 'N/A'}{' '}
              m
            </p>
            <p>
              Total Standard Deviation:{' '}
              {modalData.totalStandardDeviation != null
                ? modalData.totalStandardDeviation.toFixed(6)
                : 'N/A'}{' '}
              m
            </p>
            <p>
              CE90:{' '}
              {modalData.ce90 != null ? modalData.ce90.toFixed(6) : 'N/A'} m
            </p>
            <button onClick={() => setExcludeOutliers(!excludeOutliers)}>
              {excludeOutliers ? 'Include Outliers' : 'Exclude Outliers'}
            </button>
            <table>
              <thead>
                <tr>
                  <th>Point i</th>
                  <th>Latitude i</th>
                  <th>Longitude i</th>
                  <th>Point j</th>
                  <th>Latitude j</th>
                  <th>Longitude j</th>
                  <th>Delta X (m)</th>
                  <th>Delta Y (m)</th>
                  <th>Distance (m)</th>
                </tr>
              </thead>
              <tbody>
                {modalData.distances &&
                  modalData.distances.map((row, idx) => {
                    if (excludeOutliers && row.is_outlier) return null;
                    return (
                      <tr
                        key={idx}
                        style={{
                          backgroundColor: row.is_outlier ? 'yellow' : 'transparent',
                        }}
                      >
                        <td>{row.point_i}</td>
                        <td>{row.lat_i}</td>
                        <td>{row.lon_i}</td>
                        <td>{row.point_j}</td>
                        <td>{row.lat_j}</td>
                        <td>{row.lon_j}</td>
                        <td>{row.delta_x?.toFixed(6) ?? 'N/A'}</td>
                        <td>{row.delta_y?.toFixed(6) ?? 'N/A'}</td>
                        <td>{row.distance?.toFixed(6) ?? 'N/A'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
