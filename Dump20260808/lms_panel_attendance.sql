-- MySQL dump for table `attendance`
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
-- Table structure for table `attendance`
--

DROP TABLE IF EXISTS `attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int DEFAULT NULL,
  `job_no` varchar(50) DEFAULT NULL,
  `employee_name` varchar(100) DEFAULT NULL,
  `date` date NOT NULL,
  `check_in` time DEFAULT NULL,
  `check_out` time DEFAULT NULL,
  `status` enum('present','absent','late','half-day','holiday') DEFAULT 'absent',
  `late_minutes` int DEFAULT '0',
  `early_leave_minutes` int DEFAULT '0',
  `remarks` varchar(255) DEFAULT NULL,
  `working_hours` decimal(5,2) DEFAULT NULL,
  `overtime_hours` decimal(5,2) DEFAULT NULL,
  `raw_punches` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_attendance` (`employee_id`,`date`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=159 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance`
--

LOCK TABLES `attendance` WRITE;
/*!40000 ALTER TABLE `attendance` DISABLE KEYS */;
INSERT INTO `attendance` VALUES (6,2,'PT202608082','Manoj Sharma','2026-08-08','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-03 07:26:06'),
(7,4,'PT2025080101','Alok Kumar','2026-08-08','14:14:45','18:58:33','present',284,0,'Late by 4h 44m (In: 02:14 PM) | Full day completed (Out: 06:58 PM)','4.73',NULL,'["14:14:45","14:14:57","14:35:10","14:35:21","14:35:36","18:58:33"]','2026-10-03 07:26:06'),
(8,5,'PT2026010103','Vikki Kumar','2026-08-08','14:34:29','16:46:36','present',304,103,'Late by 5h 4m (In: 02:34 PM) | Left early by 1h 43m (Out: 04:46 PM)','2.20',NULL,'["14:34:29","16:46:36"]','2026-10-03 07:26:06'),
(9,3,'PT202608153','Komal Kushwaha','2026-08-08','18:20:31',NULL,'present',530,0,'Late by 8h 50m (In: 06:20 PM) | No check-out recorded','0.00',NULL,'["18:20:31"]','2026-10-03 07:26:06'),
(10,4,'PT2025080101','Alok Kumar','2026-08-10','08:55:57','18:24:55','present',0,5,'On Time (In: 08:55 AM) | Left early by 5m (Out: 06:24 PM)','9.48',NULL,'["08:55:57","08:56:06","18:24:55"]','2026-10-03 07:26:06'),
(11,5,'PT2026010103','Vikki Kumar','2026-08-10','08:56:42','18:25:44','present',0,4,'On Time (In: 08:56 AM) | Left early by 4m (Out: 06:25 PM)','9.48',NULL,'["08:56:42","18:25:44"]','2026-10-03 07:26:06'),
(12,3,'PT202608153','Komal Kushwaha','2026-08-10','09:28:38','18:16:25','present',0,13,'On Time (In: 09:28 AM) | Left early by 13m (Out: 06:16 PM)','8.80',NULL,'["09:28:38","09:30:02","18:16:25"]','2026-10-03 07:26:06'),
(13,4,'PT2025080101','Alok Kumar','2026-08-11','08:57:43','18:23:45','present',0,6,'On Time (In: 08:57 AM) | Left early by 6m (Out: 06:23 PM)','9.43',NULL,'["08:57:43","18:23:45"]','2026-10-03 07:26:06'),
(14,5,'PT2026010103','Vikki Kumar','2026-08-11','08:58:05','18:23:34','present',0,6,'On Time (In: 08:58 AM) | Left early by 6m (Out: 06:23 PM)','9.42',NULL,'["08:58:05","18:23:34"]','2026-10-03 07:26:06'),
(15,3,'PT202608153','Komal Kushwaha','2026-08-11','09:30:05','18:21:13','present',0,8,'Late by 0 min (In: 09:30 AM) | Left early by 8m (Out: 06:21 PM)','8.85',NULL,'["09:30:05","18:21:13"]','2026-10-03 07:26:06'),
(16,4,'PT2025080101','Alok Kumar','2026-08-12','09:04:44','18:30:14','present',0,0,'On Time (In: 09:04 AM) | Full day completed (Out: 06:30 PM)','9.43',NULL,'["09:04:44","18:30:14"]','2026-10-03 07:26:06'),
(17,5,'PT2026010103','Vikki Kumar','2026-08-15','07:14:09','09:08:06','present',0,561,'On Time (In: 07:14 AM) | Left early by 9h 21m (Out: 09:08 AM)','1.90',NULL,'["07:14:09","09:08:06"]','2026-10-03 07:26:06'),
(18,4,'PT2025080101','Alok Kumar','2026-08-17','08:51:08','18:32:14','present',0,0,'On Time (In: 08:51 AM) | Full day completed (Out: 06:32 PM)','9.69',NULL,'["08:51:08","18:32:14"]','2026-10-03 07:26:06'),
(19,5,'PT2026010103','Vikki Kumar','2026-08-17','08:51:23','18:32:59','present',0,0,'On Time (In: 08:51 AM) | Full day completed (Out: 06:32 PM)','9.69',NULL,'["08:51:23","18:32:59"]','2026-10-03 07:26:06'),
(20,3,'PT202608153','Komal Kushwaha','2026-08-17','09:42:41','18:29:20','present',12,0,'Late by 12m (In: 09:42 AM) | Left early by 0 min (Out: 06:29 PM)','8.78',NULL,'["09:42:41","18:29:20"]','2026-10-03 07:26:06'),
(21,4,'PT2025080101','Alok Kumar','2026-08-18','08:53:29','18:32:11','present',0,0,'On Time (In: 08:53 AM) | Full day completed (Out: 06:32 PM)','9.64',NULL,'["08:53:29","18:32:11"]','2026-10-03 07:26:06'),
(22,5,'PT2026010103','Vikki Kumar','2026-08-18','08:54:07','18:32:37','present',0,0,'On Time (In: 08:54 AM) | Full day completed (Out: 06:32 PM)','9.64',NULL,'["08:54:07","18:32:37"]','2026-10-03 07:26:06'),
(23,3,'PT202608153','Komal Kushwaha','2026-08-18','09:31:25','18:27:33','present',1,2,'Late by 1m (In: 09:31 AM) | Left early by 2m (Out: 06:27 PM)','8.94',NULL,'["09:31:25","18:27:33"]','2026-10-03 07:26:06'),
(24,4,'PT2025080101','Alok Kumar','2026-08-19','09:10:11','18:39:38','present',0,0,'On Time (In: 09:10 AM) | Full day completed (Out: 06:39 PM)','9.49',NULL,'["09:10:11","18:39:38"]','2026-10-03 07:26:06'),
(25,5,'PT2026010103','Vikki Kumar','2026-08-19','09:10:25','18:39:58','present',0,0,'On Time (In: 09:10 AM) | Full day completed (Out: 06:39 PM)','9.49',NULL,'["09:10:25","18:39:58"]','2026-10-03 07:26:06'),
(26,3,'PT202608153','Komal Kushwaha','2026-08-19','09:29:48','18:29:26','present',0,0,'On Time (In: 09:29 AM) | Left early by 0 min (Out: 06:29 PM)','8.99',NULL,'["09:29:48","18:29:26"]','2026-10-03 07:26:06'),
(27,5,'PT2026010103','Vikki Kumar','2026-08-20','08:55:23','18:34:00','present',0,0,'On Time (In: 08:55 AM) | Full day completed (Out: 06:34 PM)','9.64',NULL,'["08:55:23","18:34:00"]','2026-10-03 07:26:06'),
(28,4,'PT2025080101','Alok Kumar','2026-08-20','09:03:07','18:34:12','present',0,0,'On Time (In: 09:03 AM) | Full day completed (Out: 06:34 PM)','9.52',NULL,'["09:03:07","18:34:12"]','2026-10-03 07:26:06'),
(29,3,'PT202608153','Komal Kushwaha','2026-08-20','09:43:43','18:30:45','present',13,0,'Late by 13m (In: 09:43 AM) | Full day completed (Out: 06:30 PM)','8.78',NULL,'["09:43:43","18:30:45"]','2026-10-03 07:26:06'),
(30,4,'PT2025080101','Alok Kumar','2026-08-21','08:57:58','18:32:10','present',0,0,'On Time (In: 08:57 AM) | Full day completed (Out: 06:32 PM)','9.57',NULL,'["08:57:58","18:32:10"]','2026-10-03 07:26:06'),
(31,5,'PT2026010103','Vikki Kumar','2026-08-21','08:59:00','18:32:51','present',0,0,'On Time (In: 08:59 AM) | Full day completed (Out: 06:32 PM)','9.56',NULL,'["08:59:00","18:32:51"]','2026-10-03 07:26:06'),
(32,3,'PT202608153','Komal Kushwaha','2026-08-21','09:38:58','18:28:08','present',8,1,'Late by 8m (In: 09:38 AM) | Left early by 1m (Out: 06:28 PM)','8.82',NULL,'["09:38:58","18:28:08"]','2026-10-03 07:26:06'),
(33,5,'PT2026010103','Vikki Kumar','2026-08-22','09:07:46',NULL,'present',0,0,'On Time (In: 09:07 AM) | No check-out recorded','0.00',NULL,'["09:07:46"]','2026-10-03 07:26:06'),
(34,3,'PT202608153','Komal Kushwaha','2026-08-22','09:37:40','17:14:40','present',7,75,'Late by 7m (In: 09:37 AM) | Left early by 1h 15m (Out: 05:14 PM)','7.62',NULL,'["09:37:40","17:14:40"]','2026-10-03 07:26:06'),
(35,4,'PT2025080101','Alok Kumar','2026-08-22','13:37:52','17:20:28','present',247,69,'Late by 4h 7m (In: 01:37 PM) | Left early by 1h 9m (Out: 05:20 PM)','3.71',NULL,'["13:37:52","17:20:28"]','2026-10-03 07:26:06'),
(36,4,'PT2025080101','Alok Kumar','2026-08-25','09:21:48',NULL,'present',0,0,'On Time (In: 09:21 AM) | No check-out recorded','0.00',NULL,'["09:21:48"]','2026-10-03 07:26:06'),
(37,4,'PT2025080101','Alok Kumar','2026-08-26','08:57:47','17:03:57','present',0,86,'On Time (In: 08:57 AM) | Left early by 1h 26m (Out: 05:03 PM)','8.10',NULL,'["08:57:47","17:03:57"]','2026-10-03 07:26:06'),
(38,3,'PT202608153','Komal Kushwaha','2026-08-26','09:33:26','15:44:11','present',3,165,'Late by 3m (In: 09:33 AM) | Left early by 2h 45m (Out: 03:44 PM)','6.18',NULL,'["09:33:26","15:44:11"]','2026-10-03 07:26:06'),
(39,4,'PT2025080101','Alok Kumar','2026-08-27','09:00:49','16:41:14','present',0,108,'On Time (In: 09:00 AM) | Left early by 1h 48m (Out: 04:41 PM)','7.67',NULL,'["09:00:49","16:41:14"]','2026-10-03 07:26:06'),
(40,5,'PT2026010103','Vikki Kumar','2026-08-27','09:01:12','16:41:23','present',0,108,'On Time (In: 09:01 AM) | Left early by 1h 48m (Out: 04:41 PM)','7.67',NULL,'["09:01:12","16:41:23"]','2026-10-03 07:26:06'),
(41,5,'PT2026010103','Vikki Kumar','2026-08-31','09:15:05','17:01:22','present',0,88,'On Time (In: 09:15 AM) | Left early by 1h 28m (Out: 05:01 PM)','7.77',NULL,'["09:15:05","17:01:22"]','2026-10-03 07:26:06'),
(42,4,'PT2025080101','Alok Kumar','2026-08-31','13:13:42','17:00:34','present',223,89,'Late by 3h 43m (In: 01:13 PM) | Left early by 1h 29m (Out: 05:00 PM)','3.78',NULL,'["13:13:42","17:00:34"]','2026-10-03 07:26:06'),
(43,4,'PT2025080101','Alok Kumar','2026-09-01','09:04:46','17:55:17','present',0,34,'On Time (In: 09:04 AM) | Left early by 34m (Out: 05:55 PM)','8.84',NULL,'["09:04:46","17:55:17"]','2026-10-03 07:26:06'),
(44,5,'PT2026010103','Vikki Kumar','2026-09-01','09:04:53','17:56:02','present',0,33,'On Time (In: 09:04 AM) | Left early by 33m (Out: 05:56 PM)','8.85',NULL,'["09:04:53","17:56:02"]','2026-10-03 07:26:06'),
(45,4,'PT2025080101','Alok Kumar','2026-09-02','09:09:20','17:44:38','present',0,45,'On Time (In: 09:09 AM) | Left early by 45m (Out: 05:44 PM)','8.59',NULL,'["09:09:20","17:44:38"]','2026-10-03 07:26:06'),
(46,5,'PT2026010103','Vikki Kumar','2026-09-02','09:09:32','17:45:15','present',0,44,'On Time (In: 09:09 AM) | Left early by 44m (Out: 05:45 PM)','8.60',NULL,'["09:09:32","17:45:15"]','2026-10-03 07:26:06'),
(47,5,'PT2026010103','Vikki Kumar','2026-09-03','08:57:14',NULL,'present',0,0,'On Time (In: 08:57 AM) | No check-out recorded','0.00',NULL,'["08:57:14"]','2026-10-03 07:26:06'),
(48,5,'PT2026010103','Vikki Kumar','2026-09-04','09:06:54','18:29:06','present',0,0,'On Time (In: 09:06 AM) | Left early by 0 min (Out: 06:29 PM)','9.37',NULL,'["09:06:54","18:29:06"]','2026-10-03 07:26:07'),
(49,3,'PT202608153','Komal Kushwaha','2026-09-04','09:24:36','18:22:54','present',0,7,'On Time (In: 09:24 AM) | Left early by 7m (Out: 06:22 PM)','8.97',NULL,'["09:24:36","18:22:54"]','2026-10-03 07:26:07'),
(50,4,'PT2025080101','Alok Kumar','2026-09-04','18:27:51',NULL,'present',537,0,'Late by 8h 57m (In: 06:27 PM) | No check-out recorded','0.00',NULL,'["18:27:51"]','2026-10-03 07:26:07'),
(51,5,'PT2026010103','Vikki Kumar','2026-09-05','08:54:15','13:55:02','present',0,274,'On Time (In: 08:54 AM) | Left early by 4h 34m (Out: 01:55 PM)','5.01',NULL,'["08:54:15","13:55:02"]','2026-10-03 07:26:07'),
(52,3,'PT202608153','Komal Kushwaha','2026-09-05','09:27:07','13:43:18','present',0,286,'On Time (In: 09:27 AM) | Left early by 4h 46m (Out: 01:43 PM)','4.27',NULL,'["09:27:07","13:43:18"]','2026-10-03 07:26:07'),
(53,5,'PT2026010103','Vikki Kumar','2026-09-07','09:04:15','18:34:52','present',0,0,'On Time (In: 09:04 AM) | Full day completed (Out: 06:34 PM)','9.51',NULL,'["09:04:15","18:34:52"]','2026-10-03 07:26:07'),
(54,3,'PT202608153','Komal Kushwaha','2026-09-07','09:36:20','18:28:54','present',6,1,'Late by 6m (In: 09:36 AM) | Left early by 1m (Out: 06:28 PM)','8.88',NULL,'["09:36:20","18:28:54"]','2026-10-03 07:26:07'),
(55,4,'PT2025080101','Alok Kumar','2026-09-07','18:33:13',NULL,'present',543,0,'Late by 9h 3m (In: 06:33 PM) | No check-out recorded','0.00',NULL,'["18:33:13"]','2026-10-03 07:26:07'),
(56,5,'PT2026010103','Vikki Kumar','2026-09-08','09:18:20',NULL,'present',0,0,'On Time (In: 09:18 AM) | No check-out recorded','0.00',NULL,'["09:18:20"]','2026-10-03 07:26:07'),
(57,3,'PT202608153','Komal Kushwaha','2026-09-08','09:33:07','18:17:00','present',3,13,'Late by 3m (In: 09:33 AM) | Left early by 13m (Out: 06:17 PM)','8.73',NULL,'["09:33:07","18:17:00"]','2026-10-03 07:26:07'),
(58,4,'PT2025080101','Alok Kumar','2026-09-08','18:24:41',NULL,'present',534,0,'Late by 8h 54m (In: 06:24 PM) | No check-out recorded','0.00',NULL,'["18:24:41"]','2026-10-03 07:26:07'),
(59,5,'PT2026010103','Vikki Kumar','2026-09-09','08:59:49','18:12:00','present',0,18,'On Time (In: 08:59 AM) | Left early by 18m (Out: 06:12 PM)','9.20',NULL,'["08:59:49","18:12:00"]','2026-10-03 07:26:07'),
(60,3,'PT202608153','Komal Kushwaha','2026-09-09','09:24:11','18:11:23','present',0,18,'On Time (In: 09:24 AM) | Left early by 18m (Out: 06:11 PM)','8.79',NULL,'["09:24:11","18:11:14","18:11:23"]','2026-10-03 07:26:07'),
(61,5,'PT2026010103','Vikki Kumar','2026-09-10','09:11:48','17:36:55','present',0,53,'On Time (In: 09:11 AM) | Left early by 53m (Out: 05:36 PM)','8.42',NULL,'["09:11:48","17:36:55"]','2026-10-03 07:26:07'),
(62,3,'PT202608153','Komal Kushwaha','2026-09-10','09:39:41','17:34:45','present',9,55,'Late by 9m (In: 09:39 AM) | Left early by 55m (Out: 05:34 PM)','7.92',NULL,'["09:39:41","09:39:52","17:34:45"]','2026-10-03 07:26:07'),
(63,5,'PT2026010103','Vikki Kumar','2026-09-11','09:04:43','18:34:53','present',0,0,'On Time (In: 09:04 AM) | Full day completed (Out: 06:34 PM)','9.50',NULL,'["09:04:43","18:34:53"]','2026-10-03 07:26:07'),
(64,3,'PT202608153','Komal Kushwaha','2026-09-11','09:32:16','18:24:59','present',2,5,'Late by 2m (In: 09:32 AM) | Left early by 5m (Out: 06:24 PM)','8.88',NULL,'["09:32:16","18:24:59"]','2026-10-03 07:26:07'),
(65,4,'PT2025080101','Alok Kumar','2026-09-11','18:33:51',NULL,'present',543,0,'Late by 9h 3m (In: 06:33 PM) | No check-out recorded','0.00',NULL,'["18:33:51"]','2026-10-03 07:26:07'),
(66,3,'PT202608153','Komal Kushwaha','2026-09-12','09:33:13','18:26:07','present',3,3,'Late by 3m (In: 09:33 AM) | Left early by 3m (Out: 06:26 PM)','8.88',NULL,'["09:33:13","18:26:07"]','2026-10-03 07:26:07'),
(67,5,'PT2026010103','Vikki Kumar','2026-09-12','09:33:27','19:02:24','present',3,0,'Late by 3m (In: 09:33 AM) | Full day completed (Out: 07:02 PM)','9.48',NULL,'["09:33:27","19:02:24"]','2026-10-03 07:26:07'),
(68,4,'PT2025080101','Alok Kumar','2026-09-12','19:02:02',NULL,'present',572,0,'Late by 9h 32m (In: 07:02 PM) | No check-out recorded','0.00',NULL,'["19:02:02"]','2026-10-03 07:26:07'),
(69,4,'PT2025080101','Alok Kumar','2026-09-14','07:07:40',NULL,'present',0,0,'On Time (In: 07:07 AM) | No check-out recorded','0.00',NULL,'["07:07:40"]','2026-10-03 07:26:07'),
(70,3,'PT202608153','Komal Kushwaha','2026-09-14','09:34:36','18:17:20','present',4,12,'Late by 4m (In: 09:34 AM) | Left early by 12m (Out: 06:17 PM)','8.71',NULL,'["09:34:36","18:17:20"]','2026-10-03 07:26:07'),
(71,5,'PT2026010103','Vikki Kumar','2026-09-14','10:15:42','18:20:00','present',45,10,'Late by 45m (In: 10:15 AM) | Left early by 10m (Out: 06:20 PM)','8.07',NULL,'["10:15:42","18:20:00"]','2026-10-03 07:26:07'),
(72,4,'PT2025080101','Alok Kumar','2026-09-15','06:42:53','18:32:43','present',0,0,'On Time (In: 06:42 AM) | Full day completed (Out: 06:32 PM)','11.83',NULL,'["06:42:53","18:32:43"]','2026-10-03 07:26:07'),
(73,5,'PT2026010103','Vikki Kumar','2026-09-15','09:08:24','18:32:36','present',0,0,'On Time (In: 09:08 AM) | Full day completed (Out: 06:32 PM)','9.40',NULL,'["09:08:24","18:32:36"]','2026-10-03 07:26:07'),
(74,3,'PT202608153','Komal Kushwaha','2026-09-15','09:33:45','18:24:30','present',3,5,'Late by 3m (In: 09:33 AM) | Left early by 5m (Out: 06:24 PM)','8.85',NULL,'["09:33:45","18:24:30"]','2026-10-03 07:26:07'),
(75,4,'PT2025080101','Alok Kumar','2026-09-16','06:42:20','16:36:24','present',0,113,'On Time (In: 06:42 AM) | Left early by 1h 53m (Out: 04:36 PM)','9.90',NULL,'["06:42:20","16:36:24"]','2026-10-03 07:26:07'),
(76,5,'PT2026010103','Vikki Kumar','2026-09-16','08:56:52','16:37:17','present',0,112,'On Time (In: 08:56 AM) | Left early by 1h 52m (Out: 04:37 PM)','7.67',NULL,'["08:56:52","16:37:17"]','2026-10-03 07:26:07'),
(77,3,'PT202608153','Komal Kushwaha','2026-09-16','09:32:44',NULL,'present',2,0,'Late by 2m (In: 09:32 AM) | No check-out recorded','0.00',NULL,'["09:32:44"]','2026-10-03 07:26:07'),
(78,5,'PT2026010103','Vikki Kumar','2026-09-17','09:01:30','18:28:09','present',0,1,'On Time (In: 09:01 AM) | Left early by 1m (Out: 06:28 PM)','9.44',NULL,'["09:01:30","18:28:09"]','2026-10-03 07:26:07'),
(79,4,'PT2025080101','Alok Kumar','2026-09-17','09:01:38','18:28:30','present',0,1,'On Time (In: 09:01 AM) | Left early by 1m (Out: 06:28 PM)','9.45',NULL,'["09:01:38","18:28:30"]','2026-10-03 07:26:07'),
(80,3,'PT202608153','Komal Kushwaha','2026-09-17','09:33:46','18:23:49','present',3,6,'Late by 3m (In: 09:33 AM) | Left early by 6m (Out: 06:23 PM)','8.83',NULL,'["09:33:46","18:23:49"]','2026-10-03 07:26:07'),
(81,5,'PT2026010103','Vikki Kumar','2026-09-18','08:59:22',NULL,'present',0,0,'On Time (In: 08:59 AM) | No check-out recorded','0.00',NULL,'["08:59:22"]','2026-10-03 07:26:07'),
(82,4,'PT2025080101','Alok Kumar','2026-09-18','08:59:44','18:17:07','present',0,12,'On Time (In: 08:59 AM) | Left early by 12m (Out: 06:17 PM)','9.29',NULL,'["08:59:44","18:17:07"]','2026-10-03 07:26:07'),
(83,3,'PT202608153','Komal Kushwaha','2026-09-18','09:32:06','18:16:45','present',2,13,'Late by 2m (In: 09:32 AM) | Left early by 13m (Out: 06:16 PM)','8.74',NULL,'["09:32:06","18:16:45"]','2026-10-03 07:26:07'),
(84,4,'PT2025080101','Alok Kumar','2026-09-19','06:38:39',NULL,'present',0,0,'On Time (In: 06:38 AM) | No check-out recorded','0.00',NULL,'["06:38:39"]','2026-10-03 07:26:07'),
(85,5,'PT2026010103','Vikki Kumar','2026-09-19','09:15:41',NULL,'present',0,0,'On Time (In: 09:15 AM) | No check-out recorded','0.00',NULL,'["09:15:41"]','2026-10-03 07:26:07'),
(86,4,'PT2025080101','Alok Kumar','2026-09-21','06:38:02','18:27:02','present',0,2,'On Time (In: 06:38 AM) | Left early by 2m (Out: 06:27 PM)','11.82',NULL,'["06:38:02","18:27:02"]','2026-10-03 07:26:07'),
(87,5,'PT2026010103','Vikki Kumar','2026-09-21','09:08:24','18:27:58','present',0,2,'On Time (In: 09:08 AM) | Left early by 2m (Out: 06:27 PM)','9.33',NULL,'["09:08:24","18:27:58"]','2026-10-03 07:26:07'),
(88,3,'PT202608153','Komal Kushwaha','2026-09-21','09:33:30','18:24:59','present',3,5,'Late by 3m (In: 09:33 AM) | Left early by 5m (Out: 06:24 PM)','8.86',NULL,'["09:33:30","18:24:59"]','2026-10-03 07:26:07'),
(89,5,'PT2026010103','Vikki Kumar','2026-09-22','08:55:16','18:31:01','present',0,0,'On Time (In: 08:55 AM) | Full day completed (Out: 06:31 PM)','9.60',NULL,'["08:55:16","18:31:01"]','2026-10-03 07:26:07'),
(90,4,'PT2025080101','Alok Kumar','2026-09-22','09:00:03','18:29:46','present',0,0,'On Time (In: 09:00 AM) | Left early by 0 min (Out: 06:29 PM)','9.50',NULL,'["09:00:03","18:29:46"]','2026-10-03 07:26:07'),
(91,3,'PT202608153','Komal Kushwaha','2026-09-22','09:33:22','18:26:16','present',3,3,'Late by 3m (In: 09:33 AM) | Left early by 3m (Out: 06:26 PM)','8.88',NULL,'["09:33:22","18:26:16"]','2026-10-03 07:26:07'),
(92,4,'PT2025080101','Alok Kumar','2026-09-23','06:49:37','18:30:45','present',0,0,'On Time (In: 06:49 AM) | Full day completed (Out: 06:30 PM)','11.69',NULL,'["06:49:37","18:30:45"]','2026-10-03 07:26:07'),
(93,5,'PT2026010103','Vikki Kumar','2026-09-23','09:04:37','18:30:55','present',0,0,'On Time (In: 09:04 AM) | Full day completed (Out: 06:30 PM)','9.44',NULL,'["09:04:37","18:30:55"]','2026-10-03 07:26:07'),
(94,3,'PT202608153','Komal Kushwaha','2026-09-23','09:35:43','18:26:35','present',5,3,'Late by 5m (In: 09:35 AM) | Left early by 3m (Out: 06:26 PM)','8.85',NULL,'["09:35:43","18:26:35"]','2026-10-03 07:26:07'),
(95,5,'PT2026010103','Vikki Kumar','2026-09-24','09:00:17','18:31:00','present',0,0,'On Time (In: 09:00 AM) | Full day completed (Out: 06:31 PM)','9.51',NULL,'["09:00:17","18:31:00"]','2026-10-03 07:26:07'),
(96,3,'PT202608153','Komal Kushwaha','2026-09-24','09:38:26','18:30:32','present',8,0,'Late by 8m (In: 09:38 AM) | Full day completed (Out: 06:30 PM)','8.87',NULL,'["09:38:26","18:30:32"]','2026-10-03 07:26:07'),
(97,4,'PT2025080101','Alok Kumar','2026-09-24','18:31:11',NULL,'present',541,0,'Late by 9h 1m (In: 06:31 PM) | No check-out recorded','0.00',NULL,'["18:31:11"]','2026-10-03 07:26:07'),
(98,5,'PT2026010103','Vikki Kumar','2026-09-25','09:08:55','18:28:09','present',0,1,'On Time (In: 09:08 AM) | Left early by 1m (Out: 06:28 PM)','9.32',NULL,'["09:08:55","18:28:09"]','2026-10-03 07:26:07'),
(99,3,'PT202608153','Komal Kushwaha','2026-09-25','09:34:08','18:23:36','present',4,6,'Late by 4m (In: 09:34 AM) | Left early by 6m (Out: 06:23 PM)','8.82',NULL,'["09:34:08","18:23:36"]','2026-10-03 07:26:07'),
(100,4,'PT2025080101','Alok Kumar','2026-09-25','18:28:02',NULL,'present',538,0,'Late by 8h 58m (In: 06:28 PM) | No check-out recorded','0.00',NULL,'["18:28:02"]','2026-10-03 07:26:07'),
(101,5,'PT2026010103','Vikki Kumar','2026-09-26','09:33:42','17:20:52','present',3,69,'Late by 3m (In: 09:33 AM) | Left early by 1h 9m (Out: 05:20 PM)','7.79',NULL,'["09:33:42","17:20:52"]','2026-10-03 07:26:07'),
(102,3,'PT202608153','Komal Kushwaha','2026-09-26','09:51:01',NULL,'present',21,0,'Late by 21m (In: 09:51 AM) | No check-out recorded','0.00',NULL,'["09:51:01"]','2026-10-03 07:26:07'),
(103,4,'PT2025080101','Alok Kumar','2026-09-26','17:20:44',NULL,'present',470,0,'Late by 7h 50m (In: 05:20 PM) | No check-out recorded','0.00',NULL,'["17:20:44"]','2026-10-03 07:26:07'),
(104,4,'PT2025080101','Alok Kumar','2026-09-28','08:58:56','18:15:02','present',0,14,'On Time (In: 08:58 AM) | Left early by 14m (Out: 06:15 PM)','9.27',NULL,'["08:58:56","18:15:02"]','2026-10-03 07:26:07'),
(105,5,'PT2026010103','Vikki Kumar','2026-09-28','09:03:52','11:04:56','present',0,445,'On Time (In: 09:03 AM) | Left early by 7h 25m (Out: 11:04 AM)','2.02',NULL,'["09:03:52","11:04:56"]','2026-10-03 07:26:07'),
(106,3,'PT202608153','Komal Kushwaha','2026-09-28','09:50:39','18:00:45','present',20,29,'Late by 20m (In: 09:50 AM) | Left early by 29m (Out: 06:00 PM)','8.17',NULL,'["09:50:39","18:00:45"]','2026-10-03 07:26:07'),
(107,4,'PT2025080101','Alok Kumar','2026-09-29','09:04:39','18:27:12','present',0,2,'On Time (In: 09:04 AM) | Left early by 2m (Out: 06:27 PM)','9.38',NULL,'["09:04:39","18:27:12"]','2026-10-03 07:26:07'),
(108,3,'PT202608153','Komal Kushwaha','2026-09-29','09:42:22','18:24:43','present',12,5,'Late by 12m (In: 09:42 AM) | Left early by 5m (Out: 06:24 PM)','8.71',NULL,'["09:42:22","18:24:43"]','2026-10-03 07:26:07'),
(109,4,'PT2025080101','Alok Kumar','2026-09-30','09:01:16','18:26:40','present',0,3,'On Time (In: 09:01 AM) | Left early by 3m (Out: 06:26 PM)','9.42',NULL,'["09:01:16","18:26:40"]','2026-10-03 07:26:07'),
(110,3,'PT202608153','Komal Kushwaha','2026-09-30','09:36:08','18:26:03','present',6,3,'Late by 6m (In: 09:36 AM) | Left early by 3m (Out: 06:26 PM)','8.83',NULL,'["09:36:08","18:26:03"]','2026-10-03 07:26:07'),
(111,4,'PT2025080101','Alok Kumar','2026-10-01','09:04:25',NULL,'present',0,0,'On Time (In: 09:04 AM) | No check-out recorded','0.00',NULL,'["09:04:25"]','2026-10-03 07:26:07'),
(112,3,'PT202608153','Komal Kushwaha','2026-10-01','09:35:02','18:24:33','present',5,5,'Late by 5m (In: 09:35 AM) | Left early by 5m (Out: 06:24 PM)','8.83',NULL,'["09:35:02","18:24:33"]','2026-10-03 07:26:07'),
(113,2,'PT202608082','Manoj Sharma','2026-10-02','13:49:48',NULL,'present',259,0,'Late by 4h 19m (In: 01:49 PM) | No check-out recorded','0.00',NULL,'["13:49:48"]','2026-10-03 07:26:07'),
(114,5,'PT2026010103','Vikki Kumar','2026-08-12','09:05:17','09:08:02','present',0,561,'On Time (In: 09:05 AM) | Left early by 9h 21m (Out: 09:08 AM)','0.05',NULL,'["09:05:17","09:05:34","09:06:16","09:08:02"]','2026-10-03 07:26:07'),
(115,3,'PT202608153','Komal Kushwaha','2026-08-12','09:33:27',NULL,'present',3,0,'Late by 3m (In: 09:33 AM) | No check-out recorded','0.00',NULL,'["09:33:27"]','2026-10-03 07:26:07'),
(116,2,'PT202608082','Manoj Sharma','2026-08-22','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-03 07:26:07'),
(117,2,'PT202608082','Manoj Sharma','2026-09-01','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(118,2,'PT202608082','Manoj Sharma','2026-09-02','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(119,2,'PT202608082','Manoj Sharma','2026-09-04','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(120,2,'PT202608082','Manoj Sharma','2026-09-07','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(121,2,'PT202608082','Manoj Sharma','2026-09-08','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(122,2,'PT202608082','Manoj Sharma','2026-09-11','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(123,2,'PT202608082','Manoj Sharma','2026-09-12','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(124,2,'PT202608082','Manoj Sharma','2026-09-14','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(125,2,'PT202608082','Manoj Sharma','2026-09-15','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(126,2,'PT202608082','Manoj Sharma','2026-09-16','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(127,2,'PT202608082','Manoj Sharma','2026-09-17','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(128,2,'PT202608082','Manoj Sharma','2026-09-18','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(129,2,'PT202608082','Manoj Sharma','2026-09-19','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(130,2,'PT202608082','Manoj Sharma','2026-09-21','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(131,2,'PT202608082','Manoj Sharma','2026-09-22','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(132,2,'PT202608082','Manoj Sharma','2026-09-23','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(133,2,'PT202608082','Manoj Sharma','2026-09-24','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(134,2,'PT202608082','Manoj Sharma','2026-09-25','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(135,2,'PT202608082','Manoj Sharma','2026-09-26','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(136,2,'PT202608082','Manoj Sharma','2026-09-28','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(137,2,'PT202608082','Manoj Sharma','2026-09-29','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(138,2,'PT202608082','Manoj Sharma','2026-09-30','09:25:00','18:30:00','present',0,0,'On Time (In: 09:25 AM) | Full day completed (Out: 06:30 PM)','9.08',NULL,'["09:25:00","18:30:00"]','2026-10-06 10:03:23'),
(139,2,'PT202608082','Manoj Sharma','2026-08-04','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(140,2,'PT202608082','Manoj Sharma','2026-08-05','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(141,2,'PT202608082','Manoj Sharma','2026-08-06','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(142,2,'PT202608082','Manoj Sharma','2026-08-07','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(143,2,'PT202608082','Manoj Sharma','2026-08-10','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(144,2,'PT202608082','Manoj Sharma','2026-08-11','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(145,2,'PT202608082','Manoj Sharma','2026-08-12','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(146,2,'PT202608082','Manoj Sharma','2026-08-13','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(147,2,'PT202608082','Manoj Sharma','2026-08-14','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(148,2,'PT202608082','Manoj Sharma','2026-08-17','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(149,2,'PT202608082','Manoj Sharma','2026-08-18','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(150,2,'PT202608082','Manoj Sharma','2026-08-19','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(151,2,'PT202608082','Manoj Sharma','2026-08-20','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(152,2,'PT202608082','Manoj Sharma','2026-08-21','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(153,2,'PT202608082','Manoj Sharma','2026-08-24','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(154,2,'PT202608082','Manoj Sharma','2026-08-25','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(155,2,'PT202608082','Manoj Sharma','2026-08-26','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(156,2,'PT202608082','Manoj Sharma','2026-08-28','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(157,2,'PT202608082','Manoj Sharma','2026-08-29','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32'),
(158,2,'PT202608082','Manoj Sharma','2026-08-31','09:20:00','18:30:00','present',0,0,'On Time (In: 09:20 AM) | Full day completed (Out: 06:30 PM)','9.17',NULL,'["09:20:00","18:30:00"]','2026-10-06 10:04:32');
/*!40000 ALTER TABLE `attendance` ENABLE KEYS */;
UNLOCK TABLES;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
