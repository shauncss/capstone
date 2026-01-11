import { useCallback, useEffect, useState } from 'react';
import useSocket from '../hooks/useSocket';
import QueueTable from '../components/QueueTable';
import RoomsPanel from '../components/RoomsPanel';
import PatientHistory from '../components/PatientHistory';
import PaymentQueuePanel from '../components/PaymentQueuePanel';
import PharmacyQueuePanel from '../components/PharmacyQueuePanel';
import '../styles/admin.css';
import {
  assignRoom,
  autoAssignNext,
  fetchEta,
  fetchHistory,
  fetchQueue,
  fetchRooms,
  finishRoom,
  fetchPaymentQueue,
  callNextPaymentPatient,
  completePaymentPatient,
  fetchPharmacyQueue, 
  callNextPharmacyPatient,
  completePharmacyPatient
} from '../services/api';

const HISTORY_LIMIT = 200;

function AdminDashboard() {
  const socket = useSocket();
  const [activeTab, setActiveTab] = useState('consultation');

  const [queue, setQueue] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selection, setSelection] = useState({});
  const [etaPreview, setEtaPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Room action states
  const [finishingRoomId, setFinishingRoomId] = useState(null);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [assigningRoomId, setAssigningRoomId] = useState(null);

  // History states
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasMore, setHistoryHasMore] = useState(false);

  // Payment states
  const [paymentQueue, setPaymentQueue] = useState([]);
  const [callingPaymentNext, setCallingPaymentNext] = useState(false);
  const [completingPaymentId, setCompletingPaymentId] = useState(null);

  // Pharmacy states
  const [pharmacyQueue, setPharmacyQueue] = useState([]);
  const [callingPharmacyNext, setCallingPharmacyNext] = useState(false);
  const [completingPharmacyId, setCompletingPharmacyId] = useState(null);

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      try {
        const [queueRes, roomsRes, etaRes, historyRes, pharmacyRes, paymentRes] = await Promise.all([
          fetchQueue(),
          fetchRooms(),
          fetchEta(),
          fetchHistory({ limit: HISTORY_LIMIT, page: 1 }),
          fetchPharmacyQueue(),
          fetchPaymentQueue()
        ]);
        setQueue(queueRes.data.queue);
        setRooms(roomsRes.data.rooms);
        setEtaPreview(etaRes.data);
        setHistory(historyRes.data.history || []);
        setHistoryPage(historyRes.data.pagination?.page || 1);
        setHistoryHasMore(Boolean(historyRes.data.pagination?.hasMore));
        setPaymentQueue(paymentRes.data.queue || []);
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
    socket.on('payment_update', setPaymentQueue);

    return () => {
      socket.off('queue_update', setQueue);
      socket.off('room_update', setRooms);
      socket.off('new_patient', handleNewPatient);
      socket.off('pharmacy_update', setPharmacyQueue);
      socket.off('payment_update', setPaymentQueue);
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
  
  const handleCallNextPayment = async () => {
    setCallingPaymentNext(true);
    setError('');
    try {
      await callNextPaymentPatient();
    } catch (err) {
      const message = err?.response?.data?.message || 'No patients waiting for payment';
      setError(message);
    } finally {
      setCallingPaymentNext(false);
    }
  };

  const handleCompletePayment = async (paymentId) => {
    if (!paymentId) return;
    setCompletingPaymentId(paymentId);
    setError('');
    try {
      await completePaymentPatient({ paymentId });
    } catch (err) {
      const message = err?.response?.data?.message || 'Unable to complete payment';
      setError(message);
    } finally {
      setCompletingPaymentId(null);
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

  if (loading) {
    return <p className="helper-text">Booting the command deck…</p>;
  }

  return (
    <section className="admin-grid">
      {error && <p className="error">{error}</p>}
      
      <div className="admin-hero">
        <div className="admin-floating-grid" />
        
        <h3 style={{ 
          fontSize: '1.25rem', 
          marginBottom: '1rem', 
          marginTop: '0.2rem',
          position: 'relative', 
          zIndex: 1,
          fontWeight: 600,
          color: '#e2e8f0'
        }}>
          Admin Dashboard - Authorized personnel only.
        </h3>

        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '0.75rem', 
          position: 'relative', 
          zIndex: 1 
        }}>
          <div 
            className={`nav-card ${activeTab === 'consultation' ? 'active' : ''}`}
            onClick={() => setActiveTab('consultation')}
          >
            <h3>Consultation</h3>
          </div>

          <div 
            className={`nav-card ${activeTab === 'payment' ? 'active' : ''}`}
            onClick={() => setActiveTab('payment')}
          >
            <h3>Payment</h3>
          </div>

          <div 
            className={`nav-card ${activeTab === 'pharmacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('pharmacy')}
          >
            <h3>Pharmacy</h3>
          </div>

          <div 
            className={`nav-card ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <h3>Patient History</h3>
          </div>
        </div>
      </div>

      {/* 1. CONSULTATION PAGE */}
      {activeTab === 'consultation' && (
        <>
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
                <p>Quick Actions</p>
              <div className="action-buttons">
                <button type="button" onClick={handleAutoAssign} disabled={autoAssignDisabled}>
                  {autoAssigning ? 'Auto assigning…' : 'Auto assign next patient'}
                </button>
              </div>
              <p className="helper-text">Match next patient to an available room.</p>
            </div>
          </div>

          <RoomsPanel
            rooms={rooms}
            queue={queue}
            onFinishRoom={handleFinishRoom}
            finishingRoomId={finishingRoomId}
            onAssignRoom={handleAssignFromRoom}
            assigningRoomId={assigningRoomId}
          />
          <QueueTable
            queue={queue}
            rooms={rooms}
            selection={selection}
            onSelectRoom={handleSelectRoom}
            onAssignRoom={handleAssignRoom}
          />
        </>
      )}

      {/* 2. PAYMENT PAGE */}
      {activeTab === 'payment' && (
        <PaymentQueuePanel
          queue={paymentQueue}
          onCallNext={handleCallNextPayment}
          onComplete={handleCompletePayment}
          callingNext={callingPaymentNext}
          completingId={completingPaymentId}
        />
      )}

      {/* 3. PHARMACY PAGE */}
      {activeTab === 'pharmacy' && (
        <PharmacyQueuePanel
          queue={pharmacyQueue}
          onCallNext={handleCallNextPharmacy}
          onComplete={handleCompletePharmacy}
          callingNext={callingPharmacyNext}
          completingId={completingPharmacyId}
        />
      )}

      {/* 4. PATIENT HISTORY PAGE */}
      {activeTab === 'history' && (
        <PatientHistory
          history={history}
          loading={historyLoading}
          onRefresh={() => loadHistory(historyPage)}
          page={historyPage}
          hasMore={historyHasMore}
          onNextPage={() => loadHistory(historyPage + 1)}
          onPrevPage={() => loadHistory(Math.max(historyPage - 1, 1))}
        />
      )}
    </section>
  );
}

export default AdminDashboard;