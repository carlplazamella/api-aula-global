require('dotenv').config();
const express = require('express');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcrypt');
const path    = require('path');
const pool    = require('../config/db');
const { verifyDjangoPassword } = require(
  path.join(__dirname, '..', 'utils', 'djangoAuth.js')
);

const router = express.Router();

// Registro (sin cambios)
router.post('/register', async (req, res) => {
  console.log('➡️ [REGISTER] req.body =', req.body);
  const { nombre, apellido, correo, password, rut, dv, tipoUsuario } = req.body;
  if (![nombre, apellido, correo, password, rut, dv, tipoUsuario].every(Boolean)) {
    return res.status(400).json({ mensaje: 'Faltan datos obligatorios.' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    let result;
    if (tipoUsuario.toLowerCase() === 'alumno') {
      [result] = await pool.execute(
        `INSERT INTO alumno
           (nombre, apellido, rut, dv, correo, password, activo)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [nombre, apellido, rut, dv, correo, hash]
      );
    } else {
      [result] = await pool.execute(
        `INSERT INTO profesor
           (nombre, apellido, rut, dv, email, password, titulo, validado, activo)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 1, 1)`,
        [nombre, apellido, rut, dv, correo, hash]
      );
    }
    return res.status(201).json({ mensaje: 'Registro exitoso.', id: result.insertId });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Correo o RUT ya registrado.' });
    }
    return res.status(500).json({ mensaje: 'Error interno al registrar.' });
  }
});

// Login para alumno/profesor
router.post('/login', async (req, res) => {
  console.log('➡️ [LOGIN] req.body =', req.body);
  const { correo, password } = req.body;
  if (!correo || !password) {
    return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios.' });
  }

  try {
    // 1) Intentar en alumno
    let [rows] = await pool.execute(
      `SELECT id, nombre, apellido, correo, password, activo
         FROM alumno
        WHERE correo = ?
        LIMIT 1`,
      [correo]
    );
    if (rows.length > 0 && rows[0].activo) {
      const usr = rows[0];
      const hash = usr.password;
      const valid = hash.startsWith('pbkdf2_sha256$')
        ? verifyDjangoPassword(password, hash)
        : await bcrypt.compare(password, hash);
      console.log('✔️ [LOGIN] alumno valid =', valid);
      if (valid) {
        // Construimos payload incluyendo apellido
        const payload = {
          id:       usr.id,
          nombre:   usr.nombre,
          apellido: usr.apellido,
          correo:   usr.correo,
          role:     'alumno'
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
        return res.json({ mensaje: 'Login exitoso (Alumno)', token, usuario: payload });
      }
    }

    // 2) Intentar en profesor
    [rows] = await pool.execute(
      `SELECT id, nombre, apellido, email AS correo, password, activo
         FROM profesor
        WHERE email = ?
        LIMIT 1`,
      [correo]
    );
    if (rows.length > 0 && rows[0].activo) {
      const usr = rows[0];
      const hash = usr.password;
      const valid = hash.startsWith('pbkdf2_sha256$')
        ? verifyDjangoPassword(password, hash)
        : await bcrypt.compare(password, hash);
      console.log('✔️ [LOGIN] profesor valid =', valid);
      if (valid) {
        // Construimos payload incluyendo apellido
        const payload = {
          id:       usr.id,
          nombre:   usr.nombre,
          apellido: usr.apellido,
          correo:   usr.correo,
          role:     'profesor'
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
        return res.json({ mensaje: 'Login exitoso (Profesor)', token, usuario: payload });
      }
    }

    console.log('⚠️ [LOGIN] credenciales inválidas');
    return res.status(401).json({ mensaje: 'Credenciales inválidas.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ mensaje: 'Error interno al iniciar sesión.' });
  }
});

module.exports = router;
