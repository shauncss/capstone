import { useCallback, useEffect, useState } from 'react';
import useSocket from '../hooks/useSocket';
import QueueTable from '../components/QueueTable';
import RoomsPanel from '../components/RoomsPanel';
import PatientHistory from '../components/PatientHistory';
import PharmacyQueuePanel from '../components/PharmacyQueuePanel';
import '../styles/admin.css';
import {
  addRoom,
  assignRoom,
  autoAssignNext,
  deleteRoom,
  fetchEta,
  fetchHistory,
  fetchQueue,
  fetchRooms,
  finishRoom,
  updateRoom,
  fetchPharmacyQueue,
  callNextPharmacyPatient,
  completePharmacyPatient
} from '../services/api';

const HISTORY_LIMIT = 200;

function AdminDashboard() {
  const socket = useSocket();
  const [queue, setQueue] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selection, setSelection] = useState({});
  const [etaPreview, setEtaPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newRoom, setNewRoom] = useState('');
  const [addingRoom, setAddingRoom] = useState(false);
  const [finishingRoomId, setFinishingRoomId] = useState(null);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [assigningRoomId, setAssigningRoomId] = useState(null);
  const [updatingRoomId, setUpdatingRoomId] = useState(null);
  const [deletingRoomId, setDeletingRoomId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [pharmacyQueue, setPharmacyQueue] = useState([]);
  const [callingPharmacyNext, setCallingPharmacyNext] = useState(false);
  const [completingPharmacyId, setCompletingPharmacyId] = useState(null);

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      try {
        const [queueRes, roomsRes, etaRes, historyRes, pharmacyRes] = await Promise.all([
          fetchQueue(),
          fetchRooms(),
          fetchEta(),
          fetchHistory({ limit: HISTORY_LIMIT, page: 1 }),
          fetchPharmacyQueue()
        ]);
        setQueue(queueRes.data.queue);
        setRooms(roomsRes.data.rooms);
        setEtaPreview(etaRes.data);
        setHistory(historyRes.data.history || []);
        setHistoryPage(historyRes.data.pagination?.page || 1);
        setHistoryHasMore(Boolean(historyRes.data.pagination?.hasMore));
        setPharmacyQueue(pharmacyRes.data.queue || []);
      } catch (err) {
        setError('Unable to load initial data');
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    try {
      const res = await fetchHistory({ limit: HISTORY_LIMIT, page });
      setHistory(res.data.history || []);
      setHistoryPage(res.data.pagination?.page || page);
      setHistoryHasMore(Boolean(res.data.pagination?.hasMore));
    } catch (err) {
      setError((prev) => prev || 'Unable to load history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    socket.on('queue_update', setQueue);
    socket.on('room_update', setRooms);
    socket.on('new_patient', handleNewPatient);
    socket.on('pharmacy_update', setPharmacyQueue);

    return () => {
      socket.off('queue_update', setQueue);
      socket.off('room_update', setRooms);
      socket.off('new_patient', handleNewPatient);
      socket.off('pharmacy_update', setPharmacyQueue);
    };
  }, [socket]);

  const handleNewPatient = () => {
    fetchEta().then((res) => setEtaPreview(res.data));
  };

  const handleSelectRoom = (queueId, roomId) => {
    setSelection((prev) => ({ ...prev, [queueId]: roomId }));
  };

  const performAssignment = async (queueId, roomId) => {
    if (!roomId || !queueId) return;
    try {
      setError('');
      await assignRoom({ queueId, roomId });
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to assign room';
      setError(message);
      throw err;
    }
  };

  const handleAssignRoom = async (queueId) => {
    const roomId = selection[queueId];
    if (!roomId) return;
    await performAssignment(queueId, roomId);
    setSelection((prev) => ({ ...prev, [queueId]: '' }));
  };

  const handleAssignFromRoom = async (roomId, queueId) => {
    if (!roomId || !queueId) return;
    setAssigningRoomId(roomId);
    try {
      await performAssignment(queueId, roomId);
    } finally {
      setAssigningRoomId(null);
    }
  };

  const handleFinishRoom = async (roomId) => {
    if (!roomId) return;
    setFinishingRoomId(roomId);
    setError('');
    try {
      await finishRoom({ roomId });
      await loadHistory(1);
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to finish room';
      setError(message);
    } finally {
      setFinishingRoomId(null);
    }
  };

  const handleAutoAssign = async () => {
    setAutoAssigning(true);
    setError('');
    try {
      await autoAssignNext();
    } catch (err) {
      const message = err?.response?.data?.message || 'Auto-assign failed';
      setError(message);
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleRenameRoom = async (roomId, name) => {
    setUpdatingRoomId(roomId);
    setError('');
    try {
      await updateRoom(roomId, { name });
    } catch (err) {
      const message = err?.response?.data?.message || 'Unable to rename room';
      setError(message);
    } finally {
      setUpdatingRoomId(null);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    setDeletingRoomId(roomId);
    setError('');
    try {
      await deleteRoom(roomId);
    } catch (err) {
      const message = err?.response?.data?.message || 'Unable to remove room';
      setError(message);
    } finally {
      setDeletingRoomId(null);
    }
  };

  const handleAddRoom = async (event) => {
    event.preventDefault();
    if (!newRoom.trim()) return;
    setAddingRoom(true);
    try {
      setError('');
      await addRoom({ name: newRoom.trim() });
      setNewRoom('');
    } catch (err) {
      setError('Failed to add room');
    } finally {
      setAddingRoom(false);
    }
  };

  const handleCallNextPharmacy = async () => {
    setCallingPharmacyNext(true);
    setError('');
    try {
      await callNextPharmacyPatient();
    } catch (err) {
      const message = err?.response?.data?.message || 'No patients waiting for pharmacy';
      setError(message);
    } finally {
      setCallingPharmacyNext(false);
    }
  };

  const handleCompletePharmacy = async (pharmacyId) => {
    if (!pharmacyId) return;
    setCompletingPharmacyId(pharmacyId);
    setError('');
    try {
      await completePharmacyPatient({ pharmacyId });
    } catch (err) {
      const message = err?.response?.data?.message || 'Unable to complete pharmacy item';
      setError(message);
    } finally {
      setCompletingPharmacyId(null);
    }
  };

  const hasWaitingPatients = queue.some((entry) => entry.status === 'waiting');
  const hasAvailableRooms = rooms.some((room) => room.is_available);
  const autoAssignDisabled = !hasWaitingPatients || !hasAvailableRooms || autoAssigning;
  const waitingQueue = queue.filter((entry) => entry.status === 'waiting');

  if (loading) {
    return <p className="helper-text">Booting the command deck…</p>;
  }

  return (
    <section className="admin-grid">
      {error && <p className="error">{error}</p>}
      <div className="admin-hero">
        <div className="admin-floating-grid" />
        <div className="admin-pill-row">
          <span className="badge">Control deck</span>
          <span className="badge status-ready">Realtime linked</span>
          <span className="badge status-waiting">Pharmacy handoff</span>
        </div>
        <h2>Orchestrate rooms, queue, and pharmacy in one glass cockpit.</h2>
        <p className="helper-text">Live sockets, instant actions, and history at a glance.</p>
      </div>
      <div className="admin-grid-lux">
        <div className="card stat admin-card-lux success">
          <div className="admin-shimmer" />
          <p>Queue Length</p>
          <h2 style={{ margin: '0.35rem 0 0' }}>{queue.length}</h2>
          <p className="helper-text">Waiting + called</p>
        </div>
        <div className="card stat admin-card-lux info">
          <div className="admin-shimmer" />
          <p>ETA (new patient)</p>
          <h2 style={{ margin: '0.35rem 0 0' }}>{etaPreview?.etaMinutes ?? '—'} min</h2>
          <p className="helper-text">Based on current load</p>
        </div>
        <div className="card quick-actions admin-card-lux warning">
          <div className="admin-shimmer" />
          <div>
            <h3>Quick Actions</h3>
            <p className="helper-text">Match next waiting patient with the first available room.</p>
          </div>
          <div className="action-buttons">
            <button type="button" onClick={handleAutoAssign} disabled={autoAssignDisabled}>
              {autoAssigning ? 'Auto assigning…' : 'Auto assign next patient'}
            </button>
            <small className="helper-text">
              Requires at least one waiting patient and an available room.
            </small>
          </div>
        </div>
      </div>
      <QueueTable
        queue={queue}
        rooms={rooms}
        selection={selection}
        onSelectRoom={handleSelectRoom}
        onAssignRoom={handleAssignRoom}
      />
      <RoomsPanel
        rooms={rooms}
        waitingQueue={waitingQueue}
        onFinishRoom={handleFinishRoom}
        finishingRoomId={finishingRoomId}
        onAssignRoom={handleAssignFromRoom}
        assigningRoomId={assigningRoomId}
        onRenameRoom={handleRenameRoom}
        updatingRoomId={updatingRoomId}
        onDeleteRoom={handleDeleteRoom}
        deletingRoomId={deletingRoomId}
      />
      <PharmacyQueuePanel
        queue={pharmacyQueue}
        onCallNext={handleCallNextPharmacy}
        onComplete={handleCompletePharmacy}
        callingNext={callingPharmacyNext}
        completingId={completingPharmacyId}
      />
      <div className="card">
        <h3>Add Room</h3>
        <form className="inline-form" onSubmit={handleAddRoom}>
          <input
            value={newRoom}
            onChange={(event) => setNewRoom(event.target.value)}
            placeholder="Room name"
          />
          <button type="submit" disabled={addingRoom}>
            {addingRoom ? 'Saving…' : 'Add'}
          </button>
        </form>
      </div>
      <PatientHistory
        history={history}
        loading={historyLoading}
        onRefresh={() => loadHistory(historyPage)}
        page={historyPage}
        hasMore={historyHasMore}
        onNextPage={() => loadHistory(historyPage + 1)}
        onPrevPage={() => loadHistory(Math.max(historyPage - 1, 1))}
      />
    </section>
  );
}

export default AdminDashboard;
