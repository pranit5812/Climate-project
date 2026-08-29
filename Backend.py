

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from fastapi.middleware.cors import CORSMiddleware
import urllib.request, urllib.error, urllib.parse, json, csv, datetime, os, math, base64
import numpy as np


# ---------------- .env loader ----------------
def _load_env_from_dotenv():
    """
    Lightweight .env loader for this backend only.
    Reads key=value lines from Astrovantage_17.6/.env and sets os.environ,
    so we can keep secrets (Twilio, etc.) there.
    """
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        env_path = os.path.join(base_dir, ".env")
        if not os.path.exists(env_path):
            return
        with open(env_path, "r", encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip()
                # Strip optional quotes
                if ((value.startswith('"') and value.endswith('"')) or
                        (value.startswith("'") and value.endswith("'"))):
                    value = value[1:-1]
                key = key.strip("\ufeff")  # strip BOM if present
                os.environ[key] = value
    except Exception:
        # Fail silently; we don't want .env issues to crash the app
        pass


# Load .env once at import time
_load_env_from_dotenv()


# ---------------- Utilities ----------------
def day_of_year(d): return (d - datetime.date(d.year, 1, 1)).days + 1


# ---------------- HTTP helpers ----------------
def _download_url_bytes(url, token=None, timeout=60):
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "NASA-Power-API/1.0 (+https://example.org)")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(), resp.getcode()


# ---------------- POWER JSON parsing & robust selection ----------------
def parse_power_json_to_series(j, parameter_key):
    try:
        pdata = j['properties']['parameter'][parameter_key]
    except Exception:
        raise ValueError(f"No parameter {parameter_key} in POWER JSON response.")
    dates, vals = [], []
    for k, v in sorted(pdata.items()):
        if len(k) != 8:
            continue
        try:
            dt = datetime.date(int(k[:4]), int(k[4:6]), int(k[6:8]))
        except Exception:
            continue
        try:
            val = float(v)
            if val == -999 or math.isnan(val):
                val = np.nan
        except:
            val = np.nan
        dates.append(dt); vals.append(val)
    if len(dates) == 0:
        raise ValueError("No numeric date rows found in POWER JSON for parameter " + parameter_key)
    return dates, np.array(vals, dtype=float)


def choose_best_key_for_target(j, desired_target):
    try:
        keys = list(j['properties']['parameter'].keys())
    except Exception:
        return None
    lower_keys = [k.lower() for k in keys]
    for k in keys:
        if k.upper() == desired_target.upper():
            return k
    target = desired_target.lower()
    if 'prec' in target or 'prectot' in target:
        for i, k in enumerate(lower_keys):
            if 'prec' in k or 'prectot' in k: return keys[i]
    # AOD support removed
    if 't2m' in target or 't2' in target or 'temp' in target:
        for i, k in enumerate(lower_keys):
            if 't2m' in k or k.endswith('t2m') or 'temp' in k or 'air_temperature' in k: return keys[i]
    if 'ws' in target or 'wind' in target:
        for i, k in enumerate(lower_keys):
            if 'ws2m' in k or 'wind' in k or 'ws' in k: return keys[i]
    for i, k in enumerate(lower_keys):
        if desired_target.lower() in k:
            return keys[i]
    return None


def fetch_power_json_with_fallback_and_key_mapping(lat, lon, desired_params, start_yyyymmdd, end_yyyymmdd, token=None, timeout=60):
    base = "https://power.larc.nasa.gov/api/temporal/daily/point"
    candidate_names = set(desired_params)
    extra = [
        'PRECTOTCORR', 'PRECTOTCORR8', 'PRECTOT_C', 'PRECTOT_CORR',
        'T2M', 'T2', 'T2M_AVG', 'TMP', 'AIR_TEMPERATURE',
        'WS2M', 'WIND', 'WS'
    ]
    for e in extra: candidate_names.add(e)
    paramstr = ",".join(sorted(candidate_names))
    url_multi = f"{base}?parameters={paramstr}&community=AG&longitude={lon}&latitude={lat}&start={start_yyyymmdd}&end={end_yyyymmdd}&format=JSON"
    out = {p: (None, None) for p in desired_params}
    try:
        raw, _ = _download_url_bytes(url_multi, token=token, timeout=timeout)
        j = json.loads(raw.decode('utf-8'))
        for p in desired_params:
            key = choose_best_key_for_target(j, p)
            if key:
                try:
                    dates, vals = parse_power_json_to_series(j, key)
                    out[p] = (dates, vals)
                except Exception:
                    out[p] = (None, None)
        for p in desired_params:
            if out[p][0] is not None:
                continue
            tries = [p]
            if p.upper() == 'PRECTOT':
                tries += ['PRECTOTCORR', 'PRECTOTCORR8', 'PRECTOT_C', 'PRECTOT_CORR']
            # AOD support removed
            if p.upper() == 'T2M':
                tries += ['T2M', 'T2', 'T2M_AVG', 'TMP', 'AIR_TEMPERATURE']
            if p.upper() == 'WS2M':
                tries += ['WS2M', 'WIND', 'WS']
            fetched = False
            for pr in tries:
                try:
                    url_p = f"{base}?parameters={pr}&community=AG&longitude={lon}&latitude={lat}&start={start_yyyymmdd}&end={end_yyyymmdd}&format=JSON"
                    raw_p, _ = _download_url_bytes(url_p, token=token, timeout=timeout)
                    jp = json.loads(raw_p.decode('utf-8'))
                    key = choose_best_key_for_target(jp, p) or pr
                    dates, vals = parse_power_json_to_series(jp, key)
                    out[p] = (dates, vals)
                    fetched = True
                    break
                except Exception:
                    continue
            if not fetched:
                out[p] = (None, None)
        return out
    except urllib.error.HTTPError:
        per = {}
        for p in desired_params:
            per[p] = (None, None)
            tries = [p]
            if p.upper() == 'PRECTOT':
                tries += ['PRECTOTCORR', 'PRECTOTCORR8']
            # AOD support removed
            for pr in tries:
                try:
                    url_p = f"{base}?parameters={pr}&community=AG&longitude={lon}&latitude={lat}&start={start_yyyymmdd}&end={end_yyyymmdd}&format=JSON"
                    raw_p, _ = _download_url_bytes(url_p, token=token, timeout=timeout)
                    jp = json.loads(raw_p.decode('utf-8'))
                    key = choose_best_key_for_target(jp, p) or pr
                    dates, vals = parse_power_json_to_series(jp, key)
                    per[p] = (dates, vals)
                    break
                except Exception:
                    continue
        return per
    except Exception:
        per = {}
        for p in desired_params:
            per[p] = (None, None)
            tries = [p]
            if p.upper() == 'PRECTOT':
                tries += ['PRECTOTCORR', 'PRECTOTCORR8']
            # AOD support removed
            for pr in tries:
                try:
                    url_p = f"{base}?parameters={pr}&community=AG&longitude={lon}&latitude={lat}&start={start_yyyymmdd}&end={end_yyyymmdd}&format=JSON"
                    raw_p, _ = _download_url_bytes(url_p, token=token, timeout=timeout)
                    jp = json.loads(raw_p.decode('utf-8'))
                    key = choose_best_key_for_target(jp, p) or pr
                    dates, vals = parse_power_json_to_series(jp, key)
                    per[p] = (dates, vals)
                    break
                except Exception:
                    continue
        return per


# ---------------- Forecast helpers ----------------
def compute_daily_forecast_from_hist(hist_dates, hist_values, start_date, ndays, window=7, threshold=1.0):
    hist_doy = np.array([day_of_year(d) for d in hist_dates])
    future_dates = [start_date + datetime.timedelta(days=i) for i in range(ndays)]
    means = np.full(ndays, np.nan); probs = np.full(ndays, np.nan); nsamps = np.zeros(ndays, dtype=int)
    for k, fd in enumerate(future_dates):
        qdoy = day_of_year(fd)
        diffs = np.abs(hist_doy - qdoy)
        diffs = np.minimum(diffs, 365 - diffs)
        mask = diffs <= window
        samples = hist_values[mask]
        samples = samples[~np.isnan(samples)]
        nsamps[k] = len(samples)
        if len(samples) > 0:
            means[k] = float(np.mean(samples)); probs[k] = float(np.sum(samples > threshold) / len(samples))
    return {'dates': future_dates, 'mean': means, 'prob': probs, 'nsamples': nsamps}


def aggregate_to_monthly(hist_dates, hist_values):
    pairs = [(d.year, d.month) for d in hist_dates]
    unique = sorted(list(set(pairs)))
    monthly, centers = [], []
    for yr, mo in unique:
        idx = [i for i, (y, m) in enumerate(pairs) if y == yr and m == mo]
        total = np.nansum(hist_values[idx])
        monthly.append(float(total)); centers.append(datetime.date(yr, mo, 15))
    return centers, np.array(monthly, dtype=float)


# ---------------- Single-date classification ----------------
def classify_conditions_for_date_from_hist(hist_map, lon, lat, date_obj, window=7, thresholds=None):
    if thresholds is None:
        thresholds = {'hot_c': 35.0, 'cold_c': 5.0, 'wind_ms': 10.0, 'rain_mm': 5.0}
    res = {}
    problems = []
    def compute_prob_for_series(hist_dates, hist_vals, target_date, window, thresh=None, greater=True):
        if hist_dates is None: return None
        hdoy = np.array([day_of_year(d) for d in hist_dates])
        qdoy = day_of_year(target_date)
        diffs = np.abs(hdoy - qdoy)
        diffs = np.minimum(diffs, 365 - diffs)
        mask = diffs <= window
        samples = hist_vals[mask]
        samples = samples[~np.isnan(samples)]
        n = len(samples)
        if n == 0: return {'n':0, 'mean':None, 'prob':None}
        meanv = float(np.mean(samples))
        if thresh is None:
            prob = None
        else:
            if greater:
                prob = float(np.sum(samples > thresh) / n)
            else:
                prob = float(np.sum(samples < thresh) / n)
        return {'n':n, 'mean':meanv, 'prob':prob}
    # Temperature
    td = hist_map.get('T2M', (None, None))
    tp = compute_prob_for_series(td[0], td[1], date_obj, window, thresh=thresholds['hot_c'], greater=True) if td[0] is not None else None
    tc = compute_prob_for_series(td[0], td[1], date_obj, window, thresh=thresholds['cold_c'], greater=False) if td[0] is not None else None
    if tp is None or tc is None:
        res['Temperature'] = 'No data'
    else:
        res['Temperature_samples'] = f"{tp['n']}"
        res['Temp_mean_degC'] = f"{tp['mean']:.2f}" if tp['mean'] is not None else 'n/a'
        res['Prob_hot_>{:.1f}C'.format(thresholds['hot_c'])] = f"{tp['prob']:.3f}" if tp['prob'] is not None else 'n/a'
        res['Prob_cold_<{:.1f}C'.format(thresholds['cold_c'])] = f"{tc['prob']:.3f}" if tc['prob'] is not None else 'n/a'
        if tp['prob'] is not None and tp['prob'] >= 0.6:
            problems.append(f"Very likely HOT (>{thresholds['hot_c']} °C): {tp['prob']*100:.0f}%")
        if tc['prob'] is not None and tc['prob'] >= 0.6:
            problems.append(f"Very likely COLD (<{thresholds['cold_c']} °C): {tc['prob']*100:.0f}%")
    # Precipitation
    pd = hist_map.get('PRECTOT', (None, None))
    pp = compute_prob_for_series(pd[0], pd[1], date_obj, window, thresh=thresholds['rain_mm'], greater=True) if pd[0] is not None else None
    if pp is None:
        res['Precipitation'] = 'No data'
    else:
        res['Precip_samples'] = f"{pp['n']}"
        res['Precip_mean_mm'] = f"{pp['mean']:.2f}" if pp['mean'] is not None else 'n/a'
        res['Prob_rain_>={:.1f}mm'.format(thresholds['rain_mm'])] = f"{pp['prob']:.3f}" if pp['prob'] is not None else 'n/a'
        if pp['prob'] is not None and pp['prob'] >= 0.5:
            problems.append(f"Likely rainy (≥{thresholds['rain_mm']} mm/day): {pp['prob']*100:.0f}%")
    # Wind
    wd = hist_map.get('WS2M', (None, None))
    wp = compute_prob_for_series(wd[0], wd[1], date_obj, window, thresh=thresholds['wind_ms'], greater=True) if wd[0] is not None else None
    if wp is None:
        res['Wind'] = 'No data'
    else:
        res['Wind_samples'] = f"{wp['n']}"
        res['Wind_mean_mps'] = f"{wp['mean']:.2f}" if wp['mean'] is not None else 'n/a'
        res['Prob_wind_>={:.1f}m/s'.format(thresholds['wind_ms'])] = f"{wp['prob']:.3f}" if wp['prob'] is not None else 'n/a'
        if wp['prob'] is not None and wp['prob'] >= 0.5:
            problems.append(f"Likely windy (≥{thresholds['wind_ms']} m/s): {wp['prob']*100:.0f}%")
    # AOD support removed
    if not problems:
        summary = "Conditions are not strongly unfavorable based on historical probabilities for that date. You may still want to check short-term forecasts near the date."
    else:
        summary = "Potential issues based on historical probabilities:\n" + "\n".join([" - " + p for p in problems])
        if any("Very likely" in p for p in problems) or len(problems) >= 2:
            summary += "\n\nOverall: NOT FAVOURABLE to go out (based on historical probabilities)."
        else:
            summary += "\n\nOverall: CAUTION recommended."
    return summary, res


def classify_conditions_for_date_range_from_hist(hist_map, lon, lat, start_date, ndays, window=7, thresholds=None):
    if thresholds is None:
        thresholds = {'hot_c': 35.0, 'cold_c': 5.0, 'wind_ms': 10.0, 'rain_mm': 5.0, 'heavy_rain_mm': 20.0}
    
    td = hist_map.get('T2M', (None, None))
    pd = hist_map.get('PRECTOT', (None, None))
    wd = hist_map.get('WS2M', (None, None))

    td_doy = np.array([day_of_year(d) for d in td[0]]) if td[0] is not None else None
    pd_doy = np.array([day_of_year(d) for d in pd[0]]) if pd[0] is not None else None
    wd_doy = np.array([day_of_year(d) for d in wd[0]]) if wd[0] is not None else None

    daily_predictions = []
    
    for i in range(ndays):
        target_date = start_date + datetime.timedelta(days=i)
        qdoy = day_of_year(target_date)

        def get_series_stats(doy_arr, vals_arr, thresh_hot=None, thresh_cold=None, thresh_rain=None, thresh_heavy_rain=None, thresh_wind=None):
            if doy_arr is None or vals_arr is None or len(vals_arr) == 0:
                return {'samples': 0, 'mean': None, 'min': None, 'max': None, 'hot_prob': 0, 'cold_prob': 0, 'rain_prob': 0, 'heavy_rain_prob': 0, 'windy_prob': 0}
            
            diffs = np.abs(doy_arr - qdoy)
            diffs = np.minimum(diffs, 365 - diffs)
            mask = diffs <= window
            samples = vals_arr[mask]
            samples = samples[~np.isnan(samples)]
            n = len(samples)
            if n == 0:
                return {'samples': 0, 'mean': None, 'min': None, 'max': None, 'hot_prob': 0, 'cold_prob': 0, 'rain_prob': 0, 'heavy_rain_prob': 0, 'windy_prob': 0}
            
            mean_v = float(np.mean(samples))
            min_v = float(np.min(samples))
            max_v = float(np.max(samples))
            
            hot_prob = round(float(np.sum(samples > thresh_hot) / n * 100)) if thresh_hot is not None else 0
            cold_prob = round(float(np.sum(samples < thresh_cold) / n * 100)) if thresh_cold is not None else 0
            rain_prob = round(float(np.sum(samples >= thresh_rain) / n * 100)) if thresh_rain is not None else 0
            heavy_rain_prob = round(float(np.sum(samples >= thresh_heavy_rain) / n * 100)) if thresh_heavy_rain is not None else 0
            windy_prob = round(float(np.sum(samples >= thresh_wind) / n * 100)) if thresh_wind is not None else 0
            
            return {
                'samples': n,
                'mean': round(mean_v, 2),
                'min': round(min_v, 2),
                'max': round(max_v, 2),
                'hot_prob': hot_prob,
                'cold_prob': cold_prob,
                'rain_prob': rain_prob,
                'heavy_rain_prob': heavy_rain_prob,
                'windy_prob': windy_prob
            }

        t_stats = get_series_stats(td_doy, td[1], thresh_hot=thresholds.get('hot_c', 35.0), thresh_cold=thresholds.get('cold_c', 5.0))
        p_stats = get_series_stats(pd_doy, pd[1], thresh_rain=thresholds.get('rain_mm', 5.0), thresh_heavy_rain=thresholds.get('heavy_rain_mm', 20.0))
        w_stats = get_series_stats(wd_doy, wd[1], thresh_wind=thresholds.get('wind_ms', 10.0))

        sample_counts = [s for s in [t_stats['samples'], p_stats['samples'], w_stats['samples']] if s > 0]
        avg_samples = np.mean(sample_counts) if sample_counts else 0
        confidence = round(min(0.95, max(0.40, float(avg_samples) / 150.0)), 2)

        daily_predictions.append({
            "date": target_date.isoformat(),
            "temperature_mean": t_stats['mean'],
            "temperature_min": t_stats['min'],
            "temperature_max": t_stats['max'],
            "hot_probability": t_stats['hot_prob'],
            "cold_probability": t_stats['cold_prob'],
            "rainfall_mean": p_stats['mean'],
            "rain_probability": p_stats['rain_prob'],
            "heavy_rain_probability": p_stats['heavy_rain_prob'],
            "wind_mean": w_stats['mean'],
            "windy_probability": w_stats['windy_prob'],
            "confidence": confidence
        })

    valid_temps = [d['temperature_mean'] for d in daily_predictions if d['temperature_mean'] is not None]
    max_temps = [d['temperature_max'] for d in daily_predictions if d['temperature_max'] is not None]
    min_temps = [d['temperature_min'] for d in daily_predictions if d['temperature_min'] is not None]
    
    valid_rains = [d['rainfall_mean'] for d in daily_predictions if d['rainfall_mean'] is not None]
    valid_rain_probs = [d['rain_probability'] for d in daily_predictions if d['rain_probability'] is not None]
    valid_heavy_rain_probs = [d['heavy_rain_probability'] for d in daily_predictions if d['heavy_rain_probability'] is not None]
    
    valid_winds = [d['wind_mean'] for d in daily_predictions if d['wind_mean'] is not None]
    valid_wind_probs = [d['windy_probability'] for d in daily_predictions if d['windy_probability'] is not None]
    valid_confidences = [d['confidence'] for d in daily_predictions if d['confidence'] is not None]

    summary_data = {
        "temp_avg": round(float(np.mean(valid_temps)), 1) if valid_temps else None,
        "temp_max": round(float(np.max(max_temps)), 1) if max_temps else None,
        "temp_min": round(float(np.min(min_temps)), 1) if min_temps else None,
        "hot_days_count": sum(1 for d in daily_predictions if d['hot_probability'] >= 30),
        "hot_days_prob": round(float(np.mean([d['hot_probability'] for d in daily_predictions])), 1) if daily_predictions else 0,
        "cold_days_count": sum(1 for d in daily_predictions if d['cold_probability'] >= 30),
        "cold_days_prob": round(float(np.mean([d['cold_probability'] for d in daily_predictions])), 1) if daily_predictions else 0,
        
        "rain_avg_daily": round(float(np.mean(valid_rains)), 2) if valid_rains else None,
        "rain_total_expected": round(float(np.sum(valid_rains)), 2) if valid_rains else 0,
        "rain_days_count": sum(1 for d in daily_predictions if d['rain_probability'] >= 30 or (d['rainfall_mean'] is not None and d['rainfall_mean'] >= 5.0)),
        "rain_prob_avg": round(float(np.mean(valid_rain_probs)), 1) if valid_rain_probs else 0,
        "heavy_rain_prob_avg": round(float(np.mean(valid_heavy_rain_probs)), 1) if valid_heavy_rain_probs else 0,
        
        "wind_avg": round(float(np.mean(valid_winds)), 2) if valid_winds else None,
        "wind_max": round(float(np.max(valid_winds)), 2) if valid_winds else None,
        "windy_prob_avg": round(float(np.mean(valid_wind_probs)), 1) if valid_wind_probs else 0,
        
        "overall_confidence": round(float(np.mean(valid_confidences)), 2) if valid_confidences else 0.85
    }

    return summary_data, daily_predictions



# ---------------- Utilities for JSON serialization ----------------
def series_to_json(dates_vals_tuple):
    d, v = dates_vals_tuple
    if d is None or v is None:
        return None
    return {'dates': [dt.isoformat() for dt in d], 'values': [None if (isinstance(x, float) and math.isnan(x)) else float(x) for x in v.tolist()]}


def _fetch_openweather_daily(lat, lon, api_key, ndays=7, timeout=20):
    """
    Fetch 7-day daily forecast from OpenWeather One Call (metric units).
    Returns list of daily entries or raises on error.
    """
    if not api_key:
        raise ValueError("Missing OpenWeather API key")
    base = "https://api.openweathermap.org/data/3.0/onecall"
    qs = urllib.parse.urlencode({
        "lat": f"{lat:.6f}",
        "lon": f"{lon:.6f}",
        "exclude": "current,minutely,hourly,alerts",
        "units": "metric",
        "appid": api_key,
    })
    url = f"{base}?{qs}"
    raw, _code = _download_url_bytes(url, timeout=timeout)
    j = json.loads(raw.decode("utf-8"))
    daily = j.get("daily", [])
    return daily[:ndays]


def _twilio_send_sms(to_number, body):
    """
    Send SMS using Twilio REST API.
    Reads TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER from environment.
    Returns dict with sent: bool and optional error.
    """
    def _clean_env_value(value):
        if value is None:
            return None
        # Trim spaces and accidental wrapping quotes from env values.
        return str(value).strip().strip('"').strip("'").strip()

    sid = _clean_env_value(os.environ.get("TWILIO_ACCOUNT_SID"))
    token = _clean_env_value(os.environ.get("TWILIO_AUTH_TOKEN"))
    from_number = _clean_env_value(os.environ.get("TWILIO_FROM_NUMBER"))
    messaging_service_sid = _clean_env_value(os.environ.get("TWILIO_MESSAGING_SERVICE_SID"))
    # Twilio Messaging Service SID pattern: MG + 32 hex chars.
    if messaging_service_sid and (not messaging_service_sid.startswith("MG") or len(messaging_service_sid) != 34):
        messaging_service_sid = None
    if not (sid and token and (from_number or messaging_service_sid)):
        return {"sent": False, "error": "Missing Twilio configuration in environment."}
    if not to_number:
        return {"sent": False, "error": "No destination phone number provided."}
    # Basic normalization: if user typed a raw 10- or 11-digit Indian mobile, add +91 prefix
    raw = str(to_number).strip()
    if raw.startswith("+"):
        norm_to = raw
    else:
        digits = "".join(ch for ch in raw if ch.isdigit())
        if len(digits) == 10:
            # Assume Indian mobile without country code
            norm_to = "+91" + digits
        elif len(digits) == 11 and digits.startswith("0"):
            # Strip leading 0 and add +91
            norm_to = "+91" + digits[1:]
        else:
            # Fallback: let Twilio validate whatever was provided
            norm_to = raw
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    payload_dict = {
        "To": norm_to,
        "Body": body,
    }
    # Prefer Messaging Service SID if configured, otherwise use From number
    if messaging_service_sid:
        payload_dict["MessagingServiceSid"] = messaging_service_sid
    else:
        payload_dict["From"] = from_number
    payload = urllib.parse.urlencode(payload_dict).encode("utf-8")
    req = urllib.request.Request(url, data=payload)
    auth = base64.b64encode(f"{sid}:{token}".encode("utf-8")).decode("ascii")
    req.add_header("Authorization", f"Basic {auth}")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            _ = resp.read()
        return {"sent": True}
    except urllib.error.HTTPError as e:
        # Include Twilio's response body to help debug 400/401/etc.
        try:
            err_body = e.read().decode("utf-8", errors="ignore")
        except Exception:
            err_body = ""
        return {
            "sent": False,
            "error": f"HTTPError {e.code} {e.reason}: {err_body}",
        }
    except Exception as e:
        return {"sent": False, "error": str(e)}



# ---------------- FastAPI app & models ----------------
app = FastAPI(title="NASA POWER Backend API (single-file)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PowerDataRequest(BaseModel):
    lat: float = Field(...)
    lon: float = Field(...)
    start: Optional[str] = None
    end: Optional[str] = None
    parameters: Optional[List[str]] = None
    token: Optional[str] = None
    timeout: Optional[int] = 60
    stats_dates: Optional[List[int]] = None  # Days of month to get statistics for


class ForecastRequest(BaseModel):
    lat: float
    lon: float
    start: Optional[str] = None
    end: Optional[str] = None
    parameters: Optional[List[str]] = None
    window: Optional[int] = 7
    token: Optional[str] = None
    timeout: Optional[int] = 60


class ForecastSimpleRequest(BaseModel):
    lat: float
    lon: float
    date: str
    ndays: int = 7
    parameters: Optional[List[str]] = None
    window: Optional[int] = 7
    token: Optional[str] = None
    timeout: Optional[int] = 60


class CheckDateRequest(BaseModel):
    lat: float
    lon: float
    date: str
    ndays: Optional[int] = 30
    days: Optional[int] = None
    window: Optional[int] = 7
    thresholds: Optional[Dict[str, float]] = None
    token: Optional[str] = None
    timeout: Optional[int] = 30


class StateLocation(BaseModel):
    name: str
    lat: float
    lon: float


class StateSevenDayForecastRequest(BaseModel):
    states: List[StateLocation]
    phone: Optional[str] = None
    send_sms: bool = False
    hot_threshold_c: float = 38.0
    heavy_rain_threshold_mm: float = 50.0
    openweather_api_key: Optional[str] = None


class SmsRequest(BaseModel):
    phone: str
    body: str


@app.post("/power-data")
def power_data(req: PowerDataRequest):
    start = req.start 
    # Use a date 7 days ago to ensure we get the most recent available data
    # NASA POWER API can have delays in data availability
    today = datetime.date.today()
    safe_end_date = today 
    
    # If user provided an end date, use it; otherwise use our calculated safe date
    end = req.end 
    
    # Ensure end date is not in the future
    if end > today.strftime("%Y%m%d"):
        end = today.strftime("%Y%m%d")
    
    parameters = req.parameters or ['T2M','PRECTOT','WS2M']
    
    # Try with the specified end date first
    try:
        results = fetch_power_json_with_fallback_and_key_mapping(req.lat, req.lon, parameters, start, end, token=req.token, timeout=req.timeout or 60)
        
        # Check if we got valid data
        has_valid_data = False
        for p, (dates, values) in results.items():
            if dates is not None and len(dates) > 0:
                has_valid_data = True
                break
        
        # If no valid data, try with an earlier end date
        if not has_valid_data and not req.end:
            earlier_end = (today - datetime.timedelta(days=30)).strftime("%Y%m%d")
            results = fetch_power_json_with_fallback_and_key_mapping(req.lat, req.lon, parameters, start, earlier_end, token=req.token, timeout=req.timeout or 60)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch POWER data: {e}")
    
    out = {}
    for p, (d, v) in results.items():
        out[p] = series_to_json((d, v))
    available = [p for p, val in out.items() if val is not None]
    
    # Add statistics for specific dates if requested
    stats = {}
    if req.stats_dates and has_valid_data:
        for day in req.stats_dates:
            stats[day] = {}
            for p, (dates, values) in results.items():
                if dates is None or len(dates) == 0:
                    continue
                    
                # Find dates that match the requested day of month
                matching_indices = [i for i, date in enumerate(dates) if date.day == day]
                if matching_indices:
                    matching_values = [values[i] for i in matching_indices]
                    matching_values = [v for v in matching_values if not (isinstance(v, float) and math.isnan(v))]
                    
                    if matching_values:
                        stats[day][p] = {
                            "dates": [dates[i].isoformat() for i in matching_indices],
                            "values": [round(float(values[i]), 2) for i in matching_indices if not (isinstance(values[i], float) and math.isnan(values[i]))],
                            "mean": round(float(np.mean(matching_values)), 2),
                            "min": round(float(np.min(matching_values)), 2),
                            "max": round(float(np.max(matching_values)), 2),
                            "count": len(matching_values)
                        }
    
    return {"available": available, "data": out, "stats": stats if req.stats_dates else None}


@app.post("/forecast")
def forecast(req: ForecastRequest):
    start = req.start or "20010101"
    # Use a date 7 days ago to ensure we get the most recent available data
    # NASA POWER API can have delays in data availability
    today = datetime.date.today()
    safe_end_date = today - datetime.timedelta(days=7)
    
    # If user provided an end date, use it; otherwise use our calculated safe date
    end = req.end or safe_end_date.strftime("%Y%m%d")
    
    # Ensure end date is not in the future
    if end > today.strftime("%Y%m%d"):
        end = today.strftime("%Y%m%d")
        
    parameters = req.parameters or ['T2M','PRECTOT','WS2M']
    
    # Try with the specified end date first
    try:
        hist = fetch_power_json_with_fallback_and_key_mapping(req.lat, req.lon, parameters, start, end, token=req.token, timeout=req.timeout or 60)
        
        # Check if we got valid data
        has_valid_data = False
        for p, (dates, values) in hist.items():
            if dates is not None and len(dates) > 0:
                has_valid_data = True
                break
        
        # If no valid data, try with an earlier end date
        if not has_valid_data and not req.end:
            earlier_end = (today - datetime.timedelta(days=30)).strftime("%Y%m%d")
            hist = fetch_power_json_with_fallback_and_key_mapping(req.lat, req.lon, parameters, start, earlier_end, token=req.token, timeout=req.timeout or 60)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch POWER data: {e}")
    daily_forecast = {}
    monthly_forecast = {}
    try:
        start_date = datetime.date.today() + datetime.timedelta(days=1)
        window = int(req.window or 7)
        for p in parameters:
            dates_vals = hist.get(p, (None, None))
            if dates_vals[0] is None:
                daily_forecast[p] = None
                monthly_forecast[p] = None
                continue
            hist_dates, hist_vals = dates_vals
            df = compute_daily_forecast_from_hist(hist_dates, hist_vals, start_date, 183, window=window, threshold=1.0)
            daily_forecast[p] = {'dates': [d.isoformat() for d in df['dates']],
                                 'mean': [None if math.isnan(x) else float(x) for x in df['mean'].tolist()],
                                 'prob': [None if math.isnan(x) else float(x) for x in df['prob'].tolist()],
                                 'nsamples': df['nsamples'].tolist()}
            try:
                m_dates, m_vals = aggregate_to_monthly(hist_dates, hist_vals)
                if len(m_vals) >= 2:
                    idx = np.arange(1, len(m_vals) + 1)
                    pfit = np.polyfit(idx, m_vals, 1)
                    future_idx = np.arange(len(m_vals) + 1, len(m_vals) + 7)
                    trend_f = np.polyval(pfit, future_idx)
                else:
                    trend_f = np.full(6, np.nan)
                months_of_hist = np.array([d.month for d in m_dates])
                clim_f = np.zeros(6)
                lastdv = m_dates[-1] if m_dates else datetime.date.today()
                startmon = lastdv.month + 1; startyr = lastdv.year
                for k in range(6):
                    monnum = ((startmon + k - 1) % 12) + 1
                    vals = m_vals[months_of_hist == monnum]
                    clim_f[k] = np.mean(vals) if len(vals) > 0 else (np.nanmean(m_vals) if len(m_vals) > 0 else 0.0)
                combined = 0.5 * trend_f + 0.5 * clim_f
                forecast_dates = []
                for k in range(6):
                    m = startmon + k; yr = startyr + (m - 1) // 12; mo = ((m - 1) % 12) + 1
                    forecast_dates.append(datetime.date(yr, mo, 15))
                monthly_forecast[p] = {
                    'hist_dates': [d.isoformat() for d in m_dates],
                    'hist_values': [None if math.isnan(x) else float(x) for x in m_vals.tolist()],
                    'forecast_dates': [d.isoformat() for d in forecast_dates],
                    'trend': [None if math.isnan(x) else float(x) for x in trend_f.tolist()],
                    'clim': [None if math.isnan(x) else float(x) for x in clim_f.tolist()],
                    'combined': [None if math.isnan(x) else float(x) for x in combined.tolist()]
                }
            except Exception:
                monthly_forecast[p] = None
        return {'daily_forecast': daily_forecast, 'monthly_forecast': monthly_forecast, 'available': [p for p in parameters if daily_forecast.get(p) is not None]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build forecasts: {e}")


@app.post("/forecast-simple")
def forecast_simple(req: ForecastSimpleRequest):
    try:
        start_date = datetime.datetime.strptime(req.date, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format; use YYYY-MM-DD")
    hist_start = "20010101"
    hist_end = (datetime.date.today() - datetime.timedelta(days=1)).strftime("%Y%m%d")
    parameters = req.parameters or ['T2M','PRECTOT','WS2M']
    try:
        hist = fetch_power_json_with_fallback_and_key_mapping(req.lat, req.lon, parameters, hist_start, hist_end, token=req.token, timeout=req.timeout or 60)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch POWER data: {e}")
    out = {}
    for p in parameters:
        dates_vals = hist.get(p, (None, None))
        if dates_vals[0] is None:
            out[p] = None
            continue
        df = compute_daily_forecast_from_hist(dates_vals[0], dates_vals[1], start_date, req.ndays or 7, window=req.window or 7)
        out[p] = {
            'dates': [d.isoformat() for d in df['dates']],
            'mean': [None if math.isnan(x) else float(x) for x in df['mean'].tolist()],
            'prob': [None if math.isnan(x) else float(x) for x in df['prob'].tolist()],
            'nsamples': df['nsamples'].tolist()
        }
    return {'start': start_date.isoformat(), 'ndays': req.ndays, 'forecast': out}


@app.post("/check-date")
def check_date(req: CheckDateRequest):
    try:
        dt = datetime.datetime.strptime(req.date, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    
    ndays = req.days or req.ndays or 30
    if ndays < 1 or ndays > 90:
        raise HTTPException(status_code=400, detail="Days count must be between 1 and 90")

    params = ['T2M','PRECTOT','WS2M']
    start = "20010101"
    end = (datetime.date.today() - datetime.timedelta(days=1)).strftime("%Y%m%d")
    try:
        hist = fetch_power_json_with_fallback_and_key_mapping(req.lat, req.lon, params, start, end, token=req.token, timeout=req.timeout or 30)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch historical data: {e}")
    
    summary, details = classify_conditions_for_date_from_hist(hist, req.lon, req.lat, dt, window=req.window or 7, thresholds=req.thresholds)
    range_summary, daily_predictions = classify_conditions_for_date_range_from_hist(hist, req.lon, req.lat, dt, ndays, window=req.window or 7, thresholds=req.thresholds)
    end_date = (dt + datetime.timedelta(days=ndays - 1)).isoformat()
    
    return {
        'summary': summary,
        'details': details,
        'location': {
            'latitude': req.lat,
            'longitude': req.lon
        },
        'start_date': dt.isoformat(),
        'days': ndays,
        'end_date': end_date,
        'summary_metrics': range_summary,
        'daily_predictions': daily_predictions
    }


@app.post("/state-7day-forecast")
def state_seven_day_forecast(req: StateSevenDayForecastRequest):
    """
    Real-time 7-day forecast for multiple states using OpenWeather,
    plus optional SMS alerts for heavy rainfall / heat.
    """
    if not req.states:
        raise HTTPException(status_code=400, detail="No states provided.")
    api_key = req.openweather_api_key or os.environ.get("OPENWEATHER_API_KEY")
    results = []
    hottest = None
    rainiest = None
    for st in req.states:
        daily = None
        if api_key:
            try:
                daily = _fetch_openweather_daily(st.lat, st.lon, api_key, ndays=7)
            except Exception:
                daily = None
        # If OpenWeather not configured or failed, fall back to NASA POWER
        if daily is None:
            try:
                today = datetime.date.today()
                hist_start = (today - datetime.timedelta(days=3650)).strftime("%Y%m%d")  # last ~10 years
                hist_end = (today - datetime.timedelta(days=1)).strftime("%Y%m%d")
                params = ["T2M", "PRECTOT"]
                hist = fetch_power_json_with_fallback_and_key_mapping(
                    st.lat, st.lon, params, hist_start, hist_end, token=None, timeout=60
                )
                start_date = today + datetime.timedelta(days=1)
                # Temperature forecast
                td = hist.get("T2M", (None, None))
                temp_daily = None
                if td[0] is not None:
                    df_t = compute_daily_forecast_from_hist(td[0], td[1], start_date, 7, window=7, threshold=1.0)
                    temp_daily = df_t
                # Precipitation forecast
                pd = hist.get("PRECTOT", (None, None))
                precip_daily = None
                if pd[0] is not None:
                    df_p = compute_daily_forecast_from_hist(pd[0], pd[1], start_date, 7, window=7, threshold=1.0)
                    precip_daily = df_p
                # Build "daily" list similar to OpenWeather shape
                daily = []
                for i in range(7):
                    date_obj = start_date + datetime.timedelta(days=i)
                    entry = {"dt": int(datetime.datetime.combine(date_obj, datetime.time.min).timestamp())}
                    if temp_daily is not None:
                        tval = temp_daily["mean"][i]
                        entry["temp"] = {"day": None if math.isnan(tval) else float(tval)}
                    if precip_daily is not None:
                        pval = precip_daily["mean"][i]
                        precip = 0.0 if math.isnan(pval) else float(pval)
                        entry["rain"] = precip
                    daily.append(entry)
            except Exception:
                daily = []
        max_temp = None
        max_daily_rain = 0.0
        total_rain = 0.0
        days = []
        for d in daily:
            ts = d.get("dt")
            date_obj = datetime.date.fromtimestamp(ts) if ts is not None else None
            date_iso = date_obj.isoformat() if date_obj else None
            temp_day = None
            t_obj = d.get("temp") or {}
            if isinstance(t_obj, dict):
                temp_day = t_obj.get("day")
            else:
                temp_day = d.get("temp")
            rain_mm = float(d.get("rain", 0.0) or 0.0)
            snow_mm = float(d.get("snow", 0.0) or 0.0)
            precip = rain_mm + snow_mm
            if temp_day is not None:
                max_temp = temp_day if max_temp is None else max(max_temp, temp_day)
            max_daily_rain = max(max_daily_rain, precip)
            total_rain += precip
            days.append({
                "date": date_iso,
                "temp_c": temp_day,
                "precip_mm": precip,
                "rain_mm": rain_mm,
                "snow_mm": snow_mm,
            })
        has_heat = (max_temp is not None) and (max_temp >= req.hot_threshold_c)
        has_heavy_rain = max_daily_rain >= req.heavy_rain_threshold_mm
        sms_text = None
        if has_heat or has_heavy_rain:
            parts = [f"WEATHER ALERT (next 7 days) for {st.name}:"]
            if has_heavy_rain:
                parts.append(f"Heavy rainfall up to ~{max_daily_rain:.0f} mm/day.")
            if has_heat:
                parts.append(f"High temperature up to ~{max_temp:.0f} °C.")
            parts.append("Please prepare and take necessary precautions.")
            sms_text = " ".join(parts)
        entry = {
            "state": st.name,
            "lat": st.lat,
            "lon": st.lon,
            "max_temp_c": max_temp,
            "max_daily_precip_mm": max_daily_rain,
            "total_precip_mm": total_rain,
            "hot_alert": has_heat,
            "heavy_rain_alert": has_heavy_rain,
            "days": days,
            "sms_text": sms_text,
        }
        results.append(entry)
        if max_temp is not None:
            if hottest is None or max_temp > hottest["max_temp_c"]:
                hottest = entry
        if max_daily_rain is not None:
            if rainiest is None or max_daily_rain > rainiest["max_daily_precip_mm"]:
                rainiest = entry
    sms_status = None
    if req.send_sms and req.phone:
        sms_status = []
        for r in results:
            if not r.get("sms_text"):
                continue
            status = _twilio_send_sms(req.phone, r["sms_text"])
            sms_status.append({
                "state": r["state"],
                "sent": status.get("sent", False),
                "error": status.get("error"),
            })
    return {
        "states": results,
        "hottest": hottest,
        "rainiest": rainiest,
        "sms_status": sms_status,
    }


@app.post("/send-sms")
def send_sms(req: SmsRequest):
    """
    Lightweight endpoint to send a single SMS with the given body.
    Uses the same Twilio configuration as state-7day-forecast.
    """
    status = _twilio_send_sms(req.phone, req.body)
    if not status.get("sent", False):
        raise HTTPException(status_code=500, detail=status.get("error", "Failed to send SMS"))
    return {"sent": True}


@app.get("/")
def root():
    return {"message": "NASA POWER backend API (single-file). See /docs for interactive API UI."}


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "0.0.0.0")
    try:
        port = int(os.environ.get("PORT", "8000"))
    except ValueError:
        port = 8000
    reload_flag = (os.environ.get("RELOAD", "true").strip().lower() in ("1","true","yes","y","on"))
    uvicorn.run(app, host=host, port=port, reload=reload_flag)