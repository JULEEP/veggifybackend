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
const deliveryboyRoute = require('./routes/deliveryboyRoute'); // 👈 Isme already routes hain
const Admin = require('./routes/adminRoutes');
const vendorRoutes = require("./routes/vendorRoute");
const ambsdorRoutes = require("./routes/ambsdorRoutes");

// Controller imports
const userController = require('./controllers/userController');

dotenv.config();
const app = express();
const server = http.createServer(app);

// Socket.IO setup with proper CORS
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io available globally
global.io = io;

// Middleware setup
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: "/tmp/",
  createParentPath: true
}));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('MongoDB Error:', err));



  // CORS setup for specific origin
app.use(cors({
  origin: ['https://veegify-web.web.app', 'http://localhost:3000', 'https://panel.vegiffyy.com', 'https://vendor.vegiffyy.com'],  // Allow both URLs
  methods: ['GET', 'POST'],
  credentials: true
}));



// Define Routes
app.use('/api', addressRoutes);
app.use('/api', authRoutes);
app.use('/api', routes);
app.use('/api', restaurantProduc);
app.use('/api', categorieRestaurantProduct);
app.use('/api', cartController);
app.use('/api/delivery-boy', deliveryboyRoute); // 👈 Ye delivery boy routes include karta hai
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

// 👇 YE EXTRA LOCATION ROUTES ADD KARO
app.get("/api/location/:deliveryBoyId/:userId", (req, res) => {
  console.log('🎯 Get live location route hit');
  // DeliveryBoy controller ka method call karo
  const DeliveryBoy = require('./controllers/deliveryBoyController');
  DeliveryBoy.getLiveLocation(req, res);
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

  // 👇 YE LOCATION EVENTS ADD KARO
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
});