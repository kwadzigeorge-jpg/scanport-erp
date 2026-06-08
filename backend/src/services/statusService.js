const { subMonths, differenceInDays } = require('date-fns');

function computeNoticeDate(expiryDate) {
  return subMonths(new Date(expiryDate), 4);
}

function computeDaysToExpiry(expiryDate) {
  return differenceInDays(new Date(expiryDate), new Date());
}

/**
 * Derive the operational status from dates + notification state.
 * EXPIRED takes highest priority.
 */
function computeStatus(expiryDate, noticeDate, noticeSent) {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const notice = new Date(noticeDate);

  if (today > expiry) return 'EXPIRED';
  if (noticeSent) return 'NOTICE_SENT';
  if (today >= notice) return 'NOTICE_DUE';
  return 'ACTIVE';
}

module.exports = { computeNoticeDate, computeDaysToExpiry, computeStatus };
