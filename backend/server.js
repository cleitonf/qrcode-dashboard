const express = require('express');
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'MinhaChaveSecreta123';

// Configuração do PostgreSQL
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Conectar ao banco
client.connect()
  .then(() => console.log('Conectado ao PostgreSQL'))
  .catch(err => console.error('Erro ao conectar ao PostgreSQL:', err));

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://sua-url.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());

// Criar tabelas
const createTables = async () => {
  try {
    // Tabela de usuários
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de atrações
    await client.query(`
      CREATE TABLE IF NOT EXISTS attractions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de dados diários
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_data (
        id SERIAL PRIMARY KEY,
        attraction_id INTEGER REFERENCES attractions(id),
        date DATE NOT NULL,
        qrcodes_delivered INTEGER DEFAULT 0,
        sales_made INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Inserir usuário admin se não existir
    const adminPassword = bcrypt.hashSync('admin.vyoo', 10);
    await client.query(`
      INSERT INTO users (username, password) 
      VALUES ($1, $2) 
      ON CONFLICT (username) DO NOTHING
    `, ['admin', adminPassword]);

    console.log('Tabelas criadas com sucesso');
  } catch (err) {
    console.error('Erro ao criar tabelas:', err);
  }
};

createTables();

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

// Rotas de autenticação
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rotas protegidas
app.get('/api/attractions', authenticateToken, async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM attractions ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar atrações:', err);
    res.status(500).json({ error: 'Erro ao buscar atrações' });
  }
});

app.post('/api/attractions', authenticateToken, async (req, res) => {
  const { name } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nome da atração é obrigatório' });
  }
  
  try {
    const result = await client.query(
      'INSERT INTO attractions (name) VALUES ($1) RETURNING id, name',
      [name.trim()]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar atração:', err);
    res.status(500).json({ error: 'Erro ao criar atração' });
  }
});

app.delete('/api/attractions/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Verificar se a atração tem dados associados
    const checkData = await client.query('SELECT COUNT(*) as count FROM daily_data WHERE attraction_id = $1', [id]);
    
    if (parseInt(checkData.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Não é possível excluir atração com dados associados' });
    }
    
    const result = await client.query('DELETE FROM attractions WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Atração não encontrada' });
    }
    
    res.json({ message: 'Atração excluída com sucesso' });
  } catch (err) {
    console.error('Erro ao excluir atração:', err);
    res.status(500).json({ error: 'Erro ao excluir atração' });
  }
});

app.get('/api/dashboard-data', authenticateToken, async (req, res) => {
  const { startDate, endDate, attractionId } = req.query;
  
  let query = `
    SELECT 
      d.id,
      d.date,
      a.name as attraction_name,
      d.attraction_id,
      d.qrcodes_delivered,
      d.sales_made,
      CASE 
        WHEN d.qrcodes_delivered > 0 
        THEN ROUND((d.sales_made * 100.0 / d.qrcodes_delivered), 2) 
        ELSE 0 
      END as conversion_rate
    FROM daily_data d
    JOIN attractions a ON d.attraction_id = a.id
    WHERE 1=1
  `;
  
  const params = [];
  let paramCount = 0;
  
  if (startDate) {
    paramCount++;
    query += ` AND d.date >= $${paramCount}`;
    params.push(startDate);
  }
  
  if (endDate) {
    paramCount++;
    query += ` AND d.date <= $${paramCount}`;
    params.push(endDate);
  }
  
  if (attractionId && attractionId !== 'all') {
    paramCount++;
    query += ` AND d.attraction_id = $${paramCount}`;
    params.push(attractionId);
  }
  
  query += ' ORDER BY d.date DESC, a.name';
  
  try {
    const result = await client.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar dados:', err);
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
});

app.post('/api/daily-data', authenticateToken, async (req, res) => {
  const { attractionId, date, qrcodesDelivered, salesMade } = req.body;
  
  try {
    // Verificar se já existe dados para esta atração nesta data
    const existing = await client.query(
      'SELECT id FROM daily_data WHERE attraction_id = $1 AND date = $2',
      [attractionId, date]
    );
    
    if (existing.rows.length > 0) {
      // Atualizar dados existentes
      await client.query(
        'UPDATE daily_data SET qrcodes_delivered = $1, sales_made = $2 WHERE id = $3',
        [qrcodesDelivered, salesMade, existing.rows[0].id]
      );
      res.json({ message: 'Dados atualizados com sucesso' });
    } else {
      // Inserir novos dados
      const result = await client.query(
        'INSERT INTO daily_data (attraction_id, date, qrcodes_delivered, sales_made) VALUES ($1, $2, $3, $4) RETURNING id',
        [attractionId, date, qrcodesDelivered, salesMade]
      );
      res.json({ message: 'Dados inseridos com sucesso', id: result.rows[0].id });
    }
  } catch (err) {
    console.error('Erro ao inserir/atualizar dados:', err);
    res.status(500).json({ error: 'Erro ao processar dados' });
  }
});

app.put('/api/daily-data/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { attractionId, date, qrcodesDelivered, salesMade } = req.body;
  
  try {
    const result = await client.query(
      'UPDATE daily_data SET attraction_id = $1, date = $2, qrcodes_delivered = $3, sales_made = $4 WHERE id = $5',
      [attractionId, date, qrcodesDelivered, salesMade, id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }
    
    res.json({ message: 'Dados atualizados com sucesso' });
  } catch (err) {
    console.error('Erro ao atualizar dados:', err);
    res.status(500).json({ error: 'Erro ao atualizar dados' });
  }
});

app.delete('/api/daily-data/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await client.query('DELETE FROM daily_data WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }
    
    res.json({ message: 'Dados excluídos com sucesso' });
  } catch (err) {
    console.error('Erro ao excluir dados:', err);
    res.status(500).json({ error: 'Erro ao excluir dados' });
  }
});

app.get('/api/summary', authenticateToken, async (req, res) => {
  const { startDate, endDate, attractionId } = req.query;
  
  let query = `
    SELECT 
      COUNT(*) as total_days,
      SUM(qrcodes_delivered) as total_qrcodes,
      SUM(sales_made) as total_sales,
      CASE 
        WHEN SUM(qrcodes_delivered) > 0 
        THEN ROUND((SUM(sales_made) * 100.0 / SUM(qrcodes_delivered)), 2) 
        ELSE 0 
      END as avg_conversion_rate
    FROM daily_data d
    WHERE 1=1
  `;
  
  const params = [];
  let paramCount = 0;
  
  if (startDate) {
    paramCount++;
    query += ` AND d.date >= $${paramCount}`;
    params.push(startDate);
  }
  
  if (endDate) {
    paramCount++;
    query += ` AND d.date <= $${paramCount}`;
    params.push(endDate);
  }
  
  if (attractionId && attractionId !== 'all') {
    paramCount++;
    query += ` AND d.attraction_id = $${paramCount}`;
    params.push(attractionId);
  }
  
  try {
    const result = await client.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar resumo:', err);
    res.status(500).json({ error: 'Erro ao buscar resumo' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
