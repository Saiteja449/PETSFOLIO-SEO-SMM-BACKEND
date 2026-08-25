import mongoose from 'mongoose';
import User from '../models/User.js';
import EmployeeTarget from '../models/EmployeeTarget.js';
import Task from '../models/Task.js';
import Company from '../models/Company.js';
import TaskTemplate from '../models/TaskTemplate.js';
import { sendEmail } from './emailService.js';

/**
 * Get start and end date of previous month
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ startDate: Date, endDate: Date, monthLabel: string, year: number, month: number }}
 */
export const getPreviousMonthDateRange = (referenceDate = new Date()) => {
  const ref = new Date(referenceDate);
  // First day of current month
  const firstOfCurrentMonth = new Date(ref.getFullYear(), ref.getMonth(), 1);
  
  // Last day of previous month
  const endDate = new Date(firstOfCurrentMonth.getTime() - 1);
  endDate.setHours(23, 59, 59, 999);
  
  // First day of previous month
  const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1, 0, 0, 0, 0);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthLabel = `${monthNames[startDate.getMonth()]} ${startDate.getFullYear()}`;

  return {
    startDate,
    endDate,
    monthLabel,
    year: startDate.getFullYear(),
    month: startDate.getMonth() + 1,
  };
};

/**
 * Calculate the monthly performance metrics for a specific user
 */
export const compileUserMonthlyPerformance = async (user, startDate, endDate, monthLabel) => {
  if (user.isBlocked) {
    return null;
  }

  const userId = user._id;
  const isIntern = user.role === 'intern';

  // 1. Fetch all companies for name mapping
  const companies = await Company.find({}).lean();
  const companyMap = new Map();
  companies.forEach((c) => companyMap.set(c._id.toString(), c.name));

  // 2. Fetch targets active in the period
  let targets = [];
  if (isIntern) {
    targets = await EmployeeTarget.find({
      $or: [
        { employeeId: userId },
        { 'delegations.internId': userId },
      ],
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    })
      .populate('templateId')
      .lean();
  } else {
    targets = await EmployeeTarget.find({
      employeeId: userId,
      isLegacyInternData: { $ne: true },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    })
      .populate('templateId')
      .lean();
  }

  // 3. Fetch all tasks within the month
  let tasks = [];
  if (isIntern) {
    tasks = await Task.find({
      $or: [
        { 'subTasks.assignedToInternId': userId },
        { employeeId: userId },
        { assignedTo: user.email },
      ],
      $or: [
        { dueDate: { $gte: startDate, $lte: endDate } },
        { date: { $gte: startDate.toISOString().split('T')[0], $lte: endDate.toISOString().split('T')[0] } },
        { createdAt: { $gte: startDate, $lte: endDate } },
      ],
    }).lean();
  } else {
    tasks = await Task.find({
      employeeId: userId,
      $or: [
        { dueDate: { $gte: startDate, $lte: endDate } },
        { date: { $gte: startDate.toISOString().split('T')[0], $lte: endDate.toISOString().split('T')[0] } },
        { createdAt: { $gte: startDate, $lte: endDate } },
      ],
    }).lean();
  }

  // 4. Compute metrics per target
  let totalAchievedUnits = 0;
  let totalGoalUnits = 0;
  let completedTasksCount = 0;

  const targetDetails = targets.map((t) => {
    const templateName = t.templateId?.name || t.customName || `${t.targetType || 'Department'} Target`;
    const companyName = companyMap.get(t.companyId?.toString()) || 'Global / General';

    // Calculate monthly target goal
    const rawGoal = parseInt(t.targetGoal, 10) || 1;
    let monthlyGoal = rawGoal;
    if (t.frequency === 'Daily') {
      monthlyGoal = rawGoal * 20; // 20 working days per month standard
    } else if (t.frequency === 'Weekly') {
      monthlyGoal = rawGoal * 4;
    } else {
      monthlyGoal = rawGoal;
    }

    // Count completed deliverables for this target
    let achieved = 0;
    tasks.forEach((tsk) => {
      const matchType = (tsk.type || '').trim().toLowerCase() === templateName.trim().toLowerCase() ||
        (tsk.title || '').trim().toLowerCase().includes(templateName.trim().toLowerCase());

      if (matchType) {
        if (isIntern) {
          // Check completed subtasks
          if (Array.isArray(tsk.subTasks)) {
            const internSub = tsk.subTasks.filter(
              (st) => String(st.assignedToInternId) === String(userId) && st.status === 'completed'
            );
            internSub.forEach((st) => {
              achieved += st.completedQuantity || 1;
            });
          }
          if (String(tsk.employeeId) === String(userId) && tsk.status === 'completed') {
            achieved += tsk.completedQuantity || 1;
          }
        } else {
          // Employee parent tasks
          if (tsk.status === 'completed') {
            achieved += tsk.completedQuantity || 1;
          }
        }
      }
    });

    totalAchievedUnits += achieved;
    totalGoalUnits += monthlyGoal;

    const percent = monthlyGoal > 0 ? Math.min(100, Math.round((achieved / monthlyGoal) * 100)) : 0;

    return {
      name: templateName,
      company: companyName,
      platform: t.platform || t.targetType || 'General',
      frequency: t.frequency || 'Monthly',
      goal: monthlyGoal,
      achieved,
      percent,
      status: percent >= 100 ? 'Completed' : percent >= 50 ? 'In Progress' : 'Pending',
    };
  });

  // Calculate completed tasks total
  tasks.forEach((tsk) => {
    if (isIntern) {
      const internDone = (tsk.subTasks || []).some(
        (st) => String(st.assignedToInternId) === String(userId) && st.status === 'completed'
      );
      if (internDone || (String(tsk.employeeId) === String(userId) && tsk.status === 'completed')) {
        completedTasksCount += 1;
      }
    } else {
      if (tsk.status === 'completed') {
        completedTasksCount += 1;
      }
    }
  });

  const overallRate = totalGoalUnits > 0 ? Math.min(100, Math.round((totalAchievedUnits / totalGoalUnits) * 100)) : 0;

  let grade = 'Needs Improvement';
  let gradeColor = '#ef4444';
  let badgeText = 'Needs Focus';

  if (overallRate >= 90) {
    grade = 'Outstanding (A+)';
    gradeColor = '#10b981';
    badgeText = 'Top Performer';
  } else if (overallRate >= 75) {
    grade = 'Good Performance (A)';
    gradeColor = '#6366f1';
    badgeText = 'Strong Delivery';
  } else if (overallRate >= 50) {
    grade = 'Satisfactory (B)';
    gradeColor = '#f59e0b';
    badgeText = 'On Track';
  }

  // Group targets by Brand / Company
  const brandGroupsMap = new Map();
  targetDetails.forEach((t) => {
    const brandName = t.company || 'General / Unassigned';
    if (!brandGroupsMap.has(brandName)) {
      brandGroupsMap.set(brandName, {
        brandName,
        totalGoal: 0,
        totalAchieved: 0,
        targets: [],
      });
    }
    const group = brandGroupsMap.get(brandName);
    group.totalGoal += t.goal;
    group.totalAchieved += t.achieved;
    group.targets.push(t);
  });

  const brandGroups = Array.from(brandGroupsMap.values()).map((bg) => ({
    ...bg,
    rate: bg.totalGoal > 0 ? Math.min(100, Math.round((bg.totalAchieved / bg.totalGoal) * 100)) : 0,
  }));

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    },
    monthLabel,
    totalTargetsAssigned: targets.length,
    totalTasksCompleted: completedTasksCount,
    totalTasksAssigned: tasks.length,
    totalAchievedUnits,
    totalGoalUnits,
    overallRate,
    grade,
    gradeColor,
    badgeText,
    targetDetails,
    brandGroups,
  };
};

/**
 * Generate rich responsive HTML email template for monthly performance report
 */
export const generateMonthlyReportHTML = (reportData) => {
  const {
    user,
    monthLabel,
    totalTargetsAssigned,
    totalTasksCompleted,
    totalAchievedUnits,
    totalGoalUnits,
    overallRate,
    grade,
    gradeColor,
    badgeText,
    brandGroups = [],
  } = reportData;

  const brandsHTML = brandGroups.length > 0
    ? brandGroups.map((bg) => {
      const rowsHTML = bg.targets.map((t, idx) => `
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: ${idx % 2 === 0 ? '#ffffff' : '#fafafa'};">
          <td style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #1e293b;">
            ${t.name}
            <span style="font-size: 10px; color: #64748b; font-weight: normal; margin-left: 4px;">(${t.platform})</span>
          </td>
          <td style="padding: 10px 14px; font-size: 11px; color: #475569; text-align: center; font-weight: 600;">
            ${t.frequency}
          </td>
          <td style="padding: 10px 14px; font-size: 12px; color: #0f172a; text-align: right; font-weight: 700;">
            ${t.achieved} <span style="font-size: 10px; color: #94a3b8; font-weight: normal;">/ ${t.goal}</span>
          </td>
          <td style="padding: 10px 14px; text-align: center;">
            <span style="display: inline-block; padding: 3px 7px; font-size: 10px; font-weight: 700; border-radius: 6px; ${
              t.percent >= 100
                ? 'background-color: #dcfce7; color: #15803d;'
                : t.percent >= 50
                  ? 'background-color: #e0e7ff; color: #4338ca;'
                  : 'background-color: #fee2e2; color: #b91c1c;'
            }">
              ${t.percent}%
            </span>
          </td>
        </tr>
      `).join('');

      return `
        <div style="margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <!-- Brand Header -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <tr>
              <td style="padding: 12px 16px; font-size: 14px; font-weight: 800; color: #1e1b4b;">
                🏢 ${bg.brandName}
                <span style="font-size: 11px; font-weight: 600; color: #64748b; margin-left: 6px;">(${bg.targets.length} Targets)</span>
              </td>
              <td style="padding: 12px 16px; text-align: right;">
                <span style="font-size: 12px; font-weight: 700; color: #0f172a;">${bg.totalAchieved} / ${bg.totalGoal} Units</span>
                <span style="display: inline-block; margin-left: 8px; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; ${
                  bg.rate >= 100
                    ? 'background-color: #dcfce7; color: #15803d;'
                    : bg.rate >= 50
                      ? 'background-color: #e0e7ff; color: #4338ca;'
                      : 'background-color: #fee2e2; color: #b91c1c;'
                }">
                  ${bg.rate}%
                </span>
              </td>
            </tr>
          </table>

          <!-- Brand Targets Table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <thead>
              <tr style="background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
                <th style="padding: 8px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; text-align: left; letter-spacing: 0.5px;">
                  Target Activity
                </th>
                <th style="padding: 8px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; text-align: center; letter-spacing: 0.5px;">
                  Frequency
                </th>
                <th style="padding: 8px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; text-align: right; letter-spacing: 0.5px;">
                  Output / Goal
                </th>
                <th style="padding: 8px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; text-align: center; letter-spacing: 0.5px;">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
          </table>
        </div>
      `;
    }).join('')
    : `
      <div style="padding: 24px; text-align: center; color: #64748b; font-size: 13px; border: 1px dashed #cbd5e1; border-radius: 12px; background-color: #f8fafc;">
        No active targets were assigned for this period.
      </div>
    `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${monthLabel} Monthly Performance Report</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <div style="max-width: 680px; margin: 30px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
    
    <!-- HEADER -->
    <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); padding: 36px 32px; color: #ffffff; text-align: left; position: relative;">
      <div style="display: inline-block; padding: 6px 12px; background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(8px); border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
        Monthly Performance Audit
      </div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">
        ${monthLabel} Performance Report
      </h1>
      <p style="margin: 6px 0 0 0; font-size: 14px; color: #c7d2fe; font-weight: 500;">
        Prepared for <strong>${user.name}</strong> (${user.role.toUpperCase()}) &bull; ${user.email}
      </p>
    </div>

    <!-- BODY CONTENT -->
    <div style="padding: 32px;">
      
      <!-- PERFORMANCE HIGHLIGHT CARDS -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
        <tr>
          <!-- Card 1: Completion % -->
          <td width="33%" style="padding: 4px;">
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 14px; text-align: center;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">
                Overall Goal
              </div>
              <div style="font-size: 26px; font-weight: 900; color: ${gradeColor};">
                ${overallRate}%
              </div>
              <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-top: 2px;">
                Completion Rate
              </div>
            </div>
          </td>

          <!-- Card 2: Units Delivered -->
          <td width="33%" style="padding: 4px;">
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 14px; text-align: center;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">
                Total Output
              </div>
              <div style="font-size: 24px; font-weight: 900; color: #0f172a;">
                ${totalAchievedUnits} <span style="font-size: 12px; font-weight: normal; color: #94a3b8;">/ ${totalGoalUnits}</span>
              </div>
              <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-top: 2px;">
                Units Delivered
              </div>
            </div>
          </td>

          <!-- Card 3: Grade -->
          <td width="33%" style="padding: 4px;">
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 14px; text-align: center;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">
                Rating
              </div>
              <div style="font-size: 14px; font-weight: 900; color: ${gradeColor}; margin-top: 5px; margin-bottom: 5px;">
                ${grade}
              </div>
              <div style="font-size: 11px; font-weight: 600; color: #64748b;">
                ${badgeText}
              </div>
            </div>
          </td>
        </tr>
      </table>

      <!-- PROGRESS SUMMARY BANNER -->
      <div style="background: #f8fafc; border-left: 4px solid ${gradeColor}; border-radius: 8px; padding: 14px 18px; margin-bottom: 28px;">
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #334155;">
          ${overallRate >= 80
            ? `<strong>Fantastic job this month!</strong> You successfully completed <strong>${totalTasksCompleted} tasks</strong> and achieved an impressive <strong>${overallRate}%</strong> of your monthly goals across all brands. Keep up the high standard!`
            : `During <strong>${monthLabel}</strong>, you delivered <strong>${totalAchievedUnits} units</strong> across <strong>${totalTasksCompleted} tasks</strong>. Review the brand breakdowns below to target areas for growth in the coming month!`
          }
        </p>
      </div>

      <!-- BRAND BREAKDOWN SECTIONS -->
      <h3 style="font-size: 15px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px 0;">
        Performance Breakdown by Brand
      </h3>

      ${brandsHTML}

      <!-- FOOTER NOTE -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
        <p style="margin: 0 0 6px 0;">
          This automated report was generated on the 1st of the month by the <strong>Petsfolio Performance Management System</strong>.
        </p>
        <p style="margin: 0;">
          &copy; ${new Date().getFullYear()} Petsfolio. All rights reserved.
        </p>
      </div>

    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Dispatch monthly performance reports to all active employees and interns
 * @param {Object} options - { referenceDate, previewOnly, targetUserId, sendToEmail }
 */
export const sendMonthlyPerformanceReports = async (options = {}) => {
  const {
    referenceDate = new Date(),
    previewOnly = false,
    targetUserId = null,
    sendToEmail = null,
  } = options;

  const { startDate, endDate, monthLabel } = getPreviousMonthDateRange(referenceDate);
  console.log(`[MonthlyReport] Starting monthly performance report dispatch for: ${monthLabel} (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`);

  // Query active users
  const query = {
    isBlocked: { $ne: true },
    role: { $in: ['employee', 'intern'] },
  };

  if (targetUserId) {
    query._id = new mongoose.Types.ObjectId(targetUserId);
  }

  const users = await User.find(query).lean();
  console.log(`[MonthlyReport] Found ${users.length} active users to process.`);

  const results = [];

  for (const user of users) {
    try {
      const performanceData = await compileUserMonthlyPerformance(user, startDate, endDate, monthLabel);
      if (!performanceData) continue;

      const html = generateMonthlyReportHTML(performanceData);
      const subject = `📊 Your ${monthLabel} Performance Report - Petsfolio`;
      const recipientEmail = sendToEmail || user.email;

      if (previewOnly) {
        results.push({
          user: user.name,
          email: recipientEmail,
          status: 'preview',
          performanceData,
          html,
        });
      } else {
        const sendRes = await sendEmail({
          to: recipientEmail,
          subject,
          html,
        });

        results.push({
          user: user.name,
          email: recipientEmail,
          status: sendRes.success ? 'sent' : 'failed',
          simulated: sendRes.simulated || false,
          error: sendRes.error || null,
          rate: performanceData.overallRate,
        });
      }
    } catch (err) {
      console.error(`[MonthlyReport] Error processing report for ${user.name} (${user.email}):`, err.message);
      results.push({
        user: user.name,
        email: user.email,
        status: 'error',
        error: err.message,
      });
    }
  }

  console.log(`[MonthlyReport] Finished processing reports. Total processed: ${results.length}`);
  return {
    monthLabel,
    startDate,
    endDate,
    totalUsers: users.length,
    results,
  };
};

export default {
  getPreviousMonthDateRange,
  compileUserMonthlyPerformance,
  generateMonthlyReportHTML,
  sendMonthlyPerformanceReports,
};
