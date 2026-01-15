import { useState, useMemo, useEffect } from 'react';
import { useOrders } from '../context/OrderContext';
import { useUsers } from '../context/UserContext';
import { getAllWorkLogs } from '../services/storage';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { Trophy, TrendingUp, BarChart3 } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const Dashboard = () => {
  const { orders } = useOrders();
  const { users } = useUsers();
  const [workLogs, setWorkLogs] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Fetch all work logs for calculations
  useEffect(() => {
    getAllWorkLogs().then(logs => setWorkLogs(logs));
  }, [orders, users]);

  // Get available years based on delivery date or creation date
  const years = useMemo(() => {
    const uniqueYears = [...new Set(orders.map(o => new Date(o.delivery_date || o.date).getFullYear()))];
    const currentYear = new Date().getFullYear();
    if (!uniqueYears.includes(currentYear)) uniqueYears.push(currentYear);
    return uniqueYears.sort((a, b) => b - a); // Descending
  }, [orders]);

  // Filter orders by year using delivery date
  const filteredOrders = useMemo(() => {
    return orders.filter(o => new Date(o.delivery_date || o.date).getFullYear() === selectedYear);
  }, [orders, selectedYear]);

  // Stats Logic (unchanged)
  const stats = useMemo(() => {
    const userStats = {};
    let total = 0;
    users.forEach(u => userStats[u.name] = 0);

    filteredOrders.forEach(order => {
      const orderLogs = workLogs.filter(log => log.order_id === order.db_id);
      const orderValue = parseFloat(order.value);

      if (orderLogs.length > 0 && order.quantity > 0) {
        const valuePerUnit = orderValue / parseInt(order.quantity);
        orderLogs.forEach(log => {
          const logVal = (log.quantity_produced || 0) * valuePerUnit;
          if (!userStats[log.user_name]) userStats[log.user_name] = 0;
          userStats[log.user_name] += logVal;
        });
      } else {
        if (!userStats[order.user]) userStats[order.user] = 0;
        userStats[order.user] += orderValue;
      }
    });

    total = Object.values(userStats).reduce((sum, val) => sum + val, 0);
    return { userStats, total };
  }, [filteredOrders, users, workLogs]);

  // Comparison Logic (unchanged)
  const comparison = useMemo(() => {
    const sortedUsers = Object.entries(stats.userStats).sort((a, b) => b[1] - a[1]);
    if (sortedUsers.length < 2) return "";
    if (sortedUsers[0][1] === sortedUsers[1][1] && sortedUsers[0][1] > 0) return "Gleichstand!";
    if (sortedUsers[0][1] === 0) return "Noch keine Umsätze";
    const leader = sortedUsers[0];
    const runnerUp = sortedUsers[1];
    const diff = (leader[1] - runnerUp[1]).toFixed(2);
    return `${leader[0]} liegt mit ${diff} € vorne`;
  }, [stats]);

  // Pie Chart Data
  const pieData = useMemo(() => {
    const labels = Object.keys(stats.userStats);
    const data = Object.values(stats.userStats);
    const colors = labels.map(name => {
      const user = users.find(u => u.name === name);
      return user ? user.color : '#cbd5e1';
    });

    return {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: 'white',
        borderWidth: 2,
      }],
    };
  }, [stats, users]);

  // Bar Chart Data (Orders per Year)
  const barData = useMemo(() => {
    // Sort years ascending for the chart
    const sortedYears = [...years].sort((a, b) => a - b);

    // Count orders per year
    const counts = sortedYears.map(year => {
      return orders.filter(o => new Date(o.delivery_date || o.date).getFullYear() === year).length;
    });

    return {
      labels: sortedYears,
      datasets: [{
        label: 'Anzahl Aufträge',
        data: counts,
        backgroundColor: '#6366f1',
        borderRadius: 4,
        maxBarThickness: 40,
      }]
    };
  }, [orders, years]);

  return (
    <div className="dashboard-container">
      <div className="dashboard-grid-top">
        {/* Stats Card */}
        <div className="card stats-card">
          <div className="header-row">
            <h2><TrendingUp size={20} style={{ display: 'inline', marginBottom: '-2px' }} /> Übersicht</h2>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="year-select"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="stats-grid">
            <div className="stat-item">
              <span className="label">Umsatz {selectedYear} (Produziert)</span>
              <span className="value">{stats.total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
            </div>
            {comparison && (
              <div className="stat-item highlight">
                <Trophy size={16} className="icon" />
                <span className="leader-text">{comparison}</span>
              </div>
            )}
          </div>
        </div>

        {/* Pie Chart Card */}
        <div className="card pie-chart-card">
          <h3>Verteilung {selectedYear}</h3>
          {stats.total > 0 ? (
            <div className="pie-container">
              <Pie data={pieData} options={{ maintainAspectRatio: false }} />
            </div>
          ) : (
            <div className="no-data">Keine Daten</div>
          )}
        </div>
      </div>

      {/* Bar Chart Row */}
      <div className="card bar-chart-card">
        <h3><BarChart3 size={20} style={{ display: 'inline', marginBottom: '-2px' }} /> Auftragslage (Jahresvergleich)</h3>
        <div className="bar-container">
          <Bar
            data={barData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
              },
              scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { grid: { display: false } }
              }
            }}
          />
        </div>
      </div>

      <style>{`
        .dashboard-container {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .dashboard-grid-top {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        
        .card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: var(--shadow-md);
        }

        .pie-chart-card h3, .bar-chart-card h3 {
            margin: 0 0 1rem 0;
            font-size: 1rem;
            color: var(--color-text-muted);
            font-weight: 500;
        }

        .pie-container {
            position: relative;
            height: 200px; /* Smaller Pie */
            width: 100%;
            max-width: 280px; /* Constrain width */
            display: flex;
            justify-content: center;
        }
        .header-row {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .year-select {
          padding: 0.6rem 1rem;
          border-radius: 8px;
          border: 1px solid var(--color-border);
          font-weight: 600;
          width: 100%;
          background: #f8fafc;
        }
        .bar-container {
            position: relative;
            height: 250px;
            width: 100%;
        }
        .stats-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .stat-item {
          display: flex;
          flex-direction: column;
        }
        .stat-item .label {
          font-size: 0.875rem;
          color: var(--color-text-muted);
        }
        .stat-item .value {
          font-size: 1.5rem;
          font-weight: 700;
        }
        .stat-item.highlight {
          flex-direction: row;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: #eff6ff;
          border-radius: 8px;
          color: #1e3a8a;
          margin-top: 0.5rem;
        }
        .leader-text {
          font-weight: 600;
        }
        .no-data {
           height: 150px;
           display: flex;
           align-items: center;
           justify-content: center;
           color: var(--color-text-muted);
           font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;

