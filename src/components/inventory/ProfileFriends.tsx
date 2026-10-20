import React, { useState } from 'react';
import { useFriends, Friend } from '@/hooks/useFriends';
import { useAuth } from '@/contexts/AuthContext';
import { useSfx } from '@/hooks/useSfx';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Users, UserPlus, Copy, Check, Share2, Swords, Trash2, Edit2,
  Sparkles, ShieldCheck, HeartHandshake, UserCheck, Search,
} from 'lucide-react';
import { toast } from 'sonner';

export const ProfileFriends: React.FC = () => {
  const { friends, totalFriends, myFriendCode, addFriend, removeFriend, renameFriend } = useFriends();
  const { user } = useAuth();
  const { play } = useSfx();
  const navigate = useNavigate();

  const [inputCode, setInputCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const handleCopyCode = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(myFriendCode).catch(() => {});
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = myFriendCode;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {}

    setCopied(true);
    play('navClick');
    toast.success(`Code ami ${myFriendCode} copié !`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const text = `Rejoins-moi sur FLIPZ ! Mon code ami : ${myFriendCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Ajoute-moi sur FLIPZ !',
          text,
          url: window.location.origin + '/shop',
        });
        toast.success('Invitation partagée !');
        return;
      } catch {}
    }
    handleCopyCode();
  };

  const handleAddFriend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputCode.trim()) {
      toast.error('Entrez un code ami ou un pseudo !');
      return;
    }
    setAdding(true);
    play('navClick');
    const success = await addFriend(inputCode.trim());
    setAdding(false);
    if (success) {
      setInputCode('');
    }
  };

  const handleStartTrade = (friend: Friend) => {
    play('navClick');
    sessionStorage.setItem('flipz_trade_target_friend', JSON.stringify({
      id: friend.id,
      name: friend.username,
      code: friend.friendCode,
    }));
    toast.info(`Direction la boutique pour échanger avec ${friend.username} !`);
    navigate('/shop');
  };

  const filteredFriends = friends.filter(f =>
    f.username.toLowerCase().includes(searchFilter.toLowerCase()) ||
    f.friendCode.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ── CARD: MY FRIEND CODE ── */}
      <Card className="border border-purple-500/30 bg-gradient-to-br from-[#16122c] via-[#0f0c1e] to-[#1a1233] shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-44 h-44 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <CardHeader className="pb-3 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-300" />
              </div>
              <div>
                <CardTitle className="text-lg font-black text-white">Système d'Amis</CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Partagez votre code et échangez vos cartes avec vos amis.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="border-purple-500/40 text-purple-300 bg-purple-950/40 text-xs">
              {totalFriends} ami{totalFriends > 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 relative z-10">
          <div className="p-3.5 rounded-2xl bg-black/40 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-purple-300/80 block">
                Votre Code Ami
              </span>
              <span className="font-mono text-2xl font-black text-yellow-300 tracking-widest select-all drop-shadow-[0_0_12px_rgba(253,224,71,0.4)]">
                {myFriendCode}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleCopyCode}
                className="bg-white/10 hover:bg-white/15 text-white border border-white/15 rounded-xl font-bold text-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400 mr-1.5" /> : <Copy className="w-3.5 h-3.5 text-zinc-300 mr-1.5" />}
                {copied ? 'Copié !' : 'Copier'}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleShare}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white rounded-xl font-bold text-xs shadow-md"
              >
                <Share2 className="w-3.5 h-3.5 mr-1.5 text-yellow-300" />
                Partager
              </Button>
            </div>
          </div>

          {/* Add Friend Form */}
          <form onSubmit={handleAddFriend} className="flex gap-2">
            <div className="relative flex-1">
              <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder="Entrez un code ami (ex: FPZ-A7K92B) ou pseudo..."
                value={inputCode}
                onChange={e => setInputCode(e.target.value)}
                className="pl-9 h-10 bg-black/40 border-purple-500/25 focus:border-purple-400 text-white placeholder-zinc-500 text-xs rounded-xl"
              />
            </div>
            <Button
              type="submit"
              disabled={adding || !inputCode.trim()}
              className="h-10 px-4 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-black font-extrabold text-xs rounded-xl shadow-[0_0_15px_rgba(234,179,8,0.3)]"
            >
              {adding ? '...' : 'Ajouter'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── CARD: FRIENDS LIST ── */}
      <Card className="border border-white/10 bg-card/60 backdrop-blur-md shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <CardTitle className="text-base font-bold text-white">Liste de vos amis</CardTitle>
            </div>
            {friends.length > 3 && (
              <div className="relative w-40">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
                <input
                  placeholder="Filtrer..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="w-full pl-7 pr-2 h-7 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-zinc-500 outline-none"
                />
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {filteredFriends.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <HeartHandshake className="w-6 h-6 text-purple-400/60" />
              </div>
              <p className="text-sm font-bold text-white mt-1">
                {friends.length === 0 ? 'Aucun ami ajouté pour le moment' : 'Aucun ami ne correspond à votre recherche'}
              </p>
              <p className="text-xs text-zinc-400 max-w-xs">
                Partagez votre code ami ci-dessus pour inviter des joueurs et commencer des échanges en direct !
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5 space-y-1">
              {filteredFriends.map(friend => {
                const isEditing = editingId === friend.id;

                return (
                  <div
                    key={friend.id}
                    className="pt-2 pb-2 flex items-center justify-between gap-2.5 hover:bg-white/[0.02] rounded-xl px-2 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex-shrink-0">
                        <Avatar className="w-10 h-10 rounded-xl border border-purple-500/30 bg-purple-950/40">
                          {friend.avatarUrl && <AvatarImage src={friend.avatarUrl} alt={friend.username} className="object-cover" />}
                          <AvatarFallback className="bg-gradient-to-tr from-purple-800 to-indigo-700 text-white font-black text-xs rounded-xl">
                            {friend.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                            friend.status === 'online'
                              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                              : 'bg-zinc-600'
                          }`}
                          title={friend.status === 'online' ? 'En ligne' : 'Hors ligne'}
                        />
                      </div>

                      <div className="min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <input
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              autoFocus
                              className="h-6 px-2 text-xs bg-black/60 border border-purple-400 rounded text-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                renameFriend(friend.id, editName);
                                setEditingId(null);
                              }}
                              className="text-[10px] text-emerald-400 font-bold px-1.5 py-0.5 bg-emerald-500/10 rounded"
                            >
                              OK
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-[10px] text-zinc-400 px-1 py-0.5"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm text-white truncate">{friend.username}</span>
                            <span className="px-1.5 py-0.2 rounded bg-purple-950/60 border border-purple-500/30 font-mono text-[10px] text-purple-300 font-bold">
                              {friend.friendCode}
                            </span>
                          </div>
                        )}
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {friend.status === 'online' ? (
                            <span className="text-emerald-400 font-semibold">● En ligne</span>
                          ) : (
                            <span>Hors ligne</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleStartTrade(friend)}
                        className="h-8 px-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-black font-extrabold text-xs rounded-xl shadow-sm"
                        title="Lancer un échange"
                      >
                        <Swords className="w-3.5 h-3.5 mr-1" />
                        <span className="hidden sm:inline">Échanger</span>
                      </Button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(friend.id);
                          setEditName(friend.username);
                        }}
                        className="w-8 h-8 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Renommer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => removeFriend(friend.id)}
                        className="w-8 h-8 rounded-xl hover:bg-red-500/20 text-zinc-400 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                        title="Supprimer des amis"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
