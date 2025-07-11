const express     = require('express');
const router      = express.Router();
const pool        = require('../config/db');
const verifyToken = require('../middlewares/verifyToken');

/**
 * POST /api/reservas/reservar
 */
router.post('/reservar', async (req, res) => {
  const { alumnoId, bloqueHorarioId } = req.body;
  if (!alumnoId || !bloqueHorarioId) {
    return res.status(400).json({ mensaje: 'Faltan datos' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[slot]] = await connection.execute(
      `SELECT id FROM hora_clase WHERE id = ? FOR UPDATE`,
      [bloqueHorarioId]
    );
    if (!slot) {
      await connection.rollback();
      return res.status(404).json({ mensaje: 'Bloque no encontrado' });
    }
    const [existing] = await connection.execute(
      `SELECT id FROM reserva_clase WHERE hora_clase_id = ? FOR UPDATE`,
      [bloqueHorarioId]
    );
    if (existing.length) {
      await connection.rollback();
      return res.status(409).json({ mensaje: 'El bloque ya está reservado' });
    }
    const [reservaRes] = await connection.execute(
      `INSERT INTO reserva_clase (alumno_id, hora_clase_id) VALUES (?, ?)`,
      [alumnoId, bloqueHorarioId]
    );
    await connection.commit();
    res.status(201).json({
      mensaje:   'Reserva realizada correctamente',
      reservaId: reservaRes.insertId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al realizar reserva:', error);
    res.status(500).json({ mensaje: 'Error al realizar la reserva' });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/reservas/pagar
 */
router.post('/pagar', async (req, res) => {
  const { reservaId, metodo_pago } = req.body;
  if (!reservaId || !metodo_pago) {
    return res.status(400).json({ mensaje: 'Faltan datos' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[reserva]] = await connection.execute(
      `SELECT c.monto AS monto
         FROM reserva_clase r
         JOIN clase c ON r.hora_clase_id = c.id
        WHERE r.id = ?`,
      [reservaId]
    );
    if (!reserva) {
      await connection.rollback();
      return res.status(404).json({ mensaje: 'Reserva no encontrada' });
    }
    const [pagoRes] = await connection.execute(
      `INSERT INTO pago 
         (monto, metodo_pago, estado, transaccion_id)
       VALUES (?, ?, 'COMPLETADO', ?)`,
      [reserva.monto, metodo_pago, 'TRANSACCION-' + Date.now()]
    );
    await connection.execute(
      `UPDATE reserva_clase SET pago_id = ? WHERE id = ?`,
      [pagoRes.insertId, reservaId]
    );
    await connection.commit();
    res.status(200).json({ mensaje: 'Pago simulado exitoso' });
  } catch (error) {
    await connection.rollback();
    console.error('Error al simular pago:', error);
    res.status(500).json({ mensaje: 'Error al realizar el pago' });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/reservas/cancelar
 */
router.post('/cancelar', verifyToken, async (req, res) => {
  const { reservaId } = req.body;
  if (!reservaId) {
    return res.status(400).json({ mensaje: 'Falta el ID de la reserva' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `DELETE FROM reserva_clase WHERE id = ?`,
      [reservaId]
    );
    await connection.commit();
    res.status(200).json({ mensaje: 'Reserva cancelada correctamente' });
  } catch (error) {
    await connection.rollback();
    console.error('Error al cancelar reserva:', error);
    res.status(500).json({ mensaje: 'Error al cancelar la reserva' });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/reservas/profesor/:profesorId
 */
router.get('/profesor/:profesorId', verifyToken, async (req, res) => {
  const profesorId = parseInt(req.params.profesorId, 10);
  try {
    const [reservas] = await pool.execute(
      `SELECT
         r.id,
         hc.id AS hora_clase_id,
         DATE_FORMAT(hc.fecha, '%d-%m-%Y') AS fechaBloque,
         DATE_FORMAT(hc.inicio, '%H:%i')   AS horaInicio,
         DATE_FORMAT(hc.fin, '%H:%i')      AS horaFin,
         m.nombre_materia                  AS materia,
         n.nombre_nivel                    AS dificultad,
         a.id                              AS alumnoId,
         CONCAT(a.nombre, ' ', a.apellido) AS alumno
       FROM reserva_clase r
       JOIN hora_clase hc ON r.hora_clase_id = hc.id
       JOIN clase c       ON hc.clase_id      = c.id
       JOIN materia m     ON c.materia_id     = m.id
       JOIN nivel n       ON c.nivel_id       = n.id
       JOIN alumno a      ON r.alumno_id      = a.id
       JOIN profesor p    ON c.profesor_id    = p.id
       LEFT JOIN evaluacion_clase cal
         ON cal.reserva_id = r.id
       WHERE p.id = ?
         AND (
           hc.fecha > CURDATE()
           OR (hc.fecha = CURDATE() AND hc.inicio > CURTIME())
         )
         AND cal.id IS NULL
       ORDER BY hc.fecha ASC, hc.inicio ASC`,
      [profesorId]
    );
    res.json(reservas);
  } catch (error) {
    console.error('Error al obtener reservas del profesor:', error);
    res.status(500).json({ mensaje: 'Error al obtener las reservas' });
  }
});

/**
 * GET /api/reservas/profesor/:profesorId/historial
 */
router.get('/profesor/:profesorId/historial', verifyToken, async (req, res) => {
  const profesorId = parseInt(req.params.profesorId, 10);
  try {
    const [historial] = await pool.execute(
      `SELECT
         r.id,
         hc.id AS hora_clase_id,
         DATE_FORMAT(hc.fecha, '%d-%m-%Y') AS fechaBloque,
         DATE_FORMAT(hc.inicio, '%H:%i')   AS horaInicio,
         DATE_FORMAT(hc.fin, '%H:%i')      AS horaFin,
         m.nombre_materia                  AS materia,
         n.nombre_nivel                    AS dificultad,
         a.id                              AS alumnoId,
         CONCAT(a.nombre, ' ', a.apellido) AS alumno
       FROM reserva_clase r
       JOIN hora_clase hc ON r.hora_clase_id = hc.id
       JOIN clase c       ON hc.clase_id      = c.id
       JOIN materia m     ON c.materia_id     = m.id
       JOIN nivel n       ON c.nivel_id       = n.id
       JOIN alumno a      ON r.alumno_id      = a.id
       JOIN profesor p    ON c.profesor_id    = p.id
       WHERE p.id = ?
         AND (
           hc.fecha < CURDATE()
           OR (hc.fecha = CURDATE() AND hc.inicio <= CURTIME())
         )
       ORDER BY hc.fecha DESC, hc.inicio DESC`,
      [profesorId]
    );
    res.json(historial);
  } catch (error) {
    console.error('Error al obtener historial del profesor:', error);
    res.status(500).json({ mensaje: 'Error al obtener el historial' });
  }
});

/**
 * GET /api/reservas/alumno/:alumnoId
 */
router.get('/alumno/:alumnoId', verifyToken, async (req, res) => {
  const alumnoId = parseInt(req.params.alumnoId, 10);
  try {
    const [reservas] = await pool.execute(
      `SELECT
         r.id,
         hc.id AS hora_clase_id,
         DATE_FORMAT(hc.fecha, '%Y-%m-%d') AS fechaBloque,
         DATE_FORMAT(hc.inicio, '%H:%i')   AS horaInicio,
         DATE_FORMAT(hc.fin, '%H:%i')      AS horaFin,
         m.nombre_materia                  AS materia,
         n.nombre_nivel                    AS dificultad,
         p.id                              AS profesorId,
         CONCAT(p.nombre, ' ', p.apellido) AS profesor
       FROM reserva_clase r
       JOIN hora_clase hc ON r.hora_clase_id = hc.id
       JOIN clase c       ON hc.clase_id      = c.id
       JOIN materia m     ON c.materia_id     = m.id
       JOIN nivel n       ON c.nivel_id       = n.id
       JOIN profesor p    ON c.profesor_id    = p.id
       LEFT JOIN evaluacion_clase cal
         ON cal.reserva_id = r.id
       WHERE r.alumno_id = ?
         AND (
           hc.fecha > CURDATE()
           OR (hc.fecha = CURDATE() AND hc.inicio > CURTIME())
         )
         AND cal.id IS NULL
       ORDER BY hc.fecha ASC, hc.inicio ASC`,
      [alumnoId]
    );
    res.json(reservas);
  } catch (error) {
    console.error('Error al obtener reservas del alumno:', error);
    res.status(500).json({ mensaje: 'Error al obtener las reservas' });
  }
});

/**
 * GET /api/reservas/alumno/:alumnoId/historial
 */
router.get('/alumno/:alumnoId/historial', verifyToken, async (req, res) => {
  const alumnoId = parseInt(req.params.alumnoId, 10);
  try {
    const [historial] = await pool.execute(
      `SELECT
         r.id,
         hc.id AS hora_clase_id,
         DATE_FORMAT(hc.fecha, '%Y-%m-%d') AS fechaBloque,
         DATE_FORMAT(hc.inicio, '%H:%i')   AS horaInicio,
         DATE_FORMAT(hc.fin, '%H:%i')      AS horaFin,
         m.nombre_materia                  AS materia,
         n.nombre_nivel                    AS dificultad,
         p.id                              AS profesorId,
         CONCAT(p.nombre, ' ', p.apellido) AS profesor
       FROM reserva_clase r
       JOIN hora_clase hc ON r.hora_clase_id = hc.id
       JOIN clase c       ON hc.clase_id      = c.id
       JOIN materia m     ON c.materia_id     = m.id
       JOIN nivel n       ON c.nivel_id       = n.id
       JOIN profesor p    ON c.profesor_id    = p.id
       WHERE r.alumno_id = ?
         AND (
           hc.fecha < CURDATE()
           OR (hc.fecha = CURDATE() AND hc.inicio <= CURTIME())
         )
       ORDER BY hc.fecha DESC, hc.inicio DESC`,
      [alumnoId]
    );
    res.json(historial);
  } catch (error) {
    console.error('Error al obtener historial del alumno:', error);
    res.status(500).json({ mensaje: 'Error al obtener el historial' });
  }
});

/**
 * GET /api/reservas/:id
 */
router.get('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute(
      `SELECT 
         r.id,
         hc.id AS hora_clase_id,
         DATE_FORMAT(hc.fecha, '%Y-%m-%d') AS fecha,
         DATE_FORMAT(hc.inicio, '%H:%i')   AS horaInicio,
         DATE_FORMAT(hc.fin, '%H:%i')      AS horaFin,
         m.nombre_materia                  AS materia,
         n.nombre_nivel                    AS nivel,
         c.monto                           AS monto,
         CONCAT(p.nombre, ' ', p.apellido) AS profesor
       FROM reserva_clase r
       JOIN hora_clase hc ON r.hora_clase_id = hc.id
       JOIN clase c       ON hc.clase_id      = c.id
       JOIN materia m     ON c.materia_id     = m.id
       JOIN nivel n       ON c.nivel_id       = n.id
       JOIN profesor p    ON c.profesor_id    = p.id
       WHERE r.id = ?`,
      [id]
    );
    if (!result.length) {
      return res.status(404).json({ mensaje: 'Reserva no encontrada' });
    }
    res.json(result[0]);
  } catch (error) {
    console.error('Error al obtener reserva:', error);
    res.status(500).json({ mensaje: 'Error al obtener los datos de la reserva' });
  }
});

module.exports = router;
