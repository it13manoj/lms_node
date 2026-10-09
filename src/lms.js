const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const { connectDB } = require('./config/database');

// Import routes
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const policyRoutes = require('./routes/policyRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const salaryRoutes = require('./routes/salaryRoutes');
const meetingRoutes = require('./routes/meetingRoutes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io for real-time video conference rooms & WebRTC signaling
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Active in-memory meeting rooms map: meetingId -> Map(socketId -> participantData)
const meetingRooms = new Map();

io.on('connection', (socket) => {
    // When a user joins a meeting room
    socket.on('join-meeting', ({ meetingId, user }) => {
        if (!meetingId) return;
        socket.join(meetingId);

        if (!meetingRooms.has(meetingId)) {
            meetingRooms.set(meetingId, new Map());
        }

        const participant = {
            socketId: socket.id,
            userId: user?.id || socket.id,
            name: user?.name || 'Participant',
            role: user?.role || 'Guest',
            isMicOn: user?.isMicOn ?? true,
            isCameraOn: user?.isCameraOn ?? true,
            isScreenSharing: false,
            avatarBg: user?.avatarBg || '#3b82f6'
        };

        meetingRooms.get(meetingId).set(socket.id, participant);
        console.log(`[Socket.IO] User "${participant.name}" (${socket.id}) joined room "${meetingId}". Room count: ${meetingRooms.get(meetingId).size}`);

        // Notify other participants in the room that a new peer joined
        socket.to(meetingId).emit('user-joined', participant);

        // Send all currently connected peers in this room to the new user
        const allInRoom = Array.from(meetingRooms.get(meetingId).values());
        socket.emit('current-participants', allInRoom);
    });

    // WebRTC Signaling: relay offer / answer / ICE candidate directly to targeted peer
    socket.on('signal', ({ targetSocketId, signal }) => {
        if (targetSocketId) {
            io.to(targetSocketId).emit('signal', {
                fromSocketId: socket.id,
                signal
            });
        }
    });

    // User toggles mic or camera in real-time
    socket.on('media-toggle', ({ meetingId, isMicOn, isCameraOn }) => {
        if (meetingRooms.has(meetingId) && meetingRooms.get(meetingId).has(socket.id)) {
            const p = meetingRooms.get(meetingId).get(socket.id);
            if (isMicOn !== undefined) p.isMicOn = isMicOn;
            if (isCameraOn !== undefined) p.isCameraOn = isCameraOn;
            socket.to(meetingId).emit('user-media-updated', {
                socketId: socket.id,
                isMicOn: p.isMicOn,
                isCameraOn: p.isCameraOn
            });
        }
    });

    // User toggles screen sharing in real-time
    socket.on('screen-share-toggle', ({ meetingId, isSharing }) => {
        if (meetingRooms.has(meetingId) && meetingRooms.get(meetingId).has(socket.id)) {
            const p = meetingRooms.get(meetingId).get(socket.id);
            p.isScreenSharing = isSharing;
            socket.to(meetingId).emit('user-screen-share-updated', {
                socketId: socket.id,
                name: p.name,
                isSharing
            });
        }
    });

    // Real-time In-meeting chat broadcast
    socket.on('send-message', ({ meetingId, message }) => {
        socket.to(meetingId).emit('new-message', message);
    });

    // When user leaves room or disconnects
    const handleLeave = () => {
        meetingRooms.forEach((participantsMap, meetingId) => {
            if (participantsMap.has(socket.id)) {
                const leavingUser = participantsMap.get(socket.id);
                participantsMap.delete(socket.id);
                socket.to(meetingId).emit('user-left', {
                    socketId: socket.id,
                    name: leavingUser.name
                });
                if (participantsMap.size === 0) {
                    meetingRooms.delete(meetingId);
                }
            }
        });
    };

    socket.on('leave-meeting', handleLeave);
    socket.on('disconnect', handleLeave);
});

// REST endpoint for currently active participants in a meeting
app.get('/api/meetings/:meetingId/live-participants', (req, res) => {
    const { meetingId } = req.params;
    const participantsMap = meetingRooms.get(meetingId);
    const list = participantsMap ? Array.from(participantsMap.values()) : [];
    res.json({ success: true, data: list });
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/meetings', meetingRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Something went wrong!',
        error: err.message 
    });
});

// Connect to database and start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`✅ Server with Socket.IO running on port ${PORT}`);
    });
}).catch(err => {
    console.error('❌ Failed to start server:', err);
});

module.exports = { app, server, io };