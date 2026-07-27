<?php
/**
 * POST /api/payroll/send-slips
 * Sends salary slip emails (HTML + PDF attachment) to each employee.
 * Body: { slips: SlipRow[] }
 */

requireRole(['HR', 'Admin']); // SECURITY FIX: this endpoint had zero access control before

$body  = request_body();
$slips = $body['slips'] ?? null;

if (!is_array($slips) || count($slips) === 0) {
    json_error('No slip data provided.', 400);
}

$db = get_db(); // FIX: was read_db() — that function no longer exists (legacy db.json system)

// ── Helpers ───────────────────────────────────────────────────────────────────
$fmt = function ($n) {
    return '₹' . number_format((float)($n ?? 0), 2, '.', ',');
};

function build_slip_html(array $slip, callable $fmt): string
{
    $month    = $slip['month'] ?? date('M Y');
    $finalPay = isset($slip['finalPay']) && $slip['finalPay'] !== 0
        ? (float)$slip['finalPay']
        : ((float)($slip['netPay'] ?? 0) + (float)($slip['reimbursement'] ?? 0)
            + (float)($slip['overtime'] ?? 0) + (float)($slip['incentives'] ?? 0)
            - (float)($slip['deduction'] ?? 0));
    $words    = number_to_words($finalPay);

    $rowsHtml   = '';
    $totalCtc   = 0;
    $totalDeduc = 0;

    $addHeads = $slip['additionHeads']   ?? [];
    $addVals  = $slip['additionValues']  ?? [];
    $dedHeads = $slip['deductionHeads']  ?? [];
    $dedVals  = $slip['deductionValues'] ?? [];

    if (count($addHeads) > 0 || count($dedHeads) > 0) {
        $maxRows = 0;
        for ($i = 0; $i < 10; $i++) {
            if (!empty($addHeads[$i]) || !empty($dedHeads[$i])) {
                $maxRows = $i + 1;
            }
        }
        for ($i = 0; $i < $maxRows; $i++) {
            $ah = $addHeads[$i] ?? '';
            $av = $ah ? $fmt($addVals[$i] ?? 0) : '';
            $dh = $dedHeads[$i] ?? '';
            $dv = $dh ? $fmt($dedVals[$i] ?? 0) : '';

            if ($ah) { $totalCtc += (float)($addVals[$i] ?? 0); }
            if ($dh) { $totalDeduc += (float)($dedVals[$i] ?? 0); }

            $rowsHtml .= "<tr>
              <td style='border:1px solid #cccccc;'>" . htmlspecialchars($ah ?: '&nbsp;') . "</td>
              <td style='text-align:right;border:1px solid #cccccc;'>" . ($av ?: '&nbsp;') . "</td>
              <td style='border:1px solid #cccccc;'>" . htmlspecialchars($dh ?: '&nbsp;') . "</td>
              <td style='text-align:right;border:1px solid #cccccc;'>" . ($dv ?: '&nbsp;') . "</td>
            </tr>";
        }
        $postItems = [];
        if (!empty($slip['reimbursement'])) $postItems[] = ['Travel Allowance', (float)$slip['reimbursement']];
        if (!empty($slip['overtime']))      $postItems[] = ['Overtime',          (float)$slip['overtime']];
        if (!empty($slip['incentives']))    $postItems[] = ['Incentives',        (float)$slip['incentives']];
        foreach ($postItems as [$label, $val]) {
            $totalCtc += $val;
            $rowsHtml .= "<tr>
              <td style='border:1px solid #cccccc;'>" . htmlspecialchars($label) . "</td>
              <td style='text-align:right;border:1px solid #cccccc;'>" . $fmt($val) . "</td>
              <td style='border:1px solid #cccccc;'>&nbsp;</td>
              <td style='text-align:right;border:1px solid #cccccc;'>&nbsp;</td>
            </tr>";
        }
    } else {
        $earnRows = [
            ['Salary',          $slip['monthlySalary'] ?? 0],
            ['Basic',           $slip['basic'] ?? 0],
            ['HRA',             $slip['hra'] ?? 0],
            ['Medical',         $slip['medical'] ?? 0],
            ['TA',              $slip['ta'] ?? 0],
            ['LTA',             $slip['lta'] ?? 0],
            ['Special Allowance', $slip['specialAllowance'] ?? 0],
            ['Reimbursement',   $slip['reimbursement'] ?? 0],
            ['Incentives',      $slip['incentives'] ?? 0],
            ['OT Hours',        $slip['overtime'] ?? 0],
        ];
        $dedRows = [
            ['PF Employee',     $slip['pfEmployee'] ?? 0],
            ['PF Employer',     $slip['pfEmployer'] ?? 0],
            ['ESI',             $slip['esi'] ?? 0],
            ['PT',              $slip['pt'] ?? 0],
            ['TDS',             $slip['tds'] ?? 0],
            ['Other Deductions',$slip['otherDeductions'] ?? 0],
        ];
        foreach ($earnRows as [$l, $v]) { $totalCtc += (float)$v; }
        foreach ($dedRows as [$l, $v])  { $totalDeduc += (float)$v; }
        $maxR = max(count($earnRows), count($dedRows));
        for ($i = 0; $i < $maxR; $i++) {
            $el = $earnRows[$i][0] ?? ''; $ev = isset($earnRows[$i]) ? $fmt($earnRows[$i][1]) : '&nbsp;';
            $dl = $dedRows[$i][0]  ?? ''; $dv = isset($dedRows[$i])  ? $fmt($dedRows[$i][1])  : '&nbsp;';
            $rowsHtml .= "<tr>
              <td style='border:1px solid #cccccc;'>" . htmlspecialchars($el ?: '&nbsp;') . "</td>
              <td style='text-align:right;border:1px solid #cccccc;'>{$ev}</td>
              <td style='border:1px solid #cccccc;'>" . htmlspecialchars($dl ?: '&nbsp;') . "</td>
              <td style='text-align:right;border:1px solid #cccccc;'>{$dv}</td>
            </tr>";
        }
    }

    if ($totalCtc === 0 && !empty($slip['ctc'])) { $totalCtc = (float)$slip['ctc']; }
    if ($totalDeduc === 0 && !empty($slip['deductions'])) { $totalDeduc = (float)$slip['deductions']; }

    $empId   = htmlspecialchars($slip['employeeId'] ?? '—');
    $name    = htmlspecialchars($slip['name'] ?? '—');
    $dept    = htmlspecialchars($slip['department'] ?? '—');
    $desig   = htmlspecialchars($slip['designation'] ?? '—');
    $tDays   = $slip['totalDays'] ?? 30;
    $pDays   = $slip['payDays']   ?? 30;
    $pfUan   = htmlspecialchars($slip['pfUan'] ?? '—');
    $clBal   = $slip['clBalance'] ?? 0;

    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Salary Slip – {$month}</title></head>
<body style="margin:0;padding:0;background:#f4f6f3;font-family:Arial,Helvetica,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f3;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #d8ded2;">
        <tr><td style="padding:24px 32px;text-align:center;border-bottom:1px solid #d8ded2;">
          <p style="margin:0;color:#111;font-size:22px;font-weight:700;">Varistor Technologies Pvt. Ltd.</p>
          <p style="margin:6px 0 0;color:#555;font-size:11px;">No. F-1107, Block-1, First Floor Ardente Office One, Hoodi Circle, ITPL Main Rd, Bengaluru, Karnataka 560048</p>
          <p style="margin:2px 0 0;color:#555;font-size:11px;">Email - hr@varistor.in, Telephone - 080 4117 8911</p>
        </td></tr>
        <tr bgcolor="#fef08a"><td style="padding:10px;text-align:center;font-weight:bold;font-size:13px;color:#111;">Pay Slip for the Month of {$month}</td></tr>
        <tr><td style="padding:20px 32px 0;">
          <table width="100%" cellpadding="6" cellspacing="0" style="font-size:12px;border-collapse:collapse;border:1px solid #cccccc;">
            <tr><td width="20%" style="font-weight:bold;border:1px solid #cccccc;background:#f9f9f9;">Emp ID.</td><td width="30%" style="border:1px solid #cccccc;">{$empId}</td>
                <td width="20%" style="font-weight:bold;border:1px solid #cccccc;background:#f9f9f9;">Designation</td><td width="30%" style="border:1px solid #cccccc;">{$desig}</td></tr>
            <tr><td style="font-weight:bold;border:1px solid #cccccc;background:#f9f9f9;">Employee Name</td><td style="border:1px solid #cccccc;">{$name}</td>
                <td style="font-weight:bold;border:1px solid #cccccc;background:#f9f9f9;">Department</td><td style="border:1px solid #cccccc;">{$dept}</td></tr>
            <tr><td style="font-weight:bold;border:1px solid #cccccc;background:#f9f9f9;">No. of Days</td><td style="border:1px solid #cccccc;">{$tDays}</td>
                <td style="font-weight:bold;border:1px solid #cccccc;background:#f9f9f9;">Paid No. of Days</td><td style="border:1px solid #cccccc;">{$pDays}</td></tr>
            <tr><td style="font-weight:bold;border:1px solid #cccccc;background:#f9f9f9;">PF UAN No.</td><td style="border:1px solid #cccccc;">{$pfUan}</td>
                <td style="font-weight:bold;border:1px solid #cccccc;background:#f9f9f9;">CL Balance</td><td style="border:1px solid #cccccc;">{$clBal}</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px;">
          <table width="100%" cellpadding="6" cellspacing="0" style="font-size:12px;border-collapse:collapse;border:1px solid #cccccc;">
            <tr bgcolor="#bfdbfe" style="font-weight:bold;">
              <td width="35%" style="border:1px solid #cccccc;">Earnings</td>
              <td width="15%" style="text-align:right;border:1px solid #cccccc;">Amount (Rs.)</td>
              <td width="35%" style="border:1px solid #cccccc;">Deductions</td>
              <td width="15%" style="text-align:right;border:1px solid #cccccc;">Amount (Rs.)</td>
            </tr>
            {$rowsHtml}
            <tr bgcolor="#f1f5f9" style="font-weight:bold;">
              <td style="border:1px solid #cccccc;">Total Earnings</td>
              <td style="text-align:right;border:1px solid #cccccc;">{$fmt($totalCtc)}</td>
              <td style="border:1px solid #cccccc;">Total Deduction</td>
              <td style="text-align:right;border:1px solid #cccccc;">{$fmt($totalDeduc)}</td>
            </tr>
            <tr>
              <td bgcolor="#e2e8f0" colspan="3" style="font-weight:bold;font-size:13px;border:1px solid #cccccc;">Final Pay [In-Hand]</td>
              <td bgcolor="#e2e8f0" style="font-weight:bold;font-size:14px;text-align:right;border:1px solid #cccccc;">{$fmt($finalPay)}</td>
            </tr>
            <tr>
              <td bgcolor="#f1f5f9" colspan="4" style="font-weight:bold;font-size:10px;text-align:center;border:1px solid #cccccc;">{$words}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #d8ded2;text-align:center;font-size:11px;color:#868e80;">
          <p style="margin:0;font-weight:bold;">This is a computer generated payslip no signature is required.</p>
          <p style="margin:6px 0 0;">&#9993; Auto-dispatched via EOPMS Payroll System</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
}

// ── Main loop ─────────────────────────────────────────────────────────────────
$sent   = [];
$failed = [];

foreach ($slips as $slip) {
    if (empty($slip['email']) || empty($slip['name'])) {
        $failed[] = ['email' => $slip['email'] ?? '(no email)', 'name' => $slip['name'] ?? '(no name)', 'error' => 'Missing name or email'];
        continue;
    }

    // FIX: was looping over $db['employees'] array — now a real MySQL query
    $empStmt = $db->prepare('SELECT status FROM employees WHERE personal_email = ? OR employee_id = ? LIMIT 1');
    $empStmt->execute([$slip['email'], $slip['employeeId'] ?? '']);
    $emp = $empStmt->fetch();

    if (!$emp || $emp['status'] !== 'Active') {
        $failed[] = ['email' => $slip['email'], 'name' => $slip['name'], 'error' => 'Employee is inactive or not found'];
        continue;
    }

    try {
        $month    = $slip['month'] ?? date('M Y');
        $htmlBody = build_slip_html($slip, $fmt);

        $pdf = new \TCPDF('P', 'pt', 'A4', true, 'UTF-8', false);
        $pdf->SetCreator('Varistor EOPMS');
        $pdf->SetAuthor('HR System');
        $pdf->SetTitle("Salary Slip – {$month}");
        $pdf->SetMargins(40, 40, 40);
        $pdf->SetAutoPageBreak(false);
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);
        $pdf->AddPage();
        $pdf->writeHTMLCell(0, 0, 40, 40, $htmlBody, 0, 1, false, true, '', true);
        $pdfBuffer = $pdf->Output('', 'S');

        $mail = make_mailer();
        $mail->addAddress($slip['email'], $slip['name']);
        $mail->Subject = "Your Salary Slip – {$month} | Varistor Technologies";
        $mail->Body    = $htmlBody;
        $mail->addStringAttachment($pdfBuffer, "Salary_Slip_" . str_replace(' ', '_', $month) . ".pdf", 'base64', 'application/pdf');
        $mail->send();

        $sent[] = ['email' => $slip['email'], 'name' => $slip['name']];
        usleep(120000);
    } catch (\Exception $e) {
        $failed[] = ['email' => $slip['email'], 'name' => $slip['name'], 'error' => $e->getMessage()];
    }
}

json_ok(['success' => true, 'sent' => count($sent), 'sentList' => $sent, 'failed' => $failed]);