import React from 'react';
import { 
  LayoutDashboard, 
  CloudUpload, 
  Map, 
  History, 
  Settings, 
  HelpCircle,
  Repeat
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  currentStep: string;
  onStepChange: (step: any) => void;
}

export default function Sidebar({ currentStep, onStepChange }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'PRINCIPAL' },
    { id: 'import', label: 'Importar Datalog', icon: CloudUpload, section: 'PRINCIPAL' },
    { id: 'mapping', label: 'Mapeamento', icon: Map, section: 'PRINCIPAL' },
    { id: 'training', label: 'Treinar Categorias', icon: History, section: 'PRINCIPAL' },
    { id: 'settings', label: 'Configurações', icon: Settings, section: 'CONFIGURAÇÕES' },
    { id: 'help', label: 'Ajuda', icon: HelpCircle, section: 'CONFIGURAÇÕES' },
  ];

  const sections = ['PRINCIPAL', 'CONFIGURAÇÕES'];

  return (
    <aside className="w-64 bg-[var(--card)] border-r border-[var(--border)] flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="bg-[#1D4ED8] p-2 rounded-xl">
          <Repeat className="w-6 h-6 text-white" />
        </div>
        <span className="text-2xl font-bold text-[var(--foreground)]">DataSync</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-8 overflow-y-auto">
        {sections.map(section => (
          <div key={section} className="space-y-2">
            <h3 className="px-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-4">
              {section}
            </h3>
            <div className="space-y-1">
              {menuItems
                .filter(item => item.section === section)
                .map(item => {
                  const Icon = item.icon;
                  const isActive = currentStep === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onStepChange(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all group",
                        isActive 
                          ? "bg-[#EEF2FF] text-[#1D4ED8]" 
                          : "text-[var(--text-secondary)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                      )}
                    >
                      <Icon className={cn(
                        "w-5 h-5 transition-colors",
                        isActive ? "text-[#1D4ED8]" : "text-[var(--text-secondary)] group-hover:text-[var(--foreground)]"
                      )} />
                      {item.label}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      {/* Status */}
      <div className="p-4 mt-auto">
        <div className="bg-[var(--background)] rounded-2xl p-4 border border-[var(--border)]">
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Status do Sistema</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-bold text-[var(--foreground)]">Operacional</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
