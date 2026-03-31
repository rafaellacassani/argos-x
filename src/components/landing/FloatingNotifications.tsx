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

function WhatsAppBanner({ notification, side }: { notification: Notification; side: "left" | "right" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="w-[340px] bg-white/[0.97] backdrop-blur-2xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-3 cursor-default"
      style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.08), 0 8px 40px rgba(0,0,0,0.06)" }}
    >
      {/* Top bar — app icon + name + time */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-5 h-5 rounded-md bg-[#25D366] flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-3 h-3 text-white" />
        </div>
        <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">WhatsApp</span>
        <span className="text-[10px] text-muted-foreground/50 ml-auto">{notification.time}</span>
      </div>
      {/* Content */}
      <div className="flex items-start gap-2.5">
        <div className={`w-10 h-10 rounded-full ${notification.iconBg} flex items-center justify-center flex-shrink-0`}>
          <notification.icon className={`w-5 h-5 ${notification.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-semibold text-foreground truncate">Argos X · {notification.nicho}</p>
          </div>
          <p className="text-[12px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{notification.message}</p>
        </div>
      </div>
    </motion.div>
  );
}

function NotificationColumn({ items, side, stagger }: { items: Notification[]; side: "left" | "right"; stagger: number }) {
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    const initialDelay = setTimeout(() => {
      setCurrentIndex(0);
    }, stagger);
    return () => clearTimeout(initialDelay);
  }, [stagger]);

  useEffect(() => {
    if (currentIndex < 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentIndex, items]);

  const current = currentIndex >= 0 ? items[currentIndex] : null;

  return (
    <div className={`flex flex-col gap-3 ${side === "left" ? "items-end" : "items-start"}`}>
      <AnimatePresence mode="wait">
        {current && (
          <WhatsAppBanner key={`${current.id}-${currentIndex}`} notification={current} side={side} />
        )}
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
    <div className="flex justify-center pointer-events-auto px-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-[360px] bg-white/[0.97] backdrop-blur-2xl rounded-2xl p-3"
          style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.08), 0 8px 40px rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-5 h-5 rounded-md bg-[#25D366] flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-3 h-3 text-white" />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">WhatsApp</span>
            <span className="text-[10px] text-muted-foreground/50 ml-auto">{current.time}</span>
          </div>
          <div className="flex items-start gap-2.5">
            <div className={`w-10 h-10 rounded-full ${current.iconBg} flex items-center justify-center flex-shrink-0`}>
              <current.icon className={`w-5 h-5 ${current.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground truncate">Argos X · {current.nicho}</p>
              <p className="text-[12px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{current.message}</p>
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

      {/* Desktop: fixed side notifications that persist while scrolling */}
      <div className="hidden lg:block fixed inset-0 pointer-events-none z-40">
        <div className="absolute left-4 xl:left-8 top-24 pointer-events-auto">
          <NotificationColumn items={leftNotifications} side="left" stagger={1500} />
        </div>
        <div className="absolute right-4 xl:right-8 top-24 pointer-events-auto">
          <NotificationColumn items={rightNotifications} side="right" stagger={4000} />
        </div>
      </div>
    </>
  );
}
