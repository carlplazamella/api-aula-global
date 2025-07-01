require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const cron    = require('node-cron');
const pool    = require('./config/db');

// Rutas
const authRoutes         = require('./routes/authRoutes');
const materiasRoutes     = require('./routes/materias');
const nivelesRoutes      = require('./routes/niveles');
const clasesRoutes       = require('./routes/clasesRoutes');
const bloquesRoutes      = require('./routes/bloques.routes');
const reservasRoutes     = require('./routes/reservasRoutes');
const calificacionRoutes = require('./routes/calificacionRoutes');
const usuariosRoutes     = require('./routes/usuariosRoutes');
const pagosRoutes        = require('./routes/pagosRoutes');
const retirosRoutes      = require('./routes/retirosRoutes');
const notiRoutes         = require('./routes/notificacionRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Ruta de prueba
app.get('/ping', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.send('✅ Conexión a DB en Railway OK');
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Error de conexión');
  }
});

// ----- Rutas de la API -----
app.use('/api/auth',           authRoutes);
app.use('/api/materias',       materiasRoutes);
app.use('/api/niveles',        nivelesRoutes);
app.use('/api/clases',         clasesRoutes);
app.use('/api/bloques',        bloquesRoutes);
app.use('/api/reservas',       reservasRoutes);
app.use('/api/calificacion',   calificacionRoutes);
app.use('/api/usuarios',       usuariosRoutes);

// **Aquí montamos la nueva ruta de pagos**
app.use('/api/pagos',          pagosRoutes);

app.use('/api/retiros',        retirosRoutes);
app.use('/api/notificaciones', notiRoutes);

// CRON: RECORDATORIOS 24h y 1h ANTES DE LA CLASE
cron.schedule('0 * * * *',    async () => { /* ... tu lógica 24h ... */ });
cron.schedule('* * * * *',    async () => { /* ... tu lógica 1h ... */ });

// Manejador global de errores
app.use((err, _req, res, _next) => {
  console.error('Error en la aplicación:', err);
  res.status(500).json({ mensaje: err.message || 'Error interno del servidor' });
});

// Levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
