/**
 * erd-layout.service.js
 * -----------------------------------------------------------------------
 * Menghitung tata letak (layout) diagram ERD dari Database Context:
 * posisi kotak tiap sheet, baris tiap kolom (untuk titik sambung garis
 * relasi yang presisi), dan jalur (edge) antar Foreign Key → Primary Key.
 * Murni kalkulasi geometri — tidak menyentuh DOM, agar mudah dites/dipakai
 * ulang (mis. untuk export SVG statis).
 * -----------------------------------------------------------------------
 */

const BOX_WIDTH = 260;
const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 24;
const FOOTER_ROW_HEIGHT = 22;
const MAX_VISIBLE_COLUMNS = 8;
const H_GAP = 90;
const V_GAP = 50;
const PADDING = 40;

function selectDisplayColumns(columns) {
  const keyCols = columns
    .filter((c) => c.isPrimaryKey || c.isForeignKey)
    .sort((a, b) => Number(b.isPrimaryKey) - Number(a.isPrimaryKey));
  const others = columns.filter((c) => !c.isPrimaryKey && !c.isForeignKey);

  const display = keyCols.slice(0, MAX_VISIBLE_COLUMNS);
  const remainingSlots = MAX_VISIBLE_COLUMNS - display.length;
  if (remainingSlots > 0) display.push(...others.slice(0, remainingSlots));

  const hiddenCount = columns.length - display.length;
  return { display, hiddenCount };
}

/** Urutkan sheet: yang tidak punya FK keluar (kemungkinan tabel "induk") ditaruh lebih dulu */
function orderSheets(sheets) {
  return [...sheets].sort((a, b) => {
    const aFk = a.columns.filter((c) => c.isForeignKey).length;
    const bFk = b.columns.filter((c) => c.isForeignKey).length;
    return aFk - bFk;
  });
}

/**
 * @param {object} context - hasil databaseContextService.build()
 * @param {number} columnsPerRow - jumlah kotak per baris grid
 */
export function computeErdLayout(context, columnsPerRow = 3) {
  const sheets = orderSheets(context.sheets);
  const perRow = Math.max(1, columnsPerRow);

  const nodes = [];
  const nodeByName = new Map();

  const rowHeights = [];
  let currentRow = 0;
  let currentRowMaxHeight = 0;

  sheets.forEach((sheet, idx) => {
    const col = idx % perRow;
    if (col === 0 && idx !== 0) {
      rowHeights.push(currentRowMaxHeight);
      currentRow += 1;
      currentRowMaxHeight = 0;
    }

    const { display, hiddenCount } = selectDisplayColumns(sheet.columns);
    const bodyRows = display.length + (hiddenCount > 0 ? 1 : 0);
    const height = HEADER_HEIGHT + bodyRows * ROW_HEIGHT + (hiddenCount > 0 ? FOOTER_ROW_HEIGHT - ROW_HEIGHT : 0) + 12;

    currentRowMaxHeight = Math.max(currentRowMaxHeight, height);

    const node = {
      sheet: sheet.name,
      rowCount: sheet.rowCount,
      gridRow: currentRow,
      gridCol: col,
      width: BOX_WIDTH,
      height,
      columns: display.map((c, i) => ({
        name: c.name,
        type: c.type,
        isPrimaryKey: c.isPrimaryKey,
        isForeignKey: c.isForeignKey,
        referencesSheet: c.referencesSheet,
        referencesColumn: c.referencesColumn,
        rowIndex: i,
      })),
      hiddenCount,
      x: 0, // diisi di pass berikutnya
      y: 0,
    };
    nodes.push(node);
    nodeByName.set(sheet.name, node);
  });
  rowHeights.push(currentRowMaxHeight);

  // Pass ke-2: hitung X (lebar seragam per kolom grid) & Y (tinggi per baris grid)
  const rowYOffsets = [PADDING];
  for (let r = 1; r < rowHeights.length; r += 1) {
    rowYOffsets.push(rowYOffsets[r - 1] + rowHeights[r - 1] + V_GAP);
  }

  nodes.forEach((node) => {
    node.x = PADDING + node.gridCol * (BOX_WIDTH + H_GAP);
    node.y = rowYOffsets[node.gridRow];
  });

  // Hitung titik tengah tiap baris kolom (dipakai untuk endpoint garis relasi)
  nodes.forEach((node) => {
    node.columns.forEach((c) => {
      c.centerY = node.y + HEADER_HEIGHT + c.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
    });
  });

  const canvasWidth = perRow * (BOX_WIDTH + H_GAP) - H_GAP + PADDING * 2;
  const canvasHeight = rowYOffsets[rowYOffsets.length - 1] + rowHeights[rowHeights.length - 1] + PADDING;

  // Bangun edges dari relationships
  const edges = [];
  (context.relationships || []).forEach((rel) => {
    const [fromSheet, fromColumn] = rel.from.split(".");
    const [toSheet, toColumn] = rel.to.split(".");
    const fromNode = nodeByName.get(fromSheet);
    const toNode = nodeByName.get(toSheet);
    if (!fromNode || !toNode) return;

    const fromCol = fromNode.columns.find((c) => c.name === fromColumn);
    const toCol = toNode.columns.find((c) => c.name === toColumn);

    edges.push({
      fromSheet, fromColumn, toSheet, toColumn,
      type: rel.type,
      confidence: rel.confidence,
      fromPoint: {
        x: fromNode.x + (toNode.x >= fromNode.x ? fromNode.width : 0),
        y: fromCol ? fromCol.centerY : fromNode.y + fromNode.height / 2,
      },
      toPoint: {
        x: toNode.x + (toNode.x >= fromNode.x ? 0 : toNode.width),
        y: toCol ? toCol.centerY : toNode.y + toNode.height / 2,
      },
    });
  });

  return { nodes, edges, canvasWidth, canvasHeight };
}
