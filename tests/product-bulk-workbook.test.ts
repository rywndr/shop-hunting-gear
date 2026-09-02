import assert from "node:assert/strict"
import test from "node:test"

import ExcelJS from "exceljs"

import { bulkColumns } from "../lib/admin/product-bulk/columns"
import { MAX_ROWS } from "../lib/admin/product-bulk/limits"
import {
  bulkWorkbookBytes,
  readBulkSheet,
} from "../lib/admin/product-bulk/workbook"

const UPLOAD_ROW = {
  name: "Tenda Camping Ringan",
  category: "hunting",
  variant: "Ukuran: M=150000/500",
  price: 150000,
  compareAtPrice: 199000,
  stock: 12,
  weight: 2500,
  description: "Tenda ringan dua orang dengan lapisan tahan air.",
  image1Url: "https://cdn.example.com/foto-1.jpg",
} as const

test("the upload template carries styled headers, a guide sheet, and no data rows", async () => {
  const bytes = await bulkWorkbookBytes({ mode: "upload", rows: [] })
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(bytes)

  const sheet = workbook.getWorksheet("Produk")
  assert.ok(sheet)
  assert.ok(workbook.getWorksheet("Panduan"))

  const header = sheet.getRow(1)
  assert.equal(header.getCell(1).text.startsWith("Nama Produk"), true)
  assert.match(header.getCell(1).text, /WAJIB/)
  assert.match(header.getCell(3).text, /OPSIONAL/)
  assert.equal(sheet.getColumn(1).width, bulkColumns("upload")[0]?.width)
  assert.deepEqual(sheet.views[0]?.state, "frozen")
  assert.ok(sheet.autoFilter)

  const parsed = await readBulkSheet({ bytes, mode: "upload" })
  assert.equal(parsed.kind, "invalid")
})

test("a generated workbook round trips through the reader", async () => {
  const bytes = await bulkWorkbookBytes({
    mode: "upload",
    rows: [UPLOAD_ROW, { ...UPLOAD_ROW, name: "=Nama Berbahaya" }],
  })
  const parsed = await readBulkSheet({ bytes, mode: "upload" })

  assert.equal(parsed.kind, "sheet")
  if (parsed.kind === "sheet") {
    assert.equal(parsed.rows.length, 2)
    assert.deepEqual(parsed.rows[0]?.cells.name, {
      kind: "text",
      value: UPLOAD_ROW.name,
    })
    assert.deepEqual(parsed.rows[0]?.cells.price, {
      kind: "number",
      value: 150000,
    })
    assert.deepEqual(parsed.rows[1]?.cells.name, {
      kind: "text",
      value: "=Nama Berbahaya",
    })
  }
})

test("the update workbook keeps image columns blank", async () => {
  const bytes = await bulkWorkbookBytes({
    mode: "update",
    rows: [
      {
        id: "1700000000123",
        name: "Tenda Camping Ringan",
        price: 150000,
        compareAtPrice: null,
        stock: 4,
        weight: 2500,
        state: "active",
      },
    ],
  })
  const parsed = await readBulkSheet({ bytes, mode: "update" })

  assert.equal(parsed.kind, "sheet")
  if (parsed.kind === "sheet") {
    const [row] = parsed.rows
    assert.deepEqual(row?.cells.id, { kind: "text", value: "1700000000123" })
    assert.deepEqual(row?.cells.image1Url, { kind: "empty" })
    assert.deepEqual(row?.cells.compareAtPrice, { kind: "empty" })
  }
})

async function workbookFrom(rows: readonly (readonly unknown[])[]) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Produk")

  for (const row of rows) {
    sheet.addRow([...row])
  }

  return workbook.xlsx.writeBuffer()
}

test("a workbook without the expected headers is rejected", async () => {
  const bytes = await workbookFrom([
    ["Nama", "Harga"],
    ["Tenda", 150000],
  ])
  const parsed = await readBulkSheet({ bytes, mode: "upload" })

  assert.equal(parsed.kind, "invalid")
  if (parsed.kind === "invalid") {
    assert.match(parsed.message, /tidak ditemukan/)
  }
})

test("a file that is not a workbook is rejected", async () => {
  const parsed = await readBulkSheet({
    bytes: new TextEncoder().encode("bukan xlsx").buffer as ArrayBuffer,
    mode: "upload",
  })

  assert.equal(parsed.kind, "invalid")
})

test("blank rows between products are ignored", async () => {
  const headers = bulkColumns("upload").map(({ header }) => header)
  const values = bulkColumns("upload").map(
    ({ key }) => UPLOAD_ROW[key as keyof typeof UPLOAD_ROW] ?? null
  )
  const bytes = await workbookFrom([headers, values, [], values])
  const parsed = await readBulkSheet({ bytes, mode: "upload" })

  assert.equal(parsed.kind, "sheet")
  if (parsed.kind === "sheet") {
    assert.deepEqual(
      parsed.rows.map(({ row }) => row),
      [2, 4]
    )
  }
})

test("formula cells survive parsing as a rejectable cell kind", async () => {
  const headers = bulkColumns("upload").map(({ header }) => header)
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Produk")
  sheet.addRow(headers)
  const row = sheet.addRow(
    bulkColumns("upload").map(
      ({ key }) => UPLOAD_ROW[key as keyof typeof UPLOAD_ROW] ?? null
    )
  )
  row.getCell(4).value = { formula: "1+1", result: 2 }

  const parsed = await readBulkSheet({
    bytes: await workbook.xlsx.writeBuffer(),
    mode: "upload",
  })

  assert.equal(parsed.kind, "sheet")
  if (parsed.kind === "sheet") {
    assert.deepEqual(parsed.rows[0]?.cells.price, { kind: "formula" })
  }
})

test("a workbook beyond the row limit is rejected", async () => {
  const headers = bulkColumns("upload").map(({ header }) => header)
  const values = bulkColumns("upload").map(
    ({ key }) => UPLOAD_ROW[key as keyof typeof UPLOAD_ROW] ?? null
  )
  const bytes = await workbookFrom([
    headers,
    ...Array.from({ length: MAX_ROWS + 1 }, () => values),
  ])
  const parsed = await readBulkSheet({ bytes, mode: "upload" })

  assert.equal(parsed.kind, "invalid")
  if (parsed.kind === "invalid") {
    assert.match(parsed.message, new RegExp(String(MAX_ROWS)))
  }
})
