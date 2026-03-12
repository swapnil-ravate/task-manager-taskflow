import React, { useState, useEffect, useMemo, useCallback } from 'react';

const DEMO_EMAIL = 'demo@taskflow.com';
const DEMO_PASSWORD = 'demo123';

const CATEGORIES = ['Work', 'Personal', 'Study', 'Health', 'Finance', 'Other'];
const VIEWS = ['All Tasks', 'Pending', 'In Progress', 'Completed'];

async function apiFetch(url, options = {}) {
  const token = localStorage.getItem("tf_token");
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) {
      throw new Error("UNAUTHORIZED: " + (err.message || "Invalid or expired token"));
    }
    throw new Error(err.message || "Something went wrong");
  }
  return res.json();
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  
  const [tasks, setTasks] = useState([]);
  const [activeView, setActiveView] = useState('All Tasks');
  const [activeCategory, setActiveCategory] = useState(null); // null means all categories
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'dueDate', direction: 'asc' });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("tf_token");
    localStorage.removeItem("tf_user");
    setCurrentUser(null);
    setTasks([]);
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      setTasksLoading(true);
      const data = await apiFetch('http://localhost:5000/api/tasks');
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      if (error.message.startsWith("UNAUTHORIZED")) {
        handleLogout();
      }
    } finally {
      setTasksLoading(false);
    }
  }, [handleLogout]);

  useEffect(() => {
    const token = localStorage.getItem("tf_token");
    const userStr = localStorage.getItem("tf_user");
    if (token && userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
        loadTasks();
      } catch (e) {
        handleLogout();
      }
    }
    setLoading(false);
  }, [loadTasks, handleLogout]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!authForm.email || !authForm.password) {
      setAuthError('Please fill all required fields');
      return;
    }

    try {
      setIsAuthLoading(true);
      if (isLoginMode) {
        const data = await apiFetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: authForm.email, password: authForm.password })
        });
        localStorage.setItem("tf_token", data.token);
        localStorage.setItem("tf_user", JSON.stringify(data.user));
        setCurrentUser(data.user);
        loadTasks();
      } else {
        if (!authForm.name) {
          setAuthError('Name is required for signup');
          setIsAuthLoading(false);
          return;
        }
        if (authForm.password.length < 6) {
          setAuthError('Password must be at least 6 characters');
          setIsAuthLoading(false);
          return;
        }
        const data = await apiFetch('http://localhost:5000/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name: authForm.name, email: authForm.email, password: authForm.password })
        });
        localStorage.setItem("tf_token", data.token);
        localStorage.setItem("tf_user", JSON.stringify(data.user));
        setCurrentUser(data.user);
        loadTasks();
      }
    } catch (error) {
      setAuthError(error.message || 'Authentication failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Derive Display Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // 1. Sidebar View Filter
      if (activeView === 'Pending' && t.status !== 'pending') return false;
      if (activeView === 'In Progress' && t.status !== 'in-progress') return false;
      if (activeView === 'Completed' && t.status !== 'completed') return false;
      
      // 2. Sidebar Category Filter
      if (activeCategory && t.category !== activeCategory) return false;
      
      // 3. Top Filters
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      
      // 4. Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      let valA = a[sortConfig.key] || '';
      let valB = b[sortConfig.key] || '';
      
      if (sortConfig.key === 'id') {
         valA = a._id;
         valB = b._id;
      }
      
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tasks, activeView, activeCategory, statusFilter, priorityFilter, searchQuery, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  // Stats
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const today = new Date().toISOString().split('T')[0];
    const overdue = tasks.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate.split('T')[0] < today).length;
    return { total, completed, pending, overdue };
  }, [tasks]);

  const viewCounts = useMemo(() => {
    return {
      'All Tasks': tasks.length,
      'Pending': tasks.filter(t => t.status === 'pending').length,
      'In Progress': tasks.filter(t => t.status === 'in-progress').length,
      'Completed': tasks.filter(t => t.status === 'completed').length,
    };
  }, [tasks]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    CATEGORIES.forEach(c => {
      counts[c] = tasks.filter(t => t.category === c).length;
    });
    return counts;
  }, [tasks]);

  // Modal handlers
  const openModal = (task = null) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  const saveTask = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const taskData = {
      title: formData.get('title'),
      description: formData.get('description'),
      dueDate: formData.get('dueDate'),
      priority: formData.get('priority'),
      status: formData.get('status'),
      category: formData.get('category'),
    };

    try {
      setIsSaving(true);
      if (editingTask) {
        await apiFetch(`http://localhost:5000/api/tasks/${editingTask._id}`, {
          method: 'PUT',
          body: JSON.stringify(taskData)
        });
      } else {
        await apiFetch('http://localhost:5000/api/tasks', {
          method: 'POST',
          body: JSON.stringify(taskData)
        });
      }
      await loadTasks();
      closeModal();
    } catch (error) {
      console.error('Failed to save task:', error);
      if (error.message.startsWith("UNAUTHORIZED")) {
        handleLogout();
        return;
      }
      alert(error.message || 'Failed to save task');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTask = async (id) => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      try {
        await apiFetch(`http://localhost:5000/api/tasks/${id}`, {
          method: 'DELETE'
        });
        await loadTasks();
      } catch (error) {
        console.error('Failed to delete task:', error);
        if (error.message.startsWith("UNAUTHORIZED")) {
          handleLogout();
          return;
        }
        alert(error.message || 'Failed to delete task');
      }
    }
  };

  const toggleSort = (key) => {
    return sortConfig.key === key ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕';
  };

  if (loading) {
    return <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh'}}>Loading...</div>;
  }

  if (!currentUser) {
    return (
      <div className="auth-container">
        <div className="auth-card animate-slide-up">
          <h1 className="auth-title">Taskflow</h1>
          <p className="auth-subtitle">{isLoginMode ? 'Welcome back, please login' : 'Create a new account'}</p>
          
          {authError && <div style={{color:'var(--danger)', marginBottom:'10px', fontSize:'14px'}}>{authError}</div>}
          
          <form onSubmit={handleAuth}>
            {!isLoginMode && (
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-input" type="text" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} placeholder={isLoginMode ? "demo@taskflow.com" : ""} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{position:'relative'}}>
                <input className="form-input" type={showPassword ? "text" : "password"} value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} placeholder={isLoginMode ? "demo123" : ""} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{position:'absolute', right:'10px', top:'10px', color:'var(--text-secondary)'}}>
                  <i className={`fas fa-eye${showPassword ? '-slash' : ''}`}></i>
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary animate-fade-in" style={{marginTop:'20px'}} disabled={isAuthLoading}>
              {isAuthLoading ? 'Please wait...' : (isLoginMode ? 'Login' : 'Sign Up')}
            </button>
          </form>

          <div style={{marginTop:'20px', textAlign:'center', fontSize:'14px', color:'var(--text-secondary)'}}>
            {isLoginMode ? "Don't have an account? " : "Already have an account? "}
            <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); setAuthForm({name:'',email:'',password:''})}} style={{color:'var(--primary)', fontWeight:'600', textDecoration:'underline'}}>
              {isLoginMode ? 'Sign up' : 'Login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:9}} onClick={() => setSidebarOpen(false)}></div>}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <i className="fas fa-layer-group"></i> Taskflow
        </div>
        
        <div className="sidebar-content">
          <div className="nav-section">
            <div className="nav-title">Views</div>
            {VIEWS.map(view => (
              <div key={view} className={`nav-item ${activeView === view && !activeCategory ? 'active' : ''}`} onClick={() => { setActiveView(view); setActiveCategory(null); setSidebarOpen(false); }}>
                <div className="nav-item-left">
                  <i className={`fas fa-${view === 'All Tasks' ? 'inbox' : view === 'Completed' ? 'check-circle' : view === 'Pending' ? 'clock' : 'spinner'}`}></i>
                  {view}
                </div>
                <span className="nav-count">{viewCounts[view]}</span>
              </div>
            ))}
          </div>

          <div className="nav-section">
            <div className="nav-title">Categories</div>
            {CATEGORIES.map(cat => (
              <div key={cat} className={`nav-item ${activeCategory === cat ? 'active' : ''}`} onClick={() => { setActiveCategory(cat); setSidebarOpen(false); }}>
                <div className="nav-item-left">
                  <i className="fas fa-hashtag" style={{color:'var(--text-secondary)', fontSize:'10px'}}></i>
                  {cat}
                </div>
                <span className="nav-count">{categoryCounts[cat]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">{currentUser.name}</span>
            <span className="user-email">{currentUser.email}</span>
          </div>
          <button className="btn btn-secondary" onClick={handleLogout} style={{padding:'6px 10px', fontSize:'13px'}}>
            <i className="fas fa-sign-out-alt"></i> Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
            <button className="mobile-toggle" onClick={() => setSidebarOpen(true)} style={{display: 'none'}}>
              <i className="fas fa-bars" style={{fontSize:'20px'}}></i>
            </button>
            <h2 className="page-title number-font">{activeCategory ? `Category: ${activeCategory}` : activeView}</h2>
          </div>
          
          <div className="topbar-right">
            <div className="search-box">
              <i className="fas fa-search"></i>
              <input type="text" className="search-input" placeholder="Search tasks..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => openModal()} style={{padding:'8px 16px'}}>
              <i className="fas fa-plus"></i> New Task
            </button>
          </div>
        </header>

        <div className="dashboard-body animate-fade-in">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-header"><i className="fas fa-chart-bar" style={{color:'var(--primary)'}}></i> Total Tasks</div>
              <div className="stat-value number-font">{stats.total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-header"><i className="fas fa-check-circle" style={{color:'var(--success)'}}></i> Completed</div>
              <div className="stat-value number-font">{stats.completed}</div>
            </div>
            <div className="stat-card">
              <div className="stat-header"><i className="fas fa-clock" style={{color:'var(--warning)'}}></i> Pending</div>
              <div className="stat-value number-font">{stats.pending}</div>
            </div>
            <div className="stat-card">
              <div className="stat-header"><i className="fas fa-exclamation-circle" style={{color:'var(--danger)'}}></i> Overdue</div>
              <div className="stat-value number-font" style={{color: stats.overdue > 0 ? 'var(--danger)' : 'inherit'}}>{stats.overdue}</div>
            </div>
          </div>

          <div className="filters-bar">
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            
            <div className="priority-chips">
              <button className={`chip ${priorityFilter==='all' ? 'active':''}`} onClick={()=>setPriorityFilter('all')}>All</button>
              <button className={`chip ${priorityFilter==='high' ? 'active':''}`} onClick={()=>setPriorityFilter('high')}>High</button>
              <button className={`chip ${priorityFilter==='medium' ? 'active':''}`} onClick={()=>setPriorityFilter('medium')}>Medium</button>
              <button className={`chip ${priorityFilter==='low' ? 'active':''}`} onClick={()=>setPriorityFilter('low')}>Low</button>
            </div>
            
            <div style={{marginLeft:'auto', fontSize:'13px', color:'var(--text-secondary)'}}>
              Showing <strong style={{color:'var(--text-primary)'}}>{filteredTasks.length}</strong> tasks
            </div>
          </div>

          <div className="table-container animate-slide-up" style={{animationDelay:'0.1s'}}>
            {tasksLoading ? (
              <div style={{padding: '40px', textAlign: 'center', color: 'var(--text-secondary)'}}>
                Loading tasks...
              </div>
            ) : (
            <table className="tasks-table">
              <thead>
                <tr>
                  <th onClick={() => requestSort('title')} style={{width:'30%'}}>Task {toggleSort('title')}</th>
                  <th onClick={() => requestSort('category')}>Category {toggleSort('category')}</th>
                  <th onClick={() => requestSort('dueDate')}>Due Date {toggleSort('dueDate')}</th>
                  <th onClick={() => requestSort('priority')}>Priority {toggleSort('priority')}</th>
                  <th onClick={() => requestSort('status')}>Status {toggleSort('status')}</th>
                  <th style={{textAlign:'right'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length > 0 ? filteredTasks.map(task => {
                  const today = new Date().toISOString().split('T')[0];
                  const taskDate = task.dueDate ? task.dueDate.split('T')[0] : '';
                  const isOverdue = task.status !== 'completed' && taskDate && taskDate < today;
                  return (
                    <tr key={task._id} className={`table-row ${task.status === 'completed' ? 'completed' : ''}`}>
                      <td className="task-title-cell">
                        <div className="task-title">{task.title}</div>
                        <div className="task-desc">{task.description}</div>
                      </td>
                      <td><span className="badge" style={{background:'#eee'}}>{task.category}</span></td>
                      <td className={`number-font ${isOverdue ? 'date-overdue' : ''}`}>
                        {taskDate} {isOverdue && <i className="fas fa-exclamation-circle" title="Overdue"></i>}
                      </td>
                      <td>
                        <span className={`badge priority-${task.priority}`}>{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</span>
                      </td>
                      <td>
                        <span className={`badge status-${task.status}`}>
                          {task.status.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </span>
                      </td>
                      <td style={{textAlign:'right'}}>
                        <div style={{display:'flex', gap:'8px', justifyContent:'flex-end'}}>
                          <button onClick={() => openModal(task)} style={{color:'var(--info)', padding:'4px 8px'}}><i className="fas fa-edit"></i></button>
                          <button onClick={() => deleteTask(task._id)} style={{color:'var(--danger)', padding:'4px 8px'}}><i className="fas fa-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan="7">
                      <div className="empty-state">
                        <i className="fas fa-clipboard-list"></i>
                        <h3>No tasks found</h3>
                        <p style={{marginTop:'8px'}}>Try adjusting your filters or create a new task.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            )}
          </div>
        </div>
      </main>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title number-font">{editingTask ? 'Edit Task' : 'New Task'}</h3>
              <button onClick={closeModal} style={{fontSize:'20px', color:'var(--text-secondary)'}}>&times;</button>
            </div>
            <form onSubmit={saveTask}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Task Title</label>
                  <input type="text" className="form-input" name="title" defaultValue={editingTask?.title || ''} required autoFocus/>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-input" name="description" rows="3" defaultValue={editingTask?.description || ''} required></textarea>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-input" name="category" defaultValue={editingTask?.category || 'Work'} required>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Due Date</label>
                    <input type="date" className="form-input" name="dueDate" defaultValue={editingTask?.dueDate ? editingTask.dueDate.split('T')[0] : new Date().toISOString().split('T')[0]} required/>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select className="form-input" name="priority" defaultValue={editingTask?.priority || 'medium'} required>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-input" name="status" defaultValue={editingTask?.status || 'pending'} required>
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal} style={{width:'auto'}} disabled={isSaving}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{width:'auto'}} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
