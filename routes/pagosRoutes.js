// api-aula-global/routes/pagosRoutes.js

const express     = require('express');
const router      = express.Router();
const pool        = require('../config/db');
const verifyToken = require('../middlewares/verifyToken');

/**
 * POST /api/pagos/pagar
 * Simula el pago de una reserva:
 *   1) Obtiene el monto de la clase
 *   2) Inserta un nuevo registro en `pago` (solo monto)
 *   3) Asocia el pago a la reserva en `reserva_clase`
 */
router.post('/pagar', async (req, res) => {
  const { reservaId } = req.body;
  if (!reservaId) {
    return res.status(400).json({ mensaje: 'Falta el ID de la reserva' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Obtener el monto
    const [[row]] = await conn.execute(
      `SELECT c.monto
         FROM reserva_clase r
         JOIN hora_clase hc ON r.hora_clase_id = hc.id
         JOIN clase c       ON hc.clase_id     = c.id
        WHERE r.id = ?`,
      [reservaId]
    );
    if (!row) {
      await conn.rollback();
      return res.status(404).json({ mensaje: 'Reserva no encontrada' });
    }

    // 2) Insertar el pago
    const [payRes] = await conn.execute(
      `INSERT INTO pago (monto) VALUES (?)`,
      [row.monto]
    );

    // 3) Asociar a la reserva
    await conn.execute(
      `UPDATE reserva_clase SET pago_id = ? WHERE id = ?`,
      [payRes.insertId, reservaId]
    );

    await conn.commit();
    res.status(200).json({
      mensaje: 'Pago simulado exitoso',
      pagoId:  payRes.insertId
    });
  } catch (err) {
    await conn.rollback();
    console.error('Error al procesar pago:', err);
    res.status(500).json({ mensaje: 'Error interno al procesar pago' });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/pagos/profesor/:profesorId
 * Devuelve los pagos completados de un profesor
 */
router.get('/profesor/:profesorId', verifyToken, async (req, res) => {
  const profesorId = parseInt(req.params.profesorId, 10);
  try {
    const [rows] = await pool.execute(
      `
      SELECT
        p.fecha_pago                        AS fecha,
        p.monto                             AS monto,
        m.nombre_materia                    AS clase,
        CONCAT(a.nombre, ' ', a.apellido)   AS alumno
      FROM pago p
      JOIN reserva_clase r   ON p.id = r.pago_id
      JOIN hora_clase hc     ON r.hora_clase_id = hc.id
      JOIN clase c           ON hc.clase_id     = c.id
      JOIN materia m         ON c.materia_id    = m.id
      JOIN alumno a          ON r.alumno_id     = a.id
      WHERE c.profesor_id = ?
      ORDER BY p.fecha_pago DESC
      `,
      [profesorId]
    );
    res.json({ pagos: rows });
  } catch (err) {
    console.error('Error al listar pagos del profesor:', err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
