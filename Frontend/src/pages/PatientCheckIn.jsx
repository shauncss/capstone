import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { submitCheckIn, bookAppointment, findMyAppointment, checkInAppointment } from '../services/api';
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
  
  // TABS: 'walkin' | 'book' | 'arrived'
  const [activeTab, setActiveTab] = useState('walkin');

  // STATES
  const [formData, setFormData] = useState(initialState);
  const [bookingData, setBookingData] = useState({ 
  firstName: '', 
  lastName: '', 
  phone: '', 
  appointmentTime: null,
  dateOfBirth: '',
  symptoms: ''
});
  const [lookupPhone, setLookupPhone] = useState('');
  const [foundAppointment, setFoundAppointment] = useState(null);
  const [arrivedVitals, setArrivedVitals] = useState({ temp: '', spo2: '', hr: '' });

  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. PRE-FILL VITALS (for walk-in)
  useEffect(() => {
    const temp = searchParams.get('temp') || '';
    const spo2 = searchParams.get('spo2') || '';
    const hr = searchParams.get('hr') || '';
    setFormData((prev) => ({ ...prev, temp, spo2, hr }));
    setArrivedVitals({ temp, spo2, hr });
  }, [searchParams]);

  // HANDLERS
  const handleWalkInChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBookingChange = (e) => {
    const { name, value } = e.target;
    setBookingData((prev) => ({ ...prev, [name]: value }));
  };

  // SUBMIT: WALK-IN
  const handleWalkInSubmit = async (e) => {
    e.preventDefault();
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

  // SUBMIT: BOOK APPOINTMENT
  const handleBookSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      await bookAppointment(bookingData);
      const timeStr = bookingData.appointmentTime 
        ? bookingData.appointmentTime.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) 
        : '';
      setSuccessMsg(`Appointment booked on ${timeStr}! \n We'll see you then.`);
      setBookingData({ firstName: '', lastName: '', phone: '', appointmentTime: null });
      setTimeout(() => {
        setSuccessMsg('');
      }, 5000);
    } catch (err) {
      setError(err.response?.data?.message || 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  // SUBMIT: FIND APPOINTMENT
  const handleFindAppointment = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setFoundAppointment(null);
    try {
      const { data } = await findMyAppointment(lookupPhone);
      setFoundAppointment(data);
    } catch (err) {
      setError('No appointment found for this number today.');
    } finally {
      setSubmitting(false);
    }
  };

  // SUBMIT: CHECK-IN APPOINTMENT
  const handleArrivedCheckIn = async () => {
    if (!foundAppointment) return;
    setSubmitting(true);
    try {
      const vitals = {
        temp: arrivedVitals.temp,
        spo2: arrivedVitals.spo2,
        hr: arrivedVitals.hr,
      };
      const { data } = await checkInAppointment(foundAppointment.id, vitals);
      setConfirmation(data);
      setFoundAppointment(null);
      setLookupPhone('');
    } catch (err) {
      setError(err.response?.data?.message || 'Check-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  // REDIRECT ON SUCCESS
  useEffect(() => {
    if (!confirmation) return undefined;
    const timeout = setTimeout(() => {
      navigate('/display', { state: { queueNumber: confirmation.queueNumber } });
    }, 5000);
    return () => clearTimeout(timeout);
  }, [confirmation, navigate]);

  return (
    <section className="lux-grid">
      <div className="patient-hero">
        <div className="patient-floating-grid" />
        <h3 className="patient-title">Patient Dashboard - Check Ins and Appointments</h3>

        <div className="patient-biometrics">
          <div className="patient-neon">
            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: '0.35rem' }}>
              <p className="helper-text">Latest biometrics detected from Kiosk  </p>
              <div className="pill-row">
                <span className="badge">Temp: {formData.temp || '—'}°C</span>
                <span className="badge">SpO₂: {formData.spo2 || '—'}%</span>
                <span className="badge">HR: {formData.hr || '—'} bpm</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* NAVIGATION BAR */}
        <div className="patient-nav-row">
          <div
            className={`nav-pill ${activeTab === 'walkin' ? 'active' : ''}`}
            onClick={() => { setActiveTab('walkin'); setError(''); setSuccessMsg(''); }}
          >
            Self Check-in
          </div>

          <div style={{ flex: 1 }}></div>
          <div 
            className={`nav-pill ${activeTab === 'book' ? 'active' : ''}`}
            onClick={() => { setActiveTab('book'); setError(''); setSuccessMsg(''); }}
            style={{ marginRight: '1.5rem' }}
          >
            Make an Appointment
          </div>

          <div
            className={`nav-pill ${activeTab === 'arrived' ? 'active' : ''}`}
            onClick={() => { setActiveTab('arrived'); setError(''); setSuccessMsg(''); }}
          >
            I have an Appointment
          </div>
        </div>
      </div>

      <div className={`card patient-lux-card tab-${activeTab}`}>
        <div className="patient-shimmer" />

        {/* TAB 1: SELF CHECK-IN (WALK-IN) */}
        {activeTab === 'walkin' && (
          <>
            <h3 style={{ marginTop: 0 }}>Self Check-in Form</h3>
            <p className="helper-text">Biometrics auto-fills from the kiosk QR.</p>
            <form className="form-grid" onSubmit={handleWalkInSubmit}>
              <div className="checkin-row cols-2">
                <label>
                  First Name*
                  <input name="firstName" required value={formData.firstName} onChange={handleWalkInChange} />
                </label>
                <label>
                  Last Name*
                  <input name="lastName" required value={formData.lastName} onChange={handleWalkInChange} />
                </label>
              </div>

              <div className="checkin-row cols-2">
                <label>
                  Phone Number* （01X-XXXXXXX)
                  <input name="phone" required value={formData.phone} onChange={handleWalkInChange} />
                </label>
                <label className="date-picker-label">
                  Date of Birth
                  <DatePicker
                    selected={formData.dateOfBirth ? new Date(formData.dateOfBirth) : null}
                    onChange={(date) => {
                      const formatted = date ? date.toISOString().split('T')[0] : '';
                      setFormData(prev => ({ ...prev, dateOfBirth: formatted }));
                    }}
                    placeholderText="Click to select"
                    showMonthDropdown showYearDropdown dropdownMode="select"     
                    calendarClassName="compact-calendar" 
                    className="custom-datepicker" wrapperClassName="date-picker-wrapper"
                  />
                </label>
              </div>

                <label className="full-width">
                  Symptoms
                  <textarea class="no-resize" name="symptoms" rows="3" value={formData.symptoms} onChange={handleWalkInChange} />
                </label>
              
              <div className="checkin-row cols-3">
                 <label>Temperature (°C)<input name="temp" value={formData.temp} onChange={handleWalkInChange} /></label>
                 <label>SpO₂ (%)<input name="spo2" value={formData.spo2} onChange={handleWalkInChange} /></label>
                 <label>Heart Rate (bpm)<input name="hr" value={formData.hr} onChange={handleWalkInChange} /></label>
              </div>

              {error && <p className="error" style={{ textAlign: 'center' }}>{error}</p>}
              <div className="form-actions">
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit & Join Queue'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* TAB 2: MAKE APPOINTMENT */}
        {activeTab === 'book' && (
          <>
            <h3 style={{ marginTop: 0 }}>Book a Future Visit</h3>
            <p className="helper-text">Secure your slot for a future date.</p>
            <form className="form-grid" onSubmit={handleBookSubmit}>
                <label>First Name*<input name="firstName" required value={bookingData.firstName} onChange={handleBookingChange} /></label>
                <label>Last Name*<input name="lastName" required value={bookingData.lastName} onChange={handleBookingChange} /></label>
                <label>Phone Number* （01X-XXXXXXX) <input name="phone" required value={bookingData.phone} onChange={handleBookingChange} /></label>
                
                <label className="date-picker-label">
                  Date of Birth
                  <DatePicker
                    selected={bookingData.dateOfBirth ? new Date(bookingData.dateOfBirth) : null}
                    onChange={(date) => {
                      const formatted = date ? date.toISOString().split('T')[0] : '';
                      setBookingData(prev => ({ ...prev, dateOfBirth: formatted }));
                    }}
                    placeholderText="Click to select"
                    showMonthDropdown showYearDropdown dropdownMode="select"     
                    calendarClassName="compact-calendar" 
                    className="custom-datepicker" wrapperClassName="date-picker-wrapper"
                  />
                </label>
                
                <label className="date-picker-label">
                  Appointment Time*
                  <DatePicker
                    selected={bookingData.appointmentTime}
                    onChange={(date) => setBookingData(prev => ({ ...prev, appointmentTime: date }))}
                    
                    placeholderText="Click to select"
                    showTimeSelect
                    dateFormat="MMMM d, yyyy h:mm aa"
                    showMonthDropdown showYearDropdown dropdownMode="select" 
                    calendarClassName="compact-calendar" 
                    className="custom-datepicker" wrapperClassName="date-picker-wrapper"
                  />
                </label>

                <label className="full-width">
                  Symptoms
                  <textarea class="no-resize" name="symptoms" rows="4" value={bookingData.symptoms} onChange={handleBookingChange} />
                </label>

              {error && <p className="error" style={{ textAlign: 'center' }}>{error}</p>}
              {successMsg && <div className="confirmation" style={{textAlign: 'center', borderColor: '#4ade80'}}>{successMsg}</div>}
              
              <div className="form-actions">
                <button type="submit" disabled={submitting || successMsg}>
                  {submitting ? 'Booking…' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* TAB 3: I HAVE AN APPOINTMENT */}
        {activeTab === 'arrived' && (
          <>
            <h3 style={{ marginTop: 0 }}>Arrived for Appointment?</h3>
            <p className="helper-text">Enter your phone number to find your booking for today.</p>
            
            {!foundAppointment ? (
              <form className="form-grid" onSubmit={handleFindAppointment}>
                <label>
                  Registered Phone Number* （01X-XXXXXXX)
                  <input 
                    value={lookupPhone} 
                    onChange={(e) => setLookupPhone(e.target.value)} 
                    required
                  />
                </label>
                <label>Temp (°C)<input value={arrivedVitals.temp} onChange={(e) => setArrivedVitals(prev => ({...prev, temp: e.target.value}))} /></label>
                <label>SpO₂ (%)<input value={arrivedVitals.spo2} onChange={(e) => setArrivedVitals(prev => ({...prev, spo2: e.target.value}))} /></label>
                <label>HR (bpm)<input value={arrivedVitals.hr} onChange={(e) => setArrivedVitals(prev => ({...prev, hr: e.target.value}))} /></label>

                <div className="form-actions">
                  <button type="submit" disabled={submitting}>Find Booking</button>
                </div>
              </form>
            ) : (
              <div className="confirmation" style={{ textAlign: 'center', borderColor: '#2dd4bf' }}>
                <h2>Booking Found!</h2>
                <p style={{fontSize: '1.2rem', margin: '0.5rem 0'}}>
                  Welcome, <strong>{foundAppointment.first_name} {foundAppointment.last_name}</strong>
                </p>
                <p className="helper-text">Scheduled for: {new Date(foundAppointment.appointment_time).toLocaleTimeString()}</p>
                
                <div className="form-actions">
                  <button style={{ margin: '1rem' }} onClick={handleArrivedCheckIn} disabled={submitting}>
                    {submitting ? 'Checking in...' : 'Yes, Check Me In'}
                  </button>
                  <button style={{ margin: '1rem' }} className="ghost-button" type="button" onClick={() => setFoundAppointment(null)}>Cancel</button>
                </div>
              </div>
            )}

            {error && <p className="error" style={{ textAlign: 'center', marginTop: '1rem' }}>{error}</p>}
          </>
        )}

        {/* CONFIRMATION MSG */}
        {confirmation && (
          <div className="confirmation" style={{ marginTop: '2rem', borderColor: 'rgba(124, 58, 237, 0.3)' }}>
            <h3>Queued!</h3>
            <p>Your queue number is <strong>{confirmation.queueNumber}</strong>.</p>
            <p>Estimated wait: <strong>{confirmation.etaMinutes} minutes</strong>.</p>
            <p className="helper-text">Redirecting to display board...</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default PatientCheckIn;