const cluePalette = [
  "#dfdfda",
  "#f1faee",
  "#a8dadc",
  "#c8ddec",
  "#d8d2ea",
  "#f3d9d4",
  "#f0e4b8",
  "#dce8c8",
  "#e7d6ec",
  "#d9d3c8",
];

const state = {
  size: 9,
  minesPerLine: 1,
  cages: [],
  markedMines: new Set(),
  selected: new Set(),
  activeCageId: null,
  nextCageId: 1,
  isPointerDown: false,
  paintMode: "add",
  shiftSelecting: false,
  validationSolutions: [],
  activeSolutionIndex: -1,
};

const el = {
  sizeInput: document.querySelector("#sizeInput"),
  mineInput: document.querySelector("#mineInput"),
  newBoardBtn: document.querySelector("#newBoardBtn"),
  clueInput: document.querySelector("#clueInput"),
  selectionCount: document.querySelector("#selectionCount"),
  makeCageBtn: document.querySelector("#makeCageBtn"),
  updateClueBtn: document.querySelector("#updateClueBtn"),
  joinCageBtn: document.querySelector("#joinCageBtn"),
  removeFromCageBtn: document.querySelector("#removeFromCageBtn"),
  toggleMineBtn: document.querySelector("#toggleMineBtn"),
  clearMinesBtn: document.querySelector("#clearMinesBtn"),
  clearSelectionBtn: document.querySelector("#clearSelectionBtn"),
  validateBtn: document.querySelector("#validateBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  exportSvgBtn: document.querySelector("#exportSvgBtn"),
  importTextBtn: document.querySelector("#importTextBtn"),
  importInput: document.querySelector("#importInput"),
  statusBox: document.querySelector("#statusBox"),
  mineProgress: document.querySelector("#mineProgress"),
  totalMineText: document.querySelector("#totalMineText"),
  cageMineText: document.querySelector("#cageMineText"),
  markMineText: document.querySelector("#markMineText"),
  mineInfoTop: document.querySelector("#mineInfoTop"),
  solutionControls: document.querySelector("#solutionControls"),
  solutionLabel: document.querySelector("#solutionLabel"),
  prevSolutionBtn: document.querySelector("#prevSolutionBtn"),
  nextSolutionBtn: document.querySelector("#nextSolutionBtn"),
  hideSolutionBtn: document.querySelector("#hideSolutionBtn"),
  cageList: document.querySelector("#cageList"),
  board: document.querySelector("#board"),
  boardTitle: document.querySelector("#boardTitle"),
  coverageText: document.querySelector("#coverageText"),
  jsonBox: document.querySelector("#jsonBox"),
};

function keyOf(r, c) {
  return `${r},${c}`;
}

function parseKey(key) {
  return key.split(",").map(Number);
}

function getCage(id) {
  return state.cages.find((cage) => cage.id === id);
}

function colorForClue(clue) {
  if (clue <= 0) return cluePalette[0];
  return cluePalette[((clue - 1) % (cluePalette.length - 1)) + 1];
}

function cellToCageMap() {
  const map = new Map();
  for (const cage of state.cages) {
    for (const cell of cage.cells) map.set(keyOf(cell[0], cell[1]), cage.id);
  }
  return map;
}

function topLeft(cells) {
  return cells.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])[0];
}

function setStatus(text, kind = "neutral") {
  el.statusBox.textContent = text;
  el.statusBox.className = `status ${kind}`;
}

function clearSolutionPreview() {
  state.validationSolutions = [];
  state.activeSolutionIndex = -1;
}

function resetBoard() {
  state.size = Number(el.sizeInput.value);
  state.minesPerLine = Number(el.mineInput.value);
  state.cages = [];
  state.markedMines.clear();
  state.selected.clear();
  state.activeCageId = null;
  state.nextCageId = 1;
  clearSolutionPreview();
  setStatus("新棋盘已创建。先拖拽选择格子，再生成 cage。");
  render();
}

function cleanupEmptyCages() {
  state.cages = state.cages.filter((cage) => cage.cells.length > 0);
}

function makeCage() {
  const cells = [...state.selected].map(parseKey);
  if (!cells.length) {
    setStatus("请先选择至少一个格子。", "bad");
    return;
  }
  const clue = Number(el.clueInput.value);
  if (!Number.isInteger(clue) || clue < 0) {
    setStatus("Cage 雷数必须是非负整数。", "bad");
    return;
  }

  const selectedKeys = new Set(state.selected);
  for (const cage of state.cages) {
    cage.cells = cage.cells.filter((cell) => !selectedKeys.has(keyOf(cell[0], cell[1])));
  }
  cleanupEmptyCages();
  clearSolutionPreview();

  const cage = {
    id: state.nextCageId++,
    clue,
    cells,
  };
  state.cages.push(cage);
  state.activeCageId = cage.id;
  state.selected.clear();
  setStatus(`已生成 Cage ${cage.id}。`);
  render();
}

function updateActiveClue() {
  const cage = getCage(state.activeCageId);
  if (!cage) {
    setStatus("请先点击一个 cage 或生成新 cage。", "bad");
    return;
  }
  const clue = Number(el.clueInput.value);
  if (!Number.isInteger(clue) || clue < 0) {
    setStatus("Cage 雷数必须是非负整数。", "bad");
    return;
  }
  cage.clue = clue;
  clearSolutionPreview();
  setStatus(`Cage ${cage.id} 的雷数已更新为 ${clue}。`);
  render();
}

function deleteActiveCage() {
  const cage = getCage(state.activeCageId);
  if (!cage) {
    setStatus("请先点击一个 cage。", "bad");
    return;
  }
  state.cages = state.cages.filter((item) => item.id !== cage.id);
  state.selected.clear();
  state.activeCageId = null;
  clearSolutionPreview();
  setStatus(`Cage ${cage.id} 已从题面移除，格子回到未分配状态。`);
  render();
}

function joinSelectionToActiveCage() {
  if (!state.selected.size) {
    setStatus("请先选择要加入 cage 的格子。", "bad");
    return;
  }
  const map = cellToCageMap();
  const selectedCageIds = [...new Set([...state.selected].map((key) => map.get(key)).filter(Boolean))];
  let targetCageId = state.activeCageId;
  if (selectedCageIds.length === 1) {
    targetCageId = selectedCageIds[0];
  } else if (selectedCageIds.length > 1 && !selectedCageIds.includes(targetCageId)) {
    setStatus("选择中包含多个 cage。请先点击一个目标 cage，或只选择一个已归属 cage 的格子作为目标。", "bad");
    return;
  }

  const cage = getCage(targetCageId);
  if (!cage) {
    setStatus("请先选择一个已归属 cage 的格子，或在 cage 列表中选中目标 cage。", "bad");
    return;
  }

  const selectedKeys = new Set(state.selected);
  let moved = 0;
  let added = 0;
  for (const item of state.cages) {
    if (item.id === cage.id) continue;
    const before = item.cells.length;
    item.cells = item.cells.filter((cell) => !selectedKeys.has(keyOf(cell[0], cell[1])));
    moved += before - item.cells.length;
  }
  cleanupEmptyCages();

  const existing = new Set(cage.cells.map((cell) => keyOf(cell[0], cell[1])));
  for (const key of state.selected) {
    if (!existing.has(key)) {
      cage.cells.push(parseKey(key));
      existing.add(key);
      added++;
    }
  }

  state.activeCageId = cage.id;
  state.selected.clear();
  clearSolutionPreview();
  setStatus(`已将选择并入 Cage ${cage.id}：新增 ${added} 格，迁移 ${moved} 格。`);
  render();
}

function removeSelectionFromCages() {
  if (!state.selected.size) {
    setStatus("请先选择要踢出的格子。", "bad");
    return;
  }
  const selectedKeys = new Set(state.selected);
  let removed = 0;
  for (const cage of state.cages) {
    const before = cage.cells.length;
    cage.cells = cage.cells.filter((cell) => !selectedKeys.has(keyOf(cell[0], cell[1])));
    removed += before - cage.cells.length;
  }
  cleanupEmptyCages();
  state.selected.clear();
  clearSolutionPreview();
  setStatus(removed ? `已从 cage 中踢出 ${removed} 个格子。` : "选择中没有已分配 cage 的格子。", removed ? "neutral" : "bad");
  render();
}

function toggleMinesForSelection() {
  if (!state.selected.size) {
    setStatus("请先选择要标雷/取消的格子。", "bad");
    return;
  }
  let marked = 0;
  let cleared = 0;
  for (const key of state.selected) {
    if (state.markedMines.has(key)) {
      state.markedMines.delete(key);
      cleared++;
    } else {
      state.markedMines.add(key);
      marked++;
    }
  }
  state.selected.clear();
  setStatus(`标雷 +${marked}，取消 ${cleared}。`);
  render();
}

function clearMarkedMines() {
  const count = state.markedMines.size;
  state.markedMines.clear();
  state.selected.clear();
  setStatus(count ? `已清空 ${count} 个标雷。` : "当前没有标雷。");
  render();
}

function selectCage(id) {
  const cage = getCage(id);
  if (!cage) return;
  state.activeCageId = id;
  state.selected = new Set(cage.cells.map((cell) => keyOf(cell[0], cell[1])));
  el.clueInput.value = cage.clue;
  render();
}

function renderBoard() {
  const size = state.size;
  const cellSize = size <= 6 ? 70 : 56;
  const map = cellToCageMap();
  const previewSolution = state.activeSolutionIndex >= 0 ? state.validationSolutions[state.activeSolutionIndex] : null;
  const previewMines = previewSolution ? new Set(previewSolution.map((cell) => keyOf(cell[0], cell[1]))) : new Set();
  el.board.style.gridTemplateColumns = `repeat(${size}, ${cellSize}px)`;
  el.board.style.gridTemplateRows = `repeat(${size}, ${cellSize}px)`;
  el.board.innerHTML = "";

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const key = keyOf(r, c);
      const cageId = map.get(key);
      const cage = cageId ? getCage(cageId) : null;
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.key = key;
      cell.style.width = `${cellSize}px`;
      cell.style.height = `${cellSize}px`;

      if (!cage) cell.classList.add("unassigned");
      if (cage?.clue === 0) cell.classList.add("zero");
      if (state.selected.has(key)) cell.classList.add("selected");
      if (cage && cage.id === state.activeCageId) cell.classList.add("active-cage");
      if (cage) cell.style.backgroundColor = colorForClue(cage.clue);

      const top = r === 0 || map.get(keyOf(r - 1, c)) !== cageId;
      const right = c === size - 1 || map.get(keyOf(r, c + 1)) !== cageId;
      const bottom = r === size - 1 || map.get(keyOf(r + 1, c)) !== cageId;
      const left = c === 0 || map.get(keyOf(r, c - 1)) !== cageId;
      if (top) cell.classList.add("bound-top");
      if (right) cell.classList.add("bound-right");
      if (bottom) cell.classList.add("bound-bottom");
      if (left) cell.classList.add("bound-left");

      if (cage) {
        const tl = topLeft(cage.cells);
        if (tl[0] === r && tl[1] === c) {
          const clue = document.createElement("span");
          clue.className = "clue";
          clue.textContent = cage.clue;
          cell.appendChild(clue);
        }
      }

      if (state.markedMines.has(key)) {
        const mark = document.createElement("span");
        mark.className = "mine-mark";
        mark.textContent = "X";
        cell.appendChild(mark);
      }

      if (previewMines.has(key)) {
        const preview = document.createElement("span");
        preview.className = "solution-mark";
        preview.textContent = "X";
        cell.appendChild(preview);
      }

      cell.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        if (event.shiftKey) {
          state.isPointerDown = true;
          state.shiftSelecting = true;
          state.paintMode = state.selected.has(key) ? "remove" : "add";
          paintCellSelection(key);
        } else {
          state.isPointerDown = false;
          state.shiftSelecting = false;
          toggleCellSelection(key);
        }
      });
      cell.addEventListener("pointerenter", () => {
        if (state.isPointerDown && state.shiftSelecting) paintCellSelection(key);
      });
      cell.addEventListener("dblclick", () => {
        if (cage) selectCage(cage.id);
      });
      el.board.appendChild(cell);
    }
  }
}

function toggleCellSelection(key) {
  if (state.selected.has(key)) state.selected.delete(key);
  else state.selected.add(key);
  activateCageForCell(key);
  renderMetaOnly();
  renderBoard();
  renderCageList();
}

function paintCellSelection(key) {
  if (state.paintMode === "remove") state.selected.delete(key);
  else state.selected.add(key);
  activateCageForCell(key);
  renderMetaOnly();
  renderBoard();
  renderCageList();
}

function activateCageForCell(key) {
  const cageId = cellToCageMap().get(key);
  if (!cageId) return;
  state.activeCageId = cageId;
  const cage = getCage(cageId);
  if (cage) el.clueInput.value = cage.clue;
}

function renderCageList() {
  el.cageList.innerHTML = "";
  if (!state.cages.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "还没有 cage。";
    el.cageList.appendChild(empty);
    return;
  }

  for (const cage of state.cages) {
    const card = document.createElement("div");
    card.className = "cage-card";
    if (cage.id === state.activeCageId) card.classList.add("active");
    card.style.borderLeftColor = colorForClue(cage.clue);
    card.innerHTML = `
      <div class="cage-card-main"><strong>Cage ${cage.id}</strong><br><small>${cage.cells.length} 格</small></div>
      <div class="cage-card-actions">
        <div>雷数 ${cage.clue}</div>
        <button class="delete-cage" type="button" data-delete-cage="${cage.id}">删除</button>
      </div>
    `;
    card.addEventListener("click", () => selectCage(cage.id));
    card.querySelector(".delete-cage").addEventListener("click", (event) => {
      event.stopPropagation();
      state.cages = state.cages.filter((item) => item.id !== cage.id);
      state.selected.clear();
      if (state.activeCageId === cage.id) state.activeCageId = null;
      clearSolutionPreview();
      setStatus(`Cage ${cage.id} 已删除。`);
      render();
    });
    el.cageList.appendChild(card);
  }
}

function getMineStats() {
  const totalRequired = state.size * state.minesPerLine;
  const cagePlaced = state.cages.reduce((sum, cage) => sum + cage.clue, 0);
  const marked = state.markedMines.size;
  const cageRemaining = totalRequired - cagePlaced;
  const markRemaining = totalRequired - marked;
  return { totalRequired, cagePlaced, marked, cageRemaining, markRemaining };
}

function getMineConflicts() {
  const conflicts = [];
  const rowCounts = Array(state.size).fill(0);
  const colCounts = Array(state.size).fill(0);
  for (const key of state.markedMines) {
    const [r, c] = parseKey(key);
    if (r >= 0 && r < state.size && c >= 0 && c < state.size) {
      rowCounts[r]++;
      colCounts[c]++;
    }
  }

  rowCounts.forEach((count, index) => {
    if (count > state.minesPerLine) conflicts.push(`第 ${index + 1} 行标雷 ${count} 个，超过 ${state.minesPerLine}。`);
  });
  colCounts.forEach((count, index) => {
    if (count > state.minesPerLine) conflicts.push(`第 ${index + 1} 列标雷 ${count} 个，超过 ${state.minesPerLine}。`);
  });

  for (const cage of state.cages) {
    const marked = cage.cells.filter((cell) => state.markedMines.has(keyOf(cell[0], cell[1]))).length;
    if (marked > cage.clue) {
      conflicts.push(`Cage ${cage.id} 标雷 ${marked} 个，超过提示 ${cage.clue}。`);
    }
    if (marked + (cage.cells.length - marked) < cage.clue) {
      conflicts.push(`Cage ${cage.id} 格子数不足以满足提示 ${cage.clue}。`);
    }
  }

  const stats = getMineStats();
  if (stats.marked > stats.totalRequired) {
    conflicts.push(`总标雷 ${stats.marked} 个，超过需要的 ${stats.totalRequired} 个。`);
  }
  if (stats.cagePlaced > stats.totalRequired) {
    conflicts.push(`Cage 提示总雷数 ${stats.cagePlaced} 个，超过需要的 ${stats.totalRequired} 个。`);
  }
  return conflicts;
}

function renderMineInfo() {
  const stats = getMineStats();
  el.totalMineText.textContent = String(stats.totalRequired);
  el.cageMineText.textContent = `${stats.cagePlaced} / 剩余 ${stats.cageRemaining}`;
  el.markMineText.textContent = `${stats.marked} / 剩余 ${stats.markRemaining}`;
  const conflicts = getMineConflicts();
  let text = "";
  let className = "mine-info";
  if (conflicts.length) {
    text = conflicts.join("\n");
    className = "mine-info bad";
  } else if (stats.markRemaining < 0 || stats.cageRemaining < 0) {
    text = "布雷数量超过总需求。";
    className = "mine-info bad";
  } else if (stats.marked > 0) {
    text = "当前标雷没有与行、列或 cage 提示冲突。";
  } else {
    text = "暂无标雷冲突。";
  }
  el.mineInfoTop.textContent = text;
  el.mineInfoTop.className = `${className} top-mine-info`;
}

function renderMetaOnly() {
  const assigned = [...cellToCageMap().keys()].length;
  const total = state.size * state.size;
  el.selectionCount.textContent = `${state.selected.size} 格`;
  el.boardTitle.textContent = `${state.size} x ${state.size} / 每行每列 ${state.minesPerLine} 雷`;
  el.coverageText.textContent = assigned === total ? "已覆盖全部格子" : `未分配 ${total - assigned} 格`;
  renderMineInfo();
}

function renderJson() {
  el.jsonBox.value = JSON.stringify(exportData(), null, 2);
}

function renderSolutionControls() {
  const count = state.validationSolutions.length;
  if (!count || state.activeSolutionIndex < 0) {
    el.solutionControls.classList.add("hidden");
    return;
  }
  el.solutionControls.classList.remove("hidden");
  el.solutionLabel.textContent = `解 ${state.activeSolutionIndex + 1} / ${count}`;
  el.prevSolutionBtn.disabled = count <= 1;
  el.nextSolutionBtn.disabled = count <= 1;
}

function render() {
  renderMetaOnly();
  renderSolutionControls();
  renderBoard();
  renderCageList();
  renderJson();
}

function exportData() {
  return {
    name: "killer_minedoku_custom",
    size: state.size,
    minesPerRow: state.minesPerLine,
    minesPerColumn: state.minesPerLine,
    markedMines: [...state.markedMines]
      .map(parseKey)
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .map((cell) => [cell[0] + 1, cell[1] + 1]),
    cages: state.cages.map((cage) => ({
      id: cage.id,
      clue: cage.clue,
      cells: cage.cells
        .slice()
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])
        .map((cell) => [cell[0] + 1, cell[1] + 1]),
    })),
  };
}

function importData(data) {
  if (!data || !Number.isInteger(data.size) || !Array.isArray(data.cages)) {
    throw new Error("JSON 格式不正确。");
  }
  state.size = data.size;
  state.minesPerLine = Number(data.minesPerRow ?? data.minesPerColumn ?? 1);
  state.cages = data.cages.map((cage, index) => ({
    id: Number(cage.id ?? index + 1),
    clue: Number(cage.clue),
    cells: cage.cells.map((cell) => [cell[0] - 1, cell[1] - 1]),
  }));
  const importedMines = data.markedMines ?? data.mines ?? [];
  state.markedMines = new Set(importedMines.map((cell) => keyOf(cell[0] - 1, cell[1] - 1)));
  state.nextCageId = Math.max(0, ...state.cages.map((cage) => cage.id)) + 1;
  state.selected.clear();
  state.activeCageId = null;
  clearSolutionPreview();
  el.sizeInput.value = String(state.size);
  el.mineInput.value = String(state.minesPerLine);
  setStatus("JSON 已导入。");
  render();
}

function combinations(items, k) {
  const out = [];
  const combo = [];
  function walk(start) {
    if (combo.length === k) {
      out.push(combo.slice());
      return;
    }
    for (let i = start; i <= items.length - (k - combo.length); i++) {
      combo.push(items[i]);
      walk(i + 1);
      combo.pop();
    }
  }
  walk(0);
  return out;
}

function validatePuzzle() {
  const size = state.size;
  const minesPerLine = state.minesPerLine;
  const map = cellToCageMap();
  const total = size * size;
  const errors = [];

  if (!Number.isInteger(minesPerLine) || minesPerLine < 1 || minesPerLine >= size) {
    errors.push("每行/列雷数必须在 1 到 宫格数-1 之间。");
  }
  if (map.size !== total) errors.push(`还有 ${total - map.size} 个格子没有分配 cage。`);

  const seen = new Set();
  for (const cage of state.cages) {
    if (!Number.isInteger(cage.clue) || cage.clue < 0) errors.push(`Cage ${cage.id} 的雷数不是非负整数。`);
    if (cage.clue > cage.cells.length) errors.push(`Cage ${cage.id} 的雷数大于格子数。`);
    for (const [r, c] of cage.cells) {
      const key = keyOf(r, c);
      if (seen.has(key)) errors.push(`格子 R${r + 1}C${c + 1} 被多个 cage 使用。`);
      seen.add(key);
      if (r < 0 || c < 0 || r >= size || c >= size) errors.push(`Cage ${cage.id} 包含棋盘外格子。`);
    }
  }

  if (errors.length) {
    setStatus(errors.join("\n"), "bad");
    return;
  }

  const started = performance.now();
  const result = countSolutions(size, minesPerLine, state.cages, 12);
  const elapsed = Math.round(performance.now() - started);
  state.validationSolutions = result.solutions;
  state.activeSolutionIndex = result.solutions.length ? 0 : -1;

  if (result.count === 0) {
    clearSolutionPreview();
    setStatus(`无解。\n耗时 ${elapsed} ms`, "bad");
  } else if (result.count === 1) {
    setStatus(`唯一解成立。\n耗时 ${elapsed} ms\n雷位：${formatSolution(result.solution, size)}`, "good");
  } else {
    const suffix = result.reachedLimit ? `至少 ${result.count} 个解` : `${result.count} 个解`;
    setStatus(`不是唯一解，找到${suffix}。\n可用棋盘上方按钮切换展示。\n耗时 ${elapsed} ms`, "bad");
  }
  render();
}

function countSolutions(size, minesPerLine, cages, limit) {
  const cageIndex = new Map();
  cages.forEach((cage, index) => {
    cage.cells.forEach((cell) => cageIndex.set(keyOf(cell[0], cell[1]), index));
  });

  const rowPatterns = combinations([...Array(size).keys()], minesPerLine);
  const startCols = Array(size).fill(minesPerLine);
  const startCages = cages.map((cage) => cage.clue);
  const solutions = [];
  const futureCells = Array.from({ length: size }, () => Array(cages.length).fill(0));
  for (let row = 0; row < size; row++) {
    for (let i = 0; i < cages.length; i++) {
      futureCells[row][i] = cages[i].cells.filter((cell) => cell[0] > row).length;
    }
  }

  function search(row, colRemaining, cageRemaining, acc) {
    if (solutions.length >= limit) return;
    if (row === size) {
      const ok = colRemaining.every((v) => v === 0) && cageRemaining.every((v) => v === 0);
      if (ok) solutions.push(acc.slice());
      return;
    }

    const rowsLeft = size - row - 1;
    for (const pattern of rowPatterns) {
      if (solutions.length >= limit) return;
      if (pattern.some((col) => colRemaining[col] <= 0)) continue;

      const nextCols = colRemaining.slice();
      for (const col of pattern) nextCols[col]--;
      if (nextCols.some((value) => value < 0 || value > rowsLeft)) continue;

      const nextCages = cageRemaining.slice();
      let ok = true;
      for (const col of pattern) {
        const idx = cageIndex.get(keyOf(row, col));
        nextCages[idx]--;
        if (nextCages[idx] < 0) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      for (let i = 0; i < cages.length; i++) {
        if (nextCages[i] > futureCells[row][i]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      search(row + 1, nextCols, nextCages, acc.concat(pattern.map((col) => [row, col])));
    }
  }

  search(0, startCols, startCages, []);
  return {
    count: solutions.length,
    solution: solutions[0] ?? null,
    solutions,
    reachedLimit: solutions.length >= limit,
  };
}

function formatSolution(solution) {
  if (!solution) return "";
  return solution.map(([r, c]) => `R${r + 1}C${c + 1}`).join(" ");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createPuzzleSvg() {
  const size = state.size;
  const cellSize = size <= 6 ? 78 : 62;
  const margin = 14;
  const boardSize = size * cellSize;
  const width = boardSize + margin * 2;
  const height = boardSize + margin * 2;
  const map = cellToCageMap();
  const lines = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Killer MineDoku ${size} by ${size} puzzle">`);
  lines.push("<defs>");
  lines.push('<pattern id="unassigned-hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">');
  lines.push('<rect width="12" height="12" fill="#fffdfa"/>');
  lines.push('<line x1="0" y1="0" x2="0" y2="12" stroke="#f0c9c6" stroke-width="4"/>');
  lines.push("</pattern>");
  lines.push("</defs>");
  lines.push('<rect width="100%" height="100%" fill="#f7fbf7"/>');
  lines.push(`<rect x="${margin}" y="${margin}" width="${boardSize}" height="${boardSize}" fill="#fffdfa"/>`);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const key = keyOf(r, c);
      const cageId = map.get(key);
      const cage = cageId ? getCage(cageId) : null;
      const x = margin + c * cellSize;
      const y = margin + r * cellSize;
      const fill = cage ? colorForClue(cage.clue) : "url(#unassigned-hatch)";
      lines.push(`<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${fill}"/>`);
    }
  }

  for (let i = 1; i < size; i++) {
    const p = margin + i * cellSize;
    lines.push(`<line x1="${p}" y1="${margin}" x2="${p}" y2="${margin + boardSize}" stroke="#b8b2a8" stroke-width="1"/>`);
    lines.push(`<line x1="${margin}" y1="${p}" x2="${margin + boardSize}" y2="${p}" stroke="#b8b2a8" stroke-width="1"/>`);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const key = keyOf(r, c);
      const cageId = map.get(key);
      const x = margin + c * cellSize;
      const y = margin + r * cellSize;
      const x2 = x + cellSize;
      const y2 = y + cellSize;
      const top = r === 0 || map.get(keyOf(r - 1, c)) !== cageId;
      const right = c === size - 1 || map.get(keyOf(r, c + 1)) !== cageId;
      const bottom = r === size - 1 || map.get(keyOf(r + 1, c)) !== cageId;
      const left = c === 0 || map.get(keyOf(r, c - 1)) !== cageId;
      if (top) lines.push(`<line x1="${x}" y1="${y}" x2="${x2}" y2="${y}" stroke="#111" stroke-width="2.5" stroke-dasharray="8 6" stroke-linecap="round"/>`);
      if (right) lines.push(`<line x1="${x2}" y1="${y}" x2="${x2}" y2="${y2}" stroke="#111" stroke-width="2.5" stroke-dasharray="8 6" stroke-linecap="round"/>`);
      if (bottom) lines.push(`<line x1="${x}" y1="${y2}" x2="${x2}" y2="${y2}" stroke="#111" stroke-width="2.5" stroke-dasharray="8 6" stroke-linecap="round"/>`);
      if (left) lines.push(`<line x1="${x}" y1="${y}" x2="${x}" y2="${y2}" stroke="#111" stroke-width="2.5" stroke-dasharray="8 6" stroke-linecap="round"/>`);
    }
  }

  for (const cage of state.cages) {
    if (!cage.cells.length) continue;
    const [r, c] = topLeft(cage.cells);
    const x = margin + c * cellSize + 8;
    const y = margin + r * cellSize + (size <= 6 ? 28 : 24);
    lines.push(`<text x="${x}" y="${y}" fill="#171717" font-family="Inter, Segoe UI, Microsoft YaHei, Arial, sans-serif" font-size="${size <= 6 ? 27 : 23}" font-weight="500">${escapeXml(cage.clue)}</text>`);
  }

  for (const key of [...state.markedMines].sort()) {
    const [r, c] = parseKey(key);
    if (r < 0 || c < 0 || r >= size || c >= size) continue;
    const cx = margin + c * cellSize + cellSize / 2;
    const cy = margin + r * cellSize + cellSize / 2;
    const half = cellSize * 0.22;
    lines.push(`<line x1="${cx - half}" y1="${cy - half}" x2="${cx + half}" y2="${cy + half}" stroke="#e63946" stroke-width="${Math.max(5, cellSize * 0.08)}" stroke-linecap="round"/>`);
    lines.push(`<line x1="${cx + half}" y1="${cy - half}" x2="${cx - half}" y2="${cy + half}" stroke="#e63946" stroke-width="${Math.max(5, cellSize * 0.08)}" stroke-linecap="round"/>`);
  }

  lines.push(`<rect x="${margin}" y="${margin}" width="${boardSize}" height="${boardSize}" fill="none" stroke="#171717" stroke-width="6"/>`);
  lines.push("</svg>");
  return lines.join("\n");
}

function downloadJson() {
  const text = JSON.stringify(exportData(), null, 2);
  el.jsonBox.value = text;
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `killer_minedoku_${state.size}x${state.size}_${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadSvg() {
  const text = createPuzzleSvg();
  const blob = new Blob([text], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `killer_minedoku_${state.size}x${state.size}_${Date.now()}.svg`;
  link.click();
  URL.revokeObjectURL(url);
}

el.newBoardBtn.addEventListener("click", resetBoard);
el.makeCageBtn.addEventListener("click", makeCage);
el.updateClueBtn.addEventListener("click", updateActiveClue);
el.joinCageBtn.addEventListener("click", joinSelectionToActiveCage);
el.removeFromCageBtn.addEventListener("click", removeSelectionFromCages);
el.toggleMineBtn.addEventListener("click", toggleMinesForSelection);
el.clearMinesBtn.addEventListener("click", clearMarkedMines);
el.clearSelectionBtn.addEventListener("click", () => {
  state.selected.clear();
  render();
});
el.validateBtn.addEventListener("click", validatePuzzle);
el.prevSolutionBtn.addEventListener("click", () => {
  if (!state.validationSolutions.length) return;
  state.activeSolutionIndex = (state.activeSolutionIndex - 1 + state.validationSolutions.length) % state.validationSolutions.length;
  render();
});
el.nextSolutionBtn.addEventListener("click", () => {
  if (!state.validationSolutions.length) return;
  state.activeSolutionIndex = (state.activeSolutionIndex + 1) % state.validationSolutions.length;
  render();
});
el.hideSolutionBtn.addEventListener("click", () => {
  state.activeSolutionIndex = -1;
  render();
});
el.exportBtn.addEventListener("click", downloadJson);
el.exportSvgBtn.addEventListener("click", downloadSvg);
el.importInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    importData(JSON.parse(await file.text()));
  } catch (error) {
    setStatus(error.message, "bad");
  } finally {
    event.target.value = "";
  }
});
el.importTextBtn.addEventListener("click", () => {
  try {
    importData(JSON.parse(el.jsonBox.value));
  } catch (error) {
    setStatus(error.message, "bad");
  }
});
document.querySelector("#boardWrap").addEventListener("pointerdown", (event) => {
  if (event.target.id === "boardWrap") {
    state.selected.clear();
    render();
  }
});
document.addEventListener("pointerup", () => {
  state.isPointerDown = false;
  state.shiftSelecting = false;
});
document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isTyping = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
  if (isTyping) return;

  if (/^[0-9]$/.test(event.key)) {
    event.preventDefault();
    el.clueInput.value = event.key;
    makeCage();
    return;
  }

  if (event.key.toLowerCase() === "i") {
    event.preventDefault();
    joinSelectionToActiveCage();
    return;
  }

  if (event.key.toLowerCase() === "o") {
    event.preventDefault();
    removeSelectionFromCages();
    return;
  }

  if (event.key.toLowerCase() === "m") {
    event.preventDefault();
    toggleMinesForSelection();
    return;
  }

  if (event.key === "Escape") {
    state.selected.clear();
    render();
  }
});
document.addEventListener("keyup", (event) => {
  if (event.key === "Shift") {
    state.isPointerDown = false;
    state.shiftSelecting = false;
  }
});

resetBoard();
