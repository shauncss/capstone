function QueueTable({ queue = [], rooms = [], selection = {}, onSelectRoom, onAssignRoom }) {
  const waitingRooms = rooms.filter((room) => room.is_available);
  const statusLabels = {
    waiting: 'Waiting',
    called: 'In Room',
    completed: 'Completed'
  };

  return (
    <div className="card">
      <h3>Queue</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Status</th>
            <th>Room</th>
            <th>Assign</th>
          </tr>
        </thead>
        <tbody>
          {queue.length === 0 && (
            <tr>
              <td colSpan={5}>No patients in queue.</td>
            </tr>
          )}
          {queue.map((entry) => (
            <tr key={entry.queue_id}>
              <td>{entry.queue_number}</td>
              <td>{entry.first_name} {entry.last_name}</td>
              <td>
                <span className={`badge status-${entry.status}`}>
                  {statusLabels[entry.status] || entry.status}
                </span>
              </td>
              <td>
                {entry.room_name ? (
                  <span className="room-chip">{entry.room_name}</span>
                ) : (
                  'Unassigned'
                )}
              </td>
              <td>
                {entry.status === 'waiting' ? (
                  waitingRooms.length === 0 ? (
                    <span className="assign-hint">No rooms available</span>
                  ) : (
                    <div className="assign-controls">
                      <select
                        value={selection[entry.queue_id] || ''}
                        onChange={(event) => onSelectRoom(entry.queue_id, event.target.value)}
                      >
                        <option value="">Select room</option>
                        {waitingRooms.map((room) => (
                          <option value={room.id} key={room.id}>{room.name}</option>
                        ))}
                      </select>
                      <button
                        disabled={!selection[entry.queue_id]}
                        onClick={() => onAssignRoom(entry.queue_id)}
                      >
                        Assign
                      </button>
                    </div>
                  )
                ) : (
                  entry.status === 'called' ? 'Patient in room' : '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default QueueTable;
