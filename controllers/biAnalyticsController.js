import User from "../models/User.js";
import Company from "../models/Company.js";
import Task from "../models/Task.js";
import EmployeeTarget from "../models/EmployeeTarget.js";
import TrackedLink from "../models/TrackedLink.js";
import LinkClick from "../models/LinkClick.js";
import Lead from "../models/Lead.js";

// Helper to parse date range or default to current month
function parseDateRange(query) {
  const now = new Date();
  let start = query.startDate ? new Date(query.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  let end = query.endDate ? new Date(query.endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  // Compute equivalent duration previous period for MoM comparison
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  prevStart.setHours(0, 0, 0, 0);

  return { start, end, prevStart, prevEnd };
}

// Calculate working days (excluding Sundays) in range
function calculateWorkingDays(startDate, endDate) {
  let count = 0;
  let cur = new Date(startDate);
  cur.setHours(0, 0, 0, 0);
  const finish = new Date(endDate);
  finish.setHours(23, 59, 59, 999);

  while (cur <= finish) {
    if (cur.getDay() !== 0) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count || 1;
}

// Calculate growth percentage: ((curr - prev) / prev) * 100
function calcGrowth(current, previous) {
  if (!previous || previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

// 1. Unified BI Dashboard Overview
export async function getBiOverview(req, res) {
  try {
    const { start, end, prevStart, prevEnd } = parseDateRange(req.query);
    const { companyId, department } = req.query;

    const taskMatch = {};
    if (companyId && companyId !== "all") {
      taskMatch.companyId = companyId;
    }
    if (department && department !== "all") {
      taskMatch.department = new RegExp(`^${department}$`, "i");
    }

    // 1. Headcount metrics
    const users = await User.find({}).select("name role department isBlocked assignedCompanies").lean();
    const totalEmployees = users.filter((u) => u.role === "employee").length;
    const activeEmployees = users.filter((u) => u.role === "employee" && !u.isBlocked).length;
    const totalInterns = users.filter((u) => u.role === "intern").length;
    const activeInterns = users.filter((u) => u.role === "intern" && !u.isBlocked).length;
    const totalManagers = users.filter((u) => u.role === "manager").length;

    // 2. Current period tasks
    const currentTasksQuery = {
      ...taskMatch,
      $or: [
        { dueDate: { $gte: start, $lte: end } },
        { createdAt: { $gte: start, $lte: end } },
      ],
    };
    const currentTasks = await Task.find(currentTasksQuery).lean();

    // 3. Previous period tasks for MoM comparison
    const prevTasksQuery = {
      ...taskMatch,
      $or: [
        { dueDate: { $gte: prevStart, $lte: prevEnd } },
        { createdAt: { $gte: prevStart, $lte: prevEnd } },
      ],
    };
    const prevTasks = await Task.find(prevTasksQuery).lean();

    const now = new Date();

    // Helper to compute task stats
    const summarizeTasks = (taskList) => {
      let completed = 0;
      let inprogress = 0;
      let overdue = 0;
      let pending = 0;

      taskList.forEach((t) => {
        const isDone = t.status === "completed" || (t.targetQuantity > 0 && t.completedQuantity >= t.targetQuantity);
        if (isDone) {
          completed++;
        } else {
          const due = t.dueDate ? new Date(t.dueDate) : null;
          if (due && due < now) {
            overdue++;
          } else if (t.status === "inprogress") {
            inprogress++;
          } else {
            pending++;
          }
        }
      });

      const total = taskList.length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { total, completed, inprogress, pending, overdue, completionRate };
    };

    const currentStats = summarizeTasks(currentTasks);
    const prevStats = summarizeTasks(prevTasks);

    // Growth indicators
    const growth = {
      totalTasksGrowth: calcGrowth(currentStats.total, prevStats.total),
      completedGrowth: calcGrowth(currentStats.completed, prevStats.completed),
      completionRateDiff: currentStats.completionRate - prevStats.completionRate,
      overdueGrowth: calcGrowth(currentStats.overdue, prevStats.overdue),
    };

    // 4. Department Performance Breakdown
    const departments = ["SMM", "SEO", "Content", "Sales", "Creative"];
    const departmentBreakdown = departments.map((dept) => {
      const deptTasks = currentTasks.filter(
        (t) => String(t.department || "").toLowerCase() === dept.toLowerCase()
      );
      const stats = summarizeTasks(deptTasks);
      return {
        department: dept,
        ...stats,
      };
    });

    // 5. Daily Completion Trend (for Line Charts)
    const trendMap = {};
    let cursor = new Date(start);
    while (cursor <= end) {
      const dateStr = cursor.toISOString().split("T")[0];
      trendMap[dateStr] = { date: dateStr, assigned: 0, completed: 0, overdue: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }

    currentTasks.forEach((t) => {
      const d = t.dueDate ? new Date(t.dueDate) : t.createdAt ? new Date(t.createdAt) : null;
      if (d) {
        const dateStr = d.toISOString().split("T")[0];
        if (trendMap[dateStr]) {
          trendMap[dateStr].assigned++;
          if (t.status === "completed") {
            trendMap[dateStr].completed++;
          } else if (d < now) {
            trendMap[dateStr].overdue++;
          }
        }
      }
    });

    const dailyTrend = Object.values(trendMap);

    // 6. Working days & Avg Productivity
    const workingDays = calculateWorkingDays(start, end);
    const avgProductivity = currentStats.completed > 0 && activeEmployees > 0
      ? (currentStats.completed / (activeEmployees * workingDays)).toFixed(1)
      : "0.0";

    // 7. Links & Leads Marketing Summary for Period
    const linkMatch = companyId && companyId !== "all" ? { companyId, isActive: true } : { isActive: true };
    const totalLinks = await TrackedLink.countDocuments(linkMatch);
    const activeLinkIds = (await TrackedLink.find(linkMatch).select("_id").lean()).map((l) => l._id);
    const totalClicks = await LinkClick.countDocuments({
      linkId: { $in: activeLinkIds },
      createdAt: { $gte: start, $lte: end },
    });

    const leadMatch = {
      createdAt: { $gte: start, $lte: end },
    };
    if (companyId && companyId !== "all") leadMatch.companyId = companyId;

    const totalLeads = await Lead.countDocuments(leadMatch);
    const convertedLeads = await Lead.countDocuments({ ...leadMatch, status: "converted" });
    const leadConversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    res.json({
      success: true,
      data: {
        dateRange: {
          start: start.toISOString().split("T")[0],
          end: end.toISOString().split("T")[0],
          workingDays,
        },
        headcount: {
          totalEmployees,
          activeEmployees,
          totalInterns,
          activeInterns,
          totalManagers,
          totalRegistered: users.length,
        },
        taskOverview: {
          current: currentStats,
          previous: prevStats,
          growth,
        },
        avgProductivity: {
          tasksPerEmployeePerDay: parseFloat(avgProductivity),
          totalCompleted: currentStats.completed,
          activeStaffCount: activeEmployees + activeInterns,
        },
        marketingSummary: {
          totalLinks,
          totalClicks,
          totalLeads,
          convertedLeads,
          leadConversionRate,
        },
        departmentBreakdown,
        dailyTrend,
      },
    });
  } catch (err) {
    console.error("Error in getBiOverview:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// 2. Employee & Intern Productivity Leaderboard & Comparisons
export async function getBiProductivity(req, res) {
  try {
    const { start, end } = parseDateRange(req.query);
    const { companyId, department, role } = req.query;

    const userMatch = {};
    if (role && role !== "all") {
      userMatch.role = role.toLowerCase();
    } else {
      userMatch.role = { $in: ["employee", "intern"] };
    }
    if (department && department !== "all") {
      userMatch.department = { $in: [new RegExp(`^${department}$`, "i")] };
    }

    const users = await User.find(userMatch).select("name email role department isBlocked assignedCompanies").lean();
    const now = new Date();

    // Query tasks in period
    const taskMatch = {
      $or: [
        { dueDate: { $gte: start, $lte: end } },
        { createdAt: { $gte: start, $lte: end } },
      ],
    };
    if (companyId && companyId !== "all") {
      taskMatch.companyId = companyId;
    }
    if (department && department !== "all") {
      taskMatch.department = new RegExp(`^${department}$`, "i");
    }

    const allTasks = await Task.find(taskMatch).lean();
    const allTargets = await EmployeeTarget.find({}).lean();
    const workingDays = calculateWorkingDays(start, end);

    // Compute metrics per user
    const userMetrics = users.map((user) => {
      const userIdStr = user._id.toString();
      const userEmailNorm = (user.email || "").toLowerCase().trim();

      let assignedCount = 0;
      let completedCount = 0;
      let overdueCount = 0;
      let pendingCount = 0;
      let dailyCount = 0;
      let weeklyCount = 0;
      let monthlyCount = 0;
      let onTimeCount = 0;
      let delayedCount = 0;

      if (user.role === "employee") {
        const myTasks = allTasks.filter(
          (t) => t.employeeId === userIdStr || (t.assignedTo && t.assignedTo.toLowerCase().trim() === userEmailNorm)
        );

        assignedCount = myTasks.length;
        myTasks.forEach((t) => {
          if (t.frequency === "Daily") dailyCount++;
          if (t.frequency === "Weekly") weeklyCount++;
          if (t.frequency === "Monthly") monthlyCount++;

          const isDone = t.status === "completed" || (t.targetQuantity > 0 && t.completedQuantity >= t.targetQuantity);
          if (isDone) {
            completedCount++;
            const due = t.dueDate ? new Date(t.dueDate) : null;
            const updated = t.updatedAt ? new Date(t.updatedAt) : null;
            if (due && updated && updated > due) {
              delayedCount++;
            } else {
              onTimeCount++;
            }
          } else {
            const due = t.dueDate ? new Date(t.dueDate) : null;
            if (due && due < now) {
              overdueCount++;
            } else {
              pendingCount++;
            }
          }
        });
      } else {
        // Intern: scan subTasks
        allTasks.forEach((t) => {
          (t.subTasks || []).forEach((st) => {
            if (st.assignedToInternId === userIdStr) {
              assignedCount++;
              const isDone = st.status === "completed" || (st.targetQuantity > 0 && st.completedQuantity >= st.targetQuantity);
              if (isDone) {
                completedCount++;
                onTimeCount++;
              } else {
                const due = t.dueDate ? new Date(t.dueDate) : null;
                if (due && due < now) {
                  overdueCount++;
                } else {
                  pendingCount++;
                }
              }
            }
          });
        });
      }

      // Compute targets for this user
      const userTargets = allTargets.filter((tg) => tg.employeeId?.toString() === userIdStr);
      let targetGoal = 0;
      let achievedTarget = 0;

      userTargets.forEach((tg) => {
        const goal = tg.monthlyTarget || (tg.targetGoal ? parseInt(tg.targetGoal, 10) * (tg.frequency === "Daily" ? workingDays : 1) : 0);
        targetGoal += goal;
        achievedTarget += tg.currentValue || 0;
      });

      const completionRate = assignedCount > 0 ? Math.round((completedCount / assignedCount) * 100) : 0;
      const targetAchievementRate = targetGoal > 0 ? Math.min(Math.round((achievedTarget / targetGoal) * 100), 100) : completionRate;

      const onTimeRate = completedCount > 0 ? (onTimeCount / completedCount) * 100 : 0;
      const performanceScore = Math.min(
        Math.round(completionRate * 0.6 + targetAchievementRate * 0.3 + onTimeRate * 0.1),
        100
      );

      let efficiencyRating = "Medium";
      if (performanceScore >= 80) efficiencyRating = "High";
      else if (performanceScore < 50) efficiencyRating = "Needs Attention";

      return {
        id: userIdStr,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || [],
        isBlocked: user.isBlocked,
        assignedTasks: assignedCount,
        completedTasks: completedCount,
        pendingTasks: pendingCount,
        overdueTasks: overdueCount,
        frequencyBreakdown: {
          daily: dailyCount,
          weekly: weeklyCount,
          monthly: monthlyCount,
        },
        onTimeCount,
        delayedCount,
        completionRate,
        targetGoal,
        achievedTarget,
        targetAchievementRate,
        performanceScore,
        efficiencyRating,
      };
    });

    const leaderboard = [...userMetrics].sort((a, b) => b.performanceScore - a.performanceScore);
    const underperforming = userMetrics.filter((u) => u.performanceScore < 55 || u.overdueTasks > 5);

    res.json({
      success: true,
      data: {
        totalEvaluated: userMetrics.length,
        leaderboard,
        underperforming,
        topPerformers: leaderboard.slice(0, 5),
      },
    });
  } catch (err) {
    console.error("Error in getBiProductivity:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// 3. Automated AI Improvement Suggestions based on live data
export async function getBiSuggestions(req, res) {
  try {
    const { start, end } = parseDateRange(req.query);
    const allTasks = await Task.find({
      $or: [{ dueDate: { $gte: start, $lte: end } }, { createdAt: { $gte: start, $lte: end } }],
    }).lean();

    const suggestions = [];

    // 1. Check for overdue task bottlenecks
    const now = new Date();
    const overdueTasks = allTasks.filter((t) => t.status !== "completed" && t.dueDate && new Date(t.dueDate) < now);
    if (overdueTasks.length > 5) {
      const overdueByDept = {};
      overdueTasks.forEach((t) => {
        const d = t.department || "Other";
        overdueByDept[d] = (overdueByDept[d] || 0) + 1;
      });
      const topOverdueDept = Object.entries(overdueByDept).sort((a, b) => b[1] - a[1])[0];

      suggestions.push({
        id: "overdue_warning",
        category: "Productivity",
        severity: "warning",
        title: `${overdueTasks.length} Tasks Currently Overdue`,
        description: `The ${topOverdueDept ? topOverdueDept[0] : ""} department has the highest volume of delayed tasks (${topOverdueDept ? topOverdueDept[1] : 0} overdue).`,
        recommendation: "Re-evaluate daily workload allocation and reassign pending items to active interns to prevent end-of-month backlogs.",
      });
    }

    // 2. Check Department Completion Disparity
    const departments = ["SMM", "SEO", "Content", "Sales", "Creative"];
    const deptRates = departments.map((d) => {
      const tasks = allTasks.filter((t) => String(t.department || "").toLowerCase() === d.toLowerCase());
      const done = tasks.filter((t) => t.status === "completed").length;
      return { dept: d, rate: tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 100, count: tasks.length };
    }).filter((item) => item.count > 0);

    const lowestDept = deptRates.sort((a, b) => a.rate - b.rate)[0];
    if (lowestDept && lowestDept.rate < 60) {
      suggestions.push({
        id: "dept_gap",
        category: "Department Performance",
        severity: "urgent",
        title: `${lowestDept.dept} Completion Rate Below Target (${lowestDept.rate}%)`,
        description: `Only ${lowestDept.rate}% of tasks in ${lowestDept.dept} have been completed in the current period.`,
        recommendation: `Conduct a mid-month alignment meeting with the ${lowestDept.dept} team lead to identify blockers and establish daily checkpoints.`,
      });
    }

    // 3. Positive Growth Recognition
    const totalDone = allTasks.filter((t) => t.status === "completed").length;
    if (totalDone > 10) {
      suggestions.push({
        id: "positive_momentum",
        category: "Business Growth",
        severity: "info",
        title: "Solid Task Execution Velocity",
        description: `${totalDone} deliverables completed successfully across all brands in the selected timeframe.`,
        recommendation: "Maintain automated splitting workflows to ensure interns continue executing routine deliverables smoothly.",
      });
    }

    res.json({
      success: true,
      data: {
        totalSuggestions: suggestions.length,
        suggestions,
      },
    });
  } catch (err) {
    console.error("Error in getBiSuggestions:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
