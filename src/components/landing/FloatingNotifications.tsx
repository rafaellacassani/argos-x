import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarCheck,
  CreditCard,
  MapPin,
  Bell,
  MessageCircle,
  ThumbsUp,
  Clock,
  FileText,
  UserCheck,
  Star,
  Stethoscope,
  Home,
  ShoppingBag,
  Heart,
} from "lucide-react";

interface Notification {
  id: number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  nicho: string;
  nichoColor: string;
  title: string;
  message: string;
  time: string;
}

const notifications: Notification[] = [
  {
    id: 1,
    icon: CalendarCheck,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
    nicho: "Dentista",
    nichoColor: "bg-emerald-100 text-emerald-700",
    title: "Consulta confirmada ✅",
    message: "Paciente Ana Silva confirmou a limpeza para amanhã às 14h.",
    time: "agora",
  },
  {
    id: 2,
    icon: CreditCard,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
    nicho: "Vendedor",
    nichoColor: "bg-blue-100 text-blue-700",
    title: "Comprovante recebido 💰",
    message: "Cliente enviou comprovante de R$2.400 via Pix. Pedido #1847 liberado.",
    time: "2 min",
  },
  {
    id: 3,
    icon: MapPin,
    iconColor: "text-violet-600",
    iconBg: "bg-violet-50",
    nicho: "Imobiliária",
    nichoColor: "bg-violet-100 text-violet-700",
    title: "Endereço enviado 📍",
    message: "IA enviou localização do imóvel na Av. Paulista para visita às 16h.",
    time: "5 min",
  },
  {
    id: 4,
    icon: Bell,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50",
    nicho: "Terapeuta",
    nichoColor: "bg-amber-100 text-amber-700",
    title: "Lembrete automático 🔔",
    message: "Lembrete enviado: \"Sua sessão é amanhã às 10h. Confirma?\"",
    time: "8 min",
  },
  {
    id: 5,
    icon: UserCheck,
    iconColor: "text-cyan-600",
    iconBg: "bg-cyan-50",
    nicho: "Dentista",
    nichoColor: "bg-emerald-100 text-emerald-700",
    title: "Lead qualificado 🎯",
    message: "Novo paciente qualificado: quer implante, tem convênio, disponível manhãs.",
    time: "12 min",
  },
  {
    id: 6,
    icon: MessageCircle,
    iconColor: "text-green-600",
    iconBg: "bg-green-50",
    nicho: "Vendedor",
    nichoColor: "bg-blue-100 text-blue-700",
    title: "IA respondeu sozinha 🤖",
    message: "\"Sim, temos frete grátis acima de R$150. Posso gerar o link de pagamento?\"",
    time: "15 min",
  },
  {
    id: 7,
    icon: Home,
    iconColor: "text-rose-600",
    iconBg: "bg-rose-50",
    nicho: "Imobiliária",
    nichoColor: "bg-violet-100 text-violet-700",
    title: "Visita agendada 🏠",
    message: "Cliente João agendou visita ao apartamento 302 para sábado, 10h.",
    time: "18 min",
  },
  {
    id: 8,
    icon: Heart,
    iconColor: "text-pink-600",
    iconBg: "bg-pink-50",
    nicho: "Terapeuta",
    nichoColor: "bg-amber-100 text-amber-700",
    title: "Retorno marcado 💜",
    message: "Paciente reagendou retorno para próxima quinta. IA confirmou automaticamente.",
    time: "22 min",
  },
  {
    id: 9,
    icon: FileText,
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-50",
    nicho: "Vendedor",
    nichoColor: "bg-blue-100 text-blue-700",
    title: "Proposta enviada 📄",
    message: "IA gerou e enviou proposta personalizada de R$8.900 para empresa XYZ.",
    time: "25 min",
  },
  {
    id: 10,
    icon: Star,
    iconColor: "text-yellow-600",
    iconBg: "bg-yellow-50",
    nicho: "Dentista",
    nichoColor: "bg-emerald-100 text-emerald-700",
    title: "Avaliação recebida ⭐",
    message: "Paciente Maria deu 5 estrelas: \"Atendimento incrível, muito rápido!\"",
    time: "30 min",
  },
  {
    id: 11,
    icon: Clock,
    iconColor: "text-teal-600",
    iconBg: "bg-teal-50",
    nicho: "Imobiliária",
    nichoColor: "bg-violet-100 text-violet-700",
    title: "Follow-up automático 🔄",
    message: "IA enviou follow-up: \"Olá Carlos, ainda tem interesse no apartamento da Vila Mariana?\"",
    time: "35 min",
  },
  {
    id: 12,
    icon: ThumbsUp,
    iconColor: "text-lime-600",
    iconBg: "bg-lime-50",
    nicho: "Terapeuta",
    nichoColor: "bg-amber-100 text-amber-700",
    title: "Pagamento confirmado ✅",
    message: "Paciente confirmou pagamento de R$280 da sessão. Recibo enviado automaticamente.",
    time: "40 min",
  },
];

const leftNotifications = notifications.filter((_, i) => i % 2 === 0);
const rightNotifications = notifications.filter((_, i) => i % 2 === 1);

function NotificationCard({ notification, side }: { notification: Notification; side: "left" | "right" }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -60 : 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: side === "left" ? -40 : 40, scale: 0.95 }}
      transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
      className="w-[300px] bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-border/40 p-3.5 cursor-default hover:shadow-xl transition-shadow duration-300"
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${notification.iconBg} flex items-center justify-center flex-shrink-0`}>
          <notification.icon className={`w-4.5 h-4.5 ${notification.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${notification.nichoColor}`}>
              {notification.nicho}
            </span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">{notification.time}</span>
          </div>
          <p className="text-xs font-semibold text-foreground leading-snug">{notification.title}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{notification.message}</p>
        </div>
      </div>
    </motion.div>
  );
}

function NotificationColumn({ items, side, stagger }: { items: Notification[]; side: "left" | "right"; stagger: number }) {
  const [visibleIds, setVisibleIds] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const initialDelay = setTimeout(() => {
      setVisibleIds([items[0].id]);
      setCurrentIndex(1);
    }, stagger);

    return () => clearTimeout(initialDelay);
  }, [items, stagger]);

  useEffect(() => {
    if (currentIndex === 0) return;

    const interval = setInterval(() => {
      setVisibleIds((prev) => {
        const nextIndex = currentIndex % items.length;
        const nextId = items[nextIndex].id;

        const updated = prev.length >= 3 ? [...prev.slice(1), nextId] : [...prev, nextId];
        return updated;
      });
      setCurrentIndex((prev) => prev + 1);
    }, 4000);

    return () => clearInterval(interval);
  }, [currentIndex, items]);

  const visibleNotifications = visibleIds
    .map((id) => items.find((n) => n.id === id))
    .filter(Boolean) as Notification[];

  return (
    <div className={`flex flex-col gap-3 ${side === "left" ? "items-end" : "items-start"}`}>
      <AnimatePresence mode="popLayout">
        {visibleNotifications.map((notification) => (
          <NotificationCard key={`${notification.id}-${visibleIds.indexOf(notification.id)}`} notification={notification} side={side} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function MobileNotificationCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentIndex(0);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (currentIndex < 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % notifications.length);
    }, 5000); // 5s per notification for comfortable reading
    return () => clearInterval(interval);
  }, [currentIndex]);

  const current = notifications[currentIndex];

  return (
    <div className="flex justify-center pointer-events-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-[340px] bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-border/40 p-3.5"
        >
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg ${current.iconBg} flex items-center justify-center flex-shrink-0`}>
              <current.icon className={`w-4.5 h-4.5 ${current.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${current.nichoColor}`}>
                  {current.nicho}
                </span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{current.time}</span>
              </div>
              <p className="text-xs font-semibold text-foreground leading-snug">{current.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{current.message}</p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function FloatingNotifications() {
  return (
    <>
      {/* Mobile: single centered notification */}
      <div className="lg:hidden pointer-events-none z-10 mb-6">
        <MobileNotificationCarousel />
      </div>

      {/* Desktop: dual columns */}
      <div className="hidden lg:flex absolute inset-0 pointer-events-none z-10">
        <div className="absolute left-4 xl:left-8 top-8 pointer-events-auto">
          <NotificationColumn items={leftNotifications} side="left" stagger={1500} />
        </div>
        <div className="absolute right-4 xl:right-8 top-8 pointer-events-auto">
          <NotificationColumn items={rightNotifications} side="right" stagger={3500} />
        </div>
      </div>
    </>
  );
}
