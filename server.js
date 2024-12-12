// server.js

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const math = require('mathjs'); // Used for statistical calculations

const app = express();

// PostgreSQL setup
const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'new_relative1',
  password: '6398', // Replace with your actual database password
  port: 5432,
});

client.connect((err) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Database connected');
  }
});

app.use(cors());
//app.use(express.json());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'frontend/build')));

const upload = multer({ dest: 'uploads/' });

// Function to calculate distance between two lat/long points using the Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180; // Convert latitude to radians
  const φ2 = (lat2 * Math.PI) / 180; // Convert latitude to radians
  const Δφ = ((lat2 - lat1) * Math.PI) / 180; // Difference in latitude
  const Δλ = ((lon2 - lon1) * Math.PI) / 180; // Difference in longitude

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distance in meters
  return distance;
};

// API to upload Excel file and calculate distances between all unique pairs of points
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Received file:', req.file);
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Please upload a file.' });
    }

    const filePath = file.path;

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const data = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

    // Remove uploaded file after processing
    fs.unlinkSync(filePath);

    const points = [];

    // Extract valid points
    data.forEach((row, index) => {
      const lat = parseFloat(row['Latitude'] || row['lat']);
      const lon = parseFloat(row['Longitude'] || row['lon']);

      if (
        !isNaN(lat) && !isNaN(lon) &&
        lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
      ) {
        points.push({ index: index + 1, lat, lon });
      } else {
        console.error(`Invalid data at index ${index}: lat=${lat}, lon=${lon}`);
      }
    });

    if (points.length < 2) {
      return res.status(400).json({ error: 'Not enough valid data points found in the uploaded file.' });
    }

    const dataToSave = [];
    const deltaXs = [];
    const deltaYs = [];
    const distances = [];
/*
    // Calculate differences and distances between all unique pairs
    for (let i = 0; i < points.length - 1; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const pointA = points[i];
        const pointB = points[j];

        const deltaX = pointB.lat - pointA.lat; // Difference in latitude
        const deltaY = pointB.lon - pointA.lon; // Difference in longitude

        const distance = calculateDistance(pointA.lat, pointA.lon, pointB.lat, pointB.lon);

        deltaXs.push(deltaX);
        deltaYs.push(deltaY);
        distances.push(distance);

        dataToSave.push({
          point_i: pointA.index,
          lat_i: pointA.lat,
          lon_i: pointA.lon,
          point_j: pointB.index,
          lat_j: pointB.lat,
          lon_j: pointB.lon,
          deltaX,
          deltaY,
          distance,
        });
      }
    }
*/// Calculate differences and distances between all unique pairs
for (let i = 0; i < points.length - 1; i++) {
  for (let j = i + 1; j < points.length; j++) {
    const pointA = points[i];
    const pointB = points[j];

    const φ1 = (pointA.lat * Math.PI) / 180; // Convert latitude to radians
    const φ2 = (pointB.lat * Math.PI) / 180; // Convert latitude to radians
    const Δφ = ((pointB.lat - pointA.lat) * Math.PI) / 180; // Difference in latitude in radians
    const Δλ = ((pointB.lon - pointA.lon) * Math.PI) / 180; // Difference in longitude in radians
    const avgLat = (φ1 + φ2) / 2;

    // Calculate deltaX and deltaY in meters
    const deltaX = 6371e3 * Δλ * Math.cos(avgLat); // X is longitude difference projected on Earth's surface
    const deltaY = 6371e3 * Δφ; // Y is latitude difference projected on Earth's surface

    const distance = calculateDistance(pointA.lat, pointA.lon, pointB.lat, pointB.lon);

    deltaXs.push(deltaX);
    deltaYs.push(deltaY);
    distances.push(distance);

    dataToSave.push({
      point_i: pointA.index,
      lat_i: pointA.lat,
      lon_i: pointA.lon,
      point_j: pointB.index,
      lat_j: pointB.lat,
      lon_j: pointB.lon,
      deltaX,
      deltaY,
      distance,
    });
  }
}

    // Outlier detection on distances
    const sortedDistances = distances.slice().sort((a, b) => a - b);
    const Q1 = math.quantileSeq(sortedDistances, 0.25, false);
    const Q3 = math.quantileSeq(sortedDistances, 0.75, false);
    const IQR = Q3 - Q1;
    const lowerBound = Q1 - 1.5 * IQR;
    const upperBound = Q3 + 1.5 * IQR;

    // Identify outliers and add isOutlier flag
    for (let i = 0; i < dataToSave.length; i++) {
      const distance = dataToSave[i].distance;
      const isOutlier = distance < lowerBound || distance > upperBound;
      dataToSave[i].isOutlier = isOutlier;
    }

    // Calculations including all differences
    const meanDeltaX = deltaXs.reduce((sum, dx) => sum + dx, 0) / deltaXs.length;
    const varianceDeltaX = deltaXs.reduce((sum, dx) => sum + Math.pow(dx - meanDeltaX, 2), 0) / (deltaXs.length - 1);
    const stdDevX = Math.sqrt(varianceDeltaX);

    const meanDeltaY = deltaYs.reduce((sum, dy) => sum + dy, 0) / deltaYs.length;
    const varianceDeltaY = deltaYs.reduce((sum, dy) => sum + Math.pow(dy - meanDeltaY, 2), 0) / (deltaYs.length - 1);
    const stdDevY = Math.sqrt(varianceDeltaY);

    const totalStdDev = Math.sqrt(stdDevX ** 2 + stdDevY ** 2);

    const CE90 = 2.146 * totalStdDev;

    // Calculations excluding outliers
    const deltaXsNoOutliers = dataToSave.filter(d => !d.isOutlier).map(d => d.deltaX);
    const deltaYsNoOutliers = dataToSave.filter(d => !d.isOutlier).map(d => d.deltaY);

    const meanDeltaXNoOutliers = deltaXsNoOutliers.reduce((sum, dx) => sum + dx, 0) / deltaXsNoOutliers.length;
    const varianceDeltaXNoOutliers = deltaXsNoOutliers.reduce((sum, dx) => sum + Math.pow(dx - meanDeltaXNoOutliers, 2), 0) / (deltaXsNoOutliers.length - 1);
    const stdDevXNoOutliers = Math.sqrt(varianceDeltaXNoOutliers);

    const meanDeltaYNoOutliers = deltaYsNoOutliers.reduce((sum, dy) => sum + dy, 0) / deltaYsNoOutliers.length;
    const varianceDeltaYNoOutliers = deltaYsNoOutliers.reduce((sum, dy) => sum + Math.pow(dy - meanDeltaYNoOutliers, 2), 0) / (deltaYsNoOutliers.length - 1);
    const stdDevYNoOutliers = Math.sqrt(varianceDeltaYNoOutliers);

    const totalStdDevNoOutliers = Math.sqrt(stdDevXNoOutliers ** 2 + stdDevYNoOutliers ** 2);

    const CE90NoOutliers = 2.146 * totalStdDevNoOutliers;

    // Prepare metrics
    const allMetrics = {
      stdDevX,
      stdDevY,
      totalStdDev,
      CE90,
    };

    const nonOutlierMetrics = {
      stdDevX: stdDevXNoOutliers,
      stdDevY: stdDevYNoOutliers,
      totalStdDev: totalStdDevNoOutliers,
      CE90: CE90NoOutliers,
    };

    const createdAt = new Date().toISOString();

    res.json({
      allMetrics,
      nonOutlierMetrics,
      dataToSave,
      createdAt,
    });

  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: 'Server error while processing file.' });
  }
});

// Endpoint to save data to the database
app.post('/save', async (req, res) => {
  const {
    fileName,
    createdAt,
    allMetrics,
    nonOutlierMetrics,
    dataToSave,
  } = req.body;

  try {
    // Insert into entries table
    const insertEntryQuery = `
      INSERT INTO entries (
        file_name,
        created_at,
        standard_deviation_x,
        standard_deviation_y,
        total_standard_deviation,
        ce90,
        standard_deviation_x_no_outliers,
        standard_deviation_y_no_outliers,
        total_standard_deviation_no_outliers,
        ce90_no_outliers
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;
    const entryResult = await client.query(insertEntryQuery, [
      fileName,
      createdAt,
      allMetrics.stdDevX,
      allMetrics.stdDevY,
      allMetrics.totalStdDev,
      allMetrics.CE90,
      nonOutlierMetrics.stdDevX,
      nonOutlierMetrics.stdDevY,
      nonOutlierMetrics.totalStdDev,
      nonOutlierMetrics.CE90,
    ]);
    const entryId = entryResult.rows[0].id;

    // Insert distances into distances table
    const insertDistanceQuery = `
      INSERT INTO distances (entry_id, point_i, lat_i, lon_i, point_j, lat_j, lon_j, delta_x, delta_y, distance, is_outlier)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    for (let i = 0; i < dataToSave.length; i++) {
      const d = dataToSave[i];
      await client.query(insertDistanceQuery, [
        entryId,
        d.point_i,
        d.lat_i,
        d.lon_i,
        d.point_j,
        d.lat_j,
        d.lon_j,
        d.deltaX,
        d.deltaY,
        d.distance,
        d.isOutlier,
      ]);
    }

    res.status(200).json({ message: 'Data saved successfully.' });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ error: 'Failed to save data to the database.' });
  }
});

// Endpoint to retrieve entries (for grid functionality)
app.get('/getEntries', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10; // Entries per page
  const offset = (page - 1) * limit;

  try {
    const totalEntriesResult = await client.query('SELECT COUNT(*) FROM entries');
    const totalEntries = parseInt(totalEntriesResult.rows[0].count);
    const totalPages = Math.ceil(totalEntries / limit);

    const entriesResult = await client.query(
      'SELECT * FROM entries ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({
      entries: entriesResult.rows,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ error: 'Failed to fetch entries.' });
  }
});

// Endpoint to retrieve distances for a specific entry
app.get('/getDistances/:entryId', async (req, res) => {
  const entryId = req.params.entryId;

  try {
    const distancesResult = await client.query(
      'SELECT * FROM distances WHERE entry_id = $1 ORDER BY point_i, point_j',
      [entryId]
    );

    res.json(distancesResult.rows);
  } catch (error) {
    console.error('Error fetching distances:', error);
    res.status(500).json({ error: 'Failed to fetch distances.' });
  }
});

// Endpoint to download distances as CSV
app.get('/downloadDistances/:entryId', async (req, res) => {
  const entryId = req.params.entryId;

  try {
    const distancesResult = await client.query(
      'SELECT * FROM distances WHERE entry_id = $1 ORDER BY point_i, point_j',
      [entryId]
    );

    const distances = distancesResult.rows;

    if (distances.length === 0) {
      return res.status(404).json({ error: 'No distances found for this entry.' });
    }

    const csvContent = [
      ['Point_i', 'Latitude_i', 'Longitude_i', 'Point_j', 'Latitude_j', 'Longitude_j', 'Delta_X', 'Delta_Y', 'Distance_m', 'Is_Outlier'],
      ...distances.map(d => [
        d.point_i,
        d.lat_i,
        d.lon_i,
        d.point_j,
        d.lat_j,
        d.lon_j,
        d.delta_x,
        d.delta_y,
        d.distance,
        d.is_outlier,
      ]),
    ].map(e => e.join(',')).join('\n');

    res.setHeader('Content-disposition', 'attachment; filename=distances.csv');
    res.set('Content-Type', 'text/csv');
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error downloading distances:', error);
    res.status(500).json({ error: 'Failed to download distances.' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
