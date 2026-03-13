'use client';

import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  Settings2,
  ChevronRight,
  ArrowLeft,
  Bell,
  User,
  Cloud,
  Info,
  Database,
  Filter,
  Repeat
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  processDataCarFile, 
  processContaAzulHistory,
  exportToContaAzul, 
  type ProcessedRow 
} from '@/lib/excel-processor';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

import Sidebar from './Sidebar';

const STORAGE_KEY_PREFIX = 'datacar_map_';
const STORES_KEY = 'datacar_stores';
const LAST_STORE_KEY = 'datacar_last_store';

type Step = 'dashboard' | 'import' | 'mapping' | 'training' | 'settings' | 'help';

export default function DataCarConverter() {
  const [step, setStep] = useState<Step>('dashboard');
  const [data, setData] = useState<ProcessedRow[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [availableStores, setAvailableStores] = useState<string[]>(['Loja Padrão']);
  const [selectedStore, setSelectedStore] = useState<string>('Loja Padrão');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load stores and last selected store
  useEffect(() => {
    let stores = ['Loja Padrão'];
    const savedStores = localStorage.getItem(STORES_KEY);
    if (savedStores) {
      try {
        const parsed = JSON.parse(savedStores);
        if (Array.isArray(parsed) && parsed.length > 0) {
          stores = parsed;
          setAvailableStores(parsed);
        }
      } catch (e) {
        console.error('Failed to parse stores', e);
      }
    }

    const lastStore = localStorage.getItem(LAST_STORE_KEY);
    if (lastStore && stores.includes(lastStore)) {
      setSelectedStore(lastStore);
    }
  }, []);

  // Load category map for the selected store
  useEffect(() => {
    const storageKey = `${STORAGE_KEY_PREFIX}${selectedStore}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setCategoryMap(JSON.parse(saved));
      } catch (e) {
        console.error(`Failed to parse category map for ${selectedStore}`, e);
        setCategoryMap({});
      }
    } else {
      setCategoryMap({});
    }
    
    // Save last store
    localStorage.setItem(LAST_STORE_KEY, selectedStore);
  }, [selectedStore]);

  // Save category map to localStorage
  const saveCategoryMap = (newMap: Record<string, string>) => {
    setCategoryMap(newMap);
    const storageKey = `${STORAGE_KEY_PREFIX}${selectedStore}`;
    localStorage.setItem(storageKey, JSON.stringify(newMap));
  };

  const updateStores = (newStores: string[]) => {
    setAvailableStores(newStores);
    localStorage.setItem(STORES_KEY, JSON.stringify(newStores));
  };

  // Clear messages on step change
  useEffect(() => {
    setError(null);
    setSuccessMessage(null);
  }, [step]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const processed = await processDataCarFile(file, categoryMap);
      if (processed.length === 0) {
        setError('O arquivo foi lido, mas nenhuma linha de dados válida foi encontrada. Verifique se o arquivo contém lançamentos com Fornecedor, Vencimento e Valor.');
      } else {
        setData(processed);
        setStep('mapping');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar o arquivo. Certifique-se de que é um arquivo Excel válido do DataCar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHistoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const historyMap = await processContaAzulHistory(file);
      const newMap = { ...categoryMap, ...historyMap };
      saveCategoryMap(newMap);
      
      const count = Object.keys(historyMap).length;
      setSuccessMessage(`Sucesso! Foram aprendidas ${count} novas regras de categorias com base no seu histórico.`);
      
      // If we have data loaded, re-process it with the new map
      if (data.length > 0) {
        setData(prev => prev.map(row => {
          const newCategory = historyMap[row.fornecedor] || row.categoria;
          return {
            ...row,
            categoria: newCategory,
            status: newCategory === 'Categoria não definida' ? 'PENDENTE' : 'OK'
          };
        }));
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar o histórico.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateRowCategory = (id: string, fornecedor: string, newCategory: string) => {
    // Update current data
    setData(prev => prev.map(row => 
      row.id === id ? { ...row, categoria: newCategory, status: newCategory === 'Categoria não definida' ? 'PENDENTE' : 'OK' } : row
    ));

    // Update map for future imports
    if (newCategory !== 'Categoria não definida') {
      saveCategoryMap({ ...categoryMap, [fornecedor]: newCategory });
    }
  };

  const handleExport = () => {
    exportToContaAzul(data);
  };

  const clearCategoryMap = () => {
    if (window.confirm(`Tem certeza que deseja limpar toda a base de conhecimento da ${selectedStore}? Esta ação não pode ser desfeita.`)) {
      setCategoryMap({});
      const storageKey = `${STORAGE_KEY_PREFIX}${selectedStore}`;
      localStorage.removeItem(storageKey);
      setSuccessMessage(`Base de conhecimento da ${selectedStore} limpa com sucesso.`);
    }
  };

  const exportKnowledgeBase = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(categoryMap, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "datasync_knowledge_base.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importKnowledgeBase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        const newMap = { ...categoryMap, ...imported };
        saveCategoryMap(newMap);
        setSuccessMessage('Base de conhecimento importada com sucesso.');
      } catch (err) {
        setError('Erro ao importar arquivo. Certifique-se de que é um JSON válido.');
      }
    };
    reader.readAsText(file);
  };

  const fillAllPending = () => {
    const defaultCategory = 'Outros';
    setData(prev => prev.map(row => 
      row.status === 'PENDENTE' 
        ? { ...row, categoria: defaultCategory, status: 'OK' as const } 
        : row
    ));
    
    // Also update the category map for these suppliers if they don't have one
    const newMap = { ...categoryMap };
    data.forEach(row => {
      if (row.status === 'PENDENTE' && !newMap[row.fornecedor]) {
        newMap[row.fornecedor] = defaultCategory;
      }
    });
    saveCategoryMap(newMap);
  };

  const filteredData = data.filter(row => 
    row.fornecedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.documento.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCount = data.filter(r => r.status === 'PENDENTE').length;

  const renderContent = () => {
    switch (step) {
      case 'dashboard':
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="bg-[var(--card)] p-12 rounded-3xl shadow-sm border border-[var(--border)] max-w-2xl">
              <h2 className="text-3xl font-bold mb-4 text-[var(--foreground)]">Bem-vindo ao DataSync</h2>
              <p className="text-[var(--text-secondary)] mb-8">
                Sua ferramenta central para conversão e sincronização de dados financeiros entre DataCar e Conta Azul.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={() => setStep('import')}
                  className="p-6 bg-[var(--background)] border border-[var(--border)] rounded-2xl hover:border-[#0EA5E9] hover:bg-[#F0F9FF] transition-all text-left group"
                >
                  <Upload className="w-8 h-8 text-[#0EA5E9] mb-3" />
                  <h3 className="font-bold text-[var(--foreground)] group-hover:text-[#0EA5E9]">Importar Dados</h3>
                  <p className="text-xs text-[var(--text-secondary)]">Comece processando um novo arquivo DataCar.</p>
                </button>
                <button 
                  onClick={() => setStep('training')}
                  className="p-6 bg-[var(--background)] border border-[var(--border)] rounded-2xl hover:border-[#0EA5E9] hover:bg-[#F0F9FF] transition-all text-left group"
                >
                  <Settings2 className="w-8 h-8 text-[#0EA5E9] mb-3" />
                  <h3 className="font-bold text-[var(--foreground)] group-hover:text-[#0EA5E9]">Treinar IA</h3>
                  <p className="text-xs text-[var(--text-secondary)]">Melhore o reconhecimento de categorias.</p>
                </button>
              </div>
            </div>
          </div>
        );

      case 'import':
        return (
          <motion.div 
            key="import"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center min-h-[60vh]"
          >
            <div className="w-full max-w-2xl bg-[var(--card)] p-12 rounded-3xl shadow-sm border border-[var(--border)] text-center">
              <div className="mb-8 inline-flex items-center justify-center w-20 h-20 bg-[#F0F9FF] dark:bg-[#0EA5E910] rounded-full">
                <Upload className="w-10 h-10 text-[#0EA5E9]" />
              </div>
              <h2 className="text-3xl font-bold mb-4 text-[var(--foreground)]">Importar Relatório DataCar</h2>
              <p className="text-[var(--text-secondary)] mb-10 text-lg">
                Selecione o arquivo Excel (.xlsx) exportado do DataCar para iniciar a conversão.
              </p>

              <label className="relative group cursor-pointer inline-block w-full">
                <div className="bg-[#10B981] hover:bg-[#059669] text-white font-bold py-5 px-10 rounded-2xl transition-all shadow-md flex items-center justify-center gap-3 text-xl">
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6" />
                      <span>Selecionar Arquivo DataCar</span>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".xlsx, .xls" 
                  onChange={handleFileUpload}
                  disabled={isLoading}
                />
              </label>

              {error && (
                <div className="mt-8 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}
            </div>
          </motion.div>
        );

      case 'mapping':
        if (data.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="bg-[var(--card)] p-12 rounded-3xl shadow-sm border border-[var(--border)] max-w-md">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[var(--foreground)] mb-2">Nenhum dado carregado</h3>
                <p className="text-[var(--text-secondary)] mb-6">Você precisa importar um arquivo DataCar antes de realizar o mapeamento.</p>
                <button 
                  onClick={() => setStep('import')}
                  className="bg-[#0EA5E9] text-white px-6 py-2 rounded-xl font-bold hover:bg-[#0284C7] transition-all"
                >
                  Ir para Importação
                </button>
              </div>
            </div>
          );
        }
        return (
          <motion.div 
            key="mapping"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-2xl font-bold text-[var(--foreground)]">Mapeamento de Lançamentos</h2>
              
              <div className="flex items-center gap-4 w-full md:w-auto">
                <button 
                  onClick={() => { setData([]); setStep('import'); setSearchTerm(''); }}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-all"
                  title="Limpar dados atuais e importar novo arquivo"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Limpar</span>
                </button>
                <div className="relative flex-1 md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                  <input 
                    type="text"
                    placeholder="Buscar fornecedor ou documento..."
                    className="w-full pl-10 pr-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleExport}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all shadow-sm bg-[#10B981] hover:bg-[#059669] text-white"
                >
                  <Download className="w-4 h-4" />
                  Exportar para Conta Azul
                </button>
              </div>
            </div>

            {pendingCount > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-800">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-medium">
                    Existem <strong>{pendingCount}</strong> lançamentos com categoria pendente.
                  </p>
                </div>
                <button 
                  onClick={fillAllPending}
                  className="text-xs font-bold bg-amber-200 hover:bg-amber-300 text-amber-900 px-4 py-2 rounded-lg transition-colors"
                >
                  Definir todos pendentes como &quot;Outros&quot;
                </button>
              </div>
            )}

            <div className="bg-[var(--card)] rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
                <table className="w-full text-left border-collapse table-fixed min-w-[1200px]">
                  <thead>
                    <tr className="bg-[var(--background)] border-b border-[var(--border)] font-bold text-[var(--text-secondary)]">
                      <th className="w-[28%] px-6 py-4 text-xs uppercase tracking-wider">Fornecedor</th>
                      <th className="w-[18%] px-6 py-4 text-xs uppercase tracking-wider">Documento</th>
                      <th className="w-[12%] px-6 py-4 text-xs uppercase tracking-wider">Vencimento</th>
                      <th className="w-[12%] px-6 py-4 text-xs uppercase tracking-wider">Valor</th>
                      <th className="w-[20%] px-6 py-4 text-xs uppercase tracking-wider">Categoria</th>
                      <th className="w-[10%] px-6 py-4 text-xs uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredData.map((row) => (
                      <tr key={row.id} className="hover:bg-[var(--background)] transition-colors group">
                        <td className="px-6 py-4 font-medium text-[var(--foreground)] break-words">{row.fornecedor}</td>
                        <td className="px-6 py-4 text-[var(--text-secondary)] break-words">{row.documento}</td>
                        <td className="px-6 py-4 text-[var(--text-secondary)] whitespace-nowrap">{formatDate(row.vencimento)}</td>
                        <td className="px-6 py-4 font-bold text-[var(--foreground)] whitespace-nowrap">{formatCurrency(row.valor)}</td>
                        <td className="px-6 py-4">
                          <input 
                            type="text"
                            placeholder="Defina a categoria..."
                            value={row.categoria}
                            onChange={(e) => updateRowCategory(row.id, row.fornecedor, e.target.value)}
                            className={cn(
                              "w-full px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] transition-all text-sm",
                              row.status === 'PENDENTE' ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                            )}
                          />
                        </td>
                        <td className="px-6 py-4">
                          {row.status === 'OK' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3" />
                              OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 whitespace-nowrap">
                              <AlertCircle className="w-3 h-3" />
                              Pendente
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredData.length === 0 && (
                <div className="p-12 text-center text-[var(--text-secondary)]">
                  Nenhum resultado encontrado para sua busca.
                </div>
              )}
            </div>
          </motion.div>
        );

      case 'training':
        const ruleCount = Object.keys(categoryMap).length;
        return (
          <motion.div 
            key="training"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Training Card */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] p-12 flex flex-col items-center justify-center text-center relative overflow-hidden group min-h-[300px]">
                  <div className="absolute inset-0 border-2 border-dashed border-[var(--border)] m-6 rounded-2xl pointer-events-none group-hover:border-[#0EA5E9] transition-colors" />
                  
                  <label className="cursor-pointer flex flex-col items-center gap-6 relative z-10">
                    <div className="w-20 h-20 bg-[#F0F9FF] dark:bg-[#0EA5E910] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Cloud className="w-10 h-10 text-[#0EA5E9]" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-[var(--foreground)] mb-2">Treinar via Planilha Histórica</h3>
                      <p className="text-[var(--text-secondary)]">Importe exportações do Conta Azul para aprender em massa.</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".xlsx, .xls" 
                      onChange={handleHistoryUpload}
                    />
                  </label>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                )}

                {successMessage && (
                  <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3 text-green-700">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{successMessage}</p>
                  </div>
                )}
              </div>

              {/* Sidebar Cards */}
              <div className="space-y-6">
                {/* How it works */}
                <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-[#F0F9FF] dark:bg-[#0EA5E910] rounded-lg">
                      <Info className="w-5 h-5 text-[#0EA5E9]" />
                    </div>
                    <h3 className="font-bold text-[var(--foreground)]">Como funciona?</h3>
                  </div>
                  <ul className="space-y-4">
                    {[
                      { step: 1, text: 'O sistema lê as colunas "Fornecedor" e "Categoria".' },
                      { step: 2, text: 'Ele cria um vínculo inteligente entre eles.' },
                      { step: 3, text: 'Nas próximas importações Datalog, a categoria será preenchida automaticamente.' }
                    ].map((item) => (
                      <li key={item.step} className="flex gap-3 text-sm">
                        <span className="font-bold text-[#0EA5E9]">{item.step}.</span>
                        <span className="text-[var(--text-secondary)] leading-relaxed">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Data Intelligence */}
                <div className="bg-[#0F172A] rounded-3xl p-6 text-white">
                  <h3 className="font-bold mb-2">Inteligência de Dados</h3>
                  <p className="text-xs text-[#94A3B8] mb-8">Seu banco de dados atual possui:</p>
                  
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-bold">Mapeamentos</span>
                        <span className="text-2xl font-bold">{ruleCount}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#0EA5E9] rounded-full transition-all duration-1000" 
                          style={{ width: `${Math.min((ruleCount / 100) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-[10px] italic text-[#94A3B8]">Precisão estimada: 94%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Knowledge Base */}
            <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] overflow-hidden">
              <div className="p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--border)]">
                <h3 className="text-xl font-bold text-[var(--foreground)]">Base de Conhecimento</h3>
                <div className="relative w-full sm:w-80">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                  <input 
                    type="text"
                    placeholder="Filtrar fornecedor..."
                    className="w-full pl-10 pr-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] transition-all text-sm text-[var(--foreground)]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest border-b border-[var(--border)]">
                      <th className="px-8 py-4">Fornecedor / Cliente</th>
                      <th className="px-8 py-4">Categoria Associada</th>
                      <th className="px-8 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {Object.entries(categoryMap)
                      .filter(([f]) => f.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(([fornecedor, categoria]) => (
                        <tr key={fornecedor} className="hover:bg-[var(--background)] transition-colors group">
                          <td className="px-8 py-4 font-bold text-[var(--foreground)]">{fornecedor}</td>
                          <td className="px-8 py-4">
                            <span className="px-3 py-1 bg-[#F0F9FF] dark:bg-[#0EA5E910] text-[#0EA5E9] rounded-lg text-xs font-bold">
                              {categoria}
                            </span>
                          </td>
                          <td className="px-8 py-4 text-right">
                            <button 
                              onClick={() => {
                                const newMap = { ...categoryMap };
                                delete newMap[fornecedor];
                                saveCategoryMap(newMap);
                              }}
                              className="p-2 text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {Object.keys(categoryMap).length === 0 && (
                  <div className="p-20 text-center">
                    <div className="w-16 h-16 bg-[var(--background)] rounded-full flex items-center justify-center mx-auto mb-4">
                      <Database className="w-8 h-8 text-[var(--border)]" />
                    </div>
                    <p className="text-[var(--text-secondary)] text-sm max-w-xs mx-auto">
                      Nenhum mapeamento aprendido ainda. Importe uma planilha ou adicione manualmente.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );

      case 'settings':
        return (
          <motion.div 
            key="settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-4xl space-y-8"
          >
            <div>
              <h2 className="text-3xl font-bold text-[var(--foreground)] mb-2">Configurações</h2>
              <p className="text-[var(--text-secondary)]">Gerencie as preferências do sistema e sua base de conhecimento.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Knowledge Base Management */}
              <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-[#F0F9FF] dark:bg-[#0EA5E910] rounded-lg">
                    <Database className="w-5 h-5 text-[#0EA5E9]" />
                  </div>
                  <h3 className="font-bold text-[var(--foreground)]">Base de Conhecimento</h3>
                </div>
                
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Exporte seus mapeamentos para backup ou importe de outro dispositivo.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={exportKnowledgeBase}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--foreground)] hover:bg-[var(--background)] transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Exportar JSON
                  </button>
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--foreground)] hover:bg-[var(--background)] transition-all">
                    <Upload className="w-4 h-4" />
                    Importar JSON
                    <input type="file" className="hidden" accept=".json" onChange={importKnowledgeBase} />
                  </label>
                </div>

                <div className="pt-6 border-t border-[var(--border)]">
                  <button 
                    onClick={clearCategoryMap}
                    className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-bold transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Limpar toda a base de conhecimento
                  </button>
                </div>
              </div>

              <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-[#F0F9FF] dark:bg-[#0EA5E910] rounded-lg">
                    <Repeat className="w-5 h-5 text-[#0EA5E9]" />
                  </div>
                  <h3 className="font-bold text-[var(--foreground)]">Gerenciar Lojas</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      id="new-store-name"
                      type="text"
                      placeholder="Nome da nova loja..."
                      className="flex-1 px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] text-[var(--foreground)]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val && !availableStores.includes(val)) {
                            updateStores([...availableStores, val]);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    <button 
                      onClick={() => {
                        const input = document.getElementById('new-store-name') as HTMLInputElement;
                        const val = input.value.trim();
                        if (val && !availableStores.includes(val)) {
                          updateStores([...availableStores, val]);
                          input.value = '';
                        }
                      }}
                      className="px-4 py-2 bg-[#0EA5E9] text-white rounded-xl text-sm font-bold hover:bg-[#0284C7] transition-all"
                    >
                      Adicionar
                    </button>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                    {availableStores.map(store => (
                      <div key={store} className="flex items-center justify-between p-2 bg-[var(--background)] rounded-lg text-sm border border-[var(--border)]">
                        <span className="font-medium">{store}</span>
                        {availableStores.length > 1 && (
                          <button 
                            onClick={() => {
                              if (window.confirm(`Tem certeza que deseja remover a loja "${store}"? Todos os mapeamentos dela serão perdidos.`)) {
                                const newStores = availableStores.filter(s => s !== store);
                                updateStores(newStores);
                                if (selectedStore === store) setSelectedStore(newStores[0]);
                                localStorage.removeItem(`${STORAGE_KEY_PREFIX}${store}`);
                              }
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* General Preferences */}
              <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-[#F0F9FF] dark:bg-[#0EA5E910] rounded-lg">
                    <Settings2 className="w-5 h-5 text-[#0EA5E9]" />
                  </div>
                  <h3 className="font-bold text-[var(--foreground)]">Preferências Gerais</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-[var(--foreground)] mb-2">Categoria Padrão</label>
                    <select className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] text-[var(--foreground)]">
                      <option>Outros</option>
                      <option>Despesas Administrativas</option>
                      <option>Serviços Prestados</option>
                    </select>
                    <p className="mt-1 text-[10px] text-[var(--text-secondary)]">Usada quando nenhuma regra é encontrada.</p>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-bold text-[var(--foreground)]">Auto-preenchimento</p>
                      <p className="text-xs text-[var(--text-secondary)]">Preencher categorias ao importar</p>
                    </div>
                    <div className="w-12 h-6 bg-[#10B981] rounded-full relative cursor-pointer">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 'help':
        return (
          <motion.div 
            key="help"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-3xl space-y-6"
          >
            <h2 className="text-2xl font-bold text-[var(--foreground)]">Ajuda e Suporte</h2>
            <div className="bg-[var(--card)] rounded-2xl shadow-sm border border-[var(--border)] p-8 space-y-8">
              <section>
                <h3 className="text-lg font-bold text-[var(--foreground)] mb-3">Como funciona?</h3>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  O DataSync automatiza a transferência de dados do sistema DataCar para o Conta Azul. 
                  Ele lê seus relatórios de contas a pagar, identifica fornecedores e valores, e permite que você exporte tudo em um formato compatível com o Conta Azul.
                </p>
              </section>
              <section>
                <h3 className="text-lg font-bold text-[var(--foreground)] mb-3">Passo a passo</h3>
                <ol className="list-decimal list-inside space-y-3 text-[var(--text-secondary)]">
                  <li>Exporte o relatório de Contas a Pagar do DataCar em formato Excel.</li>
                  <li>Vá em <strong>Importar Dados</strong> e selecione o arquivo.</li>
                  <li>Na tela de <strong>Mapeamento</strong>, confira os dados e defina as categorias.</li>
                  <li>Clique em <strong>Exportar para Conta Azul</strong> para baixar o arquivo.</li>
                </ol>
              </section>
              <section className="pt-6 border-t border-[var(--border)]">
                <p className="text-sm text-[var(--text-secondary)]">
                  Precisa de mais ajuda? Entre em contato com o suporte técnico: suporte@dinheiroemcaixa.com.br
                </p>
              </section>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Sidebar 
        currentStep={step} 
        onStepChange={setStep} 
        selectedStore={selectedStore}
        onStoreChange={setSelectedStore}
        availableStores={availableStores}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-20 bg-[var(--card)] border-b border-[var(--border)] flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input 
              type="text"
              placeholder="Pesquisar transações..."
              className="w-full pl-11 pr-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] transition-all text-sm text-[var(--foreground)]"
            />
          </div>

          <div className="flex items-center gap-6">
            <button className="relative p-2 text-[var(--text-secondary)] hover:bg-[var(--background)] rounded-xl transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-[var(--card)]" />
            </button>
            
            <div className="h-8 w-px bg-[var(--border)]" />

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-[var(--foreground)]">Financeiro Adm</p>
                <p className="text-[10px] text-[var(--text-secondary)]">suporte@dinheiroemcaixa.com.br</p>
              </div>
              <div className="w-10 h-10 bg-[var(--background)] rounded-xl flex items-center justify-center border border-[var(--border)]">
                <User className="w-5 h-5 text-[var(--text-secondary)]" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
        </main>
        
        <footer className="py-6 px-8 text-center text-[var(--text-secondary)] text-xs border-t border-[var(--border)] bg-[var(--card)]">
          <p>© {new Date().getFullYear()} DataSync • Ferramenta de Automação Financeira</p>
        </footer>
      </div>
    </div>
  );
}
