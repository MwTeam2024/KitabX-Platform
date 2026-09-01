import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { notificationsService } from '@/services/notifications.service';

const TYPE_EMOJI = { REQUEST: '📚', PICKUP: '🕒', EXCHANGE: '✅', WISHLIST: '💛', ADMIN: '🛡️', VERIFICATION: '🛡️', REPORT: '🚩' };

function toDeepLink(n) {
  if (n.entityType === 'exchange') return `/exchanges/${n.entityId}`;
  if (n.entityType === 'book_request') return '/requests';
  if (n.entityType === 'listing') return `/books/${n.entityId}`;
  return undefined;
}

function toItem(n) {
  return {
    id: n.id,
    emoji: TYPE_EMOJI[n.type] || '🔔',
    title: n.title,
    body: n.body,
    time: n.createdAt,
    href: toDeepLink(n),
    gold: n.type === 'WISHLIST',
    isRead: n.isRead,
  };
}

const initialState = {
  items: [],
  pushPermission: 'default', // 'default' | 'granted' | 'denied' (mirrors Firebase FCM permission)
};

export const fetchNotifications = createAsyncThunk('notification/fetch', async () => {
  const items = await notificationsService.list();
  return items.map(toItem);
});

export const markRead = createAsyncThunk('notification/markRead', async (id) => {
  await notificationsService.markRead(id);
  return id;
});

export const markAllRead = createAsyncThunk('notification/markAllRead', async () => {
  await notificationsService.markAllRead();
});

export const deleteNotification = createAsyncThunk('notification/delete', async (id) => {
  await notificationsService.deleteOne(id);
  return id;
});

export const clearAllNotifications = createAsyncThunk('notification/clearAll', async () => {
  await notificationsService.deleteAll();
});

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    setPushPermission(state, action) {
      state.pushPermission = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.items = action.payload;
      })
      .addCase(markRead.fulfilled, (state, action) => {
        const item = state.items.find((n) => n.id === action.payload);
        if (item) item.isRead = true;
      })
      .addCase(markAllRead.fulfilled, (state) => {
        state.items.forEach((n) => { n.isRead = true; });
      })
      .addCase(deleteNotification.fulfilled, (state, action) => {
        state.items = state.items.filter((n) => n.id !== action.payload);
      })
      .addCase(clearAllNotifications.fulfilled, (state) => {
        state.items = [];
      });
  },
});

export const unreadCount = (state) => state.notification.items.filter((n) => !n.isRead).length;

export const { setPushPermission } = notificationSlice.actions;
export default notificationSlice.reducer;
