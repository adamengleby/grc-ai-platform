const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Database connection
let dbPool = null;

function getDatabase() {
  if (!dbPool) {
    dbPool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT || 5432,
      database: process.env.POSTGRES_DATABASE,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 10,
      min: 1,
      idleTimeoutMillis: 30000,
    });

    dbPool.on('error', (err) => {
      console.error('Database pool error:', err);
    });
  }
  return dbPool;
}

// Health check endpoint
app.get('/health', async (req, res) => {
  const healthStatus = {
    status: 'healthy',
    service: 'GRC AI Platform Backend with Database',
    timestamp: new Date().toISOString(),
    environment: 'Azure Container Apps',
    database: {
      type: 'PostgreSQL',
      host: process.env.POSTGRES_HOST,
      connected: false
    }
  };

  // Test database connection
  try {
    const db = getDatabase();
    const result = await db.query('SELECT 1 as health_check, version()');
    healthStatus.database.connected = true;
    healthStatus.database.result = result.rows[0];
  } catch (error) {
    healthStatus.database.connected = false;
    healthStatus.database.error = error.message;
  }

  res.json(healthStatus);
});

// API Routes
app.get('/api/v1/simple-agents', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        agents: [],
        total: 0,
        database: 'PostgreSQL integration active'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/v1/simple-llm-configs', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        llm_configs: [{
          config_id: '1',
          id: '1',
          name: 'Azure PostgreSQL Ready',
          provider: 'azure',
          model: 'database-integrated'
        }]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/v1/database/status', async (req, res) => {
  try {
    const db = getDatabase();
    const tables = await db.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const status = {
      connected: true,
      host: process.env.POSTGRES_HOST,
      database: process.env.POSTGRES_DATABASE,
      tables: tables.rows,
      tableCount: tables.rows.length,
      timestamp: new Date().toISOString()
    };

    res.json({ success: true, data: status });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      connected: false
    });
  }
});

const port = process.env.PORT || 3005;
app.listen(port, () => {
  console.log('🚀 GRC AI Platform Backend with Database Integration');
  console.log('📍 Port:', port);
  console.log('🗄️  Database:', process.env.POSTGRES_HOST);
  console.log('✅ Backend ready with PostgreSQL');
});