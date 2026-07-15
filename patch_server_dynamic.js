import fs from 'fs';

let content = fs.readFileSync('server.js', 'utf8');

const startGenerate = content.indexOf('const rawEarnings = [');
const endGenerate = content.indexOf('const maxSlipRows = Math.max(rawEarnings.length, rawDeductions.length, 5);');

if (startGenerate !== -1 && endGenerate !== -1) {
  const newLogic = `
  const rawEarnings = [];
  if (Array.isArray(slip.additionHeads) && slip.additionHeads.some(h => h && h.trim())) {
    slip.additionHeads.forEach((h, i) => {
      if (h && h.trim()) rawEarnings.push({ label: h, val: (slip.additionValues && slip.additionValues[i]) || 0 });
    });
  } else {
    rawEarnings.push(
      { label: 'Basic', val: basic },
      { label: 'HRA', val: hra },
      { label: 'Medical Allowance', val: medical },
      { label: 'TA', val: ta },
      { label: 'LTA', val: lta },
      { label: 'Special Allowance', val: specialAllowance }
    );
  }
  // Always include variable/input additions
  rawEarnings.push(
    { label: 'Overtime', val: slip.overtime || 0 },
    { label: 'Reimbursement (Other)', val: slip.reimbursement || 0 },
    { label: 'Incentives', val: slip.incentives || 0 }
  );

  const rawDeductions = [];
  if (Array.isArray(slip.deductionHeads) && slip.deductionHeads.some(h => h && h.trim())) {
    slip.deductionHeads.forEach((h, i) => {
      if (h && h.trim()) rawDeductions.push({ label: h, val: (slip.deductionValues && slip.deductionValues[i]) || 0 });
    });
    // Ensure TDS and Other Deductions are listed if they aren't already in the heads
    const hasTds = slip.deductionHeads.some(h => h && h.trim().toLowerCase() === 'tds');
    const hasOther = slip.deductionHeads.some(h => h && ['other deductions', 'advance salary adjut'].includes(h.trim().toLowerCase()));
    if (!hasTds && slip.tds) rawDeductions.push({ label: 'TDS', val: slip.tds });
    if (!hasOther && otherDeductions) rawDeductions.push({ label: 'Other Deductions', val: otherDeductions });
  } else {
    rawDeductions.push(
      { label: 'PF Employee', val: pfEmployee },
      { label: 'PF Employer', val: pfEmployer },
      { label: 'ESI', val: esi },
      { label: 'PT', val: pt },
      { label: 'Other Deductions', val: otherDeductions }
    );
  }

  `;
  content = content.slice(0, startGenerate) + newLogic + content.slice(endGenerate);
  fs.writeFileSync('server.js', content, 'utf8');
  console.log('Successfully patched server.js for dynamic heads');
} else {
  console.log('Could not find injection points in server.js');
}
