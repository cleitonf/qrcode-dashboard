import React, { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Componente de Login
const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLogin(data.token, data.user);
      } else {
        setError(data.error || 'Erro ao fazer login');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Dashboard QR Codes</h2>
        <div className="login-form">
          <div className="form-group">
            <label>Usuário:</label>
            <input
              type="text"
              value={credentials.username}
              onChange={(e) => setCredentials({...credentials, username: e.target.value})}
              disabled={loading}
              onKeyPress={handleKeyPress}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label>Senha:</label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({...credentials, password: e.target.value})}
              disabled={loading}
              onKeyPress={handleKeyPress}
              className="form-input"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button onClick={handleSubmit} disabled={loading} className="login-button">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </div>
      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .login-card {
          background: white;
          padding: 2rem;
          border-radius: 10px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          width: 100%;
          max-width: 400px;
        }
        .login-card h2 {
          text-align: center;
          margin-bottom: 2rem;
          color: #333;
        }
        .form-group {
          margin-bottom: 1rem;
        }
        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          color: #555;
          font-weight: 500;
        }
        .form-input {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #ddd;
          border-radius: 5px;
          font-size: 1rem;
          transition: border-color 0.3s;
          box-sizing: border-box;
        }
        .form-input:focus {
          outline: none;
          border-color: #667eea;
        }
        .form-input:disabled {
          background-color: #f5f5f5;
          cursor: not-allowed;
        }
        .login-button {
          width: 100%;
          padding: 0.75rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 5px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: transform 0.2s;
          margin-top: 1rem;
        }
        .login-button:hover:not(:disabled) {
          transform: translateY(-2px);
        }
        .login-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .error-message {
          color: #dc3545;
          text-align: center;
          margin-top: 1rem;
          padding: 0.5rem;
          background-color: #f8d7da;
          border-radius: 5px;
        }
        .login-help {
          margin-top: 1.5rem;
          font-size: 0.9rem;
          color: #666;
          text-align: center;
        }
      `}</style>
    </div>
  );
};

// Componente de Dashboard
const Dashboard = ({ token, user, onLogout }) => {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});
  const [attractions, setAttractions] = useState([]);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    attractionId: 'all'
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAttractionManager, setShowAttractionManager] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingData, setEditingData] = useState(null);
  const [newAttraction, setNewAttraction] = useState('');
  const [newData, setNewData] = useState({
    attractionId: '',
    date: '',
    qrcodesDelivered: '',
    salesMade: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const apiCall = async (endpoint, options = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401) {
      onLogout();
      return null;
    }

    return response.json();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.attractionId !== 'all') params.append('attractionId', filters.attractionId);

      const [dashboardData, summaryData] = await Promise.all([
        apiCall(`/dashboard-data?${params}`),
        apiCall(`/summary?${params}`)
      ]);

      if (dashboardData && Array.isArray(dashboardData)) {
        console.log('Dados recebidos:', dashboardData);
        setData(dashboardData);
      } else {
        console.error('Dashboard data inválido:', dashboardData);
        setData([]);
      }
      
      if (summaryData) {
        setSummary(summaryData);
      } else {
        setSummary({});
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setData([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  };

  const loadAttractions = async () => {
    try {
      const attractions = await apiCall('/attractions');
      if (attractions) {
        setAttractions(attractions);
      }
    } catch (err) {
      console.error('Erro ao carregar atrações:', err);
    }
  };

  const handleAddData = async () => {
    if (!newData.attractionId || !newData.date || !newData.qrcodesDelivered || !newData.salesMade) {
      setMessage('Todos os campos são obrigatórios');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const result = await apiCall('/daily-data', {
        method: 'POST',
        body: JSON.stringify({
          attractionId: parseInt(newData.attractionId),
          date: newData.date,
          qrcodesDelivered: parseInt(newData.qrcodesDelivered),
          salesMade: parseInt(newData.salesMade)
        })
      });

      if (result) {
        setMessage(result.message);
        setNewData({
          attractionId: '',
          date: '',
          qrcodesDelivered: '',
          salesMade: ''
        });
        setShowAddForm(false);
        loadData();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Erro ao adicionar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAttraction = async () => {
    if (!newAttraction.trim()) {
      setMessage('Nome da atração é obrigatório');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setLoading(true);
    try {
      const result = await apiCall('/attractions', {
        method: 'POST',
        body: JSON.stringify({ name: newAttraction.trim() })
      });

      if (result) {
        setMessage('Atração adicionada com sucesso!');
        setNewAttraction('');
        loadAttractions();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Erro ao adicionar atração');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAttraction = async (id, name) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${name}"?`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await apiCall(`/attractions/${id}`, {
        method: 'DELETE'
      });

      if (result) {
        setMessage(result.message);
        loadAttractions();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage(err.error || 'Erro ao excluir atração');
    } finally {
      setLoading(false);
    }
  };

  const handleEditData = (item) => {
    setEditingData({
      id: item.id,
      attractionId: item.attraction_id,
      date: item.date,
      qrcodesDelivered: item.qrcodes_delivered,
      salesMade: item.sales_made
    });
    setShowEditForm(true);
  };

  const handleUpdateData = async () => {
    if (!editingData.attractionId || !editingData.date || !editingData.qrcodesDelivered || !editingData.salesMade) {
      setMessage('Todos os campos são obrigatórios');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const result = await apiCall(`/daily-data/${editingData.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          attractionId: parseInt(editingData.attractionId),
          date: editingData.date,
          qrcodesDelivered: parseInt(editingData.qrcodesDelivered),
          salesMade: parseInt(editingData.salesMade)
        })
      });

      if (result) {
        setMessage(result.message);
        setEditingData(null);
        setShowEditForm(false);
        loadData();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Erro ao atualizar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteData = async (id, date, attractionName) => {
    if (!window.confirm(`Tem certeza que deseja excluir os dados de ${attractionName} do dia ${formatDate(date)}?`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await apiCall(`/daily-data/${id}`, {
        method: 'DELETE'
      });

      if (result) {
        setMessage(result.message);
        loadData();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Erro ao excluir dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttractions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const formatDate = (dateString) => {
  if (!dateString) return '';
  
  // Se é string no formato YYYY-MM-DD, processar diretamente
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
    const [year, month, day] = dateString.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  }
  
  // Para outros formatos, tentar converter
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return dateString;
  }
  
  // Ajustar para timezone local para evitar problemas de UTC
  const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  const day = localDate.getDate().toString().padStart(2, '0');
  const month = (localDate.getMonth() + 1).toString().padStart(2, '0');
  const year = localDate.getFullYear();
  
  return `${day}/${month}/${year}`;
};

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Dashboard QR Codes</h1>
          <p>Bem-vindo, {user.username}</p>
        </div>
        <button onClick={onLogout} className="logout-button">Sair</button>
      </header>

      {message && <div className={message.includes('Erro') ? 'error-message' : 'success-message'}>{message}</div>}

      <div className="controls">
        <div className="filters">
          <div className="filter-group">
            <label>Data Início:</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label>Data Fim:</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label>Atração:</label>
            <select
              value={filters.attractionId}
              onChange={(e) => setFilters({...filters, attractionId: e.target.value})}
              className="filter-select"
            >
              <option value="all">Todas as Atrações</option>
              {attractions.map(attraction => (
                <option key={attraction.id} value={attraction.id}>
                  {attraction.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button 
          onClick={() => setShowAddForm(true)} 
          className="add-button"
        >
          + Adicionar Dados
        </button>
        <button 
          onClick={() => setShowAttractionManager(true)} 
          className="manage-button"
        >
          🏛️ Gerenciar Atrações
        </button>
      </div>

      {summary && (
        <div className="summary">
          <div className="summary-card">
            <h3>Total QR Codes</h3>
            <div className="summary-value">{summary.total_qrcodes || 0}</div>
          </div>
          <div className="summary-card">
            <h3>Total Vendas</h3>
            <div className="summary-value">{summary.total_sales || 0}</div>
          </div>
          <div className="summary-card">
            <h3>Taxa de Conversão</h3>
            <div className="summary-value">{summary.avg_conversion_rate || 0}%</div>
          </div>
          <div className="summary-card">
            <h3>Dias com Dados</h3>
            <div className="summary-value">{summary.total_days || 0}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Atração</th>
                <th>QR Codes Entregues</th>
                <th>Vendas Realizadas</th>
                <th>Taxa de Conversão</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={item.id || index}>
                  <td>{formatDate(item.date)}</td>
                  <td>{item.attraction_name}</td>
                  <td>{item.qrcodes_delivered}</td>
                  <td>{item.sales_made}</td>
                  <td className="conversion-rate">{item.conversion_rate}%</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        onClick={() => handleEditData(item)}
                        className="edit-button"
                        disabled={loading}
                        title="Editar dados"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDeleteData(item.id, item.date, item.attraction_name)}
                        className="delete-small-button"
                        disabled={loading}
                        title="Excluir dados"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan="6" className="no-data">
                    Nenhum dado encontrado para os filtros selecionados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAttractionManager && (
        <div className="modal">
          <div className="modal-content">
            <h3>Gerenciar Atrações</h3>
            
            <div className="attraction-add">
              <h4>Adicionar Nova Atração</h4>
              <div className="add-attraction-form">
                <input
                  type="text"
                  placeholder="Nome da atração"
                  value={newAttraction}
                  onChange={(e) => setNewAttraction(e.target.value)}
                  className="form-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddAttraction()}
                />
                <button onClick={handleAddAttraction} disabled={loading} className="add-small-button">
                  {loading ? '...' : 'Adicionar'}
                </button>
              </div>
            </div>

            <div className="attraction-list">
              <h4>Atrações Existentes</h4>
              {attractions.length > 0 ? (
                <div className="attractions-grid">
                  {attractions.map(attraction => (
                    <div key={attraction.id} className="attraction-item">
                      <span>{attraction.name}</span>
                      <button 
                        onClick={() => handleDeleteAttraction(attraction.id, attraction.name)}
                        className="delete-button"
                        disabled={loading}
                        title="Excluir atração"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-attractions">Nenhuma atração cadastrada</p>
              )}
            </div>

            <div className="form-buttons">
              <button onClick={() => setShowAttractionManager(false)} className="cancel-button">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditForm && editingData && (
        <div className="modal">
          <div className="modal-content">
            <h3>Editar Dados</h3>
            <div className="edit-form">
              <div className="form-group">
                <label>Atração:</label>
                <select
                  value={editingData.attractionId}
                  onChange={(e) => setEditingData({...editingData, attractionId: e.target.value})}
                  className="form-select"
                >
                  <option value="">Selecione uma atração</option>
                  {attractions.map(attraction => (
                    <option key={attraction.id} value={attraction.id}>
                      {attraction.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Data:</label>
                <input
                  type="date"
                  value={editingData.date}
                  onChange={(e) => setEditingData({...editingData, date: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>QR Codes Entregues:</label>
                <input
                  type="number"
                  min="0"
                  value={editingData.qrcodesDelivered}
                  onChange={(e) => setEditingData({...editingData, qrcodesDelivered: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Vendas Realizadas:</label>
                <input
                  type="number"
                  min="0"
                  value={editingData.salesMade}
                  onChange={(e) => setEditingData({...editingData, salesMade: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="form-buttons">
                <button onClick={() => {
                  setShowEditForm(false);
                  setEditingData(null);
                }} className="cancel-button">
                  Cancelar
                </button>
                <button onClick={handleUpdateData} disabled={loading} className="save-button">
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="modal">
          <div className="modal-content">
            <h3>Adicionar Novos Dados</h3>
            <div className="add-form">
              <div className="form-group">
                <label>Atração:</label>
                <select
                  value={newData.attractionId}
                  onChange={(e) => setNewData({...newData, attractionId: e.target.value})}
                  className="form-select"
                >
                  <option value="">Selecione uma atração</option>
                  {Array.isArray(attractions) && attractions.map(attraction => (
                    <option key={attraction.id} value={attraction.id}>
                      {attraction.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Data:</label>
                <input
                  type="date"
                  value={newData.date}
                  onChange={(e) => setNewData({...newData, date: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>QR Codes Entregues:</label>
                <input
                  type="number"
                  min="0"
                  value={newData.qrcodesDelivered}
                  onChange={(e) => setNewData({...newData, qrcodesDelivered: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Vendas Realizadas:</label>
                <input
                  type="number"
                  min="0"
                  value={newData.salesMade}
                  onChange={(e) => setNewData({...newData, salesMade: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="form-buttons">
                <button onClick={() => setShowAddForm(false)} className="cancel-button">
                  Cancelar
                </button>
                <button onClick={handleAddData} disabled={loading} className="save-button">
                  {loading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .dashboard {
          min-height: 100vh;
          background-color: #f8f9fa;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .dashboard-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1.5rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .dashboard-header h1 {
          margin: 0;
          font-size: 1.8rem;
        }
        .dashboard-header p {
          margin: 0.5rem 0 0 0;
          opacity: 0.9;
        }
        .logout-button {
          background: rgba(255,255,255,0.2);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 5px;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        .logout-button:hover {
          background: rgba(255,255,255,0.3);
        }
        .success-message, .error-message {
          margin: 1rem 2rem;
          padding: 1rem;
          border-radius: 5px;
          text-align: center;
        }
        .success-message {
          background-color: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        .controls {
          padding: 1.5rem 2rem;
          background: white;
          margin: 1rem 2rem;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .filters {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .filter-group {
          display: flex;
          flex-direction: column;
        }
        .filter-group label {
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #333;
        }
        .filter-input, .filter-select {
          padding: 0.5rem;
          border: 2px solid #ddd;
          border-radius: 5px;
          min-width: 150px;
          transition: border-color 0.3s;
        }
        .filter-input:focus, .filter-select:focus {
          outline: none;
          border-color: #667eea;
        }
        .add-button {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 5px;
          cursor: pointer;
          font-weight: 500;
          transition: transform 0.2s;
        }
        .add-button:hover {
          transform: translateY(-2px);
        }
        .manage-button {
          background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 5px;
          cursor: pointer;
          font-weight: 500;
          transition: transform 0.2s;
          margin-left: 1rem;
        }
        .manage-button:hover {
          transform: translateY(-2px);
        }
        .summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
          margin: 1rem 2rem;
        }
        .summary-card {
          background: white;
          padding: 1.5rem;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          text-align: center;
        }
        .summary-card h3 {
          margin: 0 0 1rem 0;
          color: #666;
          font-size: 1rem;
          font-weight: 500;
        }
        .summary-value {
          font-size: 2rem;
          font-weight: bold;
          color: #333;
        }
        .data-table {
          margin: 1rem 2rem;
          background: white;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          overflow: hidden;
        }
        .data-table table {
          width: 100%;
          border-collapse: collapse;
        }
        .data-table th {
          background: #f8f9fa;
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          color: #333;
          border-bottom: 2px solid #dee2e6;
        }
        .data-table td {
          padding: 1rem;
          border-bottom: 1px solid #dee2e6;
        }
        .data-table tbody tr:hover {
          background-color: #f8f9fa;
        }
        .conversion-rate {
          font-weight: 600;
          color: #28a745;
        }
        .no-data {
          text-align: center;
          color: #666;
          font-style: italic;
        }
        .loading {
          text-align: center;
          padding: 2rem;
          color: #666;
        }
        .modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background: white;
          padding: 2rem;
          border-radius: 10px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-content h3 {
          margin: 0 0 1.5rem 0;
          text-align: center;
          color: #333;
        }
        .add-form .form-group, .edit-form .form-group {
          margin-bottom: 1rem;
        }
        .add-form label, .edit-form label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #333;
        }
        .form-input, .form-select {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #ddd;
          border-radius: 5px;
          font-size: 1rem;
          transition: border-color 0.3s;
          box-sizing: border-box;
        }
        .form-input:focus, .form-select:focus {
          outline: none;
          border-color: #667eea;
        }
        .form-buttons {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
        }
        .cancel-button, .save-button {
          flex: 1;
          padding: 0.75rem;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-weight: 500;
          transition: transform 0.2s;
        }
        .cancel-button {
          background: #6c757d;
          color: white;
        }
        .save-button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .cancel-button:hover, .save-button:hover:not(:disabled) {
          transform: translateY(-2px);
        }
        .save-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .attraction-add {
          margin-bottom: 2rem;
        }
        .attraction-add h4, .attraction-list h4 {
          margin: 0 0 1rem 0;
          color: #333;
          font-size: 1.1rem;
        }
        .add-attraction-form {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        .add-attraction-form .form-input {
          flex: 1;
        }
        .add-small-button {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border: none;
          padding: 0.75rem 1rem;
          border-radius: 5px;
          cursor: pointer;
          font-weight: 500;
          white-space: nowrap;
        }
        .add-small-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .add-small-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .attraction-list {
          border-top: 1px solid #eee;
          padding-top: 1.5rem;
        }
        .attractions-grid {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 200px;
          overflow-y: auto;
        }
        .attraction-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: #f8f9fa;
          border-radius: 5px;
          border: 1px solid #e9ecef;
        }
        .attraction-item span {
          flex: 1;
          font-weight: 500;
        }
        .delete-button {
          background: #dc3545;
          color: white;
          border: none;
          padding: 0.5rem;
          border-radius: 3px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }
        .delete-button:hover:not(:disabled) {
          background: #c82333;
          transform: scale(1.1);
        }
        .delete-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .no-attractions {
          text-align: center;
          color: #666;
          font-style: italic;
          padding: 2rem;
        }
        .action-buttons {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
        }
        .edit-button, .delete-small-button {
          background: none;
          border: none;
          padding: 0.5rem;
          border-radius: 3px;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s;
        }
        .edit-button {
          background: #007bff;
          color: white;
        }
        .edit-button:hover:not(:disabled) {
          background: #0056b3;
          transform: scale(1.1);
        }
        .delete-small-button {
          background: #dc3545;
          color: white;
        }
        .delete-small-button:hover:not(:disabled) {
          background: #c82333;
          transform: scale(1.1);
        }
        .edit-button:disabled, .delete-small-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        @media (max-width: 768px) {
          .controls {
            flex-direction: column;
            align-items: stretch;
          }
          .filters {
            justify-content: space-between;
          }
          .summary {
            grid-template-columns: repeat(2, 1fr);
          }
          .data-table {
            overflow-x: auto;
          }
          .data-table table {
            min-width: 800px;
          }
          .action-buttons {
            flex-direction: column;
            gap: 0.25rem;
          }
          .edit-button, .delete-small-button {
            font-size: 0.8rem;
            padding: 0.25rem;
          }
          .modal-content {
            margin: 1rem;
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
};

// Componente Principal
const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(
    localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null
  );

  const handleLogin = (token, user) => {
    setToken(token);
    setUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  if (!token || !user) {
    return <Login onLogin={handleLogin} />;
  }

  return <Dashboard token={token} user={user} onLogout={handleLogout} />;
};

export default App;
