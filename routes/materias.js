// routes/materias.js

const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         id,
         nombre_materia
       FROM materia`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener materias:', err);
    res.status(500).json({ error: 'Error al obtener materias' });
  }
});

module.exports = router;
