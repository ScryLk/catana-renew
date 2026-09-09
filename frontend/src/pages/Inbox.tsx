
import { useState, useEffect, useRef } from 'react';
import { chatService } from '../services/chatService';
import { Conversation, Message } from '../types/api';
import { MessageSquare, Send, User as UserIcon, Loader2, Search, ArrowLeft, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { Sidebar } from '../components/Sidebar';

export function Inbox() {
    const { user } = useAuthStore();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadConversations();

        // Poll list every 10s
        const interval = setInterval(() => {
            if (document.hidden) return;
            loadConversations(true);
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!selectedConversation) return;

        loadConversationDetails(selectedConversation.id);

        // Poll active conversation every 3s
        const interval = setInterval(() => {
            if (document.hidden) return;
            loadConversationDetails(selectedConversation.id, true);
        }, 3000);

        return () => clearInterval(interval);
    }, [selectedConversation?.id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadConversations = async (silent = false) => {
        try {
            if (!silent) setIsLoading(true);
            const data = await chatService.getConversations();
            setConversations(data);
        } catch (error) {
            console.error('Failed to load conversations', error);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    const loadConversationDetails = async (id: number, _silent = false) => {
        try {
            const data = await chatService.getConversation(id);
            // Only update if we are still looking at the same conversation
            setSelectedConversation(prev => prev?.id === id ? { ...prev, ...data } : prev);

            setMessages(prev => {
                // simple check to see if we have new messages to avoid unnecessary re-renders/scrolls
                if (data.messages && data.messages.length !== prev.length) {
                    return data.messages;
                }
                return prev;
            });
        } catch (error) {
            console.error('Failed to load conversation details', error);
        }
    };

    const handleConversationClick = async (conv: Conversation) => {
        setSelectedConversation(conv);

        // Optimistically update unread count
        if (conv.unread_count && conv.unread_count > 0) {
            setConversations(prev => prev.map(c =>
                c.id === conv.id ? { ...c, unread_count: 0 } : c
            ));

            // Mark as read in backend
            try {
                await chatService.markRead(conv.id);
            } catch (error) {
                console.error("Failed to mark read", error);
            }
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedConversation || !newMessage.trim() || isSending) return;

        try {
            setIsSending(true);
            const message = await chatService.sendMessage(selectedConversation.id, newMessage);
            setMessages(prev => [...prev, message]);
            setNewMessage('');

            setConversations(prev => prev.map(c =>
                c.id === selectedConversation.id
                    ? { ...c, last_message: message, updated_at: new Date().toISOString() }
                    : c
            ));
        } catch (error) {
            console.error('Failed to send message', error);
            toast.error('Erro ao enviar mensagem. Tente novamente.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex h-screen bg-white dark:bg-black overflow-hidden">
            <Sidebar />

            {/* Main Content Area (Push right by sidebar width) */}
            <div className="flex-1 flex ml-16 h-full">

                {/* Sidebar List (Conversation List) */}
                <div className={cn(
                    "w-full md:w-80 lg:w-96 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-[#0A0A0A]",
                    selectedConversation ? "hidden md:flex" : "flex"
                )}>
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between h-16 shrink-0">
                        <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Mensagens
                        </h1>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">

                        {isLoading ? (
                            // Skeleton Loader
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="p-3 rounded-lg border border-transparent animate-pulse">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
                                        <div className="h-3 w-10 bg-zinc-200 dark:bg-zinc-800 rounded" />
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <div className="w-8 h-8 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded" />
                                            <div className="h-3 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded" />
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : conversations.length === 0 ? (
                            <div className="text-center py-12 px-4 flex flex-col items-center">
                                <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-3">
                                    <MessageSquare className="w-6 h-6 text-zinc-400" />
                                </div>
                                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">Nenhuma conversa</h3>
                                <p className="text-xs text-zinc-500 mb-4 max-w-[200px]">
                                    Explore o catálogo para iniciar uma conversa.
                                </p>
                            </div>
                        ) : (
                            conversations.map((conv) => (
                                <div
                                    key={conv.id}
                                    onClick={() => handleConversationClick(conv)}
                                    className={cn(
                                        "group relative p-3 rounded-lg cursor-pointer transition-all duration-200",
                                        selectedConversation?.id === conv.id
                                            ? "bg-white dark:bg-zinc-800 shadow-sm"
                                            : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                                    )}
                                >
                                    {/* Active Indicator */}
                                    {selectedConversation?.id === conv.id && (
                                        <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-blue-600 rounded-r-full" />
                                    )}

                                    <div className="flex gap-3">
                                        {/* Avatar/Image */}
                                        <div className="relative shrink-0">
                                            {conv.context?.image ? (
                                                <img
                                                    src={conv.context.image}
                                                    alt=""
                                                    className="w-10 h-10 rounded-md object-cover bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
                                                    <MessageSquare className="w-5 h-5 text-zinc-400" />
                                                </div>
                                            )}
                                            {/* Unread Dot (Inbox Level) */}
                                            {conv.unread_count && conv.unread_count > 0 ? (
                                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 border-2 border-zinc-50 dark:border-[#0A0A0A] rounded-full" />
                                            ) : null}
                                        </div>

                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <h3 className={cn(
                                                    "text-sm text-zinc-900 dark:text-zinc-100 truncate pr-2",
                                                    conv.unread_count && conv.unread_count > 0 ? "font-semibold" : "font-medium"
                                                )}>
                                                    {conv.context?.title || `Conversa #${conv.id}`}
                                                </h3>
                                                <span className="text-[10px] text-zinc-400 whitespace-nowrap shrink-0">
                                                    {new Date(conv.updated_at).toLocaleDateString(undefined, {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                            <p className={cn(
                                                "text-xs truncate transition-colors",
                                                conv.unread_count && conv.unread_count > 0
                                                    ? "text-zinc-800 dark:text-zinc-300 font-medium"
                                                    : "text-zinc-500 dark:text-zinc-500 group-hover:dark:text-zinc-400"
                                            )}>
                                                {conv.last_message?.sender === user?.id && <span className="mr-1">Você:</span>}
                                                {conv.last_message?.content || "Nova conversa"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div >

                {/* Chat Area */}
                <div className={cn(
                    "flex-1 flex flex-col bg-white dark:bg-black relative",
                    !selectedConversation ? "hidden md:flex" : "flex"
                )}>
                    {
                        selectedConversation ? (
                            <div className="flex-1 flex flex-col h-full animate-in fade-in duration-300 slide-in-from-bottom-2" >
                                {/* Chat Header */}
                                <div className="h-16 px-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white/80 dark:bg-black/80 backdrop-blur-md sticky top-0 z-10">
                                    <div className="flex items-center gap-4">
                                        <button
                                            className="md:hidden p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                            onClick={() => setSelectedConversation(null)}
                                        >
                                            <ArrowLeft className="w-5 h-5" />
                                        </button>

                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-500">
                                                {selectedConversation.origin_type === 'catalog' ? <Search className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white leading-none mb-1">
                                                    {selectedConversation.context?.title || `Conversa #${selectedConversation.id} `}
                                                </h2>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">
                                                        {selectedConversation.origin_type}
                                                    </span>
                                                    {selectedConversation.context?.subtitle && (
                                                        <>
                                                            <span className="w-0.5 h-0.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                                                            <span className="text-[10px] text-zinc-500">
                                                                {selectedConversation.context.subtitle}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Messages List */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {
                                        messages.map((msg, index) => {
                                            const isMe = msg.sender === user?.id;

                                            return (
                                                <div
                                                    key={msg.id}
                                                    className={cn(
                                                        "flex gap-3 max-w-[85%] group animate-in slide-in-from-bottom-2 duration-300 fill-mode-backwards",
                                                        isMe ? "ml-auto flex-row-reverse" : ""
                                                    )}
                                                    style={{ animationDelay: `${index * 50} ms` }}
                                                >
                                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-700">
                                                        {msg.sender_avatar ? (
                                                            <img src={msg.sender_avatar} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <UserIcon className="w-4 h-4 text-zinc-400" />
                                                        )}
                                                    </div>
                                                    <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                                                        <div className="flex items-baseline gap-2 mb-1 px-1">
                                                            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                                                {isMe ? 'Você' : msg.sender_username}
                                                            </span>
                                                            <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
                                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <div className={cn(
                                                            "px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm",
                                                            isMe
                                                                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-tr-sm"
                                                                : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-tl-sm"
                                                        )}>
                                                            {msg.content}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input Area */}
                                <div className="p-4 bg-white dark:bg-black shrink-0">
                                    <form
                                        onSubmit={handleSendMessage}
                                        className="max-w-4xl mx-auto flex items-end gap-2 p-1.5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/50 transition-all"
                                    >
                                        <input
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder="Digite sua mensagem..."
                                            className="flex-1 bg-transparent border-0 px-4 py-2.5 text-sm focus:ring-0 placeholder:text-zinc-400 dark:text-white min-h-[44px]"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!newMessage.trim() || isSending}
                                            className={cn(
                                                "p-2 rounded-full mb-0.5 transition-all duration-200 flex items-center justify-center w-9 h-9",
                                                newMessage.trim() && !isSending
                                                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                                            )}
                                        >
                                            {isSending ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Send className="w-4 h-4 ml-0.5" />
                                            )}
                                        </button>
                                    </form>
                                    <div className="text-center mt-2">
                                        <p className="text-[10px] text-zinc-400 dark:text-zinc-600">
                                            Pressione Enter para enviar
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 p-8 animate-in fade-in duration-500">
                                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-zinc-200 dark:ring-zinc-800">
                                    <MessageSquare className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
                                </div>
                                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-200">Suas Mensagens</h3>
                                <p className="text-sm text-zinc-500 max-w-[240px] text-center mt-2 leading-relaxed">
                                    Selecione uma conversa ao lado para visualizar o histórico e enviar mensagens.
                                </p>
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
}
