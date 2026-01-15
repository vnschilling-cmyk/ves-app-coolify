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
import { useUsers } from './context/UserContext';
import { LayoutDashboard, Users, FileText, Plus, Home, Package } from 'lucide-react';
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
            <span>Home</span>
          </button>

          <button
            className="nav-item plus-btn"
            onClick={() => setShowAddModal(true)}
          >
            <div className="plus-circle">
              <Plus size={28} color="white" />
            </div>
            <span>Neu</span>
          </button>

          <button
            className={`nav-item ${currentView === 'orders' ? 'active' : ''}`}
            onClick={() => setCurrentView('orders')}
          >
            <FileText size={24} />
            <span>Aufträge</span>
          </button>

          <button
            className={`nav-item ${currentView === 'articles' ? 'active' : ''}`}
            onClick={() => setCurrentView('articles')}
          >
            <Package size={24} />
            <span>Artikel</span>
          </button>

          <button
            className={`nav-item ${currentView === 'users' ? 'active' : ''}`}
            onClick={() => setCurrentView('users')}
          >
            <Users size={24} />
            <span>Benutzer</span>
          </button>
        </div>
      </nav>

      {showAddModal && (
        <AddOrderModal
          onClose={() => setShowAddModal(false)}
          onSelectManual={handleManualSelect}
        />
      )}

      <TimeTracking onAddOrder={() => setShowAddModal(true)} />


      <style>{`
          .app-container {
            min-height: 100vh;
            background-color: var(--color-bg);
            font-family: var(--font-family);
            width: 100%;
            padding-bottom: calc(5rem + env(safe-area-inset-bottom)); /* Space for bottom nav */
          }
          .app-header {
            background-color: white;
            border-bottom: 1px solid var(--color-border);
            position: sticky;
            top: 0;
            z-index: 10;
            box-shadow: var(--shadow-sm);
            padding-top: env(safe-area-inset-top);
          }
          .container {
            max-width: 800px; /* Limit width for better mobile-first feel */
            margin: 0 auto;
            padding: 0 1rem;
          }
          .header-content {
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .logo-container {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
          }
          .app-logo {
            height: 40px; /* Adjusted size */
            width: auto;
            object-fit: contain;
            display: block;
          }
          /* Old logo styles removed */
          .logo-icon {
            background: var(--color-primary);
            padding: 6px;
            border-radius: 8px;
            display: flex;
          }
          .logo h1 {
            font-size: 1.1rem;
            font-weight: 700;
            color: var(--color-text-main);
            margin: 0;
          }
          
          .main-content {
            padding-top: 1.5rem;
            padding-bottom: calc(80px + env(safe-area-inset-bottom));
          }
  
          /* Bottom Navigation */
          .bottom-nav {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: white;
            display: flex;
            justify-content: center;
            align-items: center;
            height: calc(70px + env(safe-area-inset-bottom));
            padding-bottom: env(safe-area-inset-bottom);
            border-top: 1px solid var(--color-border);
            z-index: 50;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
          }
          .bottom-nav-inner {
            display: flex;
            justify-content: space-around;
            align-items: center;
            width: 100%;
            max-width: 500px;
            height: 70px;
          }

          .nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: transparent;
            border: none;
            color: var(--color-text-muted);
            font-size: 0.75rem;
            gap: 4px;
            flex: 1;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
            transition: all 0.2s;
            margin: 8px 4px;
            border-radius: 12px;
            padding: 4px 0;
            max-width: 100px; /* Prevent overly wide buttons */
          }

          .nav-item.active {
            background-color: var(--color-primary);
            color: white;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
          }
          
          .nav-item:hover:not(.active) {
            background-color: #f1f5f9;
          }

          .plus-btn {
            position: relative;
            top: -15px; /* Floats above */
            background: transparent !important; /* Ensure no bg overlap */
            box-shadow: none !important; /* No shadow on container */
            margin: 0 !important; /* Reset margin */
            max-width: none !important;
          }
          
          .plus-circle {
            width: 56px;
            height: 56px;
            background: linear-gradient(135deg, var(--color-primary), #4f46e5);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
            transition: transform 0.1s;
          }

          .nav-item:active .plus-circle {
            transform: scale(0.95);
          }
          
          .nav-item span {
            font-weight: 500;
          }

        `}</style>
    </div>
  );
}

export default App;
