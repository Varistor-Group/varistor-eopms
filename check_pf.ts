import { getEmployees } from './src/api/employees.ts';
import { getPayrollRecords } from './src/api/payroll.ts';

async function check() {
  const emps = await getEmployees();
  console.log('Employees optOutPF:', emps.map(e => ({ id: e.employeeId, optOutPF: e.optOutPF })));
  
  const records = await getPayrollRecords();
  console.log('Records hasPf:', records.map(r => ({ id: r.employeeId, hasPf: r.hasPf, pfEmployee: r.components?.pfEmployee })));
}

check();
