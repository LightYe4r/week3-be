const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { pool, initDatabase } = require('./database');
const { authenticateToken, requireAdmin } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 회원가입
app.post('/api/signup', async (req, res) => {
    try {
        const { username, password, email } = req.body;

        // 유효성 검사
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        if (username.length < 3) {
            return res.status(400).json({ message: 'Username must be at least 3 characters' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        // 비밀번호 해시
        const hashedPassword = await bcrypt.hash(password, 10);

        // 사용자 생성
        const [result] = await pool.query(
            'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
            [username, hashedPassword, email || null]
        );

        res.status(201).json({ 
            message: 'User created successfully',
            userId: result.insertId 
        });

    } catch (error) {
        console.error('Signup error:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Username already exists' });
        }
        
        res.status(500).json({ message: 'Server error' });
    }
});

// 로그인
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 사용자 조회
        const [users] = await pool.query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const user = users[0];

        // 비밀번호 검증
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // 로그인 기록 저장
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        await pool.query(
            'INSERT INTO login_logs (user_id, username, ip_address, user_agent) VALUES (?, ?, ?, ?)',
            [user.id, user.username, ipAddress, userAgent]
        );

        // JWT 토큰 생성
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username,
                isAdmin: user.is_admin 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            username: user.username,
            isAdmin: user.is_admin
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 내 로그인 기록 조회 (일반 사용자)
app.get('/api/logs/me', authenticateToken, async (req, res) => {
    try {
        const [logs] = await pool.query(
            'SELECT * FROM login_logs WHERE user_id = ? ORDER BY login_time DESC LIMIT 50',
            [req.user.userId]
        );

        const [stats] = await pool.query(
            `SELECT 
                COUNT(*) as totalLogins,
                DATE_FORMAT(MAX(login_time), '%Y-%m-%d %H:%i') as lastLogin
             FROM login_logs 
             WHERE user_id = ?`,
            [req.user.userId]
        );

        res.json({
            stats: {
                totalLogins: stats[0].totalLogins,
                lastLogin: stats[0].lastLogin
            },
            logs
        });

    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 전체 로그인 기록 조회 (관리자)
app.get('/api/logs/all', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [logs] = await pool.query(
            'SELECT * FROM login_logs ORDER BY login_time DESC LIMIT 100'
        );

        const [userCount] = await pool.query(
            'SELECT COUNT(*) as totalUsers FROM users'
        );

        const [loginCount] = await pool.query(
            'SELECT COUNT(*) as totalLogins FROM login_logs'
        );

        const [todayCount] = await pool.query(
            'SELECT COUNT(*) as todayLogins FROM login_logs WHERE DATE(login_time) = CURDATE()'
        );

        res.json({
            stats: {
                totalUsers: userCount[0].totalUsers,
                totalLogins: loginCount[0].totalLogins,
                todayLogins: todayCount[0].todayLogins
            },
            logs
        });

    } catch (error) {
        console.error('Get all logs error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 서버 시작
async function startServer() {
    try {
        // 데이터베이스 초기화
        await initDatabase();
        
        app.listen(PORT, () => {
            console.log(`\n🚀 Server running on port ${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV}`);
            console.log(`🗄️  Database: ${process.env.DB_HOST}`);
            console.log(`\nDefault admin account:`);
            console.log(`  Username: admin`);
            console.log(`  Password: admin123\n`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
