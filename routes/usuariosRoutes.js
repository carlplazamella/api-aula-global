const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

/**
 * PUT /api/usuarios/:id
 * Actualiza la descripción de un usuario (alumno o profesor).
 */
router.put('/:id', async (req, res) => {
  const { descripcion } = req.body;
  const { id } = req.params;

  try {
    // 1) Actualizar sólo la descripción (por ahora sin foto_perfil)
    await db.query(
      `UPDATE alumno 
         SET descripcion = ?
       WHERE id = ?`,
      [descripcion, id]
    );
    await db.query(
      `UPDATE profesor 
         SET descripcion = ?
       WHERE id = ?`,
      [descripcion, id]
    );

    // 2) Leer de vuelta el usuario actualizado (alumno UNION profesor)
    const [rows] = await db.query(
      `SELECT 
         id,
         nombre,
         apellido,
         rut,
         dv,
         correo,
         descripcion,
         'ALUMNO' AS tipo
       FROM alumno
       WHERE id = ?
       UNION
       SELECT
         id,
         nombre,
         apellido,
         rut,
         dv,
         email AS correo,
         descripcion,
         'PROFESOR' AS tipo
       FROM profesor
       WHERE id = ?`,
      [id, id]
    );
    if (!rows.length) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    return res.json(rows[0]);

  } catch (error) {
    console.error('Error al actualizar el perfil:', error);
    return res.status(500).json({ mensaje: 'Error al actualizar el perfil' });
  }
});

/**
 * GET /api/usuarios/:id
 * Devuelve los datos básicos de un usuario (alumno o profesor).
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT 
         id,
         nombre,
         apellido,
         rut,
         dv,
         correo,
         descripcion,
         'ALUMNO' AS tipo
       FROM alumno
       WHERE id = ?
       UNION
       SELECT
         id,
         nombre,
         apellido,
         rut,
         dv,
         email   AS correo,
         descripcion,
         'PROFESOR' AS tipo
       FROM profesor
       WHERE id = ?`,
      [id, id]
    );
    if (!rows.length) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    return res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    return res.status(500).json({ mensaje: 'Error al obtener usuario' });
  }
});

module.exports = router;
