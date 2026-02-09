const initialLayout = [
    [0, 0, 0, 3, 3, 3, 0, 0, 0],
    [0, 0, 0, 0, 3, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [3, 0, 0, 0, 1, 0, 0, 0, 3],
    [3, 3, 1, 1, 2, 1, 1, 3, 3],
    [3, 0, 0, 0, 1, 0, 0, 0, 3],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 3, 0, 0, 0, 0],
    [0, 0, 0, 3, 3, 3, 0, 0, 0]
];

let board = [];
let turn = 'black'; 
let selected = null;
let gameOver = false;
let historyHash = {}; 
let gameHistoryList = []; // Array per salvare la storia completa
let moveLog = []; // Log testuale per la tabella

let mode = 'local';
let socket;
let myColor = null;
let gameId = null;
let timers = { white: 0, black: 0 };
let timerInterval = null;
let badConnCount = 0;
let movesCount = 0; 
let undosLeft = 3;  
let storedParams = {}; 
let currentHistoryIndex = 0; // Per la navigazione visiva

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    mode = params.get('mode') || 'local';
    storedParams = { name: params.get('name'), time: params.get('time') };

    if (mode === 'online') {
        initOnline(storedParams.name, storedParams.time);
    } else {
        startGame();
    }
    
    // Bottoni Navigazione Storia
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    if(btnPrev) btnPrev.addEventListener('click', () => navigateHistory(-1));
    if(btnNext) btnNext.addEventListener('click', () => navigateHistory(1));

    // Tastiera Frecce
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') navigateHistory(-1);
        if (e.key === 'ArrowRight') navigateHistory(1);
    });

    const playAgainBtn = document.getElementById('play-again-same-settings');
    if(playAgainBtn) {
        playAgainBtn.onclick = () => {
            window.location.href = `game.html?mode=online&name=${encodeURIComponent(storedParams.name)}&time=${storedParams.time}`;
        };
    }
});

function startGame() {
    board = JSON.parse(JSON.stringify(initialLayout));
    turn = 'black';
    gameOver = false;
    selected = null;
    historyHash = {};
    gameHistoryList = [JSON.stringify(board)];
    moveLog = [];
    movesCount = 0;
    undosLeft = 3;
    currentHistoryIndex = 0;
    
    drawBoard();
    updateUI();
    updateButtonsUI();
    updateMoveTable();
    updateNavUI();
}

// Disegna la scacchiera in base all'indice corrente della storia
function drawBoard() {
    const el = document.getElementById('board');
    el.innerHTML = '';
    
    // Recupera lo stato da disegnare (se stiamo guardando il passato)
    let stateToDraw = board;
    if (gameHistoryList.length > 0) {
        stateToDraw = JSON.parse(gameHistoryList[currentHistoryIndex]);
    }
    
    // Possiamo muovere solo se stiamo guardando l'ultima mossa (il presente)
    const isLive = (currentHistoryIndex === gameHistoryList.length - 1);

    let moves = [];
    if (isLive && selected && !gameOver) moves = getMoves(selected.r, selected.c);

    for(let r=0; r<9; r++) {
        for(let c=0; c<9; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            if(r===4 && c===4) cell.classList.add('throne');
            if((r===0||r===8) && (c===0||c===8)) cell.classList.add('escape');
            
            // --- AGGIUNTA COORDINATE ---
            // Lettere (a-i) sull'ultima riga
            if (r === 8) {
                const letterSpan = document.createElement('span');
                letterSpan.className = 'coord coord-letter';
                letterSpan.innerText = String.fromCharCode(97 + c); // 97 = 'a'
                cell.appendChild(letterSpan);
            }
            // Numeri (1-9) sulla prima colonna
            if (c === 0) {
                const numSpan = document.createElement('span');
                numSpan.className = 'coord coord-num';
                // Tablut notation: 1 è in basso, 9 è in alto
                numSpan.innerText = 9 - r; 
                cell.appendChild(numSpan);
            }
            // ---------------------------

            if (isLive) {
                cell.onclick = () => handleClick(r, c);
            } else {
                cell.style.cursor = 'default'; // Cursore normale se stiamo guardando il passato
            }

            if(isLive && selected && selected.r === r && selected.c === c) cell.classList.add('selected');
            if(isLive && moves.some(m => m.r===r && m.c===c)) {
                const h = document.createElement('div'); h.className='hint';
                cell.appendChild(h);
            }

            const val = stateToDraw[r][c];
            if(val !== 0) {
                const p = document.createElement('div');
                p.className = 'piece ' + (val===3 ? 'black-piece' : 'white-piece');
                if(val===2) p.classList.add('king');
                cell.appendChild(p);
            }
            el.appendChild(cell);
        }
    }
}

function handleClick(r, c) {
    if (gameOver) return;
    if (mode === 'online' && turn !== myColor) return; 

    const val = board[r][c];
    
    if (isMyPiece(val)) {
        selected = {r, c};
        drawBoard();
        return;
    }

    if (selected && val === 0) {
        const moves = getMoves(selected.r, selected.c);
        if (moves.some(m => m.r === r && m.c === c)) {
            makeMove(selected.r, selected.c, r, c);
        }
    }
}

function isMyPiece(val) {
    if (turn === 'white') return val === 1 || val === 2;
    if (turn === 'black') return val === 3;
    return false;
}

function getNotation(r, c) {
    return `${String.fromCharCode(97 + c)}${9 - r}`;
}

function makeMove(r1, c1, r2, c2) {
    const piece = board[r1][c1];
    board[r2][c2] = piece;
    board[r1][c1] = 0;
    selected = null;
    movesCount++; 

    // Log per la tabella
    const moveString = `${getNotation(r1, c1)}-${getNotation(r2, c2)}`;
    moveLog.push(moveString);

    checkCaptures(r2, c2);

    gameHistoryList.push(JSON.stringify(board));
    // Aggiorna indice visualizzazione all'ultima mossa
    currentHistoryIndex = gameHistoryList.length - 1;

    const nextTurn = turn === 'white' ? 'black' : 'white';
    
    if (checkWin()) return;
    
    const hash = JSON.stringify(board) + turn;
    historyHash[hash] = (historyHash[hash] || 0) + 1;
    if (historyHash[hash] >= 3) {
        endGame('Pareggio per ripetizione di mosse');
        if(mode==='online') socket.emit('game_over', { gameId });
        return;
    }

    turn = nextTurn;
    
    updateMoveTable();
    updateNavUI();
    drawBoard();
    updateUI();
    updateButtonsUI();

    if (mode === 'online' && myColor !== nextTurn) { 
        socket.emit('make_move', { gameId, moveData: {r1,c1,r2,c2} });
    }
}

// --- TABELLA E NAVIGAZIONE ---
function updateMoveTable() {
    const tbody = document.getElementById('move-list-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    // Ogni riga ha: Numero mossa, Mossa Nero, Mossa Bianco
    // moveLog = ["a1-a2", "b1-b2", ...]
    for (let i = 0; i < moveLog.length; i += 2) {
        const tr = document.createElement('tr');
        
        const tdNum = document.createElement('td');
        tdNum.innerText = (i / 2) + 1 + ".";
        
        const tdBlack = document.createElement('td');
        tdBlack.innerText = moveLog[i]; // Nero muove per primo (indice pari)
        
        const tdWhite = document.createElement('td');
        if (moveLog[i+1]) {
            tdWhite.innerText = moveLog[i+1];
        }
        
        tr.appendChild(tdNum);
        tr.appendChild(tdBlack);
        tr.appendChild(tdWhite);
        tbody.appendChild(tr);
    }
    
    // Auto-scroll verso il basso
    const container = document.getElementById('move-history-container');
    if(container) container.scrollTop = container.scrollHeight;
}

function navigateHistory(direction) {
    const newIndex = currentHistoryIndex + direction;
    if (newIndex >= 0 && newIndex < gameHistoryList.length) {
        currentHistoryIndex = newIndex;
        drawBoard();
        updateNavUI();
    }
}

function updateNavUI() {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    if(btnPrev) btnPrev.disabled = (currentHistoryIndex === 0);
    if(btnNext) btnNext.disabled = (currentHistoryIndex === gameHistoryList.length - 1);
}

// --- GET MOVES (invariato) ---
function getMoves(r, c) {
    let res = [];
    const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
    const isKing = board[r][c] === 2; 
    dirs.forEach(d => {
        let i = 1;
        while(true) {
            let nr = r + d[0]*i;
            let nc = c + d[1]*i;
            if(nr<0 || nr>8 || nc<0 || nc>8) break;
            const targetVal = board[nr][nc];
            const isThrone = (nr===4 && nc===4);
            if (isThrone) {
                if (targetVal !== 0) break; 
                if (isKing) break; 
                i++; continue; 
            }
            if(targetVal !== 0) break;
            if (!isKing && ((nr===0||nr===8) && (nc===0||nc===8))) break; 
            res.push({r: nr, c: nc});
            if (isKing) break; 
            i++;
        }
    });
    return res;
}

// --- CAPTURES (Trono Trasparente) ---
function checkCaptures(r, c) {
    const me = board[r][c];
    const isWhite = (me === 1 || me === 2);
    const enemies = isWhite ? [3] : [1, 2];
    const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
    
    dirs.forEach(d => {
        const nr = r + d[0], nc = c + d[1];     
        const fr = r + d[0]*2, fc = c + d[1]*2; 
        if(nr>=0 && nr<9 && enemies.includes(board[nr][nc])) {
            const victim = board[nr][nc];
            if (victim === 2) { checkKingCapture(nr, nc); return; }
            if (fr>=0 && fr<9) {
                const anvil = board[fr][fc];
                const isAnvilFriend = isWhite ? (anvil===1 || anvil===2) : (anvil===3);
                const isCorner = ((fr===0||fr===8) && (fc===0||fc===8)); 
                const isThrone = (fr===4 && fc===4);
                let capture = false;
                if (isAnvilFriend || isCorner) capture = true;
                else if (isThrone) {
                    const behindTr = fr + d[0], behindTc = fc + d[1];
                    if (behindTr>=0 && behindTr<9 && behindTc>=0 && behindTc<9) {
                        const behindVal = board[behindTr][behindTc];
                        const isBehindFriend = isWhite ? (behindVal===1 || behindVal===2) : (behindVal===3);
                        if (isBehindFriend) capture = true;
                    }
                }
                if (capture) board[nr][nc] = 0; 
            }
        }
    });
}

function checkKingCapture(r, c) {
    let attackers = 0;
    const adj = [[r-1,c], [r+1,c], [r,c-1], [r,c+1]];
    adj.forEach(([ar, ac]) => {
        if (ar<0 || ar>8 || ac<0 || ac>8) attackers++;
        else if (board[ar][ac] === 3) attackers++;
        else if (ar===4 && ac===4) {
            const behindTr = ar + (ar-r), behindTc = ac + (ac-c);
            if (behindTr>=0 && behindTr<9 && behindTc>=0 && behindTc<9) {
                if (board[behindTr][behindTc] === 3) attackers++;
            }
        }
    });
    if (attackers >= 4) endGame('Vittoria Neri!');
}

function checkWin() {
    let king = null;
    for(let i=0; i<9; i++) for(let j=0; j<9; j++) if(board[i][j]===2) king={r:i, c:j};
    if(!king) { endGame('Vittoria Neri!'); return true; }
    if((king.r===0||king.r===8) && (king.c===0||king.c===8)) { endGame('Vittoria Bianchi!'); return true; }
    return false;
}

function endGame(msg) {
    gameOver = true;
    document.getElementById('winner-title').innerText = msg;
    document.getElementById('game-over-modal').classList.remove('hidden');
    if(timerInterval) clearInterval(timerInterval);
}

function updateUI() {
    const el = document.getElementById('current-player');
    el.innerText = turn === 'black' ? "Neri" : "Bianchi";
    el.style.color = turn === 'black' ? "black" : "#d4a017";
}

// --- BUTTONS UI ---
function updateButtonsUI() {
    const btn = document.getElementById('surrender-btn');
    const undoBtn = document.getElementById('undo-btn');
    undoBtn.innerText = `Annulla Mossa (${undosLeft})`;
    undoBtn.disabled = (undosLeft <= 0 || gameOver);
    if (movesCount === 0) {
        btn.innerText = "Annulla Partita";
        btn.style.backgroundColor = "#ff9800"; 
    } else {
        btn.innerText = "Abbandona";
        btn.style.backgroundColor = "#d32f2f"; 
    }
}

function handleSurrender() {
    const action = movesCount === 0 ? "annullare" : "abbandonare";
    if(confirm(`Sei sicuro di voler ${action} la partita?`)) {
        socket.emit('surrender_game', { gameId });
    }
}
function requestUndo() {
    if(undosLeft > 0 && turn !== myColor) { 
        socket.emit('request_undo', { gameId });
        alert("Richiesta inviata all'avversario...");
    } else if (turn === myColor) {
        alert("Puoi annullare solo dopo aver fatto la tua mossa.");
    }
}
function respondUndo(answer) {
    document.getElementById('undo-request-modal').classList.add('hidden');
    socket.emit('answer_undo', { gameId, answer });
}

// --- ONLINE ---
function initOnline(name, time) {
    document.getElementById('online-ui').classList.remove('hidden');
    document.getElementById('online-ui-bottom').classList.remove('hidden');
    document.getElementById('my-name').innerText = name;
    if (time !== 'no-time') {
        timers.white = parseInt(time)*60;
        timers.black = parseInt(time)*60;
    }
    socket = io({ reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1000 });
    socket.emit('find_game', { username: name, timeControl: time });
    
    socket.on('game_start', (data) => {
        gameId = data.gameId;
        const isMeWhite = (data.white.trim() === name.trim());
        const oppName = isMeWhite ? data.black : data.white;
        document.getElementById('opp-name').innerText = oppName;
        const myDot = document.getElementById('my-color');
        const oppDot = document.getElementById('opp-color');
        if (isMeWhite) { myDot.className = 'color-indicator is-white'; oppDot.className = 'color-indicator is-black'; } 
        else { myDot.className = 'color-indicator is-black'; oppDot.className = 'color-indicator is-white'; }
        startGame(); startPing();
    });

    socket.on('assign_color', (c) => { myColor = c; if(timers.white > 0) startTimer(); });
    
    socket.on('opponent_move', (m) => { makeMove(m.r1, m.c1, m.r2, m.c2); });
    
    socket.on('game_over_forced', ({ winner, reason }) => {
        if (reason === 'cancelled') document.getElementById('game-cancelled-modal').classList.remove('hidden');
        else endGame(winner === 'white' ? 'Vittoria Bianchi (Resa)' : 'Vittoria Neri (Resa)');
    });

    socket.on('undo_requested', () => { document.getElementById('undo-request-modal').classList.remove('hidden'); });
    socket.on('undo_accepted', (data) => {
        gameHistoryList.pop(); // Rimuovi mossa locale
        // Rimuovi anche dal log
        moveLog.pop();
        
        const prevState = gameHistoryList[gameHistoryList.length - 1];
        board = JSON.parse(prevState);
        turn = data.newTurn;
        movesCount--;
        currentHistoryIndex = gameHistoryList.length - 1;
        
        if (myColor === 'white') undosLeft = data.whiteUndos; else undosLeft = data.blackUndos;
        drawBoard(); updateUI(); updateButtonsUI(); updateMoveTable(); updateNavUI();
        alert("Annullamento mossa accettato!");
    });

    socket.on('undo_refused', () => { alert("L'avversario ha rifiutato l'annullamento."); });
    socket.on('opponent_connection_lost', () => { document.getElementById('opponent-warning').classList.remove('hidden'); });
    socket.on('game_over_timeout', ({ winner, reason }) => {
        document.getElementById('opponent-warning').classList.add('hidden');
        if (reason === 'disconnection') endGame(`Vittoria ${winner} (Disconnessione)`);
        else endGame(`Vittoria ${winner} (Tempo Scaduto)`);
    });
    socket.on('time_expired', (d) => { endGame(d.loser === 'white' ? "Vittoria Neri (Tempo)" : "Vittoria Bianchi (Tempo)"); });
    socket.on('pong', () => { const ms = Date.now() - lastPing; updateSignal(ms); document.getElementById('connection-warning').classList.add('hidden'); });
    socket.on('connect_error', () => { document.getElementById('connection-warning').classList.remove('hidden'); });
}

let lastPing = 0;
function startPing() {
    setInterval(() => { lastPing = Date.now(); socket.emit('ping'); }, 2000);
    setInterval(() => { if(Date.now() - lastPing > 30000) document.getElementById('connection-warning').classList.remove('hidden'); }, 5000);
}
function updateSignal(ms) {
    const el = document.getElementById('my-signal'); el.classList.remove('signal-1', 'signal-2', 'signal-3', 'signal-4');
    let quality = 'signal-4'; 
    if (ms > 500) quality = 'signal-1'; else if (ms > 300) quality = 'signal-2'; else if (ms > 100) quality = 'signal-3'; 
    el.classList.add(quality);
}
function startTimer() {
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if(gameOver) return;
        if(turn === 'white') timers.white--; else timers.black--;
        const fmt = (t) => { if(t<0) return "00:00"; let m=Math.floor(t/60), s=t%60; return `${m}:${s<10?'0'+s:s}`; };
        document.getElementById('my-timer').innerText = fmt(myColor==='white'?timers.white:timers.black);
        document.getElementById('opp-timer').innerText = fmt(myColor==='white'?timers.black:timers.white);
    }, 1000);
}
