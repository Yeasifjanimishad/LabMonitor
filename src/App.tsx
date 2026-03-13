import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Labs from './pages/Labs';
import AgentSetup from './pages/AgentSetup';
import Login from './pages/Login';
import Tasks from './pages/Tasks';
import Issues from './pages/Issues';
import About from './pages/About';

function App() {
  // Simple mock auth for demonstration
  const isAuthenticated = localStorage.getItem('adminAuth') === 'true';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard />} />
          <Route path="labs" element={<Labs />} />
          <Route path="issues" element={<Issues />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="agent" element={<AgentSetup />} />
          <Route path="about" element={<About />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
