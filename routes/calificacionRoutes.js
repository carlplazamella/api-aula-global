// **api-aula-global/routes/calificacionRoutes.js**

const express     = require('express');
const router      = express.Router();
const pool        = require('../config/db');
const verifyToken = require('../middlewares/verifyToken');

/**
 * POST /api/calificacion
 * Inserta o actualiza la calificación del usuario logueado (evaluador)
 * sobre la reserva dada.
 */
router.post('/', verifyToken, async (req, res) => {
  const evaluadorId = req.user.id;
  const { reservaId, estrellas, comentario } = req.body;

  if (reservaId == null || estrellas == null || typeof comentario !== 'string') {
    return res.status(400).json({ mensaje: 'Faltan datos' });
  }

  try {
    // Upsert
    await pool.execute(
      `INSERT INTO evaluacion_clase
         (reserva_id, evaluador, puntuacion, comentario, fecha)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         puntuacion = VALUES(puntuacion),
         comentario = VALUES(comentario),
         fecha      = NOW()`,
      [reservaId, evaluadorId, estrellas, comentario.trim()]
    );

    // Averiguar si fue insert o update
    const [rows] = await pool.execute(
      `SELECT id
         FROM evaluacion_clase
        WHERE reserva_id = ? AND evaluador = ?`,
      [reservaId, evaluadorId]
    );
    const existe  = rows.length > 0;
    const status  = existe ? 200 : 201;
    const mensaje = existe ? 'Calificación actualizada' : 'Calificación guardada';

    return res.status(status).json({
      mensaje,
      id: rows[0]?.id
    });

  } catch (error) {
    console.error('🔥 Error al guardar calificación:', error);
    return res.status(500).json({ mensaje: 'Error interno al guardar la calificación' });
  }
});

/**
 * GET /api/calificacion/usuario/:evaluadoId
 * Devuelve el promedio, total y detalle de las valoraciones recibidas
 * por el usuario (como alumno o profesor).
 */
router.get('/usuario/:evaluadoId', verifyToken, async (req, res) => {
  const evaluadoId = parseInt(req.params.evaluadoId, 10);

  try {
    // 1) Estadísticas
    const [[stats]] = await pool.execute(
      `SELECT
         ROUND(AVG(e.puntuacion),1) AS promedio,
         COUNT(*)              AS total
       FROM evaluacion_clase e
       JOIN reserva_clase     r  ON e.reserva_id = r.id
       JOIN hora_clase        hc ON r.hora_clase_id = hc.id
       JOIN clase             c  ON hc.clase_id = c.id
       WHERE r.alumno_id = ? OR c.profesor_id = ?`,
      [evaluadoId, evaluadoId]
    );

    // 2) Detalle
    const [items] = await pool.execute(
      `SELECT
         e.puntuacion    AS estrellas,
         e.comentario,
         DATE_FORMAT(e.fecha, '%Y-%m-%d %H:%i:%s') AS fecha,
         COALESCE(a.nombre, p.nombre)     AS evaluadorNombre,
         COALESCE(a.apellido, p.apellido) AS evaluadorApellido
       FROM evaluacion_clase e
       LEFT JOIN alumno  a ON e.evaluador = a.id
       LEFT JOIN profesor p ON e.evaluador = p.id
       JOIN reserva_clase r  ON e.reserva_id = r.id
       JOIN hora_clase    hc ON r.hora_clase_id = hc.id
       JOIN clase         c  ON hc.clase_id = c.id
       WHERE r.alumno_id = ? OR c.profesor_id = ?
       ORDER BY e.fecha DESC`,
      [evaluadoId, evaluadoId]
    );

    return res.json({
      promedio: stats.promedio?.toString() || '0.0',
      total:    stats.total,
      items: items.map(row => ({
        estrellas:       row.estrellas,
        comentario:      row.comentario,
        fecha:           row.fecha,
        evaluadorNombre: `${row.evaluadorNombre} ${row.evaluadorApellido}`
      }))
    });

  } catch (error) {
    console.error('🔥 Error al consultar calificaciones:', error);
    return res.status(500).json({ mensaje: 'Error interno al obtener calificaciones' });
  }
});

module.exports = router;
