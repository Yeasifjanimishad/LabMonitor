import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
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
import { ShieldAlert, LogIn, LayoutDashboard } from 'lucide-react';

function StandaloneAgentSetup() {
  const userRole = localStorage.getItem('userRole');
  return (
    <div className="min-h-screen bg-[#0a0f1c] text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-3 text-white font-bold text-lg hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-600/30">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <span>LabMonitor Pro</span>
        </Link>
        <div className="flex items-center gap-3">
          {userRole ? (
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-600/20"
            >
              <LayoutDashboard className="w-4 h-4" />
              Go to Dashboard
            </Link>
          ) : (
            <Link 
              to="/login" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-600/20"
            >
              <LogIn className="w-4 h-4" />
              Login
            </Link>
          )}
        </div>
      </header>
      <main className="p-4 sm:p-8 max-w-7xl mx-auto w-full flex-1">
        <AgentSetup />
      </main>
    </div>
  );
}

function App() {
  const userRole = localStorage.getItem('userRole');
  const isAuthenticated = !!userRole;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Direct access to Agent Setup on any client/student machine without blocking login */}
        <Route 
          path="/agent" 
          element={
            isAuthenticated ? (
              <Layout />
            ) : (
              <StandaloneAgentSetup />
            )
          } 
        >
          {isAuthenticated && <Route index element={<AgentSetup />} />}
        </Route>

        {/* Direct access to Student Workstation (accessible directly for lab PCs or live instructor testing) */}
        <Route 
          path="/student" 
          element={
            <div className="min-h-screen bg-[#0a0f1c] text-slate-100 p-4 sm:p-8">
              <StudentDashboard />
            </div>
          } 
        />
        <Route 
          path="/student/:pcId" 
          element={
            <div className="min-h-screen bg-[#0a0f1c] text-slate-100 p-4 sm:p-8">
              <StudentDashboard />
            </div>
          } 
        />
        
        {/* Protected Routes */}
        <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={
            userRole === 'admin' ? <Dashboard /> :
            userRole === 'teacher' ? <TeacherDashboard /> :
            <StudentDashboard />
          } />
          
          <Route path="agent" element={<AgentSetup />} />
          <Route path="tickets" element={<Tickets />} />
          
          {/* Admin Only Routes */}
          {userRole === 'admin' && (
            <>
              <Route path="labs" element={<Labs />} />
              <Route path="tasks" element={<Tasks />} />
            </>
          )}
          
          <Route path="about" element={<About />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
