-- MySQL dump for table `employees`
-- Database: lms_panel
-- Generated on 2026-10-09 07:41:59

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
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `employee_id` varchar(50) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `department` varchar(50) DEFAULT NULL,
  `position` varchar(50) DEFAULT NULL,
  `joining_date` datetime DEFAULT NULL,
  `salary` decimal(10,2) DEFAULT NULL,
  `profile_picture` varchar(255) DEFAULT NULL,
  `address` text,
  `emergency_contact` varchar(50) DEFAULT NULL,
  `bank_account` varchar(50) DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `employee_id` (`employee_id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_employees_department` (`department`),
  KEY `idx_employees_deleted_at` (`deleted_at`),
  CONSTRAINT `employees_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (1,1,'PT202601011','John','Doe','admin@lms.com','1234567890','Administration','System Admin','2023-01-01 00:00:00','75000.00',NULL,NULL,NULL,NULL,NULL,'2026-08-08 18:30:49','2026-08-08 18:30:49'),
(2,2,'PT202608082','Manoj','Sharma','it13manoj@gmail.com','9340334221','IT','Sales Manager','2026-08-08 00:00:00','100000.00',NULL,NULL,NULL,NULL,NULL,'2026-08-08 13:13:22','2026-08-08 13:13:22'),
(3,3,'PT202608153','Komal','Kushwaha','kushwahakomal382@gmail.com','95898 69227','IT','Web Developer','2026-08-01 00:00:00','4000.00',NULL,NULL,NULL,NULL,NULL,'2026-08-15 06:20:42','2026-08-15 06:20:42'),
(4,4,'PT2025080101','Alok','Kumar','alok.kumar767@company.com',NULL,'General','Staff','2026-10-03 07:05:04','30000.00',NULL,NULL,NULL,NULL,NULL,'2026-10-03 07:05:04','2026-10-06 09:19:46'),
(5,5,'PT2026010103','Vikki','Kumar','vikki.kumar598@company.com',NULL,'General','Staff','2026-10-03 07:05:04','28000.00',NULL,NULL,NULL,NULL,NULL,'2026-10-03 07:05:04','2026-10-06 09:19:46');
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
