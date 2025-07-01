const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

/**
 * POST /api/clases/reservar
 */
router.post('/reservar', async (req, res) => {
  const { alumnoId, horaClaseId, mensaje_alumno } = req.body;
  if (!alumnoId || !horaClaseId) {
    return res.status(400).json({ mensaje: 'Faltan datos' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [exist] = await conn.execute(
      `SELECT 1
         FROM reserva_clase
        WHERE hora_clase_id = ?
        FOR UPDATE`,
      [horaClaseId]
    );
    if (exist.length > 0) {
      await conn.rollback();
      return res.status(409).json({ mensaje: 'El bloque ya está reservado' });
    }
    await conn.execute(
      `INSERT INTO reserva_clase
         (alumno_id, hora_clase_id, mensaje_alumno)
       VALUES (?, ?, ?)`,
      [alumnoId, horaClaseId, mensaje_alumno || null]
    );
    await conn.commit();
    res.status(201).json({ mensaje: 'Reserva realizada correctamente' });
  } catch (err) {
    await conn.rollback();
    console.error('Error al realizar reserva:', err);
    res.status(500).json({ mensaje: 'Error al realizar la reserva' });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/clases/disponibles
 */
router.get('/disponibles', async (_req, res) => {
  try {
    const [clases] = await pool.execute(
      `SELECT
         hc.id                             AS bloque_id,
         hc.fecha,
         TIME(hc.inicio)                   AS hora_inicio,
         TIME(hc.fin)                      AS hora_fin,
         m.nombre_materia                  AS materia,
         n.nombre_nivel                    AS nivel,
         c.monto                           AS precio_hora,
         CONCAT(p.nombre, ' ', p.apellido) AS profesor,
         p.id                              AS profesor_id
       FROM hora_clase hc
       JOIN clase c      ON hc.clase_id   = c.id
       JOIN materia m    ON c.materia_id  = m.id
       JOIN nivel n      ON c.nivel_id    = n.id
       JOIN profesor p   ON c.profesor_id = p.id
       LEFT JOIN reserva_clase rc
         ON rc.hora_clase_id = hc.id
       WHERE rc.id IS NULL
         AND (
           hc.fecha > CURDATE()
           OR (hc.fecha = CURDATE() AND TIME(hc.inicio) > CURTIME())
         )
       ORDER BY hc.fecha, hc.inicio`
    );
    res.json(clases);
  } catch (err) {
    console.error('Error al obtener clases disponibles:', err);
    res.status(500).json({ mensaje: 'Error al obtener clases disponibles' });
  }
});

/**
 * GET /api/clases/disponibles/:profesorId/:materia
 */
router.get('/disponibles/:profesorId/:materia', async (req, res) => {
  const { profesorId, materia } = req.params;
  try {
    const [filtradas] = await pool.execute(
      `SELECT
         hc.id           AS bloque_id,
         hc.fecha,
         TIME(hc.inicio) AS hora_inicio,
         TIME(hc.fin)    AS hora_fin
       FROM hora_clase hc
       JOIN clase c     ON hc.clase_id   = c.id
       JOIN materia m   ON c.materia_id  = m.id
       WHERE c.profesor_id = ?
         AND m.nombre_materia = ?
         AND hc.fecha >= CURDATE()
         AND NOT EXISTS (
           SELECT 1 FROM reserva_clase rc
            WHERE rc.hora_clase_id = hc.id
         )
       ORDER BY hc.fecha, hc.inicio`,
      [profesorId, decodeURIComponent(materia)]
    );
    res.json(filtradas);
  } catch (err) {
    console.error('Error al obtener disponibilidad:', err);
    res.status(500).json({ mensaje: 'Error al obtener disponibilidad' });
  }
});

/**
 * GET /api/clases/agendadas/:profesorId
 */
router.get('/agendadas/:profesorId', async (req, res) => {
  const { profesorId } = req.params;
  try {
    const [agendadas] = await pool.execute(
      `SELECT
         hc.id                             AS bloque_id,
         hc.fecha,
         TIME(hc.inicio)                   AS hora_inicio,
         TIME(hc.fin)                      AS hora_fin,
         m.nombre_materia                  AS materia,
         n.nombre_nivel                    AS nivel,
         c.monto                           AS precio_hora,
         CONCAT(p.nombre, ' ', p.apellido) AS profesor,
         p.id                              AS profesor_id,
         rc.alumno_id                      AS alumno_id,
         rc.mensaje_alumno                 AS mensaje_alumno
       FROM reserva_clase rc
       JOIN hora_clase hc ON rc.hora_clase_id = hc.id
       JOIN clase c       ON hc.clase_id      = c.id
       JOIN materia m     ON c.materia_id     = m.id
       JOIN nivel n       ON c.nivel_id       = n.id
       JOIN profesor p    ON c.profesor_id    = p.id
       WHERE p.id = ?
         AND hc.fecha >= CURDATE()
       ORDER BY hc.fecha, hc.inicio`,
      [profesorId]
    );
    res.json(agendadas);
  } catch (err) {
    console.error('Error al obtener clases agendadas:', err);
    res.status(500).json({ mensaje: 'Error al obtener clases agendadas' });
  }
});

/**
 * GET /api/clases/bloques/:profesorId
 */
router.get('/bloques/:profesorId', async (req, res) => {
  const { profesorId } = req.params;
  try {
    const [bloques] = await pool.execute(
      `SELECT
         hc.id                             AS bloque_id,
         hc.fecha,
         TIME(hc.inicio)                   AS hora_inicio,
         TIME(hc.fin)                      AS hora_fin,
         CASE WHEN rc.id IS NULL THEN 'DISPONIBLE' ELSE 'RESERVADO' END AS estado_bloque,
         m.nombre_materia                  AS materia,
         n.nombre_nivel                    AS nivel,
         c.monto                           AS precio_hora,
         CONCAT(p.nombre, ' ', p.apellido) AS profesor,
         p.id                              AS profesor_id
       FROM hora_clase hc
       JOIN clase c       ON hc.clase_id     = c.id
       JOIN materia m     ON c.materia_id    = m.id
       JOIN nivel n       ON c.nivel_id      = n.id
       JOIN profesor p    ON c.profesor_id   = p.id
       LEFT JOIN reserva_clase rc
         ON rc.hora_clase_id = hc.id
       WHERE c.profesor_id = ?
         AND hc.fecha >= CURDATE()
       ORDER BY hc.fecha, hc.inicio`,
      [profesorId]
    );
    res.json(bloques);
  } catch (err) {
    console.error('Error al obtener bloques del profesor:', err);
    res.status(500).json({ mensaje: 'Error al obtener bloques del profesor' });
  }
});

/**
 * POST /api/clases
 */
router.post('/', async (req, res) => {
  const {
    materia,
    nivel,
    profesorId,
    hora_inicio,
    hora_fin,
    fecha,
    descripcion,
    precioHora
  } = req.body;

  if (
    !materia || !nivel || !profesorId ||
    !hora_inicio || !hora_fin || !fecha ||
    precioHora == null
  ) {
    return res.status(400).json({ mensaje: 'Faltan datos obligatorios' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Verificar solapamientos
    const [overlaps] = await conn.execute(
      `SELECT COUNT(*) AS count
         FROM hora_clase hc
         JOIN clase c ON hc.clase_id = c.id
        WHERE c.profesor_id = ?
          AND hc.fecha = ?
          AND TIME(hc.inicio) < ?
          AND TIME(hc.fin)   > ?`,
      [profesorId, fecha, hora_fin, hora_inicio]
    );
    if (overlaps[0].count > 0) {
      await conn.rollback();
      return res.status(409).json({ mensaje: 'Ya tienes una clase en ese horario' });
    }

    // 2) Calcular duración
    const [h1, m1] = hora_inicio.split(':').map(Number);
    const [h2, m2] = hora_fin.split(':').map(Number);
    const duracion = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;

    // 3) Insertar clase
    const [cls] = await conn.execute(
      `INSERT INTO clase
         (monto, duracion, profesor_id, nivel_id, materia_id)
       VALUES (?, ?, ?, ?, ?)`,
      [precioHora, duracion, profesorId, nivel, materia]
    );
    const claseId = cls.insertId;

    // 4) Generar bloques
    let cursor = h1 * 60 + m1;
    const endMin = h2 * 60 + m2;
    const bloqueIds = [];
    const slotMin = 90, gapMin = 15;

    while (cursor + slotMin <= endMin) {
      const startH   = Math.floor(cursor / 60);
      const startM   = cursor % 60;
      const endSlot  = cursor + slotMin;
      const endH     = Math.floor(endSlot / 60);
      const endM     = endSlot % 60;
      const inicioStr = `${fecha} ${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')}:00`;
      const finStr    = `${fecha} ${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}:00`;

      const [hc] = await conn.execute(
        `INSERT INTO hora_clase
           (clase_id, fecha, inicio, fin)
         VALUES (?, ?, ?, ?)`,
        [claseId, fecha, inicioStr, finStr]
      );
      bloqueIds.push(hc.insertId);
      cursor = endSlot + gapMin;
    }

    // 5) Recuperar nombre de materia y nivel
    const [[info]] = await conn.execute(
      `SELECT
         m.nombre_materia AS materia,
         n.nombre_nivel   AS nivel
       FROM clase c
       JOIN materia m ON c.materia_id = m.id
       JOIN nivel   n ON c.nivel_id   = n.id
       WHERE c.id = ?`,
      [claseId]
    );

    await conn.commit();
    res.status(201).json({
      mensaje: 'Clase y bloques creados correctamente',
      clase:   { id: claseId, materia: info.materia, nivel: info.nivel },
      bloque_ids: bloqueIds
    });
  } catch (err) {
    await conn.rollback();
    console.error('Error al crear clase:', err);
    res.status(500).json({ mensaje: 'Error al crear la clase' });
  } finally {
    conn.release();
  }
});

module.exports = router;
