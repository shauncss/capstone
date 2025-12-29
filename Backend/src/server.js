require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const os = require('os');
const { Server } = require('socket.io');

const patientRoutes = require('./routes/patientRoutes');
const queueRoutes = require('./routes/queueRoutes');
const roomRoutes = require('./routes/roomRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const pharmacyRoutes = require('./routes/pharmacyRoutes');
const adminRoutes = require('./routes/adminRoutes');
const registerSocket = require('./sockets');
const queueService = require('./services/queueService');
const pharmacyService = require('./services/pharmacyService');

const app = express();
const server = http.createServer(app);

function getLocalNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = new Set();
  Object.values(interfaces).forEach((entries = []) => {
    entries.forEach((entry) => {
      if (entry?.family === 'IPv4' && !entry.internal) {
        addresses.add(entry.address);
      }
    });
  });
  return [...addresses];
}

function expandConfiguredOrigins(origins) {
  if (!origins.length) return origins;
  const expanded = new Set(origins);
  const localIps = getLocalNetworkAddresses();

  origins.forEach((origin) => {
    try {
      const url = new URL(origin);
      const usesLocalHost = ['localhost', '127.0.0.1'].includes(url.hostname);
      if (usesLocalHost) {
        localIps.forEach((ip) => {
          expanded.add(`${url.protocol}//${ip}${url.port ? `:${url.port}` : ''}`);
        });
      }
    } catch (err) {
      console.warn(`Invalid CLIENT_ORIGIN entry skipped: ${origin}`);
    }
  });

  return [...expanded];
}

const configuredOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

const expandedOrigins = expandConfiguredOrigins(configuredOrigins);
const allowAllOrigins = expandedOrigins.length === 0;

const corsOriginOption = allowAllOrigins ? true : expandedOrigins;

const io = new Server(server, {
  cors: {
    origin: allowAllOrigins ? '*' : expandedOrigins,
    methods: ['GET', 'POST', 'PATCH']
  }
});

registerSocket(io);

app.use(helmet());
app.use(cors({ origin: corsOriginOption }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Provide a simple root handler so GET / doesn't return "Cannot GET /".
// Redirect to the first configured client origin (usually the frontend dev server).
app.get('/', (req, res) => {
  if (!expandedOrigins.length) {
    return res.status(200).json({ message: 'Frontend origin not configured. Set CLIENT_ORIGIN to redirect automatically.' });
  }
  const clientUrl = expandedOrigins[0];
  return res.redirect(clientUrl);
});

app.use('/api', patientRoutes);
app.use('/api', queueRoutes);
app.use('/api', roomRoutes);
app.use('/api', sensorRoutes);
app.use('/api', pharmacyRoutes);
app.use('/api', adminRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  await Promise.all([
    queueService.broadcastQueue(),
    queueService.broadcastRooms(),
    pharmacyService.broadcastPharmacyQueue()
  ]);
  console.log(`Server running on port ${PORT}`);
});
