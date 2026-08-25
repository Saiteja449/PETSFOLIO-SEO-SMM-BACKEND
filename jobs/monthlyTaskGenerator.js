import cron from 'node-cron';
import EmployeeTarget from '../models/EmployeeTarget.js';
import User from '../models/User.js';
import { generateBatchTasks } from '../controllers/targetController.js';
import { sendMonthlyPerformanceReports } from '../services/monthlyReportService.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildAssignmentPayload = (target) => {
  const base = {
    frequency: target.frequency,
    targetGoal: target.targetGoal,
    expected: target.expected,
    companyId: target.companyId,
    platform: target.platform,
    metric: target.metric,
    customName: target.customName,
    templateId: target.templateId,
    targetType: target.targetType,
  };

  return base;
};

const getTypeSpecificAssignments = (targets) => targets.map((target) => buildAssignmentPayload(target));

const groupTargets = (targets) => {
  const groupedByEmployee = new Map();

  for (const target of targets) {
    const employeeKey = String(target.employeeId || '');
    const companyKey = String(target.companyId || '');

    if (!employeeKey) continue;

    if (!groupedByEmployee.has(employeeKey)) {
      groupedByEmployee.set(employeeKey, new Map());
    }

    const employeeGroups = groupedByEmployee.get(employeeKey);
    const compositeKey = `${companyKey}`;

    if (!employeeGroups.has(compositeKey)) {
      employeeGroups.set(compositeKey, {
        employeeId: employeeKey,
        companyId: companyKey,
        targets: [],
      });
    }

    employeeGroups.get(compositeKey).targets.push(target);
  }

  return groupedByEmployee;
};

export const setupMonthlyTaskGenerator = () => {
  cron.schedule(
    '0 0 1 * *',
    async () => {
      console.log('Running Monthly Task Generator & Performance Email Dispatch Cron Job...');

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Generate new month tasks for active employees
        const activeTargets = await EmployeeTarget.find({
          endDate: { $gte: today },
          status: 'In Progress',
          isLegacyInternData: { $ne: true },
        }).lean();

        const groupedTargets = groupTargets(activeTargets);
        const employeeEntries = Array.from(groupedTargets.entries());

        for (let index = 0; index < employeeEntries.length; index += 1) {
          const [employeeId, employeeGroups] = employeeEntries[index];
          
          const employeeUser = await User.findById(employeeId);
          if (employeeUser && employeeUser.isBlocked) {
            console.log(`Skipping monthly task generation for blocked employee ${employeeId} (${employeeUser.name})`);
            continue;
          }

          console.log(`Processing monthly targets for employee ${employeeId}...`);

          for (const group of employeeGroups.values()) {
            if (group.targets.length === 0) continue;

            const assignments = getTypeSpecificAssignments(group.targets);
            await generateBatchTasks(group.employeeId, group.companyId, assignments);
            console.log(
              `Generated monthly tasks for employee ${group.employeeId}, company ${group.companyId}`,
            );
          }

          if (index < employeeEntries.length - 1) {
            await wait(10_000);
          }
        }

        console.log('Monthly Task Generator Step Completed.');

        // 2. Dispatch Previous Month Performance Reports via Email to Employees & Interns
        console.log('--- Dispatching Previous Month Performance Email Reports ---');
        try {
          const reportSummary = await sendMonthlyPerformanceReports({ referenceDate: today });
          console.log(`✅ Monthly Performance Report Email dispatch completed for ${reportSummary.monthLabel}. Processed: ${reportSummary.results.length} users.`);
        } catch (emailErr) {
          console.error('Error during monthly performance email dispatch:', emailErr);
        }

        console.log('Monthly Cron Job (Task Generation + Performance Reports) Completed.');
      } catch (error) {
        console.error('Error in Monthly Cron Job:', error);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    },
  );
};
