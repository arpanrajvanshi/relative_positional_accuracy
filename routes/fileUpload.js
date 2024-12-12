const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const pool = require('../db');
const router = express.Router();

const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.array('files', 2), async (req, res) => {
  try {
    const files = req.files;
    if (files.length !== 2) {
      return res.status(400).json({ message: 'Please upload two Excel files.' });
    }

    // Read both Excel files
    const workbook1 = xlsx.readFile(files[0].path);
    const workbook2 = xlsx.readFile(files[1].path);

    const sheet1 = workbook1.Sheets[workbook1.SheetNames[0]];
    const sheet2 = workbook2.Sheets[workbook2.SheetNames[0]];

    const data1 = xlsx.utils.sheet_to_json(sheet1, { header: 1 });
    const data2 = xlsx.utils.sheet_to_json(sheet2, { header: 1 });

    // Calculate RMSE
    const rmse = calculateRMSE(data1, data2);

    // Store data and result in PostgreSQL
    await pool.query('INSERT INTO positional_accuracy (data, rmse) VALUES ($1, $2)', [
      JSON.stringify({ data1, data2 }),
      rmse,
    ]);

    res.json({ rmse });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const calculateRMSE = (data1, data2) => {
  let sumSquaredDiffs = 0;
  let count = 0;

  data1.forEach((point1, index) => {
    const point2 = data2[index];
    if (point1 && point2) {
      const diffX = point1[0] - point2[0];
      const diffY = point1[1] - point2[1];
      sumSquaredDiffs += diffX ** 2 + diffY ** 2;
      count++;
    }
  });

  return Math.sqrt(sumSquaredDiffs / count);
};

module.exports = router;
