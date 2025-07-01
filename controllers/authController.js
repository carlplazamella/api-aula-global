const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.registro = async (req, res) => {
    try {
        const { nombre, apellido, rut, dv, correo, contrasena, repetir_contrasena, tipo } = req.body;
        
        if (contrasena !== repetir_contrasena) {
            return res.status(400).json({ mensaje: 'Las contraseñas no coinciden' });
        }

        const hashedPassword = await bcrypt.hash(contrasena, 10);
        
        const [result] = await pool.execute(
            'INSERT INTO USUARIO (nombre, apellido, rut, dv, correo, contrasena, tipo) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [nombre, apellido, rut, dv, correo, hashedPassword, tipo]
        );

        if (tipo === 'ALUMNO') {
            await pool.execute('INSERT INTO ALUMNO (usuario_id) VALUES (?)', [result.insertId]);
        } else {
            await pool.execute('INSERT INTO PROFESOR (usuario_id) VALUES (?)', [result.insertId]);
        }

        res.status(201).json({ mensaje: 'Usuario registrado con éxito' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ mensaje: 'El correo o RUT ya está registrado' });
        }
        res.status(500).json({ mensaje: 'Error al registrar usuario', error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { correo, contrasena } = req.body;
        
        const [rows] = await pool.execute('SELECT * FROM USUARIO WHERE correo = ?', [correo]);
        
        if (rows.length === 0) {
            return res.status(401).json({ mensaje: 'Credenciales inválidas' });
        }
        
        const usuario = rows[0];
        const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena);
        
        if (!contrasenaValida) {
            return res.status(401).json({ mensaje: 'Credenciales inválidas' });
        }
        
        const token = jwt.sign(
            { id: usuario.id, correo: usuario.correo, tipo: usuario.tipo },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        res.json({ token, tipo: usuario.tipo, nombre: usuario.nombre });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al iniciar sesión', error: error.message });
    }
};