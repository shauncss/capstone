function PiStatusWidget({ status }) {
  if (!status) {
    return (
      <div className="card pi-widget">
        <h3>Pi Kiosk</h3>
        <p>Waiting for kiosk heartbeat…</p>
      </div>
    );
  }

  const lastSeen = status.created_at ? new Date(status.created_at).toLocaleTimeString() : '—';

  return (
    <div className="card pi-widget">
      <h3>Pi Kiosk</h3>
      <p>Status: <strong>{status.status}</strong></p>
      <p>Temp: {status.temp ?? '—'} °C | SpO₂: {status.spo2 ?? '—'}% | HR: {status.hr ?? '—'} bpm</p>
      <p>Last heartbeat: {lastSeen}</p>
    </div>
  );
}

export default PiStatusWidget;
