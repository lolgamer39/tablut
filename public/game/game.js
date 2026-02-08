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
let turn = 'black'; // Nel Tablut inizia il Nero (Assediante)
let selected = null;
let gameOver = false;
let historyHash = {}; // Per la patta (3 ripetizioni)

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
    
    // Mostra hint se selezionato
    let moves = [];
    if (selected && !gameOver) moves = getMoves(selected.r, selected.c);

    for(let r=0; r<9; r++) {
        for(let c=0; c<9; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            if(r===4 && c===4) cell.classList.add('throne');
            if((r===0||r===8) && (c===0||c===8)) cell.classList.add('escape');
            
            // Gestione Click
            cell.onclick = () => handleClick(r, c);

            // Evidenziazione
            if(selected && selected.r === r && selected.c === c) cell.classList.add('selected');
            if(moves.some(m => m.r===r && m.c===c)) {
                const h = document.createElement('div'); h.className='hint';
                cell.appendChild(h);
            }

            // Pezzi
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
    if (mode === 'online' && turn !== myColor) return; // Non è il tuo turno

    const val = board[r][c];
    
    // 1. Seleziona Pezzo
    if (isMyPiece(val)) {
        selected = {r, c};
        drawBoard();
        return;
    }

    // 2. Muovi Pezzo
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

            // REGOLA: Attraversamento Trono
            // Si può saltare il trono se vuoto (targetVal 0), ma non fermarcisi sopra (a meno che non sia il Re all'inizio, ma qui muove).
            // Regola: "nessuna pedina... possa ritornarci sopra".
            if (isThrone) {
                if (targetVal !== 0) break; // Trono occupato (es. Re) -> blocco
                // Se è trono vuoto, posso attraversarlo (continuo il while), ma non posso fermarmi (non aggiungo a res)
                i++;
                continue; 
            }

            if(targetVal !== 0) break; // C'è un pezzo

            // Regola Angoli: Solo Re
            if (!isKing && ((nr===0||nr===8) && (nc===0||nc===8))) break; 

            res.push({r: nr, c: nc});
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

    // Check Catture
    checkCaptures(r2, c2);

    // Cambio Turno
    const nextTurn = turn === 'white' ? 'black' : 'white';
    
    // Check Vittoria
    if (checkWin()) return;
    
    // Check Patta (3 ripetizioni)
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

    // Invio mossa Online
    if (mode === 'online' && myColor !== nextTurn) { // Se ho appena mosso io
        socket.emit('make_move', { gameId, moveData: {r1,c1,r2,c2} });
    }
}

function checkCaptures(r, c) {
    const me = board[r][c];
    const isWhite = (me === 1 || me === 2);
    const enemies = isWhite ? [3] : [1, 2];

    const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
    
    dirs.forEach(d => {
        const nr = r + d[0], nc = c + d[1];     // Adiacente
        const fr = r + d[0]*2, fc = c + d[1]*2; // Oltre adiacente (Incudine)

        if(nr>=0 && nr<9 && enemies.includes(board[nr][nc])) {
            const victim = board[nr][nc];
            
            // CATTURA DEL RE (Speciale)
            if (victim === 2) {
                checkKingCapture(nr, nc);
                return;
            }

            // CATTURA PEDINA NORMALE
            if (fr>=0 && fr<9) {
                const anvil = board[fr][fc];
                const isAnvilFriend = isWhite ? (anvil===1 || anvil===2) : (anvil===3);
                const isStructure = ((fr===0||fr===8) && (fc===0||fc===8)) || (fr===4 && fc===4); // Angoli o Trono vuoto

                if (isAnvilFriend || isStructure) {
                    board[nr][nc] = 0; // Mangiato
                }
            }
        }
    });
}

function checkKingCapture(r, c) {
    let attackers = 0;
    const adj = [[r-1,c], [r+1,c], [r,c-1], [r,c+1]];
    
    adj.forEach(([ar, ac]) => {
        // Se fuori bordo o Trono o Pezzo Nero -> conta come ostile
        if (ar<0 || ar>8 || ac<0 || ac>8 || (ar===4&&ac===4) || board[ar][ac]===3) {
            attackers++;
        }
    });

    // Se Re è vicino al Trono o Bordo bastano 3 attacchi, altrimenti 4.
    // La logica sopra conta "fuori bordo" e "trono" come 1 attaccante.
    // Quindi se attackers >= 4, è preso in ogni caso.
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

// --- LOGICA ONLINE SOCKET ---
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
        document.getElementById('opp-name').innerText = (data.white === name) ? data.black : data.white;
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
    el.className = 'signal ' + (ms < 150 ? 'good' : (ms < 400 ? 'med' : 'bad'));
    
    if(ms > 500) badConnCount++;
    else badConnCount = 0;

    if(badConnCount > 10) { // Circa 20 secondi di lag pesante
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
