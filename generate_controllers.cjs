const fs = require('fs');

const generateController = (sourceName, targetName, sourceModel, targetModel, sourceTemplate, targetTemplate) => {
  let content = fs.readFileSync(`./controllers/${sourceName}Controller.js`, 'utf8');
  content = content.replace(new RegExp(sourceModel, 'g'), targetModel);
  content = content.replace(new RegExp(sourceTemplate, 'g'), targetTemplate);
  content = content.replace(new RegExp(sourceName.charAt(0).toUpperCase() + sourceName.slice(1), 'g'), targetName.charAt(0).toUpperCase() + targetName.slice(1));
  content = content.replace(new RegExp(sourceName, 'g'), targetName);
  content = content.replace(new RegExp('SEO', 'g'), targetName.charAt(0).toUpperCase() + targetName.slice(1));
  
  // Fix recalculation logic
  content = content.replace(
    /const completedCount = await [a-zA-Z]+\.countDocuments\(\{[^}]+\}\);/s,
    `const completedTasks = await ${targetModel}.find({
        employeeId,
        type: taskType,
        status: 'completed',
        createdAt: { $gte: target.startDate, $lte: target.endDate }
      });
      const completedCount = completedTasks.reduce((acc, t) => acc + (t.completedQuantity || 1), 0);`
  );
  
  fs.writeFileSync(`./controllers/${targetName}Controller.js`, content);
};

generateController('seoTask', 'contentTask', 'SeoTask', 'ContentTask', 'SeoActivityTemplate', 'ContentActivityTemplate');
generateController('seoTask', 'salesTask', 'SeoTask', 'SalesTask', 'SeoActivityTemplate', 'SalesActivityTemplate');
generateController('seoTask', 'creativeTask', 'SeoTask', 'CreativeTask', 'SeoActivityTemplate', 'CreativeActivityTemplate');

// Fix the original seoTaskController and smmTaskController
const fixRecalc = (name, model) => {
  let content = fs.readFileSync(`./controllers/${name}Controller.js`, 'utf8');
  content = content.replace(
    /const completedCount = await [a-zA-Z]+\.countDocuments\([^;]+\);/s,
    `const completedTasks = await ${model}.find({
        employeeId,
        type: taskType,
        status: 'completed',
        createdAt: { $gte: target.startDate, $lte: target.endDate }
      });
      const completedCount = completedTasks.reduce((acc, t) => acc + (t.completedQuantity || 1), 0);`
  );
  fs.writeFileSync(`./controllers/${name}Controller.js`, content);
}

fixRecalc('seoTask', 'SeoTask');
fixRecalc('smmTask', 'SmmTask');

console.log('Controllers generated and fixed.');
