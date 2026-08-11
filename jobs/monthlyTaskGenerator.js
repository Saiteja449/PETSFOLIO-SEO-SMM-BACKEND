import cron from 'node-cron';
import EmployeeTarget from '../models/EmployeeTarget.js';
import { generateBatchTasks } from '../controllers/targetController.js';

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
    seoTemplateId: target.seoTemplateId,
    contentTemplateId: target.contentTemplateId,
    salesTemplateId: target.salesTemplateId,
    creativeTemplateId: target.creativeTemplateId,
  };

  return base;
};

const getTypeSpecificAssignments = (targets) => targets.map((target) => buildAssignmentPayload(target));

const groupTargets = (targets) => {
  const groupedByEmployee = new Map();

  for (const target of targets) {
    const employeeKey = String(target.employeeId || '');
    const companyKey = String(target.companyId || '');
    const typeKey = String(target.targetType || 'SMM');

    if (!employeeKey) continue;

    if (!groupedByEmployee.has(employeeKey)) {
      groupedByEmployee.set(employeeKey, new Map());
    }

    const employeeGroups = groupedByEmployee.get(employeeKey);
    const compositeKey = `${companyKey}:${typeKey}`;

    if (!employeeGroups.has(compositeKey)) {
      employeeGroups.set(compositeKey, {
        employeeId: employeeKey,
        companyId: companyKey,
        type: typeKey,
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
      console.log('Running Monthly Task Generator Cron Job...');

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeTargets = await EmployeeTarget.find({
          endDate: { $gte: today },
          status: 'In Progress',
        }).lean();

        const groupedTargets = groupTargets(activeTargets);
        const employeeEntries = Array.from(groupedTargets.entries());

        for (let index = 0; index < employeeEntries.length; index += 1) {
          const [employeeId, employeeGroups] = employeeEntries[index];
          console.log(`Processing monthly targets for employee ${employeeId}...`);

          for (const group of employeeGroups.values()) {
            if (group.targets.length === 0) continue;

            const assignments = getTypeSpecificAssignments(group.targets);
            await generateBatchTasks(group.employeeId, group.companyId, assignments, group.type);
            console.log(
              `Generated monthly tasks for employee ${group.employeeId}, company ${group.companyId}, type ${group.type}`,
            );
          }

          if (index < employeeEntries.length - 1) {
            await wait(10_000);
          }
        }

        console.log('Monthly Task Generator Cron Job Completed.');
      } catch (error) {
        console.error('Error in Monthly Task Generator Cron Job:', error);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    },
  );
};
