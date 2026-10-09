const { sequelize } = require('../config/database');
const fs = require('fs');
const path = require('path');

const TABLES = [
  'users',
  'employees',
  'attendance',
  'holidays',
  'leaves',
  'payments',
  'performance',
  'policies',
  'salary',
  'meetings',
  'meeting_documents',
  'meeting_messages'
];

function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (val instanceof Date) {
    return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }
  const str = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  return `'${str}'`;
}

async function exportDump() {
  const dumpDir = path.resolve('Dump20260808');
  if (!fs.existsSync(dumpDir)) {
    fs.mkdirSync(dumpDir, { recursive: true });
  }

  const currentDate = new Date().toISOString().replace('T', ' ').slice(0, 19);
  let allSqlContent = `-- LMS Panel Complete Database Dump
-- Generated on ${currentDate}
-- Host: localhost    Database: ${sequelize.config.database}

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

`;

  for (const table of TABLES) {
    try {
      const [createRes] = await sequelize.query(`SHOW CREATE TABLE \`${table}\``);
      const createTableSql = createRes[0]['Create Table'];
      const [rows] = await sequelize.query(`SELECT * FROM \`${table}\``);

      let tableSql = `--
-- Table structure for table \`${table}\`
--

DROP TABLE IF EXISTS \`${table}\`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
${createTableSql};
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table \`${table}\`
--

LOCK TABLES \`${table}\` WRITE;
/*!40000 ALTER TABLE \`${table}\` DISABLE KEYS */;
`;

      if (rows.length > 0) {
        const rowValues = rows.map(r => {
          const vals = Object.values(r).map(v => escapeValue(v));
          return `(${vals.join(',')})`;
        });
        tableSql += `INSERT INTO \`${table}\` VALUES ${rowValues.join(',\n')};\n`;
      }

      tableSql += `/*!40000 ALTER TABLE \`${table}\` ENABLE KEYS */;
UNLOCK TABLES;
`;

      // Write single table file to Dump20260808
      const singleFileHeader = `-- MySQL dump for table \`${table}\`
-- Database: ${sequelize.config.database}
-- Generated on ${currentDate}

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

${tableSql}
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
`;

      fs.writeFileSync(path.join(dumpDir, `lms_panel_${table}.sql`), singleFileHeader, 'utf8');
      console.log(`✅ Exported Dump20260808/lms_panel_${table}.sql (${rows.length} rows)`);

      allSqlContent += tableSql + '\n';
    } catch (err) {
      console.error(`⚠️ Failed to export ${table}:`, err.message);
    }
  }

  allSqlContent += `
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
`;

  fs.writeFileSync(path.join(dumpDir, 'lms_panel_all.sql'), allSqlContent, 'utf8');
  console.log(`✅ Exported Dump20260808/lms_panel_all.sql (Full database backup)`);

  await sequelize.close();
}

exportDump();
