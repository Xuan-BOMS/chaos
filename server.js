const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// 提供静态文件服务
app.use(express.static('public'));

// 处理 socket.io 连接
io.on('connection', (socket) => {
    console.log('用户已连接');

    socket.on('disconnect', () => {
        console.log('用户已断开连接');
    });

    // 这里添加游戏相关的 socket 事件处理
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
