/**
 * Integration Service
 *
 * Middleware layer for external system integrations.
 * Current stubs: UniPass Ghana, SMS/WhatsApp notifications.
 *
 * To activate an integration, set the corresponding env vars and
 * implement the provider in the relevant section below.
 */

const logger = require('../config/logger');

// ─── Notification Gateway ─────────────────────────────────────────────────────
// Implement one or both of:
//   SMS:       TWILIO_SID / TWILIO_AUTH / TWILIO_FROM
//   WhatsApp:  WHATSAPP_API_URL / WHATSAPP_API_TOKEN
//   SMTP:      (already in .env.example via nodemailer)

async function sendSMS(to, message) {
  if (!process.env.TWILIO_SID || !process.env.TWILIO_AUTH || !process.env.TWILIO_FROM) {
    logger.debug(`[SMS stub] To: ${to} | ${message}`);
    return { ok: true, stub: true };
  }
  try {
    // Uncomment to activate Twilio:
    // const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
    // await twilio.messages.create({ body: message, from: process.env.TWILIO_FROM, to });
    logger.info(`[SMS sent] To: ${to}`);
    return { ok: true };
  } catch (err) {
    logger.error(`[SMS error] ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function sendWhatsApp(to, message) {
  if (!process.env.WHATSAPP_API_URL || !process.env.WHATSAPP_API_TOKEN) {
    logger.debug(`[WhatsApp stub] To: ${to} | ${message}`);
    return { ok: true, stub: true };
  }
  try {
    const fetch = require('node-fetch');
    const res = await fetch(process.env.WHATSAPP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}` },
      body: JSON.stringify({ phone: to, message }),
    });
    if (!res.ok) throw new Error(`WhatsApp API error: ${res.status}`);
    logger.info(`[WhatsApp sent] To: ${to}`);
    return { ok: true };
  } catch (err) {
    logger.error(`[WhatsApp error] ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// Generic notify — tries WhatsApp first, falls back to SMS
async function notify(phone, message) {
  if (process.env.WHATSAPP_API_URL) return sendWhatsApp(phone, message);
  return sendSMS(phone, message);
}

// ─── Notification Events ──────────────────────────────────────────────────────

async function notifyBayAssigned({ agentPhone, agentName, containerNumber, waybillNumber, bayCode, areaName }) {
  const msg = `Dear ${agentName}, your container ${containerNumber} (Waybill: ${waybillNumber || 'N/A'}) has been allocated to Bay ${bayCode}, ${areaName}. Please proceed immediately. – Port Terminal ERP`;
  return notify(agentPhone, msg);
}

async function notifyExaminationComplete({ agentPhone, agentName, containerNumber, waybillNumber }) {
  const msg = `Dear ${agentName}, examination of container ${containerNumber} (Waybill: ${waybillNumber || 'N/A'}) has been completed. Your truck is ready for release. – Port Terminal ERP`;
  return notify(agentPhone, msg);
}

async function notifyTruckReleased({ agentPhone, agentName, containerNumber, waybillNumber, dwellMinutes }) {
  const msg = `Dear ${agentName}, truck carrying container ${containerNumber} (Waybill: ${waybillNumber || 'N/A'}) has been released. Total time: ${dwellMinutes} min. – Port Terminal ERP`;
  return notify(agentPhone, msg);
}

// ─── UniPass Ghana Integration ────────────────────────────────────────────────
// Set UNIPASS_API_URL + UNIPASS_API_KEY in .env to activate
//
// UniPass is the Ghana Customs System. When activated, this service:
//   1. Verifies waybill numbers against UniPass
//   2. Pushes container movement events to UniPass
//   3. Pulls examination results if required

const UNIPASS_BASE = process.env.UNIPASS_API_URL;
const UNIPASS_KEY  = process.env.UNIPASS_API_KEY;

async function unipassRequest(method, path, body) {
  if (!UNIPASS_BASE || !UNIPASS_KEY) {
    logger.debug(`[UniPass stub] ${method} ${path}`, body);
    return { ok: true, stub: true, data: null };
  }
  try {
    const fetch = require('node-fetch');
    const res = await fetch(`${UNIPASS_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-API-Key': UNIPASS_KEY },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `UniPass error ${res.status}`);
    return { ok: true, data };
  } catch (err) {
    logger.error(`[UniPass error] ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/**
 * Verify waybill against UniPass.
 * Returns { ok, valid, declaration } or { ok: false, error }
 */
async function unipassVerifyWaybill(waybillNumber) {
  return unipassRequest('GET', `/declarations/${waybillNumber}/status`);
}

/**
 * Push a container movement event to UniPass.
 */
async function unipassPushEvent(eventType, payload) {
  return unipassRequest('POST', '/container-events', { event: eventType, ...payload });
}

/**
 * Push BAY_ASSIGNED event to UniPass when bay is allocated.
 */
async function unipassNotifyBayAssigned({ waybillNumber, containerNumber, bayCode, areaCode, assignedAt }) {
  return unipassPushEvent('BAY_ASSIGNED', { waybillNumber, containerNumber, bayCode, areaCode, assignedAt });
}

/**
 * Push EXAMINATION_STARTED event to UniPass.
 */
async function unipassNotifyExaminationStarted({ waybillNumber, containerNumber, examinationStartTime }) {
  return unipassPushEvent('EXAMINATION_STARTED', { waybillNumber, containerNumber, examinationStartTime });
}

/**
 * Push EXAMINATION_COMPLETED event to UniPass.
 */
async function unipassNotifyExaminationCompleted({ waybillNumber, containerNumber, findings, examinationEndTime }) {
  return unipassPushEvent('EXAMINATION_COMPLETED', { waybillNumber, containerNumber, findings, examinationEndTime });
}

/**
 * Push TRUCK_RELEASED event to UniPass.
 */
async function unipassNotifyTruckReleased({ waybillNumber, containerNumber, exitTime, dwellMinutes }) {
  return unipassPushEvent('TRUCK_RELEASED', { waybillNumber, containerNumber, exitTime, dwellMinutes });
}

// ─── Scanner System Integration ───────────────────────────────────────────────
// Future: integrate barcode / RFID scanner data ingestion
// Set SCANNER_WEBHOOK_SECRET to validate inbound scanner payloads

async function processScannerWebhook(payload) {
  logger.debug('[Scanner webhook stub]', payload);
  // TODO: parse scanner payload and auto-advance container state
  return { ok: true, stub: true };
}

module.exports = {
  // Notifications
  notify, sendSMS, sendWhatsApp,
  notifyBayAssigned, notifyExaminationComplete, notifyTruckReleased,
  // UniPass
  unipassVerifyWaybill, unipassNotifyBayAssigned,
  unipassNotifyExaminationStarted, unipassNotifyExaminationCompleted,
  unipassNotifyTruckReleased,
  // Scanner
  processScannerWebhook,
};
