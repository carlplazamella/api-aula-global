const pool = require('../server');  

/**
 * POST /api/calificacion
 * Crea una nueva calificación
 */
exports.postCalificacion = async (req, res, next) => {
  try {
    const {
      reservaId,
      evaluadorId,
      evaluadoId,
      estrellas,
      comentario
    } = req.body;

    if (!reservaId || !evaluadorId || !evaluadoId || !estrellas || !comentario) {
      return res.status(400).json({ mensaje: 'Faltan datos obligatorios' });
    }

    const sql = `
      INSERT INTO calificacion
        (reserva_id, evaluador_id, evaluado_id, estrellas, comentario)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [
      reservaId, evaluadorId, evaluadoId, estrellas, comentario
    ]);

    res.status(201).json({
      id: result.insertId,
      reservaId, evaluadorId, evaluadoId, estrellas, comentario
    });
  } catch (err) {
    next(err);  
  }
};

/**
 * GET /api/calificacion/usuario/:id
 * Obtiene el promedio, total y lista de valoraciones recibidas por un usuario.
 */
exports.getCalificacionesPorUsuario = async (req, res, next) => {
  try {
    const evaluadoId = req.params.id;

    // 1) Estadísticas: promedio y total
    const [statsRows] = await pool.execute(
      `SELECT 
         AVG(estrellas) AS promedio, 
         COUNT(*)    AS total 
       FROM calificacion 
       WHERE evaluado_id = ?`,
      [evaluadoId]
    );
    const { promedio, total } = statsRows[0];

    // 2) Detalle de cada valoración
    const [items] = await pool.execute(
      `SELECT 
         c.estrellas, 
         c.comentario, 
         u.nombre, 
         u.apellido, 
         u.rut, 
         u.dv
       FROM calificacion c
       JOIN USUARIO u 
         ON c.evaluador_id = u.id
       WHERE c.evaluado_id = ?
       ORDER BY c.fecha DESC`,
      [evaluadoId]
    );

    // 3) Formateamos para el front
    const calificaciones = items.map(row => ({
      estrellas:       row.estrellas,
      comentario:      row.comentario,
      evaluadorNombre: `${row.nombre} ${row.apellido}`,
      evaluadorRut:    `${row.rut}-${row.dv}`
    }));

    res.json({
      promedio: Number(promedio).toFixed(1),
      total,
      items: calificaciones
    });
  } catch (err) {
    next(err);
  }
};
