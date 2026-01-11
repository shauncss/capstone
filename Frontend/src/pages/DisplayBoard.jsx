import { useEffect, useState } from 'react';
import useSocket from '../hooks/useSocket';
import { fetchQueue, fetchPaymentQueue, fetchPharmacyQueue } from '../services/api';
import '../styles/display.css';

function DisplayBoard() {
  const socket = useSocket();
  const [consultationQueue, setConsultationQueue] = useState([]);
  const [paymentQueue, setPaymentQueue] = useState([]);
  const [pharmacyQueue, setPharmacyQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Load Initial Data
  useEffect(() => {
    async function loadData() {
      try {
        const [qRes, payRes, pharmRes] = await Promise.all([
          fetchQueue(),
          fetchPaymentQueue(),
          fetchPharmacyQueue()
        ]);
        setConsultationQueue(qRes.data.queue || []);
        setPaymentQueue(payRes.data.queue || []);
        setPharmacyQueue(pharmRes.data.queue || []);
      } catch (err) {
        console.error("Failed to load display data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // 2. Real-time Updates
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = (setter) => (data) => {
      setter(data.queue ? data.queue : data);
    };
    socket.on('queue_update', handleUpdate(setConsultationQueue));
    socket.on('payment_update', handleUpdate(setPaymentQueue));
    socket.on('pharmacy_update', handleUpdate(setPharmacyQueue));
    return () => {
      socket.off('queue_update');
      socket.off('payment_update');
      socket.off('pharmacy_update');
    };
  }, [socket]);

  // 3. Filter Data
  const servingRoom1 = consultationQueue.find(q => q.status === 'called' && q.assigned_room_id === 1);
  const servingRoom2 = consultationQueue.find(q => q.status === 'called' && q.assigned_room_id === 2);
  const servingPayment = paymentQueue.find(q => q.status === 'ready');
  const servingPharmacy = pharmacyQueue.find(q => q.status === 'ready');

  const waitingConsultation = consultationQueue.filter(q => q.status === 'waiting');
  const waitingPayment = paymentQueue.filter(q => q.status === 'waiting');
  const waitingPharmacy = pharmacyQueue.filter(q => q.status === 'waiting');

  if (loading) return <div className="display-content"><p>Loading...</p></div>;

  return (
    <section className="display-content">
      
      {/* 1. NOW SERVING CARD (Top Section) */}
      <div className="now-serving-card">
        <div className="card-header centered">
          <h2>Now Serving</h2>
        </div>
        
        <div className="serving-grid">
          <ServingSlot label="Consultation Room 1" ticket={servingRoom1} />
          <ServingSlot label="Consultation Room 2" ticket={servingRoom2} />
          <ServingSlot label="Payment Counter" ticket={servingPayment} />
          <ServingSlot label="Pharmacy Counter" ticket={servingPharmacy} />
        </div>
      </div>

      {/* 2. QUEUE LISTS (Bottom Section - Moved Outside) */}
      <div className="queues-grid">
        <QueueList title="Consultation Queue" list={waitingConsultation} />
        <QueueList title="Payment Queue" list={waitingPayment} />
        <QueueList title="Pharmacy Queue" list={waitingPharmacy} />
      </div>

    </section>
  );
}

// Sub-components
function ServingSlot({ label, ticket }) {
  return (
    <div className={`serving-slot ${ticket ? 'active' : ''}`}>
      <span className="slot-label">{label}</span>
      {ticket ? (
        <>
          <h1 className="slot-number">{ticket.queue_number}</h1>
          <p className="slot-name">{ticket.first_name} {ticket.last_name}</p>
        </>
      ) : (
        <h1 className="slot-number" style={{ opacity: 0.3 }}>—</h1>
      )}
    </div>
  );
}

function QueueList({ title, list }) {
  return (
    <div className="queue-card">
      <div className="card-header">
        <h3>{title}</h3>
        <span className="badge">{list.length}</span>
      </div>
      <div className="queue-list-container">
        {list.length === 0 ? (
          <p className="empty-message">Empty</p>
        ) : (
          <ul className="queue-list">
            {list.map((item) => (
              <li key={item.id || item.queue_id || item.payment_id || item.pharmacy_id}>
                <span className="q-num">{item.queue_number}</span>
                <span className="q-name">{item.first_name} {item.last_name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default DisplayBoard;