<?php
/**
 * POST /api/attendance/export-pdf
 * Generates attendance PDF reports (daily / monthly / yearly) using TCPDF.
 * Exact port of the pdfkit implementation in server.js.
 *
 * Body: { rows: [], month: string, type: 'daily'|'monthly'|'yearly' }
 * Response: application/pdf binary
 */

$body  = request_body();
$rows  = $body['rows']  ?? [];
$month = $body['month'] ?? 'Report';
$type  = $body['type']  ?? 'monthly';

// ── A4 Landscape dimensions (points: 1pt ≈ 0.353mm) ─────────────────────────
// A4 landscape: 842 × 595 pt  |  margins: 40 pt each side
$pgW   = 842.0;
$pgH   = 595.0;
$mL    = 40.0;
$mR    = 40.0;
$mT    = 40.0;
$mB    = 40.0;
$useW  = $pgW - $mL - $mR; // 762 pt

// ── TCPDF setup ───────────────────────────────────────────────────────────────
$pdf = new \TCPDF('L', 'pt', 'A4', true, 'UTF-8', false);
$pdf->SetCreator('Varistor EOPMS');
$pdf->SetAuthor('HR System');
$pdf->SetTitle("Attendance Report – {$month}");
$pdf->SetMargins($mL, $mT, $mR, true);
$pdf->SetAutoPageBreak(true, $mB);
$pdf->setPrintHeader(false);
$pdf->setPrintFooter(false);
$pdf->SetFont('helvetica', '', 8);

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt_time(?string $iso): string {
    if (!$iso) return '—';
    $ts = strtotime($iso);
    return $ts ? date('h:i A', $ts) : '—';
}

function safe_str($v): string {
    if ($v === null || $v === false || $v === '') return '—';
    return (string)$v;
}

function hex_to_rgb(string $hex): array {
    $hex = ltrim($hex, '#');
    return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
}

// ── Column definitions ────────────────────────────────────────────────────────
$ROW_H = 18.0;

// Detail columns (monthly / yearly / daily per employee)
$detailCols = [
    ['label' => 'Date',      'w' => floor($useW * 0.18)],
    ['label' => 'Punch IN',  'w' => floor($useW * 0.20)],
    ['label' => 'Punch OUT', 'w' => floor($useW * 0.20)],
    ['label' => 'Work Hrs',  'w' => floor($useW * 0.17)],
    ['label' => 'Status',    'w' => 0],
];
$dcSum = 0; foreach ($detailCols as $i => $c) { if ($i < count($detailCols)-1) $dcSum += $c['w']; }
$detailCols[count($detailCols)-1]['w'] = $useW - $dcSum;

// Summary columns (fallback when no dailyRecords)
$sumCols = [
    ['label' => 'Emp ID',       'w' => floor($useW * 0.08)],
    ['label' => 'Employee',     'w' => floor($useW * 0.18)],
    ['label' => 'Dept',         'w' => floor($useW * 0.12)],
    ['label' => 'Present',      'w' => floor($useW * 0.07)],
    ['label' => 'Leaves',       'w' => floor($useW * 0.07)],
    ['label' => 'W.O',          'w' => floor($useW * 0.06)],
    ['label' => 'Holidays',     'w' => floor($useW * 0.07)],
    ['label' => 'Half-day',     'w' => floor($useW * 0.07)],
    ['label' => 'Absent',       'w' => floor($useW * 0.07)],
    ['label' => 'Total Hrs',    'w' => floor($useW * 0.08)],
    ['label' => 'Payable Days', 'w' => 0],
];
$scSum = 0; foreach ($sumCols as $i => $c) { if ($i < count($sumCols)-1) $scSum += $c['w']; }
$sumCols[count($sumCols)-1]['w'] = $useW - $scSum;

// ── Page header drawing function ──────────────────────────────────────────────
$subtitleType = ($type === 'monthly') ? 'Monthly' : (($type === 'yearly') ? 'Yearly' : 'Daily');
$genDate = date('d/m/Y');

function draw_page_header(\TCPDF $pdf, float $mL, float $mT, float $useW, string $subtitleType, string $month, string $genDate): float {
    $headerH = 30.0;
    [$r, $g, $b] = hex_to_rgb('#4caf50');
    $pdf->SetFillColor($r, $g, $b);
    $pdf->Rect($mL, $mT, $useW, $headerH, 'F');

    $pdf->SetTextColor(255, 255, 255);
    $pdf->SetFont('helvetica', 'B', 14);
    $pdf->SetXY($mL + 10, $mT + 8);
    $pdf->Cell($useW * 0.5, 14, 'Varistor EOPMS — Attendance Report', 0, 0, 'L');

    $pdf->SetTextColor(232, 245, 233);
    $pdf->SetFont('helvetica', '', 8.5);
    $pdf->SetXY($mL, $mT + 10);
    $pdf->Cell($useW - 10, 10, "{$subtitleType}: {$month}  ·  Generated: {$genDate}", 0, 0, 'R');

    return $mT + $headerH + 8;
}

// ── drawRow — mirrors pdfkit drawRow exactly ──────────────────────────────────
function draw_row(\TCPDF $pdf, float $y, array $values, bool $isBg, bool $isHeader, array $cols, float $mL, float $ROW_H): void {
    if ($isHeader) {
        [$r, $g, $b] = hex_to_rgb('#1e5f2e');
    } elseif ($isBg) {
        [$r, $g, $b] = hex_to_rgb('#f3fbe8');
    } else {
        $r = $g = $b = 255;
    }
    $pdf->SetFillColor($r, $g, $b);

    $totalW = array_sum(array_column($cols, 'w'));
    $pdf->Rect($mL, $y, $totalW, $ROW_H, 'F');

    $x = $mL;
    foreach ($cols as $i => $col) {
        $cellW = (float)$col['w'];
        $str   = safe_str($values[$i] ?? '');

        if ($isHeader) {
            $pdf->SetTextColor(255, 255, 255);
            $pdf->SetFont('helvetica', 'B', 8);
        } else {
            $pdf->SetTextColor(26, 26, 26);
            $pdf->SetFont('helvetica', '', 7.5);
        }

        $pdf->SetXY($x + 4, $y + 5);
        $pdf->Cell($cellW - 8, $ROW_H - 6, $str, 0, 0, 'L');

        // Vertical divider
        if ($i < count($cols) - 1) {
            [$sr, $sg, $sb] = $isHeader ? hex_to_rgb('#2d8a45') : hex_to_rgb('#c8e6c9');
            $pdf->SetDrawColor($sr, $sg, $sb);
            $pdf->SetLineWidth(0.4);
            $pdf->Line($x + $cellW, $y, $x + $cellW, $y + $ROW_H);
        }
        $x += $cellW;
    }

    // Bottom border
    [$br, $bg2, $bb] = $isHeader ? hex_to_rgb('#0f3d1c') : hex_to_rgb('#dcedc8');
    $pdf->SetDrawColor($br, $bg2, $bb);
    $pdf->SetLineWidth(0.4);
    $pdf->Line($mL, $y + $ROW_H, $mL + $totalW, $y + $ROW_H);
}

// ── drawEmployeeBlock ─────────────────────────────────────────────────────────
function draw_employee_block(
    \TCPDF $pdf, array $emp, array $dailyRows,
    float &$curY, float $mL, float $mT, float $mB, float $pgH, float $useW, float $ROW_H,
    array $detailCols, string $subtitleType, string $month, string $genDate
): void {
    // Ensure enough space for banner + stats bar + header + at least one row
    $needed = 26 + 22 + $ROW_H + $ROW_H;
    if ($curY + $needed > $pgH - $mB - 10) {
        $pdf->AddPage();
        $curY = draw_page_header($pdf, $mL, $mT, $useW, $subtitleType, $month, $genDate);
    }

    // ── Employee Banner ───────────────────────────────────────────────────
    $bannerH = 26.0;
    [$r, $g, $b] = hex_to_rgb('#c8e6c9');
    $pdf->SetFillColor($r, $g, $b);
    $pdf->Rect($mL, $curY, $useW, $bannerH, 'F');

    $pdf->SetTextColor(27, 94, 32);
    $pdf->SetFont('helvetica', 'B', 11);
    $pdf->SetXY($mL + 10, $curY + 7);
    $pdf->Cell($useW * 0.45, 12, safe_str($emp['employeeName'] ?? $emp['name'] ?? ''), 0, 0, 'L');

    $pdf->SetTextColor(46, 125, 50);
    $pdf->SetFont('helvetica', '', 8.5);
    $pdf->SetXY($mL + $useW * 0.45, $curY + 9);
    $pdf->Cell($useW * 0.30, 10, "ID: " . safe_str($emp['employee_id'] ?? '') . "   Dept: " . safe_str($emp['department'] ?? ''), 0, 0, 'L');

    $curY += $bannerH;

    // ── Stats Bar ─────────────────────────────────────────────────────────
    $statsH = 22.0;
    [$r, $g, $b] = hex_to_rgb('#e8f5e9');
    $pdf->SetFillColor($r, $g, $b);
    $pdf->Rect($mL, $curY, $useW, $statsH, 'F');

    $statItems = [
        ['Present',      $emp['present']     ?? '—'],
        ['Absent',       $emp['absent']      ?? '—'],
        ['Leaves',       $emp['leaves']      ?? $emp['paidLeave'] ?? '—'],
        ['Half-day',     $emp['halfDay']     ?? '—'],
        ['W.O',          $emp['weekOff']     ?? '—'],
        ['Holidays',     $emp['holidays']    ?? '—'],
        ['Total Hrs',    $emp['totalHrs']    ?? '—'],
        ['Payable Days', $emp['payableDays'] ?? '—'],
    ];

    $statW = $useW / count($statItems);
    foreach ($statItems as $si => [$label, $val]) {
        $sx = $mL + $si * $statW;

        $pdf->SetTextColor(56, 142, 60);
        $pdf->SetFont('helvetica', 'B', 6.5);
        $pdf->SetXY($sx + 4, $curY + 3);
        $pdf->Cell($statW - 8, 8, $label, 0, 0, 'L');

        $pdf->SetTextColor(27, 94, 32);
        $pdf->SetFont('helvetica', 'B', 9);
        $pdf->SetXY($sx + 4, $curY + 11);
        $pdf->Cell($statW - 8, 10, safe_str($val), 0, 0, 'L');

        if ($si > 0) {
            [$dr, $dg, $db] = hex_to_rgb('#a5d6a7');
            $pdf->SetDrawColor($dr, $dg, $db);
            $pdf->SetLineWidth(0.4);
            $pdf->Line($sx, $curY, $sx, $curY + $statsH);
        }
    }
    $curY += $statsH;

    // ── Daily Table header ─────────────────────────────────────────────────
    draw_row($pdf, $curY, array_column($detailCols, 'label'), false, true, $detailCols, $mL, $ROW_H);
    $curY += $ROW_H;

    // ── Daily rows ─────────────────────────────────────────────────────────
    foreach ($dailyRows as $di => $dr) {
        if ($curY + $ROW_H > $pgH - $mB - 10) {
            $pdf->AddPage();
            $curY = draw_page_header($pdf, $mL, $mT, $useW, $subtitleType, $month, $genDate);
        }
        $vals = [
            safe_str($dr['date']       ?? '—'),
            fmt_time($dr['punch_in']   ?? null),
            fmt_time($dr['punch_out']  ?? null),
            ($dr['work_hours'] !== null && $dr['work_hours'] !== '') ? safe_str($dr['work_hours']) . ' hrs' : '—',
            safe_str($dr['status']     ?? $dr['code'] ?? '—'),
        ];
        draw_row($pdf, $curY, $vals, $di % 2 === 1, false, $detailCols, $mL, $ROW_H);
        $curY += $ROW_H;
    }

    $curY += 16; // gap between employees
}

// ── Add first page & draw header ──────────────────────────────────────────────
$pdf->AddPage();
$curY = draw_page_header($pdf, $mL, $mT, $useW, $subtitleType, $month, $genDate);

// ── Determine render mode ─────────────────────────────────────────────────────
$isGroupedDetailed = ($type === 'monthly' || $type === 'yearly')
    && count($rows) > 0
    && isset($rows[0]['dailyRecords'])
    && is_array($rows[0]['dailyRecords']);
$isDaily = ($type === 'daily');

if ($isGroupedDetailed) {
    // Monthly / Yearly — each row has dailyRecords[]
    foreach ($rows as $emp) {
        draw_employee_block($pdf, $emp, $emp['dailyRecords'] ?? [], $curY, $mL, $mT, $mB, $pgH, $useW, $ROW_H, $detailCols, $subtitleType, $month, $genDate);
    }

} elseif ($isDaily) {
    // Daily — flat entries, group by employee
    $empMap = [];
    foreach ($rows as $r) {
        $eid = $r['employee_id'] ?? $r['employeeId'] ?? '';
        if (!isset($empMap[$eid])) {
            $empMap[$eid] = array_merge($r, ['days' => []]);
        }
        $empMap[$eid]['days'][] = $r;
    }

    foreach ($empMap as $emp) {
        $days      = $emp['days'];
        $dailyRows = array_map(fn($d) => [
            'date'       => $d['date']       ?? '',
            'punch_in'   => $d['punch_in']   ?? null,
            'punch_out'  => $d['punch_out']  ?? null,
            'work_hours' => $d['work_hours'] ?? null,
            'status'     => $d['status']     ?? '',
        ], $days);

        $present  = count(array_filter($days, fn($d) => in_array($d['status'] ?? '', ['Present', 'Late'])));
        $absent   = count(array_filter($days, fn($d) => ($d['status'] ?? '') === 'Absent'));
        $leaves   = count(array_filter($days, fn($d) => ($d['status'] ?? '') === 'Leave'));
        $halfDay  = count(array_filter($days, fn($d) => ($d['status'] ?? '') === 'Half-day'));
        $weekOff  = count(array_filter($days, fn($d) => ($d['status'] ?? '') === 'W.O'));
        $holidays = count(array_filter($days, fn($d) => ($d['status'] ?? '') === 'Holiday'));
        $totalHrs = array_sum(array_map(fn($d) => (float)($d['work_hours'] ?? 0), $days));

        $empWithStats = array_merge($emp, [
            'present'     => $present  ?: null,
            'absent'      => $absent   ?: null,
            'leaves'      => $leaves   ?: null,
            'halfDay'     => $halfDay  ?: null,
            'weekOff'     => $weekOff  ?: null,
            'holidays'    => $holidays ?: null,
            'totalHrs'    => round($totalHrs, 1),
        ]);

        draw_employee_block($pdf, $empWithStats, $dailyRows, $curY, $mL, $mT, $mB, $pgH, $useW, $ROW_H, $detailCols, $subtitleType, $month, $genDate);
    }

} else {
    // Pure summary table (no dailyRecords)
    draw_row($pdf, $curY, array_column($sumCols, 'label'), false, true, $sumCols, $mL, $ROW_H);
    $curY += $ROW_H;

    foreach ($rows as $idx => $row) {
        if ($curY + $ROW_H > $pgH - $mB - 10) {
            $pdf->AddPage();
            $curY = draw_page_header($pdf, $mL, $mT, $useW, $subtitleType, $month, $genDate);
        }
        $values = [
            safe_str($row['employee_id'] ?? ''),
            safe_str($row['employeeName'] ?? ''),
            safe_str($row['department'] ?? ''),
            safe_str($row['present'] ?? ''),
            safe_str($row['leaves'] ?? ''),
            safe_str($row['weekOff'] ?? ''),
            safe_str($row['holidays'] ?? ''),
            safe_str($row['halfDay'] ?? 0),
            safe_str($row['absent'] ?? ''),
            safe_str($row['totalHrs'] ?? ''),
            safe_str($row['payableDays'] ?? ''),
        ];
        draw_row($pdf, $curY, $values, $idx % 2 === 1, false, $sumCols, $mL, $ROW_H);
        $curY += $ROW_H;
    }
}

// ── Footer on last page ───────────────────────────────────────────────────────
$pdf->SetTextColor(136, 136, 136);
$pdf->SetFont('helvetica', '', 7);
$pdf->SetXY($mL, $pgH - $mB + 5);
$pdf->Cell($useW, 10, 'Varistor EOPMS — Confidential', 0, 0, 'C');

// ── Output ────────────────────────────────────────────────────────────────────
$safeMonth = preg_replace('/\s+/', '_', $month);
$filename  = "attendance_{$safeMonth}.pdf";

header('Content-Type: application/pdf');
header("Content-Disposition: attachment; filename=\"{$filename}\"");
echo $pdf->Output($filename, 'S');
exit;
