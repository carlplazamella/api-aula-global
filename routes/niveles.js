// routes/niveles.js

const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         id,
         nombre_nivel
       FROM nivel`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener niveles:', err);
    res.status(500).json({ error: 'Error al obtener niveles' });
  }
});

module.exports = router;
