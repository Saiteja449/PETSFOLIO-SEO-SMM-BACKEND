import { MongoClient } from 'mongodb';

const SOURCE_URI = "mongodb+srv://saitejageminiai_db_user:Saiteja1920@cluster0.rqmmuo2.mongodb.net/seo-smm-beta?appName=seo-smm-beta";
const DEST_URI = "mongodb://crmuser:PetsfolioCRM%402026@127.0.0.1:27017/seo?authSource=admin";

async function migrateData() {
  console.log("Connecting to source database...");
  const sourceClient = new MongoClient(SOURCE_URI);
  
  let destClient;
  try {
    await sourceClient.connect();
    const sourceDb = sourceClient.db();
    console.log("Connected to source database successfully.");
    
    console.log("Connecting to destination database...");
    destClient = new MongoClient(DEST_URI);
    await destClient.connect();
    const destDb = destClient.db();
    console.log("Connected to destination database successfully.");
    
    const collections = await sourceDb.listCollections().toArray();
    
    for (const colInfo of collections) {
      const colName = colInfo.name;
      if (colName.startsWith('system.')) continue;
      
      console.log(`\nProcessing collection: ${colName}`);
      
      const sourceCol = sourceDb.collection(colName);
      const destCol = destDb.collection(colName);
      
      const docs = await sourceCol.find({}).toArray();
      if (docs.length > 0) {
        console.log(`Found ${docs.length} documents in source.`);
        
        // Clear the destination collection before inserting to avoid duplicate key errors
        await destCol.deleteMany({});
        console.log(`Cleared existing documents in destination collection ${colName}.`);
        
        await destCol.insertMany(docs);
        console.log(`Successfully migrated ${docs.length} documents to ${colName}.`);
      } else {
        console.log(`Collection ${colName} is empty. Skipping.`);
      }
    }
    
    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("\n❌ Error during migration:", error);
  } finally {
    if (sourceClient) await sourceClient.close();
    if (destClient) await destClient.close();
  }
}

migrateData();
