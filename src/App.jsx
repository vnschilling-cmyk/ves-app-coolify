import { useState } from 'react';
// App Entry Point
import { OrderProvider } from './context/OrderContext';
import { UserProvider } from './context/UserContext';
import Dashboard from './components/Dashboard';
import OrderForm from './components/OrderForm';
import OrderList from './components/OrderList';
import UserManagement from './components/UserManagement';
import ArticleList from './components/ArticleList';
import AddOrderModal from './components/AddOrderModal';
import TimeTracking from './components/TimeTracking';
import LoginScreen from './components/LoginScreen';
import DeviceFrame from './components/DeviceFrame';
import Settings from './components/Settings';
import WorkStepsManagement from './components/WorkStepsManagement';
import { useUsers } from './context/UserContext';
import { useOrders } from './context/OrderContext';
import GlobalTimer from './components/GlobalTimer';
import ActiveSessionPage from './components/ActiveSessionPage';
import { LayoutDashboard, Users, FileText, Plus, Home, Package, Settings as SettingsIcon } from 'lucide-react';
import logo from './assets/app-logo.png';
import './App.css';
import './components/DeviceFrame.css';

function App() {

  return (
    <DeviceFrame>
      <OrderProvider>
        <UserProvider>
          <AppContent />
        </UserProvider>
      </OrderProvider>
    </DeviceFrame>
  );
}

function AppContent() {
  const { isAuthenticated } = useUsers();
  const { activeSession } = useOrders();
  const [currentView, setCurrentView] = useState('dashboard');
  const [showAddModal, setShowAddModal] = useState(false);

  const handleManualSelect = () => {
    setShowAddModal(false);
    setCurrentView('add-manual');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'users':
        return <UserManagement />;
      case 'settings':
        return <Settings onNavigate={setCurrentView} />;
      case 'work-steps':
        return <WorkStepsManagement onBack={() => setCurrentView('settings')} />;
      case 'orders':
        return <OrderList />;
      case 'articles':
        return <ArticleList />;
      case 'add-manual':
        return <OrderForm />;
      default:
        return <Dashboard />;
    }
  };

  // If not authenticated, show Login Screen
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // If there's an active session, show the timer page
  if (activeSession) {
    return <ActiveSessionPage onBack={() => { }} />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="container header-content">
          <div className="logo-container">
            <img src={logo} alt="VEScnc" className="app-logo" />
          </div>
        </div>
      </header>

      <main className="container main-content">
        {renderContent()}
      </main>

      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          <button
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            <Home size={24} />
          </button>

          <button
            className="nav-item plus-btn"
            onClick={() => setShowAddModal(true)}
          >
            <div className="plus-circle">
              <Plus size={28} color="white" />
            </div>
          </button>

          <button
            className={`nav-item ${currentView === 'orders' ? 'active' : ''}`}
            onClick={() => setCurrentView('orders')}
          >
            <FileText size={24} />
          </button>

          <button
            className={`nav-item ${currentView === 'articles' ? 'active' : ''}`}
            onClick={() => setCurrentView('articles')}
          >
            <Package size={24} />
          </button>

          <button
            className={`nav-item ${['settings', 'users'].includes(currentView) ? 'active' : ''}`}
            onClick={() => setCurrentView('settings')}
          >
            <SettingsIcon size={24} />
          </button>
        </div>
      </nav>

      {showAddModal && (
        <AddOrderModal
          onClose={() => setShowAddModal(false)}
          onSelectManual={handleManualSelect}
        />
      )}

      <GlobalTimer />



    </div>
  );
}

export default App;
