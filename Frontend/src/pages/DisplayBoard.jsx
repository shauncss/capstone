import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useSocket from '../hooks/useSocket';
import { fetchQueue, fetchPharmacyQueue } from '../services/api';
import '../styles/display.css';

function DisplayBoard() {
  const socket = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [pharmacyQueue, setPharmacyQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const highlightedQueueNumber = location.state?.queueNumber || null;

  useEffect(() => {
    let cancelled = false;
    async function loadQueue() {
      try {
        const [queueRes, pharmacyRes] = await Promise.all([fetchQueue(), fetchPharmacyQueue()]);
        if (!cancelled) {
          setQueue(queueRes.data.queue || []);
          setPharmacyQueue(pharmacyRes.data.queue || []);
        }
      } catch (err) {
        if (!cancelled) {
          setQueue([]);
          setPharmacyQueue([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadQueue();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleQueueUpdate = useCallback((payload) => {
    if (Array.isArray(payload)) {
      setQueue(payload);
      return;
    }
    if (payload?.queue) {
      setQueue(payload.queue);
    }
  }, []);

  const handlePharmacyUpdate = useCallback((payload) => {
    if (Array.isArray(payload)) {
      setPharmacyQueue(payload);
      return;
    }
    if (payload?.queue) {
      setPharmacyQueue(payload.queue);
    }
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    socket.on('queue_update', handleQueueUpdate);
    socket.on('pharmacy_update', handlePharmacyUpdate);
    return () => socket.off('queue_update', handleQueueUpdate);
  }, [socket, handleQueueUpdate, handlePharmacyUpdate]);

  useEffect(() => {
    if (!highlightedQueueNumber) return undefined;
    const timeout = setTimeout(() => {
      navigate('.', { replace: true, state: {} });
    }, 6500);
    return () => clearTimeout(timeout);
  }, [highlightedQueueNumber, navigate]);

  const calledQueue = queue.filter((entry) => entry.status === 'called' && entry.room_name);
  const currentCalled = calledQueue[0];
  const upcoming = calledQueue.slice(1, 5);
  const queueIsEmpty = calledQueue.length === 0;
  const pharmacyReady = pharmacyQueue.filter((entry) => entry.status === 'ready');
  const pharmacyWaiting = pharmacyQueue.filter((entry) => entry.status === 'waiting');
  const pharmacyHighlight = pharmacyReady[0] || pharmacyWaiting[0];
  const pharmacyList = pharmacyReady.slice(1).concat(pharmacyWaiting);
  const pharmacyIsEmpty = pharmacyQueue.length === 0;

  if (loading) {
    return (
      <section className="display-board">
        <div className="card">
          <p>Loading live queue…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="display-board">
      <div className={`card current-patient${highlightedQueueNumber && currentCalled?.queue_number === highlightedQueueNumber ? ' is-highlighted' : ''}`}>
        <div className="current-header">
          <p>Now Serving</p>
          <span className="badge">Live</span>
        </div>
        <h1>{currentCalled?.queue_number || '—'}</h1>
        <p className="current-name">
          {currentCalled ? `${currentCalled.first_name} ${currentCalled.last_name}` : 'Waiting for next patient'}
        </p>
        {currentCalled?.room_name && <p className="current-room">Proceed to room {currentCalled.room_name}</p>}
        {queueIsEmpty && <p className="helper-text">No patients waiting right now.</p>}
      </div>
      <div className="card upcoming">
        <div className="upcoming-header">
          <h3>Next Up</h3>
          <p>{upcoming.length ? `Showing next ${upcoming.length}` : 'Awaiting new arrivals'}</p>
        </div>
        {upcoming.length === 0 ? (
          <p className="helper-text">Additional patients will appear here as they check in.</p>
        ) : (
          <ul>
            {upcoming.map((entry) => (
              <li
                key={entry.queue_id}
                className={entry.queue_number === highlightedQueueNumber ? 'is-highlighted' : ''}
              >
                <span className="queue-number">{entry.queue_number}</span>
                <span>{entry.first_name} {entry.last_name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card">
        <div className="current-header">
          <p>Pharmacy Pickup</p>
          <span className="badge">Live</span>
        </div>
        <div className={`current-patient${pharmacyHighlight ? ' is-highlighted' : ''}`}>
          <p className="current-name">
            {pharmacyHighlight
              ? `${pharmacyHighlight.first_name} ${pharmacyHighlight.last_name}`
              : 'Waiting for next pickup'}
          </p>
          <h1>{pharmacyHighlight?.queue_number || '—'}</h1>
          <p className="current-room">
            {pharmacyHighlight?.status === 'ready'
              ? 'Ready to collect medication'
              : pharmacyHighlight
                ? 'In pharmacy queue'
                : ''}
          </p>
          {pharmacyIsEmpty && <p className="helper-text">No pharmacy patients right now.</p>}
        </div>
        <div className="upcoming">
          <div className="upcoming-header">
            <h3>Pharmacy Queue</h3>
            <p>{pharmacyList.length ? `Showing ${pharmacyList.length}` : 'Awaiting next patient'}</p>
          </div>
          {pharmacyList.length === 0 ? (
            <p className="helper-text">Patients will appear here after consultation.</p>
          ) : (
            <ul>
              {pharmacyList.map((entry) => (
                <li key={entry.pharmacy_id} className={entry.status === 'ready' ? 'is-highlighted' : ''}>
                  <span className="queue-number">{entry.queue_number}</span>
                  <span>{entry.first_name} {entry.last_name}</span>
                  <span className={`badge status-${entry.status}`}>{entry.status === 'ready' ? 'Ready' : 'Waiting'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export default DisplayBoard;
