import React from 'react';

function PaymentQueuePanel({
  queue = [],
  onCallNext,
  onComplete,
  callingNext,
  completingId
}) {
  const currentServing = queue.find((entry) => entry.status === 'ready');
  const waitingQueue = queue.filter((entry) => entry.status === 'waiting');

  return (
    <div className="card payment-card">
      <div className="card-header">
        <div>
          <h3>Payment Queue</h3>
          <p className="muted">Process payments before pharmacy.</p>
        </div>
      </div>

      <div className="admin-card-lux info" style={{ padding: '1.5rem', margin: '1rem 0', textAlign: 'center' }}>
        <p className="helper-text" style={{ marginBottom: '0.5rem' }}>NOW SERVING</p>
        
        {currentServing ? (
          <>
            <h1 style={{ fontSize: '3rem', margin: '0.5rem 0' }}>{currentServing.queue_number}</h1>
            <h3 style={{ marginBottom: '1.5rem' }}>{currentServing.first_name} {currentServing.last_name}</h3>
            
            <button 
              className="success"
              style={{ width: '100%', maxWidth: '200px' }}
              onClick={() => onComplete(currentServing.payment_id)}
              disabled={completingId === currentServing.payment_id}
            >
              {completingId === currentServing.payment_id ? 'Completing...' : 'Done'}
            </button>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '3rem', margin: '0.5rem 0', color: 'rgba(255,255,255,0.2)' }}>--</h1>
            <h3 style={{ marginBottom: '1.5rem', color: 'rgba(255,255,255,0.2)' }}>Waiting for next patient</h3>
            
            <button 
              style={{ width: '100%', maxWidth: '200px' }}
              onClick={onCallNext} 
              disabled={callingNext || waitingQueue.length === 0}
            >
              {callingNext ? 'Calling...' : 'Call Next'}
            </button>
          </>
        )}
      </div>

      <h4 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Waiting List ({waitingQueue.length})</h4>
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {waitingQueue.length === 0 && (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', color: '#64748b' }}>No patients waiting.</td>
            </tr>
          )}
          {waitingQueue.map((entry) => (
            <tr key={entry.payment_id}>
              <td>{entry.queue_number}</td>
              <td>{entry.first_name} {entry.last_name}</td>
              <td>
                <span className="badge status-waiting">Waiting</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PaymentQueuePanel;