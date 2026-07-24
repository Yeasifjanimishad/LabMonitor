import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Labs from './pages/Labs';
import AgentSetup from './pages/AgentSetup';
import Login from './pages/Login';
import Tasks from './pages/Tasks';
import Tickets from './pages/Tickets';
import About from './pages/About';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';

function App() {
  const userRole = localStorage.getItem('userRole');
  const isAuthenticated = !!userRole;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={
            userRole === 'admin' ? <Dashboard /> :
            userRole === 'teacher' ? <TeacherDashboard /> :
            <StudentDashboard />
          } />
          
          {/* Admin Only Routes */}
          {userRole === 'admin' && (
            <>
              <Route path="labs" element={<Labs />} />
              <Route path="tickets" element={<Tickets />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="agent" element={<AgentSetup />} />
            </>
          )}
          
          <Route path="about" element={<About />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
