const express = require('express');
const router = express.Router();
const pool = require('../db'); // Ajusta la ruta según tu conexión MySQL

// Obtener notificaciones de un usuario ordenadas por fecha descendente
router.get('/:usuario', async (req, res) => {
  const usuario = req.params.usuario;
  try {
    const [rows] = await pool.query(
      'SELECT id, titulo, mensaje, leida, fecha_envio FROM notificaciones WHERE usuario = ? ORDER BY fecha_envio DESC',
      [usuario]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// Crear una nueva notificación
router.post('/', async (req, res) => {
  const { usuario, titulo, mensaje } = req.body;
  if (!usuario || !titulo || !mensaje) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO notificaciones (usuario, titulo, mensaje, leida, fecha_envio) VALUES (?, ?, ?, 0, NOW())',
      [usuario, titulo, mensaje]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error('Error al crear notificación:', error);
    res.status(500).json({ error: 'Error al crear notificación' });
  }
});

// Marcar una notificación como leída
router.put('/leer/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const [result] = await pool.query(
      'UPDATE notificaciones SET leida = 1 WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }
    res.json({ message: 'Notificación marcada como leída' });
  } catch (error) {
    console.error('Error al marcar notificación como leída:', error);
    res.status(500).json({ error: 'Error al actualizar notificación' });
  }
});

module.exports = router;
