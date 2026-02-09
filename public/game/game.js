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

// Stato Globale
let board = [];
let turn = 'black'; 
let selected = null;
let gameOver = false;
let historyHash = {}; 

// Online Vars
let mode = 'local';
let socket;
let myColor = null;
let gameId = null;
let timers = { white: 0, black: 0 };
let timerInterval = null;
let badConnCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    mode = params.get('mode') || 'local';

    if (mode === 'online') {
        initOnline(params.get('name'), params.get('time'));
    } else {
        startGame();
    }
});

function startGame() {
    board = JSON.parse(JSON.stringify(initialLayout));
    turn = 'black';
    gameOver = false;
    selected = null;
    historyHash = {};
    drawBoard();
    updateUI();
}

function drawBoard() {
    const el = document.getElementById('board');
    el.innerHTML = '';
    
    let moves = [];
    if (selected && !gameOver) moves = getMoves(selected.r, selected.c);

    for(let r=0; r<9; r++) {
        for(let c=0; c<9; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            if(r===4 && c===4) cell.classList.add('throne');
            if((r===0||r===8) && (c===0||c===8)) cell.classList.add('escape');
            
            cell.onclick = () => handleClick(r, c);

            // Evidenziazione Selezione
            if(selected && selected.r === r && selected.c === c) cell.classList.add('selected');
            
            // Evidenziazione Mossa Possibile (Hint)
            if(moves.some(m => m.r===r && m.c===c)) {
                const h = document.createElement('div'); h.className='hint';
                cell.appendChild(h);
            }

            // Disegno Pezzi
            const val = board[r][c];
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

// --- LOGICA DI GIOCO ---

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

// Logica Movimento Re (1 Passo)
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
                i++;
                continue; 
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

function makeMove(r1, c1, r2, c2) {
    const piece = board[r1][c1];
    board[r2][c2] = piece;
    board[r1][c1] = 0;
    selected = null;

    checkCaptures(r2, c2);

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
    drawBoard();
    updateUI();

    if (mode === 'online' && myColor !== nextTurn) { 
        socket.emit('make_move', { gameId, moveData: {r1,c1,r2,c2} });
    }
}

// *** LOGICA CATTURA MODIFICATA (Trono Trasparente) ***
function checkCaptures(r, c) {
    const me = board[r][c];
    const isWhite = (me === 1 || me === 2);
    const enemies = isWhite ? [3] : [1, 2];
    const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
    
    dirs.forEach(d => {
        const nr = r + d[0], nc = c + d[1];     // Vittima
        const fr = r + d[0]*2, fc = c + d[1]*2; // Incudine (Oltre la vittima)

        if(nr>=0 && nr<9 && enemies.includes(board[nr][nc])) {
            const victim = board[nr][nc];
            
            // Se è il Re, gestione separata
            if (victim === 2) {
                checkKingCapture(nr, nc);
                return;
            }

            if (fr>=0 && fr<9) {
                const anvil = board[fr][fc];
                
                // 1. Controllo se l'incudine è una pedina amica
                const isAnvilFriend = isWhite ? (anvil===1 || anvil===2) : (anvil===3);
                
                // 2. Controllo Strutture (SOLO Angoli ora, non il Trono)
                const isCorner = ((fr===0||fr===8) && (fc===0||fc===8)); 
                
                // 3. Controllo Trono (Speciale)
                const isThrone = (fr===4 && fc===4);

                let capture = false;

                if (isAnvilFriend || isCorner) {
                    capture = true;
                } 
                else if (isThrone) {
                    // SE L'INCUDINE È IL TRONO:
                    // Controlliamo cosa c'è DIETRO il trono (fr+d[0], fc+d[1])
                    const behindTr = fr + d[0];
                    const behindTc = fc + d[1];
                    
                    if (behindTr>=0 && behindTr<9 && behindTc>=0 && behindTc<9) {
                        const behindVal = board[behindTr][behindTc];
                        // Se dietro il trono c'è un amico, il trono fa da ponte -> CATTURA
                        const isBehindFriend = isWhite ? (behindVal===1 || behindVal===2) : (behindVal===3);
                        if (isBehindFriend) capture = true;
                    }
                }

                if (capture) {
                    board[nr][nc] = 0; 
                }
            }
        }
    });
}

// *** CATTURA RE MODIFICATA (Trono Trasparente) ***
function checkKingCapture(r, c) {
    let attackers = 0;
    const adj = [[r-1,c], [r+1,c], [r,c-1], [r,c+1]];
    
    adj.forEach(([ar, ac]) => {
        // 1. Fuori bordo conta come muro (attaccante)
        if (ar<0 || ar>8 || ac<0 || ac>8) {
            attackers++;
        } 
        // 2. Pedina Nera conta come attaccante
        else if (board[ar][ac] === 3) {
            attackers++;
        }
        // 3. Trono conta come attaccante SOLO se dietro c'è un nero
        else if (ar===4 && ac===4) {
            // Calcola la casella dietro al trono rispetto al Re
            // Vettore direzione: (ar-r, ac-c)
            const behindTr = ar + (ar-r);
            const behindTc = ac + (ac-c);
            
            if (behindTr>=0 && behindTr<9 && behindTc>=0 && behindTc<9) {
                // Se dietro il trono c'è un nero, conta +1
                if (board[behindTr][behindTc] === 3) {
                    attackers++;
                }
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

// --- LOGICA ONLINE (PROSPETTIVA UTENTE) ---
function initOnline(name, time) {
    document.getElementById('online-ui').classList.remove('hidden');
    document.getElementById('online-ui-bottom').classList.remove('hidden');
    
    document.getElementById('my-name').innerText = name;
    
    if (time !== 'no-time') {
        timers.white = parseInt(time)*60;
        timers.black = parseInt(time)*60;
    }

    socket = io();
    socket.emit('find_game', { username: name, timeControl: time });

    socket.on('game_start', (data) => {
        gameId = data.gameId;
        
        const isMeWhite = (data.white.trim() === name.trim());
        const oppName = isMeWhite ? data.black : data.white;
        document.getElementById('opp-name').innerText = oppName;
        
        const myDot = document.getElementById('my-color');
        const oppDot = document.getElementById('opp-color');
        
        if (isMeWhite) {
            myDot.className = 'color-indicator is-white';
            oppDot.className = 'color-indicator is-black';
        } else {
            myDot.className = 'color-indicator is-black';
            oppDot.className = 'color-indicator is-white';
        }

        startGame();
        startPing();
    });

    socket.on('assign_color', (c) => {
        myColor = c;
        if(timers.white > 0) startTimer();
    });

    socket.on('opponent_move', (m) => {
        makeMove(m.r1, m.c1, m.r2, m.c2);
    });

    socket.on('game_aborted', (msg) => { alert(msg); window.location.href='../index.html'; });
    socket.on('opponent_disconnected', () => { endGame("Vittoria (Avversario Disconnesso)"); });
    socket.on('time_expired', (d) => { endGame(d.loser === 'white' ? "Vittoria Neri (Tempo)" : "Vittoria Bianchi (Tempo)"); });
    
    socket.on('pong', () => {
        const ms = Date.now() - lastPing;
        updateSignal(ms);
    });
}

let lastPing = 0;
function startPing() {
    setInterval(() => {
        lastPing = Date.now();
        socket.emit('ping');
    }, 2000);
}

function updateSignal(ms) {
    const el = document.getElementById('my-signal');
    el.classList.remove('signal-1', 'signal-2', 'signal-3', 'signal-4');
    
    let quality = 'signal-4'; 
    if (ms > 500) quality = 'signal-1';      
    else if (ms > 300) quality = 'signal-2'; 
    else if (ms > 100) quality = 'signal-3'; 
    
    el.classList.add(quality);
    
    if(ms > 600) badConnCount++;
    else badConnCount = 0;

    if(badConnCount > 10) { 
        alert("Connessione instabile. Partita annullata.");
        window.location.href='../index.html';
    }
}

function startTimer() {
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if(gameOver) return;
        if(turn === 'white') timers.white--; else timers.black--;
        
        const fmt = (t) => {
            if(t<0) return "00:00";
            let m=Math.floor(t/60), s=t%60;
            return `${m}:${s<10?'0'+s:s}`;
        };
        
        document.getElementById('my-timer').innerText = fmt(myColor==='white'?timers.white:timers.black);
        document.getElementById('opp-timer').innerText = fmt(myColor==='white'?timers.black:timers.white);
    }, 1000);
}
