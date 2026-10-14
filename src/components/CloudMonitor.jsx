import React, { useState, useEffect, useRef } from 'react';
import './cloud-dash.css';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const stamp = () => new Date().toTimeString().slice(0, 8);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const NAV = [
  ['cluster', '🌐', 'Cluster Overview'],
  ['nodes', '🖥️', 'Node Pools'],
  ['containers', '🐳', 'Containers'],
  ['network', '📡', 'Network & DNS'],
  ['storage', '💾', 'Persistent Storage'],
  ['logs', '📜', 'Live Logs'],
  ['settings', '⚙️', 'Security & IAM'],
];

const START = [
  { name: 'api-gateway-auth', image: 'node:18-alpine', mem: 1.2, cpu: 14, status: 'Running' },
  { name: 'redis-cache-cluster', image: 'redis:7.0', mem: 3.4, cpu: 28, status: 'Running' },
  { name: 'postgres-primary-db', image: 'postgres:15', mem: 6.1, cpu: 42, status: 'Running' },
];

const BADGE = {
  Running: { background: '#dcfce7', color: '#15803d' },
  Restarting: { background: '#fef3c7', color: '#b45309' },
};

const LOG_COLOR = { INFO: '#38bdf8', WARN: '#facc15', SUCCESS: '#4ade80', ERROR: '#f87171' };
const LABELS = ['-15s', '-12s', '-9s', '-6s', '-3s', 'now'];
const MAX_LINES = 8;
const TOTAL_PODS = 40;
const OTHER_PODS = 37; // pods not listed in the table, assumed healthy

export default function CloudMonitor() {
  const [stats, setStats] = useState({ cpu: 48.2, mem: 40, latency: 24 });
  const [history, setHistory] = useState(
    LABELS.map(() => ({ cpu: rnd(35, 60), mem: rnd(40, 65) }))
  );
  const [ctrs, setCtrs] = useState(START);
  const [logs, setLogs] = useState([
    { time: stamp(), type: 'INFO', text: 'CloudPulse monitor started, 12 nodes registered.' },
  ]);
  const [filter, setFilter] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState('cluster');
  const timers = useRef([]);
  const ctrsRef = useRef(ctrs);
  ctrsRef.current = ctrs;

  const addLog = (type, text) =>
    setLogs((l) => [...l.slice(-60), { time: stamp(), type, text }]);

  // metrics + chart tick
  useEffect(() => {
    const id = setInterval(() => {
      setStats((s) => {
        const next = {
          cpu: clamp(s.cpu + rnd(-6, 6), 25, 96),
          mem: clamp(s.mem + rnd(-2, 2.2), 35, 92),
          latency: clamp(s.latency + rnd(-4, 4), 12, 95),
        };
        setHistory((h) => [...h.slice(1), { cpu: next.cpu, mem: next.mem }]);
        return next;
      });
      setCtrs((list) =>
        list.map((c) =>
          c.status === 'Running'
            ? { ...c, mem: clamp(c.mem + rnd(-0.1, 0.1), 0.5, 8), cpu: clamp(c.cpu + rnd(-4, 4), 3, 95) }
            : c
        )
      );
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // log stream
  useEffect(() => {
    const events = [
      ['INFO', () => `Cluster node ${pick(['us-east-1', 'us-east-2', 'eu-central-1'])} scaled up successfully.`],
      ['INFO', () => `Health check passed: ${pick(ctrsRef.current).name}`],
      ['WARN', () => `Memory threshold reached 80% on ${pick(ctrsRef.current).name}.`],
      ['SUCCESS', () => 'Kubernetes ingress controller reloaded routes.'],
      ['ERROR', () => `Liveness probe failed for ${pick(ctrsRef.current).name}, retrying.`],
      ['INFO', () => 'Autoscaler: replicas 3 → 4 for api-gateway-auth.'],
    ];
    const id = setInterval(() => {
      const [type, text] = pick(events);
      addLog(type, text());
    }, 2200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const restart = (name) => {
    setCtrs((l) => l.map((c) => (c.name === name ? { ...c, status: 'Restarting' } : c)));
    addLog('WARN', `Restart requested for ${name}.`);
    const t = setTimeout(() => {
      setCtrs((l) => l.map((c) => (c.name === name ? { ...c, status: 'Running', mem: 0.8, cpu: 6 } : c)));
      addLog('SUCCESS', `${name} is Running again.`);
    }, 2500);
    timers.current.push(t);
  };

  const restarting = ctrs.filter((c) => c.status === 'Restarting').length;
  const running = OTHER_PODS + ctrs.length - restarting;
  const memGB = (stats.mem / 100) * 32;

  const kpis = [
    {
      title: 'CPU Utilization',
      value: `${stats.cpu.toFixed(1)}%`,
      trend: stats.cpu >= 70 ? '⚠ Above 70% threshold' : 'Within normal range',
      bad: stats.cpu >= 70,
    },
    { title: 'Memory Usage', value: `${memGB.toFixed(1)} GB`, trend: `${stats.mem.toFixed(0)}% of 32 GB`, bad: stats.mem >= 80 },
    {
      title: 'Network Latency',
      value: `${stats.latency.toFixed(0)} ms`,
      trend: stats.latency > 60 ? 'Elevated latency' : 'Optimal speed',
      bad: stats.latency > 60,
    },
    {
      title: 'Active Containers',
      value: `${running} / ${TOTAL_PODS}`,
      trend: restarting ? `${restarting} pod${restarting > 1 ? 's' : ''} restarting` : 'All pods healthy',
      bad: restarting > 0,
    },
  ];

  const shown = (filter ? logs.filter((l) => l.text.includes(filter)) : logs).slice(-MAX_LINES);

  return (
    <div className="cloud-container">
      <aside className="sidebar">
        <div>
          <div className="logo-box">
            <div className="logo-icon">⚡</div>
            <span>CloudPulse</span>
            <button
              className="nav-toggle"
              aria-expanded={menuOpen}
              aria-controls="main-nav"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
          <ul id="main-nav" className={`nav-menu${menuOpen ? ' open' : ''}`}>
            {NAV.map(([id, icon, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={`nav-link${active === id ? ' active' : ''}`}
                  onClick={() => { setActive(id); setMenuOpen(false); }}
                >
                  {icon} {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ color: '#687593', fontSize: '12px', paddingLeft: '12px' }}>
          <p>🔧 Region: US-East</p>
          <p style={{ marginTop: '6px', color: '#10b981', fontWeight: 600 }}>🟢 System Operational</p>
        </div>
      </aside>

      <main className="main-area">
        <header className="header-top">
          <div className="welcome-box">
            <h1>Infrastructure &amp; Cloud Monitor</h1>
            <p>Real-time telemetry and container orchestration metrics</p>
          </div>
          <div className="header-right">
            <div className="cluster-badge">
              <span className="status-dot"></span>
              k8s-prod-cluster-01
            </div>
            <div className="avatar">GR</div>
          </div>
        </header>

        <section className="kpi-row">
          {kpis.map((k) => (
            <div className="kpi-box" key={k.title}>
              <div className="kpi-header">
                <span>{k.title}</span>
                <span>📈</span>
              </div>
              <div className="kpi-value">{k.value}</div>
              <div className={`trend-badge${k.bad ? ' negative' : ''}`}>{k.trend}</div>
            </div>
          ))}
        </section>

        <div className="dashboard-grid">
          <div className="column-left">
            <div className="card">
              <div className="card-header-flex">
                <div className="card-title">CPU &amp; Memory Load History</div>
                <div className="chart-legend">
                  <span><i className="legend-dot"></i> CPU %</span>
                  <span><i className="legend-dot secondary"></i> RAM %</span>
                </div>
              </div>
              <div className="chart-wrapper">
                <div className="chart-y-axis">
                  <span>100%</span><span>50%</span><span>0%</span>
                </div>
                <div className="chart-body">
                  <div className="chart-bars-area">
                    {history.map((p, i) => (
                      <div className="bar-group" key={i}>
                        <div className="bar-primary" style={{ height: `${p.cpu}%` }}></div>
                        <div className="bar-secondary" style={{ height: `${p.mem}%` }}></div>
                      </div>
                    ))}
                  </div>
                  <div className="chart-x-labels">
                    {LABELS.map((t) => <span key={t}>{t}</span>)}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header-flex">
                <div className="card-title">Docker Container Fleet</div>
                <span style={{ fontSize: '11px', color: '#536dfe', fontWeight: 700 }}>View All Pods →</span>
              </div>
              <table className="simple-table">
                <thead>
                  <tr>
                    <th>CONTAINER NAME</th><th>IMAGE</th><th>RAM</th><th>CPU</th><th>STATUS</th><th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {ctrs.map((c) => (
                    <tr key={c.name}>
                      <td>{c.name}</td>
                      <td style={{ color: '#687593' }}>{c.image}</td>
                      <td>{c.mem.toFixed(1)} GB</td>
                      <td>{c.cpu.toFixed(0)}%</td>
                      <td>
                        <span style={{ ...BADGE[c.status], padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                          ● {c.status}
                        </span>
                      </td>
                      <td>
                        <button className="action-btn" disabled={c.status !== 'Running'} onClick={() => restart(c.name)}>
                          Restart
                        </button>{' '}
                        <button
                          className="action-btn secondary"
                          aria-pressed={filter === c.name}
                          onClick={() => setFilter((f) => (f === c.name ? null : c.name))}
                        >
                          Logs
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="column-right">
            <div className="card" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#fff' }}>
              <div className="card-header-flex">
                <div className="card-title" style={{ color: '#fff' }}>AWS EKS Node Health</div>
                <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                  Region: us-east-1
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                {[
                  ['Control Plane Status:', 'Healthy (v1.30)', '#4ade80'],
                  ['Active Worker Nodes:', '12 / 12 Online'],
                  ['Storage Volume Usage:', '1.4 TB / 5.0 TB'],
                ].map(([k, v, col]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span>{k}</span>
                    <span style={{ fontWeight: 700, color: col }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" id="logs">
              <div className="card-header-flex">
                <div className="card-title">Live System Logs</div>
                {filter ? (
                  <button className="action-btn secondary" onClick={() => setFilter(null)}>
                    {filter} ✕
                  </button>
                ) : (
                  <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 700 }}>● Streaming</span>
                )}
              </div>
              <div className="terminal-box">
                {shown.map((l, i) => (
                  <div className="terminal-line" key={`${l.time}-${i}-${l.text}`}>
                    <span className="terminal-time">[{l.time}]</span>
                    <span style={{ color: LOG_COLOR[l.type] }}>{l.type}:</span>
                    <span style={{ color: '#e2e8f0' }}>{l.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
