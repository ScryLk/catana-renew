/**
 * 🎯 Context Selector Component
 *
 * Componente para alternar entre Organizações e Sedes.
 * Implementa as regras:
 * - Organização é quem você é (fixa no topo)
 * - Sede é de onde você opera (alternável)
 * - Mostra claramente qual contexto está ativo
 */
import { type FC, useState, useEffect, useRef } from 'react';
import { Building2, MapPin, ChevronDown, Star, Check } from 'lucide-react';
import { organizationService } from '@/services/organizationService';
import type { Organization, Sede } from '@/types/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const ContextSelector: FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Estado ativo (localStorage)
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [activeSede, setActiveSede] = useState<Sede | null>(null);

  // Load organizations on mount
  useEffect(() => {
    loadOrganizations();
    loadActiveContext();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadOrganizations = async () => {
    try {
      const data = await organizationService.getOrganizations();
      setOrganizations(data);
    } catch (error) {
      console.error('Erro ao carregar organizações:', error);
    }
  };

  const loadActiveContext = () => {
    try {
      const orgStored = localStorage.getItem('active_organization');
      const sedeStored = localStorage.getItem('active_sede');

      if (orgStored) {
        setActiveOrg(JSON.parse(orgStored));
      }
      if (sedeStored) {
        setActiveSede(JSON.parse(sedeStored));
      }
    } catch (error) {
      console.error('Erro ao carregar contexto ativo:', error);
    }
  };

  const handleSelectOrganization = (org: Organization) => {
    localStorage.setItem('active_organization', JSON.stringify(org));
    setActiveOrg(org);

    // Auto-select default sede if available
    if (org.default_sede && org.sedes) {
      const defaultSede = org.sedes.find(s => s.id === org.default_sede);
      if (defaultSede) {
        localStorage.setItem('active_sede', JSON.stringify(defaultSede));
        setActiveSede(defaultSede);
      } else {
        localStorage.removeItem('active_sede');
        setActiveSede(null);
      }
    } else {
      localStorage.removeItem('active_sede');
      setActiveSede(null);
    }

    toast.success(`Organização alterada para "${org.name}"`);
    setIsOpen(false);

    // Reload page to update context
    setTimeout(() => window.location.reload(), 300);
  };

  const handleSelectSede = (sede: Sede) => {
    if (activeSede?.id === sede.id) {
      // Deselect if already active
      localStorage.removeItem('active_sede');
      setActiveSede(null);
      toast.info('Sede desmarcada');
    } else {
      localStorage.setItem('active_sede', JSON.stringify(sede));
      setActiveSede(sede);
      toast.success(`Operando a partir de "${sede.name}"`);
    }

    setIsOpen(false);

    // Reload page to update context
    setTimeout(() => window.location.reload(), 300);
  };

  // Find active org in list to show sedes
  const currentOrg = organizations.find(o => o.id === activeOrg?.id);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 outline-none border",
          isOpen
            ? "bg-zinc-800 border-zinc-700 shadow-lg"
            : "bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700"
        )}
      >
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-violet-400" />
          <div className="flex flex-col items-start">
            <span className="text-xs font-medium text-zinc-100">
              {activeOrg?.name || 'Selecione uma organização'}
            </span>
            {activeSede && (
              <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {activeSede.name}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-zinc-500 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200 z-50">
          {/* Header */}
          <div className="p-3 border-b border-zinc-800 bg-zinc-900/50">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Contexto Ativo
            </p>
          </div>

          {/* Organizations List */}
          <div className="p-2 max-h-96 overflow-y-auto">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-3 py-2">
              Organizações
            </p>
            <div className="space-y-1">
              {organizations.map(org => (
                <div key={org.id} className="space-y-1">
                  {/* Organization Item */}
                  <button
                    onClick={() => handleSelectOrganization(org)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer text-left",
                      activeOrg?.id === org.id
                        ? "bg-violet-500/10 border border-violet-500/20"
                        : "hover:bg-zinc-800 border border-transparent"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      activeOrg?.id === org.id ? "bg-violet-500/20" : "bg-zinc-800"
                    )}>
                      {org.logo ? (
                        <img src={org.logo} alt={org.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <span className="text-sm font-bold text-violet-400">
                          {org.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        activeOrg?.id === org.id ? "text-violet-400" : "text-zinc-300"
                      )}>
                        {org.name}
                      </p>
                      {org.default_sede && (
                        <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                          Inicia em: {org.sedes?.find(s => s.id === org.default_sede)?.name}
                        </p>
                      )}
                    </div>
                    {activeOrg?.id === org.id && (
                      <Check className="w-4 h-4 text-violet-400 shrink-0" />
                    )}
                  </button>

                  {/* Sedes List (only show if org is active) */}
                  {activeOrg?.id === org.id && currentOrg?.sedes && currentOrg.sedes.length > 0 && (
                    <div className="ml-6 pl-3 border-l-2 border-zinc-800 space-y-1 py-1">
                      <p className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider px-2 py-1">
                        Sedes
                      </p>
                      {currentOrg.sedes.map(sede => {
                        const isDefault = currentOrg.default_sede === sede.id;
                        return (
                          <button
                            key={sede.id}
                            onClick={() => handleSelectSede(sede)}
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer text-left text-xs",
                              activeSede?.id === sede.id
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : "hover:bg-zinc-800 text-zinc-400 border border-transparent"
                            )}
                          >
                            <MapPin className={cn(
                              "w-3 h-3 shrink-0",
                              activeSede?.id === sede.id ? "text-blue-400" : "text-zinc-500"
                            )} />
                            <span className="flex-1 truncate">{sede.name}</span>
                            {isDefault && (
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />
                            )}
                            {activeSede?.id === sede.id && (
                              <Check className="w-3 h-3 text-blue-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-zinc-800 bg-zinc-900/50">
            <button
              onClick={() => {
                window.location.href = '/organizations';
              }}
              className="w-full px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer text-center"
            >
              Gerenciar Organizações e Sedes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
