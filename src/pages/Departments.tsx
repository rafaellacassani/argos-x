import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Building2, Plus, Star, Trash2, Edit, Bot, ArrowRightLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDepartments, type Department, type CreateDepartmentInput } from "@/hooks/useDepartments";
import { useAIAgents } from "@/hooks/useAIAgents";

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#14b8a6", "#6366f1"];

export default function Departments() {
  const { departments, isLoading, createDepartment, updateDepartment, deleteDepartment, assignAgentToDepartment } = useDepartments();
  const { agents } = useAIAgents();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<CreateDepartmentInput>({ name: "", description: "", color: "#3b82f6", is_reception: false });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", color: "#3b82f6", is_reception: false });
    setDialogOpen(true);
  };
  const openEdit = (d: Department) => {
    setEditing(d);
    setForm({ name: d.name, description: d.description || "", color: d.color || "#3b82f6", is_reception: d.is_reception });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editing) {
      await updateDepartment.mutateAsync({ id: editing.id, ...form });
    } else {
      await createDepartment.mutateAsync(form);
    }
    setDialogOpen(false);
  };

  const agentsByDept = (deptId: string) => agents.filter((a: any) => a.department_id === deptId);
  const unassignedAgents = agents.filter((a: any) => !a.department_id);
  const agentsNotInDept = (deptId: string) => agents.filter((a: any) => a.department_id !== deptId);

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <Helmet>
        <title>Departamentos de IA — Argos X</title>
        <meta name="description" content="Organize seus agentes de IA por departamento e configure transferências automáticas entre eles." />
      </Helmet>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="w-7 h-7 text-primary" />
            Departamentos de IA
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Agrupe suas agentes por departamento (Recepção, Suporte, Financeiro...) e elas vão transferir
            atendimentos entre si automaticamente quando o cliente precisar.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Novo Departamento
        </Button>
      </div>

      {/* Como funciona */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold">Como funciona</p>
              <p className="text-muted-foreground">
                <strong>1.</strong> Crie departamentos (ex: Recepção, Suporte, Financeiro). <strong>2.</strong> Vincule cada agente
                de IA a um departamento. <strong>3.</strong> Marque <Star className="w-3 h-3 inline text-amber-500" /> qual é a
                <strong> Recepção</strong> (recebe os primeiros contatos). <strong>4.</strong> Quando o cliente perguntar algo
                fora do escopo, a IA transfere sozinha para o departamento certo, sem perder o histórico.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : departments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-lg font-semibold">Nenhum departamento ainda</p>
            <p className="text-muted-foreground mt-1 mb-4">Crie o primeiro para começar a organizar suas agentes</p>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" /> Criar Departamento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => {
            const deptAgents = agentsByDept(dept.id);
            return (
              <Card key={dept.id} className="relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: dept.color || "#3b82f6" }} />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        {dept.is_reception && (
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                        )}
                        <span className="truncate">{dept.name}</span>
                      </CardTitle>
                      {dept.description && (
                        <CardDescription className="mt-1 line-clamp-2">{dept.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(dept)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir "{dept.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Os agentes deste departamento ficarão sem departamento, mas continuam funcionando normalmente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteDepartment.mutate(dept.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  {dept.is_reception && (
                    <Badge variant="secondary" className="w-fit gap-1">
                      <Star className="w-3 h-3" /> Recepção (porta de entrada)
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Agentes vinculados ({deptAgents.length})</Label>
                    {deptAgents.length === 0 ? (
                      <p className="text-sm text-muted-foreground mt-1 italic">Nenhum agente vinculado</p>
                    ) : (
                      <div className="space-y-1 mt-1">
                        {deptAgents.map((a: any) => (
                          <div key={a.id} className="flex items-center justify-between gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                            <span className="flex items-center gap-1.5 min-w-0">
                              <Bot className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                              <span className="truncate">{a.name}</span>
                            </span>
                            <Button
                              size="sm" variant="ghost" className="h-6 px-2 text-xs"
                              onClick={() => assignAgentToDepartment.mutate({ agentId: a.id, departmentId: null })}
                            >
                              Remover
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {agents.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Você ainda não criou nenhum agente. Vá em <strong>Agentes IA</strong> para criar.
                    </p>
                  ) : agentsNotInDept(dept.id).length > 0 ? (
                    <div>
                      <Select
                        value=""
                        onValueChange={(agentId) => assignAgentToDepartment.mutate({ agentId, departmentId: dept.id })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="+ Adicionar agente" />
                        </SelectTrigger>
                        <SelectContent>
                          {agentsNotInDept(dept.id).map((a: any) => {
                            const otherDept = departments.find((d) => d.id === a.department_id);
                            return (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                                {otherDept ? ` (mover de ${otherDept.name})` : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Todos os agentes já estão neste departamento.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sem departamento */}
      {unassignedAgents.length > 0 && departments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agentes sem departamento ({unassignedAgents.length})</CardTitle>
            <CardDescription>Estes agentes funcionam de forma independente, sem participar das transferências automáticas.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {unassignedAgents.map((a: any) => (
                <Badge key={a.id} variant="outline" className="gap-1.5">
                  <Bot className="w-3 h-3" /> {a.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar departamento" : "Novo departamento"}</DialogTitle>
            <DialogDescription>
              Defina nome, descrição e cor. A descrição será usada pela IA para decidir quando transferir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dept-name">Nome *</Label>
              <Input
                id="dept-name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Suporte, Financeiro, Comercial"
              />
            </div>
            <div>
              <Label htmlFor="dept-desc">Descrição (o que esse departamento faz)</Label>
              <Textarea
                id="dept-desc" value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Cuida de cobranças, dúvidas sobre pagamento, segunda via de boleto..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                A IA usa essa descrição para decidir quando transferir o cliente para cá.
              </p>
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c} type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500" /> Departamento de Recepção
                </Label>
                <p className="text-xs text-muted-foreground">
                  Recebe o primeiro contato dos clientes. Apenas 1 departamento pode ser recepção.
                </p>
              </div>
              <Switch
                checked={!!form.is_reception}
                onCheckedChange={(v) => setForm({ ...form, is_reception: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
