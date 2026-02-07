const boardElement = document.getElementById('board');

// Legenda: 0=vuoto, 1=Bianco, 2=Re, 3=Nero
const initialBoard = [
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

function createBoard() {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;

            // Colora caselle speciali
            if (r === 4 && c === 4) cell.classList.add('throne');
            if ((r==0||r==8) && (c==0||c==8)) cell.classList.add('escape');

            // Aggiungi pezzi
            const pieceType = initialBoard[r][c];
            if (pieceType !== 0) {
                const piece = document.createElement('div');
                piece.classList.add('piece');
                if (pieceType === 1) piece.classList.add('white-piece');
                if (pieceType === 2) piece.classList.add('king');
                if (pieceType === 3) piece.classList.add('black-piece');
                cell.appendChild(piece);
            }

            boardElement.appendChild(cell);
        }
    }
}

createBoard();
