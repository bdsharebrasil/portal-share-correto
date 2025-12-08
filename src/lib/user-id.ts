export function getShortUserId(userId: string): string {
  if (!userId) return '';
  return userId.substring(0, 3).toUpperCase();
}

export function getIdBadgeColor(shortId: string): string {
  if (!shortId) return 'bg-gray-200';
  
  const code = shortId.charCodeAt(0);
  const colors = [
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-red-100 text-red-800',
    'bg-yellow-100 text-yellow-800',
    'bg-purple-100 text-purple-800',
    'bg-pink-100 text-pink-800',
    'bg-indigo-100 text-indigo-800',
    'bg-cyan-100 text-cyan-800'
  ];
  
  return colors[code % colors.length];
}
