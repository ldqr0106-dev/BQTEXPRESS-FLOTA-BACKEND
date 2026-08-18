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

// LOGIN - Retorna primer_login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !data) return res.status(401).json({ error: 'Credenciales inválidas' });
    if (data.password !== password) return res.status(401).json({ error: 'Credenciales inválidas' });
    
    const token = jwt.sign({ id: data.id, email: data.email, role: data.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        id: data.id, 
        email: data.email, 
        role: data.role,
        primer_login: data.primer_login // IMPORTANTE
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
    
    // Validar que las contraseñas coincidan
    if (nueva_contraseña !== confirmacion_contraseña) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }
    
    // Validar que la contraseña no esté vacía
    if (!nueva_contraseña || nueva_contraseña.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    // Actualizar contraseña y marcar primer_login como false
    const { error } = await supabase
      .from('usuarios')
      .update({ 
        password: nueva_contraseña, 
        primer_login: false 
      })
      .eq('id', req.user.id);
    
    if (error) throw error;
    
    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREAR USUARIO (Admin)
app.post('/api/auth/crear-usuario', verifyToken, async (req, res) => {
  try {
    // Validar que sea admin
    const { data: adminData } = await supabase
      .from('usuarios')
      .select('role')
      .eq('id', req.user.id)
      .single();
    
    if (adminData?.role !== 'admin') {
      return res.status(403).json({ error: 'Solo admins pueden crear usuarios' });
    }
    
    const { email, name, role } = req.body;
    const contraseña_defecto = 'BQTEXPRESS';
    
    // Validar que el email no exista
    const { data: existingUser } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .single();
    
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    
    // Crear usuario
    const { data, error } = await supabase
      .from('usuarios')
      .insert([{ 
        email, 
        password: contraseña_defecto, 
        name, 
        role: role || 'conductor',
        primer_login: true 
      }])
      .select();
    
    if (error) throw error;
    
    res.json({ 
      mensaje: 'Usuario creado correctamente',
      usuario: { email, name, role, contraseña_temporal: contraseña_defecto }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET USUARIOS (Solo admin)
app.get('/api/usuarios', verifyToken, async (req, res) => {
  try {
    const { data: adminData } = await supabase
      .from('usuarios')
      .select('role')
      .eq('id', req.user.id)
      .single();
    
    if (adminData?.role !== 'admin') {
      return res.status(403).json({ error: 'Solo admins pueden ver usuarios' });
    }
    
    const { data, error } = await supabase.from('usuarios').select('id, email, name, role, primer_login');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/camiones', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('camiones').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/camiones', verifyToken, async (req, res) => {
  try {
    const { placa, modelo, capacidad, status } = req.body;
    const { data, error } = await supabase
      .from('camiones')
      .insert([{ placa, modelo, capacidad, status: status || 'activo' }])
      .select();
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/combustible', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('combustible').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/combustible', verifyToken, async (req, res) => {
  try {
    const { truck_id, liters, cost } = req.body;
    const { data, error } = await supabase
      .from('combustible')
      .insert([{ truck_id, liters, cost, fecha: new Date().toISOString() }])
      .select();
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mantenimiento', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('mantenimiento').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mantenimiento', verifyToken, async (req, res) => {
  try {
    const { truck_id, service, cost, next_date } = req.body;
    const { data, error } = await supabase
      .from('mantenimiento')
      .insert([{ truck_id, service, cost, fecha: new Date().toISOString(), next_date }])
      .select();
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tareas', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('tareas').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tareas', verifyToken, async (req, res) => {
  try {
    const { truck_id, driver_id, origin, destination } = req.body;
    const { data, error } = await supabase
      .from('tareas')
      .insert([{ truck_id, driver_id, origin, destination, status: 'pendiente', fecha: new Date().toISOString() }])
      .select();
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', backend: 'Axioma Fleet', time: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend Axioma corriendo en puerto ${PORT}`);
});
