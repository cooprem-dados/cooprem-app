import admin from "firebase-admin";
import xlsx from "xlsx";
import fs from "fs";

/**
 * CONFIGURAÇÕES
 */
const SERVICE_ACCOUNT_PATH = "./serviceAccount.json";
const EXCEL_PATH = "./cooperados.xlsx";
const COLLECTION = "cooperados";

/**
 * FUNÇÕES AUXILIARES
 */
function normalizeText(text = "") {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function cleanDocumento(value = "") {
  return value.toString().replace(/\D/g, "");
}

function getTipoDocumento(doc) {
  if (doc.length === 11) return "cpf";
  if (doc.length === 14) return "cnpj";
  return "desconhecido";
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * INICIALIZA FIREBASE ADMIN
 */
const serviceAccount = JSON.parse(
  fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/**
 * EXECUÇÃO PRINCIPAL
 */
async function run() {
  console.log("📥 Lendo planilha Excel...");

  const workbook = xlsx.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  console.log(`📊 ${rows.length} linhas encontradas`);

  const documentos = rows.map((row, index) => {
    const nome = row.nome?.toString().trim();
    const documento = cleanDocumento(row.cpf);
    const nomeGerente = row.nome_gerente?.toString().trim();
    const PA = row.PA?.toString().trim();

    if (!nome || !documento) {
      console.warn(`⚠️ Linha ${index + 2} ignorada (nome ou documento vazio)`);
      return null;
    }

    return {
      id: documento,
      data: {
        nome,
        nome_normalizado: normalizeText(nome),
        documento,
        tipo_documento: getTipoDocumento(documento),
        nome_gerente: nomeGerente || null,
        nome_gerente_normalizado: nomeGerente
          ? normalizeText(nomeGerente)
          : null,
        PA: PA || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    };
  }).filter(Boolean);

  const batches = chunkArray(documentos, 500);

  console.log(`🚀 Iniciando importação (${batches.length} batches)...`);

  for (let i = 0; i < batches.length; i++) {
    const batch = db.batch();

    batches[i].forEach((item) => {
      const ref = db.collection(COLLECTION).doc(item.id);
      batch.set(ref, item.data, { merge: true });
    });

    await batch.commit();
    console.log(`✅ Batch ${i + 1}/${batches.length} concluído`);
  }

  console.log("🎉 Importação finalizada com sucesso!");
}

run().catch((err) => {
  console.error("❌ Erro na importação:", err);
  process.exit(1);
});