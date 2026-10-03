-- MySQL dump for table `holidays`
-- Database: lms_panel
-- Generated on 2026-10-03 09:49:31

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

--
-- Table structure for table `holidays`
--

DROP TABLE IF EXISTS `holidays`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `holidays` (
  `id` int NOT NULL AUTO_INCREMENT,
  `holiday_name` varchar(255) NOT NULL,
  `holiday_date` date NOT NULL,
  `description` text,
  `holiday_type` enum('public','national','company') DEFAULT 'public',
  `year` int NOT NULL,
  `status` varchar(255) DEFAULT 'active',
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `holidays`
--

LOCK TABLES `holidays` WRITE;
/*!40000 ALTER TABLE `holidays` DISABLE KEYS */;
INSERT INTO `holidays` VALUES (1,'Happy Independence Day','2026-08-15','Wishing you and your team a very Happy 80th Independence Day.\nMay our nation continue to grow with unity, peace, and prosperity.\n\nJai Hind! ??','public',2026,'active','2026-08-15 04:47:10'),
(2,'Raksha Bandhan','2026-08-28','The office will remain closed on 28 August on the occasion of Raksha Bandhan.','public',2026,'active','2026-08-15 04:48:07'),
(3,'Gandhi Jayanti','2026-10-02','Gandhi Jayanti','public',2026,'active','2026-08-15 04:49:56'),
(4,'Dussehra','2026-10-20','Dussehra','public',2026,'active','2026-08-15 04:50:25'),
(5,'Dussehra','2026-10-19','Dussehra','public',2026,'active','2026-08-15 04:50:49'),
(6,'Diwali','2026-11-08','Diwali','public',2026,'active','2026-08-15 04:51:27'),
(7,'Govardhan Puja','2026-11-09','Govardhan Puja','public',2026,'active','2026-08-15 04:51:51'),
(8,'Christmas','2026-12-25','Christmas','public',2026,'active','2026-08-15 04:52:16');
/*!40000 ALTER TABLE `holidays` ENABLE KEYS */;
UNLOCK TABLES;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
