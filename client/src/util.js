export const money = (cents) => `R${(cents / 100).toFixed(2)}`;

export const timeOf = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

export const dateTime = (iso) =>
  iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export const STATUS_LABEL = {
  placed: 'Sent to stores',
  preparing: 'Being prepared',
  ready_for_pickup: 'Ready for driver',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const STATUS_BADGE = {
  placed: 'badge-pending',
  preparing: 'badge-pending',
  ready_for_pickup: 'badge-ready',
  out_for_delivery: 'badge-info',
  delivered: 'badge-delivered',
  cancelled: 'badge-cancelled',
};

export const STORE_STEP = { pending: 'Waiting', preparing: 'Preparing', ready: 'Ready' };

export const CATEGORIES = ['Fast food', 'Pizza', 'Restaurant', 'Groceries', 'Community'];
