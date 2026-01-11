import { useState } from 'react';

function RoomsPanel({
  rooms = [],
  queue = [],
  onFinishRoom,
  finishingRoomId,
  onAssignRoom,
  assigningRoomId,
}) {
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [draftNames, setDraftNames] = useState({});
  const [roomSelections, setRoomSelections] = useState({});

  const waitingQueue = queue.filter(q => q.status === 'waiting');
  const availableRooms = rooms.filter((room) => room.is_available).length;
  const busyRooms = rooms.length - availableRooms;
  const hasWaiting = waitingQueue.length > 0;

  const handleEditToggle = (room) => {
    if (editingRoomId === room.id) {
      setEditingRoomId(null);
      return;
    }
    setDraftNames((prev) => ({ ...prev, [room.id]: room.name }));
    setEditingRoomId(room.id);
  };

  const handleSaveName = async (roomId) => {
    const value = draftNames[roomId]?.trim();
    if (!value) return;
    await onRenameRoom?.(roomId, value);
    setEditingRoomId(null);
  };

  const handleAssign = async (roomId) => {
    const queueId = roomSelections[roomId];
    if (!queueId) return;
    await onAssignRoom?.(roomId, queueId);
    setRoomSelections((prev) => ({ ...prev, [roomId]: '' }));
  };

  const handleAssignNext = async (roomId) => {
    const next = waitingQueue[0];
    if (!next) return;
    await onAssignRoom?.(roomId, next.queue_id);
  };

  return (
    <div className="card rooms-panel">
      <div className="rooms-panel__header">
        <div>
          <h3>Rooms</h3>
          <p className="room-subtitle">Manage rooms, assign patients, or free rooms after visits.</p>
        </div>
        <div className="room-summary">
          <span className="badge success">{availableRooms} ready</span>
          <span className="badge warning">{busyRooms} in session</span>
        </div>
      </div>
      {rooms.length === 0 ? (
        <p>No rooms configured.</p>
      ) : (
        <div className="room-grid interactive-grid">
          {rooms.map((room) => {
            const isFinishing = finishingRoomId === room.id;
            const isAssigning = assigningRoomId === room.id;

            // Find the patient currently inside this room
            const currentPatient = queue.find(
              (q) => q.assigned_room_id === room.id && q.status === 'called'
            );

            return (
              <div className={`room-tile interactive ${room.is_available ? 'available' : 'busy'}`} key={room.id}>
                <div className="room-tile-header">
                  <p className="room-name">{room.name}</p>
                  <span className={`badge ${room.is_available ? 'success' : 'warning'}`}>
                    {room.is_available ? 'Available' : 'In consultation'}
                  </span>
                </div>
                
                {/* Display Queue Number instead of Patient ID */}
                <p className="room-status-line">
                  {room.is_available
                    ? 'Waiting for the next patient.'
                    : `Serving: ${currentPatient ? currentPatient.queue_number : 'Unknown'}`}
                </p>

                <div className="room-actions">
                  {room.is_available ? (
                    hasWaiting ? (
                      <div className="assign-controls vertical">
                        {/* CSS Class applied here */}
                        <select
                          className="room-select"
                          value={roomSelections[room.id] || ''}
                          onChange={(event) => setRoomSelections((prev) => ({ ...prev, [room.id]: event.target.value }))}
                        >
                          <option value="">Select patient...</option>
                          {waitingQueue.map((entry) => (
                            <option key={entry.queue_id} value={entry.queue_id}>
                              #{entry.queue_number} • {entry.first_name} {entry.last_name}
                            </option>
                          ))}
                        </select>
                        <div className="room-button-row">
                          <button
                            type="button"
                            onClick={() => handleAssign(room.id)}
                            disabled={isAssigning || !roomSelections[room.id]}
                          >
                            {isAssigning ? 'Assigning…' : 'Assign selected'}
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => handleAssignNext(room.id)}
                            disabled={isAssigning}
                          >
                            Quick assign next
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="room-hint">No waiting patients.</p>
                    )
                  ) : (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => onFinishRoom?.(room.id)}
                      disabled={!onFinishRoom || isFinishing}
                    >
                      {isFinishing ? 'Finishing…' : 'Finish & free room'}
                    </button>
                  )}
                </div>
                
                {/* Secondary Actions (Edit/Delete) Removed */}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RoomsPanel;