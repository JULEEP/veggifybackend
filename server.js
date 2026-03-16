const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const fileUpload = require('express-fileupload');
const socketIo = require('socket.io');

// Route imports
const authRoutes = require('./routes/authroutes');
const addressRoutes = require('./routes/addressRoute');
const routes = require("./routes/foodSystemRoute");
const restaurantProduc = require("./routes/restaurantProductRoute");
const categorieRestaurantProduct = require('./routes/categorieRestaurantProductRoutes');
const cartController = require('./routes/cartRoute');
const deliveryboyRoute = require('./routes/deliveryboyRoute');
const Admin = require('./routes/adminRoutes');
const vendorRoutes = require("./routes/vendorRoute");
const ambsdorRoutes = require("./routes/ambsdorRoutes");

// Controller imports
const userController = require('./controllers/userController');

dotenv.config();
const app = express();
const server = http.createServer(app);

// ========================
// 🔥 IMPORTANT: File Upload & Body Parser Limits
// ========================
// ========================
// 🔥 FIX: Body Parser LIMIT 200MB KAR (sabse pehle)
// ========================
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// ========================
// 🔥 FIX: File Upload LIMIT 200MB KAR
// ========================
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: "/tmp/",
  createParentPath: true,
  limits: { 
    fileSize: 200 * 1024 * 1024  // 200MB
  },
  abortOnLimit: true,
  responseOnLimit: 'File too large! Maximum 200MB allowed.'
}));

app.use('/uploads', express.static('uploads'));

// ========================
// 🔥 FIX: Raw body parser middleware (YE ADD KAR)
// ========================
app.use((req, res, next) => {
  // Increase timeout
  req.setTimeout(30 * 60 * 1000); // 30 minutes
  res.setTimeout(30 * 60 * 1000); // 30 minutes
  next();
});

// ========================
// 🔥 FIX: CORS (EK BAAR MEIN SAB)
// ========================
app.use(cors({
  origin: true, // Ya specific origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
}));


// ========================
// CORS Configuration
// ========================
app.use(cors({
  origin: [
    'https://veegify-web.web.app', 
    'http://localhost:3000', 
    'https://panel.vegiffyy.com', 
    'https://vendor.vegiffyy.com', 
    'https://vegiffyvendordelete.vercel.app', 
    'https://vegiffydeliveryboydeleteurl.vercel.app',
    'https://vegiffy-web.vercel.app',
    'https://vendor.vegiffy.in',
    'https://vegiffypanel.vegiffy.in'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
}));

// Socket.IO setup with proper CORS
const io = socketIo(server, {
  cors: {
    origin: [
      'https://veegify-web.web.app', 
      'http://localhost:3000', 
      'https://panel.vegiffyy.com', 
      'https://vendor.vegiffyy.com',
      'https://vendor.vegiffy.in',
      'https://vegiffypanel.vegiffy.in'
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  // Increase max HTTP request size for socket.io
  maxHttpBufferSize: 1e7 // 10 MB
});

// Make io available globally
global.io = io;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('MongoDB Error:', err));

// Define Routes
app.use('/api', addressRoutes);
app.use('/api', authRoutes);
app.use('/api', routes);
app.use('/api', restaurantProduc);
app.use('/api', categorieRestaurantProduct);
app.use('/api', cartController);
app.use('/api/delivery-boy', deliveryboyRoute);
app.use('/api/admin', Admin);
app.use('/api/vendor', vendorRoutes);
app.use('/api/ambsdor', ambsdorRoutes);

// Routes for sending messages and getting chat history
app.post("/api/sendchat/:deliveryBoyId/:userId", (req, res) => {
  console.log('📨 Send chat route hit');
  userController.sendMessage(req, res);
});

app.get("/api/getchat/:deliveryBoyId/:userId", (req, res) => {
  console.log('📖 Get chat history route hit');
  userController.getChatHistory(req, res);
});

// Live location route
app.get("/api/location/:deliveryBoyId/:userId", (req, res) => {
  console.log('🎯 Get live location route hit');
  const DeliveryBoy = require('./controllers/deliveryBoyController');
  DeliveryBoy.getLiveLocation(req, res);
});

// ========================
// 🔥 IMPORTANT: Global Error Handler for File Size
// ========================
app.use((err, req, res, next) => {
  // Handle payload too large error
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request entity too large. Maximum 50MB allowed.'
    });
  }
  
  // Handle multer/fileupload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File too large. Maximum 50MB total allowed.'
    });
  }
  
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Socket.IO connection handling with detailed logging
io.on('connection', (socket) => {
  console.log('🟢 A user connected:', socket.id);

  // Join specific room for chat
  socket.on('joinChat', (data) => {
    const { deliveryBoyId, userId } = data;
    const roomId = `${deliveryBoyId}_${userId}`;
    socket.join(roomId);
    console.log(`🔷 User ${socket.id} joined chat room: ${roomId}`);
  });

  // Delivery boy joins his location room
  socket.on('joinDeliveryBoyLocation', (deliveryBoyId) => {
    const roomName = `location_${deliveryBoyId}`;
    socket.join(roomName);
    console.log(`🚴 Delivery boy ${deliveryBoyId} joined location room: ${roomName}`);
  });

  // User joins to listen to delivery boy location
  socket.on('joinUserLocation', (userId) => {
    const roomName = `user_${userId}`;
    socket.join(roomName);
    console.log(`👤 User ${userId} joined location room: ${roomName}`);
  });

  // User joins specific delivery boy location room
  socket.on('joinDeliveryBoyTracking', (deliveryBoyId) => {
    const roomName = `location_${deliveryBoyId}`;
    socket.join(roomName);
    console.log(`👤 User joined delivery boy tracking room: ${roomName}`);
  });

  // Leave room
  socket.on('leaveChat', (data) => {
    const { deliveryBoyId, userId } = data;
    const roomId = `${deliveryBoyId}_${userId}`;
    socket.leave(roomId);
    console.log(`🔶 User ${socket.id} left room: ${roomId}`);
  });

  // Location update from delivery boy
  socket.on('updateLocation', (data) => {
    const { deliveryBoyId, latitude, longitude } = data;
    const roomName = `location_${deliveryBoyId}`;
    
    // Broadcast to all users tracking this delivery boy
    socket.to(roomName).emit('locationUpdated', {
      deliveryBoyId,
      latitude,
      longitude,
      timestamp: new Date()
    });
    
    console.log(`📍 Location updated for delivery boy ${deliveryBoyId}: ${latitude}, ${longitude}`);
  });

  // Handle socket disconnection
  socket.on('disconnect', (reason) => {
    console.log('🔴 A user disconnected:', socket.id, 'Reason:', reason);
  });

  // Error handling
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Start the server
const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO server is ready`);
  console.log(`📁 File upload limit: 50MB`);
});