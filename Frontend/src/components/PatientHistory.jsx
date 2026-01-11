function PatientHistory({
  history = [],
  loading = false,
  onRefresh,
  page = 1,
  hasMore = false,
  onNextPage,
  onPrevPage
}) {
  return (
    <div className="card history-card">
      <div className="history-header">
        <div>
          <h3>Patient History</h3>
        </div>
        <div className="history-actions">
          <button type="button" onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      {history.length === 0 ? (
        <p className="history-empty">No completed visits yet.</p>
      ) : (
        <div className="history-table-wrapper">
          <table className="data-table history-table">
            <thead>
              <tr>
                <th>Queue #</th>
                <th>Patient</th>
                <th>Room</th>
                <th>Symptoms</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.queue_id}>
                  <td>{entry.queue_number}</td>
                  <td>
                    {entry.first_name} {entry.last_name}
                  </td>
                  <td>{entry.room_name || '—'}</td>
                  <td className="history-symptoms">{entry.symptoms || '—'}</td>
                  <td>
                    {entry.completed_at ? new Date(entry.completed_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination-controls">
            <button type="button" onClick={onPrevPage} disabled={loading || page <= 1}>
              Previous
            </button>
            <span>
              Page {page}
            </span>
            <button type="button" onClick={onNextPage} disabled={loading || !hasMore}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PatientHistory;
