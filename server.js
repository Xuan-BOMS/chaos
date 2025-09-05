const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// 游戏房间系统
const rooms = new Map(); // 储存所有房间信息
const matchingPlayers = new Set(); // 等待随机匹配的玩家

// 获取玩家所在的房间ID
function getPlayerRoom(socket) {
    const roomIds = Array.from(socket.rooms);
    return roomIds.find(id => id !== socket.id); // 排除socket自身的room
}

// 获取房间信息
function getRoomInfo(roomId) {
    return rooms.get(roomId);
}

io.on('connection', (socket) => {
    console.log('新玩家连接:', socket.id);

    // 处理随机匹配
    socket.on('randomMatch', () => {
        matchingPlayers.add(socket.id);
        socket.emit('matchingStatus', '等待匹配中...');
        
        if (matchingPlayers.size >= 2) {
            // 取出两个玩家进行匹配
            const players = Array.from(matchingPlayers).slice(0, 2);
            const roomId = `random_${Date.now()}`;
            
            // 创建新房间
            rooms.set(roomId, {
                players: players,
                currentTurn: players[0],
                board: Array(5).fill(null).map(() => Array(5).fill(null))
            });
            
            // 将两个玩家加入房间
            players.forEach((playerId, index) => {
                const playerSocket = io.sockets.sockets.get(playerId);
                if (playerSocket) {
                    playerSocket.join(roomId);
                    playerSocket.emit('matchSuccess', { roomId, isFirstPlayer: index === 0 });
                    matchingPlayers.delete(playerId);
                }
            });
        }
    });

    // 处理创建房间
    socket.on('createRoom', (roomId) => {
        if (rooms.has(roomId)) {
            socket.emit('roomError', '房间已存在，请换一个房间号');
            return;
        }
        
        rooms.set(roomId, {
            players: [socket.id],
            currentTurn: null,
            board: Array(5).fill(null).map(() => Array(5).fill(null))
        });
        
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        socket.emit('matchingStatus', '等待其他玩家加入...');
    });

    // 处理加入房间
    socket.on('joinRoom', (roomId) => {
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('roomError', '房间不存在');
            return;
        }
        
        if (room.players.length >= 2) {
            socket.emit('roomError', '房间已满');
            return;
        }
        
        room.players.push(socket.id);
        room.currentTurn = room.players[0];
        socket.join(roomId);
        
        // 通知房间内所有玩家游戏开始
        io.to(roomId).emit('gameStart', {
            board: room.board,
            currentTurn: room.currentTurn,
            playerCount: room.players.length // 添加玩家数量信息
        });
        
        // 分别通知两个玩家他们的角色
        io.to(room.players[0]).emit('initPlayer', { isFirstPlayer: true });
        io.to(room.players[1]).emit('initPlayer', { isFirstPlayer: false });
    });

    socket.on('endTurn', (boardData) => {
        const roomId = getPlayerRoom(socket);
        if (!roomId) return;
        
        const room = getRoomInfo(roomId);
        if (!room) return;
        
        if (socket.id === room.currentTurn) {
            try {
                // 解析接收到的棋盘数据
                const newBoard = typeof boardData === 'string' ? JSON.parse(boardData) : boardData;
                room.board = newBoard; // 更新房间的棋盘状态
                
                // 找到下一个玩家
                const currentIndex = room.players.indexOf(socket.id);
                const nextIndex = (currentIndex + 1) % room.players.length;
                room.currentTurn = room.players[nextIndex];
                
                // 广播更新后的游戏状态给房间内所有玩家
                io.to(roomId).emit('updateGame', {
                    board: room.board,
                    currentTurn: room.currentTurn,
                    playerCount: room.players.length
                });
            } catch (error) {
                console.error('处理回合结束时出错:', error);
            }
        }
    });

    // 检查并更新回合状态
    socket.on('checkTurn', () => {
        const roomId = getPlayerRoom(socket);
        if (!roomId) return;
        
        const room = getRoomInfo(roomId);
        if (!room) return;
        
        if (room.players.length === 2 && !room.currentTurn) {
            room.currentTurn = room.players[0]; // 设置第一个玩家为当前回合
            io.to(roomId).emit('updateGame', {
                board: room.board,
                currentTurn: room.currentTurn,
                playerCount: room.players.length
            });
        }
    });

    // 处理游戏重置
    socket.on('resetGame', () => {
        const roomId = getPlayerRoom(socket);
        if (!roomId) return;
        
        const room = getRoomInfo(roomId);
        if (!room) return;

        room.board = Array(5).fill(null).map(() => Array(5).fill(null));
        room.currentTurn = room.players[0];  // 重置为第一个玩家的回合
        
        io.to(roomId).emit('gameReset');
        io.to(roomId).emit('updateGame', {
            board: room.board,
            currentTurn: room.currentTurn,
            playerCount: room.players.length
        });
    });

    // 处理落子（现在仅在回合结束时更新）
    socket.on('placePiece', ({ row, col, color }) => {
        const roomId = getPlayerRoom(socket);
        if (!roomId) return;
        
        const room = getRoomInfo(roomId);
        if (!room || socket.id !== room.currentTurn) return;
    });

    // 处理玩家离开房间
    socket.on('leaveRoom', () => {
        const roomId = getPlayerRoom(socket);
        if (!roomId) return;

        const room = getRoomInfo(roomId);
        if (!room) return;

        // 从房间中移除玩家
        room.players = room.players.filter(id => id !== socket.id);
        socket.leave(roomId);

        // 如果房间空了，删除房间
        if (room.players.length === 0) {
            rooms.delete(roomId);
        } else {
            // 重置房间状态
            room.board = Array(5).fill(null).map(() => Array(5).fill(null));
            room.currentTurn = room.players[0];
            
            // 通知房间内其他玩家
            io.to(roomId).emit('playerLeft');
            
            // 向剩余玩家发送重置后的游戏状态
            io.to(roomId).emit('updateGame', {
                board: room.board,
                currentTurn: room.currentTurn,
                playerCount: room.players.length
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('玩家断开连接:', socket.id);
        
        // 从匹配队列中移除
        matchingPlayers.delete(socket.id);
        
        // 获取玩家的所有房间
        const playerRooms = Array.from(socket.rooms);
        
        // 处理玩家所在的游戏房间
        for (const roomId of playerRooms) {
            // 跳过socket自己的room
            if (roomId === socket.id) continue;
            
            const room = getRoomInfo(roomId);
            if (room) {
                // 从房间中移除玩家
                room.players = room.players.filter(id => id !== socket.id);
                
                if (room.players.length === 0) {
                    // 如果房间空了，删除房间
                    rooms.delete(roomId);
                } else {
                    // 重置房间状态
                    room.board = Array(5).fill(null).map(() => Array(5).fill(null));
                    room.currentTurn = room.players[0];
                    
                    // 通知房间内其他玩家
                    io.to(roomId).emit('playerLeft');
                    
                    // 发送重置后的游戏状态
                    io.to(roomId).emit('updateGame', {
                        board: room.board,
                        currentTurn: room.currentTurn,
                        playerCount: room.players.length
                    });
                }
            }
        }
        
        // 如果玩家正在等待匹配，从等待列表中移除
        if (matchingPlayers.has(socket.id)) {
            matchingPlayers.delete(socket.id);
        }
        
        // 查找玩家所在的房间
        const roomId = getPlayerRoom(socket);
        if (roomId) {
            const room = getRoomInfo(roomId);
            if (room) {
                // 从房间中移除玩家
                room.players = room.players.filter(id => id !== socket.id);
                
                // 如果房间空了，删除房间
                if (room.players.length === 0) {
                    rooms.delete(roomId);
                } else {
                    // 如果是当前玩家的回合，转移到房间中的下一个玩家
                    if (room.currentTurn === socket.id) {
                        room.currentTurn = room.players[0];
                    }
                    // 通知房间内其他玩家
                    io.to(roomId).emit('playerLeft');
                }
            }
        }
    });
});

http.listen(3000, () => {
    console.log('服务器已启动，端口 3000');
});

