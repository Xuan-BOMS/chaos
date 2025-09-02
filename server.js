const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let playerCount = 0;
let players = [];
let currentTurn = null;
let gameBoard = Array(5).fill(null).map(() => Array(5).fill(null));

io.on('connection', (socket) => {
    playerCount++;
    players.push(socket.id);
    io.emit('playerCount', playerCount);

    // 决定是否是第一个玩家
    const isFirstPlayer = players.length === 1;
    if (isFirstPlayer && players.length < 2) {
        currentTurn = null; // 重置当前回合，等待第二个玩家
    } else if (players.length === 2 && !currentTurn) {
        currentTurn = players[0]; // 当第二个玩家加入时，设置第一个玩家为当前回合
    }
    
    // 发送初始状态
    socket.emit('initPlayer', { isFirstPlayer });
    io.emit('turnUpdate', { // 使用 io.emit 而不是 socket.emit，确保所有玩家状态同步
        board: gameBoard,
        currentTurn: currentTurn
    });

    socket.on('endTurn', (board) => {
        if (socket.id === currentTurn) {
            gameBoard = board;
            // 找到下一个玩家
            const currentIndex = players.indexOf(socket.id);
            const nextIndex = (currentIndex + 1) % players.length;
            currentTurn = players[nextIndex];
            
            // 广播新状态给所有玩家
            io.emit('turnUpdate', {
                board: gameBoard,
                currentTurn: currentTurn
            });
        }
    });

    // 检查并更新回合状态
    socket.on('checkTurn', () => {
        if (players.length === 2 && !currentTurn) {
            currentTurn = players[0]; // 设置第一个玩家为当前回合
            io.emit('turnUpdate', {
                board: gameBoard,
                currentTurn: currentTurn
            });
        }
    });

    // 处理游戏重置
    socket.on('resetGame', () => {
        gameBoard = Array(5).fill(null).map(() => Array(5).fill(null));
        currentTurn = players[0];  // 重置为第一个玩家的回合
        io.emit('gameReset');
        io.emit('turnUpdate', {
            board: gameBoard,
            currentTurn: currentTurn
        });
    });

    socket.on('disconnect', () => {
        playerCount--;
        players = players.filter(id => id !== socket.id);
        if (currentTurn === socket.id && players.length > 0) {
            currentTurn = players[0];
        }
        io.emit('playerCount', playerCount);
        if (players.length > 0) {
            io.emit('turnUpdate', {
                board: gameBoard,
                currentTurn: currentTurn
            });
        }
    });
});

http.listen(3000, () => {
    console.log('服务器已启动，端口 3000');
});

