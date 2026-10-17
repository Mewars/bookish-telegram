<?php
// Read-only capability probe. Never reads application data or credentials.
$result = [
    'php' => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION,
    'sqlite' => extension_loaded('pdo_sqlite'),
    'curl' => extension_loaded('curl'),
    'openssl' => extension_loaded('openssl'),
    'private_parent_writable' => is_writable('/home/mewars'),
    'production_root_exists' => is_dir('/home/mewars/domains/ryadomcity.ru/public_html'),
];
if ($result['sqlite']) {
    $db = new PDO('sqlite::memory:');
    $result['sqlite_version'] = $db->query('SELECT sqlite_version()')->fetchColumn();
}
echo json_encode($result, JSON_UNESCAPED_SLASHES) . "\n";
