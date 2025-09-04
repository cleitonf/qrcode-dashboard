const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'MinhaChaveSecreta123';

// Middleware
app.use(cors());
app.use(express.json());

// Inicializar banco SQLite
const db = new sqlite3.Database('./database.sqlite');

// Criar tabelas
db.serialize(() => {
  // Tabela de usuários
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabela de atrações
  db.run(`CREATE TABLE IF NOT EXISTS attractions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabela de dados diários
  db.run(`CREATE TABLE IF NOT EXISTS daily_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attraction_id INTEGER,
    date DATE NOT NULL,
    qrcodes_delivered INTEGER DEFAULT 0,
    sales_made INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attraction_id) REFERENCES attractions (id)
  )`);

  // Inserir usuário admin padrão (senha: admin123)
  const adminPassword = bcrypt.hashSync('admin.vyoo', 10);
  db.run(`INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)`, 
    ['admin', adminPassword]);

  // Não inserir atrações de exemplo - o usuário pode adicionar pela interface
});

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
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username } });
  });
});

// Rotas protegidas
app.get('/api/attractions', authenticateToken, (req, res) => {
  db.all('SELECT * FROM attractions ORDER BY name', (err, attractions) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar atrações' });
    }
    res.json(attractions);
  });
});

app.post('/api/attractions', authenticateToken, (req, res) => {
  const { name } = req.body;
  
  db.run('INSERT INTO attractions (name) VALUES (?)', [name], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Erro ao criar atração' });
    }
    res.json({ id: this.lastID, name });
  });
});

app.get('/api/dashboard-data', authenticateToken, (req, res) => {
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
  
  if (startDate) {
    query += ' AND d.date >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND d.date <= ?';
    params.push(endDate);
  }
  
  if (attractionId && attractionId !== 'all') {
    query += ' AND d.attraction_id = ?';
    params.push(attractionId);
  }
  
  query += ' ORDER BY d.date DESC, a.name';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar dados' });
    }
    res.json(rows);
  });
});

app.put('/api/daily-data/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { attractionId, date, qrcodesDelivered, salesMade } = req.body;
  
  db.run(
    'UPDATE daily_data SET attraction_id = ?, date = ?, qrcodes_delivered = ?, sales_made = ? WHERE id = ?',
    [attractionId, date, qrcodesDelivered, salesMade, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao atualizar dados' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Registro não encontrado' });
      }
      
      res.json({ message: 'Dados atualizados com sucesso' });
    }
  );
});

app.delete('/api/daily-data/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM daily_data WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Erro ao excluir dados' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }
    
    res.json({ message: 'Dados excluídos com sucesso' });
  });
});

app.post('/api/daily-data', authenticateToken, (req, res) => {
  const { attractionId, date, qrcodesDelivered, salesMade } = req.body;
  
  console.log('Dados recebidos:', { attractionId, date, qrcodesDelivered, salesMade }); // Debug
  
  // Verificar se já existe dados para esta atração nesta data
  db.get(
    'SELECT id FROM daily_data WHERE attraction_id = ? AND date = ?',
    [attractionId, date],
    (err, existing) => {
      if (err) {
        console.error('Erro ao verificar dados existentes:', err);
        return res.status(500).json({ error: 'Erro ao verificar dados existentes' });
      }
      
      if (existing) {
        // Atualizar dados existentes
        db.run(
          'UPDATE daily_data SET qrcodes_delivered = ?, sales_made = ? WHERE id = ?',
          [qrcodesDelivered, salesMade, existing.id],
          function(err) {
            if (err) {
              console.error('Erro ao atualizar dados:', err);
              return res.status(500).json({ error: 'Erro ao atualizar dados' });
            }
            console.log('Dados atualizados para ID:', existing.id);
            res.json({ message: 'Dados atualizados com sucesso' });
          }
        );
      } else {
        // Inserir novos dados
        db.run(
          'INSERT INTO daily_data (attraction_id, date, qrcodes_delivered, sales_made) VALUES (?, ?, ?, ?)',
          [attractionId, date, qrcodesDelivered, salesMade],
          function(err) {
            if (err) {
              console.error('Erro ao inserir dados:', err);
              return res.status(500).json({ error: 'Erro ao inserir dados' });
            }
            console.log('Dados inseridos com ID:', this.lastID);
            res.json({ message: 'Dados inseridos com sucesso', id: this.lastID });
          }
        );
      }
    }
  );
});

app.get('/api/summary', authenticateToken, (req, res) => {
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
  
  if (startDate) {
    query += ' AND d.date >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND d.date <= ?';
    params.push(endDate);
  }
  
  if (attractionId && attractionId !== 'all') {
    query += ' AND d.attraction_id = ?';
    params.push(attractionId);
  }
  
  db.get(query, params, (err, summary) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar resumo' });
    }
    res.json(summary);
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});