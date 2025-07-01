const express = require('express');
const router = express.Router();
const db = require('../config/db'); 

// Obtener todos los bloques
router.get('/', (req, res) => {
  db.query('SELECT * FROM bloques', (err, resultados) => {
    if (err) {
      console.error('Error al obtener bloques:', err);
      return res.status(500).json({ mensaje: 'Error al obtener bloques' });
    }
    res.json(resultados);
  });
});

module.exports = router;
