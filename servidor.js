const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro';

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Sin token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// FUNCIÓN PARA REGISTRAR EN HISTORIAL
async function registrarHistorial(usuarioId, email, accion, detalles) {
  try {
    await supabase
      .from('historial')
      .insert([{
        usuario_id: usuarioId,
        email: email,
        accion: accion,
        detalles: detalles,
        ip_address: 'APP'
      }]);
  } catch (error) {
    console.error('Error registrando historial:', error);
  }
}

// FUNCIÓN PARA ACTUALIZAR ÚLTIMO LOGIN
async function actualizarUltimoLogin(usuarioId, email) {
  try {
    await supabase
      .from('usuarios')
      .update({ 
        ultimo_login: new Date().toISOString(),
        estado: 'activo'
      })
      .eq('id', usuarioId);

    await supabase
      .from('ultimo_login')
      .upsert({
        usuario_id: usuarioId,
        email: email,
        ultimo_login: new Date().toISOString(),
        estado: 'activo',
        tiempo_offline_minutos: 0
      });
  } catch (error) {
    console.error('Error actualizando login:', error);
  }
}

// LOGIN - Registra en historial
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !data) {
      await registrarHistorial(null, email, 'LOGIN_FALLIDO', 'Credenciales inválidas');
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    if (data.password !== password) {
      await registrarHistorial(data.id, email, 'LOGIN_FALLIDO', 'Contraseña incorrecta');
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // LOGIN EXITOSO
    await actualizarUltimoLogin(data.id, email);
    await registrarHistorial(data.id, email, 'LOGIN_EXITOSO', `Usuario: ${data.name}`);
    
    const token = jwt.sign({ id: data.id, email: data.email, role: data.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        id: data.id, 
        email: data.email, 
        role: data.role,
        primer_login: data.primer_login
      } 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CAMBIAR CONTRASEÑA EN PRIMER LOGIN
app.post('/api/auth/cambiar-contraseña-primer-login', verifyToken, async (req, res) => {
  try {
    const { nueva_contraseña, confirmacion_contraseña } = req.body;
    
    if (nueva_contraseña !== confirmacion_contraseña) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }
    
    if (!nueva_contraseña || nueva_contraseña.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    const { data: userData } = await supabase
      .from('usuarios')
      .select('email')
      .eq('id', req.user.id)
      .single();
    
    const { error } = await supabase
      .from('usuarios')
      .update({ 
        password: nueva_contraseña, 
        primer_login: false,
        cambio_contraseña_fecha: new Date().toISOString()
      })
      .eq('id', req.user.id);
    
    if (error) throw error;
    
    await registrarHistorial(req.user.id, userData.email, 'CAMBIO_CONTRASEÑA', 'Contraseña actualizada en primer login');
    
    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET HISTORIAL (SOLO ADMIN)
app.get('/api/historial', verifyToken, async (req, res) => {
  try {
    const { data: adminData } = await supabase
      .from('usuarios')
      .select('role')
      .eq('id', req.user.id)
      .single();
    
    if (adminData?.role !== 'admin') {
      return res.status(403).json({ error: 'Solo admins pueden ver el historial' });
    }
    
    const { data, error } = await supabase
      .from('historial')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(500);
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET USUARIOS CON ESTADO (SOLO ADMIN)
app.get('/api/usuarios-estado', verifyToken, async (req, res) => {
  try {
    const { data: adminData } = await supabase
      .from('usuarios')
      .select('role')
      .eq('id', req.user.id)
      .single();
    
    if (adminData?.role !== 'admin') {
      return res.status(403).json({ error: 'Solo admins pueden ver esto' });
    }
    
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, email, name, role, estado, ultimo_login, primer_login, cambio_contraseña_fecha')
      .order('email');
    
    if (error) throw error;
    
    // Calcular tiempo offline
    const usuariosConEstado = data.map(u => {
      const ultimoLogin = u.ultimo_login ? new Date(u.ultimo_login) : null;
      const ahora = new Date();
      let minutosOffline = 0;
      
      if (ultimoLogin) {
        minutosOffline = Math.floor((ahora - ultimoLogin) / (1000 * 60));
      }
      
      return {
        ...u,
        minutos_offline: minutosOffline,
        horas_offline: Math.floor(minutosOffline / 60),
        activo: minutosOffline < 30 ? 'Sí' : 'No'
      };
    });
    
    res.json(usuariosConEstado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET CAMIONES
app.get('/api/camiones', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('camiones').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST CAMIONES
app.post('/api/camiones', verifyToken, async (req, res) => {
  try {
    const { placa, modelo, capacidad, status } = req.body;
    const { data, error } = await supabase
      .from('camiones')
      .insert([{ placa, modelo, capacidad, status: status || 'activo' }])
      .select();
    if (error) throw error;
    
    const { data: userData } = await supabase
      .from('usuarios')
      .select('email')
      .eq('id', req.user.id)
      .single();
    
    await registrarHistorial(req.user.id, userData.email, 'CREAR_CAMION', `Placa: ${placa}`);
    
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST COMBUSTIBLE
app.post('/api/combustible', verifyToken, async (req, res) => {
  try {
    const { truck_id, liters, cost } = req.body;
    const { data, error } = await supabase
      .from('combustible')
      .insert([{ truck_id, liters, cost, fecha: new Date().toISOString() }])
      .select();
    if (error) throw error;
    
    const { data: userData } = await supabase
      .from('usuarios')
      .select('email')
      .eq('id', req.user.id)
      .single();
    
    await registrarHistorial(req.user.id, userData.email, 'REGISTRAR_COMBUSTIBLE', `Camión: ${truck_id}, ${liters}L`);
    
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', backend: 'BQTEXPRESS Fleet', time: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend BQTEXPRESS corriendo en puerto ${PORT}`);
});

module.exports = app;
