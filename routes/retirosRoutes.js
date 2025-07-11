// api-aula-global/routes/retirosRoutes.js

const express     = require('express');
const router      = express.Router();
const pool        = require('../config/db');
const verifyToken = require('../middlewares/verifyToken');

/**
 * GET /api/retiros/profesor/:profesorId
 * Devuelve todos los retiros (cobros) del profesor.
 */
router.get('/profesor/:profesorId', verifyToken, async (req, res) => {
  const profesorId = parseInt(req.params.profesorId, 10);
  try {
    const [rows] = await pool.execute(
      `SELECT id, monto, fecha, profesor_id
         FROM cobro_profesor
        WHERE profesor_id = ?
        ORDER BY fecha DESC`,
      [profesorId]
    );
    // Renombra 'fecha' y agrega 'estado'
    const retiros = rows.map(r => ({
      id:     r.id,
      monto:  Number(r.monto),
      fecha:  r.fecha,
      estado: 'PROCESADO' // Si después quieres cambiar, solo agrega campo en BD
    }));
    res.json({ retiros });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.warn('Tabla cobro_profesor no existe, devolviendo []');
      return res.json({ retiros: [] });
    }
    console.error('Error al listar retiros:', err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

/**
 * POST /api/retiros
 * Solicita un nuevo retiro/cobro.
 */
router.post('/', verifyToken, async (req, res) => {
  const { profesorId, monto } = req.body;
  if (!profesorId || monto == null) {
    return res.status(400).json({ mensaje: 'Faltan datos' });
  }
  try {
    // Puedes validar saldo disponible en frontend, o sumar los cobros aquí si deseas
    // Si necesitas lógica de "saldo disponible" acá, dímelo y te la armo también

    // 1) Insertar nuevo retiro/cobro
    const [insertRes] = await pool.execute(
      `INSERT INTO cobro_profesor (profesor_id, monto, fecha) VALUES (?, ?, NOW())`,
      [profesorId, monto]
    );
    const [[newRow]] = await pool.execute(
      `SELECT id, monto, fecha, profesor_id FROM cobro_profesor WHERE id = ?`,
      [insertRes.insertId]
    );
    res.status(201).json({
      mensaje: 'Retiro solicitado correctamente',
      retiro: {
        id:     newRow.id,
        monto:  Number(newRow.monto),
        fecha:  newRow.fecha,
        estado: 'PROCESADO'
      }
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.warn('Tabla cobro_profesor no existe, operación no soportada aún');
      return res.status(501).json({ mensaje: 'Funcionalidad no implementada aún' });
    }
    console.error('Error al crear retiro:', err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
