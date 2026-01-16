import { useState } from "react";
import { motion } from "framer-motion";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  Plus,
  MoreHorizontal,
  MessageCircle,
  Phone,
  Mail,
  Calendar,
  User,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Lead {
  id: string;
  name: string;
  company?: string;
  phone: string;
  email?: string;
  source: string;
  value?: number;
  createdAt: string;
}

interface Column {
  id: string;
  title: string;
  color: string;
  leads: Lead[];
}

const initialColumns: Column[] = [
  {
    id: "entrada",
    title: "Leads de Entrada",
    color: "bg-secondary",
    leads: [
      { id: "1", name: "João Silva", company: "Tech Solutions", phone: "+55 11 99999-0001", source: "WhatsApp", value: 5000, createdAt: "2 min" },
      { id: "2", name: "Maria Santos", phone: "+55 11 99999-0002", source: "WhatsApp", createdAt: "15 min" },
      { id: "3", name: "Pedro Costa", company: "Digital Agency", phone: "+55 11 99999-0003", email: "pedro@email.com", source: "Site", value: 12000, createdAt: "1h" },
    ],
  },
  {
    id: "contato",
    title: "Em Contato",
    color: "bg-warning",
    leads: [
      { id: "4", name: "Ana Oliveira", company: "StartupXYZ", phone: "+55 11 99999-0004", email: "ana@startup.com", source: "Instagram", value: 8000, createdAt: "3h" },
      { id: "5", name: "Carlos Lima", phone: "+55 11 99999-0005", source: "WhatsApp", createdAt: "5h" },
    ],
  },
  {
    id: "qualificado",
    title: "Qualificado",
    color: "bg-primary",
    leads: [
      { id: "6", name: "Fernanda Rocha", company: "E-commerce Plus", phone: "+55 11 99999-0006", email: "fer@ecommerce.com", source: "Indicação", value: 25000, createdAt: "1d" },
    ],
  },
  {
    id: "proposta",
    title: "Proposta Enviada",
    color: "bg-inboxia-blue",
    leads: [
      { id: "7", name: "Ricardo Mendes", company: "Consultoria ABC", phone: "+55 11 99999-0007", email: "ricardo@abc.com", source: "Site", value: 18000, createdAt: "2d" },
    ],
  },
  {
    id: "fechado",
    title: "Fechado",
    color: "bg-success",
    leads: [
      { id: "8", name: "Patricia Alves", company: "Marketing Pro", phone: "+55 11 99999-0008", email: "patricia@marketing.com", source: "WhatsApp", value: 30000, createdAt: "3d" },
    ],
  },
];

export default function Leads() {
  const [columns, setColumns] = useState(initialColumns);

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceColIndex = columns.findIndex((col) => col.id === source.droppableId);
    const destColIndex = columns.findIndex((col) => col.id === destination.droppableId);

    const sourceCol = columns[sourceColIndex];
    const destCol = columns[destColIndex];

    const sourceLeads = [...sourceCol.leads];
    const destLeads = source.droppableId === destination.droppableId ? sourceLeads : [...destCol.leads];

    const [removed] = sourceLeads.splice(source.index, 1);

    if (source.droppableId === destination.droppableId) {
      sourceLeads.splice(destination.index, 0, removed);
      const newColumns = [...columns];
      newColumns[sourceColIndex] = { ...sourceCol, leads: sourceLeads };
      setColumns(newColumns);
    } else {
      destLeads.splice(destination.index, 0, removed);
      const newColumns = [...columns];
      newColumns[sourceColIndex] = { ...sourceCol, leads: sourceLeads };
      newColumns[destColIndex] = { ...destCol, leads: destLeads };
      setColumns(newColumns);
    }
  };

  const getTotalValue = (leads: Lead[]) => {
    return leads.reduce((sum, lead) => sum + (lead.value || 0), 0);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Pipeline de Leads</h1>
          <p className="text-muted-foreground">Arraste os leads entre as etapas do funil</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Lead
        </Button>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max h-full">
            {columns.map((column) => (
              <div
                key={column.id}
                className="w-80 flex-shrink-0 flex flex-col bg-muted/30 rounded-xl"
              >
                {/* Column Header */}
                <div className="p-4 border-b border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${column.color}`} />
                      <h3 className="font-semibold text-foreground">{column.title}</h3>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                        {column.leads.length}
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Editar etapa</DropdownMenuItem>
                        <DropdownMenuItem>Adicionar lead</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Excluir etapa</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {getTotalValue(column.leads) > 0 && (
                    <p className="text-sm text-muted-foreground">
                      R$ {getTotalValue(column.leads).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>

                {/* Cards */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-2 space-y-2 overflow-y-auto scrollbar-thin transition-colors ${
                        snapshot.isDraggingOver ? "bg-secondary/5" : ""
                      }`}
                    >
                      {column.leads.map((lead, index) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`inboxia-card p-4 cursor-grab active:cursor-grabbing transition-shadow ${
                                snapshot.isDragging ? "shadow-inboxia-lg ring-2 ring-secondary/30" : ""
                              }`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold text-sm">
                                    {lead.name.split(" ").map((n) => n[0]).join("")}
                                  </div>
                                  <div>
                                    <p className="font-medium text-foreground">{lead.name}</p>
                                    {lead.company && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Building className="w-3 h-3" />
                                        {lead.company}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <span className="text-xs text-muted-foreground">{lead.createdAt}</span>
                              </div>

                              <div className="space-y-1.5 mb-3">
                                <p className="text-xs text-muted-foreground flex items-center gap-2">
                                  <Phone className="w-3 h-3" />
                                  {lead.phone}
                                </p>
                                {lead.email && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                                    <Mail className="w-3 h-3" />
                                    {lead.email}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-xs bg-secondary/10 text-secondary px-2 py-1 rounded-full">
                                  {lead.source}
                                </span>
                                {lead.value && (
                                  <span className="text-sm font-semibold text-success">
                                    R$ {lead.value.toLocaleString("pt-BR")}
                                  </span>
                                )}
                              </div>

                              {/* Quick Actions */}
                              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50">
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MessageCircle className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Phone className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Calendar className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* Add Lead Button */}
                <div className="p-2">
                  <Button variant="ghost" className="w-full justify-start text-muted-foreground">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar lead
                  </Button>
                </div>
              </div>
            ))}

            {/* Add Column Button */}
            <div className="w-80 flex-shrink-0">
              <Button
                variant="outline"
                className="w-full h-full min-h-[200px] border-dashed border-2 text-muted-foreground hover:text-foreground hover:border-secondary"
              >
                <Plus className="w-5 h-5 mr-2" />
                Nova Etapa
              </Button>
            </div>
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}
