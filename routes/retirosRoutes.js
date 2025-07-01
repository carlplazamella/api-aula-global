// api-aula-global/routes/retirosRoutes.js

const express     = require('express');
const router      = express.Router();
const pool        = require('../config/db');
const verifyToken = require('../middlewares/verifyToken');

/**
 * GET /api/retiros/profesor/:profesorId
 * Si la tabla no existe, retornamos un array vacío.
 */
router.get('/profesor/:profesorId', verifyToken, async (req, res) => {
  const profesorId = parseInt(req.params.profesorId, 10);
  try {
    const [rows] = await pool.execute(
      `SELECT fecha_solicitud AS fecha, monto, estado
       FROM retiro
       WHERE profesor_id = ?
       ORDER BY fecha_solicitud DESC`,
      [profesorId]
    );
    res.json({ retiros: rows });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.warn('Tabla retiro no existe, devolviendo []');
      return res.json({ retiros: [] });
    }
    console.error('Error al listar retiros:', err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

/**
 * POST /api/retiros
 */
router.post('/', verifyToken, async (req, res) => {
  const { profesorId, monto } = req.body;
  if (!profesorId || monto == null) {
    return res.status(400).json({ mensaje: 'Faltan datos' });
  }
  try {
    // 1) Total de pagos completados
    const [[pagosSum]] = await pool.execute(
      `SELECT COALESCE(SUM(p.monto),0) AS totalPagos
       FROM pago p
       JOIN reserva_clase r ON p.id = r.pago_id
       JOIN clase c         ON r.hora_clase_id = c.id
       WHERE c.profesor_id = ?`,
      [profesorId]
    );
    // 2) Total de retiros previos
    const [[retirosSum]] = await pool.execute(
      `SELECT COALESCE(SUM(monto),0) AS totalRetiros
       FROM retiro
       WHERE profesor_id = ?`,
      [profesorId]
    );
    const disponible = pagosSum.totalPagos - retirosSum.totalRetiros;
    if (monto > disponible) {
      return res.status(400).json({ mensaje: 'Monto excede saldo disponible' });
    }

    // 3) Insertar nuevo retiro
    const [insertRes] = await pool.execute(
      `INSERT INTO retiro (profesor_id, monto) VALUES (?, ?)`,
      [profesorId, monto]
    );
    const [[newRow]] = await pool.execute(
      `SELECT id, fecha_solicitud AS fecha, monto, estado
       FROM retiro WHERE id = ?`,
      [insertRes.insertId]
    );
    res.status(201).json({
      mensaje: 'Retiro solicitado correctamente',
      retiro:  newRow
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.warn('Tabla retiro no existe, operación no soportada aún');
      return res.status(501).json({ mensaje: 'Funcionalidad no implementada aún' });
    }
    console.error('Error al crear retiro:', err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
