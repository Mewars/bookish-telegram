<?php
declare(strict_types=1);
require __DIR__ . '/../public/api/weather.php';
function check(bool $condition): void { if (!$condition) throw new RuntimeException('Weather gateway assertion failed'); }
$good = ['properties' => ['timeseries' => [['time' => '2026-10-17T06:00:00Z',
    'data' => ['instant' => ['details' => ['air_temperature' => 0]]]]]]];
check(ryadom_valid_weather($good));
foreach ([null, [], ['properties' => []], ['properties' => ['timeseries' => []]]] as $bad) check(!ryadom_valid_weather($bad));
foreach ([-101, 71, '3', null, INF, NAN] as $bad) {
    $copy = $good;
    $copy['properties']['timeseries'][0]['data']['instant']['details']['air_temperature'] = $bad;
    check(!ryadom_valid_weather($copy));
}
echo "Weather PHP validation passed\n";
