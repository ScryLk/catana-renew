import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { organizationService } from '@/services/organizationService';
import type { Organization, Sede } from '@/types/api';
import { Building2, Plus, Loader2, Trash2, MapPin, Settings, Share2, Users, Star, Shield } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { LoadingScreen } from '../components/common/LoadingScreen';

export const Organizations: FC = () => {
    const { user } = useAuthStore();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Check if user is admin
    const isAdmin = user?.role === 'admin';
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Sede states
    const [showCreateSedeDialog, setShowCreateSedeDialog] = useState(false);
    const [newSedeName, setNewSedeName] = useState('');
    const [isCreatingSede, setIsCreatingSede] = useState(false);
    const [showSedeSettings, setShowSedeSettings] = useState<Sede | null>(null);
    const [sedeShares, setSedeShares] = useState<any[]>([]);

    // Org Settings states
    const [showOrgSettingsDialog, setShowOrgSettingsDialog] = useState(false);
    const [orgToEdit, setOrgToEdit] = useState<Organization | null>(null);
    const [isSavingOrgSettings, setIsSavingOrgSettings] = useState(false);

    useEffect(() => {
        loadOrganizations();
    }, []);

    // Load shares when opening settings
    useEffect(() => {
        if (showSedeSettings) {
            loadSedeShares(showSedeSettings.id);
        }
    }, [showSedeSettings]);

    const loadSedeShares = async (sedeId: number) => {
        try {
            const sent = await organizationService.getShares(sedeId, 'sent');
            const received = await organizationService.getShares(sedeId, 'received');
            setSedeShares([...sent, ...received]);
        } catch (error) {
            console.error(error);
        }
    }

    const handleCreateShare = async (targetSedeId: string) => {
        if (!showSedeSettings || !targetSedeId) return;
        try {
            await organizationService.createShare({
                source_sede: showSedeSettings.id,
                target_sede: parseInt(targetSedeId),
                resource_type: 'all',
                permission_level: 'read'
            });
            loadSedeShares(showSedeSettings.id);
        } catch (error) {
            console.error(error);
        }
    }

    const loadOrganizations = async () => {
        try {
            setIsLoading(true);
            const data = await organizationService.getOrganizations();
            setOrganizations(data);
        } catch (error) {
            console.error('Erro ao carregar organizações:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateOrganization = async () => {
        if (!newOrgName.trim()) return;

        try {
            setIsCreating(true);
            await organizationService.createOrganization({ name: newOrgName });
            await loadOrganizations();
            setShowCreateDialog(false);
            setNewOrgName('');
        } catch (error) {
            console.error('Erro ao criar organização:', error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteOrganization = async (id: number) => {
        if (!confirm('Tem certeza que deseja deletar esta organização?')) return;
        try {
            setIsLoading(true);
            await organizationService.deleteOrganization(id);
            await loadOrganizations();
            // If deleted org was active, clear storage
            if (activeOrgId === id) {
                localStorage.removeItem('active_organization');
                localStorage.removeItem('active_sede');
                window.location.reload();
            }
        } catch (error) {
            console.error('Erro ao deletar organização:', error);
        } finally {
            setIsLoading(false);
        }
    }

    const handleSelectOrganization = (org: Organization) => {
        localStorage.setItem('active_organization', JSON.stringify(org));

        // Auto-select Default Sede if available
        if (org.default_sede && org.sedes) {
            const defaultSede = org.sedes.find(s => s.id === org.default_sede);
            if (defaultSede) {
                localStorage.setItem('active_sede', JSON.stringify(defaultSede));
            } else {
                localStorage.removeItem('active_sede');
            }
        } else {
            localStorage.removeItem('active_sede');
        }

        window.location.reload();
    };

    // Sede handlers
    const handleCreateSede = async () => {
        if (!newSedeName.trim() || !activeOrgId) return;
        try {
            setIsCreatingSede(true);
            await organizationService.createSede(activeOrgId, { name: newSedeName });
            await loadOrganizations(); // Reload to get updated sedes list
            setShowCreateSedeDialog(false);
            setNewSedeName('');
        } catch (error) {
            console.error('Erro ao criar sede:', error);
        } finally {
            setIsCreatingSede(false);
        }
    };

    const handleDeleteSede = async (id: number) => {
        if (!confirm('Tem certeza que deseja deletar esta sede?')) return;
        try {
            await organizationService.deleteSede(id);
            await loadOrganizations();
            if (activeSedeId === id) {
                localStorage.removeItem('active_sede');
                window.location.reload();
            }
        } catch (error) {
            console.error('Erro ao deletar sede:', error);
        }
    };

    const handleSaveOrgSettings = async (defaultSedeId: number | null) => {
        if (!orgToEdit) return;
        try {
            setIsSavingOrgSettings(true);
            await organizationService.updateOrganization(orgToEdit.id, {
                default_sede: defaultSedeId || undefined // undefined if null to maybe clear? check backend model null=True
            } as any); // Type assertion if needed or update Partial<Organization> properly
            await loadOrganizations();
            setShowOrgSettingsDialog(false);
            setOrgToEdit(null);
        } catch (error) {
            console.error('Erro ao salvar configurações da organização:', error);
        } finally {
            setIsSavingOrgSettings(false);
        }
    };

    const handleToggleDefaultSede = async (sedeId: number) => {
        if (!activeOrgId) return;

        try {
            const currentDefault = organizations.find(o => o.id === activeOrgId)?.default_sede;
            const newDefault = currentDefault === sedeId ? null : sedeId; // Toggle

            // Optimistic update (optional, but good for UX) - forcing visual update
            // Ideally we wait for load, but let's just wait for load.

            await organizationService.updateOrganization(activeOrgId, {
                default_sede: newDefault || undefined
            } as any);

            await loadOrganizations();

            // Update active_sede in localStorage if we just SET a default and it wasn't set?
            // User requested: "Clicou, virou padrão." -> "Click, becomes default".
            // If I just set it as default, should I SWITCH to it immediately if I am currently viewing the Org?
            // The user is ALREADY viewing the Org (Sedes list is visible).
            // But the *active_sede* variable in component state/storage might be different.
            // If I set "Sede B" as default, but I am currently "active" in "Sede A".
            // Does strictly "setting default" mean "switch to it"?
            // Usually "Default" implies "start with this next time".
            // But "Favorite" (Star) implies "I like this one".
            // I'll stick to: Updates the configuration. I won't force-switch the *current view* immediately unless user clicks the card.
            // EXCEPT: If I unset it.

        } catch (error) {
            console.error('Erro ao definir sede padrão:', error);
        }
    };

    const handleSelectSede = (sede: Sede) => {
        if (activeSedeId === sede.id) {
            // Deselect if already active
            localStorage.removeItem('active_sede');
        } else {
            localStorage.setItem('active_sede', JSON.stringify(sede));
        }
        window.location.reload();
    };


    const activeOrgId = JSON.parse(localStorage.getItem('active_organization') || '{}').id;
    const activeSedeId = JSON.parse(localStorage.getItem('active_sede') || '{}').id;

    const activeOrg = organizations.find(o => o.id === activeOrgId);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            <Sidebar />
            <Header title={activeOrg?.sedes?.find(s => s.id === activeSedeId)?.name || activeOrg?.name || "Gerenciamento"} />

            <main className="ml-16 pt-20">
                <div className="p-6 max-w-4xl mx-auto space-y-8">
                    {/* Organizations Section */}
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h1 className="text-3xl font-bold text-foreground mb-2">Organizações</h1>
                                <p className="text-muted-foreground">Gerencie suas organizações e espaços de trabalho</p>
                            </div>
                            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                                <Plus className="h-4 w-4" />
                                Nova Organização
                            </Button>
                        </div>

                        {isLoading ? (
                            <LoadingScreen message="Carregando organizações..." />
                        ) : organizations.length === 0 ? (
                            <div className="text-center py-20 bg-card rounded-xl border">
                                <div className="bg-muted rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                                    <Building2 className="h-10 w-10 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground mb-2">
                                    Nenhuma organização encontrada
                                </h3>
                                <p className="text-muted-foreground mb-4">
                                    Crie sua primeira organização para começar
                                </p>
                                <Button onClick={() => setShowCreateDialog(true)}>
                                    Criar Organização
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {organizations.map(org => (
                                    <div
                                        key={org.id}
                                        className={`bg-card p-6 rounded-xl border flex items-center justify-between group cursor-pointer transition-all ${activeOrgId === org.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'}`}
                                        onClick={() => handleSelectOrganization(org)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                                                {org.logo ? (
                                                    <img src={org.logo} alt={org.name} className="w-full h-full object-cover rounded-lg" />
                                                ) : (
                                                    <span className="text-xl font-bold text-primary">{org.name.charAt(0).toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold">{org.name} {activeOrgId === org.id && <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Ativa</span>}</h3>
                                                <p className="text-sm text-muted-foreground">Criado em {new Date(org.created_at).toLocaleDateString()}</p>
                                                {org.default_sede && (
                                                    <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md w-fit">
                                                        <Star className="h-3 w-3 fill-amber-500" />
                                                        Inicia em: {org.sedes?.find(s => s.id === org.default_sede)?.name}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setOrgToEdit(org); setShowOrgSettingsDialog(true); }} className="text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800">
                                                <Settings className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteOrganization(org.id); }} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sedes Section */}
                    {activeOrg && (
                        <div className="pt-8 border-t">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-foreground mb-2">Sedes / Filiais</h2>
                                    <p className="text-muted-foreground">Gerencie as sedes da organização <strong>{activeOrg.name}</strong></p>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (!isAdmin) {
                                            toast.error('Apenas administradores podem criar sedes', {
                                                description: 'Entre em contato com um admin da organização.'
                                            });
                                            return;
                                        }
                                        setShowCreateSedeDialog(true);
                                    }}
                                    className="gap-2"
                                    disabled={!isAdmin}
                                >
                                    <Plus className="h-4 w-4" />
                                    Nova Sede
                                    {!isAdmin && <Shield className="h-3 w-3 ml-1 text-amber-500" />}
                                </Button>
                            </div>

                            {/* Admin Warning */}
                            {!isAdmin && (
                                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                                    <Shield className="h-4 w-4 shrink-0" />
                                    <p>Apenas administradores podem criar e gerenciar sedes.</p>
                                </div>
                            )}

                            {!activeOrg.sedes || activeOrg.sedes.length === 0 ? (
                                <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed">
                                    <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                                    <p className="text-muted-foreground mb-4">Nenhuma sede cadastrada</p>
                                    <Button variant="secondary" size="sm" onClick={() => setShowCreateSedeDialog(true)}>
                                        Adicionar Sede
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {activeOrg.sedes.map(sede => {
                                        const isDefault = activeOrg.default_sede === sede.id;
                                        return (
                                            <div
                                                key={sede.id}
                                                className={`p-4 rounded-lg border cursor-pointer transition-all flex justify-between items-center group
                                                ${activeSedeId === sede.id ? 'ring-2 ring-primary bg-primary/5' : ''}
                                                ${isDefault ? 'border-amber-500/40 dark:border-amber-500/30 bg-amber-500/5' : 'bg-card hover:border-primary/50'}
                                            `}
                                                onClick={() => handleSelectSede(sede)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <MapPin className={`h-5 w-5 ${activeSedeId === sede.id ? 'text-primary' : 'text-primary/70'}`} />
                                                    <span className={`font-medium truncate ${isDefault ? 'text-amber-700 dark:text-amber-400' : ''}`}>{sede.name}</span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className={`h-8 w-8 ${isDefault ? 'text-amber-500 hover:text-amber-600' : 'text-muted-foreground hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity'}`}
                                                        onClick={(e) => { e.stopPropagation(); handleToggleDefaultSede(sede.id); }}
                                                        title={isDefault ? "Remover padrão" : "Definir como padrão"}
                                                    >
                                                        <Star className={`h-4 w-4 ${isDefault ? 'fill-amber-500' : ''}`} />
                                                    </Button>

                                                    {activeSedeId === sede.id ? (
                                                        <span className="text-[10px] uppercase font-bold tracking-wider bg-primary/20 text-primary border border-primary/20 px-2 py-0.5 rounded-full mr-2">
                                                            Ativa
                                                        </span>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs px-3 border-primary/20 text-primary hover:bg-primary/10 mr-2"
                                                            onClick={(e) => { e.stopPropagation(); handleSelectSede(sede); }}
                                                        >
                                                            Ativar
                                                        </Button>
                                                    )}

                                                    <div className="flex items-center border-l border-zinc-200 dark:border-zinc-800 pl-2 gap-1">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setShowSedeSettings(sede); }}>
                                                            <Settings className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className={`h-7 w-7 ${activeSedeId === sede.id ? 'text-red-500 hover:bg-red-50' : 'text-muted-foreground hover:text-red-500'}`} onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDeleteSede(sede.id); }}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                            }
                        </div>
                    )}
                </div>
            </main>

            {/* Create Org Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="border border-white/10" style={{ backgroundColor: '#1f1f1f' }}>
                    <DialogHeader>
                        <DialogTitle>Nova Organização</DialogTitle>
                        <DialogDescription>
                            Crie uma nova organização para gerenciar seus projetos e equipe.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            placeholder="Nome da Organização"
                            value={newOrgName}
                            onChange={(e) => setNewOrgName(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
                        <Button onClick={handleCreateOrganization} disabled={isCreating || !newOrgName.trim()}>
                            {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Criar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Sede Settings Dialog */}
            <Dialog open={!!showSedeSettings} onOpenChange={(open: boolean) => !open && setShowSedeSettings(null)}>
                <DialogContent className="max-w-2xl border border-white/10 shadow-xl" style={{ backgroundColor: '#1f1f1f' }}>
                    <DialogHeader>
                        <DialogTitle>Configurações da Sede: {showSedeSettings?.name}</DialogTitle>
                        <DialogDescription>Gerencie membros e compartilhamentos</DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="sharing" className="w-full">
                        <TabsList className="bg-[#2a2a2a] w-full grid grid-cols-2 gap-2 p-1">
                            <TabsTrigger value="sharing" className="data-[state=active]:bg-[#1f1f1f] data-[state=active]:text-primary data-[state=active]:shadow-sm">Compartilhamento</TabsTrigger>
                            <TabsTrigger value="members" className="data-[state=active]:bg-[#1f1f1f] data-[state=active]:text-primary data-[state=active]:shadow-sm">Membros</TabsTrigger>
                        </TabsList>

                        <TabsContent value="sharing" className="space-y-4 pt-4">
                            {(!showSedeSettings?.members_count || showSedeSettings?.members_count === 0) && (
                                <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg flex items-start gap-3">
                                    <div className="p-1 bg-yellow-500/20 rounded-full mt-0.5">
                                        <Users className="h-4 w-4 text-yellow-500" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-sm font-medium text-yellow-500 mb-1">Sem membros associados</h4>
                                        <p className="text-sm text-yellow-500/80 mb-2">
                                            Esta sede não possui nenhum membro. Adicione usuários na aba de "Membros" para que eles tenham acesso.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-6">
                                {/* New Share Section */}
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-foreground">Novo Compartilhamento</h3>
                                    <div className="bg-muted p-4 rounded-lg border border-white/5">
                                        <label className="text-xs font-medium text-muted-foreground mb-2 block">Selecione a Sede (Leitura Completa)</label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input text-foreground px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            style={{ backgroundColor: '#1f1f1f' }}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleCreateShare(e.target.value)}
                                            value=""
                                        >
                                            <option value="" disabled>Selecionar Sede...</option>
                                            {activeOrg?.sedes?.filter((s: Sede) => s.id !== showSedeSettings?.id).map((s: Sede) => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Active Shares Section */}
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-foreground">Compartilhamentos Ativos</h3>
                                    <div className="min-h-[100px] rounded-lg border border-white/5 bg-card p-4">
                                        {sedeShares.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full py-4 text-muted-foreground">
                                                <Share2 className="h-8 w-8 mb-2 opacity-20" />
                                                <p className="text-sm">Nenhum compartilhamento ativo.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {sedeShares.map(share => (
                                                    <div key={share.id} className="flex justify-between items-center p-3 border rounded-md bg-background/50 hover:bg-background transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-primary/20 p-1.5 rounded-full">
                                                                <Share2 className="h-3 w-3 text-primary" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-medium">
                                                                    {share.source_sede === showSedeSettings?.id
                                                                        ? `Para: ${activeOrg?.sedes?.find(s => s.id === share.target_sede)?.name || `#${share.target_sede}`}`
                                                                        : `De: ${activeOrg?.sedes?.find(s => s.id === share.source_sede)?.name || `#${share.source_sede}`}`}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground capitalize">{share.resource_type} • {share.permission_level === 'read' ? 'Leitura' : 'Escrita'}</span>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                                            onClick={() => organizationService.deleteShare(share.id).then(() => showSedeSettings && loadSedeShares(showSedeSettings.id))}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="members" className="space-y-4 pt-4">
                            <div className="text-center py-8 text-muted-foreground">
                                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Gerenciamento de membros em breve</p>
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* Create Sede Dialog */}
            <Dialog open={showCreateSedeDialog} onOpenChange={setShowCreateSedeDialog}>
                <DialogContent className="border border-white/10" style={{ backgroundColor: '#1f1f1f' }}>
                    <DialogHeader>
                        <DialogTitle>Nova Sede</DialogTitle>
                        <DialogDescription>
                            Adicione uma nova sede para a organização <strong>{activeOrg?.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            placeholder="Nome da Sede"
                            value={newSedeName}
                            onChange={(e) => setNewSedeName(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateSedeDialog(false)}>Cancelar</Button>
                        <Button onClick={handleCreateSede} disabled={isCreatingSede || !newSedeName.trim()}>
                            {isCreatingSede ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Criar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Org Settings Dialog */}
            <Dialog open={showOrgSettingsDialog} onOpenChange={setShowOrgSettingsDialog}>
                <DialogContent style={{ backgroundColor: '#1f1f1f' }}>
                    <DialogHeader>
                        <DialogTitle>Configurações da Organização</DialogTitle>
                        <DialogDescription>
                            Configure as preferências para {orgToEdit?.name}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Sede Padrão</label>
                            <select
                                className="w-full p-2 rounded-md border bg-background"
                                value={orgToEdit?.default_sede || ''}
                                onChange={(e) => {
                                    if (orgToEdit) {
                                        setOrgToEdit({
                                            ...orgToEdit,
                                            default_sede: e.target.value ? Number(e.target.value) : undefined
                                        });
                                    }
                                }}
                                style={{ backgroundColor: '#1f1f1f' }}
                            >
                                <option value="">Nenhuma (Seleção manual)</option>
                                {orgToEdit?.sedes?.map(sede => (
                                    <option key={sede.id} value={sede.id}>{sede.name}</option>
                                ))}
                            </select>
                            <p className="text-xs text-muted-foreground">
                                Esta sede será selecionada automaticamente ao entrar na organização.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowOrgSettingsDialog(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={() => handleSaveOrgSettings(orgToEdit?.default_sede || null)} disabled={isSavingOrgSettings}>
                            {isSavingOrgSettings ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                'Salvar'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
