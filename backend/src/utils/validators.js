// ISO 6346: 4 uppercase letters + 7 digits
const CONTAINER_REGEX = /^[A-Z]{4}\d{7}$/;

function validateContainerNumber(containerNumber) {
  if (!containerNumber || typeof containerNumber !== 'string') {
    return { valid: false, message: 'Container number is required.' };
  }
  const trimmed = containerNumber.trim().toUpperCase();
  if (!CONTAINER_REGEX.test(trimmed)) {
    return {
      valid: false,
      message: `Invalid container number format. Must be exactly 4 uppercase letters followed by 7 digits (e.g. HLBU2304692). Got: "${trimmed}"`,
    };
  }
  return { valid: true, value: trimmed };
}

function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return false;
  return /^[+\d][\d\s\-().]{6,19}$/.test(phone.trim());
}

module.exports = { validateContainerNumber, validatePhoneNumber };
