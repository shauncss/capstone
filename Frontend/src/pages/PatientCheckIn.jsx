import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DatePicker from 'react-datepicker'; // 1. Import Component
import 'react-datepicker/dist/react-datepicker.css'; // 2. Import Styles
import { submitCheckIn } from '../services/api';
import '../styles/patient.css';

const initialState = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  phone: '',
  symptoms: '',
  temp: '',
  spo2: '',
  hr: ''
};

function PatientCheckIn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const temp = searchParams.get('temp') || '';
    const spo2 = searchParams.get('spo2') || '';
    const hr = searchParams.get('hr') || '';
    setFormData((prev) => ({ ...prev, temp, spo2, hr }));
  }, [searchParams]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { data } = await submitCheckIn(formData);
      setConfirmation(data);
      setFormData(initialState);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to submit check-in');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!confirmation) return undefined;
    const timeout = setTimeout(() => {
      navigate('/display', { state: { queueNumber: confirmation.queueNumber } });
    }, 4000);
    return () => clearTimeout(timeout);
  }, [confirmation, navigate]);

  return (
    <section className="lux-grid">
      <div className="patient-hero">
        <div className="patient-floating-grid" />
        <span className="patient-kicker">Self check-in • Instant queue</span>
        <h3>We pull your biometrics from the kiosk QR and drop you into the live queue with an ETA.</h3>
        <div className="pill-row" style={{ marginTop: '1rem' }}>
          <span className="badge status-waiting">Biometrics optional</span>
          <span className="badge status-ready">Encrypted transit</span>
          <span className="badge status-called">Live ETA preview</span>
        </div>
        <div className="patient-biometrics">
          <div className="patient-sparkles">
            <div className="patient-sparkle" />
            <div className="patient-sparkle" />
            <div className="patient-sparkle" />
            <div className="patient-sparkle" />
          </div>
          <div className="patient-neon" style={{ padding: '1rem' }}>
            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: '0.35rem' }}>
              <p className="helper-text">Latest biometrics detected</p>
              <div className="pill-row">
                <span className="badge">Temp: {formData.temp || '—'}°C</span>
                <span className="badge">SpO₂: {formData.spo2 || '—'}%</span>
                <span className="badge">HR: {formData.hr || '—'} bpm</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card patient-lux-card">
        <div className="patient-shimmer" />
        <h3 style={{ marginTop: 0 }}>Check-in form</h3>
        <p className="helper-text">Name is required; biometrics auto-fill from the kiosk QR.</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="checkin-row cols-2">
            <label>
              First Name*
              <input name="firstName" required value={formData.firstName} onChange={handleChange} />
            </label>
            <label>
              Last Name*
              <input name="lastName" required value={formData.lastName} onChange={handleChange} />
            </label>
          </div>

          <div className="checkin-row cols-2">
            <label className="date-picker-label">
              Date of Birth
              <DatePicker
                selected={formData.dateOfBirth ? new Date(formData.dateOfBirth) : null}
                onChange={(date) => {
                  const formatted = date ? date.toISOString().split('T')[0] : '';
                  setFormData(prev => ({ ...prev, dateOfBirth: formatted }));
                }}
                placeholderText="Click to select date"
                
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"     
                calendarClassName="compact-calendar" 
                className="custom-datepicker"
                wrapperClassName="date-picker-wrapper"
              />
            </label>
            <label>
              Phone
              <input name="phone" value={formData.phone} onChange={handleChange} />
            </label>
          </div>

          <div className="checkin-row">
            <label className="full-width">
              Symptoms
              <textarea class="no-resize" name="symptoms" rows="3" value={formData.symptoms} onChange={handleChange} />
            </label>
          </div>

          <div className="checkin-row cols-3">
            <label>
              Temperature (°C)
              <input name="temp" value={formData.temp} onChange={handleChange} />
            </label>
            <label>
              SpO₂ (%)
              <input name="spo2" value={formData.spo2} onChange={handleChange} />
            </label>
            <label>
              Heart Rate (bpm)
              <input name="hr" value={formData.hr} onChange={handleChange} />
            </label>
          </div>

          {error && <p className="error" style={{textAlign: 'center'}}>{error}</p>}
          
          <div className="form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit & join queue'}
            </button>
          </div>
          
        </form>
        {confirmation && (
          <div className="confirmation" style={{ borderColor: 'rgba(124, 58, 237, 0.3)' }}>
            <h3>Queued!</h3>
            <p>Your queue number is <strong>{confirmation.queueNumber}</strong>.</p>
            <p>Estimated wait: <strong>{confirmation.etaMinutes} minutes</strong>.</p>
            <p>Current queue size: {confirmation.queue?.length || 0} patients.</p>
            <p className="helper-text">We will show your number on the display next.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default PatientCheckIn;
