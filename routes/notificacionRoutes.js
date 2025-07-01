const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

/**
 * GET /api/notificaciones/count
 * Devuelve el número de notificaciones no leídas para el usuario logueado.
 */
router.get('/count', async (req, res) => {
  const usuarioId = req.usuarioId; // asumo que lo pones en el middleware verifyToken
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS count
         FROM notificacion
        WHERE usuario_id = ?
          AND leida = FALSE`,
      [usuarioId]
    );
    const count = rows[0]?.count || 0;
    res.json({ count });
  } catch (err) {
    // Si la tabla no existe, devolvemos cero en lugar de error
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.warn('Tabla notificacion no existe — devolviendo count=0');
      return res.json({ count: 0 });
    }
    console.error('Error al contar notificaciones no leídas:', err);
    res.status(500).json({ mensaje: 'Error al contar notificaciones' });
  }
});

module.exports = router;
