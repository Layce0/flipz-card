import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Friend {
  id: string;
  friendCode: string;
  username: string;
  avatarUrl?: string | null;
  addedAt: string;
  status: 'online' | 'offline';
  notes?: string;
}

export interface FriendsStorageData {
  friends: Friend[];
}

const DEFAULT_FRIENDS_DATA: FriendsStorageData = {
  friends: [],
};

const getStorageKey = (userId: string | undefined) => {
  return userId ? 'flipz_friends_' + userId : 'flipz_friends_guest';
};

const REGISTRY_STORAGE_KEY = 'flipz_public_codes_registry';

export const generateFriendCode = (userId: string | undefined): string => {
  if (typeof window === 'undefined') return 'FPZ-100000';
  if (!userId) {
    let guestCode = localStorage.getItem('flipz_guest_friend_code');
    if (!guestCode || guestCode === 'FPZ-GUEST') {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let generated = '';
      for (let i = 0; i < 6; i++) {
        generated += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      guestCode = 'FPZ-' + generated;
      localStorage.setItem('flipz_guest_friend_code', guestCode);
    }
    return guestCode;
  }
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const part = hash.toString(36).toUpperCase().padStart(6, '0').slice(-6);
  return 'FPZ-' + part;
};

export const useFriends = () => {
  const { user } = useAuth();
  const storageKey = getStorageKey(user?.id);

  const [data, setData] = useState<FriendsStorageData>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_FRIENDS_DATA;
  });

  const [myProfileName, setMyProfileName] = useState<string>('Moi');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setData(JSON.parse(saved));
      } else {
        setData(DEFAULT_FRIENDS_DATA);
      }
    } catch {
      setData(DEFAULT_FRIENDS_DATA);
    }
  }, [storageKey]);

  useEffect(() => {
    const myCode = generateFriendCode(user?.id);
    if (!user?.id) {
      // Register guest code so other tabs/players can find it
      try {
        const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
        const registry = raw ? JSON.parse(raw) : {};
        registry[myCode.toUpperCase()] = { 
          username: 'Joueur ' + myCode.replace('FPZ-', ''), 
          avatarUrl: null, 
          userId: 'guest_' + myCode 
        };
        localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));
      } catch {}
      return;
    }

    supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data: profileData }) => {
        const username = profileData?.username || user.email?.split('@')[0] || ('Joueur ' + myCode.replace('FPZ-', ''));
        const avatarUrl = profileData?.avatar_url || null;
        setMyProfileName(username);
        try {
          const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
          const registry = raw ? JSON.parse(raw) : {};
          registry[myCode.toUpperCase()] = { username, avatarUrl, userId: user.id };
          localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));
        } catch (e) {
          console.warn('Failed to update registry', e);
        }
      });
  }, [user?.id, user?.email]);

  const saveFriends = useCallback((newData: FriendsStorageData) => {
    setData(newData);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newData));
    } catch (e) {
      console.error('Failed to save friends list', e);
    }
  }, [storageKey]);

  const myFriendCode = generateFriendCode(user?.id);

  const addFriend = useCallback(async (codeOrUsername: string, customNickname?: string): Promise<boolean> => {
    const raw = codeOrUsername.trim();
    if (!raw) {
      toast.error('Veuillez entrer un code ami ou un pseudo.');
      return false;
    }
    const cleanInput = raw.toUpperCase();
    const myCode = myFriendCode.toUpperCase();
    if (cleanInput === myCode || (user?.id && cleanInput === user.id.toUpperCase())) {
      toast.error('Vous ne pouvez pas vous ajouter vous-même comme ami !');
      return false;
    }
    const alreadyFriend = data.friends.some(
      f => f.friendCode.toUpperCase() === cleanInput || f.username.toLowerCase() === raw.toLowerCase()
    );
    if (alreadyFriend) {
      toast.info('Cet ami est déjà dans votre liste.');
      return false;
    }
    let foundUsername = customNickname?.trim() || '';
    let foundAvatar: string | null = null;
    let finalCode = cleanInput.startsWith('FPZ-') ? cleanInput : ('FPZ-' + cleanInput.slice(0, 6));
    let resolvedId = 'friend_' + Date.now();
    try {
      const regRaw = localStorage.getItem(REGISTRY_STORAGE_KEY);
      if (regRaw) {
        const registry = JSON.parse(regRaw);
        if (registry[cleanInput]) {
          if (!foundUsername) foundUsername = registry[cleanInput].username;
          foundAvatar = registry[cleanInput].avatarUrl;
          resolvedId = registry[cleanInput].userId || resolvedId;
        }
      }
    } catch {}
    if (!foundUsername) {
      try {
        const { data: dbUser } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .ilike('username', raw)
          .maybeSingle();
        if (dbUser) {
          foundUsername = dbUser.username || '';
          foundAvatar = dbUser.avatar_url;
          resolvedId = dbUser.id;
          finalCode = generateFriendCode(dbUser.id);
        }
      } catch (e) {
        console.warn('Supabase profile search error:', e);
      }
    }
    if (!foundUsername) {
      if (cleanInput.startsWith('FPZ-')) {
        const codeSuffix = cleanInput.replace('FPZ-', '');
        foundUsername = 'Joueur ' + codeSuffix;
      } else {
        foundUsername = raw;
      }
    }
    const newFriend: Friend = {
      id: resolvedId,
      friendCode: finalCode,
      username: foundUsername,
      avatarUrl: foundAvatar,
      addedAt: new Date().toISOString(),
      status: Math.random() > 0.4 ? 'online' : 'offline',
    };
    const nextFriends = [newFriend, ...data.friends];
    saveFriends({ friends: nextFriends });
    toast.success(foundUsername + ' a été ajouté à vos amis !');
    return true;
  }, [data.friends, myFriendCode, saveFriends, user?.id]);

  const removeFriend = useCallback((friendId: string) => {
    const friend = data.friends.find(f => f.id === friendId);
    const nextFriends = data.friends.filter(f => f.id !== friendId);
    saveFriends({ friends: nextFriends });
    if (friend) {
      toast.success(friend.username + ' a été retiré de vos amis.');
    }
  }, [data.friends, saveFriends]);

  const renameFriend = useCallback((friendId: string, newNickname: string) => {
    const trimmed = newNickname.trim();
    if (!trimmed) {
      toast.error('Le surnom ne peut pas être vide.');
      return false;
    }
    const nextFriends = data.friends.map(f => {
      if (f.id === friendId) {
        return { ...f, username: trimmed };
      }
      return f;
    });
    saveFriends({ friends: nextFriends });
    toast.success('Surnom mis à jour !');
    return true;
  }, [data.friends, saveFriends]);

  return {
    friends: data.friends,
    totalFriends: data.friends.length,
    myFriendCode,
    myProfileName,
    addFriend,
    removeFriend,
    renameFriend,
  };
};
