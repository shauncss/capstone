import { useState } from 'react';

function RoomsPanel({
  rooms = [],
  waitingQueue = [],
  onFinishRoom,
  finishingRoomId,
  onAssignRoom,
  assigningRoomId,
  onRenameRoom,
  updatingRoomId,
  onDeleteRoom,
  deletingRoomId
}) {
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [draftNames, setDraftNames] = useState({});
  const [roomSelections, setRoomSelections] = useState({});

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
        <p>No rooms configured yet.</p>
      ) : (
        <div className="room-grid interactive-grid">
          {rooms.map((room) => {
            const isFinishing = finishingRoomId === room.id;
            const isAssigning = assigningRoomId === room.id;
            const isUpdating = updatingRoomId === room.id;
            const isDeleting = deletingRoomId === room.id;
            const isEditing = editingRoomId === room.id;

            return (
              <div className={`room-tile interactive ${room.is_available ? 'available' : 'busy'}`} key={room.id}>
                <div className="room-tile-header">
                  {isEditing ? (
                    <input
                      value={draftNames[room.id] || ''}
                      onChange={(event) => setDraftNames((prev) => ({ ...prev, [room.id]: event.target.value }))}
                      className="room-edit-input"
                      autoFocus
                    />
                  ) : (
                    <p className="room-name">{room.name}</p>
                  )}
                  <span className={`badge ${room.is_available ? 'success' : 'warning'}`}>
                    {room.is_available ? 'Available' : 'In consultation'}
                  </span>
                </div>
                <p className="room-status-line">
                  {room.is_available
                    ? 'Waiting for the next patient.'
                    : `Serving patient ID ${room.current_patient_id ?? '—'}`}
                </p>

                <div className="room-actions">
                  {room.is_available ? (
                    hasWaiting ? (
                      <div className="assign-controls vertical">
                        <select
                          value={roomSelections[room.id] || ''}
                          onChange={(event) => setRoomSelections((prev) => ({ ...prev, [room.id]: event.target.value }))}
                        >
                          <option value="">Select patient</option>
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

                <div className="room-actions secondary">
                  {isEditing ? (
                    <div className="room-edit-actions">
                      <button type="button" onClick={() => handleSaveName(room.id)} disabled={isUpdating}>
                        {isUpdating ? 'Saving…' : 'Save name'}
                      </button>
                      <button type="button" className="ghost-button" onClick={() => setEditingRoomId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="room-edit-actions">
                      <button type="button" className="ghost-button" onClick={() => handleEditToggle(room)}>
                        Edit name
                      </button>
                      <button
                        type="button"
                        className="ghost-button danger"
                        onClick={() => onDeleteRoom?.(room.id)}
                        disabled={!room.is_available || isDeleting}
                      >
                        {isDeleting ? 'Removing…' : 'Remove room'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RoomsPanel;
