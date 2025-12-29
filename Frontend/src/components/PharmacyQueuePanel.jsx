function PharmacyQueuePanel({
  queue = [],
  onCallNext,
  onComplete,
  callingNext,
  completingId
}) {
  const waiting = queue.filter((entry) => entry.status === 'waiting');
  const ready = queue.filter((entry) => entry.status === 'ready');
  const hasQueue = queue.length > 0;

  return (
    <div className="card pharmacy-card">
      <div className="card-header">
        <div>
          <h3>Pharmacy Queue</h3>
          <p className="muted">Manage patients picking up prescriptions after consultation.</p>
        </div>
        <div className="pill-row">
          <span className="badge info">{waiting.length} waiting</span>
          <span className="badge success">{ready.length} ready</span>
        </div>
      </div>

      <div className="pharmacy-actions">
        <button type="button" onClick={onCallNext} disabled={callingNext || waiting.length === 0}>
          {callingNext ? 'Calling…' : 'Call next patient'}
        </button>
        <small className="helper-text">Calls the oldest waiting patient to pick up meds.</small>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {!hasQueue && (
            <tr>
              <td colSpan={4}>No patients in the pharmacy queue.</td>
            </tr>
          )}
          {queue.map((entry) => (
            <tr key={entry.pharmacy_id}>
              <td>{entry.queue_number}</td>
              <td>{entry.first_name} {entry.last_name}</td>
              <td>
                <span className={`badge status-${entry.status}`}>
                  {entry.status === 'waiting' ? 'Waiting' : entry.status === 'ready' ? 'Ready for pickup' : entry.status}
                </span>
              </td>
              <td>
                {entry.status !== 'completed' ? (
                  <button
                    type="button"
                    onClick={() => onComplete(entry.pharmacy_id)}
                    disabled={completingId === entry.pharmacy_id}
                  >
                    {completingId === entry.pharmacy_id ? 'Marking…' : 'Mark picked up'}
                  </button>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PharmacyQueuePanel;
