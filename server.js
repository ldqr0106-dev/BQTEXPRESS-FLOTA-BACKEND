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
    res.json({ token, user: { id: data.id, email: data.email, role: data.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    
    // VALIDAR QUE EL EMAIL NO EXISTA YA
    const { data: existingUser, error: checkError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .single();
    
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    
    // SI NO EXISTE, CREAR EL USUARIO
    const { data, error } = await supabase
      .from('usuarios')
      .insert([{ email, password, name, role: role || 'conductor' }])
      .select();
    
    if (error) return res.status(400).json({ error: error.message });
    
    const token = jwt.sign({ id: data[0].id, email: data[0].email, role: data[0].role }, JWT_SECRET, { expiresIn: '7d' });
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
