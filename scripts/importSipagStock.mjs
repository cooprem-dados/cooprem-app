import admin from "firebase-admin";
import XLSX from "xlsx";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const fileArg = process.argv[2];
if (!fileArg) {
  console.error("Uso: node scripts/importSipagStock.mjs <caminho-do-xlsx>");
  process.exit(1);
}

const filePath = resolve(fileArg);
if (!existsSync(filePath)) {
  console.error(`Arquivo não encontrado: ${filePath}`);
  process.exit(1);
}

if (!admin.apps.length) {
  const credsPath = resolve(process.cwd(), "serviceAccount.json");
  if (!existsSync(credsPath)) {
    console.error(`Credenciais não encontradas: ${credsPath}`);
    process.exit(1);
  }
  const serviceAccount = JSON.parse(readFileSync(credsPath, "utf-8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const workbook = XLSX.readFile(filePath, { cellDates: true });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

if (!rows.length) {
  console.error("Planilha vazia.");
  process.exit(1);
}

const first = rows[0];
const keys = Object.keys(first).map((k) => k.toLowerCase().trim());
const serialKey = Object.keys(first).find((k) => k.toLowerCase().trim() === "serial");
const paKey = Object.keys(first).find((k) => k.toLowerCase().trim() === "pa");

if (!serialKey || !paKey) {
  console.error("Colunas obrigatórias não encontradas. Precisa ter: serial, PA");
  console.error("Colunas encontradas:", keys.join(", "));
  process.exit(1);
}

let total = 0;
let created = 0;
let skipped = 0;
let errors = 0;

const writer = db.bulkWriter();
writer.onWriteError((err) => {
  if (err.code === 6 || err.message?.includes("ALREADY_EXISTS")) {
    skipped++;
    return false;
  }
  errors++;
  console.error("Erro:", err);
  return true; // retry
});

for (const row of rows) {
  const serialRaw = String(row[serialKey] ?? "").trim().toUpperCase();
  const paRaw = String(row[paKey] ?? "").trim();
  if (!serialRaw || !paRaw) continue;

  total++;
  const status = paRaw === "99" ? "ESTOQUE" : "ALOCADA";

  const ref = db.collection("sipagMachines").doc(serialRaw);
  writer.create(ref, {
    serial: serialRaw,
    currentPA: paRaw,
    status,
    operationalStatus: "EM_ESTOQUE",
    cooperadoCNPJ: null,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  created++;
}

await writer.close();

console.log("Importação concluída");
console.log({ total, created, skipped, errors });
