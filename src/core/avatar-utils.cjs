function getPrivateAvatarUrl(qqId) {
  const id = String(qqId || '').trim();
  if (!id) {
    return '';
  }
  return `https://q1.qlogo.cn/g?b=qq&nk=${encodeURIComponent(id)}&s=100`;
}

function getGroupAvatarUrl(groupId) {
  const id = String(groupId || '').trim();
  if (!id) {
    return '';
  }
  return `https://p.qlogo.cn/gh/${encodeURIComponent(id)}/${encodeURIComponent(id)}/100`;
}

module.exports = {
  getPrivateAvatarUrl,
  getGroupAvatarUrl,
};
