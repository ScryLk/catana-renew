import type { FC } from 'react';

import { Users, MessageCircle } from 'lucide-react';

const teamMembers = [
  { name: 'Carlos Santos', role: 'Editor', avatar: 'CS', status: 'online' },
  { name: 'Marina Costa', role: 'Designer', avatar: 'MC', status: 'away' },
  { name: 'João Oliveira', role: 'Revisor', avatar: 'JO', status: 'offline' },
];

const comments = [
  {
    id: '1',
    author: 'Carlos Santos',
    avatar: 'CS',
    message: 'Precisa ajustar as cores do produto #PRD-001',
    catalog: 'Catálogo Verão 2024',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
  {
    id: '2',
    author: 'Marina Costa',
    avatar: 'MC',
    message: 'Layout da página 3 aprovado!',
    catalog: 'Eletrônicos Premium',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
];

export const TeamCollaboration: FC = () => {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Colaboração da Equipe</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Members */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Users className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Membros Ativos</h3>
          </div>
          <div className="space-y-4">
            {teamMembers.map((member) => (
              <div
                key={member.name}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="relative">
                  <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-700 dark:text-zinc-300 font-medium border border-zinc-200 dark:border-zinc-700">
                    {member.avatar}
                  </div>
                  <div
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 ${member.status === 'online'
                      ? 'bg-emerald-500'
                      : member.status === 'away'
                        ? 'bg-amber-500'
                        : 'bg-zinc-400'
                      }`}
                  />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">{member.name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{member.role}</div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide font-medium ${member.status === 'online'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                    : member.status === 'away'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                      : 'bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                    }`}
                >
                  {member.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Comments */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Comentários Pendentes</h3>
            </div>
            <span className="bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 text-xs font-medium px-2 py-0.5 rounded-full">
              {comments.length}
            </span>
          </div>
          <div className="space-y-4">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all bg-zinc-50/50 dark:bg-zinc-800/20"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-medium text-xs flex-shrink-0 border border-zinc-200 dark:border-zinc-700">
                    {comment.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">{comment.author}</span>
                      <span className="text-[10px] text-zinc-400 border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 rounded-full bg-white dark:bg-zinc-900">
                        {comment.catalog}
                      </span>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{comment.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
