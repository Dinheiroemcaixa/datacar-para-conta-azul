import * as XLSX from 'xlsx';
import { parseBrazilianNumber, parseBrazilianDate } from './utils';

export interface DataCarRow {
  NF: string;
  MOD: string;
  SER: string;
  EMISSÃO: string;
  FORNECEDOR: string;
  DOC: string;
  VENCIM: string;
  VALOR: string | number;
  LOC: string;
  BCO: string;
}

export interface ProcessedRow {
  id: string;
  fornecedor: string;
  documento: string;
  vencimento: Date;
  emissao: Date;
  valor: number;
  categoria: string;
  status: 'OK' | 'PENDENTE';
  nf: string;
  doc: string;
}

export const CONTA_AZUL_HEADERS = [
  'Data de Competência',
  'Data de Vencimento',
  'Data de Pagamento',
  'Valor',
  'Categoria',
  'Descrição',
  'Cliente/Fornecedor',
  'CNPJ/CPF Cliente/Fornecedor',
  'Centro de Custo',
  'Observações'
];

const KEYWORD_RULES: Record<string, string> = {
  'DARF': 'Impostos federais',
  'SIMPLES NACIONAL': 'Simples Nacional',
  'GETNET': 'Taxas de adquirência',
  'CAIXA ECONOMICA FEDERAL': 'Tributos',
};

export function getCategoryForFornecedor(fornecedor: string, savedMap: Record<string, string>): string {
  // Rule 1: Saved Map
  if (savedMap[fornecedor]) return savedMap[fornecedor];

  // Rule 2: Keywords
  const upperFornecedor = fornecedor.toUpperCase();
  for (const [keyword, category] of Object.entries(KEYWORD_RULES)) {
    if (upperFornecedor.includes(keyword)) return category;
  }

  // Rule 3: Default
  return 'Categoria não definida';
}

export async function processDataCarFile(file: File, savedMap: Record<string, string>): Promise<ProcessedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const processed: ProcessedRow[] = [];
        const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

        // Process all sheets
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
          
          let colMap: Record<string, number> = {};
          let hasHeader = false;

          rawData.forEach((row: any[], index: number) => {
            if (!Array.isArray(row) || row.length === 0) return;

            const rowStr = row.map(c => normalize(String(c || '')));
            
            // Detect header row - more flexible detection
            const isHeader = (
              (rowStr.includes('NF') || rowStr.includes('NOTA')) && 
              (rowStr.includes('FORNECEDOR') || rowStr.includes('CLI/FOR')) && 
              (rowStr.includes('VENCIM') || rowStr.includes('VENCIMENTO'))
            );

            if (isHeader) {
              colMap = {};
              rowStr.forEach((val, idx) => {
                if (val) {
                  // Normalize keys for internal mapping
                  let normalizedKey = val;
                  if (val.includes('VENCIM')) normalizedKey = 'VENCIM';
                  if (val.includes('EMISSAO')) normalizedKey = 'EMISSÃO';
                  if (val.includes('VALOR')) normalizedKey = 'VALOR';
                  if (val.includes('DOC')) normalizedKey = 'DOC';
                  if (val.includes('NF') || val.includes('NOTA')) normalizedKey = 'NF';
                  if (val.includes('FORNECEDOR')) normalizedKey = 'FORNECEDOR';
                  
                  colMap[normalizedKey] = idx;
                }
              });
              hasHeader = true;
              return;
            }

            if (!hasHeader) return;

            const getVal = (key: string) => {
              const idx = colMap[normalize(key)];
              return idx !== undefined ? row[idx] : undefined;
            };

            let fornecedor = String(getVal('FORNECEDOR') || '').trim();
            const nf = String(getVal('NF') || '').trim();
            const doc = String(getVal('DOC') || '').trim();
            const vencimRaw = getVal('VENCIM');
            const emissaoRaw = getVal('EMISSÃO');
            const valorRaw = getVal('VALOR');
            
            // Validation
            if (!fornecedor || !vencimRaw || valorRaw === undefined || valorRaw === '') return;
            
            const upperFornecedor = fornecedor.toUpperCase();
            
            // Skip headers and noise
            if (upperFornecedor === 'FORNECEDOR') return;
            if (upperFornecedor.includes('TOTAIS')) return;
            if (upperFornecedor.startsWith('EMISSÃO:')) return;
            if (upperFornecedor.startsWith('EMPRESA:')) return;
            if (upperFornecedor.startsWith('PÁGINA:')) return;

            const valor = parseBrazilianNumber(valorRaw);
            if (valor === 0) return;

            const parseDate = (val: any): Date | null => {
              if (val instanceof Date) return val;
              if (typeof val === 'number') {
                return new Date(Math.round((val - 25569) * 86400 * 1000));
              }
              return parseBrazilianDate(String(val || '').trim());
            };

            const vencimento = parseDate(vencimRaw);
            const emissao = parseDate(emissaoRaw) || vencimento;

            if (!vencimento) return;

            const categoria = getCategoryForFornecedor(fornecedor, savedMap);

            processed.push({
              id: `row-${sheetName}-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              fornecedor,
              documento: `NF ${nf} - DOC ${doc}`.trim().replace(/^-/, '').replace(/-$/, '').trim(),
              vencimento,
              emissao: emissao!,
              valor,
              categoria,
              status: categoria === 'Categoria não definida' ? 'PENDENTE' : 'OK',
              nf,
              doc
            });
          });
        });

        if (processed.length === 0) {
          reject(new Error('Nenhum dado válido encontrado no arquivo. Verifique se as colunas NF, FORNECEDOR e VENCIM estão presentes no formato esperado.'));
          return;
        }

        resolve(processed);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export async function processContaAzulHistory(file: File): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
        
        const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
        
        let colMap: Record<string, number> = {};
        let headerIndex = -1;

        // Find header row in Conta Azul report
        for (let i = 0; i < Math.min(rawData.length, 50); i++) {
          const row = rawData[i];
          if (!Array.isArray(row)) continue;
          const rowStr = row.map(c => normalize(String(c || '')));
          
          const hasSupplier = rowStr.includes('CLIENTE/FORNECEDOR') || rowStr.includes('FORNECEDOR');
          const hasCategory = rowStr.includes('CATEGORIA');

          if (hasSupplier && hasCategory) {
            headerIndex = i;
            rowStr.forEach((val, idx) => {
              if (val) colMap[val] = idx;
            });
            // Ensure we have a mapping for variations
            if (rowStr.includes('FORNECEDOR') && !colMap['CLIENTE/FORNECEDOR']) {
              colMap['CLIENTE/FORNECEDOR'] = rowStr.indexOf('FORNECEDOR');
            }
            break;
          }
        }

        if (headerIndex === -1) {
          reject(new Error('Formato de histórico Conta Azul não reconhecido. Colunas "Fornecedor" e "Categoria" não encontradas. Tente exportar o relatório de lançamentos financeiros.'));
          return;
        }

        const historyMap: Record<string, string> = {};
        const rows = rawData.slice(headerIndex + 1);

        rows.forEach(row => {
          const supplierIdx = colMap['CLIENTE/FORNECEDOR'] || colMap['FORNECEDOR'];
          const categoryIdx = colMap['CATEGORIA'];
          const descIdx = colMap['DESCRICAO'] || colMap['DESCRIÇÃO'];
          
          let supplier = String(row[supplierIdx] || '').trim();
          const description = descIdx !== undefined ? String(row[descIdx] || '').trim() : '';
          const category = String(row[categoryIdx] || '').trim();
          
          // Fallback to description if supplier is empty
          if (!supplier && description) {
            supplier = description;
          }
          
          if (supplier && category && category !== 'Categoria não definida' && category !== 'Outros') {
            historyMap[supplier] = category;
          }
        });

        resolve(historyMap);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function exportToContaAzul(data: ProcessedRow[]) {
  // Function to remove special characters as per Conta Azul instructions
  const sanitize = (text: string) => {
    if (!text) return '';
    // Conta Azul formula avoids characters that are not basic alphanumeric and common punctuation
    return text.toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-zA-Z0-9\s\-\/\.\(\)\_\,\:\;]/g, ' ') // Keep only safe chars, replace others with space
      .replace(/\s+/g, ' ') // Remove double spaces
      .trim();
  };

  // Prepare data rows matching the exact template columns
  const rows = data.map(row => ({
    [CONTA_AZUL_HEADERS[0]]: row.emissao,
    [CONTA_AZUL_HEADERS[1]]: row.vencimento,
    [CONTA_AZUL_HEADERS[2]]: '', // Data de Pagamento
    [CONTA_AZUL_HEADERS[3]]: row.valor,
    [CONTA_AZUL_HEADERS[4]]: sanitize(row.categoria),
    [CONTA_AZUL_HEADERS[5]]: sanitize(row.documento),
    [CONTA_AZUL_HEADERS[6]]: sanitize(row.fornecedor),
    [CONTA_AZUL_HEADERS[7]]: '', // CNPJ/CPF
    [CONTA_AZUL_HEADERS[8]]: '', // Centro de Custo
    [CONTA_AZUL_HEADERS[9]]: 'Importado via DataSync' // Observações
  }));

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: CONTA_AZUL_HEADERS,
    skipHeader: false
  });

  // Force column types and formats
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    // Data columns (Indices 0, 1, 2)
    [0, 1, 2].forEach(C => {
      const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v) {
        cell.t = 'd';
        cell.z = 'dd/mm/yyyy';
      }
    });

    // Valor (Index 3)
    const cellValor = worksheet[XLSX.utils.encode_cell({ r: R, c: 3 })];
    if (cellValor) {
      cellValor.t = 'n';
      cellValor.z = '#,##0.00';
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contas a Pagar');

  XLSX.writeFile(workbook, 'importacao_conta_azul_datasync.xlsx');
}
