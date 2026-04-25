import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// Only import LocalNotifications on native platforms to avoid web errors
const scheduleNotifications = async (hasCollectedToday: boolean, hasUpdatedStreakToday: boolean) => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    // Request permission
    const { display } = await LocalNotifications.requestPermissions();
    if (display !== 'granted') return;

    // Cancel all existing scheduled notifications before rescheduling
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    const now = new Date();
    
    const getNextTime = (hour: number) => {
      const d = new Date(now);
      d.setHours(hour, 0, 0, 0);
      if (d <= now) {
        d.setDate(d.getDate() + 1);
      }
      return d;
    };

    const n1Time = getNextTime(9);
    const n2Time = getNextTime(15);
    const n3Time = getNextTime(21);

    const notifications: {
      id: number;
      title: string;
      body: string;
      schedule: { at: Date; repeats: boolean; every: 'day' };
      smallIcon: string;
      iconColor: string;
    }[] = [];

    // N1 (09:00) & N3 (21:00)
    const cardTitle = hasCollectedToday 
      ? '📦 Des boosters vous attendent !' 
      : '🃏 Nouvelle carte du jour !';
      
    const cardBody = hasCollectedToday 
      ? 'Obtenez plus de cartes pour votre collection en ouvrant des boosters !' 
      : 'Retournez votre carte du jour dès maintenant et agrandissez votre collection !';

    notifications.push({
      id: 1001,
      title: cardTitle,
      body: cardBody,
      schedule: { at: n1Time, repeats: true, every: 'day' },
      smallIcon: 'ic_stat_flipz',
      iconColor: hasCollectedToday ? '#9C27B0' : '#FFB300',
    });

    notifications.push({
      id: 1003,
      title: cardTitle,
      body: cardBody,
      schedule: { at: n3Time, repeats: true, every: 'day' },
      smallIcon: 'ic_stat_flipz',
      iconColor: hasCollectedToday ? '#9C27B0' : '#FFB300',
    });

    // N2 (15:00) - Winstreak
    const winstreakTitle = hasUpdatedStreakToday
      ? '📦 Nouvelles cartes rares !'
      : '🔥 Ne perdez pas votre Winstreak !';
      
    const winstreakBody = hasUpdatedStreakToday
      ? 'Découvrez de nouvelles cartes rares dans les boosters !'
      : 'Retournez votre carte pour augmenter votre winstreak !';

    notifications.push({
      id: 1002,
      title: winstreakTitle,
      body: winstreakBody,
      schedule: { at: n2Time, repeats: true, every: 'day' },
      smallIcon: 'ic_stat_flipz',
      iconColor: hasUpdatedStreakToday ? '#9C27B0' : '#FF4500',
    });

    await LocalNotifications.schedule({
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: {
          at: n.schedule.at,
          repeats: true,
          every: 'day' as const,
        },
        smallIcon: 'ic_stat_notify',
        iconColor: n.iconColor,
        sound: 'default',
        actionTypeId: '',
        extra: null,
      })),
    });
  } catch (err) {
    console.warn('[useNotifications] Failed to schedule notifications:', err);
  }
};

/**
 * useNotifications — initialises local push notifications on native (Android/iOS).
 * Call this in a component that tracks user collection state.
 */
export const useNotifications = (hasCollectedToday?: boolean, hasUpdatedStreakToday?: boolean) => {
  useEffect(() => {
    if (hasCollectedToday !== undefined && hasUpdatedStreakToday !== undefined) {
      scheduleNotifications(hasCollectedToday, hasUpdatedStreakToday);
    }
  }, [hasCollectedToday, hasUpdatedStreakToday]);
};
