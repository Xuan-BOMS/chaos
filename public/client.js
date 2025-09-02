// 建立 Socket.io 连接
const socket = io();

// 游戏配置
const GRID_SIZE = 5;
const CELL_PADDING = 0.1; // 格子内边距比例
let board = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
let hoveredCell = null;
let isFlipping = false; // 硬币是否正在翻转
let playerCount = 0; // 当前在线玩家数量

// 处理棋盘更新
socket.on('boardUpdate', (newBoard) => {
    board = JSON.parse(JSON.stringify(newBoard));
    drawBoard();
});

// 处理玩家数量更新
socket.on('playerCount', (count) => {
    playerCount = count;
    updatePlayerCount();
});

// 等待 DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    const endTurnBtn = document.getElementById('endTurnBtn');
    if (endTurnBtn) {
        endTurnBtn.addEventListener('click', () => {
            console.log('发送当前棋盘状态');
            // 发送当前棋盘状态给服务器
            socket.emit('syncBoard', board);
        });
    }
});

// 监听棋子放置事件来启用回合结束按钮
function enableTurnEnd() {
    const endTurnBtn = document.getElementById('endTurnBtn');
    if (endTurnBtn) {
        isMyTurn = true;
        endTurnBtn.classList.remove('disabled');
        endTurnBtn.textContent = '回合结束';
    }
}

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

// 获取DOM元素
const canvas = document.getElementById('gameBoard');
const ctx = canvas.getContext('2d');
const modal = document.querySelector('.piece-selector-modal');
const overlay = document.querySelector('.modal-overlay');
const pieceGrid = document.querySelector('.piece-grid');
let selectedCell = null;

// 初始化棋子选择器
function initPieceSelector() {
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
    document.querySelector('.remove-piece').addEventListener('click', () => {
        if (selectedCell) {
            removePiece();
        }
        closeModal();
    });

    // 设置取消按钮事件
    document.querySelector('.cancel-selection').addEventListener('click', closeModal);
}

// 调整画布大小
function resizeCanvas() {
    const containerWidth = canvas.parentElement.clientWidth;
    const size = Math.min(containerWidth - 40, 600);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.width = size * window.devicePixelRatio;
    canvas.height = size * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    drawBoard();
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

// 显示选择器模态框
function showModal() {
    modal.style.display = 'block';
    overlay.style.display = 'block';
}

// 关闭选择器模态框
function closeModal() {
    modal.style.display = 'none';
    overlay.style.display = 'none';
    selectedCell = null;
}

// 硬币翻转功能
function flipCoin() {
    if (isFlipping) return;
    
    const coin = document.querySelector('.coin');
    isFlipping = true;
    coin.classList.add('flipping');
    
    setTimeout(() => {
        const isHeads = Math.random() < 0.5;
        coin.style.transform = `rotateY(${isHeads ? '0' : '180'}deg)`;
        isFlipping = false;
        coin.classList.remove('flipping');
    }, 600);
}

// 绘制棋盘
function drawBoard() {
    console.log('绘制棋盘，当前状态:', JSON.stringify(board));
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

            // 绘制格子边框
            ctx.strokeStyle = 'rgba(124, 58, 237, 0.3)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, cellSize, cellSize);

            // 如果是悬停的格子，绘制高亮效果
            if (hoveredCell && hoveredCell.row === row && hoveredCell.col === col) {
                ctx.fillStyle = 'rgba(124, 58, 237, 0.1)';
                ctx.fillRect(x, y, cellSize, cellSize);
            }

            // 绘制棋子
            if (board[row][col]) {
                const piece = board[row][col];
                const padding = cellSize * CELL_PADDING;
                const pieceSize = cellSize - (padding * 2);
                
                // 绘制棋子阴影
                ctx.beginPath();
                ctx.arc(
                    x + cellSize/2 + 2,
                    y + cellSize/2 + 2,
                    pieceSize/2,
                    0,
                    Math.PI * 2
                );
                ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                ctx.fill();

                // 绘制棋子本体
                ctx.beginPath();
                ctx.arc(
                    x + cellSize/2,
                    y + cellSize/2,
                    pieceSize/2,
                    0,
                    Math.PI * 2
                );
                ctx.fillStyle = COLORS[piece.color];
                ctx.fill();
                
                // 绘制棋子边框和光晕效果
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // 添加内部渐变效果
                const gradient = ctx.createRadialGradient(
                    x + cellSize/2 - pieceSize/4,
                    y + cellSize/2 - pieceSize/4,
                    0,
                    x + cellSize/2,
                    y + cellSize/2,
                    pieceSize/2
                );
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = gradient;
                ctx.fill();
            }
        }
    }
}

// 放置棋子
function placePiece(color) {
    if (selectedCell) {
        const piece = { color, scale: 0 };
        board[selectedCell.row][selectedCell.col] = piece;

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
        closeModal();
    }
}

// 移除棋子
function removePiece() {
    if (selectedCell) {
        board[selectedCell.row][selectedCell.col] = null;
        drawBoard();
        closeModal();
    }
}

// 更新玩家数量显示
function updatePlayerCount() {
    const playerCountDiv = document.querySelector('.player-count') || document.createElement('div');
    if (!playerCountDiv.classList.contains('player-count')) {
        playerCountDiv.classList.add('player-count');
        const container = document.querySelector('.game-controls');
        container.appendChild(playerCountDiv);
    }
    playerCountDiv.textContent = `在线玩家: ${playerCount}`;
}

// 事件监听器
canvas.addEventListener('mousemove', (event) => {
    const pos = getBoardPosition(event);
    if (pos.row >= 0 && pos.row < GRID_SIZE && pos.col >= 0 && pos.col < GRID_SIZE) {
        hoveredCell = pos;
    } else {
        hoveredCell = null;
    }
    drawBoard();
});

canvas.addEventListener('click', (event) => {
    const pos = getBoardPosition(event);
    if (pos.row >= 0 && pos.row < GRID_SIZE && pos.col >= 0 && pos.col < GRID_SIZE) {
        selectedCell = pos;
        showModal();
    }
});

// 添加硬币点击事件
document.querySelector('.coin').addEventListener('click', flipCoin);

// 初始化游戏
function initGame() {
    resizeCanvas();
    initPieceSelector();
    window.addEventListener('resize', resizeCanvas);
}

// 启动游戏
initGame();
