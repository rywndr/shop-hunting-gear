import "server-only"

import ExcelJS, { type Cell, type Worksheet } from "exceljs"

import {
  bulkColumns,
  bulkColumnTag,
  type BulkColumnKey,
  type BulkColumnMeta,
  type BulkColumnMode,
} from "./columns"
import { bulkGuideSections, bulkGuideTitle } from "./guide"
import { MAX_ROWS } from "./limits"
import { mapHeaderRow } from "./parser"
import type { BulkCell, BulkSheet, BulkSheetRow } from "./types"

const { ValueType, Workbook } = ExcelJS

const DATA_SHEET = "Produk"
const GUIDE_SHEET = "Panduan"
const HEADER_ROW = 1
const HEADER_HEIGHT = 34
const VALIDATION_ROWS = 200
const GUIDE_WIDTH = 110

const COLORS = {
  requiredFill: "FF292524",
  requiredFont: "FFFAFAF9",
  requiredTag: "FFD6D3D1",
  optionalFill: "FFE7E5E4",
  optionalFont: "FF292524",
  optionalTag: "FF57534E",
  border: "FFA8A29E",
  guideFill: "FFF5F5F4",
} as const

const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"])

/** Prefixes formula-like values so spreadsheet apps keep them as text. */
export function exportText(value: string) {
  const [first] = value

  return first !== undefined && FORMULA_TRIGGERS.has(first)
    ? `'${value}`
    : value
}

export function importText(value: string) {
  const [first, second] = value

  return first === "'" && second !== undefined && FORMULA_TRIGGERS.has(second)
    ? value.slice(1)
    : value
}

export type BulkWorkbookRow = Readonly<
  Partial<Record<BulkColumnKey, string | number | null>>
>

function headerFont(column: BulkColumnMeta) {
  return {
    bold: true,
    size: 11,
    color: {
      argb: column.required ? COLORS.requiredFont : COLORS.optionalFont,
    },
  }
}

function tagFont(column: BulkColumnMeta) {
  return {
    bold: true,
    size: 8,
    color: { argb: column.required ? COLORS.requiredTag : COLORS.optionalTag },
  }
}

function thinBorder() {
  const side = { style: "thin" as const, color: { argb: COLORS.border } }

  return { top: side, left: side, bottom: side, right: side }
}

function writeHeader(sheet: Worksheet, columns: readonly BulkColumnMeta[]) {
  const row = sheet.getRow(HEADER_ROW)

  for (const [index, column] of columns.entries()) {
    const cell = row.getCell(index + 1)

    cell.value = {
      richText: [
        { font: headerFont(column), text: column.header },
        { font: tagFont(column), text: `\n${bulkColumnTag(column.required)}` },
      ],
    }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: column.required ? COLORS.requiredFill : COLORS.optionalFill,
      },
    }
    cell.alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    }
    cell.border = thinBorder()

    if (column.help) {
      cell.note = column.help
    }
  }

  row.height = HEADER_HEIGHT
  row.commit()
}

function styleColumns(sheet: Worksheet, columns: readonly BulkColumnMeta[]) {
  for (const [index, column] of columns.entries()) {
    const sheetColumn = sheet.getColumn(index + 1)

    sheetColumn.width = column.width
    sheetColumn.alignment = {
      horizontal: column.align === "end" ? "right" : "left",
      vertical: "top",
      wrapText: column.type === "longText",
    }

    if (column.type === "integer") {
      sheetColumn.numFmt = "#,##0"
    }
  }
}

function applyValidation({
  sheet,
  columns,
  rowCount,
}: {
  sheet: Worksheet
  columns: readonly BulkColumnMeta[]
  rowCount: number
}) {
  for (const [index, column] of columns.entries()) {
    if (!column.choices) {
      continue
    }

    const formula = `"${column.choices.map(({ value }) => value).join(",")}"`

    for (let row = HEADER_ROW + 1; row <= HEADER_ROW + rowCount; row += 1) {
      sheet.getCell(row, index + 1).dataValidation = {
        type: "list",
        allowBlank: !column.required,
        formulae: [formula],
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: column.label,
        error: `Pilih salah satu: ${column.choices
          .map(({ value }) => value)
          .join(", ")}.`,
      }
    }
  }
}

function writeDataRows({
  sheet,
  columns,
  rows,
}: {
  sheet: Worksheet
  columns: readonly BulkColumnMeta[]
  rows: readonly BulkWorkbookRow[]
}) {
  for (const [rowIndex, values] of rows.entries()) {
    const row = sheet.getRow(HEADER_ROW + 1 + rowIndex)

    for (const [index, column] of columns.entries()) {
      const value = values[column.key]

      if (value === undefined || value === null) {
        continue
      }

      row.getCell(index + 1).value =
        typeof value === "number" ? value : exportText(value)
    }

    row.commit()
  }
}

function writeGuideSheet(sheet: Worksheet, mode: BulkColumnMode) {
  sheet.getColumn(1).width = GUIDE_WIDTH
  sheet.getColumn(1).alignment = { vertical: "top", wrapText: true }

  let rowNumber = 1

  function writeLine(text: string, style: "title" | "section" | "line") {
    const cell = sheet.getCell(rowNumber, 1)
    cell.value = exportText(text)

    switch (style) {
      case "title":
        cell.font = { bold: true, size: 14 }
        break
      case "section":
        cell.font = { bold: true, size: 11 }
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.guideFill },
        }
        break
      case "line":
        cell.font = { size: 10 }
        break
      default: {
        const _exhaustive: never = style
        return _exhaustive
      }
    }

    rowNumber += 1
  }

  writeLine(bulkGuideTitle(mode), "title")

  for (const section of bulkGuideSections(mode)) {
    rowNumber += 1
    writeLine(section.title, "section")

    for (const line of section.lines) {
      writeLine(`• ${line}`, "line")
    }
  }
}

export async function bulkWorkbookBytes({
  mode,
  rows,
}: {
  mode: BulkColumnMode
  rows: readonly BulkWorkbookRow[]
}): Promise<ArrayBuffer> {
  const columns = bulkColumns(mode)
  const workbook = new Workbook()
  workbook.creator = "hunting-gear.net"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(DATA_SHEET, {
    views: [{ state: "frozen", ySplit: HEADER_ROW }],
  })

  styleColumns(sheet, columns)
  writeHeader(sheet, columns)
  writeDataRows({ sheet, columns, rows })
  applyValidation({
    sheet,
    columns,
    rowCount: Math.max(rows.length, VALIDATION_ROWS),
  })

  sheet.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: HEADER_ROW, column: columns.length },
  }

  writeGuideSheet(workbook.addWorksheet(GUIDE_SHEET), mode)

  return workbook.xlsx.writeBuffer()
}

function bulkCell(cell: Cell): BulkCell {
  switch (cell.type) {
    case ValueType.Null:
    case ValueType.Merge:
      return { kind: "empty" }
    case ValueType.Formula:
      return { kind: "formula" }
    case ValueType.Number:
      return typeof cell.value === "number"
        ? { kind: "number", value: cell.value }
        : { kind: "unsupported" }
    case ValueType.String:
    case ValueType.SharedString:
    case ValueType.RichText:
    case ValueType.Hyperlink: {
      const value = importText(cell.text).trim()
      return value === "" ? { kind: "empty" } : { kind: "text", value }
    }
    default:
      return { kind: "unsupported" }
  }
}

function invalidSheet(message: string): BulkSheet {
  return { kind: "invalid", message }
}

export async function readBulkSheet({
  bytes,
  mode,
}: {
  bytes: ArrayBuffer
  mode: BulkColumnMode
}): Promise<BulkSheet> {
  const workbook = new Workbook()

  try {
    await workbook.xlsx.load(bytes)
  } catch {
    return invalidSheet("File tidak dapat dibaca sebagai workbook .xlsx.")
  }

  const sheet = workbook.getWorksheet(DATA_SHEET) ?? workbook.worksheets[0]

  if (!sheet) {
    return invalidSheet(`Workbook tidak memiliki lembar "${DATA_SHEET}".`)
  }

  const columns = bulkColumns(mode)
  const headerRow = sheet.getRow(HEADER_ROW)
  const width = Math.max(sheet.columnCount, columns.length)
  const headers = Array.from({ length: width }, (_, index) => {
    const cell = bulkCell(headerRow.getCell(index + 1))
    return cell.kind === "text" ? cell.value : null
  })
  const mapping = mapHeaderRow(mode, headers)

  if (mapping.kind === "invalid") {
    return invalidSheet(mapping.message)
  }

  const rows: BulkSheetRow[] = []

  for (
    let rowNumber = HEADER_ROW + 1;
    rowNumber <= sheet.rowCount;
    rowNumber += 1
  ) {
    const sheetRow = sheet.getRow(rowNumber)
    const cells: Partial<Record<BulkColumnKey, BulkCell>> = {}
    let filled = false

    for (const [index, key] of mapping.keyByIndex) {
      const cell = bulkCell(sheetRow.getCell(index + 1))
      cells[key] = cell

      if (cell.kind !== "empty") {
        filled = true
      }
    }

    if (!filled) {
      continue
    }

    if (rows.length >= MAX_ROWS) {
      return invalidSheet(`Workbook melebihi batas ${MAX_ROWS} baris produk.`)
    }

    rows.push({ row: rowNumber, cells })
  }

  if (rows.length === 0) {
    return invalidSheet("Workbook tidak memiliki baris produk.")
  }

  return { kind: "sheet", rows }
}
