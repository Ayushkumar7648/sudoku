const DIFFICULTIES = {
  easy: { givens: 40 },
  medium: { givens: 34 },
  hard: { givens: 27 },
};

const boardEl = document.getElementById("board");
const keypadEl = document.getElementById("keypad");
const statusEl = document.getElementById("status");
const timerEl = document.getElementById("timer");
const mistakesEl = document.getElementById("mistakes");
const hintsEl = document.getElementById("hints");
const newGameBtn = document.getElementById("newGame");
const undoBtn = document.getElementById("undo");
const eraseBtn = document.getElementById("erase");
const notesBtn = document.getElementById("notes");
const hintBtn = document.getElementById("hint");
const difficultyBtns = document.querySelectorAll(".difficulty__btn");

const cells = [];
const keypadButtons = [];

const state = {
  values: Array(81).fill(0),
  solution: Array(81).fill(0),
  notes: Array.from({ length: 81 }, () => new Set()),
  given: Array(81).fill(false),
  hinted: Array(81).fill(false),
  selected: -1,
  notesMode: false,
  difficulty: "easy",
  mistakes: 0,
  hints: 0,
  elapsed: 0,
  won: false,
  history: [],
  timerId: null,
};

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function findEmpty(board) {
  return board.findIndex((value) => value === 0);
}

function isValid(board, index, number) {
  const row = Math.floor(index / 9);
  const col = index % 9;

  for (let i = 0; i < 9; i++) {
    if (board[row * 9 + i] === number || board[i * 9 + col] === number) return false;
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (board[r * 9 + c] === number) return false;
    }
  }

  return true;
}

function fillBoard(board) {
  const index = findEmpty(board);
  if (index === -1) return true;

  for (const number of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (!isValid(board, index, number)) continue;
    board[index] = number;
    if (fillBoard(board)) return true;
    board[index] = 0;
  }

  return false;
}

function countSolutions(board, limit = 2) {
  let count = 0;

  function solve() {
    if (count >= limit) return;
    const index = findEmpty(board);
    if (index === -1) {
      count += 1;
      return;
    }

    for (let number = 1; number <= 9; number++) {
      if (!isValid(board, index, number)) continue;
      board[index] = number;
      solve();
      board[index] = 0;
      if (count >= limit) return;
    }
  }

  solve();
  return count;
}

function generatePuzzle(givens) {
  const solution = Array(81).fill(0);
  fillBoard(solution);

  const puzzle = solution.slice();
  let remaining = 81;

  for (const index of shuffle(Array.from({ length: 81 }, (_, i) => i))) {
    if (remaining <= givens) break;
    const backup = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions(puzzle.slice()) === 1) {
      remaining -= 1;
    } else {
      puzzle[index] = backup;
    }
  }

  return { puzzle, solution };
}

function isRelated(a, b) {
  if (a === b) return false;
  const rowA = Math.floor(a / 9);
  const colA = a % 9;
  const rowB = Math.floor(b / 9);
  const colB = b % 9;
  return (
    rowA === rowB ||
    colA === colB ||
    (Math.floor(rowA / 3) === Math.floor(rowB / 3) &&
      Math.floor(colA / 3) === Math.floor(colB / 3))
  );
}

function getConflicts(values) {
  const conflicts = new Set();

  function checkGroup(group) {
    const seen = new Map();
    for (const index of group) {
      const value = values[index];
      if (!value) continue;
      if (seen.has(value)) {
        conflicts.add(index);
        conflicts.add(seen.get(value));
      } else {
        seen.set(value, index);
      }
    }
  }

  for (let i = 0; i < 9; i++) {
    checkGroup(Array.from({ length: 9 }, (_, k) => i * 9 + k));
    checkGroup(Array.from({ length: 9 }, (_, k) => k * 9 + i));
  }

  for (let row = 0; row < 9; row += 3) {
    for (let col = 0; col < 9; col += 3) {
      checkGroup([
        row * 9 + col,
        row * 9 + col + 1,
        row * 9 + col + 2,
        (row + 1) * 9 + col,
        (row + 1) * 9 + col + 1,
        (row + 1) * 9 + col + 2,
        (row + 2) * 9 + col,
        (row + 2) * 9 + col + 1,
        (row + 2) * 9 + col + 2,
      ]);
    }
  }

  return conflicts;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function startTimer() {
  stopTimer();
  state.timerId = setInterval(() => {
    if (state.won) return;
    state.elapsed += 1;
    timerEl.textContent = formatTime(state.elapsed);
  }, 1000);
}

function stopTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

function snapshot(index) {
  return {
    index,
    value: state.values[index],
    notes: new Set(state.notes[index]),
    given: state.given[index],
    hinted: state.hinted[index],
    mistakes: state.mistakes,
    hints: state.hints,
  };
}

function render() {
  const conflicts = getConflicts(state.values);
  const selectedValue = state.selected >= 0 ? state.values[state.selected] : 0;

  cells.forEach((cell, i) => {
    const value = state.values[i];
    cell.textContent = "";
    cell.classList.toggle("is-given", state.given[i]);
    cell.classList.toggle("is-hint", state.hinted[i]);
    cell.classList.toggle("is-selected", i === state.selected);
    cell.classList.toggle("is-related", state.selected >= 0 && isRelated(state.selected, i));
    cell.classList.toggle("is-match", Boolean(selectedValue) && value === selectedValue && i !== state.selected);
    cell.classList.toggle("is-conflict", conflicts.has(i));
    cell.classList.toggle("is-error", value !== 0 && !state.given[i] && value !== state.solution[i]);

    if (value) {
      cell.textContent = String(value);
    } else if (state.notes[i].size) {
      const grid = document.createElement("span");
      grid.className = "notes";
      for (let number = 1; number <= 9; number++) {
        const note = document.createElement("span");
        note.className = "notes__value";
        note.textContent = state.notes[i].has(number) ? String(number) : "";
        grid.appendChild(note);
      }
      cell.appendChild(grid);
    }

    const row = Math.floor(i / 9) + 1;
    const col = (i % 9) + 1;
    cell.setAttribute("aria-label", `Row ${row}, column ${col}, ${value || "empty"}`);
  });

  keypadButtons.forEach((button, i) => {
    const number = i + 1;
    const remaining = 9 - state.values.filter((value) => value === number).length;
    button.querySelector(".keypad__count").textContent = remaining > 0 ? `${remaining} left` : "";
    button.disabled = remaining === 0;
  });

  timerEl.textContent = formatTime(state.elapsed);
  mistakesEl.textContent = state.mistakes;
  hintsEl.textContent = state.hints;
  undoBtn.disabled = state.history.length === 0;
  notesBtn.classList.toggle("is-active", state.notesMode);
  notesBtn.setAttribute("aria-pressed", String(state.notesMode));
  notesBtn.textContent = state.notesMode ? "Notes: On" : "Notes: Off";
  statusEl.classList.toggle("is-win", state.won);

  if (state.won) {
    statusEl.textContent = `Solved in ${formatTime(state.elapsed)}!`;
  } else if (state.selected >= 0) {
    const row = Math.floor(state.selected / 9) + 1;
    const col = (state.selected % 9) + 1;
    statusEl.textContent = `Row ${row}, column ${col}${state.notesMode ? " - notes on" : ""}`;
  } else {
    statusEl.textContent = "Select a cell to start";
  }
}

function checkWin() {
  if (state.values.every((value, i) => value === state.solution[i])) {
    state.won = true;
    stopTimer();
  }
}

function inputNumber(number) {
  if (state.won || state.selected < 0 || state.given[state.selected]) return;
  const index = state.selected;

  if (state.notesMode) {
    if (state.values[index]) return;
    state.history.push(snapshot(index));
    if (state.notes[index].has(number)) {
      state.notes[index].delete(number);
    } else {
      state.notes[index].add(number);
    }
    render();
    return;
  }

  if (state.values[index] === number) return;
  state.history.push(snapshot(index));
  state.values[index] = number;
  state.notes[index].clear();

  for (let i = 0; i < 81; i++) {
    if (isRelated(index, i)) state.notes[i].delete(number);
  }

  if (number !== state.solution[index]) state.mistakes += 1;
  checkWin();
  render();
}

function erase() {
  if (state.won || state.selected < 0 || state.given[state.selected]) return;
  const index = state.selected;
  if (!state.values[index] && state.notes[index].size === 0) return;

  state.history.push(snapshot(index));
  state.values[index] = 0;
  state.notes[index].clear();
  render();
}

function undo() {
  const last = state.history.pop();
  if (!last) return;
  const wasWon = state.won;

  state.values[last.index] = last.value;
  state.notes[last.index] = last.notes;
  state.given[last.index] = last.given;
  state.hinted[last.index] = last.hinted;
  state.mistakes = last.mistakes;
  state.hints = last.hints;
  state.won = false;
  state.selected = last.index;
  if (wasWon) startTimer();
  render();
}

function toggleNotes() {
  if (state.won) return;
  state.notesMode = !state.notesMode;
  render();
}

function useHint() {
  if (state.won) return;

  let index = state.selected;
  if (index < 0 || state.given[index] || state.values[index] === state.solution[index]) {
    index = state.values.findIndex((value, i) => !state.given[i] && value !== state.solution[i]);
  }
  if (index < 0) return;

  state.history.push(snapshot(index));
  state.values[index] = state.solution[index];
  state.notes[index].clear();
  state.given[index] = true;
  state.hinted[index] = true;
  state.hints += 1;
  state.selected = index;
  checkWin();
  render();
}

function startGame(difficulty) {
  stopTimer();
  const { puzzle, solution } = generatePuzzle(DIFFICULTIES[difficulty].givens);

  state.values = puzzle.slice();
  state.solution = solution;
  state.notes = Array.from({ length: 81 }, () => new Set());
  state.given = puzzle.map((value) => value !== 0);
  state.hinted = Array(81).fill(false);
  state.selected = -1;
  state.mistakes = 0;
  state.hints = 0;
  state.elapsed = 0;
  state.won = false;
  state.history = [];

  startTimer();
  render();
}

function selectCell(index) {
  if (state.won) return;
  state.selected = index;
  render();
}

for (let i = 0; i < 81; i++) {
  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = "cell";
  cell.dataset.index = String(i);
  cell.dataset.row = String(Math.floor(i / 9));
  cell.dataset.col = String(i % 9);
  cell.setAttribute("role", "gridcell");
  boardEl.appendChild(cell);
  cells.push(cell);
}

for (let number = 1; number <= 9; number++) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "keypad__btn";
  button.dataset.number = String(number);

  const label = document.createElement("span");
  label.className = "keypad__number";
  label.textContent = String(number);
  const count = document.createElement("span");
  count.className = "keypad__count";
  button.append(label, count);

  keypadEl.appendChild(button);
  keypadButtons.push(button);
}

boardEl.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (cell) selectCell(Number(cell.dataset.index));
});

keypadEl.addEventListener("click", (event) => {
  const button = event.target.closest(".keypad__btn");
  if (button) inputNumber(Number(button.dataset.number));
});

newGameBtn.addEventListener("click", () => startGame(state.difficulty));
undoBtn.addEventListener("click", undo);
eraseBtn.addEventListener("click", erase);
notesBtn.addEventListener("click", toggleNotes);
hintBtn.addEventListener("click", useHint);

difficultyBtns.forEach((button) => {
  button.addEventListener("click", () => {
    state.difficulty = button.dataset.difficulty;
    difficultyBtns.forEach((candidate) =>
      candidate.classList.toggle("is-active", candidate === button)
    );
    startGame(state.difficulty);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey) {
    if (event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    }
    return;
  }

  if (/^[1-9]$/.test(event.key)) {
    inputNumber(Number(event.key));
    return;
  }

  if (["Backspace", "Delete", "0"].includes(event.key)) {
    event.preventDefault();
    erase();
    return;
  }

  const key = event.key.toLowerCase();
  if (key === "n") {
    toggleNotes();
    return;
  }
  if (key === "h") {
    useHint();
    return;
  }

  const directions = {
    ArrowUp: -9,
    ArrowDown: 9,
    ArrowLeft: -1,
    ArrowRight: 1,
  };
  if (event.key in directions) {
    event.preventDefault();
    if (state.selected < 0) {
      state.selected = 0;
    } else {
      const col = state.selected % 9;
      if (event.key === "ArrowLeft" && col === 0) return;
      if (event.key === "ArrowRight" && col === 8) return;
      const next = state.selected + directions[event.key];
      if (next >= 0 && next < 81) state.selected = next;
    }
    render();
  }
});

startGame(state.difficulty);
