// 建立 Socket.io 连接
const socket = io();

// 游戏状态
let currentRoom = null;
let playerCount = 0;
let isMyTurn = false;
let isFlipping = false;
let board = null;
let hoveredCell = null;
let selectedCell = null;

// 游戏配置
const GRID_SIZE = 5;
const CELL_PADDING = 0.15;

// 颜色配置
const COLORS = {
    white: '#FFFFFF',
    green: '#32CD32',
    red: '#FF6347',
    blue: '#1E90FF',
    yellow: '#FFD700',
    darkgreen: '#006400',
    darkred: '#8B0000',
    darkblue: '#00008B',
    darkyellow: '#8B4513',
    greenred: '#CD5C5C',
    greenblue: '#4682B4',
    greenyellow: '#9ACD32',
    redblue: '#800080',
    redyellow: '#D04E00',
    blueyellow: '#ADFF2F',
    purple: '#8A2BE2',
    black: '#000000'
};

const COLOR_NAMES = {
    white: '白色',
    green: '风（绿色）',
    red: '火（红色）',
    blue: '水（蓝色）',
    yellow: '土（黄色）',
    darkgreen: '强化风（深绿色）',
    darkred: '强化火（深红色）',
    darkblue: '强化水（深蓝色）',
    darkyellow: '强化土（深黄色）',
    greenred: '风+火',
    greenblue: '风+水',
    greenyellow: '风+土',
    redblue: '火+水',
    redyellow: '火+土',
    blueyellow: '水+土',
    purple: '以太',
    black: '混沌'
};

// 初始化界面元素
let canvas, ctx;
let matchingScreen, gameScreen, matchingStatus;
let modal, overlay, pieceGrid;

function initElements() {
    // 获取主要界面元素
    canvas = document.getElementById('gameBoard');
    ctx = canvas.getContext('2d');
    matchingScreen = document.getElementById('matchingScreen');
    gameScreen = document.getElementById('gameScreen');
    matchingStatus = document.getElementById('matchingStatus');
    modal = document.querySelector('.piece-selector-modal');
    overlay = document.querySelector('.modal-overlay');
    pieceGrid = document.querySelector('.piece-grid');

    // 初始化棋盘
    board = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));

    // 初始化棋子选择器
    initPieceSelector();
    
    // 初始化按钮事件
    setupButtons();
    
    // 初始化画布事件
    setupCanvasEvents();
    
    // 显示主界面
    showMatchingScreen();
}

// 设置所有按钮的事件监听器
function setupButtons() {
    // 主界面按钮
    const randomMatchBtn = document.getElementById('randomMatchBtn');
    const createRoomBtn = document.getElementById('createRoomBtn');
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    const roomActionBtn = document.getElementById('roomActionBtn');
    const backToMatchingBtn = document.getElementById('backToMatchingBtn');
    const coin = document.querySelector('.coin');

    // 游戏界面按钮
    const endTurnBtn = document.getElementById('endTurnBtn');
    const resetGameBtn = document.getElementById('resetGameBtn');
    const leaveGameBtn = document.getElementById('leaveGameBtn');

    // 随机匹配按钮事件
    if (randomMatchBtn) {
        randomMatchBtn.addEventListener('click', () => {
            matchingStatus.textContent = '正在寻找对手...';
            socket.emit('randomMatch');
            hideRoomInput();
        });
    }

    // 创建房间按钮事件
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', () => {
            showRoomInput('create');
        });
    }

    // 加入房间按钮事件
    if (joinRoomBtn) {
        joinRoomBtn.addEventListener('click', () => {
            showRoomInput('join');
        });
    }

    // 返回按钮事件
    if (backToMatchingBtn) {
        backToMatchingBtn.addEventListener('click', hideRoomInput);
    }

    // 硬币翻转事件
    if (coin) {
        coin.addEventListener('click', flipCoin);
    }

    // 结束回合按钮事件
    if (endTurnBtn) {
        endTurnBtn.addEventListener('click', () => {
            if (isMyTurn) {
                socket.emit('endTurn', board);
                isMyTurn = false;
                updateTurnButton();
            }
        });
    }

    // 重置游戏按钮事件
    if (resetGameBtn) {
        resetGameBtn.addEventListener('click', () => {
            if (confirm('确定要重置游戏吗？')) {
                socket.emit('resetGame');
                showMatchingScreen();
            }
        });
    }

    // 离开游戏按钮事件
    if (leaveGameBtn) {
        leaveGameBtn.addEventListener('click', () => {
            if (confirm('确定要离开房间吗？')) {
                socket.emit('leaveRoom');
                showMatchingScreen();
            }
        });
    }

    // 房间操作按钮事件
    if (roomActionBtn) {
        roomActionBtn.addEventListener('click', () => {
            const roomId = document.getElementById('roomIdInput').value.trim();
            if (!roomId) {
                alert('请输入房间号');
                return;
            }
            
            const action = roomActionBtn.dataset.action;
            if (action === 'create') {
                socket.emit('createRoom', roomId);
            } else {
                socket.emit('joinRoom', roomId);
            }
        });
    }
}

// 设置画布事件
function setupCanvasEvents() {
    if (!canvas) return;

    canvas.addEventListener('mousemove', (event) => {
        if (!isMyTurn) return;
        
        const pos = getBoardPosition(event);
        if (pos.row >= 0 && pos.row < GRID_SIZE && pos.col >= 0 && pos.col < GRID_SIZE) {
            hoveredCell = pos;
            drawBoard();
        }
    });

    canvas.addEventListener('mouseleave', () => {
        hoveredCell = null;
        drawBoard();
    });

    canvas.addEventListener('click', (event) => {
        if (!isMyTurn) return;
        
        const pos = getBoardPosition(event);
        if (pos.row >= 0 && pos.row < GRID_SIZE && pos.col >= 0 && pos.col < GRID_SIZE) {
            selectedCell = pos;
            showModal();
        }
    });

    // 窗口大小改变时重新调整画布
    window.addEventListener('resize', resizeCanvas);
}

// 获取鼠标在棋盘上的位置
function getBoardPosition(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    const cellSize = canvas.width / GRID_SIZE;
    
    return {
        row: Math.floor(y / cellSize),
        col: Math.floor(x / cellSize),
        cellSize: cellSize
    };
}

// 初始化棋子选择器
function initPieceSelector() {
    if (!pieceGrid) return;

    // 清空现有选项
    pieceGrid.innerHTML = '';
    
    // 创建棋子选项
    Object.entries(COLORS).forEach(([color, value]) => {
        const container = document.createElement('div');
        container.className = 'piece-container';

        const option = document.createElement('div');
        option.className = 'piece-option';
        option.style.backgroundColor = value;
        option.setAttribute('data-color', color);

        const label = document.createElement('div');
        label.className = 'piece-label';
        label.textContent = COLOR_NAMES[color];

        container.appendChild(option);
        container.appendChild(label);
        pieceGrid.appendChild(container);

        option.addEventListener('click', () => {
            placePiece(color);
            closeModal();
        });
    });

    // 设置移除棋子按钮事件
    const removeBtn = modal.querySelector('.remove-piece');
    if (removeBtn) {
        removeBtn.onclick = () => {
            removePiece();
            closeModal();
        };
    }

    // 设置取消按钮事件
    const cancelBtn = modal.querySelector('.cancel-selection');
    if (cancelBtn) {
        cancelBtn.onclick = closeModal;
    }
}

// 显示/隐藏房间输入界面
function showRoomInput(action) {
    const roomInput = document.getElementById('roomInput');
    const roomActionBtn = document.getElementById('roomActionBtn');
    const roomIdInput = document.getElementById('roomIdInput');

    if (roomInput && roomActionBtn && roomIdInput) {
        roomInput.style.display = 'flex';
        roomActionBtn.textContent = action === 'create' ? '创建房间' : '加入房间';
        roomActionBtn.dataset.action = action;
        roomIdInput.value = '';
        roomIdInput.placeholder = action === 'create' ? '请输入要创建的房间号' : '请输入要加入的房间号';
    }
}

function hideRoomInput() {
    const roomInput = document.getElementById('roomInput');
    if (roomInput) {
        roomInput.style.display = 'none';
    }
}

// 显示主界面
function showMatchingScreen() {
    if (!matchingScreen || !gameScreen) return;
    
    matchingScreen.style.display = 'block';
    gameScreen.style.display = 'none';
    currentRoom = null;
    playerCount = 1;
    board = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    matchingStatus.textContent = '';
    hideRoomInput();
}

// 显示游戏界面
function showGameScreen() {
    if (!matchingScreen || !gameScreen) return;
    
    matchingScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    setTimeout(resizeCanvas, 0);
}

// 棋子选择器相关函数
function showModal() {
    if (!modal || !overlay) return;
    modal.style.display = 'block';
    overlay.style.display = 'block';
}

function closeModal() {
    if (!modal || !overlay) return;
    modal.style.display = 'none';
    overlay.style.display = 'none';
    selectedCell = null;
}

// 放置棋子
function placePiece(color) {
    if (!selectedCell || !board) return;

    const piece = { color, scale: 0 };
    board[selectedCell.row][selectedCell.col] = piece;
    socket.emit('placePiece', {
        row: selectedCell.row,
        col: selectedCell.col,
        color: color
    });

    function animate() {
        if (piece.scale >= 1) {
            piece.scale = 1;
            drawBoard();
            return;
        }
        piece.scale += 0.1;
        drawBoard();
        requestAnimationFrame(animate);
    }
    animate();
}

// 移除棋子
function removePiece() {
    if (!selectedCell || !board) return;

    board[selectedCell.row][selectedCell.col] = null;
    socket.emit('placePiece', {
        row: selectedCell.row,
        col: selectedCell.col,
        color: null
    });
    drawBoard();
}

// 调整画布大小
function resizeCanvas() {
    if (!canvas || !canvas.parentElement) return;

    const containerWidth = canvas.parentElement.clientWidth;
    const size = Math.min(containerWidth - 40, 600);
    
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.width = size * window.devicePixelRatio;
    canvas.height = size * window.devicePixelRatio;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    requestAnimationFrame(drawBoard);
}

// 硬币翻转功能
function flipCoin() {
    if (isFlipping) return;
    
    const coin = document.querySelector('.coin');
    if (!coin) return;

    isFlipping = true;
    coin.classList.add('flipping');
    
    setTimeout(() => {
        const isHeads = Math.random() < 0.5;
        coin.style.transform = `rotateY(${isHeads ? '0' : '180'}deg)`;
        isFlipping = false;
        coin.classList.remove('flipping');
    }, 600);
}

// 更新玩家数量显示
function updatePlayerCount() {
    const playerCountDiv = document.querySelector('.player-count') || document.createElement('div');
    if (!playerCountDiv.classList.contains('player-count')) {
        playerCountDiv.classList.add('player-count');
        const container = document.querySelector('.game-controls');
        if (container) {
            container.appendChild(playerCountDiv);
        }
    }
    playerCountDiv.textContent = `在线玩家: ${playerCount}`;
}

// 更新回合按钮状态
function updateTurnButton() {
    const endTurnBtn = document.getElementById('endTurnBtn');
    if (!endTurnBtn) return;

    if (playerCount >= 2) {
        if (isMyTurn) {
            endTurnBtn.textContent = '回合结束';
            endTurnBtn.disabled = false;
            endTurnBtn.classList.remove('disabled');
        } else {
            endTurnBtn.textContent = '对方回合';
            endTurnBtn.disabled = true;
            endTurnBtn.classList.add('disabled');
        }
    } else {
        endTurnBtn.textContent = '等待其他玩家...';
        endTurnBtn.disabled = true;
        endTurnBtn.classList.add('disabled');
    }
}

// 绘制棋盘
function drawBoard() {
    if (!canvas || !ctx || !board) return;

    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;
    const cellSize = width / GRID_SIZE;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 绘制棋盘背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 绘制格子
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const x = col * cellSize;
            const y = row * cellSize;

            // 绘制格子背景
            ctx.fillStyle = (row + col) % 2 === 0 ? '#f8fafc' : '#f1f5f9';
            ctx.fillRect(x, y, cellSize, cellSize);

            // 绘制格子边框
            ctx.strokeStyle = 'rgba(124, 58, 237, 0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, cellSize, cellSize);

            // 绘制悬停效果
            if (isMyTurn && hoveredCell && hoveredCell.row === row && hoveredCell.col === col) {
                ctx.fillStyle = 'rgba(124, 58, 237, 0.15)';
                ctx.fillRect(x, y, cellSize, cellSize);
            }

            // 绘制棋子
            if (board[row][col]) {
                const piece = board[row][col];
                const padding = cellSize * CELL_PADDING;
                const pieceSize = cellSize - (padding * 2);
                const scale = piece.scale || 1;
                
                // 绘制棋子阴影
                ctx.beginPath();
                ctx.arc(
                    x + cellSize/2 + 2,
                    y + cellSize/2 + 2,
                    (pieceSize/2) * scale * 0.9,
                    0,
                    Math.PI * 2
                );
                ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
                ctx.fill();

                // 绘制棋子本体
                ctx.beginPath();
                ctx.arc(
                    x + cellSize/2,
                    y + cellSize/2,
                    (pieceSize/2) * scale * 0.9,
                    0,
                    Math.PI * 2
                );

                // 创建渐变效果
                const color = COLORS[piece.color];
                if (color) {
                    const gradient = ctx.createRadialGradient(
                        x + cellSize/2 - pieceSize/4,
                        y + cellSize/2 - pieceSize/4,
                        0,
                        x + cellSize/2,
                        y + cellSize/2,
                        pieceSize/2
                    );
                    gradient.addColorStop(0, color);
                    gradient.addColorStop(1, adjustColor(color, -20));
                    ctx.fillStyle = gradient;
                    ctx.fill();

                    // 绘制边框
                    ctx.strokeStyle = adjustColor(color, -40);
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    // 添加高光效果
                    const highlightGradient = ctx.createRadialGradient(
                        x + cellSize/2 - pieceSize/3,
                        y + cellSize/2 - pieceSize/3,
                        0,
                        x + cellSize/2,
                        y + cellSize/2,
                        pieceSize/2
                    );
                    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
                    highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
                    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    ctx.fillStyle = highlightGradient;
                    ctx.fill();
                }
            }
        }
    }
}

// 辅助函数：调整颜色明暗度
function adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

// Socket.io 事件处理
socket.on('matchingStatus', (status) => {
    if (matchingStatus) {
        matchingStatus.textContent = status;
    }
});

socket.on('roomError', (error) => {
    alert(error);
});

socket.on('roomCreated', (roomId) => {
    currentRoom = roomId;
    playerCount = 1;
    if (matchingStatus) {
        matchingStatus.textContent = '等待其他玩家加入...';
    }
    hideRoomInput();
});

socket.on('matchSuccess', ({ roomId, isFirstPlayer }) => {
    currentRoom = roomId;
    isMyTurn = isFirstPlayer;
    playerCount = 2;
    showGameScreen();
    updateTurnButton();
});

socket.on('gameStart', ({ board: newBoard, currentTurn }) => {
    board = JSON.parse(JSON.stringify(newBoard));
    isMyTurn = (currentTurn === socket.id);
    playerCount = 2;
    showGameScreen();
    setTimeout(() => {
        resizeCanvas();
        updateTurnButton();
    }, 100);
});

socket.on('updateGame', ({ board: newBoard, currentTurn }) => {
    board = JSON.parse(JSON.stringify(newBoard));
    isMyTurn = (currentTurn === socket.id);
    updateTurnButton();
    drawBoard();
});

socket.on('playerLeft', () => {
    alert('对方已离开游戏');
    playerCount = 1;
    showMatchingScreen();
});

socket.on('gameReset', () => {
    showMatchingScreen();
    alert('游戏已被重置');
});

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，开始初始化...');
    try {
        initElements();
        console.log('初始化完成');
    } catch (error) {
        console.error('初始化出错:', error);
    }
});
