const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let playerCount = 0;

io.on('connection', (socket) => {
    playerCount++;
    io.emit('playerCount', playerCount);

    // 新玩家连接时发送空棋盘
    socket.emit('boardUpdate', Array(5).fill(null).map(() => Array(5).fill(null)));

    socket.on('syncBoard', (board) => {
        // 广播给所有玩家（包括自己）
        io.emit('boardUpdate', board);
    });

    socket.on('disconnect', () => {
        playerCount--;
        io.emit('playerCount', playerCount);
    });
});

http.listen(3000, () => {
    console.log('服务器已启动，端口 3000');
});

