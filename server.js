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

const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro-cambiar-en-produccion';

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

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !data) {
      return res.status(401).json({ error: 'Email o contraseña inválidos' });
    }
    
    if (data.password !== password) {
      return res.status(401).json({ error: 'Email o contraseña inválidos' });
    }
    
    const token = jwt.sign(
      { id: data.id, email: data.email, role: data.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ token, user: { id: data.id, email: data.email, role: data.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    
    const { data, error } = await supabase
      .from('usuarios')
      .insert([
        { email, password, name, role: role || 'conductor' }
      ])
      .select();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    const token = jwt.sign(
      { id: data[0].id, email: data[0].email, role: data[0].role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ token, user: { id: data[0].id, email: data[0].email, role: data[0].role } });
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

app.put('/api/camiones/:id', verifyToken, async (req, res) => {
  try {
    const { placa, modelo, capacidad, status } = req.body;
    const { data, error } = await supabase
      .from('camiones')
      .update({ placa, modelo, capacidad, status })
      .eq('id', req.params.id)
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

app.get('/api/autonomia/:truck_id', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('combustible')
      .select('liters')
      .eq('truck_id', req.params.truck_id);
    
    if (error) throw error;
    
    const totalLiters = data.reduce((sum, row) => sum + row.liters, 0);
    const autonomia = totalLiters * 5;
    
    res.json({ truck_id: req.params.truck_id, total_liters: totalLiters, estimated_km: autonomia });
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

app.put('/api/tareas/:id', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const { data, error } = await supabase
      .from('tareas')
      .update({ status })
      .eq('id', req.params.id)
      .select();
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fotos', verifyToken, async (req, res) => {
  try {
    const { task_id, caption } = req.body;
    
    if (!req.files || !req.files.foto) {
      return res.status(400).json({ error: 'No hay archivo' });
    }
    
    const file = req.files.foto;
    const filename = `${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('fotos')
      .upload(`tareas/${filename}`, file.data);
    
    if (uploadError) throw uploadError;
    
    const { data, error } = await supabase
      .from('fotos')
      .insert([{ task_id, url: filename, caption }])
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fotos/:task_id', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('fotos')
      .select('*')
      .eq('task_id', req.params.task_id);
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
