// NotificationChannels.ts
import notifee, { AndroidImportance } from '@notifee/react-native';

export const createNotificationChannels = async () => {
  try {
    // Call Channel - Full screen call notifications
    await notifee.createChannel({
      id: 'call_channel',
      name: 'Incoming Calls',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      visibility: 'public',
    });

    // Message Channel - Normal chat notifications
    await notifee.createChannel({
      id: 'message_channel',
      name: 'Messages',
      importance: AndroidImportance.DEFAULT,
      sound: 'default',
      visibility: 'private',
    });

    console.log('✅ Notification channels created');
  } catch (err) {
    console.log('❌ Error creating notification channels:', err);
  }
};
