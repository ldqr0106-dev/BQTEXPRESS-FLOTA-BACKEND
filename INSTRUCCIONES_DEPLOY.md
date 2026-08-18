# 🚀 Guía de Deploy - Backend Axioma Fleet

## Paso 1: Crear Base de Datos en Supabase (10 min)

1. Ve a **supabase.com**
2. Crea un nuevo proyecto
3. Espera a que se cree (5-10 min)
4. Copia tu **Project URL** y **Anon Key**

## Paso 2: Crear Tablas en Supabase

En Supabase, ve a **SQL Editor** y ejecuta esto:

```sql
-- Usuarios
CREATE TABLE usuarios (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password VARCHAR NOT NULL,
  name VARCHAR,
  role VARCHAR DEFAULT 'conductor',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Camiones
CREATE TABLE camiones (
  id BIGSERIAL PRIMARY KEY,
  placa VARCHAR UNIQUE NOT NULL,
  modelo VARCHAR,
  capacidad INT,
  status VARCHAR DEFAULT 'activo',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Combustible
CREATE TABLE combustible (
  id BIGSERIAL PRIMARY KEY,
  truck_id BIGINT REFERENCES camiones(id),
  liters INT,
  cost DECIMAL,
  fecha TIMESTAMP DEFAULT NOW()
);

-- Mantenimiento
CREATE TABLE mantenimiento (
  id BIGSERIAL PRIMARY KEY,
  truck_id BIGINT REFERENCES camiones(id),
  service VARCHAR,
  cost DECIMAL,
  fecha TIMESTAMP DEFAULT NOW(),
  next_date DATE
);

-- Tareas
CREATE TABLE tareas (
  id BIGSERIAL PRIMARY KEY,
  truck_id BIGINT REFERENCES camiones(id),
  driver_id BIGINT REFERENCES usuarios(id),
  origin VARCHAR,
  destination VARCHAR,
  status VARCHAR DEFAULT 'pendiente',
  fecha TIMESTAMP DEFAULT NOW()
);

-- Fotos
CREATE TABLE fotos (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT REFERENCES tareas(id),
  url VARCHAR,
  caption VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Paso 3: Crear Storage en Supabase (para fotos)

1. En Supabase, ve a **Storage**
2. Crea un nuevo bucket llamado **fotos**
3. Haz clic en el bucket → **Policies**
4. Selecciona **Enable read access for all users**

## Paso 4: Subir código a GitHub

### Opción A: Usando Git (Recomendado)

1. Copia los 3 archivos:
   - `server.js`
   - `package.json`
   - `.env.example`

2. En tu computadora, abre terminal:
```bash
mkdir axioma-flota-backend
cd axioma-flota-backend

git init
git config user.name "Tu nombre"
git config user.email "tu@email.com"

# Pega los archivos aquí

git add .
git commit -m "Initial commit: backend setup"
```

3. En GitHub:
   - Ve a github.com → New Repository
   - Llámalo `axioma-flota-backend`
   - NO inicialices con README
   - Copia el comando que te da:

```bash
git remote add origin https://github.com/tuusuario/axioma-flota-backend.git
git branch -M main
git push -u origin main
```

## Paso 5: Deployar en Vercel

1. Ve a **vercel.com**
2. Haz clic en **Add New** → **Project**
3. Selecciona tu repositorio `axioma-flota-backend`
4. En **Environment Variables**, agrega:
   - `SUPABASE_URL` = (tu URL de Supabase)
   - `SUPABASE_KEY` = (tu Anon Key de Supabase)
   - `JWT_SECRET` = (inventa una contraseña larga)
5. Haz clic en **Deploy**

**¡Listo! Tu backend está en el aire** 🎉

Tu URL será algo como: `https://axioma-flota-backend-xxxxx.vercel.app`

## Paso 6: Actualizar el Frontend

En el prototipo que te mostré, cambiar estas URLs:

```javascript
// De esto:
const API_URL = 'http://localhost:3001';

// A esto:
const API_URL = 'https://axioma-flota-backend-xxxxx.vercel.app';
```

## Paso 7: Probar API

Abre en tu navegador:
```
https://tu-backend-url.vercel.app/api/health
```

Si ves `{"status":"OK"...}` ¡Todo funciona!

## 📝 Endpoints disponibles

- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario
- `GET /api/camiones` - Listar camiones
- `POST /api/camiones` - Crear camión
- `GET /api/combustible` - Listar combustible
- `POST /api/combustible` - Registrar combustible
- `GET /api/mantenimiento` - Listar mantenimiento
- `POST /api/mantenimiento` - Registrar mantenimiento
- `GET /api/tareas` - Listar tareas
- `POST /api/tareas` - Crear tarea
- `GET /api/fotos/:task_id` - Listar fotos de una tarea

## ⚠️ Importante

- NUNCA compartas tu `SUPABASE_KEY` en público
- Usa diferentes claves para desarrollo y producción
- En producción, usar bcrypt para contraseñas
- Cambiar `JWT_SECRET` por algo seguro

## Soporte

Si tienes problemas:
1. Revisa los logs en Vercel (Deployments → Logs)
2. Verifica que las tablas en Supabase existan
3. Confirma que SUPABASE_URL y SUPABASE_KEY sean correctas
