import { BotNode, BotEdge, BotFlowData } from '@/hooks/useSalesBots';
import { MessageSquare, UserCheck, CalendarDays, RefreshCw, Heart } from 'lucide-react';

export interface BotTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  iconName: 'MessageSquare' | 'UserCheck' | 'CalendarDays' | 'RefreshCw' | 'Heart';
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  flow_data: BotFlowData;
}

function n(id: string, type: string, x: number, y: number, data: Record<string, unknown>): BotNode {
  return { id, type, position: { x, y }, data };
}

function e(id: string, source: string, target: string, label?: string): BotEdge {
  return { id, source, target, ...(label ? { label } : {}) };
}

export const botTemplates: BotTemplate[] = [
  {
    id: 'welcome',
    name: 'Boas-vindas',
    description: 'Recebe novos contatos com mensagem de boas-vindas e direciona para atendimento.',
    category: 'Atendimento',
    iconName: 'MessageSquare',
    trigger_type: 'new_lead',
    trigger_config: {},
    flow_data: {
      nodes: [
        n('n1', 'send_message', 100, 50, {
          message: 'Olá, {{lead.name}}! 👋 Aqui é da [Empresa]. Como posso te ajudar hoje?\n\n1️⃣ Conhecer produtos\n2️⃣ Falar com atendente\n3️⃣ Horários e endereço',
        }),
        n('n2', 'condition', 100, 200, { field: 'last_message', operator: 'contains', value: 'produto' }),
        n('n3', 'send_message', 0, 370, { message: 'Ótimo! Temos várias opções. Vou te passar nosso catálogo 📋' }),
        n('n4', 'round_robin', 300, 370, { users: [], currentIndex: 0 }),
        n('n5', 'tag', 100, 520, { action: 'add', tag_name: 'novo-contato' }),
        n('n6', 'stop', 100, 660, {}),
      ],
      edges: [
        e('e1', 'n1', 'n2'),
        e('e2', 'n2', 'n3', 'true'),
        e('e3', 'n2', 'n4', 'false'),
        e('e4', 'n3', 'n5'),
        e('e5', 'n4', 'n5'),
        e('e6', 'n5', 'n6'),
      ],
    },
  },
  {
    id: 'qualification',
    name: 'Qualificação de Lead',
    description: 'Faz perguntas para qualificar o lead automaticamente e distribui para vendedores.',
    category: 'Vendas',
    iconName: 'UserCheck',
    trigger_type: 'new_lead',
    trigger_config: {},
    flow_data: {
      nodes: [
        n('n1', 'send_message', 100, 50, {
          message: 'Olá! Para te atender melhor, me conta: qual é o seu maior desafio hoje com [área do negócio]?',
        }),
        n('n2', 'wait', 100, 200, { wait_for: 'message', wait_mode: 'wait_message' }),
        n('n3', 'send_message', 100, 340, {
          message: 'Entendido! E qual é o tamanho da sua equipe?\n\n1️⃣ 1-5 pessoas\n2️⃣ 6-20 pessoas\n3️⃣ Mais de 20',
        }),
        n('n4', 'wait', 100, 490, { wait_for: 'message', wait_mode: 'wait_message' }),
        n('n5', 'condition', 100, 630, { field: 'last_message', operator: 'contains', value: '20' }),
        n('n6a', 'tag', 0, 800, { action: 'add', tag_name: 'lead-quente' }),
        n('n6b', 'tag', 300, 800, { action: 'add', tag_name: 'lead-frio' }),
        n('n7', 'send_message', 100, 950, {
          message: 'Perfeito! Um dos nossos especialistas vai entrar em contato em breve. 🚀',
        }),
        n('n8', 'round_robin', 100, 1100, { users: [], currentIndex: 0 }),
        n('n9', 'stop', 100, 1240, {}),
      ],
      edges: [
        e('e1', 'n1', 'n2'),
        e('e2', 'n2', 'n3'),
        e('e3', 'n3', 'n4'),
        e('e4', 'n4', 'n5'),
        e('e5', 'n5', 'n6a', 'true'),
        e('e6', 'n5', 'n6b', 'false'),
        e('e7', 'n6a', 'n7'),
        e('e8', 'n6b', 'n7'),
        e('e9', 'n7', 'n8'),
        e('e10', 'n8', 'n9'),
      ],
    },
  },
  {
    id: 'scheduling',
    name: 'Agendamento',
    description: 'Coleta preferências de horário do cliente e agenda automaticamente.',
    category: 'Vendas',
    iconName: 'CalendarDays',
    trigger_type: 'keyword',
    trigger_config: { keyword: 'agendar' },
    flow_data: {
      nodes: [
        n('n1', 'send_message', 100, 50, {
          message: 'Ótimo, vamos agendar! 📅 Qual período te atende melhor?\n\n1️⃣ Manhã (9h-12h)\n2️⃣ Tarde (13h-17h)\n3️⃣ Qualquer horário',
        }),
        n('n2', 'wait', 100, 200, { wait_for: 'message', wait_mode: 'wait_message' }),
        n('n3', 'send_message', 100, 340, {
          message: 'Perfeito! E qual dia da semana você prefere? (ex: segunda, terça...)',
        }),
        n('n4', 'wait', 100, 480, { wait_for: 'message', wait_mode: 'wait_message' }),
        n('n5', 'add_note', 100, 620, { note: 'Cliente quer agendar. Preferência informada na conversa.' }),
        n('n6', 'tag', 100, 760, { action: 'add', tag_name: 'agendamento-solicitado' }),
        n('n7', 'move_stage', 100, 900, { stage_name: 'Agendado' }),
        n('n8', 'send_message', 100, 1040, {
          message: 'Anotado! ✅ Nossa equipe vai confirmar seu agendamento em breve.',
        }),
        n('n9', 'round_robin', 100, 1180, { users: [], currentIndex: 0 }),
        n('n10', 'stop', 100, 1320, {}),
      ],
      edges: [
        e('e1', 'n1', 'n2'),
        e('e2', 'n2', 'n3'),
        e('e3', 'n3', 'n4'),
        e('e4', 'n4', 'n5'),
        e('e5', 'n5', 'n6'),
        e('e6', 'n6', 'n7'),
        e('e7', 'n7', 'n8'),
        e('e8', 'n8', 'n9'),
        e('e9', 'n9', 'n10'),
      ],
    },
  },
  {
    id: 'followup',
    name: 'Follow-up Automático',
    description: 'Envia mensagens de acompanhamento quando o lead não responde.',
    category: 'Retenção',
    iconName: 'RefreshCw',
    trigger_type: 'message_received',
    trigger_config: {},
    flow_data: {
      nodes: [
        n('n1', 'wait', 100, 50, { seconds: 3600, wait_mode: 'timer', duration: 1, unit: 'hours' }),
        n('n2', 'send_message', 100, 200, {
          message: 'Oi {{lead.name}}! Ainda está por aí? 😊 Posso te ajudar com alguma dúvida?',
        }),
        n('n3', 'wait', 100, 350, { seconds: 86400, wait_mode: 'timer', duration: 24, unit: 'hours' }),
        n('n4', 'send_message', 100, 500, {
          message: 'Olá! Não quero perder o contato. Se surgir qualquer dúvida sobre nossos serviços, é só chamar. Até mais! 👋',
        }),
        n('n5', 'tag', 100, 650, { action: 'add', tag_name: 'follow-up-enviado' }),
        n('n6', 'stop', 100, 800, {}),
      ],
      edges: [
        e('e1', 'n1', 'n2'),
        e('e2', 'n2', 'n3'),
        e('e3', 'n3', 'n4'),
        e('e4', 'n4', 'n5'),
        e('e5', 'n5', 'n6'),
      ],
    },
  },
  {
    id: 'post_sale',
    name: 'Pós-venda',
    description: 'Acompanha o cliente após a compra e coleta feedback de satisfação.',
    category: 'Retenção',
    iconName: 'Heart',
    trigger_type: 'stage_change',
    trigger_config: {},
    flow_data: {
      nodes: [
        n('n1', 'send_message', 100, 50, {
          message: 'Parabéns pela sua compra, {{lead.name}}! 🎉 Ficamos muito felizes em tê-lo como cliente.',
        }),
        n('n2', 'wait', 100, 200, { seconds: 172800, wait_mode: 'timer', duration: 48, unit: 'hours' }),
        n('n3', 'send_message', 100, 350, {
          message: 'Oi {{lead.name}}! Tudo certo com seu pedido? Ficou com alguma dúvida?\n\n1️⃣ Sim, tudo ótimo! 😊\n2️⃣ Tenho uma dúvida',
        }),
        n('n4', 'condition', 100, 520, { field: 'last_message', operator: 'contains', value: 'dúvida' }),
        n('n5a', 'round_robin', 0, 690, { users: [], currentIndex: 0 }),
        n('n5a_msg', 'send_message', 0, 840, {
          message: 'Vou te conectar com nossa equipe agora!',
        }),
        n('n5b', 'tag', 300, 690, { action: 'add', tag_name: 'cliente-satisfeito' }),
        n('n6', 'stop', 100, 980, {}),
      ],
      edges: [
        e('e1', 'n1', 'n2'),
        e('e2', 'n2', 'n3'),
        e('e3', 'n3', 'n4'),
        e('e4', 'n4', 'n5a', 'true'),
        e('e5', 'n4', 'n5b', 'false'),
        e('e6', 'n5a', 'n5a_msg'),
        e('e7', 'n5a_msg', 'n6'),
        e('e8', 'n5b', 'n6'),
      ],
    },
  },
];
