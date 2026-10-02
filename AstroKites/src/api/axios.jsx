import axios from 'axios';

const rawBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const baseURL = rawBaseURL.replace(/\/+$/, '');

// Create axios instance with base configuration
const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    },
});

// Generic helper to unwrap response
const unwrap = (resp) => (resp && resp.data ? resp.data : resp);
const toErrorPayload = (err) => {
    if (err?.response) {
        return { ok: false, status: err.response.status, error: err.response.data || err.message };
    }
    if (err?.request) {
        return { ok: false, status: 0, error: 'No response from server' };
    }
    return { ok: false, status: 0, error: err?.message || 'Unknown error' };
};

const postSafe = async (url, payload) => {
    try {
        const res = await api.post(url, payload);
        return { ok: true, status: res.status, data: unwrap(res) };
    } catch (err) {
        return toErrorPayload(err);
    }
};

// Backend.py endpoints

// POST /power-data
// payload: { lat, lon, start?, end?, parameters?=['T2M','PRECTOT','WS2M'], token?, timeout? }
export const postPowerData = async ({ lat, lon, start = null, end = null, parameters = ['T2M', 'PRECTOT', 'WS2M'], token = null, timeout = 60 }) => {
    const payload = { lat, lon, start, end, parameters, token, timeout };
    return await postSafe('/power-data', payload);
};

// POST /forecast
// payload: { lat, lon, start?, end?, parameters?=['T2M','PRECTOT','WS2M'], window?=7, token?, timeout? }
export const postForecast = async ({ lat, lon, start = null, end = null, parameters = ['T2M', 'PRECTOT', 'WS2M'], window = 7, token = null, timeout = 60 }) => {
    const payload = { lat, lon, start, end, parameters, window, token, timeout };
    return await postSafe('/forecast', payload);
};

// Convenience: forecast with only lat/lon (uses server defaults)
export const getForecastData = async (lat, lon) => {
    return await postSafe('/forecast', { lat, lon });
};

// POST /forecast-simple
// payload: { lat, lon, date: 'YYYY-MM-DD', ndays?=7, parameters?=['T2M','PRECTOT','WS2M'], window?=7, token?, timeout? }
export const postForecastSimple = async ({ lat, lon, date, ndays = 7, parameters = ['T2M', 'PRECTOT', 'WS2M'], window = 7, token = null, timeout = 60 }) => {
    const payload = { lat, lon, date, ndays, parameters, window, token, timeout };
    return await postSafe('/forecast-simple', payload);
};

// POST /check-date
// payload: { lat, lon, date: 'YYYY-MM-DD', ndays?=30, window?=7, thresholds?={hot_c,cold_c,wind_ms,rain_mm}, token?, timeout? }
export const postCheckDate = async ({ lat, lon, date, ndays = 30, window = 7, thresholds = null, token = null, timeout = 30 }) => {
    const payload = { lat, lon, date, ndays, window, thresholds, token, timeout };
    return await postSafe('/check-date', payload);
};

// POST /state-7day-forecast
// payload: { states: [{name,lat,lon}], phone?, send_sms?, hot_threshold_c?, heavy_rain_threshold_mm?, openweather_api_key? }
export const postStateSevenDayForecast = async ({ states, phone = null, send_sms = false, hot_threshold_c = 38.0, heavy_rain_threshold_mm = 50.0, openweather_api_key = null }) => {
    const payload = { states, phone, send_sms, hot_threshold_c, heavy_rain_threshold_mm, openweather_api_key };
    return await postSafe('/state-7day-forecast', payload);
};

// POST /send-sms
// payload: { phone: string, body: string }
export const postSendSms = async ({ phone, body }) => {
    const payload = { phone, body };
    return await postSafe('/send-sms', payload);
};
