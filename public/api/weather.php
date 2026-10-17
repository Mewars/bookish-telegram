<?php
declare(strict_types=1);

// Same-origin gateway for public city forecasts. No browser/user coordinates.
const RYADOM_WEATHER_CITIES = [
    'eniseysk' => ['Енисейск', '58.45', '92.17'],
    'lesosibirsk' => ['Лесосибирск', '58.22', '92.48'],
];

function ryadom_valid_weather($payload): bool {
    $series = $payload['properties']['timeseries'] ?? null;
    if (!is_array($series) || count($series) < 1) return false;
    $temperature = $series[0]['data']['instant']['details']['air_temperature'] ?? null;
    return (is_int($temperature) || is_float($temperature))
        && is_finite((float)$temperature) && $temperature >= -100 && $temperature <= 70
        && isset($series[0]['time']) && strtotime($series[0]['time']) !== false;
}

function ryadom_weather_response(int $status, array $body): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header($status === 200 ? 'Cache-Control: public, max-age=300' : 'Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

// Allows CLI tests to import the validator without running an HTTP request.
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') !== __FILE__) return;
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    ryadom_weather_response(405, ['error' => 'Method not allowed']);
    exit;
}
$city = $_GET['city'] ?? '';
if (!is_string($city) || !isset(RYADOM_WEATHER_CITIES[$city])) {
    ryadom_weather_response(400, ['error' => 'Unsupported city']);
    exit;
}
[$name, $lat, $lon] = RYADOM_WEATHER_CITIES[$city];
$cache = null;
$lock = null;
try {
    $directory = sys_get_temp_dir() . '/ryadom-weather-' . substr(hash('sha256', __DIR__), 0, 20);
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Cache unavailable');
    }
    $file = $directory . '/' . $city . '.json';
    if (is_file($file) && filesize($file) <= 2097152) {
        $saved = json_decode((string)file_get_contents($file), true);
        if (is_array($saved) && isset($saved['fetchedAt'], $saved['refreshAfter'])
            && ryadom_valid_weather($saved['forecast'] ?? null)) $cache = $saved;
    }
    if ($cache && time() < $cache['refreshAfter']) {
        ryadom_weather_response(200, $cache + ['stale' => false]);
        exit;
    }
    $lock = fopen($directory . '/' . $city . '.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) throw new RuntimeException('Refresh in progress');
    $context = stream_context_create(['http' => [
        'method' => 'GET', 'timeout' => 8, 'follow_location' => 0,
        'header' => "User-Agent: RyadomCity/1.0 https://github.com/Mewars/bookish-telegram\r\nAccept: application/json\r\n",
    ]]);
    $raw = @file_get_contents('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' . $lat . '&lon=' . $lon,
        false, $context, 0, 1048577);
    $headers = $http_response_header ?? [];
    if ($raw === false || strlen($raw) > 1048576 || !preg_match('/^HTTP\/\S+ 200\b/', $headers[0] ?? '')) {
        throw new RuntimeException('Provider unavailable');
    }
    $forecast = json_decode($raw, true);
    if (!ryadom_valid_weather($forecast)) throw new RuntimeException('Invalid provider data');
    $expires = time() + 900;
    foreach ($headers as $header) {
        if (stripos($header, 'Expires:') === 0) {
            $providerExpiry = strtotime(trim(substr($header, 8)));
            if ($providerExpiry !== false) $expires = max($expires, $providerExpiry);
        }
    }
    $cache = ['city' => $name, 'fetchedAt' => gmdate('c'), 'refreshAfter' => $expires, 'forecast' => $forecast];
    $temporary = tempnam($directory, 'forecast-');
    if ($temporary === false) throw new RuntimeException('Cache unavailable');
    chmod($temporary, 0600);
    if (file_put_contents($temporary, json_encode($cache)) === false || !rename($temporary, $file)) {
        @unlink($temporary);
        throw new RuntimeException('Cache write failed');
    }
    ryadom_weather_response(200, $cache + ['stale' => false]);
} catch (Throwable $error) {
    if ($cache && time() - strtotime($cache['fetchedAt']) <= 21600) {
        ryadom_weather_response(200, $cache + ['stale' => true]);
    } else {
        ryadom_weather_response(503, ['error' => 'Weather temporarily unavailable']);
    }
} finally {
    if (is_resource($lock)) { flock($lock, LOCK_UN); fclose($lock); }
}
