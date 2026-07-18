<?php
/**
 * Attendance device stubs — ZKTeco TCP bridge cannot run on PHP shared hosting.
 * These endpoints return offline/mock data so the frontend degrades gracefully.
 *
 * GET  /api/attendance/live-feed
 * GET  /api/attendance/device-status
 * POST /api/attendance/force-resync
 */

if (strpos($path, 'device-status') !== false) {
    json_ok([
        'ipAddress'     => '192.168.1.42',
        'enrolledFaces' => 40,
        'lastSync'      => null,
        'firmware'      => 'ZKTeco v6.60',
        'uptime'        => '—',
        'online'        => false,
    ]);
}

if (strpos($path, 'live-feed') !== false) {
    json_ok([]);
}

if (strpos($path, 'force-resync') !== false) {
    json_ok([
        'success'   => true,
        'message'   => 'Device not reachable on this hosting environment — running in stub mode.',
        'timestamp' => date('c'),
    ]);
}
